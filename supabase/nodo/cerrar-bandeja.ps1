# cerrar-bandeja.ps1 — cierra el icono de la bandeja. Lo llama el DESINSTALADOR.
#
# El arranque automatico se quita solo (es un acceso directo en el startup, y el
# desinstalador borra los accesos), asi que la bandeja no vuelve tras cerrar sesion. Esto
# ademas cierra la que este corriendo AHORA, para que no quede un icono muerto en la esquina
# ni un powershell abierto sujetando el gluuh.ico (que impediria borrarlo).
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*bandeja.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
