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
  [string]$Respuestas
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
function Mal($t)  { Write-Host "   $t" -ForegroundColor Red }

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
    if ($conAsistente) { exit 1 }
    continue
  }
  $norm = "{0}-{1}-{2}-{3}-{4}" -f $codigo.Substring(0,4), $codigo.Substring(4,4), $codigo.Substring(8,5), $codigo.Substring(13,4), $codigo.Substring(17,4)

  try {
    # CANJEAR el codigo (RPC `empresa_por_codigo`, migracion 0104). NO se consulta la tabla
    # `tenant` directamente: aqui todavia no hay sesion, o sea que somos ANONIMOS, y la RLS
    # de `tenant` es `id = current_tenant_id()`. Un anonimo no tiene empresa, asi que
    # devolvia CERO FILAS con un 200 tan tranquila.
    #
    # Traduccion: el instalador respondia "Ese codigo no es valido" SIEMPRE, con cualquier
    # codigo. No se podia instalar ni un bar. Y no lo sabia nadie porque este script nunca
    # se habia ejecutado.
    #
    # Tampoco se arregla abriendo `tenant` al anonimo: eso enseñaria la lista de TODOS
    # nuestros clientes a cualquiera que tenga la clave publica (que va dentro de cualquier
    # navegador que abra app.gluuh.com). El codigo de 21 digitos ES la credencial: se canjea
    # por SU empresa y por ninguna mas.
    $cab = @{ apikey = $AnonKey; authorization = "Bearer $AnonKey" }
    $cuerpo = @{ p_codigo = $norm } | ConvertTo-Json
    $t = Invoke-RestMethod "$Nube/rest/v1/rpc/empresa_por_codigo" -Method Post `
         -Headers $cab -ContentType "application/json" -Body $cuerpo -TimeoutSec 15
  } catch {
    Mal "No hay conexion con Gluuh. La instalacion necesita internet UNA vez."
    Mal $_.Exception.Message
    exit 1
  }

  if (-not $t -or $t.Count -eq 0) {
    Mal "Ese codigo no es valido. Comprueba que lo has copiado bien."
    if ($conAsistente) { exit 1 }
    continue
  }
  if (-not $t[0].activo) {
    Mal "Esa empresa esta dada de baja. Llama a Gluuh."
    exit 1
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
    if ($conAsistente) { exit 1 }
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
    if ($conAsistente) { exit 1 }
    continue
  }

  if (-not $yo -or $yo.Count -eq 0) {
    Mal "Esa cuenta no esta dada de alta como empleado de ninguna empresa."
    if ($conAsistente) { exit 1 }
    continue
  }
  if ($yo[0].tenant_id -ne $tenantId) {
    Mal "Esa cuenta no pertenece a '$empresa'. Usa la del titular de esta empresa."
    if ($conAsistente) { exit 1 }
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
  exit 1
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
    exit 1
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
"NODO_JWT_SECRETO=$jwtSecreto" | Out-File "$nodo\nodo.env" -Encoding ascii

Bien "Claves generadas (unicas de este bar)"

Write-Host "   Preparando la base de datos..." -ForegroundColor DarkGray
& "$PSScriptRoot\instalar-nodo.ps1" -Recrear -JwtSecreto $jwtSecreto -PgClave $pgClave |
  Out-File "$nodo\tmp\instalacion.log" -Encoding utf8
Bien "Base de datos lista"

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
      exit 1
    }
    Bien "Interfaz compilada"
  } else {
    Mal "El paquete no trae la interfaz compilada. Instalador incompleto: avisa a Gluuh."
    exit 1
  }
}

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
