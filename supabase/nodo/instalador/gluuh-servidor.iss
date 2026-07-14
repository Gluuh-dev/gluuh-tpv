; gluuh-servidor.iss — el instalador de verdad: un .exe que el cliente ejecuta y ya.
;
; Se compila con Inno Setup (gratis, es el estandar en Windows desde hace 25 anos):
;
;     "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" gluuh-servidor.iss
;
; Y produce  dist\GluuhServidor-1.0.0.exe  — un solo fichero, firmado si tienes
; certificado, que el tecnico lleva en un pendrive.
;
; QUE METE DENTRO (todo, para que no dependa de nada que haya en el ordenador del bar):
;
;     pgsql\        Postgres portable        ~300 MB
;     bin\          postgrest.exe             ~66 MB   (ya NO va gotrue.exe: el nodo
;                                                       firma sus propios tokens)
;     node\         Node.js portable          ~50 MB
;     web\          .next\standalone          ~41 MB   (la INTERFAZ: la sirve el nodo)
;     apps\nodo\    el codigo del servidor
;     supabase\     migraciones y scripts
;
; Son ~460 MB. Parece mucho hasta que te acuerdas de que la alternativa es pedirle al
; cliente que instale Postgres y Node a mano por telefono.
;
; OJO: postgrest.exe NECESITA libpq.dll, que viene con Postgres y NO en su zip. Si
; empaquetas uno sin el otro, PostgREST muere en silencio nada mas arrancar. Por eso
; van juntos y por eso el .ps1 pone pgsql\bin en el PATH.

#define Nombre     "Gluuh TPV - Servidor del local"
#define Version    "1.0.0"
#define Empresa    "Gluuh"
#define Web        "https://gluuh.com"

[Setup]
AppId={{8F3A6C21-9B4E-4E7A-9C1D-GLUUH0000001}
AppName={#Nombre}
AppVersion={#Version}
AppPublisher={#Empresa}
AppPublisherURL={#Web}
DefaultDirName=C:\Gluuh
DefaultGroupName=Gluuh
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=GluuhServidor-{#Version}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Hace falta administrador: se registra el arranque automatico como SYSTEM.
PrivilegesRequired=admin
; Un servidor de bar no se instala en un portatil de 32 bits.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=..\..\..\LICENSE
SetupIconFile=gluuh.ico
UninstallDisplayName={#Nombre}

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Los binarios (Postgres, PostgREST, Node). Postgres y PostgREST van JUNTOS a proposito:
; libpq.dll viene con Postgres y no en el zip de PostgREST. Separados, PostgREST muere en
; silencio nada mas arrancar.
Source: "carga\pgsql\*";      DestDir: "{app}\.nodo\pgsql"; Flags: ignoreversion recursesubdirs
Source: "carga\bin\*";        DestDir: "{app}\.nodo\bin";   Flags: ignoreversion
Source: "carga\node\*";       DestDir: "{app}\node";        Flags: ignoreversion recursesubdirs

; LA INTERFAZ, ya compilada (`pnpm --filter @gluuh/web build:nodo`). El nodo la sirve por
; su mismo puerto: por eso en las terminales no hay NADA que configurar.
;
; OJO al preparar la carga: `build:nodo` copia `.next\static` y `public` DENTRO del
; standalone. Si se empaqueta el standalone sin ellos, la web ARRANCA IGUAL y sirve el
; HTML sin CSS ni JavaScript: pagina en blanco en el TPV, y ni un error en los logs.
Source: "carga\web\*";        DestDir: "{app}\apps\web\.next\standalone"; Flags: ignoreversion recursesubdirs

; El codigo del servidor.
Source: "..\..\..\apps\nodo\*";   DestDir: "{app}\apps\nodo"; Flags: ignoreversion recursesubdirs
Source: "..\..\..\supabase\*";    DestDir: "{app}\supabase";  Flags: ignoreversion recursesubdirs
Source: "..\..\..\node_modules\pg\*"; DestDir: "{app}\node_modules\pg"; Flags: ignoreversion recursesubdirs

; La configuracion de los servicios.
Source: "carga\postgrest.conf"; DestDir: "{app}\.nodo"; Flags: ignoreversion

[Dirs]
Name: "{app}\.nodo\tmp"
Name: "{app}\.nodo\media"
Name: "{app}\.nodo\pgdata"

[Run]
; 1. Crear el cluster de Postgres (initdb). Es lo unico que no se puede traer hecho:
;    el directorio de datos lleva dentro rutas absolutas de la maquina donde se creo.
Filename: "{app}\.nodo\pgsql\bin\initdb.exe"; \
  Parameters: "-D ""{app}\.nodo\pgdata"" -U postgres --pwfile=""{tmp}\pw.txt"" -E UTF8 --locale=Spanish_Spain.1252"; \
  StatusMsg: "Preparando la base de datos..."; Flags: runhidden

; 2. Y el instalador de verdad: el que PREGUNTA (empresa, titular, datos fiscales).
;    Ventana visible a proposito: aqui el tecnico tiene que ver lo que teclea.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\Instalar-Gluuh.ps1"" -Raiz ""{app}"""; \
  StatusMsg: "Configurando el local..."; Flags: waituntilterminated

; 3. Y se le ensena la hoja de entrega al tecnico.
Filename: "notepad.exe"; Parameters: """{app}\INSTALACION.txt"""; \
  Description: "Ver la direccion que hay que poner en los TPV"; \
  Flags: postinstall nowait skipifsilent

[UninstallRun]
; Al desinstalar: parar los servicios y quitar el arranque automatico. Si no, quedan
; procesos huerfanos comiendo memoria y una tarea programada que apunta a la nada.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\servicio-windows.ps1"" -Quitar"; \
  Flags: runhidden; RunOnceId: "QuitarTarea"
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\arrancar-nodo.ps1"" -Parar"; \
  Flags: runhidden; RunOnceId: "PararNodo"

[Code]
// La contrasena de Postgres, en un fichero temporal: initdb no la acepta por linea de
// comandos (y menos mal — quedaria en el historial de procesos de Windows).
procedure CurStepChanged(CurStep: TSetupStep);
var Pw: string;
begin
  if CurStep = ssInstall then
  begin
    Pw := 'gluuh';
    SaveStringToFile(ExpandConstant('{tmp}\pw.txt'), Pw, False);
  end;
end;

// Aviso ANTES de instalar. Un servidor que alguien apaga por la noche "para ahorrar"
// es un bar que por la manana no puede cobrar.
function InitializeSetup(): Boolean;
begin
  Result := MsgBox(
    'Este ordenador va a ser el SERVIDOR del bar.' + #13#10#13#10 +
    'Tiene que quedarse ENCENDIDO siempre: aqui viven los datos y desde aqui' + #13#10 +
    'trabajan todos los TPV. Si se apaga, el bar no puede cobrar.' + #13#10#13#10 +
    'La instalacion necesita internet UNA vez (para bajarse la carta).' + #13#10 +
    'Despues el bar funciona sin conexion.' + #13#10#13#10 +
    'Continuar?',
    mbConfirmation, MB_YESNO) = IDYES;
end;
