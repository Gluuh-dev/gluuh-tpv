# Instalar-TPV.ps1 — INSTALADOR DE UNA TERMINAL. Se ejecuta en cada TPV del bar.
#
# Una sola pregunta: la direccion del servidor. Nada mas.
#
# ─────────────────────────────────────────────────────────────────────────────
#  POR QUE UNA SOLA PREGUNTA
#
#  Porque el servidor sirve la INTERFAZ ademas de los datos. La terminal solo tiene que
#  saber a donde mirar: la clave, la URL de los datos y todo lo demas se los da el propio
#  servidor al cargar la pagina.
#
#  Antes habia que rellenar cuatro variables en un `.env.local` EN CADA MAQUINA. Y
#  equivocarse en una —poner la clave de la nube donde va la del nodo— dejaba a los
#  camareros fuera sin decir por que. Ese fichero ya no existe.
#
#  Ademas: al actualizar el servidor se actualizan TODAS las terminales a la vez. No hay
#  que ir maquina por maquina.
# ─────────────────────────────────────────────────────────────────────────────
#
#   .\Instalar-TPV.ps1                     pregunta la direccion
#   .\Instalar-TPV.ps1 -Servidor 192.168.1.50   sin preguntar (para instalaciones en serie)

param(
  [string]$Servidor,
  [int]$Puerto = 54321,

  # AQUI lee la app de escritorio su servidor: `app.getPath("userData")/config.json`
  # (apps/desktop/src/config.ts). En Windows, userData es %APPDATA%\<productName>, y el
  # productName es "Gluuh TPV" (apps/desktop/electron-builder.yml).
  #
  # Si esta ruta no coincide EXACTAMENTE, el instalador deja el fichero donde nadie lo
  # lee: la app arranca contra localhost, no encuentra nada, y el tecnico se vuelve loco.
  [string]$Config = "$env:APPDATA\Gluuh TPV\config.json"
)

$ErrorActionPreference = "Stop"

function Bien($t) { Write-Host "   $t" -ForegroundColor Green }
function Mal($t)  { Write-Host "   $t" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "   GLUUH TPV - Instalacion de una terminal" -ForegroundColor White
Write-Host "   =======================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Esta terminal se conectara al SERVIDOR del bar."
Write-Host "   La direccion esta en la hoja de instalacion (INSTALACION.txt)."
Write-Host ""

# ── La unica pregunta ────────────────────────────────────────────────────────
$url = $null
while (-not $url) {
  if (-not $Servidor) {
    $Servidor = Read-Host "   Direccion del servidor (ej: 192.168.1.50)"
  }

  # Se admite tal cual, con http:// o con puerto. Al tecnico no le vamos a pedir
  # que escriba una URL perfecta a las once de la noche.
  $limpio = $Servidor -replace '^https?://', '' -replace '/.*$', ''
  if ($limpio -notmatch ':') { $limpio = "${limpio}:$Puerto" }
  $prueba = "http://$limpio"

  Write-Host "   Buscando el servidor en $prueba ..." -ForegroundColor DarkGray
  try {
    $estado = Invoke-RestMethod "$prueba/nodo/estado" -TimeoutSec 8
  } catch {
    Mal "No responde. Comprueba que el servidor este encendido y que esta terminal"
    Mal "este en la misma red (por cable o por el wifi del local, no el de invitados)."
    $Servidor = $null
    continue
  }

  # Que responda no basta: hay que ver que esta SANO. Si el servidor tiene la base de
  # datos caida, mejor enterarse ahora que cuando el camarero intente cobrar.
  $caidos = @()
  foreach ($s in $estado.servicios.PSObject.Properties) {
    if (-not $s.Value) { $caidos += $s.Name }
  }
  if ($caidos.Count -gt 0) {
    Mal "El servidor responde, pero tiene servicios caidos: $($caidos -join ', ')"
    Mal "Arreglalo antes de instalar terminales."
    exit 1
  }

  $url = $prueba
  Bien "Servidor encontrado y sano"
  Write-Host "     productos: $($estado.contenido.productos)   mesas: $($estado.contenido.mesas)   empleados: $($estado.contenido.usuarios)" -ForegroundColor DarkGray
}

# ── Y ya esta ────────────────────────────────────────────────────────────────
#
# Lo unico que se guarda en la terminal es la direccion. La clave y la configuracion se
# las da el servidor cada vez que se carga la pagina — asi que si algun dia cambian, no
# hay que tocar ni una terminal.
New-Item -ItemType Directory -Force -Path (Split-Path $Config) | Out-Null
@{ servidor = $url } | ConvertTo-Json | Out-File $Config -Encoding utf8

Write-Host ""
Write-Host "   ================================================" -ForegroundColor Green
Write-Host "    Terminal lista." -ForegroundColor Green
Write-Host "   ================================================" -ForegroundColor Green
Write-Host ""
Write-Host "    Servidor: $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "    No hay nada mas que configurar. La clave y los ajustes se los" -ForegroundColor DarkGray
Write-Host "    pide al servidor cada vez que arranca." -ForegroundColor DarkGray
Write-Host ""
Write-Host "    Si el servidor cambia de IP, vuelve a ejecutar esto." -ForegroundColor DarkGray
Write-Host "    (Mejor: fija la IP del servidor en el router y no cambiara.)" -ForegroundColor DarkGray
Write-Host ""
