# Montar-Paquete.ps1 — prepara la carga del instalador y compila el .exe.
#
#   .\supabase\nodo\instalador\Montar-Paquete.ps1
#
# Esto existe para que montar el instalador NO SEA UN RITUAL que alguien recuerde a medias.
# Un paquete al que le falta una pieza no da error: se entrega, se instala, y el bar no
# arranca. Ya nos ha pasado con casi todo lo demás.
#
# QUÉ METE DENTRO (y por qué cada cosa):
#
#   pgsql\   Postgres, PODADO         ~120 MB   bin + lib + share. NO va pgAdmin (616 MB) ni
#                                               los símbolos de depuración (156 MB): un bar
#                                               no necesita una consola gráfica de admin.
#   bin\     postgrest.exe             ~66 MB   OJO: necesita libpq.dll, que viene con
#                                               POSTGRES y no en su propio zip. Si se
#                                               empaqueta uno sin el otro, PostgREST muere
#                                               en silencio nada más arrancar.
#   node\    Node.js portable          ~80 MB   EN EL ORDENADOR DE UN BAR NO HAY NODE. El
#                                               gateway, el auth, el realtime, las imágenes
#                                               y la web son todos Node: sin esto no arranca
#                                               ni un servicio.
#   web\     .next\standalone          ~41 MB   La INTERFAZ. La sirve el propio nodo.
#
# Y el .exe lleva además el código (apps\nodo, supabase\) y las migraciones.

param(
  [string]$Raiz = (Resolve-Path "$PSScriptRoot\..\..\.."),

  # ── DÓNDE SE MONTA, Y POR QUÉ FUERA DEL REPOSITORIO ────────────────────────
  #
  # Dos razones, y las dos son fallos que me comí montándolo:
  #
  #   1. LA CARGA ESTABA DENTRO DE `supabase\`, y el .iss empaqueta `supabase\*` entero y
  #      recursivo. O sea que **el instalador se metía a sí mismo dentro**: los 510 MB de
  #      carga, otra vez, dentro del paquete.
  #
  #   2. WINDOWS NO PASA DE 260 CARACTERES DE RUTA. Y pnpm hace carpetas como
  #      `.pnpm\next@16.2.9_babel-plugin-react-compiler@1.0.0_react-dom@19.2.7_react@19.2.7__react@19.2.7\node_modules\@swc\helpers\cjs\`.
  #      Montado dentro del repositorio (que ya cuelga de `C:\Users\...\Documents\GitHub\`),
  #      eso se pasa del límite y la compilación revienta a media faena — después de veinte
  #      minutos comprimiendo, y con un error que no dice qué fichero.
  #
  # Desde una ruta corta, ninguna de las dos cosas pasa. Y de paso los 510 MB no entran
  # nunca en el repositorio.
  [string]$Carga = "C:\gluuh-paquete",

  # La clave PÚBLICA de Gluuh (publishable). Se incrusta en el instalador para que el
  # técnico no tenga que teclear 60 caracteres — un carácter mal copiado deja la instalación
  # a medias sin decir dónde está el fallo. Si no se pasa, se coge del .env.local.
  [string]$AnonKey,
  [switch]$SoloCarga   # monta la carga y no compila (para revisarla)
)

$ErrorActionPreference = "Stop"
$carga = $Carga
$dist  = Join-Path $Carga "dist"
$nodo  = Join-Path $Raiz ".nodo"

function Paso($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Bien($t) { Write-Host "   $t" -ForegroundColor Green }
function Mal($t)  { Write-Host "   $t" -ForegroundColor Red }

function Pesa($ruta) {
  if (-not (Test-Path $ruta)) { return 0 }
  [math]::Round((Get-ChildItem $ruta -Recurse -File -ErrorAction SilentlyContinue |
                 Measure-Object Length -Sum).Sum / 1MB, 0)
}

# ── 0. La clave pública ──────────────────────────────────────────────────────
if (-not $AnonKey) {
  $envLocal = Join-Path $Raiz "apps\web\.env.local"
  if (Test-Path $envLocal) {
    $m = Select-String -Path $envLocal -Pattern '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)$'
    if ($m) { $AnonKey = $m.Matches[0].Groups[1].Value.Trim() }
  }
}
if (-not $AnonKey) {
  Mal "Sin la clave publica de Gluuh. Pasala con -AnonKey o ponla en apps\web\.env.local."
  Mal "Sin ella, el instalador se la pedira al tecnico: 60 caracteres a mano."
  exit 1
}

New-Item -ItemType Directory -Force -Path $carga | Out-Null

# ── 1. Postgres, podado ──────────────────────────────────────────────────────
Paso "Postgres (podado)"
$origenPg = Join-Path $nodo "pgsql"
if (-not (Test-Path "$origenPg\bin\postgres.exe")) {
  Mal "No encuentro Postgres en $origenPg. Arranca el nodo una vez y vuelve."
  exit 1
}

$destinoPg = Join-Path $carga "pgsql"
Remove-Item $destinoPg -Recurse -Force -ErrorAction SilentlyContinue
foreach ($d in @("bin", "lib", "share")) {
  Copy-Item "$origenPg\$d" -Destination "$destinoPg\$d" -Recurse -Force
}
Bien "$(Pesa $destinoPg) MB  (de $(Pesa $origenPg) MB: fuera pgAdmin, simbolos, doc e include)"

# ── 2. PostgREST ─────────────────────────────────────────────────────────────
Paso "PostgREST"
$destinoBin = Join-Path $carga "bin"
New-Item -ItemType Directory -Force -Path $destinoBin | Out-Null
Copy-Item "$nodo\bin\postgrest.exe" -Destination $destinoBin -Force
Bien "$(Pesa $destinoBin) MB"

# ── 3. Node portable ─────────────────────────────────────────────────────────
#
# EL MISMO que usamos aqui. Lo que se prueba tiene que ser lo que se entrega: un bar con una
# version distinta de Node es un bar donde puede fallar algo que aqui nunca falla.
Paso "Node portable"
$version = (node -v)                       # v22.21.0
$destinoNode = Join-Path $carga "node"

if (-not (Test-Path "$destinoNode\node.exe")) {
  $zip = Join-Path $env:TEMP "node-$version-win-x64.zip"
  if (-not (Test-Path $zip)) {
    Write-Host "   Bajando Node $version..." -ForegroundColor DarkGray
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest "https://nodejs.org/dist/$version/node-$version-win-x64.zip" -OutFile $zip -UseBasicParsing
  }
  $tmp = Join-Path $env:TEMP "gluuh-node"
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $zip -DestinationPath $tmp -Force
  # El zip trae una carpeta `node-vXX-win-x64\` dentro. Se coge su CONTENIDO, no la carpeta:
  # si no, node.exe acabaria en `node\node-v22...\node.exe` y el PATH no lo encontraria.
  $dentro = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Remove-Item $destinoNode -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item $dentro.FullName $destinoNode
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
Bien "$version  ·  $(Pesa $destinoNode) MB"

# ── 4. La interfaz ───────────────────────────────────────────────────────────
Paso "La interfaz (Next standalone)"
$origenWeb = Join-Path $Raiz "apps\web\.next\standalone"
if (-not (Test-Path "$origenWeb\apps\web\server.js")) {
  Mal "No esta compilada. Ejecuta:  pnpm --filter @gluuh/web build:nodo"
  exit 1
}
# Y COMPROBAR QUE LLEVA LO SUYO. `next build --standalone` NO copia `.next\static` ni
# `public`: sin ellos la web ARRANCA IGUAL y sirve el HTML sin CSS ni JavaScript. Pagina en
# blanco en el TPV de un bar, y ni un error en los logs. (`build-nodo.mjs` los copia; esto
# se asegura de que se hizo.)
if (-not (Test-Path "$origenWeb\apps\web\.next\static")) {
  Mal "Al standalone le falta .next\static: la web se veria EN BLANCO. Recompila con build:nodo."
  exit 1
}
$destinoWeb = Join-Path $carga "web"
Remove-Item $destinoWeb -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item $origenWeb -Destination $destinoWeb -Recurse -Force
$antes = Pesa $destinoWeb

# ── Y a podar ────────────────────────────────────────────────────────────────
#
# El standalone que sale de pnpm viene inflado por dos motivos, y los dos se pagan en el
# pendrive del tecnico:
#
#   1. `Copy-Item` SIGUE LOS ENLACES SIMBOLICOS de pnpm, asi que cada paquete acaba copiado
#      dos veces (una en `.pnpm\<pkg>\node_modules\<pkg>`, otra donde apuntaba el enlace).
#      Eso no se puede evitar: la maquina del bar necesita ficheros de verdad. Pero comprime
#      casi a cero (el .exe va en modo solido), asi que se deja.
#
#   2. Trae MAPAS DE CODIGO (`.map`) y los runtimes de DESARROLLO. Un servidor de produccion
#      no carga ni unos ni otros: los `.map` solo los pide el navegador cuando alguien abre
#      las herramientas de desarrollo, y los `.dev.js` no se usan nunca. Son mas de 100 MB
#      de nada.
$mapas = @(Get-ChildItem $destinoWeb -Recurse -File -Filter "*.map" -ErrorAction SilentlyContinue)
$mapas | Remove-Item -Force -ErrorAction SilentlyContinue

$dev = @(Get-ChildItem $destinoWeb -Recurse -File -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -like "*.runtime.dev.js" })
$dev | Remove-Item -Force -ErrorAction SilentlyContinue

Bien "$(Pesa $destinoWeb) MB  (de $antes MB: fuera $($mapas.Count) mapas y $($dev.Count) runtimes de desarrollo)"

# ── 5. Las dependencias de Node ──────────────────────────────────────────────
#
# `apps\nodo\*.mjs` sólo importa una cosa de fuera: `pg` (el cliente de Postgres). Todo lo
# demás son módulos de Node.
#
# Pero NO SE PUEDE COPIAR `node_modules\pg` DEL REPOSITORIO. Con pnpm eso es un ENLACE
# SIMBÓLICO a `.pnpm\pg@x.y.z\node_modules\pg`, y sus dependencias (pg-pool, pg-protocol,
# pg-types, postgres-array, pgpass…) viven ahí al lado, fuera del enlace. Copiar la carpeta
# se lleva `pg` **sin sus tripas**: en el bar, `import pg` reventaría con
# «Cannot find module 'pg-pool'» y el nodo no podría ni conectar a su base de datos.
#
# Se instala un árbol PLANO y autocontenido con npm, que es lo que hay que empaquetar.
# ── El instalador del TPV, DENTRO (instalador unico) ─────────────────────────
#
# electron-builder lo deja en {carga}\tpv (electron-builder.yml, output fuera del
# repositorio por el EBUSY del antivirus). El .iss lo empaqueta como componente
# "tpv". Si falta, el instalador unico saldria SIN TPV — y eso no da error al
# compilar... si no se comprueba aqui.
Paso "El instalador del TPV (va dentro como componente)"
$setupTpv = Join-Path $carga "tpv\Gluuh TPV Setup 0.1.0.exe"
if (-not (Test-Path $setupTpv)) {
  Mal "Falta $setupTpv"
  Mal "Compila el TPV primero:  pnpm --filter @gluuh/desktop dist"
  exit 1
}
Bien "$([math]::Round((Get-Item $setupTpv).Length / 1MB)) MB"

Paso "Dependencias de Node (pg y las suyas)"
$destinoDeps = Join-Path $carga "node_modules"

if (-not (Test-Path "$destinoDeps\pg\package.json")) {
  # La MISMA version que usamos aqui. Lo que se prueba es lo que se entrega.
  $pgVer = (Get-Content (Join-Path $Raiz "node_modules\pg\package.json") | ConvertFrom-Json).version
  Write-Host "   Instalando pg@$pgVer (arbol plano)..." -ForegroundColor DarkGray

  $tmp = Join-Path $env:TEMP "gluuh-deps"
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  '{"name":"gluuh-nodo","private":true}' | Out-File "$tmp\package.json" -Encoding ascii

  Push-Location $tmp
  & npm install "pg@$pgVer" --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | Out-Null
  Pop-Location

  if (-not (Test-Path "$tmp\node_modules\pg-pool")) {
    Mal "npm no dejo el arbol completo (falta pg-pool). Sin eso, el nodo no conecta."
    exit 1
  }
  Remove-Item $destinoDeps -Recurse -Force -ErrorAction SilentlyContinue
  Move-Item "$tmp\node_modules" $destinoDeps
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
$paquetes = (Get-ChildItem $destinoDeps -Directory).Count
Bien "$paquetes paquete(s)  ·  $(Pesa $destinoDeps) MB"

# ── 6. La configuracion de PostgREST ─────────────────────────────────────────
#
# Es una PLANTILLA: el instalador la reescribe con las claves aleatorias de ESE bar. Va en
# el paquete solo para que exista el fichero desde el minuto cero.
Paso "postgrest.conf (plantilla)"
# Los valores son un MARCADOR, no una clave: `Instalar-Gluuh.ps1` reescribe este fichero
# entero con secretos aleatorios distintos en cada bar (ver ahi la seccion de claves). Si
# alguna vez arrancara con estos, PostgREST no conectaria — que es lo que se quiere.
$marcador = "SIN-CONFIGURAR-lo-reescribe-el-instalador"
@"
db-uri = "postgres://authenticator:$marcador@127.0.0.1:55432/gluuh"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$marcador"
server-port = 55433
server-host = "127.0.0.1"
"@ | Out-File (Join-Path $carga "postgrest.conf") -Encoding ascii
Bien "escrita (el instalador la reescribe con las claves de cada bar)"

# ── Resumen ──────────────────────────────────────────────────────────────────
Paso "La carga"
Get-ChildItem $carga | ForEach-Object {
  $mb = if ($_.PSIsContainer) { Pesa $_.FullName } else { [math]::Round($_.Length / 1MB, 1) }
  "   {0,-16} {1,6} MB" -f $_.Name, $mb
}
Write-Host ("   {0,-16} {1,6} MB  TOTAL" -f "", (Pesa $carga)) -ForegroundColor White

if ($SoloCarga) { Write-Host "`n   (--SoloCarga: no se compila)`n" -ForegroundColor DarkGray; exit 0 }

# ── 6. Compilar ──────────────────────────────────────────────────────────────
Paso "Compilando el .exe"
$iscc = @(
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  "C:\Program Files\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
  Mal "Falta Inno Setup.  winget install --id JRSoftware.InnoSetup"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
& $iscc "/DAnonKey=$AnonKey" "/DCarga=$carga" "/DDist=$dist" (Join-Path $PSScriptRoot "gluuh-servidor.iss")
if ($LASTEXITCODE -ne 0) { Mal "La compilacion fallo."; exit 1 }

$exe = Get-ChildItem $dist -Filter "*.exe" | Sort-Object LastWriteTime | Select-Object -Last 1
Write-Host ""
Write-Host "   ============================================" -ForegroundColor Green
Write-Host "    $($exe.Name)" -ForegroundColor White
Write-Host "    $([math]::Round($exe.Length / 1MB, 0)) MB  ·  $($exe.DirectoryName)" -ForegroundColor Green
Write-Host "   ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   FIRMALO antes de darselo a un cliente. Sin firma, Windows SmartScreen le" -ForegroundColor Yellow
Write-Host "   ensena un aviso rojo de 'aplicacion no reconocida' y ahi se acaba la" -ForegroundColor Yellow
Write-Host "   instalacion: el tecnico no va a pulsar 'ejecutar de todas formas' en el" -ForegroundColor Yellow
Write-Host "   ordenador de un cliente." -ForegroundColor Yellow
Write-Host ""
