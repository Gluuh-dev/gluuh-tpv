# bandeja.ps1 — EL ICONO DEL SERVIDOR EN LA BANDEJA DEL SISTEMA.
#
# ─────────────────────────────────────────────────────────────────────────────
#  QUÉ ES
#
#  El mini-PC de debajo de la barra es el SERVIDOR. Este programa le pone un icono en la
#  BANDEJA (la esquina de abajo a la derecha, junto al reloj): así el dueño ve de un
#  vistazo que su servidor está vivo, y con un clic abre el panel con las opciones del nodo.
#
#  Es NATIVO de Windows (NotifyIcon + la ventana de app la abre Edge, que Windows 10/11 ya
#  trae). CERO megas extra: cabe dentro del instalador de siempre. La alternativa —Electron—
#  habría metido un Chromium de 200 MB en el mini-PC del bar sólo para enseñar una página.
#
#  · El icono en la esquina. El texto (al pasar el ratón) dice si todo va bien, si algo hay
#    que mirar, o si el servidor no responde: se lo pregunta al propio nodo cada 30 s.
#  · Clic en el icono → abre el panel (http://localhost:54321/servidor) en una ventana de
#    app, sin barras de navegador.
#  · Botón derecho → menú: Abrir panel · Reiniciar · Buscar actualización · Salir.
#
#  NO se ejecuta a mano: lo arranca `bandeja.vbs` (que lo lanza sin ventana negra), y el
#  instalador lo pone en el arranque del usuario.
# ─────────────────────────────────────────────────────────────────────────────

# Una sola instancia: el arranque automático y un doble clic no pueden poner DOS iconos.
$mutex = New-Object System.Threading.Mutex($false, "Gluuh.Servidor.Bandeja")
if (-not $mutex.WaitOne(0)) { exit }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$PANEL  = "http://localhost:54321/servidor"
$ESTADO = "http://localhost:54321/nodo/estado"
$ICO    = Join-Path $PSScriptRoot "instalador\gluuh.ico"

# ── Abrir el panel en una ventana de APP (sin barras de navegador) ───────────
#
# Edge en modo `--app` da una ventana limpia, como un programa de escritorio, y pinta el
# panel de Next perfectamente. Está en cualquier Windows 10/11. Si no estuviera, se abre en
# el navegador por defecto: peor aspecto, pero funciona.
function AbrirPanel {
  $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
  if (Test-Path $edge) {
    Start-Process $edge -ArgumentList "--app=$PANEL", "--window-size=1040,780"
  } else {
    Start-Process $PANEL   # navegador por defecto
  }
}

# ── Una acción del nodo (reiniciar / actualizar). El gateway sólo las acepta desde aquí
#    (localhost); por eso las puede disparar este programa, que corre EN el servidor. ──
function Accion([string]$que, [string]$aviso) {
  try {
    Invoke-RestMethod "http://localhost:54321/nodo/accion/$que" -Method Post -TimeoutSec 5 | Out-Null
    $noti.ShowBalloonTip(4000, "Servidor Gluuh", $aviso, [System.Windows.Forms.ToolTipIcon]::Info)
  } catch {
    $noti.ShowBalloonTip(4000, "Servidor Gluuh", "No se pudo. ¿Está el servidor en marcha?", [System.Windows.Forms.ToolTipIcon]::Warning)
  }
}

# ── El icono ──────────────────────────────────────────────────────────────────
$noti = New-Object System.Windows.Forms.NotifyIcon
$noti.Icon = if (Test-Path $ICO) { New-Object System.Drawing.Icon($ICO) } else { [System.Drawing.SystemIcons]::Application }
$noti.Text = "Servidor Gluuh"
$noti.Visible = $true

# Clic normal → abrir el panel.
$noti.add_MouseClick({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) { AbrirPanel }
})

# Menú del botón derecho.
$menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$menu.Items.Add("Abrir el panel", $null, { AbrirPanel })
[void]$menu.Items.Add("-")
[void]$menu.Items.Add("Reiniciar el servidor", $null, { Accion "reiniciar" "Reiniciando el servidor..." })
[void]$menu.Items.Add("Buscar actualizacion", $null, { Accion "actualizar" "Buscando actualizacion..." })
[void]$menu.Items.Add("-")
[void]$menu.Items.Add("Salir", $null, {
  $noti.Visible = $false
  [System.Windows.Forms.Application]::Exit()
})
$noti.ContextMenuStrip = $menu

# ── El semáforo: cada 30 s se pregunta al nodo cómo está y se pinta en el texto del icono ──
function ActualizarEstado {
  try {
    $e = Invoke-RestMethod $ESTADO -TimeoutSec 5
    $servicios = @($e.servicios.PSObject.Properties | ForEach-Object { $_.Value })
    $todoArriba = ($servicios.Count -gt 0) -and (-not ($servicios -contains $false))
    $relojMal = ($e.reloj.ok -eq $false)
    # NotifyIcon.Text no admite mas de 63 caracteres.
    if ($todoArriba -and -not $relojMal) {
      $noti.Text = "Servidor Gluuh - todo funcionando"
    } else {
      $noti.Text = "Servidor Gluuh - algo necesita mirarse"
    }
  } catch {
    $noti.Text = "Servidor Gluuh - NO RESPONDE"
  }
}
ActualizarEstado

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30000
$timer.add_Tick({ ActualizarEstado })
$timer.Start()

# El bucle de mensajes: sin esto el icono aparece y desaparece al instante.
[System.Windows.Forms.Application]::Run()

$noti.Dispose()
$mutex.ReleaseMutex()
