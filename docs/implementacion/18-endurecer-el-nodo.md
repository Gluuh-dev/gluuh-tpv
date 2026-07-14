# 18 — Endurecer el nodo (guía ejecutable de plan/12)

Los arreglos de la auditoría `plan/12`, en orden, con ficheros y criterio de aceptación.
Cada bloque es una sesión de trabajo autocontenida.

---

## Bloque 1 · Corrección inmediata (A1 + A2 + A5) — una tarde

### 1a · Subir el desglose fiscal y los registros VERIFACTU (A1)

**Tocar**: `apps/nodo/sincronizar.mjs` → añadir a `TABLAS`, en este orden (después de
`invoice`, sus hijas):

```js
{ nombre: "invoice_tax_line", conflicto: "id", tiempo: "created_at" },
{ nombre: "verifactu_record", conflicto: "id", tiempo: "created_at" },
```

**Ojo**: comprobar antes en el nodo que ambas tienen `created_at` (si `verifactu_record`
usa otro nombre —`fecha_hora_gen`—, usar ese como `tiempo`).

**Aceptación**: cobrar una venta con factura en el nodo → `sincronizar` → en la nube
existen la factura, **sus líneas de impuesto** y **su registro de huella**. Dos pases →
sin duplicados.

### 1b · El vigilante (A2)

**Tocar**: `supabase/nodo/arrancar-nodo.ps1` (nuevo parámetro `-Vigilar`) y
`servicio-windows.ps1` (la tarea pasa a lanzar `-Vigilar`).

Esqueleto del bucle:

```powershell
if ($Vigilar) {
  while ($true) {
    # cada servicio: ¿responde? si no → relanzar SOLO ese (reusar la lógica de arranque)
    #   Postgres  → pg_isready
    #   PostgREST → GET :55433/   GoTrue/token → :55434/health
    #   realtime  → GET :55435/cambios (cabecera)   media → :55436   gateway → :54321/nodo/estado
    #   sync      → ¿existe el proceso con sincronizar.mjs --bucle?
    # rotar logs > 10 MB (truncar conservando las últimas ~200 líneas)
    Start-Sleep -Seconds 30
  }
}
```

**Aceptación**: con el nodo en marcha, matar `postgrest` a mano → en <60 s vuelve solo.
Matar el vigilante → la tarea programada lo reinicia (RestartCount ya está).

### 1c · Secretos por instalación (A5)

**Tocar**: `supabase/nodo/Instalar-Gluuh.ps1` — al principio de "Manos a la obra":

- generar `$jwt = base64(RandomBytes 48)` y `$pgpass = base64(RandomBytes 24)`
- escribirlos en: `postgrest.conf` (jwt-secret, db-uri), `sync.env`, y donde el token
  local firme (tras B1, el gateway; hasta entonces `gotrue.env`)
- `ALTER ROLE postgres/authenticator PASSWORD` tras el initdb
- derivar `anon`/`service` con `claves.mjs $jwt` y dejarlas en la config que servirá el
  nodo a los TPV (`/nodo/config`, ver bloque 3)

**Aceptación**: dos instalaciones en dos máquinas → secretos distintos; el manual deja de
mostrar un secreto que funcione en ningún bar real.

---

## Bloque 2 · Quitar GoTrue del nodo (B1, con B2 y B3.2 de paso) — 1-2 días

### 2a · El endpoint de tokens en el gateway

**Nuevo**: `apps/nodo/auth.mjs`, montado por `gateway.mjs` en `/auth/v1/*` (sustituye la
ruta al puerto 55434).

Contrato mínimo que `supabase-js` usa (verificado en las pruebas e2e):

| ruta | hace |
|---|---|
| `POST /token?grant_type=password` | valida contra `app_user` (email+clave del dueño **o** usuario+PIN de operario vía `verificar_clave_operario`); acuña `access_token` (claims: `sub`, `role=authenticated`, `tenant_id`, `user_rol`, `exp` 1 h) + `refresh_token` opaco en `nodo_sesion` |
| `POST /token?grant_type=refresh_token` | rota el refresh (borra el viejo, emite nuevo) |
| `GET /user` | devuelve el usuario del JWT (id, email) |
| `POST /logout` | borra la sesión |

**Nuevo SQL**: `supabase/nodo/06_auth_nodo.sql` — tabla `nodo_sesion(refresh_token pk,
app_user_id, creado_at, usado_at)` + índice. `/api/entrar-operario` en modo nodo deja de
llamar a `admin.createUser`: el grant password ya resuelve.

### 2b · Desmontar

- `instalar-nodo.ps1`: fuera pasos 2 y 3 (GoTrue + reparar `auth.uid()`); el bootstrap
  vuelve a crear `auth.users` mínima + `auth.uid()/role()/jwt()` — **y ya nadie las pisa**.
- fuera: `gotrue.env`, `bin/gotrue.exe` del paquete, `01_despues_de_gotrue.sql` (se
  conserva como histórico con nota), parches de `supabase/nodo/parches/` (histórico).
- `arrancar-nodo.ps1` y el vigilante: quitar el servicio GoTrue.
- B2: mover `media.mjs` y `estado.mjs` dentro de `gateway.mjs` (7 → 4 procesos:
  postgres, postgrest, gateway, realtime + el bucle de sync).
- B3.2: `actualizar.mjs` se copia a `.nodo/tmp/` y se re-ejecuta desde allí antes de
  descomprimir nada.

### 2c · Aceptación (las pruebas ya existen)

`apps/nodo/pruebas/` debe pasar entera contra el nodo sin GoTrue:

- `prueba-login.mjs` (operario entra, RLS viva)
- `prueba-e2e.ps1` (dos bares aislados)
- `prueba-supabasejs.mjs` (signUp se sustituye por grant password del dueño)
- **nueva**: el dueño entra al panel local por email (A4 resuelto)
- rotación del refresh: dos refresh seguidos con el mismo token → el segundo falla

---

## Bloque 3 · Servir la web + config en tiempo de ejecución — prepara el instalador TPV

(el "siguiente paso" ya decidido en plan/11 §10; aquí solo lo que toca al nodo)

- `next build` standalone de `apps/web` empaquetado en el release; el gateway proxya `/`
  al servidor Next local (o Next escucha y el gateway solo enruta `/rest|/auth|/realtime|/storage|/nodo`).
- **`GET /nodo/config`** (público, mismo origen): `{ url: origin, anonKey, urlNube }` —
  el cliente (`supabaseBrowser`) lo lee al arrancar en modo nodo. Así **ninguna**
  `NEXT_PUBLIC_*` por bar: una sola build para todos los nodos.
- El release del actualizador pasa a incluir la web (B3.1) — sha256 del conjunto.

**Aceptación**: un TPV virgen abre `http://<ip>:54321`, hace login de operario y cobra,
**sin ningún fichero de configuración en la terminal**.

---

## ✅ Bloque 4 · El catálogo en las dos direcciones + copia + reloj (A3 + C1 + C2) — HECHO

**Probado contra el nodo y la nube de verdad**: `node apps/nodo/pruebas/prueba-catalogo.mjs`
(7 comprobaciones, todas pasan).

Antes de poder escribir una sola línea de sincronización hubo que abrir un agujero de
diseño: **la mayoría de las tablas de catálogo no tenían `updated_at`** (`family`,
`modifier`, `product_price`, `product_format`, `room`, `tarifa`, `menu`, `printer`,
`payment_method`, `plano_elemento`…). Sin saber cuándo se tocó una fila, no hay forma de
saber quién gana — y esto era **literalmente imposible de construir**. Lo arregla la
migración **`0101`**, por descubrimiento (cualquier tabla de negocio con `tenant_id` que no
lo tenga lo recibe, con su trigger y su índice): **49 tablas**.

Lo que se hizo:

- **`0101`** — `updated_at` en todo el catálogo, y `set_updated_at()` reescrito.
- **`apps/nodo/espejo.mjs`** — el espejo, que estaba duplicado en `provisionar.mjs`: orden
  topológico por claves foráneas, PK reales, tipos por columna, `meterFilas`.
- **`sincronizarCatalogo`** en `sincronizar.mjs` — LWW en las dos direcciones + propagación
  de borrados con **tres cerrojos**.
- **`copia.mjs`** — `pg_dump -Fc` nocturno, 7 días, escrito a `.parcial` y renombrado al
  final (un backup a medias que *parece* entero es peor que ninguno).
- **`reloj.mjs`** — deriva contra la nube, descontando la mitad del viaje de red.
- Los dos los lanza el vigilante a las 04:30, y se ven en **`/servidor`**.

### Las cuatro trampas (cada una habría sido un fallo mudo en producción)

1. **PING-PONG INFINITO.** `set_updated_at()` ponía `now()` en cada UPDATE. Una fila bajada
   de la nube quedaba, aquí, *más nueva que la de la nube* → el nodo se la volvía a subir →
   la nube la volvía a marcar → para siempre, con la carta recargándose en los TPV cada
   cinco minutos delante de los clientes. Ahora el trigger **respeta la fecha que trae la
   fila, pero sólo si va hacia adelante**.

2. **LA FECHA CONGELADA.** Varios formularios del panel hacen `select *` y luego
   `upsert({...fila})`: **arrastran el `updated_at` viejo sin querer**. Si el trigger
   respetara cualquier fecha, la fila se quedaría clavada en el pasado y el bar no vería el
   cambio jamás. De ahí el «sólo hacia adelante».

3. **DOS FECHAS QUE SON LA MISMA Y NO SE PARECEN.** Postgres da
   `2026-07-14 10:48:34+02`; PostgREST da `2026-07-14T08:48:34+00:00`. Comparadas como
   texto, **el espacio (0x20) es menor que la 'T' (0x54)**: la fila del bar *siempre*
   parecía más vieja que la de la nube. Consecuencia: **el bar no podía subir un cambio de
   carta nunca**. Se comparan como instantes (`instante()`).

4. **EL `auth_user_id` QUE BORRA AL DUEÑO.** El espejo pone `auth_user_id` a null (las
   cuentas de la nube no existen en el nodo). Si esa fila subiera tal cual, **dejaría a
   null el de la nube y el dueño no podría volver a entrar en el panel desde casa**. De ahí
   `NO_SUBIR_COLUMNAS`.

### Los tres cerrojos de los borrados

Ninguna tabla tiene `deleted_at`: en la nube se borra de verdad, así que hay que comparar
las claves. Y **una lista mal leída borra el bar entero**:

1. La nube devuelve 5000+ filas → puede venir **cortada** → no se borra nada, y se dice.
2. La nube dice que la tabla está **vacía** y aquí hay cosas → casi seguro es un fallo (un
   token de otra empresa, la RLS callada) → no se borra nada.
3. La fila **acaba de subir en este mismo pase** → no está borrada, está llegando. Sin
   esto, el producto que el dueño crea en la barra sin internet **se borraría solo**.

### Y de paso

- `order_event` (quién anuló qué) **es operativo, no catálogo** — no estaba en `NO_BAJAR`,
  así que se habría intentado subir eventos de mesas abiertas y la clave foránea los habría
  rechazado. Ahora sube por el camino operativo, con el mismo filtro que las líneas.
- `06_auth_nodo.sql` **no se reaplicaba al actualizar**: un arreglo en las funciones de
  entrada del dueño se publicaba… y no llegaba nunca al bar.
- `/servidor` leía `process.env.NEXT_PUBLIC_SUPABASE_URL`: **le preguntaba a la nube por el
  estado del nodo**. Decía «el nodo no responde» con el nodo vivo delante.

---

## ✅ Bloque 5a · Dinero concurrente (C3 + C4) — HECHO

Probado contra el nodo real: `prueba-dos-camareros.mjs` (7/7) y
`prueba-facturas-a-la-vez.mjs` (5/5, seis cobros **simultáneos**).

### C3 · Dos camareros, la misma mesa (migración `0102`)

Ana y Berto abren la mesa 5 en dos TPV. Ana añade una tortilla y guarda. Berto añade un
vino y guarda: manda **su** foto de la mesa (2 cañas + vino) y **la tortilla desaparece**.
Sin un error. El cliente se la come, no la paga, y el arqueo no cuadra por 8 €. Nadie sabría
nunca por qué.

- `guardar_cuenta(p_order_id, p_lineas, p_cuenta, p_version)` — cabecera **y** líneas en una
  transacción, con `for update` y control optimista por `updated_at`. Si la versión no
  coincide: `GLU01` y **no se toca nada**.
- El TPV guarda la versión al abrir la cuenta (`tomarCuenta`, la **única** puerta) y la
  refresca en cada guardado. En conflicto: avisa y **recarga la mesa**.
- Se fue `reemplazar_lineas_orden`, y con ella **el camino de degradación**: si el RPC
  fallaba, el TPV caía a un `delete` + `insert` a pelo — *exactamente* la pérdida de líneas
  que el RPC venía a evitar.

> La comprobación nº 4 de la prueba es la que importa: **un camarero puede guardar dos veces
> seguidas**. Un control de concurrencia que hace chocar al TPV consigo mismo es un candado
> que no deja cobrar — peor que el fallo que arregla.

### C4 · Seis cobros a la vez y la cadena de VERIFACTU

`UNIQUE (tenant_id, serie, numero)` ya impedía duplicar el número (esa restricción **es** la
garantía). Y el que choca vuelve a leer, ve la factura que acaba de entrar **con su huella**,
y encadena la suya detrás: la cadena no se bifurca. Lo que estaba mal era el número de
intentos: **uno**. Con cuatro TPV en el pico de un sábado, eso deja un cobro tirado en la
cara del camarero. Ahora insiste (6 intentos, espera desigual) y detecta la colisión por el
**código 23505**, no buscando la palabra «unique» en un texto que Postgres puede traducir.

### 🔴 Y lo que apareció al probarlo: **el nodo no podía cobrar**

Las rutas de API construían su cliente con `NEXT_PUBLIC_SUPABASE_URL` — la dirección de **la
nube**, incrustada al compilar. Dentro del nodo:

- **`/api/ticket`** validaba la sesión **contra la nube**, con un token firmado por el
  **nodo**. La nube lo rechaza (no es su firma) → 401 → «No se pudo calcular el ticket. No se
  ha cobrado nada.» Y `cobrar()` llama a esa ruta **antes de tocar nada**. O sea: **un bar
  con nodo no podía cobrar desde el TPV.** Ni sin internet (no llega), ni con él (lo
  rechazan).
- **`/api/factura`** pedía el local a la nube → «Tenant no encontrado» → **VERIFACTU era
  imposible en un nodo**. Justo donde la ley obliga a emitir.

No lo pilló ninguna prueba porque **todas escriben en la base directamente**: ninguna pasaba
por donde pasa un camarero al darle a Cobrar.

Arreglado en la raíz: `apps/web/app/lib/supabaseServidor.ts` — una sola puerta
(`comoElLlamante`, `comoElServicio`, `quienLlama`) que resuelve contra quién hablar. La usan
`factura`, `ticket`, `verifactu/verificar`, `dispositivos/generar`, `dispositivos/canjear` y
`entrar-operario` (que era la única que lo hacía bien, a mano — y dos formas de resolver lo
mismo acaban separándose).

---

## ✅ Bloque 5b · LA JORNADA (plan/11 §11) — HECHO

Probado: `node apps/nodo/pruebas/prueba-jornada.mjs` (14/14). Migración **`0103`**.

### Las cañas de la 1:30

Un bar cierra el viernes a las 2 de la mañana. Las últimas cañas se cobran a la 1:30. Para
el **calendario** esa venta es del sábado; para el **bar** es del viernes — la noche del
viernes, la caja del viernes, el turno del viernes.

`/ventas-diarias` agrupaba por `created_at.slice(0, 10)`. O sea que **el cierre de todos los
fines de semana estaba mal**: parte de la noche del viernes contaba como sábado. El dueño
cuadraba la caja a mano cada lunes sin entender por qué le bailaban cien euros.

No era un problema de informes: **faltaba el concepto**. La venta pertenece a la **jornada**
en la que se cobra, y la jornada la abre y la cierra el bar — no la medianoche.

### Qué hay

- **`jornada`** — correlativa por local (el encargado dice «la jornada 412»), con el Z
  congelado al cerrar, el arqueo y las mesas que quedaron abiertas.
- **`sales_order.jornada_id`**, asignado por un **trigger**, no desde el TPV: por ahí pasan
  el TPV, el kiosko, el comandero y los pedidos web. Si dependiera de que cada uno se
  acuerde, el primero que se olvide deja ventas **huérfanas** — y esas no salen en ningún
  cierre. Nadie las echa de menos hasta que falta el dinero.
- **`jornada_abierta(local)`** con `pg_advisory_xact_lock` — dos camareros que abren la
  primera mesa del día en el mismo instante **no crean dos jornadas** (la noche se partiría
  en dos y no cuadraría ningún informe). Un índice único parcial lo remata.
- **`z_de_jornada`** — tickets, cobrado, ticket medio, por método, impuestos, invitaciones y
  autoconsumo **aparte** (no son venta), anuladas, facturas y mesas abiertas.
- **`cerrar_jornada`** — congela el Z, guarda el **recuento de efectivo** y calcula el
  **descuadre**. Cerrar dos veces se rechaza (`GLU04`): reescribiría un cierre ya declarado.
- **Botón «Cerrar día (Z)»** en Utilidades + `CerrarDiaModal` (Z, mesas abiertas, arqueo con
  la diferencia en la cara).
- **Cierre automático de respaldo** (`apps/nodo/jornada.mjs`, desde el vigilante): a la hora
  configurada (06:00 por defecto), si sigue abierta, la cierra como `AUTOMATICO` **con el
  arqueo pendiente** — nadie contó la caja, y eso hay que decirlo al abrir.
- **`/ventas-diarias` agrupa por jornada** y avisa de las jornadas **sin arquear**.

### Las mesas abiertas NO se tocan

Si a las 6 de la mañana quedan 2 mesas abiertas, el nodo **no las cobra ni las anula**. Las
deja, y su venta contará en la jornada en la que se cobre de verdad. La jornada se cierra
con lo **cobrado**; lo pendiente no se inventa.

Con VERIFACTU delante, fabricar cobros o anulaciones de ventas que nadie ha confirmado es
**firmar ante Hacienda algo que no ha pasado**. El Z deja constancia («quedaron 2 mesas
abiertas») y ya está.

### Y dos cosas que aparecieron al probarlo

- **El arqueo iba a `cash_move`, y ahí no cabe**: esa tabla cuelga de una `cash_session` que
  puede no estar abierta, no tiene `location_id` ni `user_id`, y su `check` sólo admite
  `ENTRADA`/`SALIDA`. **El recuento se habría perdido en silencio.** Vive en la `jornada`,
  que es de quien es.
- **`create table if not exists` no añade columnas a una tabla que ya está.** Una migración
  que sólo funciona sobre una base virgen falla exactamente donde importa: un bar en marcha.

---

## 🔴 Y la regla de despliegue, mordiendo de verdad

Al aplicar la `0103` en el nodo (y no en la nube), el bar **dejó de subir sus ventas**:

```
sales_order  FALLÓ — HTTP 400 PGRST204
  «Could not find the 'jornada_id' column of 'sales_order' in the schema cache»
```

El nodo sube con `select *`. Una columna que la nube no tiene → 400 → **el dinero se queda
encerrado en el mini-PC de la barra** hasta que alguien lo mire.

La regla sigue siendo **«la nube se migra ANTES que los nodos»**. Pero un error de orden no
puede costarle a un bar sus ventas: ahora el nodo **le pregunta a la nube qué columnas
tiene** (la raíz de PostgREST devuelve su esquema) y le manda sólo eso. La columna nueva
empieza a viajar sola el día que la nube la tenga. Y si no se puede leer el esquema, **va
todo** — fallar abierto, no cerrado: más vale que la nube rechace un lote y se reintente, a
que el nodo se coma el `total` de una venta porque no supo leer una respuesta.

---

## Recordatorios que no caducan

- **REGLA Nº1**: solo el Supabase del proyecto y el Postgres del nodo (55432).
- El nodo **nunca** lleva `SUPABASE_SECRET_KEY` de la nube (`nube.mjs` es la puerta).
- Las migraciones **no** son idempotentes: la cuenta la lleva `nodo_migracion`.
- `PGCLIENTENCODING=UTF8` siempre que un proceso lance `psql` (Windows español).
- Los timestamps de marcas de agua, **en texto** (microsegundos vs `Date` de JS)… pero
  **las comparaciones, como instantes**: Postgres y PostgREST los escriben distinto y
  compararlos con `<` da un resultado que parece bueno y no lo es.
- **La nube se migra ANTES que los nodos.** El nodo sube filas con `select *`: si tuviera
  una columna que la nube aún no tiene, PostgREST responde 400 y ese bar deja de
  sincronizar el catálogo.
