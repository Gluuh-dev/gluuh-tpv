# CADA BAR, SUS PROPIAS CLAVES.
#
# Hasta hoy todos los nodos compartian el secreto JWT de desarrollo... que esta en el
# repositorio y en el manual. Con un secreto compartido, cualquiera que lo lea puede
# firmar un token de `service_role` valido para CUALQUIER nodo al que alcance por red
# -el wifi del bar, un portatil en la terraza- y saltarse toda su RLS.
#
# Ahora el instalador genera un secreto aleatorio por instalacion. Esta prueba comprueba
# lo unico que importa:
#
#   1. la clave de ADMINISTRADOR de ESTE nodo entra
#   2. la del MANUAL (el secreto de desarrollo) YA NO ABRE NADA
#
# Se prueba con `service_role` a proposito: la clave `anon` no tiene permiso de lectura
# sobre `category` (la RLS la rechaza venga con la firma que venga), asi que no
# distinguiria una firma buena de una mala. La de administrador SI se salta la RLS: si
# esa entrara con el secreto del manual, seria una fuga de verdad.
#
#   .\apps\nodo\pruebas\prueba-secretos.ps1
#
# (Para reinstalar el nodo con claves nuevas: Instalar-Gluuh.ps1 las genera solo.)

$raiz = (Resolve-Path "$PSScriptRoot\..\..\..")
Set-Location $raiz
$nodo = Join-Path $raiz ".nodo"

$SECRETO_DEL_MANUAL = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars"

# El secreto de ESTE nodo lo deja el instalador aqui.
$envNodo = Join-Path $nodo "nodo.env"
if (-not (Test-Path $envNodo)) {
  Write-Host "No hay .nodo\nodo.env: este nodo no se instalo con claves propias." -ForegroundColor Red
  Write-Host "Instalalo con Instalar-Gluuh.ps1 (o instalar-nodo.ps1 -JwtSecreto ...)" -ForegroundColor DarkGray
  exit 1
}
$secretoDelBar = ((Get-Content $envNodo | Where-Object { $_ -match '^NODO_JWT_SECRETO=' }) -split '=', 2)[1]

Write-Host "Secreto de este bar : $($secretoDelBar.Substring(0,12))..." -ForegroundColor DarkGray
Write-Host "Secreto del manual  : $($SECRETO_DEL_MANUAL.Substring(0,12))..." -ForegroundColor DarkGray

# La 2a clave que imprime claves.mjs es la de administrador (service_role).
$svcDelBar   = (node "$raiz\apps\nodo\claves.mjs" $secretoDelBar      | Where-Object { $_ -match '^eyJ' })[1]
$svcDelManual = (node "$raiz\apps\nodo\claves.mjs" $SECRETO_DEL_MANUAL | Where-Object { $_ -match '^eyJ' })[1]

function PideDatos([string]$token) {
  try {
    Invoke-WebRequest "http://127.0.0.1:54321/rest/v1/category?select=nombre" `
      -Headers @{ apikey = $token; authorization = "Bearer $token" } -TimeoutSec 8 -UseBasicParsing | Out-Null
    return @{ ok = $true; codigo = 200 }
  } catch {
    $c = 0
    if ($_.Exception.Response) { $c = $_.Exception.Response.StatusCode.value__ }
    return @{ ok = $false; codigo = $c }
  }
}

Write-Host "`nPidiendo la carta con la clave de ADMINISTRADOR (se salta la RLS)" -ForegroundColor Cyan

$conLaDelBar    = PideDatos $svcDelBar
$conLaDelManual = PideDatos $svcDelManual

Write-Host "   clave de ESTE bar : $(if ($conLaDelBar.ok) { 'ENTRA (HTTP 200)' } else { "RECHAZADA (HTTP $($conLaDelBar.codigo))" })" `
  -ForegroundColor $(if ($conLaDelBar.ok) { 'Green' } else { 'Red' })
Write-Host "   clave del MANUAL  : $(if ($conLaDelManual.ok) { 'ENTRA -- FUGA!' } else { "RECHAZADA (HTTP $($conLaDelManual.codigo)) - firma invalida" })" `
  -ForegroundColor $(if ($conLaDelManual.ok) { 'Red' } else { 'Green' })

$bien = $conLaDelBar.ok -and (-not $conLaDelManual.ok)

Write-Host ""
Write-Host ("=" * 64)
if ($bien) {
  Write-Host "OK: cada bar tiene su clave. La del manual ya no abre NINGUN nodo." -ForegroundColor Green
} else {
  Write-Host "MAL: el aislamiento de claves no funciona." -ForegroundColor Red
}
Write-Host ("=" * 64)

exit $(if ($bien) { 0 } else { 1 })
