# instalar-nodo.ps1 — levanta la base de datos del NODO LOCAL desde cero.
#
#   1) 00_bootstrap_nodo.sql  roles, esquema auth, pgcrypto, publicación realtime
#   2) supabase/migrations/*  las 100 migraciones (se anotan en nodo_migracion)
#   3) 02..06_*_nodo.sql      realtime, imágenes, sincronización, auth y permisos
#
# El orden es el evidente, y eso es NUEVO: mientras hubo GoTrue en el nodo había que
# meterlo en medio (arrancarlo para que creara auth.users) y luego reparar `auth.uid()`,
# porque él la pisaba con la forma antigua y dejaba la RLS devolviendo CERO filas a todo
# el mundo, sin un solo error.
#
# Se fue GoTrue —el nodo firma sus propios tokens (apps/nodo/auth.mjs)— y con él las dos
# trampas. Se conserva el histórico en supabase/nodo/README.md por si alguien se pregunta
# por qué esto parecía tan complicado.

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
  # `ErrorActionPreference = 'Continue'` local, y esto NO es opcional:
  #
  # psql escribe los NOTICE por STDERR (p. ej. «role ... already granted», o los `raise
  # notice` de las migraciones). Con `ErrorActionPreference = 'Stop'` puesto arriba, cada
  # linea de stderr de un ejecutable nativo se convierte en un ERROR TERMINANTE en
  # PowerShell 5.1 — y un NOTICE (que no es un fallo) mataria la instalacion a media faena.
  #
  # No saltaba en el instalador real porque su salida va a un fichero (los stderr se
  # consumen ahi y no burbujean), pero en cuanto alguien ejecuta esto a mano, revienta con
  # un "error" que en realidad es un aviso inofensivo.
  #
  # Un ERROR de verdad SI se detecta: `-v ON_ERROR_STOP=1` hace que psql salga con codigo
  # distinto de cero, y de eso nos ocupamos abajo.
  $ErrorActionPreference = 'Continue'
  & psql -h 127.0.0.1 -p $Puerto -U postgres -d $Bd -q -v ON_ERROR_STOP=1 -f $file 2>&1 |
    ForEach-Object { "$_" }
  if ($LASTEXITCODE -ne 0) { throw "falló: $file" }
}

# ── 0. ARRANCAR POSTGRES ─────────────────────────────────────────────────────
#
# `initdb` (que corre antes que esto, desde el instalador) CREA la base de datos pero NO la
# arranca. Y `dropdb`/`createdb` y todas las migraciones de abajo necesitan un Postgres EN
# MARCHA. En una maquina limpia no lo esta:
#
#     dropdb: fallo la conexion al servidor en 127.0.0.1, puerto 55432: Connection refused
#
# En NUESTRA maquina no se veia porque el Postgres de desarrollo ya estaba corriendo y se
# colaba ahi. En el ordenador de un bar, recien instalado, no hay ningun Postgres. Otra vez
# el mismo patron: probar un camino que el cliente no recorre.
#
# `-o "-p $Puerto"` es OBLIGATORIO (REGLA Nº1): sin esa bandera pg_ctl coge el puerto del
# postgresql.conf (el 5432 de fabrica) y se pisaria con un Postgres del sistema.
Paso 0 "Arrancando Postgres"
& "$nodo\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $Puerto -q
if ($LASTEXITCODE -ne 0) {
  # Lanzar y soltar, NUNCA `| Out-Null` ni `Start-Process -Wait`: los dos se cuelgan para
  # siempre cuando no hay consola (postgres.exe no cierra la tuberia / no termina nunca).
  Start-Process -FilePath "$nodo\pgsql\bin\pg_ctl.exe" `
    -ArgumentList "-D `"$nodo\pgdata`" -o `"-p $Puerto`" -l `"$nodo\tmp\pg.log`" start" `
    -WindowStyle Hidden

  $listo = $false
  foreach ($i in 1..60) {
    & "$nodo\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $Puerto -q
    if ($LASTEXITCODE -eq 0) { $listo = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $listo) { throw "Postgres no llego a aceptar conexiones en el puerto $Puerto" }
}

# ── 0-bis. Base de datos limpia ──────────────────────────────────────────────
if ($Recrear) {
  Write-Host "    Recreando la base de datos '$Bd'" -ForegroundColor Cyan
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

# ── 2. Las migraciones de la aplicación ──────────────────────────────────────
#
# Ya no hay paso de GoTrue en medio. Antes había que arrancarlo aquí para que creara
# `auth.users` con su automigrate, y luego reparar `auth.uid()` porque él la pisaba con
# la forma antigua y dejaba la RLS muda. El nodo firma sus propios tokens
# (apps/nodo/auth.mjs), así que el bootstrap ya crea las dos cosas bien y nadie las toca.
Paso 2 "Aplicando las migraciones de supabase/migrations"
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

# ── 3. Lo propio del nodo ────────────────────────────────────────────────────
# Va DESPUÉS de las migraciones: los triggers de realtime se ponen a cada tabla de la
# publicación `supabase_realtime`, o sea exactamente las mismas que emite la nube.
Paso 3 "Realtime, imágenes, sincronización y autenticación del nodo"
Sql "$PSScriptRoot\02_realtime_nodo.sql"
Sql "$PSScriptRoot\03_media_nodo.sql"
Sql "$PSScriptRoot\04_sync_nodo.sql"
Sql "$PSScriptRoot\06_auth_nodo.sql"
# Los permisos, LOS ÚLTIMOS: tienen que cubrir todas las tablas que acaban de nacer.
Sql "$PSScriptRoot\05_permisos_nodo.sql"

# ── 4. ¿Ha quedado igual que la nube? ────────────────────────────────────────
Paso 4 "Verificando"
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
