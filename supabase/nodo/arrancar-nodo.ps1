# arrancar-nodo.ps1 — levanta el NODO entero. Un comando, cinco servicios.
#
#   Postgres   :55432   la verdad
#   PostgREST  :55433   los datos por HTTP
#   GoTrue     :55434   quién eres
#   Realtime   :55435   "el comandero ha picado algo"
#   Media      :55436   las fotos de la carta
#   Gateway    :54321   ← lo único que ve el TPV. Reparte a los otros cinco.
#
# El día que esto sea un servicio de Windows, hará exactamente esto mismo.
#
#   .\arrancar-nodo.ps1          arranca lo que esté parado
#   .\arrancar-nodo.ps1 -Parar   lo para todo

param(
  [string]$Raiz = (Resolve-Path "$PSScriptRoot\..\.."),
  [int]$Puerto = 55432,
  [switch]$Parar,
  # Para todo MENOS la base de datos. Lo usa el actualizador: hay que parar los servicios
  # para cambiarles el código, pero Postgres tiene que seguir vivo — si no, las
  # migraciones se aplican contra una base de datos apagada y la actualización falla.
  [switch]$MantenerBd
)

$ErrorActionPreference = "Stop"
$nodo = Join-Path $Raiz ".nodo"
$env:PATH = "$nodo\pgsql\bin;$env:PATH"   # postgrest.exe necesita libpq.dll de aquí

function Servicios() {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'gateway\.mjs|realtime\.mjs|media\.mjs|sincronizar\.mjs' }
}

if ($Parar) {
  Servicios | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Get-Process gotrue, postgrest -ErrorAction SilentlyContinue | Stop-Process -Force
  if ($MantenerBd) {
    Write-Host "Servicios parados (la base de datos sigue en marcha)." -ForegroundColor Yellow
  } else {
    & "$nodo\pgsql\bin\pg_ctl.exe" -D "$nodo\pgdata" stop -m fast 2>&1 | Out-Null
    Write-Host "Nodo parado." -ForegroundColor Yellow
  }
  return
}

function Arranca($nombre, $bloque) {
  Write-Host ("  {0,-10} " -f $nombre) -NoNewline
  & $bloque
  Write-Host "OK" -ForegroundColor Green
}

Write-Host "`nLevantando el nodo…`n" -ForegroundColor Cyan

# ── Postgres ─────────────────────────────────────────────────────────────────
#
# Y ESPERAR A QUE ESTÉ LISTO DE VERDAD. No vale dormir unos segundos y cruzar los dedos:
# `pg_ctl start` vuelve enseguida, pero Postgres tarda en aceptar conexiones — y más en
# un mini-PC arrancando por la mañana, con el disco ocupado y Windows recién encendido.
# Si GoTrue y PostgREST salen antes de tiempo, se mueren con «connection refused» y el
# nodo amanece MUERTO: los TPV no cobran y nadie sabe por qué. Se espera a que conteste.
Arranca "Postgres" {
  if (-not (Get-Process postgres -ErrorAction SilentlyContinue)) {
    # `-o "-p $Puerto"` NO sobra: sin él, pg_ctl usa el puerto de postgresql.conf, que es
    # el 5432 de fábrica. PostgREST y GoTrue hablan al 55432 → no conectarían con nada y
    # el nodo arrancaría "vivo" pero mudo. (Antes parecía funcionar sólo porque ya había
    # una instancia levantada a mano con el puerto bueno.)
    & "$nodo\pgsql\bin\pg_ctl.exe" -D "$nodo\pgdata" -o "-p $Puerto" -l "$nodo\tmp\pg.log" start | Out-Null
  }
  $listo = $false
  foreach ($i in 1..60) {   # hasta 60 s: un arranque lento no puede dejar el bar sin TPV
    & "$nodo\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $Puerto -q
    if ($LASTEXITCODE -eq 0) { $listo = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $listo) { throw "Postgres no llegó a aceptar conexiones" }
}

# ── PostgREST ────────────────────────────────────────────────────────────────
Arranca "PostgREST" {
  if (-not (Get-Process postgrest -ErrorAction SilentlyContinue)) {
    Start-Process "$nodo\bin\postgrest.exe" -ArgumentList "$nodo\postgrest.conf" `
      -WorkingDirectory $nodo -RedirectStandardOutput "$nodo\tmp\prst.log" `
      -RedirectStandardError "$nodo\tmp\prst.err" -WindowStyle Hidden
  }
}

# ── GoTrue ───────────────────────────────────────────────────────────────────
Arranca "GoTrue" {
  if (-not (Get-Process gotrue -ErrorAction SilentlyContinue)) {
    Get-Content "$nodo\gotrue.env" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
      $k, $v = $_ -split '=', 2
      [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
    }
    Start-Process "$nodo\bin\gotrue.exe" -WorkingDirectory $nodo `
      -RedirectStandardOutput "$nodo\tmp\gt.log" -RedirectStandardError "$nodo\tmp\gt.err" -WindowStyle Hidden
  }
}

# ── Los de Node ──────────────────────────────────────────────────────────────
$yaVivos = (Servicios | ForEach-Object { $_.CommandLine })
foreach ($s in @("realtime", "media", "gateway")) {
  Arranca $s {
    if (-not ($yaVivos -match "$s\.mjs")) {
      Start-Process node -ArgumentList "$Raiz\apps\nodo\$s.mjs" -WorkingDirectory $Raiz `
        -RedirectStandardOutput "$nodo\tmp\$s.log" -RedirectStandardError "$nodo\tmp\$s.err" -WindowStyle Hidden
      Start-Sleep -Milliseconds 700
    }
  }
}

# El sincronizador sólo si hay credenciales de la nube. Un bar sin módulo de nube
# funciona igual: vende, cobra e imprime. Simplemente no sube nada.
if (Test-Path "$nodo\sync.env") {
  Arranca "sync" {
    if (-not ($yaVivos -match "sincronizar\.mjs")) {
      Start-Process node -ArgumentList "$Raiz\apps\nodo\sincronizar.mjs --bucle" -WorkingDirectory $Raiz `
        -RedirectStandardOutput "$nodo\tmp\sync.log" -RedirectStandardError "$nodo\tmp\sync.err" -WindowStyle Hidden
    }
  }
} else {
  Write-Host "  sync       (sin credenciales de la nube: no sube nada)" -ForegroundColor DarkGray
}

Start-Sleep -Seconds 3

# ── ¿De verdad está todo vivo? ───────────────────────────────────────────────
Write-Host "`nComprobando…`n" -ForegroundColor Cyan
$todo = $true
$pruebas = @(
  @{ n = "datos    (/rest/v1)";     u = "http://127.0.0.1:54321/rest/v1/" }
  @{ n = "auth     (/auth/v1)";     u = "http://127.0.0.1:54321/auth/v1/health" }
  @{ n = "imagenes (/storage/v1)";  u = "http://127.0.0.1:54321/storage/v1/object/public/media/_"; ok404 = $true }
)
foreach ($p in $pruebas) {
  try {
    Invoke-WebRequest $p.u -TimeoutSec 5 -UseBasicParsing | Out-Null
    Write-Host "  $($p.n)  OK" -ForegroundColor Green
  } catch {
    # Una imagen que no existe responde 404: eso significa que el servicio ESTÁ vivo.
    if ($p.ok404 -and $_.Exception.Response.StatusCode.value__ -eq 404) {
      Write-Host "  $($p.n)  OK" -ForegroundColor Green
    } else {
      Write-Host "  $($p.n)  FALLA" -ForegroundColor Red
      $todo = $false
    }
  }
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
       Select-Object -First 1).IPAddress

if ($todo) {
  Write-Host "`nNodo en marcha. Los TPV de la barra entran por:" -ForegroundColor Green
  Write-Host "    http://${ip}:54321`n" -ForegroundColor White
} else {
  Write-Host "`nAlgo no arrancó. Mira los .log de .nodo\tmp\`n" -ForegroundColor Red
}
