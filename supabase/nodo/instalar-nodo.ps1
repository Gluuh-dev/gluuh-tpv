# instalar-nodo.ps1 — levanta la base de datos del NODO LOCAL desde cero.
#
# El ORDEN es lo único que importa aquí, y no es el obvio:
#
#   1) 00_bootstrap_nodo.sql   roles, esquema `auth` VACÍO, pgcrypto, publicación realtime
#   2) gotrue.exe (automigrate) crea auth.users… y de paso PISA auth.uid() con la forma
#                               antigua (`request.jwt.claim.sub`), que PostgREST ya no publica
#   3) 01_despues_de_gotrue.sql vuelve a poner auth.uid()/role()/jwt() BIEN
#   4) supabase/migrations/*    las 99 migraciones; sus FK a auth.users ya resuelven
#
# Si se invierte 1↔2, GoTrue no arranca. Si se salta el 3, la RLS multi-tenant
# devuelve CERO filas a todo el mundo, sin un solo error. Los dos fallos costaron
# encontrarlos; por eso este script existe en vez de una lista de pasos en un README.

param(
  [string]$Raiz  = (Resolve-Path "$PSScriptRoot\..\.."),
  [int]   $Puerto = 55432,
  [string]$Bd     = "gluuh",
  [switch]$Recrear,   # borra la BD y la rehace desde cero

  # SECRETOS DE ESTE BAR. Los genera el instalador (Instalar-Gluuh.ps1), distintos en
  # cada local. Sin ellos se usan los de desarrollo — que valen para NUESTRA máquina y
  # para nada más: están en el repositorio y en el manual.
  #
  # El que de verdad importa es el JWT: con él se firman los tokens que valida PostgREST.
  # Si fuera el mismo en todos los bares, cualquiera que leyera el manual podría firmar un
  # `service_role` válido para CUALQUIER nodo al que alcanzara por red — el wifi del local,
  # un portátil en la terraza — y saltarse toda la RLS de ese bar.
  [string]$JwtSecreto = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars",
  [string]$PgClave    = "authenticator_dev"
)

$ErrorActionPreference = "Stop"
$nodo = Join-Path $Raiz ".nodo"
$env:PATH = "$nodo\pgsql\bin;$env:PATH"
$env:PGPASSWORD = "gluuh"
# Las migraciones están en UTF-8 y llenas de acentos (el proyecto es en español). Sin
# esto, psql supone WIN1252 —la codificación de un Windows español— y muere en la
# primera tilde.
$env:PGCLIENTENCODING = "UTF8"

function Paso($n, $txt) { Write-Host "`n[$n] $txt" -ForegroundColor Cyan }
function Sql($file) {
  psql -h 127.0.0.1 -p $Puerto -U postgres -d $Bd -q -v ON_ERROR_STOP=1 -f $file
  if ($LASTEXITCODE -ne 0) { throw "falló: $file" }
}

# ── 0. Base de datos limpia ──────────────────────────────────────────────────
if ($Recrear) {
  Paso 0 "Recreando la base de datos '$Bd'"
  # --force echa a PostgREST y a quien tenga la BD abierta (si no, dropdb falla).
  dropdb   -h 127.0.0.1 -p $Puerto -U postgres --if-exists --force $Bd
  createdb -h 127.0.0.1 -p $Puerto -U postgres $Bd
}

# ── 1. Bootstrap: lo que Supabase regala y un Postgres pelado no tiene ───────
Paso 1 "Bootstrap (roles, esquema auth, pgcrypto, publicación realtime)"
Sql "$PSScriptRoot\00_bootstrap_nodo.sql"

# ── 1-bis. Las contraseñas de los roles, propias de este bar ─────────────────
# El bootstrap crea los roles con contraseñas de desarrollo (están en el repositorio).
# Aquí se cambian por las de esta instalación. La base de datos sólo escucha en 127.0.0.1
# —no es alcanzable desde la red del bar— pero un secreto compartido entre clientes no se
# defiende solo: se cambia.
@"
alter role authenticator        with password '$PgClave';
alter role supabase_auth_admin  with password '$PgClave';
"@ | Out-File "$nodo\tmp\claves_roles.sql" -Encoding ascii
Sql "$nodo\tmp\claves_roles.sql"
Remove-Item "$nodo\tmp\claves_roles.sql" -Force   # no dejar la contraseña en un fichero

# ── 2. GoTrue: que cree SU auth.users con automigrate ────────────────────────
Paso 2 "Arrancando GoTrue para que migre el esquema auth"
Get-Process gotrue -ErrorAction SilentlyContinue | Stop-Process -Force

# El gotrue.env de este bar: su secreto JWT y su contraseña de base de datos. Tiene que
# firmar con EL MISMO secreto con el que PostgREST valida, o no entra nadie.
@"
GOTRUE_JWT_SECRET=$JwtSecreto
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role,supabase_admin
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:$PgClave@127.0.0.1:$Puerto/$Bd`?search_path=auth
GOTRUE_DB_NAMESPACE=auth
GOTRUE_DB_MIGRATIONS_PATH=./auth-src/migrations
GOTRUE_API_HOST=127.0.0.1
PORT=55434
API_EXTERNAL_URL=http://127.0.0.1:55434
GOTRUE_SITE_URL=http://localhost:3100
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_SMS_AUTOCONFIRM=true
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_EXTERNAL_PHONE_ENABLED=false
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook
GOTRUE_LOG_LEVEL=info
"@ | Out-File "$nodo\gotrue.env" -Encoding ascii

Get-Content "$nodo\gotrue.env" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
}
$gt = Start-Process -FilePath "$nodo\bin\gotrue.exe" -WorkingDirectory $nodo `
      -RedirectStandardOutput "$nodo\tmp\gotrue.log" -RedirectStandardError "$nodo\tmp\gotrue.err" `
      -PassThru -WindowStyle Hidden

$vivo = $false
foreach ($i in 1..20) {
  Start-Sleep -Milliseconds 700
  if ($gt.HasExited) { break }
  try { Invoke-RestMethod "http://127.0.0.1:55434/health" -TimeoutSec 2 | Out-Null; $vivo = $true; break } catch { }
}
if (-not $vivo) {
  Write-Host (Get-Content "$nodo\tmp\gotrue.err" -Tail 3) -ForegroundColor Red
  throw "GoTrue no arrancó"
}
Write-Host "    GoTrue vivo en :55434 (pid $($gt.Id))" -ForegroundColor Green

# ── 3. Reparar auth.uid() DESPUÉS de que GoTrue la haya pisado ───────────────
Paso 3 "Reponiendo auth.uid()/role()/jwt() (GoTrue las deja con la forma antigua)"
Sql "$PSScriptRoot\01_despues_de_gotrue.sql"

# ── 4. Las migraciones de la aplicación ──────────────────────────────────────
Paso 4 "Aplicando las migraciones de supabase/migrations"
$migs = Get-ChildItem "$Raiz\supabase\migrations\*.sql" | Sort-Object Name
foreach ($m in $migs) {
  Sql $m.FullName
  # Se ANOTA cada una: el actualizador sólo aplicará las que falten. Reaplicarlas todas
  # no vale — 0001_init.sql hace `create table tenant` sin `if not exists`.
  $ins = "insert into public.nodo_migracion (fichero) values ('$($m.Name)') on conflict do nothing;"
  $ins | Out-File "$nodo\tmp\anotar.sql" -Encoding ascii
  psql -h 127.0.0.1 -p $Puerto -U postgres -d $Bd -q -f "$nodo\tmp\anotar.sql"
}
Write-Host "    $($migs.Count) migraciones aplicadas y anotadas" -ForegroundColor Green

# ── 5. Realtime del nodo: que Postgres avise de los cambios ──────────────────
# Va DESPUÉS de las migraciones: pone un trigger a cada tabla de la publicación
# `supabase_realtime`, o sea exactamente las mismas que emite la nube.
Paso 5 "Realtime del nodo (LISTEN/NOTIFY sobre las tablas publicadas)"
Sql "$PSScriptRoot\02_realtime_nodo.sql"
Sql "$PSScriptRoot\03_media_nodo.sql"
Sql "$PSScriptRoot\04_sync_nodo.sql"
# Los permisos, LOS ÚLTIMOS: tienen que cubrir todas las tablas que acaban de nacer.
Sql "$PSScriptRoot\05_permisos_nodo.sql"

# ── 6. ¿Ha quedado igual que la nube? ────────────────────────────────────────
Paso 6 "Verificando"
$q = @"
select 'tablas   : ' || count(*) from pg_tables where schemaname='public'
union all
select 'con RLS  : ' || count(*) from pg_tables where schemaname='public' and rowsecurity
union all
select 'realtime : ' || count(*) from pg_publication_tables where pubname='supabase_realtime'
union all
select 'auth.uid : ' || case when pg_get_functiondef('auth.uid()'::regprocedure) like '%request.jwt.claims%'
                            then 'OK (plural)' else 'ROTA — la RLS no verá nada' end;
"@
$q | Out-File "$nodo\tmp\verif.sql" -Encoding utf8
psql -h 127.0.0.1 -p $Puerto -U postgres -d $Bd -t -f "$nodo\tmp\verif.sql"

Write-Host "`nNodo listo.`n" -ForegroundColor Green
