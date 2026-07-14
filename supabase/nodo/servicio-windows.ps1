# servicio-windows.ps1 — que el nodo arranque SOLO al encender el ordenador y no se
# cierre nunca, sin que nadie tenga que acordarse de nada.
#
# "El servicio se levantará automático y se pondrá ahí, nunca cerrándose."
#
# POR QUÉ UNA TAREA PROGRAMADA Y NO UN SERVICIO DE WINDOWS "de verdad":
#   Un servicio nativo exige un ejecutable que hable el protocolo del Service Control
#   Manager. Node y PostgREST no lo hablan, así que haría falta un envoltorio (NSSM,
#   WinSW…): un binario más que descargar, firmar, actualizar y explicar. Una tarea
#   programada al arranque hace exactamente lo mismo —arranca sin que nadie entre, se
#   reinicia sola si se cae— y viene DENTRO de Windows. Menos piezas, menos que romper
#   en un bar donde nadie va a depurar nada.
#
#   .\servicio-windows.ps1 -Instalar
#   .\servicio-windows.ps1 -Quitar
#   .\servicio-windows.ps1 -Estado

param(
  [string]$Raiz = (Resolve-Path "$PSScriptRoot\..\.."),
  [switch]$Instalar,
  [switch]$Quitar,
  [switch]$Estado
)

$ErrorActionPreference = "Stop"
$TAREA = "Gluuh - Nodo del local"
$script = Join-Path $PSScriptRoot "arrancar-nodo.ps1"

if ($Quitar) {
  Unregister-ScheduledTask -TaskName $TAREA -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Quitado. El nodo ya no arrancará solo." -ForegroundColor Yellow
  return
}

if ($Estado) {
  $t = Get-ScheduledTask -TaskName $TAREA -ErrorAction SilentlyContinue
  if (-not $t) { Write-Host "NO instalado: el nodo no arranca solo." -ForegroundColor Red; return }
  $i = Get-ScheduledTaskInfo -TaskName $TAREA
  Write-Host "Instalado. Estado: $($t.State)"
  Write-Host "  ultima vez : $($i.LastRunTime)  (resultado $($i.LastTaskResult))"
  Write-Host "  siguiente  : $($i.NextRunTime)"
  return
}

if (-not $Instalar) {
  Write-Host "Usa -Instalar, -Quitar o -Estado"
  return
}

# Hace falta ser administrador: una tarea que arranca ANTES de que nadie inicie sesion
# no la puede registrar un usuario cualquiera.
$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Abre PowerShell como Administrador para instalar el arranque automatico." }

# `-Vigilar`: el script NO termina — se queda comprobando cada 30 s y relevantando lo que
# se caiga. Sin esta bandera, la tarea sólo arrancaba los servicios y salía, y los hijos
# quedaban huérfanos: un PostgREST muerto a las 15:00 seguía muerto hasta el siguiente
# reinicio del ordenador. Dos niveles de defensa: si el vigilante muriera, esta tarea lo
# reinicia (RestartCount, abajo).
#
# `-WorkingDirectory`: una tarea de SYSTEM arranca en `C:\Windows\System32`. Y varios
# scripts del nodo buscan cosas RELATIVAS al directorio actual — `copia.mjs` busca
# `pg_dump.exe` en `.nodo\pgsql\bin` con `path.resolve(".")`. Sin esto, la copia de
# seguridad de todas las noches fallaria en silencio, y el dia que se rompa el disco del bar
# no habria ninguna.
$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Raiz `"$Raiz`" -Vigilar" `
  -WorkingDirectory $Raiz

# Al ARRANCAR el ordenador, no al iniciar sesion: el bar enciende el mini-PC y ya está,
# aunque nadie toque el teclado ni entre con ningun usuario.
$disparador = New-ScheduledTaskTrigger -AtStartup

$opciones = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)   # sin limite: esto no "termina", vive

# SYSTEM: arranca sin que nadie inicie sesion.
$cuenta = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TAREA -Action $accion -Trigger $disparador `
  -Settings $opciones -Principal $cuenta -Force `
  -Description "Levanta la base de datos, el auth, el realtime y las imagenes del local. Sin esto los TPV no cobran." | Out-Null

Write-Host "`nListo. El nodo arrancara solo cada vez que se encienda el ordenador." -ForegroundColor Green
Write-Host "Si se cae, Windows lo reintenta cada minuto.`n"
