# Nodo local — cómo se construye

Todo lo que un **Postgres normal de Windows** necesita para hacer de nodo Gluuh, sin
Docker, sin Supabase y sin Elixir. Ver la arquitectura en
[`docs/plan/10`](../../docs/plan/10-arquitectura-nodo-local-y-nube.md) y la guía en
[`docs/implementacion/16`](../../docs/implementacion/16-nodo-local-y-sincronizacion.md).

**Verificado de punta a punta el 13-07-2026** en Windows, con binarios portables.

## Las tres piezas

| Binario | De dónde sale | Estado |
|---|---|---|
| `postgres.exe` | PostgreSQL 16.4, distribución **portable** (zip de EDB, sin instalador) | ✅ probado |
| `postgrest.exe` | Release **oficial de Windows**: `postgrest-vX-windows-x86-64.zip` | ✅ existe |
| `gotrue.exe` | **Hay que compilarlo**: Supabase no publica binario de Windows. Ver abajo | ✅ compilado y arranca |

**NO se usan**: Supabase Realtime (Elixir) ni Storage. El nodo pone su propio realtime
(`LISTEN/NOTIFY` + WebSocket) y sirve las fotos de una carpeta. Ver plan 10 §3.1.

## 1. `00_bootstrap_nodo.sql` — lo que Supabase regala

**Las migraciones de `supabase/migrations/` NO son autocontenidas.** Dan por hechos
objetos de la *plataforma* Supabase que un PostgreSQL pelado no tiene. Sin este
bootstrap, 5 migraciones petan:

| Falta | Lo necesitan |
|---|---|
| Roles `anon`, `authenticated`, `service_role`, `authenticator` | 41 `GRANT` de las migraciones + PostgREST |
| Esquema `auth`: tabla `auth.users` y función `auth.uid()` | 7 migraciones. **`auth.uid()` es el corazón de la RLS**: `current_tenant_id()` (0002) cae a ella |
| Rol `supabase_auth_admin` | `0011_auth_hook.sql` |
| Publicación `supabase_realtime` | `0006`, `0081`, `0097` |
| Esquema `storage` (stub) | `0010` (bucket `media`). El nodo NO usa Supabase Storage, pero el stub deja que la migración aplique **sin tocarla** |

> El stub de `storage` y la publicación de realtime se crean **aunque el nodo no los
> use**: así las migraciones se aplican **idénticas** en nube y nodo, y los dos esquemas
> convergen. No se bifurca ni una migración.

## 2. Orden de arranque de un nodo nuevo

```
1) initdb                      → clúster Postgres vacío
2) 00_bootstrap_nodo.sql       → roles + auth + publicación + stub de storage
3) gotrue.exe migrate          → GoTrue completa SU esquema en auth.users
4) supabase/migrations/*.sql   → las 98, en orden
5) postgrest.exe + gotrue.exe serve + el proceso Gluuh
```

## 3. Compilar `gotrue.exe` (Supabase no lo publica)

`supabase/auth` es **Go puro** (su Makefile usa `CGO_ENABLED=0`), así que cruza a
Windows sin problema… **salvo una línea**: usa `SO_REUSEPORT`, que **solo existe en
Unix**. La usan para reiniciar sin cortar conexiones; el nodo es un único proceso, así
que no le hace falta.

**El parche está en `parches/`** y es mínimo (2 ficheros nuevos + 3 líneas quitadas):

- `listen_unix.go` (`//go:build !windows`) → el `SO_REUSEPORT` original, movido tal cual
- `listen_windows.go` (`//go:build windows`) → no toca el socket
- `serve_cmd.go.diff` → usa `setReusePort` (la función por plataforma) y quita los
  imports de `syscall` y `golang.org/x/sys/unix`

Receta:

```bash
# 1. Código oficial de Supabase
curl -sL -o auth.zip https://github.com/supabase/auth/archive/refs/tags/v2.192.0.zip
unzip -q auth.zip && cd auth-2.192.0

# 2. Parche de Windows (2 ficheros nuevos + el diff)
cp <repo>/supabase/nodo/parches/listen_unix.go    cmd/
cp <repo>/supabase/nodo/parches/listen_windows.go cmd/
patch -p0 cmd/serve_cmd.go < <repo>/supabase/nodo/parches/serve_cmd.go.diff

# 3. Compilar (Go 1.25+)
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -o gotrue.exe .
```

Resultado: **`gotrue.exe`, 50,5 MB, un solo binario. Arranca en Windows.**

## 4. Resultado del spike (13-07-2026)

| Comprobación | Resultado |
|---|---|
| Las 98 migraciones sobre un Postgres **VACÍO** | ✅ **98/98, cero fallos** |
| Tablas resultantes | **81** (= la nube) |
| Tablas con RLS | **81** (= la nube, ninguna sin proteger) |
| Tablas publicadas en realtime | **7** (= la nube) |
| RPCs críticas (traspaso, dividir, PIN, IVA) | ✅ todas |
| bcrypt (login por PIN) | ✅ funciona |
| `gotrue.exe` en Windows | ✅ compila y arranca |
| `postgrest.exe` en Windows | ✅ binario oficial |

**El nodo reproduce la nube exactamente.** El plan del instalador nativo está demostrado.

---

## El ORDEN de instalación (13-07-2026) — y las dos trampas que esconde

Todo esto está automatizado en **`instalar-nodo.ps1`** (`-Recrear` para rehacerla desde cero).
Se documenta aquí porque el orden **no es el intuitivo** y los dos fallos que provoca
son difíciles de diagnosticar: uno mata el arranque, el otro **no da ningún error**.

```
1) 00_bootstrap_nodo.sql     roles, esquema `auth` VACÍO, pgcrypto, publicación realtime
2) arrancar gotrue.exe       automigrate: crea auth.users, refresh_tokens…
3) 01_despues_de_gotrue.sql  repone auth.uid()/role()/jwt()
4) supabase/migrations/*     las 99; sus FK a auth.users ya resuelven
```

### Trampa 1 — no crees tú `auth.users` (mata el arranque)

Si el bootstrap crea un `auth.users` propio, el `CREATE TABLE IF NOT EXISTS` de GoTrue
lo ve, no lo crea… y acto seguido indexa columnas que tu esbozo no tiene:

```
column "instance_id" does not exist (SQLSTATE 42703)
```

Además GoTrue necesita ser **DUEÑO** del esquema `auth`, no basta con `GRANT`
(sus migraciones hacen `comment on table`, `alter table`…):

```
must be owner of table users (SQLSTATE 42501)
```

Por eso el bootstrap crea el esquema vacío y le traspasa la propiedad.

### Trampa 2 — GoTrue PISA `auth.uid()` (y no da ningún error)

Su migración `00_init_auth_schema` hace:

```sql
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;
```

Eso es la forma **antigua** (`request.jwt.claim.sub`, singular). PostgREST moderno no
publica esa variable: publica `request.jwt.claims` (plural, el JWT entero en JSON).

Resultado si te quedas con la suya: `auth.uid()` → NULL → `current_tenant_id()` → NULL →
**la RLS multi-tenant no devuelve NADA a nadie**. Sin excepción, sin log, sin pista:
solo tablas vacías. Por eso existe `01_despues_de_gotrue.sql`, que la vuelve a poner
bien **después**, y que además falla ruidosamente si no lo consigue.

### Probado de extremo a extremo

| | resultado |
|---|---|
| 99 migraciones sobre Postgres vacío | ✅ |
| tablas / con RLS / en realtime | **80 / 80 / 7** — igual que la nube |
| GoTrue emite JWT y PostgREST lo acepta | ✅ `role=authenticated` |
| el hook 0011 mete `tenant_id` en el token | ✅ |
| **aislamiento multi-tenant real por HTTP** | ✅ **Bar Dos no ve lo de Bar Uno** |

Ojo con una cosa que no es un fallo: desde la migración **0078**, un alta solo crea
empresa si trae `empresa_nombre` en los metadatos (`data` en el body del `/signup`).
Es deliberado — evita que las cuentas de operario y las invitaciones generen
"tenants fantasma".

---

## Apuntar el TPV al nodo

`supabase-js` recibe **una sola URL** y de ahí deriva `/rest/v1`, `/auth/v1`,
`/realtime/v1` y `/storage/v1`. No admite un puerto por servicio. Supabase resuelve
esto con Kong; el nodo lo resuelve con **`apps/nodo/gateway.mjs`** (sin dependencias,
sólo `node:http`), que escucha en **:54321** y reparte:

```
  /rest/v1  → PostgREST :55433
  /auth/v1  → GoTrue    :55434
  /storage/v1, /realtime/v1 → 501 (fase 2)
```

Escucha en `0.0.0.0` a propósito: los demás TPV de la barra entran por la **IP del nodo**.

Las "API keys" de Supabase no son claves opacas: son **JWT firmados con el mismo secreto**
que valida PostgREST, con el `role` dentro. Por eso el nodo puede fabricar las suyas:

```bash
node apps/nodo/claves.mjs "<el-secreto-jwt-del-nodo>"   # imprime anon y service_role
```

Y entonces `apps/web` sólo necesita:

```env
NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.50:54321   # la IP del nodo en la barra
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la anon que imprime claves.mjs>
```

### Probado con la librería de verdad

Con `supabase-js` (la misma que hacen las 617 llamadas del TPV), contra el nodo:

| paso | resultado |
|---|---|
| `auth.signUp` con `empresa_nombre` | ✅ crea tenant, y el JWT trae `tenant_id` |
| `insert` de categoría y producto | ✅ |
| `select` con relación anidada | ✅ |
| `rpc("resolver_iva")` | ✅ **IGIC 7 % en Canarias** |

**Conclusión: el TPV funciona contra el nodo sin cambiar una línea de código.** Sólo la URL.

Un aviso que vale igual para la nube: `category` y `product` tienen **dos** relaciones
(la FK directa y la m2m `product_category` de la 0061), así que un
`.select("nombre, product(...)")` falla con *«more than one relationship was found»*.
Hay que desambiguar por columna: `.select("…, categoria:category_id(nombre)")`.

---

## Realtime del nodo — "pico en el comandero y sale en todos los TPV"

El Realtime de Supabase está escrito en Elixir y no corre nativo en Windows. El nodo trae
el suyo con lo que Postgres ya tiene: **LISTEN/NOTIFY**.

```
  02_realtime_nodo.sql   trigger en cada tabla de la publicación `supabase_realtime`
                         → pg_notify('gluuh_cambios', {tabla, evento, fila})
  apps/nodo/realtime.mjs escucha ese canal y lo reparte por SSE  (:55435)
  gateway.mjs            lo publica en /realtime/v1               (:54321)
  app/lib/cambios.ts     rama SSE cuando NEXT_PUBLIC_NODO_LOCAL=1
```

Las 7 tablas con trigger son **las mismas** que emite la nube (las de la publicación):
`category`, `product`, `family`, `restaurant_table`, `sales_order`, `order_line`, `print_job`.

### Por qué SSE y no WebSocket

- El flujo es de **una sola dirección**: el nodo avisa, el TPV escucha. Un WebSocket
  (bidireccional, con handshake y frames) es pagar por lo que no se usa.
- **`EventSource` se reconecta solo.** En una barra se va el wifi, se reinicia el router,
  se suspende la tablet… y el TPV tiene que volver **sin que nadie mire**. Con WebSocket
  habría que escribir a mano ese bucle de reconexión: justo el código que falla a las
  tres de la mañana de un sábado.
- Viaja por HTTP normal: pasa por el mismo gateway, sin tratos especiales.

### Dos cosas que no pueden fallar (y por qué no fallan)

**Un aviso jamás puede tumbar una venta.** `pg_notify` revienta si el mensaje pasa de
8000 bytes, y ese error **abortaría el INSERT de la comanda**. Por eso el trigger mide el
aviso: si la fila no cabe, manda sólo el `id` y marca `parcial: true` — el cliente ya
pedirá la fila entera. Mejor un viaje de más que una comanda perdida.

**Si se cae Postgres, el realtime se muere a propósito.** Un servicio "vivo" pero mudo es
lo peor que puede pasar: los TPV se creerían conectados y no verían una sola comanda.
`realtime.mjs` hace `process.exit(1)` y deja que el servicio lo levante otra vez.

### Probado

Un TPV escuchando por SSE; el "comandero" abre la Mesa 5, crea el pedido y pica una caña:

```
  INSERT restaurant_table   Mesa 5
  INSERT sales_order        ABIERTA
  INSERT order_line         Cana
```

El segundo TPV se enteró de las tres cosas sin preguntar a nadie. **Sin internet.**

---

## Imágenes: la carta se ve aunque no haya línea

**La mina** (estaba avisada en `branding.ts` y ya está desactivada): la base de datos
guarda **URLs absolutas de la nube** (`https://<proy>.supabase.co/storage/v1/...`). Un TPV
del nodo, sin internet, no puede resolverlas: la carta saldría **sin una sola foto**.

`app/lib/urlFoto.ts` las reescribe al vuelo hacia el nodo, y por él pasan ya **los 17
sitios** que pintan una imagen de Storage (se habían estimado ~8). En la nube es la
identidad: devuelve lo que le des.

```
  apps/nodo/media.mjs              GET  /object/public/media/<ruta>  → sirve del disco
                                   POST /object/media/<ruta>         → guarda + encola
  apps/nodo/descargar-imagenes.mjs baja de Supabase TODA la carta al instalar
  03_media_nodo.sql                la cola de lo que aún no está en la nube
```

### Se guarda la URL de la NUBE, no la del nodo

Aunque la foto se suba al nodo sin internet, en la base de datos se anota la URL **de
Supabase**. Es deliberado: el dato que se sincroniza no puede llevar dentro una dirección
de la red local del bar (que fuera de ese bar no significa nada), y así el dueño ve la
foto desde su casa. Al pintar, `urlFoto()` la redirige al nodo. **Nunca guardar la URL
del nodo en la BD.**

El nodo la deja en `nodo_media_pendiente`; cuando vuelva la conexión, se sube a Supabase,
que es el archivo de verdad — el disco de un mini-PC debajo de una barra no es sitio para
el único ejemplar de nada.

### Probado

| | |
|---|---|
| subir una foto **sin internet** | ✅ |
| verla al instante desde el TPV | ✅ mismos bytes |
| queda en cola para la nube | ✅ |
| **`../../` para leer ficheros del sistema** | ✅ **bloqueado** (404) |

Esa última no es adorno: sin la comprobación de ruta, cualquiera en el wifi del bar podría
pedir `/storage/v1/object/public/media/../../../../Windows/System32/…` y el nodo se lo
serviría.

---

## Arrancar el nodo

```powershell
.\supabase\nodo\instalar-nodo.ps1 -Recrear   # sólo la primera vez (o para rehacerla)
.\supabase\nodo\arrancar-nodo.ps1            # levanta los seis servicios
.\supabase\nodo\arrancar-nodo.ps1 -Parar
```

Al terminar imprime la dirección por la que entran los TPV de la barra:

```
Nodo en marcha. Los TPV de la barra entran por:
    http://172.16.5.8:54321
```

Y en cada terminal, tres variables (ver `.env.example`):

```env
NEXT_PUBLIC_NODO_LOCAL=1
NEXT_PUBLIC_SUPABASE_URL=http://172.16.5.8:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<node apps/nodo/claves.mjs "<secreto>">
NEXT_PUBLIC_SUPABASE_URL_NUBE=https://<proyecto>.supabase.co
```

---

## El panel del servidor y el arranque automático

### `/servidor` — "abrirlo y ver qué lleva creado, cuánto ocupa"

Lo abre quien está **delante del mini-PC de la barra**, no el dueño desde casa: por eso
vive fuera del panel y no pide login. Enseña si los servicios están vivos, qué hay creado
(productos, mesas, pedidos abiertos…), cuánto ocupa y qué falta por poner a salvo en la
nube. **Ni una sola venta, ni un secreto** — sólo recuentos.

Los datos salen de `/nodo/estado` (en `apps/nodo/estado.mjs`, servido por el gateway).

Si el nodo no contesta, la pantalla lo dice **grande y en rojo**: es justo el momento en
que alguien está mirando porque algo va mal.

### Que arranque solo y no se cierre nunca

```powershell
.\supabase\nodo\servicio-windows.ps1 -Instalar   # como Administrador
.\supabase\nodo\servicio-windows.ps1 -Estado
.\supabase\nodo\servicio-windows.ps1 -Quitar
```

**Por qué una tarea programada y no un servicio de Windows "de verdad":** un servicio
nativo exige un ejecutable que hable el protocolo del Service Control Manager. Node y
PostgREST no lo hablan, así que haría falta un envoltorio (NSSM, WinSW…): **un binario más
que descargar, firmar, actualizar y explicar**. Una tarea al arranque hace exactamente lo
mismo —se levanta sin que nadie inicie sesión, y Windows la reintenta cada minuto si se
cae— y **viene dentro de Windows**. Menos piezas que romper en un bar donde nadie va a
depurar nada.

Se dispara **al encender el ordenador** (no al iniciar sesión) y corre como SYSTEM: el bar
enciende el mini-PC y ya está, aunque nadie toque el teclado.

---

## Sincronizador nodo → nube

```powershell
node apps/nodo/sincronizar.mjs           # un pase (instalador, o a mano)
node apps/nodo/sincronizar.mjs --bucle   # de servicio, cada 5 min (lo arranca el nodo)
```

Credenciales en **`.nodo/sync.env`** (fuera de git, **nunca en el código**). Si el fichero
no está, el nodo arranca igual y el bar vende, cobra e imprime: simplemente no sube nada.

### Dos reglas que mandan sobre todo lo demás

**1. Una sola dirección para lo operativo y lo fiscal: nodo → nube.** Lo que pasa en el
bar nace en el bar, y el bar tiene la razón. La nube no puede reescribir una venta.

**2. Reenviar no puede duplicar.** Si se corta la línea a mitad, el siguiente pase repite
ese trozo. Cada fila operativa lleva `client_id` (un UUID que pone el TPV) y todo sube con
`on_conflict`, así que la misma venta dos veces sigue siendo **una** venta. Un cobro
duplicado en la contabilidad de un cliente es inaceptable.

Probado: venta cerrada en el nodo → **dos pases seguidos** → en la nube aparece **una vez**.

### Sólo se suben las cuentas CERRADAS (y es la decisión, no una limitación)

Una cuenta abierta cambia de líneas continuamente (el TPV las reemplaza borrando e
insertando), y el sincronizador **no sabe propagar borrados**: una línea quitada en el
nodo viviría para siempre en la nube y el dueño vería desde casa un ticket con cosas que
nadie se comió. Un ticket cerrado ya no cambia nunca — subiendo sólo esos, el problema
desaparece de raíz. Y lo que el dueño quiere ver desde casa son las ventas hechas, no lo
que hay a medias en la mesa 4.

### Tres cosas que costaron encontrar

- **El índice único es COMPUESTO**: `(tenant_id, client_id)`. Con `on_conflict=client_id`
  a secas, PostgREST responde *«no unique or exclusion constraint matching»*.
- **Las marcas de tiempo, en TEXTO.** Postgres guarda microsegundos; el `Date` de
  JavaScript sólo llega al milisegundo. Dejando convertir al driver, la marca de agua se
  queda un pelo por detrás y **la última fila se reenvía en cada pase, para siempre**. No
  duplicaba (el `on_conflict` lo impide), pero era tráfico regalado en un bar con mala línea.
- **El error viejo se quedaba pegado.** La marca de error sólo se limpiaba al subir filas,
  así que con 0 filas persistía y el panel decía *«4 tablas fallaron, avisa al soporte»*
  con todo funcionando. Una alarma que miente se acaba ignorando — justo el día que sea
  de verdad.

### Sin internet no es un error

Si la nube no contesta, el sincronizador **se calla y vuelve luego**. Que no haya línea un
martes no es una avería: el bar sigue vendiendo, que es lo único que no puede parar. Y el
bucle no muere pase lo que pase — un sincronizador que se rinde deja las ventas
encerradas en el bar.

El panel `/servidor` lo enseña: **lo que aún no está en la nube sólo existe en ese
ordenador**. Si se muere ahora, se pierde.

---

## Actualizar los nodos desde la nube

```powershell
# Nosotros, al publicar una versión:
node apps/nodo/publicar.mjs 1.1.0 "Arregla el redondeo del IGIC"

# El nodo, solo, cada pocos minutos:
node apps/nodo/actualizar.mjs            # mira y actualiza
node apps/nodo/actualizar.mjs --revisar  # sólo mira; no toca nada
```

La nube tiene el tablón (`nodo_release`, migración 0100). Cada nodo mira si hay algo más
nuevo que lo suyo, se lo baja, **comprueba que no viene manipulado**, lo aplica y se
reinicia.

### Cómo se hace sin romper el bar

- **El `sha256` se comprueba SIEMPRE.** Si el zip descargado no cuadra con el hash
  publicado, **no se instala**. Un TPV que acepta cualquier binario que le mandan es una
  puerta abierta a la caja del bar. *(Probado: falseando el hash, el nodo se planta.)*
- **No se actualiza con el bar trabajando.** Si hay cuentas abiertas o una caja sin
  cerrar, lo dice y espera. Reiniciar los servicios en plena comanda es tirarle el TPV al
  camarero. *(Probado: con 3 mesas abiertas, se niega.)*
- **Copia de seguridad antes de tocar nada.** Si algo falla, vuelve atrás y levanta el
  nodo. *(Durante el desarrollo saltó **tres veces** y el bar volvió entero cada una.)*
- **Sin internet no pasa nada:** el bar sigue con la versión que tiene, que funciona.

### Cuatro cosas que costaron encontrar (todas reventaban la actualización)

1. **La base de datos NO se puede parar.** Parar "el nodo" paraba también Postgres, y las
   migraciones se aplicaban contra una base apagada. Por eso existe `-MantenerBd`.
2. **Las migraciones NO son idempotentes.** El comentario decía que sí; era mentira:
   `0001_init.sql` hace `create table tenant` sin `if not exists`. Reaplicarlas todas
   revienta con *«relation "tenant" already exists»* y **ningún bar se actualizaría
   jamás**. Ahora se lleva la cuenta en `nodo_migracion` y sólo se pasan las nuevas.
3. **psql supone WIN1252.** En un Windows español, y nuestras migraciones son UTF-8
   llenas de tildes → *«character with byte sequence 0x8d … has no equivalent in UTF8»*.
   Se arregla con `PGCLIENTENCODING=UTF8`.
4. **`Compress-Archive -Path apps\nodo`** mete la carpeta como `nodo/` en la raíz del zip,
   no como `apps/nodo/`. Al descomprimir habría aparecido un `<raiz>\nodo` suelto y el
   nodo se habría quedado con el código viejo **sin un solo error**.

### Y un bug de arranque que habría matado el nodo cada mañana

`pg_ctl start` sin `-o "-p 55432"` levanta Postgres en el **5432** (el de
`postgresql.conf`), mientras PostgREST y GoTrue le hablan al 55432 → el nodo arranca
"vivo" pero mudo. Sólo parecía funcionar porque había una instancia levantada a mano con
el puerto bueno. Además, `arrancar-nodo.ps1` **espera a que Postgres conteste**
(`pg_isready`), no a un `Start-Sleep`: en un mini-PC arrancando por la mañana, Postgres
tarda más de tres segundos y los demás servicios morían con *connection refused*.

---

## Provisionar: bajarse el bar de la nube

Es el **primer paso** de una instalación real y **el único que necesita internet**. Sin
esto el nodo nace vacío: sin carta, sin mesas, sin empleados. Y lo que vendiera **no
podría subir nunca**, porque en la nube ni siquiera existiría el `tenant`.

```powershell
node apps/nodo/provisionar.mjs --listar        # ¿qué bares hay?
node apps/nodo/provisionar.mjs <tenant-id>     # bájate ese
node apps/nodo/descargar-imagenes.mjs          # y sus fotos
```

Baja **catálogo y configuración** (carta, salas, mesas, empleados, tarifas, impuestos,
plano…). **NO baja ventas, ni caja, ni facturas**: eso nace en el bar y el bar tiene la
razón — bajarlas sería invitar a que la nube pisara una venta.

El **orden** lo deduce del propio esquema (un orden topológico de las claves foráneas),
no de una lista escrita a mano que se quedaría vieja en cuanto alguien añada una tabla.

### Tres trampas que costaron encontrar

**1. Los `auth_user_id` de la nube NO valen en el nodo — y esto tumbaba el login.**
El nodo tiene su propio GoTrue. Al entrar un camarero, `/api/entrar-operario` ve que el
operario ya tiene `auth_user_id`, hace `updateUserById(ese-id)` contra el GoTrue del
nodo… y recibe *«user not found»*. **Nadie podría entrar al TPV.** Al provisionar se
vacían: la primera vez que entre cada camarero, se le crea la cuenta aquí.

**2. No todas las tablas tienen `id`.** `tenant_branding` va por `tenant_id` y las tablas
de unión tienen clave compuesta. Exigiendo `id` se saltaban en silencio y el bar se
quedaba **sin logo ni colores** y sin la mitad de las relaciones de la carta. Ahora se usa
la clave primaria de verdad, la que diga el esquema.

**3. `tenant` no tiene columna `tenant_id`** (ella *es* el bar), así que el filtro no le
aplicaba y se bajaban **todos los bares de la nube** al nodo de uno solo.

Y un detalle del driver: un `text[]` de Postgres (`product.alergenos`) y un JSON que
casualmente es una lista **se ven idénticos desde JavaScript**. Hay que preguntarle al
esquema de qué tipo es cada columna, o Postgres responde *«malformed array literal»*.

### El TPV contra el nodo: la clave secreta también es la del NODO

En `apps/web/.env.local`, `SUPABASE_SECRET_KEY` **no es la de Supabase** (`sb_secret_…`):
es la `service_role` **del nodo** (la segunda que imprime `claves.mjs`).

`/api/entrar-operario` la usa contra `NEXT_PUBLIC_SUPABASE_URL`, que en modo nodo **es el
nodo**. Con la clave de la nube ahí, el nodo la rechaza y **ningún camarero entra**. Es el
error fácil de cometer y el más caro de diagnosticar.

Probado: crear la cuenta del operario en el GoTrue del nodo → iniciar sesión → pedir
datos. Y la RLS sigue viva: un operario sin bar asignado **no ve nada**.

---

## El vigilante, los secretos, y cuatro trampas de PowerShell

### `-Vigilar`: lo que hace verdad el "nunca cerrándose"

```powershell
.\arrancar-nodo.ps1 -Vigilar   # arranca Y SE QUEDA vigilando (es lo que corre en el bar)
```

La tarea programada reiniciaba **el script**, pero el script arrancaba los servicios y
**terminaba**: los hijos quedaban huérfanos. Un PostgREST muerto a las 15:00 de un martes
seguía muerto **hasta el siguiente reinicio del ordenador**.

Ahora el script se queda dando vueltas: cada 30 s comprueba cada servicio y **relevanta
sólo al caído**, y rota los logs (>10 MB) para que no llenen el disco de un mini-PC — un
disco lleno es una base de datos que no puede escribir, o sea un bar que no cobra.

Probado a lo bruto (`apps/nodo/pruebas/prueba-vigilante.ps1`): se mata PostgREST y **vuelve
solo en 35 s, sirviendo datos**.

### Cuatro trampas de PowerShell que costaron encontrar

**1. Los `.ps1` se leen como ANSI si no llevan BOM.** El proyecto es en español, así que
están llenos de acentos: sin BOM, PowerShell 5.1 los mal-decodifica y **rompe el
intérprete**. Una flecha `→` en una cadena tumbó el vigilante entero. *Todos los `.ps1` de
este repo van en UTF-8 **con BOM**.*

**2. `& pg_ctl … | Out-Null` cuelga para siempre.** `pg_ctl start` deja corriendo el
servidor Postgres, que **hereda la salida** y la mantiene abierta de por vida; PowerShell
espera a que se cierre la tubería y nunca se cierra.

**3. `Start-Process -Wait` tampoco vale**: espera al proceso **y a sus descendientes**.
`pg_ctl` termina, pero deja `postgres.exe`… que no termina nunca.
→ **Arrancar y soltar** (`Start-Process` sin `-Wait`), y sondear con `pg_isready`.

Las dos colgaban justo donde más duele: la tarea programada corre **sin consola**, así que
el vigilante se habría quedado clavado sin vigilar nada, para siempre.

**4. `$args` es una variable automática.** Usarla como parámetro de función la pisa.

Y una de propina: `-Parar` mata **primero al vigilante** (vive en `powershell.exe`, no en
`node.exe`). Sin eso, paraba los servicios y el vigilante los relevantaba 30 s después:
un nodo imposible de apagar.

### Cada bar, sus propias claves

El instalador genera **secreto JWT y contraseñas de Postgres aleatorios en cada
instalación**. Antes todos los nodos compartían los de desarrollo… que están en este
repositorio y en el manual: cualquiera que los leyera podía firmar un token de
`service_role` válido para **cualquier nodo al que alcanzara por red** —el wifi del bar,
un portátil en la terraza— y saltarse toda su RLS.

Probado (`prueba-secretos.ps1`): con la clave del bar, **HTTP 200**; con la del manual,
**HTTP 401 — firma inválida**.

El secreto de cada nodo queda en `.nodo/nodo.env`, y la clave `anon` que necesitan los TPV
se imprime en `INSTALACION.txt`.

> La contraseña del superusuario `postgres` sigue siendo fija, a propósito: la base de
> datos **sólo escucha en 127.0.0.1** y no es alcanzable desde la red del bar.

---

## GoTrue se fue del nodo

El nodo **firma sus propios tokens** (`apps/nodo/auth.mjs`, ~230 líneas). En la nube no
cambia nada: allí GoTrue es el de Supabase y lo mantienen ellos.

### Qué hacía GoTrue aquí, de verdad: nada de autenticar

El PIN del camarero **ya lo validábamos nosotros** contra `app_user.clave_hash` (bcrypt,
en la RPC `verificar_clave_operario`). Lo único que hacía GoTrue era **firmar** el JWT — y
para conseguir esa firma le montábamos una pantomima: **crearle un usuario falso con una
contraseña aleatoria** y hacer login con él.

### Lo que costaba ese notario

| | |
|---|---|
| `gotrue.exe` | **50,5 MB** |
| el fork de Go parcheado a mano | 5 MB — SO_REUSEPORT no existe en Windows, así que lo parcheamos y compilamos **nosotros**. Cada aviso de seguridad de Supabase = re-parchear y recompilar. **Para siempre** |
| el toolchain de Go para compilarlo | **1,3 GB** |
| las dos trampas del orden de instalación | existían **sólo** por él |
| un proceso más que vigilar | y su fichero de configuración |
| el bug del dueño | **no podía entrar al panel local sin internet** |

Y un detalle que habría roto el instalador en casa del cliente: `GOTRUE_DB_MIGRATIONS_PATH`
apunta a `./auth-src/migrations`, o sea que el `.exe` tendría que empaquetar **las
migraciones del código fuente de Go**.

### Qué lo sustituye

Las **cuatro rutas** que `supabase-js` llama de verdad (medidas en el código):

```
  POST /auth/v1/token?grant_type=password        entrar
  POST /auth/v1/token?grant_type=refresh_token   renovar (el token dura 1 h)
  GET  /auth/v1/user                             ¿quién soy?
  POST /auth/v1/logout                           salir
```

Más `POST /auth/v1/vale`, que sustituye a `admin.createUser`: `/api/entrar-operario` valida
el PIN y pide un **vale de un solo uso** (2 minutos) que el navegador canjea por una
sesión. **El contrato con el navegador no cambia**: sigue llamando a `signInWithPassword`.

**PostgREST no nota la diferencia**: mismo secreto, mismo formato, mismos claims
(`tenant_id`, `user_rol` — los que ponía el hook 0011). La RLS no se toca.

Lo que **no** inventamos, que es casi todo: el hash de contraseñas lo hace **bcrypt en
Postgres**, la autorización la hace **la RLS**, y el JWT es **HS256 estándar**. Lo que
escribimos es *comprobar una clave, firmar, y rotar el refresco*.

### Y el dueño ya puede entrar sin internet

Su contraseña vivía **sólo en el GoTrue de la nube**, así que no podía abrir el panel de su
propio bar sin línea: ni para cambiar un precio ni para ver la caja. Ahora vive también
aquí, en `app_user.password_hash` — **una columna que existía y no usaba nadie** — y la
siembra el instalador, que ya le pide la contraseña al titular.

### El zombi que casi se cuela

Un nodo que se **actualiza** tiene el GoTrue viejo corriendo. Si no se le mata, se queda
ocupando el **:55434**, contesta al chequeo de salud tan campante (el vigilante lo da por
vivo) y **nuestro firmador no puede arrancar nunca**: el bar se quedaría con el auth de
antes para siempre. Por eso `-Parar` lo entierra y el chequeo comprueba **quién** contesta
(`name == "nodo-auth"`), no sólo *que* contesta.

### Las dos trampas, muertas

`00_bootstrap_nodo.sql` vuelve a crear `auth.users` y `auth.uid()` **como debe ser**, y ya
no hay nadie que las pise. El instalador pasó de **6 pasos a 4**, y `01_despues_de_gotrue.sql`
—que existía sólo para reparar lo que GoTrue rompía— **se ha borrado**.
