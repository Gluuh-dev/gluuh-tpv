# arrancar-nodo.ps1 — levanta el NODO y lo MANTIENE vivo.
#
#   Postgres   :55432   la verdad
#   PostgREST  :55433   los datos por HTTP
#   Auth       :55434   quién eres (NUESTRO firmador; ya no hay GoTrue)
#   Realtime   :55435   "el comandero ha picado algo"
#   Media      :55436   las fotos de la carta
#   Web        :3100    la interfaz (Next). La sirve el propio nodo
#   Gateway    :54321   <- lo ÚNICO que ve el TPV. Reparte a todos los demás.
#   Sync       —        sube a la nube cada 5 min (sólo si hay credenciales)
#
#   .\arrancar-nodo.ps1           arranca lo que esté parado y sale
#   .\arrancar-nodo.ps1 -Vigilar  arranca Y SE QUEDA vigilando (esto es lo que corre en el bar)
#   .\arrancar-nodo.ps1 -Parar    lo para todo
#
# ─────────────────────────────────────────────────────────────────────────────
#  POR QUÉ EXISTE EL VIGILANTE
#
#  La promesa al cliente es "el servicio se levantará automático y se pondrá ahí, nunca
#  cerrándose". La tarea programada de Windows sólo cumplía la primera mitad: reinicia
#  ESTE script si falla, pero el script arrancaba los siete servicios y TERMINABA. Los
#  hijos se quedaban sin vigilancia.
#
#  Resultado: si PostgREST se moría a las 15:00 de un martes, seguía muerto hasta que
#  alguien reiniciara el ordenador. El bar sin cobrar y nadie sabiendo por qué.
#
#  Con `-Vigilar`, este script se queda dando vueltas: cada 30 s comprueba cada servicio
#  y relevanta SÓLO al caído. Dos niveles de defensa: si el propio vigilante muriera, la
#  tarea programada lo reinicia (RestartCount 999).
# ─────────────────────────────────────────────────────────────────────────────

param(
  [string]$Raiz = (Resolve-Path "$PSScriptRoot\..\.."),
  [int]$Puerto = 55432,
  [switch]$Parar,
  [switch]$Vigilar,
  # Para todo MENOS la base de datos. Lo usa el actualizador: hay que parar los servicios
  # para cambiarles el código, pero Postgres tiene que seguir vivo — si no, las
  # migraciones se aplican contra una base de datos apagada y la actualización falla.
  [switch]$MantenerBd
)

$ErrorActionPreference = "Stop"
$nodo = Join-Path $Raiz ".nodo"
$env:PATH = "$nodo\pgsql\bin;$env:PATH"   # postgrest.exe necesita libpq.dll de aquí

# ── NODE, EL DEL PAQUETE ─────────────────────────────────────────────────────
#
# En el ordenador de un bar NO HAY NODE INSTALADO. Va dentro del `.exe`, en `{app}\node` —
# pero si nadie lo mete en el PATH, `node` no existe y **no arranca ni un servicio**. El
# gateway, el auth, el realtime, las imágenes, la web: todos son Node.
#
# O sea: el instalador habría terminado diciendo "Servidor en marcha", y no habría nada en
# marcha. Aquí no se ve porque en NUESTRA máquina Node está instalado — otra vez lo mismo:
# probar un camino que el cliente no recorre.
#
# Si no está el portable (nuestra máquina), se tira del Node del sistema y todo sigue igual.
$nodePortable = Join-Path $Raiz "node"
if (Test-Path (Join-Path $nodePortable "node.exe")) {
  $env:PATH = "$nodePortable;$env:PATH"
}

New-Item -ItemType Directory -Force -Path "$nodo\tmp" | Out-Null

# ── Utilidades de comprobación ───────────────────────────────────────────────

# Un puerto abierto, sin protocolo. Para el realtime: es SSE, y un GET normal se quedaría
# colgado esperando un final de respuesta que nunca llega.
function PuertoAbierto([int]$p) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $r = $c.BeginConnect("127.0.0.1", $p, $null, $null)
    $ok = $r.AsyncWaitHandle.WaitOne(1500)
    if ($ok) { $c.EndConnect($r) }
    $c.Close()
    return $ok
  } catch { return $false }
}

# Una respuesta HTTP, la que sea. Comprobar el puerto no basta: un PostgREST con la
# conexión a la base de datos rota sigue escuchando pero no sirve nada. Cualquier código
# de respuesta vale — sólo queremos saber si HABLA.
function Responde([string]$url) {
  try {
    Invoke-WebRequest $url -TimeoutSec 4 -UseBasicParsing | Out-Null
    return $true
  } catch {
    return $null -ne $_.Exception.Response   # 404/401 = está vivo y contesta
  }
}

function ProcesoNode([string]$fichero) {
  $null -ne (Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
             Where-Object { $_.CommandLine -match [regex]::Escape($fichero) } |
             Select-Object -First 1)
}

# OJO con el nombre del segundo parámetro: `$args` es una variable AUTOMÁTICA de
# PowerShell (los argumentos de la función). Usarla como parámetro propio la pisa y da
# comportamientos raros. Por eso se llama `$extra`.
function ArrancaNode([string]$fichero, [string]$extra = "") {
  Start-Process node -ArgumentList "$Raiz\apps\nodo\$fichero $extra".Trim() -WorkingDirectory $Raiz `
    -RedirectStandardOutput "$nodo\tmp\$($fichero -replace '\.mjs$','').log" `
    -RedirectStandardError  "$nodo\tmp\$($fichero -replace '\.mjs$','').err" -WindowStyle Hidden
}

# ── El puerto de la web: si esta OCUPADO por otro, se busca uno libre ────────
#
# En la maquina de un desarrollador puede haber un `next dev` en el 3100 (o
# cualquier otra cosa). Antes, la web del nodo moria sin poder enlazar y el
# gateway proxeaba AL PROCESO EQUIVOCADO: el panel servia la web de desarrollo
# sin que nadie lo supiera. Ahora: si el puerto lo ocupa un proceso AJENO, se
# prueba el siguiente (+10, hasta 10 saltos). Si lo ocupa NUESTRA web (un
# relanzamiento), se conserva. Gateway y web lo leen del entorno: se decide
# AQUI para que los dos coincidan siempre.
function ElegirPuertoWeb {
  $p = 3100
  if ($env:NODO_WEB_PUERTO) { $p = [int]$env:NODO_WEB_PUERTO }
  for ($i = 0; $i -lt 10; $i++) {
    $ocupado = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if (-not $ocupado) { return $p }
    $duenyo = (Get-CimInstance Win32_Process `
      -Filter "ProcessId=$(@($ocupado.OwningProcess)[0])" -ErrorAction SilentlyContinue).CommandLine
    if ($duenyo -match 'web\.mjs|standalone') { return $p }   # es la nuestra: relanzamiento
    Write-Host "  puerto $p ocupado por otro proceso; probando $($p + 10)" -ForegroundColor Yellow
    $p = $p + 10
  }
  return $p
}
$env:NODO_WEB_PUERTO = [string](ElegirPuertoWeb)

# ── Los servicios, como DATOS ────────────────────────────────────────────────
# Así el arranque y el vigilante usan exactamente la misma definición: imposible que uno
# arranque algo que el otro no sepa comprobar.

$SERVICIOS = @(
  @{
    nombre = "Postgres"
    vivo   = {
      & "$nodo\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $Puerto -q
      $LASTEXITCODE -eq 0
    }
    arrancar = {
      # `-o "-p $Puerto"` NO sobra: sin él, pg_ctl usa el puerto de postgresql.conf, que
      # es el 5432 de fábrica. Todo lo demás habla al 55432 -> el nodo arrancaría "vivo"
      # pero mudo. Y en una máquina con Postgres propio, se pisaría con el del usuario.
      #
      # ARRANCAR Y SOLTAR. Ni tubería, ni `-Wait`. Las dos formas obvias CUELGAN el
      # vigilante para siempre, y las dos las probé:
      #
      #   · `& pg_ctl … | Out-Null` → Postgres hereda la salida y la mantiene abierta de
      #     por vida; PowerShell espera a que se cierre la tubería y nunca se cierra.
      #   · `Start-Process -Wait`   → `-Wait` espera al proceso Y A SUS DESCENDIENTES.
      #     pg_ctl termina enseguida, pero deja corriendo postgres.exe… que no termina.
      #
      # Y colgaba justo donde más duele: en el bar, la tarea programada corre sin consola,
      # así que el vigilante se habría quedado ahí clavado sin vigilar NADA, para siempre.
      #
      # Se lanza y se suelta. Que esté listo ya lo dirá pg_isready, aquí abajo.
      Start-Process -FilePath "$nodo\pgsql\bin\pg_ctl.exe" `
        -ArgumentList "-D `"$nodo\pgdata`" -o `"-p $Puerto`" -l `"$nodo\tmp\pg.log`" start" `
        -WindowStyle Hidden

      # Y ESPERAR A QUE CONTESTE, no dormir unos segundos y cruzar los dedos. `pg_ctl
      # start` vuelve enseguida, pero Postgres tarda en aceptar conexiones — más aún en un
      # mini-PC arrancando por la mañana. Si los demás salen antes, mueren con «connection
      # refused» y el nodo amanece muerto.
      foreach ($i in 1..60) {
        & "$nodo\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $Puerto -q
        if ($LASTEXITCODE -eq 0) { return }
        Start-Sleep -Seconds 1
      }
      throw "Postgres no llegó a aceptar conexiones"
    }
  }
  @{
    nombre = "PostgREST"
    vivo   = { Responde "http://127.0.0.1:55433/" }
    arrancar = {
      Get-Process postgrest -ErrorAction SilentlyContinue | Stop-Process -Force   # zombis
      Start-Process "$nodo\bin\postgrest.exe" -ArgumentList "$nodo\postgrest.conf" `
        -WorkingDirectory $nodo -RedirectStandardOutput "$nodo\tmp\prst.log" `
        -RedirectStandardError "$nodo\tmp\prst.err" -WindowStyle Hidden
    }
  }
  @{
    # NUESTRO firmador de tokens. Antes aquí había un GoTrue: un fork de Go parcheado a
    # mano, 50 MB, que había que recompilar con cada aviso de seguridad de Supabase — y
    # que en el nodo no autenticaba a nadie: sólo firmaba. Ahora firmamos nosotros.
    nombre = "Auth"
    vivo   = {
      # NO basta con que ALGO conteste en el 55434: hay que saber QUIÉN.
      # Un GoTrue viejo (de un nodo que se actualiza) contesta al /health tan campante,
      # el vigilante lo daría por bueno, y nuestro firmador no arrancaría nunca. El bar se
      # quedaría con el auth de antes para siempre. Se comprueba el nombre.
      try {
        $r = Invoke-RestMethod "http://127.0.0.1:55434/health" -TimeoutSec 4
        return $r.name -eq "nodo-auth"
      } catch { return $false }
    }
    arrancar = {
      # Si hay un GoTrue okupando el puerto, fuera: si no, nuestro firmador no puede atar.
      Get-Process gotrue -ErrorAction SilentlyContinue | Stop-Process -Force
      Start-Sleep -Milliseconds 500
      ArrancaNode "auth.mjs"
    }
  }
  @{
    nombre = "Realtime"
    # SSE: sólo se comprueba el puerto. Un GET se quedaría esperando un final que no llega.
    # Y OJO: no vale ProcesoNode — un proceso ELEVADO no enseña su línea de comandos a un
    # shell normal, se le daría por muerto y se arrancaría un duplicado (muere EADDRINUSE).
    # Basta con saber que el 55435 lo tiene un node.
    vivo     = {
      $c = Get-NetTCPConnection -LocalPort 55435 -State Listen -ErrorAction SilentlyContinue
      if (-not $c) { return $false }
      (Get-Process -Id @($c.OwningProcess)[0] -ErrorAction SilentlyContinue).ProcessName -eq "node"
    }
    arrancar = { ArrancaNode "realtime.mjs" }
  }
  @{
    nombre   = "Media"
    vivo     = { Responde "http://127.0.0.1:55436/object/public/media/_" }   # 404 = vivo
    arrancar = { ArrancaNode "media.mjs" }
  }
  @{
    # La WEB. El nodo la sirve el mismo: la app de escritorio del TPV carga la interfaz de
    # una URL, y en un bar sin internet esa URL tiene que ser el propio servidor.
    # Al salir la web y los datos del MISMO origen, en las terminales no hay NADA que
    # configurar: ni IP, ni claves, ni .env. Solo abrir el navegador.
    nombre   = "Web"
    # OJO: por el puerto ELEGIDO, nunca fijo al 3100 — si ahí vive un `next dev`
    # ajeno, contesta él, el chequeo da "viva" y nuestra web no arranca jamás.
    vivo     = { Responde "http://127.0.0.1:$($env:NODO_WEB_PUERTO)/" }
    arrancar = { ArrancaNode "web.mjs" }
  }
  @{
    nombre   = "Gateway"
    vivo     = { Responde "http://127.0.0.1:54321/nodo/estado" }
    arrancar = { ArrancaNode "gateway.mjs" }
  }
  @{
    nombre = "Sync"
    # Sin credenciales de la nube no es un servicio caído: es un bar sin módulo de nube.
    # Vende, cobra e imprime igual. Simplemente no sube nada.
    vivo     = { (-not (Test-Path "$nodo\sync.env")) -or (ProcesoNode "sincronizar.mjs") }
    arrancar = { if (Test-Path "$nodo\sync.env") { ArrancaNode "sincronizar.mjs" "--bucle" } }
  }
)

# ── Parar ────────────────────────────────────────────────────────────────────
if ($Parar) {
  # PRIMERO el vigilante, y ANTES que nada. Vive en powershell.exe, no en node.exe — si
  # no se le mata aquí, para los servicios y él los relevanta 30 s después: un nodo
  # imposible de apagar. (Y sin `$_.ProcessId -ne $PID` se mataría a sí mismo.)
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -match 'arrancar-nodo\.ps1' -and $_.CommandLine -match '-Vigilar' -and $_.ProcessId -ne $PID } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'gateway\.mjs|realtime\.mjs|media\.mjs|sincronizar\.mjs|auth\.mjs|web\.mjs' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-Process postgrest -ErrorAction SilentlyContinue | Stop-Process -Force

  # Y el GoTrue de las versiones viejas. Ya no lo arrancamos, pero un nodo que se
  # ACTUALIZA lo tiene corriendo: si no se le mata, se queda ocupando el 55434, responde
  # al chequeo de salud (el vigilante lo da por vivo) y nuestro firmador NO PUEDE ARRANCAR.
  # El nodo se quedaría con el auth viejo para siempre, y nadie sabría por qué.
  Get-Process gotrue -ErrorAction SilentlyContinue | Stop-Process -Force

  if ($MantenerBd) {
    Write-Host "Servicios parados (la base de datos sigue en marcha)." -ForegroundColor Yellow
  } else {
    # Igual que el arranque: `Start-Process`, sin tuberías. El `2>&1` sobre un ejecutable
    # nativo, además, convierte en PowerShell 5.1 cualquier línea de stderr en un error
    # —y con $ErrorActionPreference = "Stop", en una excepción. Parar el nodo no puede
    # fallar por un aviso.
    Start-Process -FilePath "$nodo\pgsql\bin\pg_ctl.exe" `
      -ArgumentList "-D `"$nodo\pgdata`" stop -m fast" -Wait -WindowStyle Hidden
    Write-Host "Nodo parado." -ForegroundColor Yellow
  }
  return
}

# ── Arrancar lo que esté parado ──────────────────────────────────────────────
function LevantaLoCaido([bool]$silencioso) {
  $levantados = @()
  foreach ($s in $SERVICIOS) {
    if (& $s.vivo) { continue }
    if (-not $silencioso) { Write-Host ("  {0,-10} " -f $s.nombre) -NoNewline }
    & $s.arrancar

    # ESPERAR DE VERDAD a que arranque: hasta 40 s.
    #
    # Con 10 s no bastaba y se veía en el diario: PostgREST tarda unos segundos en cargar
    # el esquema (84 tablas), así que el vigilante lo daba por muerto, volvía en la ronda
    # siguiente y LO MATABA MIENTRAS ARRANCABA para lanzar otro. Un bucle de reinicios que
    # en un mini-PC con el disco ocupado no terminaría nunca — y el bar sin cobrar.
    #
    # Más vale esperar de sobra que reiniciar de menos.
    foreach ($i in 1..80) {
      Start-Sleep -Milliseconds 500
      if (& $s.vivo) { break }
    }
    $levantados += $s.nombre
    if (-not $silencioso) {
      if (& $s.vivo) { Write-Host "OK" -ForegroundColor Green }
      else { Write-Host "NO ARRANCA" -ForegroundColor Red }
    }
  }
  return $levantados
}

# Los logs crecen para siempre. En un mini-PC pequeño, en meses, llenan el disco — y un
# disco lleno es una base de datos que no puede escribir: el bar deja de cobrar.
function RotaLogs() {
  Get-ChildItem "$nodo\tmp\*.log", "$nodo\tmp\*.err" -ErrorAction SilentlyContinue |
    Where-Object { $_.Length -gt 10MB } |
    ForEach-Object {
      $ultimas = Get-Content $_.FullName -Tail 500
      Set-Content $_.FullName -Value $ultimas -Encoding utf8
    }
}

Write-Host "`nLevantando el nodo…`n" -ForegroundColor Cyan
$null = LevantaLoCaido $false

# Segunda pasada si algo se quedó atrás. En un arranque en frío (Postgres recién
# levantado) PostgREST puede salir antes de que la base de datos acepte conexiones y
# morirse. El vigilante lo curaría en la ronda siguiente, pero entonces el técnico ve un
# "no arrancó" que se arregla solo 30 s después — y eso mina la confianza en el parte.
if ($SERVICIOS | Where-Object { -not (& $_.vivo) }) {
  Start-Sleep -Seconds 3
  $null = LevantaLoCaido $false
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
       Select-Object -First 1).IPAddress

$caidos = @($SERVICIOS | Where-Object { -not (& $_.vivo) } | ForEach-Object { $_.nombre })
if ($caidos.Count -eq 0) {
  Write-Host "`nNodo en marcha. Los TPV de la barra entran por:" -ForegroundColor Green
  Write-Host "    http://${ip}:54321`n" -ForegroundColor White
} else {
  Write-Host "`nNo arrancó: $($caidos -join ', '). Mira los .log de .nodo\tmp\`n" -ForegroundColor Red
}

# ── Vigilar ──────────────────────────────────────────────────────────────────
if (-not $Vigilar) { return }

$diario = "$nodo\tmp\vigilante.log"
function Anota([string]$t) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $t" | Add-Content $diario -Encoding utf8
}

Anota "vigilante en marcha (pid $PID)"
Write-Host "Vigilando. Cada 30 s se comprueba todo y se relevanta lo caído.`n" -ForegroundColor Cyan

# EL DIRECTORIO DE TRABAJO, EN LA RAÍZ DEL NODO. Y no es un detalle:
#
# `copia.mjs` busca `pg_dump.exe` en `.nodo\pgsql\bin` **relativo al directorio actual**
# (`path.resolve(".")`). El vigilante lo arranca la tarea programada de Windows, cuyo
# directorio de trabajo es `C:\Windows\System32` — no el del nodo.
#
# O sea: la copia de seguridad de todas las noches habría fallado en silencio (un error en
# el diario que nadie lee), y el día que se rompiera el disco del bar no habría ninguna.
Set-Location $Raiz

# ── Lo de cada noche ─────────────────────────────────────────────────────────
#
# A las 04:30, con el bar cerrado: la copia de seguridad y la comprobación del reloj. A esa
# hora no hay nadie cobrando, así que un `pg_dump` que se coma el disco un minuto no le
# estropea la noche a ningún camarero.
#
# El día se guarda para no repetirlo: el vigilante da una vuelta cada 30 segundos, y sin
# esto haría 120 copias entre las 04:30 y las 05:00.
$HORA_NOCTURNA = 4
$ultimaNoche = ""

function DeMadrugada() {
  $hoy = Get-Date -Format 'yyyy-MM-dd'
  if ($script:ultimaNoche -eq $hoy) { return }
  if ((Get-Date).Hour -ne $script:HORA_NOCTURNA) { return }
  $script:ultimaNoche = $hoy

  Anota "copia de seguridad de la noche"
  $salida = & node "$Raiz\apps\nodo\copia.mjs" 2>&1
  Anota "  $($salida -join ' | ')"

  # Y el reloj. Este ordenador es el que le pone la hora a cada FACTURA: si va desviado,
  # está firmando facturas con una hora que no ocurrió — y eso, con VERIFACTU, va sellado
  # y encadenado. No se arregla después.
  $reloj = & node "$Raiz\apps\nodo\reloj.mjs" 2>&1
  if ($LASTEXITCODE -ne 0) { Anota "AVISO DEL RELOJ: $($reloj -join ' ')" }
}

# ── El cierre del día, si nadie lo hizo ──────────────────────────────────────
#
# Lo normal es que el encargado le dé a "Cerrar día". Pero se olvidan, y las noches largas
# existen. Si a la hora configurada (06:00 por defecto) sigue habiendo jornada abierta, la
# cierra el nodo y la marca con el ARQUEO PENDIENTE: nadie ha contado la caja, y eso hay que
# decirlo al abrir — un descuadre que no se ve al día siguiente ya no se reconstruye.
#
# `jornada.mjs` sólo cierra si es la hora, así que se le puede llamar en cada ronda: mira el
# reloj y no hace nada las otras 23 horas del día.
$ultimoCierre = ""

function CierraElDiaSiToca() {
  $marca = Get-Date -Format 'yyyy-MM-dd HH'
  if ($script:ultimoCierre -eq $marca) { return }   # una vez por hora, no 120
  $script:ultimoCierre = $marca

  $salida = & node "$Raiz\apps\nodo\jornada.mjs" 2>&1
  if ($salida -match 'CERRADA') { Anota "cierre de jornada: $($salida -join ' | ')" }
}

while ($true) {
  Start-Sleep -Seconds 30
  try {
    $revividos = LevantaLoCaido $true
    foreach ($r in $revividos) { Anota "SE CAYÓ $r -> relevantado" }
    RotaLogs
    DeMadrugada
    CierraElDiaSiToca
  } catch {
    # El vigilante NO se muere pase lo que pase. Si se muriera, el bar se quedaría sin
    # red de seguridad justo cuando más falta hace. Se anota y se sigue dando vueltas.
    Anota "error en la ronda: $($_.Exception.Message)"
  }
}
