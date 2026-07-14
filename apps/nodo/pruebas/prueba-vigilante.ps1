# ¿SE CUMPLE LO DE "NUNCA CERRANDOSE"?
#
# La promesa al cliente: el servidor se levanta solo y no se cae nunca. Hasta hoy, la
# tarea de Windows reiniciaba el SCRIPT de arranque, pero el script arrancaba los
# servicios y terminaba: los hijos quedaban huerfanos. Un PostgREST muerto a las 15:00
# seguia muerto hasta el siguiente reinicio del ordenador.
#
# Esto lo comprueba a lo bruto: mata PostgREST y mira si vuelve solo.
#
#   .\apps\nodo\pruebas\prueba-vigilante.ps1

$raiz = (Resolve-Path "$PSScriptRoot\..\..\..")
Set-Location $raiz

# Un solo vigilante. Dos peleandose por el mismo fichero de log se estorban.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'arrancar-nodo' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "1. Nodo en marcha CON VIGILANTE (como corre en el bar)" -ForegroundColor Cyan
& "$raiz\supabase\nodo\arrancar-nodo.ps1" -Parar | Out-Null
Start-Sleep -Seconds 3
Remove-Item "$raiz\.nodo\tmp\vigilante.log" -Force -ErrorAction SilentlyContinue

# Con la salida a fichero: si el vigilante se cae o se cuelga, hay que poder verlo.
Start-Process powershell -ArgumentList `
  "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\supabase\nodo\arrancar-nodo.ps1`" -Vigilar" `
  -RedirectStandardOutput "$raiz\.nodo\tmp\vig-out.txt" `
  -RedirectStandardError  "$raiz\.nodo\tmp\vig-err.txt" -WindowStyle Hidden

foreach ($i in 1..24) {
  Start-Sleep -Seconds 5
  if (Get-Process postgrest -ErrorAction SilentlyContinue) { break }
}
if (-not (Get-Process postgrest -ErrorAction SilentlyContinue)) {
  Write-Host "   el nodo no arranco: aborto" -ForegroundColor Red
  Get-Content "$raiz\.nodo\tmp\vig-err.txt" -Tail 6 -ErrorAction SilentlyContinue
  exit 1
}
Write-Host "   PostgREST vivo" -ForegroundColor Green

Write-Host "`n2. MATO PostgREST a traicion (como si se cayera un martes a las 15:00)" -ForegroundColor Cyan
Get-Process postgrest -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "   MUERTO. Los TPV ya no pueden cobrar." -ForegroundColor Red

Write-Host "`n3. Esperando al vigilante (ronda cada 30 s + arranque de PostgREST)" -ForegroundColor Cyan
$vuelto = $false
foreach ($i in 1..24) {
  Start-Sleep -Seconds 5
  try {
    Invoke-WebRequest "http://127.0.0.1:55433/" -TimeoutSec 3 -UseBasicParsing | Out-Null
    $vuelto = $true
    Write-Host "   vuelto y sirviendo datos a los $($i * 5) s" -ForegroundColor Green
    break
  } catch {
    Write-Host "   ...$($i * 5) s" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host ("=" * 62)
if ($vuelto) {
  Write-Host "OK: PostgREST VOLVIO SOLO. El bar no se entera de nada." -ForegroundColor Green
} else {
  Write-Host "MAL: sigue muerto. El vigilante no cumple." -ForegroundColor Red
  Write-Host "`n-- errores del vigilante --" -ForegroundColor DarkGray
  Get-Content "$raiz\.nodo\tmp\vig-err.txt" -Tail 10 -ErrorAction SilentlyContinue
}
Write-Host ("=" * 62)

Write-Host "`n-- diario del vigilante --" -ForegroundColor DarkGray
Get-Content "$raiz\.nodo\tmp\vigilante.log" -Tail 6 -ErrorAction SilentlyContinue

exit $(if ($vuelto) { 0 } else { 1 })
