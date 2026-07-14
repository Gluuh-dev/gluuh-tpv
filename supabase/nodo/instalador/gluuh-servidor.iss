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

; ESTO NO SE COMPILA A MANO. Lo monta `Montar-Paquete.ps1`, que prepara la carga (Postgres
; podado, PostgREST, Node portable, la interfaz, las dependencias) y llama aqui con todo
; puesto:
;
;     .\supabase\nodo\instalador\Montar-Paquete.ps1
;
; Un paquete al que le falta una pieza NO DA ERROR: se entrega, se instala, y el bar no
; arranca. Por eso el montaje es un script y no una lista de pasos en un documento.

; La clave PUBLICA de Gluuh (publishable). Va AL COMPILAR, no en el repositorio.
#ifndef AnonKey
  #define AnonKey ""
#endif

; La carga y la salida, FUERA DEL REPOSITORIO (C:\gluuh-paquete por defecto). Dos motivos:
;
;   1. Si la carga vive dentro de `supabase\`, la seccion [Files] de abajo —que empaqueta
;      `supabase\*` entero y recursivo— **mete el instalador dentro de si mismo**.
;
;   2. Windows no pasa de 260 caracteres de ruta, y pnpm crea carpetas como
;      `.pnpm\next@16.2.9_babel-plugin-react-compiler@1.0.0_react-dom@...\node_modules\@swc\helpers\cjs\`.
;      Desde dentro del repositorio eso se pasa del limite y la compilacion revienta a media
;      faena, con un error que no dice ni que fichero.
#ifndef Carga
  #error Falta /DCarga. Ejecuta Montar-Paquete.ps1 en vez de llamar a ISCC a mano.
#endif
#ifndef Dist
  #define Dist Carga + "\dist"
#endif

[Setup]
; El AppId identifica la aplicacion para actualizar y desinstalar. TIENE QUE SER ESTABLE:
; si cambia, Windows se cree que es otro programa distinto y una actualizacion instalaria una
; SEGUNDA copia al lado, con su segundo Postgres, sus segundos puertos, y el bar con dos
; servidores peleandose por el 55432.
;
; El que habia (`...-GLUUH0000001`) NI SIQUIERA ES UN GUID: la G, la L, la U y la H no son
; digitos hexadecimales. Este si.
AppId={{7B3F9C24-6A1E-4D58-9E7B-0C4A2F81D6E3}
AppName={#Nombre}
AppVersion={#Version}
AppPublisher={#Empresa}
AppPublisherURL={#Web}
; C:\Gluuh, y CORTO A PROPOSITO. Dentro va un `node_modules` de pnpm, con carpetas como
; `.pnpm\next@16.2.9_babel-plugin-react-compiler@1.0.0_react-dom@...\`. Instalado en
; `C:\Program Files\Gluuh TPV\` se pasaria de los 260 caracteres de Windows y habria
; ficheros que no se copian — sin error, y con la web sirviendo paginas en blanco.
DefaultDirName=C:\Gluuh
DefaultGroupName=Gluuh
DisableProgramGroupPage=yes
OutputDir={#Dist}
OutputBaseFilename=GluuhServidor-{#Version}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Hace falta administrador: se registra el arranque automatico como SYSTEM.
PrivilegesRequired=admin
; Un servidor de bar no se instala en un portatil de 32 bits.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=gluuh.ico
UninstallDisplayName={#Nombre}

; SIN PAGINA DE LICENCIA, y a proposito: no hay texto legal que ensenar todavia.
;
; Es preferible no ensenar ninguna que ensenar una inventada: una licencia de mentira que
; el cliente ACEPTA es peor que no tener licencia. Cuando exista el texto de verdad
; (revisado por quien sepa), se anade aqui:
;
;     LicenseFile=condiciones.txt
;
; TODO: condiciones de uso antes del primer cliente de pago.

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Los binarios (Postgres, PostgREST, Node). Postgres y PostgREST van JUNTOS a proposito:
; libpq.dll viene con Postgres y no en el zip de PostgREST. Separados, PostgREST muere en
; silencio nada mas arrancar.
Source: "{#Carga}\pgsql\*";   DestDir: "{app}\.nodo\pgsql"; Flags: ignoreversion recursesubdirs
Source: "{#Carga}\bin\*";     DestDir: "{app}\.nodo\bin";   Flags: ignoreversion

; NODE. En el ordenador de un bar NO HAY NODE INSTALADO, y el gateway, el auth, el realtime,
; las imagenes y la web son TODOS Node: sin esto no arranca ni un servicio. Los .ps1 meten
; {app}\node al principio del PATH.
Source: "{#Carga}\node\*";    DestDir: "{app}\node";        Flags: ignoreversion recursesubdirs

; LA INTERFAZ, ya compilada. El nodo la sirve por su mismo puerto: por eso en las terminales
; no hay NADA que configurar.
;
; `build:nodo` copia `.next\static` y `public` DENTRO del standalone, y `Montar-Paquete.ps1`
; comprueba que esten. Sin ellos la web ARRANCA IGUAL y sirve el HTML sin CSS ni JavaScript:
; pagina en blanco en el TPV de un bar, y ni un error en los logs.
Source: "{#Carga}\web\*";     DestDir: "{app}\apps\web\.next\standalone"; Flags: ignoreversion recursesubdirs

; El codigo del servidor.
;
; OJO con `supabase\*`: la carga NO puede vivir ahi dentro. Vivia en
; `supabase\nodo\instalador\carga\`, y esta linea —recursiva— se metia los 510 MB del
; paquete DENTRO DEL PAQUETE. Por eso la carga se monta fuera del repositorio.
Source: "..\..\..\apps\nodo\*";   DestDir: "{app}\apps\nodo"; Flags: ignoreversion recursesubdirs
Source: "..\..\..\supabase\*";    DestDir: "{app}\supabase";  Flags: ignoreversion recursesubdirs

; Las dependencias de Node: `pg` Y LAS SUYAS, en un arbol PLANO montado con npm.
;
; NO se copia `node_modules\pg` del repositorio: con pnpm eso es un ENLACE SIMBOLICO, y sus
; dependencias (pg-pool, pg-protocol, pg-types, pgpass...) viven fuera del enlace. Copiarlo
; se lleva `pg` sin sus tripas, y en el bar `import pg` revienta con "Cannot find module
; 'pg-pool'": el nodo no podria ni conectar a su propia base de datos.
Source: "{#Carga}\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs

; La configuracion de los servicios (plantilla: el instalador la reescribe con las claves
; aleatorias de ESE bar).
Source: "{#Carga}\postgrest.conf"; DestDir: "{app}\.nodo"; Flags: ignoreversion

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
;
;    OJO: -ExecutionPolicy Bypass es obligatorio. Un Windows de fabrica trae la politica en
;    Restricted y NO EJECUTA ningun .ps1: el instalador se quedaria mudo.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\Instalar-Gluuh.ps1"" -Raiz ""{app}"" -AnonKey ""{#AnonKey}"""; \
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
