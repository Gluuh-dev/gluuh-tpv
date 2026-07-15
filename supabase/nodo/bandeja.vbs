' bandeja.vbs — arranca el icono de la bandeja SIN ventana negra.
'
' `powershell -WindowStyle Hidden` todavia asoma una consola una decima de segundo. Con
' este .vbs (Run ..., 0) no asoma NADA: el icono aparece en la esquina y ya. Lo usa el
' arranque automatico del usuario y el instalador nada mas terminar.
Dim fso, dir, sh
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\bandeja.ps1""", 0, False
