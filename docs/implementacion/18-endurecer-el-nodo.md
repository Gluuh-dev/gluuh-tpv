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

## Bloque 5 · Dinero concurrente (C3 + C4)

- `reemplazar_lineas(p_updated_at_esperado)` → `raise` con código propio si la orden
  cambió; el TPV captura, recarga la mesa y avisa. Migración nueva + `page.tsx`.
- Numeración: RPC `siguiente_numero_factura(serie)` con
  `pg_advisory_xact_lock(hashtext(serie))`; `/api/factura` la usa.

**Aceptación**: dos clientes simulados guardando la misma mesa a la vez → uno recibe
conflicto y NO se pierden líneas. 20 cobros concurrentes → numeración correlativa sin
huecos ni choques.

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
