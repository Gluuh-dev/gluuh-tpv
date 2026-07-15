; gluuh-servidor.iss — el instalador: un .exe que el tecnico ejecuta en el bar y ya.
;
; NO SE COMPILA A MANO:
;
;     .\supabase\nodo\instalador\Montar-Paquete.ps1
;
; Ese script prepara la carga (Postgres podado, PostgREST, Node portable, la interfaz, las
; dependencias), llama aqui, y deja  C:\gluuh-paquete\dist\GluuhServidor-1.0.0.exe  — un
; solo fichero de 86 MB que cabe en cualquier pendrive.
;
; Es un script y no una lista de pasos en un documento a proposito: un paquete al que le
; falta una pieza NO DA ERROR. Se entrega, se instala, y el bar no arranca.
;
; ── LO QUE VE EL TECNICO ─────────────────────────────────────────────────────
;
; Cuatro paginas de asistente (ver [Code]): que bar es, la cuenta del titular, los datos
; fiscales (solo si faltan) y si arranca solo. Cada una SE VALIDA CONTRA LA NUBE antes de
; dejar pasar, asi que los errores salen ANTES de tocar el ordenador — nada de instalar
; Postgres, crear la base de datos, y reventar al final porque la contraseña estaba mal.
;
; Antes esas preguntas se hacian en una consola negra de PowerShell. Aparte de dar mala
; impresion, una consola no sabe volver atras: un digito mal tecleado y a empezar de cero.

#define Nombre     "Gluuh TPV - Servidor del local"
#define Version    "1.0.0"
#define Empresa    "Gluuh"
#define Web        "https://gluuh.com"

; La nube. El asistente habla con ella para comprobar el codigo y la cuenta ANTES de tocar
; el ordenador: asi los errores salen en la ventana, no despues de haber instalado Postgres.
#define Nube       "https://gxcqihslbicrszgzudjs.supabase.co"

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
; El logo de Gluuh en el asistente: el banner de las pantallas de Bienvenida y Fin, y el
; iconito de la esquina en las paginas de en medio. Sin esto salen las imagenes por defecto
; de Inno y el instalador parece de cualquiera. Son BMP (lo que pide Inno), derivados de
; apps/web/public/logo.png. Van commiteados como asset, igual que gluuh.ico; si cambia el
; logo, se regeneran.
WizardImageFile=wizard-grande.bmp
WizardSmallImageFile=wizard-peque.bmp
; El logo va sobre fondo blanco: que el banner no se corte con un color raro.
WizardImageStretch=no
WizardImageBackColor=clWhite
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

[Icons]
; ── EL ICONO EN LA BANDEJA (y en el escritorio) ──────────────────────────────
;
; `bandeja.vbs` pone el icono del servidor en la BANDEJA del sistema (la esquina, junto al
; reloj). Va en el ARRANQUE del usuario: al encender el ordenador aparece solo. Los .vbs
; y .ps1 ya se copian con `supabase\*`, asi que aqui solo hay que crear los accesos.
Name: "{commonstartup}\Servidor Gluuh"; Filename: "{app}\supabase\nodo\bandeja.vbs"; \
  IconFilename: "{app}\supabase\nodo\instalador\gluuh.ico"; \
  Comment: "Pone el servidor del bar en la bandeja del sistema"

; Y en el escritorio y el menu inicio: al pulsar, abre el PANEL en una ventana de app (sin
; barras de navegador). Ahi se ve si esta activo, la version, y estan Reiniciar y Actualizar.
Name: "{autodesktop}\Servidor Gluuh"; Filename: "{app}\supabase\nodo\abrir-panel.vbs"; \
  IconFilename: "{app}\supabase\nodo\instalador\gluuh.ico"
Name: "{autoprograms}\Gluuh\Panel del servidor"; Filename: "{app}\supabase\nodo\abrir-panel.vbs"; \
  IconFilename: "{app}\supabase\nodo\instalador\gluuh.ico"

[Run]
; 1. Crear el cluster de Postgres (initdb). Es lo unico que no se puede traer hecho:
;    el directorio de datos lleva dentro rutas absolutas de la maquina donde se creo.
;
;    `Check: not YaHayBase` — SOLO SI NO EXISTE YA. `initdb` sobre un directorio con datos
;    falla ("directory not empty") y aborta la instalacion. Y peor: en un bar que YA ESTA
;    FUNCIONANDO, ese directorio son sus ventas.
Filename: "{app}\.nodo\pgsql\bin\initdb.exe"; \
  Parameters: "-D ""{app}\.nodo\pgdata"" -U postgres --pwfile=""{tmp}\pw.txt"" -E UTF8 --locale=Spanish_Spain.1252"; \
  StatusMsg: "Preparando la base de datos..."; Flags: runhidden; Check: not YaHayBase

; 2. Y el trabajo: base de datos, bajarse el bar, las fotos, arrancar los servicios.
;
;    YA NO PREGUNTA NADA. Las cuatro preguntas se hacen en las paginas del asistente (ver
;    [Code], mas abajo) y llegan aqui en un fichero. Una consola negra pidiendole datos
;    fiscales al dueño de un bar no inspira ninguna confianza — y ademas no sabe volver
;    atras: un digito mal tecleado y a empezar de cero.
;
;    LA CONSOLA YA NO SE VE. Antes se lanzaba aqui, en [Run], VISIBLE — una ventana negra
;    llena de texto tecnico ([0] Arrancando Postgres, 104 migraciones...) mientras el
;    asistente decia solo "Instalando... (unos minutos)". Al dueno de un bar eso le parece
;    que algo va mal. Ahora se lanza OCULTO desde [Code] (ver `EjecutarNodoConProgreso`,
;    abajo), y cada fase del script se ensena como texto DENTRO del asistente. El progreso
;    de verdad, sin la consola.
;
;    OJO: -ExecutionPolicy Bypass es obligatorio. Un Windows de fabrica trae la politica en
;    Restricted y NO EJECUTA ningun .ps1: el instalador se quedaria mudo.  (Va en el codigo.)

; 3. El icono en la bandeja, YA — sin esperar a reiniciar. `wscript` lanza el .vbs, que a su
;    vez arranca la bandeja sin ninguna ventana negra. A partir de aqui esta en la esquina.
Filename: "wscript.exe"; Parameters: """{app}\supabase\nodo\bandeja.vbs"""; \
  Flags: nowait runhidden skipifsilent

; 4. Y se le ensena la hoja de entrega al tecnico.
Filename: "notepad.exe"; Parameters: """{app}\INSTALACION.txt"""; \
  Description: "Ver la direccion que hay que poner en los TPV"; \
  Flags: postinstall nowait skipifsilent

[UninstallRun]
; Cerrar la bandeja (el arranque automatico se quita solo con los [Icons]). En su propio
; .ps1, no inline: Inno lee cualquier { } como una constante suya y peta.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\cerrar-bandeja.ps1"""; \
  Flags: runhidden; RunOnceId: "CerrarBandeja"
; Al desinstalar: parar los servicios y quitar el arranque automatico. Si no, quedan
; procesos huerfanos comiendo memoria y una tarea programada que apunta a la nada.
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\servicio-windows.ps1"" -Quitar"; \
  Flags: runhidden; RunOnceId: "QuitarTarea"
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\supabase\nodo\arrancar-nodo.ps1"" -Parar"; \
  Flags: runhidden; RunOnceId: "PararNodo"

[Code]
// ═════════════════════════════════════════════════════════════════════════════
//  LAS CUATRO PREGUNTAS, EN VENTANAS DE VERDAD
//
//  Antes se hacian en una consola negra de PowerShell. Y no es solo feo:
//
//    · Un tecnico enseñandole una consola negra al dueño de un bar y pidiendole su
//      contraseña y su CIF no inspira ninguna confianza. Parece que le esta hackeando.
//
//    · Y una consola NO SABE VOLVER ATRAS. Un digito mal tecleado en el codigo de
//      instalacion y el unico camino es empezar de cero.
//
//  Ahora son paginas del asistente, con "Atras" y "Siguiente", y CADA UNA SE VALIDA CONTRA
//  LA NUBE ANTES DE DEJAR PASAR. Asi los errores salen ANTES de tocar el ordenador: nada de
//  instalar Postgres, crear la base, y reventar en la ultima pantalla porque la contraseña
//  estaba mal.
//
//  Las respuestas se pasan al script en un fichero de `{tmp}` (que Inno borra al terminar, y
//  que el propio script borra en cuanto lo lee: lleva dentro la contraseña del titular). Por
//  linea de comandos NO: quedaria a la vista en la lista de procesos de Windows.
// ═════════════════════════════════════════════════════════════════════════════

var
  PagCodigo:  TInputQueryWizardPage;
  PagCuenta:  TInputQueryWizardPage;
  PagFiscal:  TInputQueryWizardPage;
  PagArranque: TInputOptionWizardPage;

  // El territorio fiscal, en un DESPLEGABLE y no tecleando 1/2/3. Un numero a mano se
  // equivoca: un tecnico le mete IVA a un bar canario y las facturas salen mal desde el
  // primer dia. Con una lista de tres opciones, no hay forma de equivocarse.
  ComboTerritorio: TNewComboBox;

  TenantId:   string;   // se rellena al validar el codigo
  Empresa:    string;
  FaltanDatosFiscales: Boolean;

// ── Hablar con la nube desde el instalador ───────────────────────────────────
//
// Inno no trae cliente HTTP, asi que se usa el de Windows (WinHttp, que esta en cualquier
// Windows desde hace 20 años). Devuelve el cuerpo de la respuesta; si algo falla, ''.
function Pedir(Metodo, Url, Cabeceras, Cuerpo: string; var Estado: Integer): string;
var
  Http: Variant;
begin
  Result := '';
  Estado := 0;
  // La llamada es SINCRONA: la ventana se queda quieta mientras Gluuh contesta. Un reloj de
  // arena para que el tecnico no crea que se ha colgado y le de a la X.
  WizardForm.Cursor := crHourGlass;
  try
    Http := CreateOleObject('WinHttp.WinHttpRequest.5.1');
    Http.SetTimeouts(10000, 10000, 15000, 20000);
    Http.Open(Metodo, Url, False);
    Http.SetRequestHeader('apikey', '{#AnonKey}');
    Http.SetRequestHeader('Content-Type', 'application/json');
    if Cabeceras <> '' then
      Http.SetRequestHeader('Authorization', Cabeceras);
    if Cuerpo = '' then
      Http.Send()
    else
      Http.Send(Cuerpo);
    Estado := Http.Status;
    Result := Http.ResponseText;
  except
    // Sin internet, DNS caido, proxy raro... El mensaje lo da quien llama.
  end;
  WizardForm.Cursor := crDefault;
end;

// Saca el valor de una clave de un JSON, a lo bruto. No hace falta un parser: las respuestas
// que se miran aqui son planas y las claves no se repiten.
function DelJson(Json, Clave: string): string;
var
  P, F: Integer;
  Aguja: string;
begin
  Result := '';
  Aguja := '"' + Clave + '":';
  P := Pos(Aguja, Json);
  if P = 0 then Exit;
  P := P + Length(Aguja);
  // Se salta espacios y la comilla de apertura, si la hay.
  while (P <= Length(Json)) and ((Json[P] = ' ') or (Json[P] = '"')) do P := P + 1;
  F := P;
  while (F <= Length(Json)) and (Json[F] <> '"') and (Json[F] <> ',') and (Json[F] <> '}') do
    F := F + 1;
  Result := Copy(Json, P, F - P);
end;

// Deja el codigo en 21 digitos, sin guiones ni espacios: el tecnico lo copia de un correo y
// puede venir con cualquier cosa.
function SoloDigitos(S: string): string;
var i: Integer;
begin
  Result := '';
  for i := 1 to Length(S) do
    if (S[i] >= '0') and (S[i] <= '9') then
      Result := Result + S[i];
end;

procedure InitializeWizard();
begin
  // ── 1 · El codigo de instalacion ───────────────────────────────────────────
  PagCodigo := CreateInputQueryPage(wpSelectDir,
    'Que bar es',
    'El codigo de instalacion que Gluuh le dio al cliente.',
    'Son 21 digitos, con este formato:' + #13#10 +
    '     0000-0000-00000-0000-0000' + #13#10#13#10 +
    'Al pulsar Siguiente se comprueba contra Gluuh y se enseña el nombre de la empresa: ' +
    'asi sabras seguro que no te has equivocado de bar.');
  PagCodigo.Add('Codigo de instalacion:', False);

  // ── 2 · La cuenta del titular ──────────────────────────────────────────────
  PagCuenta := CreateInputQueryPage(PagCodigo.ID,
    'Cuenta del titular',
    'Para que el servidor pueda bajarse la carta y subir las ventas.',
    'Usa la cuenta con la que el cliente entra en su panel de Gluuh.' + #13#10#13#10 +
    'La contraseña NO se guarda en este ordenador: se usa una sola vez, para pedir un ' +
    'permiso que queda atado a esta empresa y a esta maquina.');
  PagCuenta.Add('Email:', False);
  PagCuenta.Add('Contraseña:', True);   // True = enmascarada

  // ── 3 · Datos fiscales (solo si faltan; se decide al validar la cuenta) ────
  PagFiscal := CreateInputQueryPage(PagCuenta.ID,
    'Datos fiscales',
    'Sin esto NO se pueden emitir facturas. Los exige la AEAT.',
    'Esta empresa todavia no los tiene puestos.');
  PagFiscal.Add('CIF / NIF:', False);
  PagFiscal.Add('Razon social:', False);

  // El territorio, en un DESPLEGABLE. Se coloca a mano sobre la superficie de la pagina,
  // debajo de los dos campos de texto. El `TInputQueryPage` no trae combos, asi que se
  // añade el control encima. Las tres opciones y ninguna mas: no se puede escribir otra.
  ComboTerritorio := TNewComboBox.Create(WizardForm);
  ComboTerritorio.Parent := PagFiscal.Surface;
  ComboTerritorio.Style := csDropDownList;   // solo elegir, no teclear
  ComboTerritorio.Top := PagFiscal.Edits[1].Top + PagFiscal.Edits[1].Height + ScaleY(24);
  ComboTerritorio.Left := PagFiscal.Edits[1].Left;
  ComboTerritorio.Width := PagFiscal.Edits[1].Width;
  ComboTerritorio.Items.Add('Peninsula y Baleares (IVA)');
  ComboTerritorio.Items.Add('Canarias (IGIC)');
  ComboTerritorio.Items.Add('Ceuta y Melilla (IPSI)');
  ComboTerritorio.ItemIndex := 0;

  with TNewStaticText.Create(WizardForm) do begin
    Parent := PagFiscal.Surface;
    Caption := 'Territorio fiscal:';
    Left := ComboTerritorio.Left;
    Top := ComboTerritorio.Top - ScaleY(16);
  end;

  // ── 4 · Arranque automatico ────────────────────────────────────────────────
  PagArranque := CreateInputOptionPage(PagFiscal.ID,
    'Arranque automatico',
    'Lo normal es que si.',
    'El bar enciende el ordenador por la mañana y todo funciona solo, sin que nadie ' +
    'tenga que abrir nada.',
    False, False);
  PagArranque.Add('Arrancar el servidor al encender el ordenador');
  PagArranque.Values[0] := True;
end;

// La pagina de datos fiscales solo se enseña SI FALTAN. Y eso no se sabe hasta haber
// entrado con la cuenta del titular: por eso se decide en la validacion de la pagina 2.
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if PageID = PagFiscal.ID then
    Result := not FaltanDatosFiscales;
end;

// ¿Hay ya un Postgres con datos en la carpeta elegida?
//
// En un bar que lleva meses funcionando, eso NO es "una instalacion anterior": son SUS
// VENTAS. Y `Instalar-Gluuh.ps1` recrea la base de datos desde cero. Reinstalar encima
// borraria la caja, las facturas y la cadena de VERIFACTU de ese bar.
function YaHayBase(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\.nodo\pgdata\PG_VERSION'));
end;

// ── La validacion: cada pagina se comprueba CONTRA LA NUBE antes de dejar pasar ──
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Codigo, Norm, Cuerpo, Rta, Cab, Token, Sub, Cif: string;
  Estado: Integer;
begin
  Result := True;

  // ── 0 · ¿Estamos instalando ENCIMA de un bar que ya funciona? ──────────────
  //
  // Se avisa AQUI, en cuanto se elige la carpeta, y no al final: el tecnico tiene que poder
  // parar antes de tocar nada.
  //
  // Para ACTUALIZAR un bar NO se usa este instalador: se publica una version y el propio
  // nodo se actualiza solo (apps/nodo/actualizar.mjs), sin tocar los datos.
  if CurPageID = wpSelectDir then
  begin
    if FileExists(AddBackslash(WizardDirValue) + '.nodo\pgdata\PG_VERSION') then
    begin
      // OJO: ninguna linea de este fichero puede EMPEZAR por `#`. El preprocesador de Inno
      // se cree que es una directiva suya («Unknown preprocessor directive») aunque este
      // dentro de una cadena de Pascal. Los #13#10 van siempre pegados a la linea anterior.
      Result := MsgBox(
        'YA HAY UN SERVIDOR DE GLUUH INSTALADO EN ESTA CARPETA.' + #13#10#13#10 +
        'Si sigues, SE BORRARA SU BASE DE DATOS: las ventas, la caja, las facturas y la ' +
        'cadena de VERIFACTU de este bar.' + #13#10#13#10 +
        'Para ACTUALIZAR un bar no hace falta reinstalar: el servidor se actualiza solo. ' +
        'Este instalador es para PONER UN BAR NUEVO.' + #13#10#13#10 +
        'Seguro que quieres continuar y EMPEZAR DE CERO?',
        mbCriticalError, MB_YESNO or MB_DEFBUTTON2) = IDYES;
      Exit;
    end;
  end;

  // ── 1 · Canjear el codigo ─────────────────────────────────────────────────
  if CurPageID = PagCodigo.ID then
  begin
    Codigo := SoloDigitos(PagCodigo.Values[0]);
    if Length(Codigo) <> 21 then
    begin
      MsgBox('El codigo tiene que tener 21 digitos.' + #13#10#13#10 +
             'Has escrito ' + IntToStr(Length(Codigo)) + '.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    Norm := Copy(Codigo,1,4) + '-' + Copy(Codigo,5,4) + '-' + Copy(Codigo,9,5) + '-' +
            Copy(Codigo,14,4) + '-' + Copy(Codigo,18,4);

    // El RPC `empresa_por_codigo` (migracion 0104). NO se consulta `tenant` a pelo: aqui no
    // hay sesion, y su RLS devolveria cero filas — que es lo que hacia que el instalador
    // dijera "codigo no valido" SIEMPRE.
    Cuerpo := '{"p_codigo":"' + Norm + '"}';
    Rta := Pedir('POST', '{#Nube}/rest/v1/rpc/empresa_por_codigo',
                 'Bearer {#AnonKey}', Cuerpo, Estado);

    if Estado = 0 then
    begin
      MsgBox('No hay conexion con Gluuh.' + #13#10#13#10 +
             'La instalacion necesita internet UNA vez, para bajarse la carta del bar. ' +
             'Despues el bar ya funciona sin conexion.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    TenantId := DelJson(Rta, 'id');
    Empresa  := DelJson(Rta, 'nombre');

    if TenantId = '' then
    begin
      MsgBox('Ese codigo no es valido.' + #13#10#13#10 +
             'Comprueba que lo has copiado bien, entero y sin cambiar ningun digito.',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if DelJson(Rta, 'activo') = 'false' then
    begin
      MsgBox('La empresa "' + Empresa + '" esta dada de baja.' + #13#10#13#10 +
             'Llama a Gluuh antes de seguir.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Que el tecnico CONFIRME que no se ha equivocado de bar. Instalar el servidor del bar
    // equivocado significa bajarle la carta de otro y subirle las ventas a otro.
    if MsgBox('Empresa: ' + Empresa + #13#10#13#10 + 'Es este el bar?',
              mbConfirmation, MB_YESNO) <> IDYES then
    begin
      Result := False;
      Exit;
    end;
    Exit;
  end;

  // ── 2 · La cuenta del titular ─────────────────────────────────────────────
  if CurPageID = PagCuenta.ID then
  begin
    if (Trim(PagCuenta.Values[0]) = '') or (PagCuenta.Values[1] = '') then
    begin
      MsgBox('Hace falta el email y la contraseña del titular.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    Cuerpo := '{"email":"' + Trim(PagCuenta.Values[0]) + '","password":"' + PagCuenta.Values[1] + '"}';
    Rta := Pedir('POST', '{#Nube}/auth/v1/token?grant_type=password', '', Cuerpo, Estado);

    if Estado = 0 then
    begin
      MsgBox('No hay conexion con Gluuh.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    Token := DelJson(Rta, 'access_token');
    if Token = '' then
    begin
      MsgBox('Email o contraseña incorrectos.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // ── LA CUENTA TIENE QUE SER DE ESTA EMPRESA ─────────────────────────────
    //
    // Si el titular lleva dos bares, el servidor de ESTE no puede quedarse con un permiso
    // que apunte al otro: se bajaria la carta equivocada y le subiria las ventas al bar de
    // al lado.
    //
    // Se pregunta A LA BASE, no al token: el token de Supabase NO trae `tenant_id` (el hook
    // que lo añade existe pero no esta activado). Leyendo el claim, esto rechazaba al propio
    // titular de la empresa.
    Sub := DelJson(Rta, 'id');   // el `id` del objeto `user`
    Cab := 'Bearer ' + Token;
    Rta := Pedir('GET', '{#Nube}/rest/v1/app_user?select=tenant_id&auth_user_id=eq.' + Sub,
                 Cab, '', Estado);

    if Pos(TenantId, Rta) = 0 then
    begin
      MsgBox('Esa cuenta no pertenece a "' + Empresa + '".' + #13#10#13#10 +
             'Usa la cuenta del titular de esta empresa.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // ── Y de paso: ¿tiene local, y tiene datos fiscales? ────────────────────
    Rta := Pedir('GET', '{#Nube}/rest/v1/location?select=id,cif&tenant_id=eq.' + TenantId,
                 Cab, '', Estado);

    if Pos('"id"', Rta) = 0 then
    begin
      MsgBox('Esta empresa no tiene ningun local dado de alta.' + #13#10#13#10 +
             'Hay que crearlo antes en el panel de Gluuh.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    Cif := DelJson(Rta, 'cif');
    FaltanDatosFiscales := (Cif = '') or (Cif = 'PENDIENTE') or (Cif = 'null');
    Exit;
  end;

  // ── 3 · Datos fiscales ────────────────────────────────────────────────────
  if CurPageID = PagFiscal.ID then
  begin
    if (Trim(PagFiscal.Values[0]) = '') or (Trim(PagFiscal.Values[1]) = '') then
    begin
      MsgBox('Sin CIF y razon social NO se pueden emitir facturas. Los exige la AEAT.',
             mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

// ── Las respuestas, al script ────────────────────────────────────────────────
//
// En un fichero de `{tmp}`, no por linea de comandos: la contraseña quedaria a la vista en
// la lista de procesos de Windows. El script lo lee y LO BORRA EN EL ACTO; Inno borra `{tmp}`
// entero al terminar.
// ── El instalador del nodo, OCULTO y con el progreso a la vista ──────────────
//
// El problema: la instalacion tarda varios minutos y hay que ir enseñando lo que hace, PERO
// un bucle con Sleep congela la ventana ("no responde") porque no repinta. La solucion de
// Inno es un TEMPORIZADOR de Windows: se arranca antes del Exec, y como Inno bombea mensajes
// mientras espera a que el proceso termine, el temporizador dispara solo y refresca el texto.
//
// PowerShell se lanza con la ventana escondida (SW_HIDE + -WindowStyle Hidden). El script
// escribe cada fase en un fichero (una linea, sobrescribiendo); el temporizador lo lee y lo
// pone como texto del asistente. Al final el fichero dice "@@FIN@@", o "@@ERROR@@ <motivo>".
function SetTimer(Wnd, IdEvent, Elapse, TimerFunc: LongWord): LongWord;
  external 'SetTimer@user32.dll stdcall';
function KillTimer(Wnd, IdEvent: LongWord): LongWord;
  external 'KillTimer@user32.dll stdcall';

var
  GFicheroProgreso: string;
  GUltimoTexto: string;

// Lee la ultima linea del fichero y la ensena. Devuelve el texto crudo (para mirar sentinelas).
function LeerProgreso(): string;
var
  Lineas: TArrayOfString;
  Texto: string;
begin
  Result := '';
  // Leer puede fallar si justo en ese instante el script esta reescribiendo el fichero: no
  // pasa nada, se reintenta a la siguiente y se conserva el ultimo texto que se vio.
  if LoadStringsFromFile(GFicheroProgreso, Lineas) and (GetArrayLength(Lineas) > 0) then
  begin
    Texto := Trim(Lineas[0]);
    Result := Texto;
    if (Texto <> '') and (Texto <> GUltimoTexto)
       and (Pos('@@FIN@@', Texto) <> 1) and (Pos('@@ERROR@@', Texto) <> 1) then
    begin
      WizardForm.StatusLabel.Caption := Texto;
      GUltimoTexto := Texto;
    end;
  end;
end;

// El temporizador. La firma es la de un TIMERPROC de Windows (4 argumentos), aunque no los use.
procedure AlDisparar(Wnd, Msg, IdEvent, Tiempo: LongWord);
begin
  LeerProgreso();
end;

procedure EjecutarNodoConProgreso();
var
  Params, Texto: string;
  RC: Integer;
  Timer: LongWord;
begin
  GFicheroProgreso := ExpandConstant('{tmp}\gluuh-progreso.txt');
  GUltimoTexto := '';
  SaveStringToFile(GFicheroProgreso, 'Preparando la instalacion...', False);
  WizardForm.StatusLabel.Caption := 'Preparando la instalacion...';

  // -NonInteractive: si el script intentara preguntar algo (no deberia, en modo asistente lo
  // lee todo del fichero), fallaria en el acto en vez de colgarse invisible.
  Params :=
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'
    + ExpandConstant('{app}\supabase\nodo\Instalar-Gluuh.ps1') + '"'
    + ' -Raiz "' + ExpandConstant('{app}') + '"'
    + ' -AnonKey "{#AnonKey}"'
    + ' -Respuestas "' + ExpandConstant('{tmp}\gluuh-respuestas.txt') + '"'
    + ' -Progreso "' + GFicheroProgreso + '"';

  // Refresca cada 400 ms mientras Inno espera al proceso.
  Timer := SetTimer(0, 0, 400, CreateCallback(@AlDisparar));

  // Oculto y BLOQUEANTE: Inno bombea mensajes durante la espera (por eso el temporizador
  // dispara), y al volver ya sabemos si fue bien por el codigo de salida.
  if not Exec('powershell.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, RC) then
    RC := -1;

  KillTimer(0, Timer);
  Texto := LeerProgreso();   // ultima lectura, por si el temporizador se perdio la del final

  if (Pos('@@ERROR@@', Texto) = 1) then
    MsgBox('La instalacion del servidor no se pudo completar:' + #13#10#13#10
      + Copy(Texto, 11, Length(Texto)) + #13#10#13#10
      + 'Puedes ver el detalle en la carpeta del programa, en .nodo\tmp.',
      mbCriticalError, MB_OK)
  else if (RC <> 0) or (Pos('@@FIN@@', Texto) <> 1) then
    MsgBox('La instalacion del servidor termino con un problema.' + #13#10
      + 'Revisa la carpeta .nodo\tmp del programa para ver que paso.',
      mbCriticalError, MB_OK)
  else
    WizardForm.StatusLabel.Caption := 'Servidor instalado y en marcha.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Lineas: TArrayOfString;
  Terr: string;
begin
  if CurStep = ssInstall then
  begin
    // La contrasena de Postgres, en un fichero temporal: initdb no la acepta por linea de
    // comandos (y menos mal).
    SaveStringToFile(ExpandConstant('{tmp}\pw.txt'), 'gluuh', False);

    // El territorio sale del desplegable (0/1/2), no de un texto tecleado.
    Terr := 'PENINSULA_BALEARES';
    if ComboTerritorio.ItemIndex = 1 then Terr := 'CANARIAS';
    if ComboTerritorio.ItemIndex = 2 then Terr := 'CEUTA_MELILLA';

    SetArrayLength(Lineas, 7);
    Lineas[0] := 'codigo=' + SoloDigitos(PagCodigo.Values[0]);
    Lineas[1] := 'email=' + Trim(PagCuenta.Values[0]);
    Lineas[2] := 'password=' + PagCuenta.Values[1];
    Lineas[3] := 'cif=' + Trim(PagFiscal.Values[0]);
    Lineas[4] := 'razon=' + Trim(PagFiscal.Values[1]);
    Lineas[5] := 'territorio=' + Terr;
    if PagArranque.Values[0] then
      Lineas[6] := 'auto=1'
    else
      Lineas[6] := 'auto=0';

    SaveStringsToUTF8File(ExpandConstant('{tmp}\gluuh-respuestas.txt'), Lineas, False);
  end;

  // Despues de que [Run] haya creado el cluster con initdb, se lanza el instalador del nodo
  // (base de datos, bar, fotos, servicios) OCULTO y con el progreso a la vista del asistente.
  if CurStep = ssPostInstall then
    EjecutarNodoConProgreso();
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

// ── AL DESINSTALAR: ¿Y LOS DATOS DEL BAR? ────────────────────────────────────
//
// `.nodo\pgdata` NO lo crea el instalador: lo crea `initdb` al vuelo. Asi que Inno no lo
// borra — y hace bien: ahi estan las ventas, la caja, las facturas y la cadena de VERIFACTU
// de ese bar. Borrarlas en silencio porque alguien le dio a "Desinstalar" seria imperdonable.
//
// Pero dejar 250 MB tirados sin decir nada tampoco vale, y —peor— la proxima instalacion se
// encontraria una base de datos vieja de la que nadie se acuerda.
//
// Asi que se PREGUNTA. Por defecto, NO.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Datos: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Datos := ExpandConstant('{app}\.nodo');
    if not DirExists(Datos) then Exit;

    if MsgBox(
      'BORRAR TAMBIEN LOS DATOS DEL BAR?' + #13#10#13#10 +
      'En este ordenador siguen las VENTAS, la CAJA, las FACTURAS y la cadena de ' +
      'VERIFACTU de este local.' + #13#10#13#10 +
      'Si dices que NO, se quedan aqui (y una instalacion nueva los encontraria).' + #13#10 +
      'Si dices que SI, SE PIERDEN. No hay vuelta atras.' + #13#10#13#10 +
      'Borrar los datos?',
      mbCriticalError, MB_YESNO or MB_DEFBUTTON2) = IDYES then
    begin
      DelTree(Datos, True, True, True);
      MsgBox('Datos borrados.', mbInformation, MB_OK);
    end
    else
      MsgBox('Los datos del bar se quedan en:' + #13#10#13#10 + Datos,
             mbInformation, MB_OK);
  end;
end;
