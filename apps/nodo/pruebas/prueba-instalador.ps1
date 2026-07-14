# ¿ARRANCAN LOS SCRIPTS EN EL WINDOWS DE UN BAR?
#
# ─────────────────────────────────────────────────────────────────────────────
#  POR QUÉ EXISTE ESTO
#
#  `Instalar-Gluuh.ps1` — el instalador del cliente — tenía un `??` (el operador de
#  PowerShell 7). Un Windows de fábrica trae **Windows PowerShell 5.1**, donde `??` es un
#  **error de sintaxis**: el script no se ejecuta. Ni una línea.
#
#  O sea que el `.exe` habría creado la base de datos, lanzado el instalador… y reventado
#  al instante, dejando al técnico con una máquina a medias y sin saber por qué.
#
#  Y no lo pilló nadie porque **ese script nunca se había ejecutado**: nosotros instalábamos
#  a mano, con otros comandos. Probábamos un camino distinto del que recorre el cliente.
#
#  Esta prueba carga TODOS los .ps1 con el analizador de PowerShell y falla si alguno no
#  compila. No prueba que hagan lo correcto — para eso están las demás — pero garantiza lo
#  mínimo: que arrancan en la máquina donde tienen que arrancar.
# ─────────────────────────────────────────────────────────────────────────────
#
#   .\apps\nodo\pruebas\prueba-instalador.ps1

$ErrorActionPreference = "Stop"
$raiz = Resolve-Path "$PSScriptRoot\..\..\.."

Write-Host ""
Write-Host "  PowerShell de este equipo: $($PSVersionTable.PSVersion)" -ForegroundColor DarkGray
if ($PSVersionTable.PSVersion.Major -ge 7) {
  Write-Host "  OJO: estas en PowerShell 7. Un Windows de fabrica trae 5.1, y hay sintaxis" -ForegroundColor Yellow
  Write-Host "       (??, ?., ternario, -AsHashtable) que AQUI compila y ALLI no." -ForegroundColor Yellow
}
Write-Host ""

$scripts = @(
  Get-ChildItem "$raiz\supabase\nodo\*.ps1"
  Get-ChildItem "$raiz\supabase\nodo\instalador\*.ps1"
  Get-ChildItem "$raiz\apps\nodo\pruebas\*.ps1"
)

$fallos = 0
foreach ($s in $scripts) {
  $errores = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($s.FullName, [ref]$null, [ref]$errores)

  if ($errores.Count -eq 0) {
    Write-Host ("  OK       " + $s.Name) -ForegroundColor Green
  } else {
    $fallos++
    Write-Host ("  NO CARGA " + $s.Name) -ForegroundColor Red
    foreach ($e in $errores) {
      Write-Host ("             linea $($e.Extent.StartLineNumber): $($e.Message)") -ForegroundColor DarkRed
    }
  }
}

# ── El BOM: la trampa que ya nos tumbo el vigilante una vez ──────────────────
#
# Windows PowerShell 5.1 lee un .ps1 SIN BOM como si fuera ANSI. Cualquier acento —y el
# proyecto esta en espanol— se convierte en basura y el script NO CARGA.
#
# Ya paso: el vigilante del nodo no arrancaba y no habia forma de ver por que. Y volvio a
# pasar mientras escribia esta misma prueba, con un guion largo. Se comprueba.
Write-Host ""
foreach ($s in $scripts) {
  $bytes = [IO.File]::ReadAllBytes($s.FullName)
  $tieneBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF

  # Sin acentos no hace falta BOM (es ASCII puro y se lee igual).
  $soloAscii = -not ([Text.Encoding]::UTF8.GetString($bytes) -match '[^\x00-\x7F]')

  if (-not $tieneBom -and -not $soloAscii) {
    $fallos++
    Write-Host ("  SIN BOM  " + $s.Name + " — tiene acentos y PS 5.1 lo leera como ANSI: no cargara") -ForegroundColor Red
  }
}

# ── Y la sintaxis que compila en 7 pero NO en 5.1 ────────────────────────────
#
# El analizador de arriba usa el PowerShell de ESTA maquina. Si es un 7, se traga `??` tan
# tranquilo y la prueba pasaria... para luego fallar en el bar. Asi que ademas se buscan a
# mano los operadores que no existen en 5.1.
$prohibido = @(
  @{ patron = '\?\?';          que = "?? (null-coalescing): no existe en 5.1" }
  @{ patron = '\?\.';          que = "?. (null-conditional): no existe en 5.1" }
  @{ patron = '-AsHashtable';  que = "ConvertFrom-Json -AsHashtable: no existe en 5.1" }
)

foreach ($s in $scripts) {
  # Este fichero, no: los operadores prohibidos estan escritos AQUI, porque son justo lo que
  # busca. Se delataria a si mismo en cada ejecucion.
  if ($s.FullName -eq $PSCommandPath) { continue }

  $texto = Get-Content $s.FullName -Raw
  # Y fuera los comentarios: un script puede EXPLICAR por que no usa `??` sin usarlo.
  $codigo = ($texto -split "`n" | Where-Object { $_ -notmatch '^\s*#' }) -join "`n"

  foreach ($p in $prohibido) {
    if ($codigo -match $p.patron) {
      $fallos++
      Write-Host ("  PS7 EN  " + $s.Name + ": " + $p.que) -ForegroundColor Red
    }
  }
}

Write-Host ""
if ($fallos -eq 0) {
  Write-Host "  Todos los scripts arrancan en el Windows de un bar." -ForegroundColor Green
  Write-Host ""
  exit 0
}
Write-Host "  $fallos problema(s). En el bar, esto no arranca." -ForegroundColor Red
Write-Host ""
exit 1
