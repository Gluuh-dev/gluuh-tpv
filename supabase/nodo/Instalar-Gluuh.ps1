# Instalar-Gluuh.ps1 — INSTALADOR DEL NODO. Lo ejecuta el técnico en el bar.
#
# Pregunta lo justo, comprueba lo que puede, y deja el bar funcionando.
#
#   1. Código de instalación   -> identifica la empresa (ya existe: 21 dígitos)
#   2. Cuenta del dueño        -> para que el NODO se identifique como ESE bar
#   3. Datos fiscales          -> sólo si faltan; sin CIF no se puede facturar
#   4. ¿Arrancar solo?         -> sí, salvo que digan que no
#
# Y luego, sin preguntar más: base de datos, se baja el bar de la nube, las fotos,
# arranca los servicios, registra el arranque automático y escribe una hoja de entrega
# con la dirección que hay que poner en cada TPV.
#
# ─────────────────────────────────────────────────────────────────────────────
#  LO QUE **NO** HACE, Y ES DELIBERADO
#
#  NO instala la clave secreta de Supabase en el ordenador del cliente.
#
#  Esa clave salta toda la RLS: con ella se leen y escriben los datos de CUALQUIER bar.
#  Repartirla sería dejar en cada mini-PC —debajo de una barra, con la wifi del local y
#  la puerta abierta— la llave maestra de todos los demás clientes.
#
#  En su lugar, el nodo inicia sesión como el bar (cuenta del dueño), guarda sólo el
#  `refresh_token` (que además rota en cada uso) y la RLS lo acota a su empresa. Si le
#  roban el ordenador a un bar, se llevan los datos de ese bar. De ninguno más.
# ─────────────────────────────────────────────────────────────────────────────

param(
  [string]$Raiz = (Resolve-Path "$PSScriptRoot\..\.."),
  [string]$Nube = "https://gxcqihslbicrszgzudjs.supabase.co",
  [string]$AnonKey,                      # la publishable de la nube (sb_publishable_...)
  # La web de la plataforma: por aqui se canjea la ORDEN DE INSTALACION (F3,
  # migracion 0116) — un solo uso, ligada a un LOCAL, con reserva de 24 h que
  # permite reanudar si la instalacion se corta. Si no responde, se cae al
  # canje legacy (codigo eterno de la empresa) contra Supabase directamente.
  [string]$AppUrl = "https://app.gluuh.com",

  # ── LAS RESPUESTAS, YA RECOGIDAS ───────────────────────────────────────────
  #
  # Cuando esto lo lanza el `.exe`, las cuatro preguntas se hacen en una VENTANA de verdad
  # (las paginas del asistente de Inno Setup), no en una consola negra. El asistente escribe
  # las respuestas en un fichero y este script las lee de ahi.
  #
  # Un tecnico enseñandole una consola negra al dueño de un bar no inspira ninguna confianza,
  # y la consola no sabe volver atras ni corregir un dato: en cuanto el codigo esta mal
  # tecleado, el unico camino es empezar otra vez.
  #
  # Sin este parametro, pregunta por consola. Ese es NUESTRO camino de desarrollo... y es
  # exactamente el mismo script. Lo que probamos es lo que se ejecuta en el bar.
  [string]$Respuestas,

  # ── EL PROGRESO, PARA QUE SE VEA DENTRO DEL ASISTENTE ──────────────────────
  #
  # Cuando esto lo lanza el `.exe`, la consola va OCULTA: una ventana negra llena de texto
  # tecnico asusta al dueno de un bar y parece que algo va mal. Pero una barra parada sin
  # decir nada durante cinco minutos parece un programa colgado. Solucion: cada fase se
  # escribe (una linea, sobrescribiendo) en este fichero, y el asistente lo lee y lo ensena
  # como texto suyo. Al terminar escribe "@@FIN@@"; si algo falla, "@@ERROR@@ <motivo>".
  [string]$Progreso
)

$ErrorActionPreference = "Stop"
$nodo = Join-Path $Raiz ".nodo"
New-Item -ItemType Directory -Force -Path "$nodo\tmp" | Out-Null

# Las respuestas del asistente. Se leen y EL FICHERO SE BORRA EN EL ACTO: lleva dentro la
# contraseña del titular.
$R = @{}
if ($Respuestas -and (Test-Path $Respuestas)) {
  foreach ($linea in (Get-Content $Respuestas -Encoding UTF8)) {
    if ($linea -match '^([a-zA-Z]+)=(.*)$') { $R[$Matches[1]] = $Matches[2] }
  }
  Remove-Item $Respuestas -Force -ErrorAction SilentlyContinue
}
$conAsistente = $R.Count -gt 0

# ── NODE, EL DEL PAQUETE ─────────────────────────────────────────────────────
#
# En el ordenador de un bar NO HAY NODE INSTALADO. Va dentro del `.exe` (en `{app}\node`),
# pero si nadie lo mete en el PATH, `node` no existe: este instalador no podria ni bajarse
# la carta, ni las fotos, ni arrancar un solo servicio.
#
# En NUESTRA maquina Node esta instalado, asi que esto no se nota. Otra vez lo mismo: el
# camino del cliente no es el que probamos.
$nodePortable = Join-Path $Raiz "node"
if (Test-Path (Join-Path $nodePortable "node.exe")) {
  $env:PATH = "$nodePortable;$env:PATH"
}

function Titulo($t) {
  Write-Host ""
  Write-Host "  $t" -ForegroundColor Cyan
  Write-Host "  $('-' * $t.Length)" -ForegroundColor DarkGray
}
function Bien($t) { Write-Host "   $t" -ForegroundColor Green }
# Mal guarda el ultimo mensaje: asi `Fallo` sabe que motivo mandarle al asistente sin tener
# que repetirlo en cada sitio.
$script:ultimoMal = "La instalacion no se pudo completar."
function Mal($t)  { $script:ultimoMal = $t; Write-Host "   $t" -ForegroundColor Red }

# El progreso al asistente: una linea, sobrescribiendo, en UTF-8 SIN BOM (para que Inno la
# lea limpia). En modo consola ($Progreso vacio) no hace nada.
function Progreso($t) {
  if ($Progreso) {
    try { [IO.File]::WriteAllText($Progreso, $t, (New-Object Text.UTF8Encoding($false))) } catch {}
  }
}
# Todos los caminos de error del script pasan por aqui: avisan al asistente y salen. El
# mensaje es el ultimo que enseno `Mal`, justo antes.
function Fallo { Progreso "@@ERROR@@ $script:ultimoMal"; exit 1 }
# Y cualquier error inesperado (una excepcion que nadie atrapo) tambien avisa, no deja al
# asistente esperando un sentinela que no va a llegar.
trap { Progreso "@@ERROR@@ $($_.Exception.Message)"; exit 1 }

Clear-Host
Write-Host ""
Write-Host "   GLUUH TPV — Instalacion del servidor del local" -ForegroundColor White
Write-Host "   ============================================" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Este ordenador sera el SERVIDOR del bar: aqui viven los datos y desde"
Write-Host "   aqui trabajan todos los TPV, tambien cuando no haya internet."
Write-Host ""

# La clave PUBLICA de Gluuh (la publishable: la que lleva dentro cualquier navegador que
# abra app.gluuh.com — no es un secreto). El tecnico no tiene que teclear 60 caracteres:
#
#   · En el .exe la trae el propio paquete (se le pasa al compilar: ISCC /DAnonKey=...).
#   · Desde el codigo fuente se coge de apps/web/.env.local, que ya la tiene.
#
# Y no se guarda en el repositorio: ni siendo publica. La regla es la regla.
if (-not $AnonKey) {
  $envLocal = Join-Path $Raiz "apps\web\.env.local"
  if (Test-Path $envLocal) {
    $m = Select-String -Path $envLocal -Pattern '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)$'
    if ($m) { $AnonKey = $m.Matches[0].Groups[1].Value.Trim() }
  }
}
if (-not $AnonKey) {
  $AnonKey = Read-Host "   Clave publica de Gluuh (sb_publishable_...)"
}

Progreso "Comprobando la empresa y la cuenta del titular..."

# ── 1. ¿Qué empresa es? ──────────────────────────────────────────────────────
Titulo "1 de 4 - Que empresa es"
if (-not $conAsistente) {
  Write-Host "   Introduce el CODIGO DE INSTALACION que te dio Gluuh (21 digitos)."
  Write-Host "   Formato: 0000-0000-00000-0000-0000" -ForegroundColor DarkGray
  Write-Host ""
}

$empresa = $null
$tenantId = $null
while (-not $tenantId) {
  # Del asistente, o preguntando por consola. El resto del bloque es EL MISMO: se canjea el
  # codigo igual, se comprueba igual, y si el asistente hubiera dejado pasar algo malo, aqui
  # se cae con el mismo mensaje. El asistente valida para avisar PRONTO; la verdad es esta.
  $codigo = if ($conAsistente) { $R['codigo'] } else { Read-Host "   Codigo" }
  $codigo = $codigo -replace '\D', ''

  if ($codigo.Length -ne 21) {
    Mal "El codigo tiene que tener 21 digitos."
    if ($conAsistente) { Fallo }
    continue
  }
  $norm = "{0}-{1}-{2}-{3}-{4}" -f $codigo.Substring(0,4), $codigo.Substring(4,4), $codigo.Substring(8,5), $codigo.Substring(13,4), $codigo.Substring(17,4)

  # ── EL INTENTO (F3, 0116): la reserva de 24 h que permite REANUDAR ─────────
  #
  # Se persiste un identificador de ESTE intento de instalacion. Si el proceso
  # se corta a mitad (luz, red, tecnico), volver a ejecutar el instalador con el
  # MISMO codigo retoma la reserva en vez de encontrarsela "ocupada por otro".
  # Un equipo DISTINTO con el mismo codigo, en cambio, se lleva el 409.
  $intentoFichero = Join-Path $env:TEMP "gluuh-instalacion-intento.txt"
  if (Test-Path $intentoFichero) {
    $intento = (Get-Content $intentoFichero -Raw).Trim()
  } else {
    $intento = [guid]::NewGuid().ToString()
    $intento | Out-File $intentoFichero -Encoding ascii
  }
  # La identidad de ESTE nodo (F3 entrega 3.2): un fingerprint estable que la
  # nube registra en `nodo_instancia` al canjear. (El par de claves criptografico
  # completo llega con el canje v2 del nodo; este fingerprint ya permite
  # inventariar y REVOCAR esta instalacion sin tocar otros locales.)
  $fingerprint = [guid]::NewGuid().ToString()
  $versionNodo = "?"
  $versionJson = Join-Path $Raiz "apps\nodo\version.json"
  if (Test-Path $versionJson) {
    try { $versionNodo = (Get-Content $versionJson -Raw | ConvertFrom-Json).version } catch { }
  }

  # ── CANJE, en dos escalones ────────────────────────────────────────────────
  #
  #  1º  La ORDEN DE INSTALACION (0116), via app.gluuh.com: un solo uso real,
  #      ligada a un LOCAL, caduca a los 30 dias, y registra la instancia del
  #      nodo (revocable desde el panel). Es el camino de los codigos nuevos.
  #  2º  Si la web no responde (o el codigo es de la generacion anterior), la
  #      RPC `empresa_por_codigo` (0104) contra Supabase: el codigo eterno de
  #      la empresa. NO se consulta la tabla `tenant` a pelo: somos anonimos y
  #      la RLS devolveria cero filas con un 200 tan tranquila (ya paso; y
  #      abrirla al anonimo enseñaria la lista de clientes a cualquiera).
  $t = $null
  $nodoId = $null
  try {
    $cuerpoOrden = @{ codigo = $norm; intento = $intento; fingerprint = $fingerprint;
                      version = $versionNodo; plataforma = "windows" } | ConvertTo-Json
    $r = Invoke-RestMethod "$AppUrl/api/instalacion/activar" -Method Post `
         -ContentType "application/json" -Body $cuerpoOrden -TimeoutSec 20
    if ($r.ok) {
      $t = @(@{ id = $r.tenant_id; nombre = $r.empresa; activo = $true })
      if ($r.nodo_id) { $nodoId = $r.nodo_id }
    }
  } catch {
    # 410 = caducado, 409 = reservado por OTRO equipo: mensajes claros y parar.
    $st = 0
    if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode }
    if ($st -eq 410) { Mal "El codigo ha CADUCADO. Pide uno nuevo a Gluuh."; Fallo }
    if ($st -eq 409) { Mal "OTRO equipo esta instalando con este codigo. Si fue un intento tuyo fallido, espera unos minutos o pide un codigo nuevo."; Fallo }
    # Cualquier otra cosa (web caida, DNS): se prueba el canje legacy.
  }

  if (-not $t) {
    try {
      $cab = @{ apikey = $AnonKey; authorization = "Bearer $AnonKey" }
      $cuerpo = @{ p_codigo = $norm } | ConvertTo-Json
      $t = Invoke-RestMethod "$Nube/rest/v1/rpc/empresa_por_codigo" -Method Post `
           -Headers $cab -ContentType "application/json" -Body $cuerpo -TimeoutSec 15
    } catch {
      Mal "No hay conexion con Gluuh. La instalacion necesita internet UNA vez."
      Mal $_.Exception.Message
      Fallo
    }
  }

  if (-not $t -or $t.Count -eq 0) {
    Mal "Ese codigo no es valido. Comprueba que lo has copiado bien."
    if ($conAsistente) { Fallo }
    continue
  }
  if (-not $t[0].activo) {
    Mal "Esa empresa esta dada de baja. Llama a Gluuh."
    Fallo
  }

  $tenantId = $t[0].id
  $empresa  = $t[0].nombre
  Bien "Empresa: $empresa"
}

# ── 2. La cuenta con la que el nodo hablara con la nube ──────────────────────
Titulo "2 de 4 - Cuenta del titular"
if (-not $conAsistente) {
  Write-Host "   El servidor necesita identificarse ante Gluuh para bajarse la carta y"
  Write-Host "   subir las ventas. Usa la cuenta con la que el cliente entra en su panel."
  Write-Host ""
  Write-Host "   La contrasena NO se guarda: solo se usa ahora, para pedir un permiso" -ForegroundColor DarkGray
  Write-Host "   que queda atado a esta empresa y a este ordenador." -ForegroundColor DarkGray
  Write-Host ""
}

$refresco = $null
while (-not $refresco) {
  if ($conAsistente) {
    $email   = $R['email']
    $passTxt = $R['password']
  } else {
    $email = Read-Host "   Email del titular"
    $pass  = Read-Host "   Contrasena" -AsSecureString
    $passTxt = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
  }

  try {
    $cuerpo = @{ email = $email; password = $passTxt } | ConvertTo-Json
    $s = Invoke-RestMethod "$Nube/auth/v1/token?grant_type=password" -Method Post `
         -Headers @{ apikey = $AnonKey } -ContentType "application/json" -Body $cuerpo -TimeoutSec 20
  } catch {
    Mal "Email o contrasena incorrectos."
    if ($conAsistente) { Fallo }
    continue
  }

  # ── El permiso tiene que ser DE ESTA EMPRESA ────────────────────────────────
  #
  # Si el titular administra dos bares, el servidor de ESTE no puede quedarse con un permiso
  # que apunte al otro: se bajaria la carta equivocada y le subiria las ventas al bar de al
  # lado.
  #
  # SE PREGUNTA A LA BASE DE DATOS, no al token. El token de Supabase **no trae `tenant_id`**
  # (el hook `custom_access_token_hook` existe pero no esta activado en la consola de
  # Supabase). La aplicacion no lo nota porque `current_tenant_id()` tiene un plan B —busca
  # el `app_user` por `auth.uid()`—, pero este script leia el claim a pelo y le salia vacio:
  #
  #     "Esa cuenta no pertenece a 'Plantilla base'"  ...con la cuenta del titular DE
  #     Plantilla base.
  #
  # O sea: el instalador tampoco pasaba de la pregunta 2. Y no lo sabia nadie porque este
  # script no se habia ejecutado nunca.
  #
  # Preguntando a la base funciona con el hook y sin el. Y la RLS hace el trabajo: si la
  # cuenta fuera de otra empresa, la fila que devuelve seria la de ESA otra empresa, y la
  # comparacion de abajo la rechaza igual.
  $sub = $s.user.id
  try {
    $yo = Invoke-RestMethod "$Nube/rest/v1/app_user?select=tenant_id&auth_user_id=eq.$sub" `
          -Headers @{ apikey = $AnonKey; authorization = "Bearer $($s.access_token)" } -TimeoutSec 15
  } catch {
    Mal "No se pudo comprobar a que empresa pertenece esa cuenta."
    if ($conAsistente) { Fallo }
    continue
  }

  if (-not $yo -or $yo.Count -eq 0) {
    Mal "Esa cuenta no esta dada de alta como empleado de ninguna empresa."
    if ($conAsistente) { Fallo }
    continue
  }
  if ($yo[0].tenant_id -ne $tenantId) {
    Mal "Esa cuenta no pertenece a '$empresa'. Usa la del titular de esta empresa."
    if ($conAsistente) { Fallo }
    continue
  }

  $refresco = $s.refresh_token
  Bien "Permiso obtenido para $empresa"
}

# Lo unico que se guarda. Nada de contrasenas, nada de claves maestras.
@"
# Credenciales del NODO. Generado por el instalador.
# NO contiene la clave secreta de Gluuh: este servidor solo puede ver SU empresa.
SUPABASE_URL=$Nube
SUPABASE_ANON_KEY=$AnonKey
SUPABASE_REFRESH_TOKEN=$refresco
NODO_TENANT=$tenantId
"@ | Out-File "$nodo\sync.env" -Encoding ascii

# ── 3. Datos fiscales ────────────────────────────────────────────────────────
Titulo "3 de 4 - Datos fiscales"

$cab = @{ apikey = $AnonKey; authorization = "Bearer $($s.access_token)" }
$loc = Invoke-RestMethod "$Nube/rest/v1/location?select=id,nombre,cif,razon_social,territorio_fiscal&tenant_id=eq.$tenantId" -Headers $cab -TimeoutSec 15

if (-not $loc -or $loc.Count -eq 0) {
  Mal "Esta empresa no tiene ningun local dado de alta. Hay que crearlo antes en el panel."
  Fallo
}
$local = $loc[0]

if ($local.cif -and $local.cif -ne "PENDIENTE") {
  Bien "Ya estaban: $($local.razon_social) - $($local.cif) ($($local.territorio_fiscal))"
} else {
  if ($conAsistente) {
    $cif   = $R['cif']
    $razon = $R['razon']
    $terr  = $R['territorio']
  } else {
    Write-Host "   Sin estos datos NO se pueden emitir facturas. Los pide la AEAT." -ForegroundColor Yellow
    Write-Host ""
    $cif = Read-Host "   CIF / NIF de la empresa"
    $razon = Read-Host "   Razon social (nombre fiscal)"
    Write-Host ""
    Write-Host "   Territorio fiscal:" -ForegroundColor DarkGray
    Write-Host "     1) Peninsula y Baleares (IVA)"
    Write-Host "     2) Canarias (IGIC)"
    Write-Host "     3) Ceuta y Melilla (IPSI)"
    $terr = switch (Read-Host "   Elige (1/2/3)") {
      "2" { "CANARIAS" }
      "3" { "CEUTA_MELILLA" }
      default { "PENINSULA_BALEARES" }
    }
  }

  if (-not $cif -or -not $razon) {
    Mal "Faltan los datos fiscales. Sin CIF no se pueden emitir facturas."
    Fallo
  }

  $cuerpo = @{ cif = $cif; razon_social = $razon; territorio_fiscal = $terr } | ConvertTo-Json
  Invoke-RestMethod "$Nube/rest/v1/location?id=eq.$($local.id)" -Method Patch `
    -Headers ($cab + @{ Prefer = "return=minimal" }) -ContentType "application/json" -Body $cuerpo -TimeoutSec 15 | Out-Null
  Bien "Guardados: $razon - $cif ($terr)"
}

# ── 4. Arranque automatico ───────────────────────────────────────────────────
Titulo "4 de 4 - Arranque automatico"
if ($conAsistente) {
  $auto = ($R['auto'] -eq '1')
} else {
  Write-Host "   Lo normal es que si: el bar enciende el ordenador y todo funciona solo."
  $auto = (Read-Host "   Arrancar automaticamente al encender? (S/n)") -notmatch '^[nN]'
}
Bien $(if ($auto) { "Si" } else { "No" })

# ── Manos a la obra ──────────────────────────────────────────────────────────
Titulo "Instalando (esto tarda unos minutos)"

# ── SECRETOS PROPIOS DE ESTE BAR ─────────────────────────────────────────────
#
# Hasta ahora todos los nodos compartian el secreto JWT y la contrasena de Postgres del
# entorno de desarrollo... que ademas estan escritos en el manual, en el repositorio y en
# este mismo chat.
#
# Con un secreto compartido, CUALQUIERA que lo lea puede firmar un token de
# `service_role` valido para CUALQUIER nodo al que alcance por red: el wifi del bar, un
# portatil en la terraza. Y con ese token se salta toda la RLS de ese nodo.
#
# Aqui se generan secretos NUEVOS, aleatorios y distintos en cada instalacion. No salen
# nunca de este ordenador.
Progreso "Generando las claves unicas de este servidor..."
Write-Host "   Generando las claves de este servidor..." -ForegroundColor DarkGray

function Aleatorio([int]$bytes) {
  $b = New-Object byte[] $bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  # Base64 sin caracteres que molesten en ficheros de configuracion ni en URLs.
  [Convert]::ToBase64String($b).Replace('+','x').Replace('/','y').Replace('=','')
}

$jwtSecreto = Aleatorio 48    # >= 32 caracteres, como exige GoTrue
$pgClave    = Aleatorio 24

# postgrest.conf: apunta a la base con la contrasena nueva y valida los JWT con el
# secreto nuevo.
@"
db-uri = "postgres://authenticator:$pgClave@127.0.0.1:55432/gluuh"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$jwtSecreto"
server-port = 55433
server-host = "127.0.0.1"
"@ | Out-File "$nodo\postgrest.conf" -Encoding ascii

# El secreto del nodo, para que los servicios que firman tokens usen el mismo.
# Y la IDENTIDAD de esta instalacion (F3, 0116): el fingerprint que la nube tiene
# registrado en `nodo_instancia` (y su id, si el canje fue por orden) — es lo que
# permite revocar ESTE nodo desde el panel sin tocar ningun otro local.
$lineasEnv = @("NODO_JWT_SECRETO=$jwtSecreto", "NODO_FINGERPRINT=$fingerprint")
if ($nodoId) { $lineasEnv += "NODO_ID=$nodoId" }
$lineasEnv -join "`r`n" | Out-File "$nodo\nodo.env" -Encoding ascii

Bien "Claves generadas (unicas de este bar)"

$nMigraciones = (Get-ChildItem "$Raiz\supabase\migrations\*.sql").Count
Progreso "Creando la base de datos del bar ($nMigraciones migraciones)..."
Write-Host "   Preparando la base de datos..." -ForegroundColor DarkGray
& "$PSScriptRoot\instalar-nodo.ps1" -Recrear -JwtSecreto $jwtSecreto -PgClave $pgClave |
  Out-File "$nodo\tmp\instalacion.log" -Encoding utf8
Bien "Base de datos lista"

Progreso "Bajando de la nube la carta, las mesas y los empleados..."
Write-Host "   Bajando la carta, las mesas y los empleados..." -ForegroundColor DarkGray
Push-Location $Raiz
node "$Raiz\apps\nodo\provisionar.mjs" $tenantId | Out-File "$nodo\tmp\provision.log" -Encoding utf8

# `??` NO EXISTE EN WINDOWS POWERSHELL 5.1, que es el que trae un Windows de fabrica — o
# sea, el del mini-PC del bar. Y no es que fallara la linea: es un error de SINTAXIS, asi
# que el script ENTERO no se cargaba. Ni una linea. El .exe habria creado la base de datos
# y reventado justo aqui, dejando al tecnico con una maquina a medias y sin saber por que.
#
# No lo pillo nadie porque este script NUNCA SE HABIA EJECUTADO: probabamos a mano, con
# otros comandos. Ahora lo prueba `prueba-instalador.ps1`.
$filas = (Select-String -Path "$nodo\tmp\provision.log" -Pattern "filas bajadas").Line
if (-not $filas) { $filas = "Bar descargado" }
Bien $filas

# ── EL PRIMER TPV, LISTO PARA EMPAREJAR ──────────────────────────────────────
#
# Plan 14 F3: se crea "TPV 1" PENDIENTE de emparejado — nunca un usuario tpv1
# con contrasena conocida. El codigo de 6 digitos es de UN uso y sale impreso
# en la hoja de entrega; el tecnico lo teclea en el terminal y listo.
#
# Y si el bar llego SIN NINGUN usuario (empresa recien creada: ya no se
# siembran tecnico/1212 ni camareros de ejemplo), se crea UN titular con clave
# y PIN ALEATORIOS de esta instalacion, impresos UNA vez aqui. Un bar con sus
# usuarios de la nube no se toca.
$codigoTpv = '{0:D6}' -f (Get-Random -Minimum 100000 -Maximum 1000000)
$alfaClave = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
$claveTitular = -join (1..8 | ForEach-Object { $alfaClave[(Get-Random -Maximum $alfaClave.Length)] })
$pinTitular = '{0:D4}' -f (Get-Random -Minimum 1000 -Maximum 10000)

$semillaSql = @"
set search_path = public, extensions;
insert into public.device (tenant_id, location_id, tipo, modulo, nombre, codigo_vinculacion, codigo_expira)
select '$tenantId', l.id, 'TPV', 'TPV', 'TPV 1', '$codigoTpv', now() + interval '24 hours'
  from public.location l where l.tenant_id = '$tenantId'
 order by l.created_at limit 1
on conflict do nothing;
insert into public.app_user (tenant_id, nombre, rol, activo, usr_app, clave_hash, pin_hash)
select '$tenantId', 'Titular', 'PROPIETARIO', true, 'admin',
       crypt('$claveTitular', gen_salt('bf')), crypt('$pinTitular', gen_salt('bf'))
 where not exists (select 1 from public.app_user where tenant_id = '$tenantId');
"@
$semillaSql | Out-File "$nodo\tmp\semilla-tpv.sql" -Encoding ascii
$env:PGPASSWORD = $pgClave
$semillaSalida = & "$nodo\pgsql\bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -q `
  -c "\set ON_ERROR_STOP on" -f "$nodo\tmp\semilla-tpv.sql" 2>&1
Remove-Item "$nodo\tmp\semilla-tpv.sql" -Force -ErrorAction SilentlyContinue
# Solo se ensenan las credenciales del titular si DE VERDAD se creo (bar nuevo).
$titularSembrado = ((& "$nodo\pgsql\bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -t -A `
  -c "select count(*) from public.app_user where tenant_id = '$tenantId' and usr_app = 'admin' and nombre = 'Titular'") -join '').Trim() -eq '1'
Bien "TPV 1 creado, pendiente de emparejar (codigo en la hoja)"

Progreso "Bajando las fotos de la carta..."
Write-Host "   Bajando las fotos de la carta..." -ForegroundColor DarkGray
node "$Raiz\apps\nodo\descargar-imagenes.mjs" | Out-File "$nodo\tmp\imagenes.log" -Encoding utf8
Bien "Fotos descargadas"
Pop-Location

# ── La contrasena del titular, TAMBIEN en el nodo ────────────────────────────
#
# El backoffice entra con email + contrasena. Esa contrasena vivia SOLO en la nube, asi
# que el dueno NO PODIA abrir el panel de su propio bar sin internet: ni para cambiar un
# precio, ni para ver la caja. (Los camareros si entraban al TPV: ellos van por PIN.)
#
# El titular acaba de teclearla aqui arriba, asi que se siembra en el nodo. Se guarda
# HASHEADA con bcrypt (lo hace Postgres, no nosotros); la contrasena en claro no se
# escribe en ningun sitio.
Progreso "Preparando el acceso del titular al panel..."
Write-Host "   Preparando el acceso del titular al panel local..." -ForegroundColor DarkGray
$env:PGPASSWORD = "gluuh"
$env:PGCLIENTENCODING = "UTF8"
$sqlPass = "select public.fijar_password_local(" +
           "'" + $email.Replace("'","''") + "', " +
           "'" + $passTxt.Replace("'","''") + "');"
$sqlPass | Out-File "$nodo\tmp\pass.sql" -Encoding utf8
& "$nodo\pgsql\bin\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d gluuh -q -f "$nodo\tmp\pass.sql" | Out-Null
Remove-Item "$nodo\tmp\pass.sql" -Force   # que no quede la contrasena en un fichero
Bien "El titular ya puede entrar al panel del bar SIN internet"

# ── La interfaz ──────────────────────────────────────────────────────────────
#
# En el .exe viene ya compilada dentro del paquete. Desde el codigo fuente hay que
# compilarla una vez.
#
# Y esto es lo que hace que ESTE script sirva para las dos cosas — que es el arreglo de
# fondo: hasta hoy el tecnico ejecutaba este instalador y nosotros probabamos con OTROS
# comandos. Probabamos un camino distinto del que recorre el cliente, y por eso este script
# llevaba semanas sin poder ni cargarse (tenia un `??` de PowerShell 7) sin que nadie lo
# supiera. Lo que probamos tiene que ser lo que se ejecuta en el bar.
$standalone = Join-Path $Raiz "apps\web\.next\standalone\apps\web\server.js"
if (-not (Test-Path $standalone)) {
  if (Test-Path (Join-Path $Raiz "apps\web\package.json")) {
    Write-Host "   Compilando la interfaz (solo la primera vez, tarda un par de minutos)..." -ForegroundColor DarkGray
    Push-Location $Raiz
    & pnpm --filter @gluuh/web build:nodo *> "$nodo\tmp\web-build.log"
    Pop-Location
    if (-not (Test-Path $standalone)) {
      Mal "No se pudo compilar la interfaz. Mira .nodo\tmp\web-build.log"
      Fallo
    }
    Bien "Interfaz compilada"
  } else {
    Mal "El paquete no trae la interfaz compilada. Instalador incompleto: avisa a Gluuh."
    Fallo
  }
}

Progreso "Arrancando los servicios del servidor..."
Write-Host "   Arrancando los servicios..." -ForegroundColor DarkGray
& "$PSScriptRoot\arrancar-nodo.ps1" | Out-Null
Bien "Servidor en marcha"

if ($auto) {
  & "$PSScriptRoot\servicio-windows.ps1" -Instalar | Out-Null
  Bien "Arrancara solo al encender el ordenador"
}

# ── Hoja de entrega ──────────────────────────────────────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
       Select-Object -First 1).IPAddress
$url = "http://${ip}:54321"

# Las claves que usaran los TPV. Se DERIVAN del secreto de este bar: son distintas en
# cada local, y las de un bar no valen en otro.
Push-Location $Raiz
$claves = node "$Raiz\apps\nodo\claves.mjs" $jwtSecreto
Pop-Location
$anon = ($claves | Where-Object { $_ -match '^eyJ' })[0]

$hoja = @"
GLUUH TPV - SERVIDOR DEL LOCAL
==============================

Empresa    : $empresa
Instalado  : $(Get-Date -Format 'dd/MM/yyyy HH:mm')
Ordenador  : $env:COMPUTERNAME

DIRECCION DEL SERVIDOR (esto es lo que hay que poner en cada TPV):

    $url

CLAVE DE ACCESO DE LOS TPV (unica de este bar):

    $anon

PRIMER TPV ("TPV 1"), listo para emparejar:

    Codigo de emparejado:  $codigoTpv
    (Un solo uso, caduca en 24 horas. Se teclea en la pantalla "Conectar este
     terminal" del TPV. Para mas terminales: panel > Puntos de venta > Vincular.)
$(if ($titularSembrado) { @"

ACCESO DEL TITULAR (bar nuevo; unico de esta instalacion — GUARDA ESTA HOJA):

    Panel del bar:  usuario  admin
                    clave    $claveTitular
    PIN en el TPV:  $pinTitular
"@ })

IMPORTANTE
- Este ordenador tiene que quedarse ENCENDIDO. Es donde estan los datos.
- Si se apaga, los TPV no pueden cobrar.
- El bar funciona SIN internet. Cuando vuelva la linea, sube solo.
- La IP no puede cambiar: fijala en el router (reserva por MAC).

Estado del servidor:  $url/servidor  (desde cualquier TPV)
"@

$hoja | Out-File "$Raiz\INSTALACION.txt" -Encoding utf8

Write-Host ""
Write-Host "   ================================================" -ForegroundColor Green
Write-Host "    $empresa" -ForegroundColor White
Write-Host "    Servidor instalado y funcionando." -ForegroundColor Green
Write-Host "   ================================================" -ForegroundColor Green
Write-Host ""
Write-Host "    En cada TPV hay que poner esta direccion:" -ForegroundColor White
Write-Host ""
Write-Host "        $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Queda escrito en INSTALACION.txt" -ForegroundColor DarkGray
Write-Host ""

# La instalacion TERMINO: el intento de la orden ya no hace falta (la reserva se
# consumio al canjear). Si quedara, una REINSTALACION futura intentaria reanudar
# una orden ya gastada en vez de pedir el codigo nuevo.
Remove-Item (Join-Path $env:TEMP "gluuh-instalacion-intento.txt") -Force -ErrorAction SilentlyContinue

# Y el sentinela: le dice al asistente que todo fue bien y ya puede cerrar la pantalla de
# instalacion. Sin esto se quedaria esperando eternamente.
Progreso "@@FIN@@"
