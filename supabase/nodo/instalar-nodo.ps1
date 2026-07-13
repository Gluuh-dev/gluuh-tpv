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
  [switch]$Recrear   # borra la BD y la rehace desde cero
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

# ── 2. GoTrue: que cree SU auth.users con automigrate ────────────────────────
Paso 2 "Arrancando GoTrue para que migre el esquema auth"
Get-Process gotrue -ErrorAction SilentlyContinue | Stop-Process -Force
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
