' abrir-panel.vbs — abre el panel del servidor en una VENTANA DE APP (sin barras de
' navegador). Lo usa el acceso directo del escritorio.
'
' Edge en modo `--app` da una ventana limpia, como un programa, y pinta el panel de Next
' perfectamente. Esta en cualquier Windows 10/11. Si no estuviera, cae al navegador por
' defecto: peor aspecto, pero funciona. Y sin ventana negra por medio.
Dim fso, sh, edge, url
url = "http://localhost:54321/servidor"
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then
  edge = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
End If

If fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=" & url & " --window-size=1040,780", 1, False
Else
  sh.Run url, 1, False
End If
