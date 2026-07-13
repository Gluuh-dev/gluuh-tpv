# 16 — Nodo local y sincronización con la nube

**Objetivo:** ejecutar la arquitectura de
[`docs/plan/10-arquitectura-nodo-local-y-nube.md`](../plan/10-arquitectura-nodo-local-y-nube.md):
un **nodo principal** (mini-PC) que es la fuente de verdad operativa del local y
funciona sin internet; las terminales pegan al nodo por LAN; el nodo sincroniza con la
nube en una sola frontera, partiendo el sync por clase de dato (operativo inmutable
hacia arriba; catálogo con "gana la última edición" en ambos sentidos). Sustituye el
camino de la guía [06](06-offline-powersync.md) (PowerSync por dispositivo) por el
modelo de nodo. Consolida el **Bloque E** del doc [09](../plan/09-orden-de-implementacion.md).

> **Regla de oro (doc 06):** el nodo corre **el mismo código** que la nube (Next +
> NestJS + Postgres con RLS), apuntado a un Postgres local. No se escribe un producto
> nuevo. Todo lo que se añade aquí es: empaquetado del nodo, la **cola de subida**
> (outbox) y el descubrimiento en LAN.

## Punto de partida real

- **Desktop (`apps/desktop`)**: shell Electron real (hay instalador), carga la web
  desde una **URL configurable** (`config.json` > `GLUUH_URL` > `localhost`, ver
  `src/main.ts`), con cola de impresión, cajón, visor, backup a USB (`src/backup.ts`)
  y heartbeat. Es la base del nodo (E3 lo llama "Nodo v1 dentro de Gluuh Desktop").
- **API (`apps/api`)**: NestJS; `src/sync/sync.controller.ts` es un **stub** que solo
  acusa recibo. Es el receptor del sync en la nube.
- **Esquema (Supabase)**: todas las tablas de negocio llevan `tenant_id`, `updated_at`
  (trigger `set_updated_at` en bucle, `0001`) y `client_id` para idempotencia; el
  trigger `set_tenant_id` (`0004`) rellena el tenant en inserts. `print_job`/
  `print_route`/`device_heartbeat` ya existen. **Todo lo que necesita el sync ya está
  en las columnas.**
- **`packages/sync`**: conector + schema PowerSync — se **conserva** para el caso
  futuro F4 (móvil offline fuera del WiFi), no es el camino de esta guía.

## Modelo (recordatorio de una línea)

Operativo/fiscal (`sales_order`, `order_line`, `payment`, caja, `invoice`) → **el nodo
manda**, sube en **una dirección**, inmutable. Catálogo/config (`product`, `category`,
`family`, `menu*`, `product_format`, `modifier*`, `tenant_branding`, `printer`,
`plano_elemento`) → **bidireccional, LWW por `updated_at`**.

---

## Fase 0 — Cimientos (PARCIALMENTE HECHA el 13-07-2026)

> ⚠️ **Corrección de esta guía.** Decía "Postgres local + apps/api + apps/web
> apuntando a ese Postgres". **Es falso.** El TPV no habla con Postgres: habla con
> **Supabase**. Medido sobre el código: 617 llamadas a PostgREST (`.from()`/`.rpc()`),
> 71 a Auth, 4 a Realtime, 2 a Storage. El nodo necesita el **stack de Supabase
> entero** (Postgres + PostgREST + GoTrue + Realtime + Storage) — que es exactamente
> lo que levanta `supabase start`. Por eso apuntar una terminal al nodo es solo
> cambiar `NEXT_PUBLIC_SUPABASE_URL`: **no cambia una línea de la app**.

### 0.1 — Las migraciones tienen que reproducir la BD ✅ HECHO (13-07)

**El riesgo nº 1 del nodo**, y nadie lo había comprobado: cada nodo construye su base
de datos aplicando TODAS las migraciones a un Postgres vacío. Si el resultado no es
idéntico al de la nube, el nodo y la nube divergen y la sincronización se rompe en
sutilezas. El historial de Supabase solo registraba **31 migraciones de 95**.

Auditoría hecha (migraciones vs BD viva, por MCP):

| Comprobación | Resultado |
|---|---|
| Tablas de la BD que ninguna migración crea | **0** ✅ (las 80 están cubiertas) |
| Columnas añadidas por migraciones que faltan en la BD | **1 de 91** → `app_user.permisos` |
| Tablas de las migraciones que faltan en la BD | **1** → `invoice_tax_line` |
| Migraciones que fallarían en una BD vacía (UUID hardcodeado en 0082) | **0** (es un `UPDATE` que afecta a 0 filas) |

**Y al tirar de ese hilo salió un bug fiscal latente:** `invoice_tax_line` **no existe
en la BD, pero el código la usa** — `apps/web/app/api/factura/route.ts:219` inserta ahí
el desglose de impuestos de cada factura, **y no comprobaba el error**. En cuanto se
active VERIFACTU, cada factura se habría guardado SIN sus líneas de impuestos, en
silencio.

→ **Migración `0096_convergencia_esquema_para_nodo.sql`**: crea `invoice_tax_line`
(idempotente) y elimina la columna fantasma `app_user.permisos` (los permisos viven en
`perfil.permisos`). Con ella, aplicar las migraciones a un Postgres vacío produce
EXACTAMENTE la BD de la nube. El insert de `/api/factura` ya comprueba su error.

### 0.2 — Stack local ✅ CONFIGURADO (13-07)

`supabase/config.toml` versionado (`supabase init`): levanta db + PostgREST + Auth +
Realtime + Storage + Studio. Es el stack del nodo.

### 0.3 — Spike en vivo ⏳ PENDIENTE (requiere Docker)

Lo único que falta de la Fase 0, y **necesita Docker** (no lo hay en la máquina de
desarrollo):

1. `supabase start` → levanta el stack local.
2. `supabase db reset` → **aplica las 96 migraciones a un Postgres vacío**. Es LA
   prueba: si alguna migración falla o va desordenada, sale aquí. (La auditoría 0.1
   dice que el estado final coincide; lo que falta por verificar es que apliquen
   limpio EN ORDEN.)
3. Apuntar `apps/web` al stack local (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   + la anon key que imprime `supabase start`) y comprobar que **login, TPV, catálogo,
   plano, cobro y realtime funcionan igual** contra el nodo.
4. Sembrar un tenant de prueba (`supabase/seed/`).
5. Con otra máquina en la misma LAN apuntada a `http://<ip>:54321` y `:3100`:
   **apagar el router** y comprobar que se vende, se comanda (tablet→KDS), se imprime
   y se cobra sin internet.

**Decisión go/no-go:** si el stack local sirve la LAN sin internet, seguir. Confirmar
aquí también el **Bloque E1** (recomendación del plan 10 §8: **cola outbox propia, no
PowerSync self-hosted**).

**Criterio:** `supabase db reset` en verde + router apagado 30 min → se vende, se
comanda (tablet→KDS) y se imprime.

---

## Fase 1 — Desenganchar la app de Realtime y Storage (4-5 d) — SIN Docker

**Esto se puede hacer YA**, sin infraestructura: son los **5 puntos de contacto** que
permiten que la MISMA app funcione contra la nube (Supabase) o contra el nodo (lo
nuestro). Es el prerrequisito de todo lo demás.

### 1.1 Capa de "escuchar cambios" (4 sitios)

Hoy hay 5 canales `sb.channel(...)`: `tpv_catalogo` y `tpv_salas` (`app/tpv/page.tsx`),
`cocina`, `pantalla` y `print_job_dispatch` (`app/lib/print-dispatcher.tsx`).

Crear `apps/web/app/lib/cambios.ts` con un único punto de entrada:

```ts
/** Escucha cambios de N tablas. En la NUBE usa Supabase Realtime; en el NODO,
 *  el WebSocket propio del servidor (LISTEN/NOTIFY). Devuelve el "desuscribir". */
export function escucharCambios(sb, tablas: string[], onCambio: () => void): () => void
```

Detecta el backend por la URL de Supabase (si apunta al nodo, usa el WebSocket propio).
Migrar los 5 canales a esta función. **Sin cambio de comportamiento en la nube.**

### 1.2 Imágenes — ✅ la costura de ESCRITURA ya existía (0 trabajo)

`subirMedia()` (`app/lib/branding.ts`) es el **ÚNICO** sitio de la app que toca Storage
(verificado: 2 llamadas, las dos ahí dentro). **Ya es la costura**: la rama del nodo va
dentro de esa función. Montar una capa encima sería ceremonia vacía. Solo se marcó con
un cartel para que quien construya el nodo la encuentre.

### 1.3 ⚠️ MINA: las fotos se guardan con URL ABSOLUTA de la nube

Hallazgo del 13-07 al mirar la costura. Lo que se persiste en la BD (`product.foto_url`,
`tenant_branding.logo_url`, `offer.media_url`…) **no es una ruta: es una URL completa de
Supabase**:

```
https://<proyecto>.supabase.co/storage/v1/object/public/media/<tenant>/productos/<uuid>.webp
```

**Las terminales del nodo, sin internet, NO pueden resolver esa URL.** Aunque el nodo
tenga la foto en su disco, el `<img src>` apunta a internet.

**Solución (Fase 2, cuando exista el nodo):** un resolvedor `urlFoto(url)` en los ~8
sitios que pintan fotos, que en modo nodo reescriba el prefijo:

```
https://<proy>.supabase.co/storage/v1/object/public/media/<ruta>  →  http://<nodo>/media/<ruta>
```

Es un cambio de prefijo — **no hace falta migrar datos ni tocar la BD**.

**Por qué NO se hace ahora:** hoy sería una **función identidad** (no hay nodo contra el
que reescribir). Construir una abstracción con una sola implementación es justo lo que no
hay que hacer. Se hace cuando el nodo exista y haya un segundo backend de verdad.

**Criterio de la Fase 1:** los 5 canales pasan por `escucharCambios()`; la nube sigue
funcionando exactamente igual (humo: catálogo, mesas en vivo, cocina, pantalla,
impresión).

---

## Fase 2 — Montar el nodo (1-1,5 sem) — requiere Postgres/Docker

### 2.1 Los tres binarios — ✅ TODOS PROBADOS EN WINDOWS (13-07-2026)

> **Spike ejecutado de punta a punta.** Detalle y recetas en
> [`supabase/nodo/README.md`](../../supabase/nodo/README.md).

| Pieza | Windows | Resultado |
|---|---|---|
| `postgres.exe` | Portable (zip de EDB, sin instalador) | ✅ **Corriendo.** 98/98 migraciones aplicadas |
| `postgrest.exe` | Binario **oficial** (`postgrest-v14.14-windows-x86-64.zip`) | ✅ **Sirviendo 81 tablas y 42 RPCs.** ⚠️ **Necesita `LIBPQ.dll`, que NO viene en su zip** — viene con Postgres. El instalador debe enviarlos JUNTOS o poner `pgsql/bin` en el PATH. Sin eso muere en silencio |
| `gotrue.exe` | Supabase **no publica binario de Windows** | ✅ **COMPILADO (50,5 MB) y arranca.** Es Go puro (`CGO_ENABLED=0`); falla por **una sola línea**: `SO_REUSEPORT` (solo Unix). **Parche mínimo** en `supabase/nodo/parches/` |

**Verificado por HTTP, como lo hace el TPV:**
- **RLS multi-tenant**: anónimo → *permission denied*; el camarero de una empresa ve
  **solo sus productos** y **no ve** los de la otra.
- **RPC fiscales**: `resolver_iva(GENERAL, CANARIAS)` → **7,00** ·
  `(REDUCIDO, PENINSULA_BALEARES)` → **10,00**.

### 2.1-ter ⚠️ El bootstrap: las migraciones NO son autocontenidas

Descubierto al aplicarlas a un Postgres vacío: **dan por hechos objetos de la PLATAFORMA
Supabase** que PostgreSQL a secas no tiene. Sin ellos, **5 migraciones petan**:

| Falta | Lo necesitan |
|---|---|
| Roles `anon`, `authenticated`, `service_role`, `authenticator` | 41 `GRANT` + PostgREST |
| Esquema `auth`: `auth.users` y **`auth.uid()`** | 7 migraciones. `auth.uid()` es **el corazón de la RLS** (`current_tenant_id()` cae a ella) |
| Rol `supabase_auth_admin` | `0011` |
| Publicación `supabase_realtime` | `0006`, `0081`, `0097` |
| Esquema `storage` (stub) | `0010` |

→ **`supabase/nodo/00_bootstrap_nodo.sql`** lo crea todo **sin bifurcar ni una migración**.
El stub de `storage` y la publicación se crean **aunque el nodo no los use**, para que los
esquemas de nube y nodo converjan exactamente.

**NO se usan** Supabase Realtime (Elixir) ni Storage → los sustituyen la Fase 1 y la 2.2.

### 2.1-bis 🎉 Consecuencia: NO hace falta Docker NI PARA DESARROLLAR

Si el nodo son 3 binarios nativos de Windows, el spike se monta **exactamente igual que
lo tendrá el cliente**: Postgres portable + `postgrest.exe` + `gotrue.exe`. Probar con
Docker sería probar **una configuración distinta de la que se envía**. Herramientas
necesarias en la máquina de desarrollo:

- **Go 1.25+** (solo para compilar `gotrue.exe` una vez)
- **Postgres para Windows** (portable, sin instalador)

Nada de WSL2, BIOS, ni daemons.

### 2.2 Lo que pone el proceso Gluuh (Node/Electron, ya existe)

- **Realtime propio**: triggers `NOTIFY` en `sales_order`, `order_line`,
  `restaurant_table`, `product`, `category`, `family`, `print_job` → el nodo hace
  `LISTEN` y reenvía por **WebSocket** a las terminales. ~150 líneas, instantáneo.
- **Fotos**: carpeta en disco + endpoint HTTP (subir y servir).
- Sirve la **web Next** en la LAN, la **cola de impresión** y el **backup**.

### 2.3 Provisión inicial (con internet, una vez)

Al instalar el nodo: aplicar las migraciones a su Postgres vacío, y **descargar de la
nube el tenant, el catálogo entero y TODAS las fotos** al disco del nodo. Fuente: el
código de instalación (4-4-5-4-4, guía 15). A partir de ahí, cero internet.

**Criterio:** una segunda terminal de la LAN ve una mesa abierta por la primera en < 1 s,
**con el router apagado**.

---

## Fase 2 — Outbox: subida operativa nodo → nube (1 sem)

La cola de una sola dirección para lo inmutable.

1. **Migración `NNNN_sync_outbox.sql`** (en el Postgres del **nodo**; no en la nube):

```sql
-- Cola de operaciones OPERATIVAS pendientes de subir a la nube. Solo en el nodo local.
create table sync_outbox (
  id         bigserial primary key,
  tabla      text not null,
  fila_id    uuid not null,
  op         text not null check (op in ('INSERT','UPDATE','DELETE')),
  payload    jsonb,                        -- fila completa (INSERT/UPDATE); null en DELETE
  client_id  uuid,                         -- idempotencia aguas arriba
  creado_en  timestamptz not null default now(),
  subido_en  timestamptz,                  -- null = pendiente
  intentos   int not null default 0,
  ultimo_error text
);
create index idx_outbox_pendiente on sync_outbox (creado_en) where subido_en is null;

-- Encolar automáticamente las escrituras operativas (inmutables → basta AFTER INSERT/UPDATE).
create or replace function encolar_sync() returns trigger language plpgsql as $$
begin
  insert into sync_outbox (tabla, fila_id, op, payload, client_id)
  values (tg_table_name, new.id, tg_op, to_jsonb(new), new.client_id);
  return new;
end; $$;

do $$ declare t text;
begin
  foreach t in array array['sales_order','order_line','payment'] loop
    execute format('drop trigger if exists trg_outbox on %I;', t);
    execute format('create trigger trg_outbox after insert or update on %I
                    for each row execute function encolar_sync();', t);
  end loop;
end $$;
```

   (Añadir caja/`invoice` cuando VERIFACTU entre. `order_line` sube junto a su
   `sales_order`; en la nube se aplican en orden por `creado_en`.)

2. **Worker de subida en el nodo** (`apps/api`, tarea periódica o al recuperar red):
   lee `sync_outbox` pendiente en lotes, `POST` a la nube `/sync/upload`, y marca
   `subido_en` solo si la respuesta es OK. Reintento con backoff; nunca borra hasta
   confirmar (clave del modo offline).

3. **`/sync/upload` REAL en la nube** (sustituye el stub `apps/api/src/sync/sync.controller.ts`):
   - Validar JWT (tenant + device) y **fijar el contexto RLS** (`set app.tenant_id`).
   - Aplicar cada op con cliente `pg` en **transacción**, **idempotente por `client_id`**
     (`insert … on conflict (tenant_id, client_id) do nothing`).
   - Rechazo **granular**: una op inválida se registra y NO tumba el lote; la respuesta
     dice cuáles entraron para que el worker marque solo esas.
   - La nube **nunca reescribe** operativo: es append-only desde el nodo.

**Criterio:** 50 pedidos creados con el router apagado → al encender, aparecen en el
backoffice nube sin duplicados (repetir el upload no crea copias).

---

## Fase 3 — Catálogo LWW: nube ↔ nodo (4-5 d)

El dueño edita desde casa y baja al TPV; y al revés.

1. **Bajada (nube → nodo)**: worker en el nodo que pide a la nube los cambios de
   catálogo desde el último corte (`GET /sync/catalogo?desde=<updated_at>`), y los
   aplica **con LWW**: actualiza la fila local **solo si** `updated_at` entrante >
   `updated_at` local. El realtime del nodo (fase 1) propaga el cambio a las
   terminales (D3 ya lo pinta).
2. **Subida (nodo → nube)**: las ediciones de catálogo hechas en el backoffice **local**
   del nodo entran en la misma outbox (ampliar los triggers a las tablas de catálogo)
   y `/sync/upload` las aplica en la nube **también con LWW** (comparar `updated_at`).
3. **Endpoint `/sync/catalogo`** en la nube: devuelve filas de las tablas de catálogo
   del tenant con `updated_at > desde` (paginado). Acotado por RLS.

**Criterio:** cambiar el precio de un producto desde `app.gluuh.com` → aparece en el
TPV del local en < 30 s con internet, y al reconectar si estaba offline. Editar el
mismo producto en el nodo local con internet caído y en la nube casi a la vez → gana
la edición con `updated_at` más reciente, sin romper (queda registrado el descarte).

---

## Fase 4 — Descubrimiento en LAN + fallback a nube (3-4 d) — doc 09 E4

1. El nodo anuncia un servicio **mDNS** `_gluuh._tcp` en la LAN.
2. El Desktop de cada terminal **descubre** el nodo y usa su URL; si no aparece y hay
   internet, **cae a la nube** (`GLUUH_URL`). Extiende la resolución de URL que ya hay
   en `apps/desktop/src/main.ts` (hoy `config.json > GLUUH_URL > localhost`).
3. Indicador en la barra de estado (guía 05): "Conectado al nodo local" / "En la nube"
   / "N operaciones pendientes de subir".

**Criterio:** una tablet nueva, sin IP tecleada, encuentra el nodo y opera; si se
apaga el nodo y hay internet, sigue funcionando contra la nube.

---

## Fase 5 — Numeración fiscal offline (3-4 d) — doc 09 E2

Reusar el diseño de la guía [06 fase 3](06-offline-powersync.md) y
`docs/dossier/06`:

1. Tabla `number_range (tenant_id, device_id, serie, desde, hasta, siguiente)` + RPC
   `reservar_rango(serie, n)`. Cada nodo/dispositivo reserva un rango; al bajar del
   20% reserva el siguiente.
2. Offline, la factura se emite **local** con número del rango + huella encadenada
   local (`@gluuh/core`; usar `crypto.subtle`/WebCrypto donde no haya `node:crypto`,
   con test contra el vector oficial AEAT).
3. Al reconectar, las facturas suben por la outbox y la API las remite a AEAT (guía
   01). VERIFACTU admite remisión diferida.

**Criterio:** dos TPV del mismo local, offline a la vez, no repiten número; la cadena
VERIFACTU verifica en verde tras un día simulado con 2 cortes de red.

---

## Fase 6 — Backup en nube + agregación multi-local (3-4 d)

1. **Backup nube (módulo de pago):** la sincronización nodo→nube ya deja el espejo
   fuera de sitio; añadir instantáneas periódicas por tenant/location (snapshot
   lógico) para "volver al estado de anteayer". El backup **local** a USB ya existe
   (D2); este es el nivel remoto.
2. **Multi-local:** un `tenant` con N `location`, cada una con su nodo. La nube ya
   agrega (RLS por `tenant_id`, filtro por `location_id` en índices). En el backoffice:
   **selector de local** + vistas consolidadas (ventas por local, comparativa). El
   `admin_resumen_empresas` de plataforma ya suma a nivel tenant; aquí es a nivel
   location dentro del tenant.

**Criterio:** un dueño con 2 locales ve ambos en `app.gluuh.com`, cambia de uno a otro
y ve cifras consolidadas; cada local sigue operando con su nodo.

---

## Fase 7 — Servicio, instaladores, panel y actualizaciones (1-1,5 sem) — doc 09 E5

### 7.1 Dos instaladores (no uno)

| Instalador | Dónde | Qué hace |
|---|---|---|
| **`Gluuh Servidor.exe`** | En **UN** equipo del local (el PC de caja o un mini-PC) | Instala `postgres.exe` + `postgrest.exe` + `gotrue.exe` + el proceso Gluuh. Se registra como **servicio de Windows** |
| **`Gluuh TPV.exe`** | En **CADA** terminal (el PC servidor también puede serlo) | El Electron que **ya está compilado**. Descubre el servidor por mDNS y se conecta |

En un bar pequeño, el mismo PC lleva los dos (guía 15 §10.1).

### 7.2 El servicio: arranca solo y no se cierra

- **Servicio de Windows**: arranca al encender **sin que nadie inicie sesión**,
  sobrevive a un corte de luz (+ *AC Power On* en la BIOS) y vuelve solo.
- **No es una ventana**: no se puede cerrar por accidente. Deja un **icono en la
  bandeja**; al pulsarlo, abre el panel (7.3).
- **NTP al arrancar**: el LWW y la huella fiscal dependen de la hora. Sincronizar el
  reloj y avisar si hay deriva grande (plan 10 §10).

### 7.3 Panel del servidor (ruta `/servidor`)

De un vistazo: si el local está sano o no. Contenido y qué se reutiliza:

| Bloque | Qué muestra | Reutiliza |
|---|---|---|
| Servicios | BD · Datos · Login · Web · Realtime | — (nuevo) |
| Terminales | Cuáles están en línea | ✅ `device_heartbeat` (0080) |
| Impresoras | Alcanzables o caídas | ✅ tabla `printer` (0079) |
| Datos | Productos, mesas, pedidos de hoy · **espacio** de BD y fotos | — (nuevo) |
| Nube | Internet ✓/✗ · última subida · **pendientes** | — (la outbox, Fase 3) |
| Copias | Última copia, dónde, tamaño | ✅ `backup.ultima` |
| Versión | Versión · última actualización · buscar ahora | ✅ `device.version` |

### 7.4 ⚠️ Actualizaciones: código **+ esquema**

**La pieza que nadie piensa y la que duele.** Mandar una versión al parque no es
reemplazar un `.exe`: si trae migraciones nuevas, el nodo debe **aplicarlas a su
Postgres local** antes de arrancar con el código nuevo.

1. **Al arrancar**, el nodo aplica las migraciones pendientes **en orden**. (Por eso era
   crítico que las migraciones reprodujeran la BD desde cero — auditado el 13-07, lo
   cerró la `0096`. Sin ese cimiento, esto no se sostiene.)
2. **Si una migración falla → NO arrancar con el esquema roto.** Se queda en la versión
   anterior, no actualiza, y lo canta en el panel. Nunca dejar el local a medias.
3. **Nunca a mitad de servicio.** Descarga en segundo plano; instalación en **ventana
   segura**: de madrugada, o sin ninguna cuenta abierta, o cuando el dueño pulsa el
   botón. `electron-updater` ya está cableado (`apps/desktop/src/main.ts`) con
   `autoInstallOnAppQuit = true` — *"nunca reiniciar en mitad del servicio"*. Ese
   criterio se mantiene y se endurece para el servidor.
4. El nodo **reporta su versión** (`device.version` + heartbeat) → desde la nube ves qué
   versión tiene cada local.

**Criterio:** corte de luz al mini-PC → vuelve solo y las terminales reconectan sin que
nadie toque nada. Y: se publica una versión con una migración nueva → el parque se
actualiza de madrugada; si la migración falla, el local sigue operando con la anterior.

---

## Riesgos y decisiones

- **⚠️ RIESGO Nº 1 (rebajado, 13-07): `gotrue.exe` en Windows.** Confirmado que Supabase
  **no publica** binario de Windows. Pero su Makefile compila con **`CGO_ENABLED=0`** (Go
  puro, sin C), así que `GOOS=windows go build` debería salir sin drama. **Sigue sin
  verificar** — es lo PRIMERO de la Fase 2. Plan B si fallara: el login son solo 4
  métodos y el proyecto ya lleva `jose` (JWT); podríamos emitir el token nosotros
  hablando el protocolo de GoTrue. Más frágil, pero existe.
- **✅ RIESGO ELIMINADO: PostgREST en Windows.** Publica binario **oficial**
  (`postgrest-v14.14-windows-x86-64.zip`). Era la pieza con más superficie (617
  llamadas) y ya no preocupa.
- **Docker: NO hace falta EN NINGÚN SITIO.** Ni en el cliente (decisión firme, plan 10
  §3.1: WSL2 + BIOS = fábrica de llamadas de soporte) **ni en desarrollo**: si el nodo
  son 3 binarios nativos, el spike se monta **igual que lo tendrá el cliente**. Probar
  con Docker sería probar una configuración distinta de la que se envía.
- **Nodo = punto único de fallo en el local.** Mitigado por servicio auto-arranque
  (7.2), fallback a nube (Fase 5) y backup frecuente. Segundo nodo en caliente = YAGNI
  para un bar; reevaluar en cadenas.
- **Reloj del PC** (LWW + huella fiscal): NTP obligatorio (7.2).
- **PowerSync vs cola:** esta guía implementa **cola propia** (plan 10 §8). Reversible
  a PowerSync sin cambiar el modelo de datos si el volumen lo pide.
- **Realtime propio (LISTEN/NOTIFY + WebSocket)** en vez de Supabase Realtime (Elixir).
  Si diera guerra, el plan B es **polling corto en LAN** (1-2 s): más simple, contra un
  Postgres local es gratis, y una cocina que refresca en 2 s es indistinguible de
  instantánea.

## Criterios de aceptación (globales)

- [ ] Router apagado: el local vende, comanda (tablet→KDS), imprime y cobra por el nodo.
- [ ] **El comandero abre una mesa → aparece en TODOS los TPV en < 1 s, sin internet.**
- [ ] Al volver internet, todo lo operativo sube a la nube sin duplicados (idempotencia).
- [ ] Cambio de precio en `app.gluuh.com` llega al TPV < 30 s (online) y al reconectar (offline).
- [ ] **Foto nueva subida en el nodo SIN internet**: todas las terminales la ven al
      momento, y acaba en Supabase cuando vuelve la conexión.
- [ ] **TPV/nodo nuevo**: con internet, se descarga catálogo **y todas las fotos**; luego
      opera sin internet con las fotos servidas por el nodo.
- [ ] **Actualización con migración nueva**: el parque se actualiza de madrugada; si la
      migración falla, el local sigue operando con la versión anterior y lo avisa.
- [ ] Corte de luz al servidor → vuelve solo, las terminales reconectan sin intervención.
- [ ] Dos terminales offline no chocan numeración fiscal; la cadena VERIFACTU verifica.
- [ ] Terminal sin IP tecleada encuentra el nodo (mDNS) y cae a nube si el nodo no está.
- [ ] Un dueño ve 2 locales en la nube con cifras consolidadas.
- [ ] Corte de luz al mini-PC → el nodo vuelve solo como servicio.
- [ ] `pnpm --filter @gluuh/core test` en verde con el hasher web (fase 5).
