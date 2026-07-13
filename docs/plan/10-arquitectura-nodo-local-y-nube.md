# 10 — Arquitectura definitiva: nodo local + nube

**Fecha:** 12-07-2026 · **Estado:** decisión vigente (actualiza el doc
[06](06-decision-local-vs-cloud.md) en el punto "fuente de verdad" y consolida el
Bloque E del doc [09](09-orden-de-implementacion.md)).

**Pregunta que responde:** en cada local hay un **nodo principal** (mini-PC) que
funciona sin internet y **donde está todo**; cada TPV instala una app que se
conecta a ese nodo; el nodo hace copia local y, cuando tiene internet, **copia todo
a la nube**. La nube es un **módulo de pago** que permite al dueño ver y editar su
carta desde casa (y que el cambio baje al TPV), tener copia de seguridad remota y
**ver más de un restaurante** a la vez. ¿Cómo se monta esto sin duplicar producto,
sin romper la fiscalidad y sin perder datos?

---

## 1. La decisión, en un párrafo

**El nodo local es la fuente de verdad OPERATIVA del local; la nube es un espejo +
un módulo de gestión remota, no la fuente de verdad del día a día.** Todas las
terminales del local (TPV, comandera, cocina, kiosko) hablan con el nodo por la red
local (LAN) y operan al 100% sin internet. El nodo sincroniza con la nube en **una
sola frontera por local** (nodo ↔ nube), no una por dispositivo. La sincronización
se parte en dos por clase de dato: lo **operativo/fiscal** (comandas, pagos, caja,
facturas) sube en una sola dirección y no se reescribe nunca; el **catálogo/config**
(productos, precios, categorías, marca) es bidireccional con "gana la última
edición". Punto clave que preserva el doc 06: **el nodo corre EL MISMO código que la
nube** (mismo Next + NestJS + Postgres con RLS), apuntado a un Postgres local. No es
un segundo producto — es "la nube, en una caja, dentro del bar".

---

## 2. Cómo encaja con lo ya decidido (reconciliación honesta)

Hay tres documentos que hay que alinear, porque el modelo evolucionó:

| Fuente | Qué dijo | Vigencia |
|---|---|---|
| **doc 06** (02-07) | Nube = fuente de verdad; offline = copia SQLite **por dispositivo** con PowerSync; **sin servidor local**. | **Superado en el punto "fuente de verdad".** Su razonamiento fuerte sigue vigente: NO dos productos (una sola base de código), NO modo dual de pago, la copia local va incluida. |
| **doc 09, Bloque E** (07-07) | "NODO LOCAL antes del primer cliente": el equipo principal sirve la web en LAN + espejo de datos + realtime local + cola de subida. | **Vigente y es la base de implementación.** Este doc lo detalla; la guía [16](../implementacion/16-nodo-local-y-sincronizacion.md) lo ejecuta. |
| **Tu descripción** (12-07) | Nodo = servicio levantado, sin internet, "donde está todo"; nube = módulo de pago (ver/editar desde casa, backup remoto, multi-local). | **Es la decisión de este doc.** Refina el doc 06: la nube pasa de "fuente de verdad" a "espejo + módulo de gestión". |

Lo importante: **la contradicción se resuelve a favor del nodo local**, pero **sin
tirar la razón nº 1 del doc 06** (una sola base de código). Se consigue porque el
nodo no es código nuevo: es el stack de la nube corriendo en local.

---

## 3. Los tres componentes

```
   ┌─────────────────────── LOCAL (sin internet obligatorio) ───────────────────────┐
   │                                                                                 │
   │   [TPV tablet] ─┐                                                               │
   │   [Comandera] ──┤   LAN (WiFi/Ethernet)     ┌──────── NODO PRINCIPAL ────────┐  │
   │   [Cocina/KDS] ─┼──────────────────────────▶│  mini-PC: Postgres local +     │  │
   │   [Kiosko] ─────┘   (HTTP + realtime local)  │  NestJS API + Next web +       │  │
   │                                              │  realtime + cola de impresión  │  │
   │   [Impresoras] ◀─────────────────────────────│  + servicio de backup          │  │
   │                                              └──────────────┬─────────────────┘  │
   └─────────────────────────────────────────────────────────────┼──────────────────┘
                                                                  │  sync (cuando hay internet)
                                                     ┌────────────▼───────────────┐
                                                     │           NUBE             │
                                                     │  Supabase (Postgres+RLS) + │
                                                     │  backoffice app.gluuh.com  │
                                                     │  + plataforma admin.       │
                                                     └────────────┬───────────────┘
                                                                  │
                                            [Dueño desde casa / móvil] ── ve y edita N locales
```

### 3.1 Nodo principal — el "Servicio Gluuh"

> **DOS CORRECCIONES a este doc (13-07-2026).** La primera versión decía que el nodo
> lleva "un Postgres local" — **falso**. La segunda decía que necesita "el stack de
> Supabase entero" — **exagerado**. La verdad está en medio y es mejor que las dos.

#### Qué usa REALMENTE la app (medido sobre el código, no supuesto)

| Servicio | Uso real | ¿Lo necesita el nodo? |
|---|---|---|
| **PostgREST** (datos y RPC) | **617** llamadas (`.from()` / `.rpc()`) | **SÍ** — es el caballo de batalla |
| **Auth / GoTrue** | 27 `.auth.`, pero **18 son `getSession()` que lee de localStorage y NO toca el servidor**. Al servidor van solo `signInWithPassword`, `getUser`, `updateUser`, `signOut` | **SÍ**, pero mínimo (4 métodos). Todo login acaba ahí, incluido el del operario (`/api/entrar-operario` prepara la cuenta y el cliente remata con `signInWithPassword`) |
| **Realtime** | **4 canales**: cocina, impresión, pantalla, catálogo (+ `tpv_salas`, 0097) | **La función SÍ es indispensable** (el comandero abre una mesa → debe verse en todos los TPV). **El servicio de Supabase, NO** — ver abajo |
| **Storage** | **2** llamadas, ambas en `subirMedia()` | **La función sí** (fotos en el nodo, sin internet). **El servicio de Supabase, no** |

#### La decisión: SIN Docker y SIN las dos piezas difíciles

**El cliente NO instala Docker jamás.** Docker en Windows arrastra WSL2, virtualización
en BIOS y una app que puede no arrancar; un bar no puede estar depurando eso un sábado
a las 8. Y justamente **las dos piezas de Supabase que no corren bien nativas en
Windows son Realtime (Elixir) y Storage** — que son, precisamente, las dos que **no
necesitamos de Supabase**:

- **Realtime propio**: Postgres trae **`LISTEN/NOTIFY`** de serie. Un disparador avisa
  al cambiar mesa/pedido/catálogo, el proceso del nodo lo escucha y lo reenvía a las
  terminales por **WebSocket**. Instantáneo de verdad y **sin Elixir**. El nodo ya
  tiene un proceso Node (Electron *es* Node): no hace falta un servidor nuevo.
- **Fotos propias**: el nodo las guarda en una carpeta y las sirve por HTTP — ya está
  sirviendo la web en la LAN, servir un JPG es gratis.

#### El nodo, entonces

```
Gluuh Servidor.exe  →  postgres.exe    ← Postgres NORMAL. Sin nada de Supabase dentro.
                       postgrest.exe   ← la PUERTA HTTP a ese Postgres (un solo binario)
                       gotrue.exe      ← el login (binario Go)
                       + proceso Gluuh (Node): realtime propio (LISTEN/NOTIFY→WebSocket)
                                               · fotos (carpeta servida por HTTP)
                                               · la web Next en la LAN
                                               · cola de impresión + backup + panel
```

> **"¿Y por qué no un Postgres normal a secas, sin Supabase?"** — Porque **ya lo es**.
> La base de datos del nodo es PostgreSQL estándar: tablas, RLS, funciones, triggers.
> Nada propietario. **PostgREST no es "Supabase"**: es un proyecto independiente de
> código abierto, un `.exe` que pone una puerta HTTP delante de un Postgres cualquiera.
> Y hace falta **una** puerta, porque un navegador **no puede abrir una conexión TCP a
> Postgres**, nunca. La pregunta no es "Postgres o Supabase" — es **"¿quién escribe la
> puerta?"**. Usar PostgREST cuesta **cero líneas**. Escribir la nuestra costaría
> reescribir **617 llamadas** repartidas por el TPV, las 51 páginas del backoffice, el
> kiosko, la cocina, el comandero y la pantalla… y mantener **dos capas de datos para
> siempre**. Que es exactamente la trampa de "dos productos disfrazados de uno" que ya
> rechazó el [doc 06](06-decision-local-vs-cloud.md).

**Coste de adaptación en la app: 5 puntos de contacto.** Los 4 sitios que escuchan
cambios + la función `subirMedia`. Detrás de una capa fina que elige backend según
dónde corre (nube → Supabase; nodo → lo nuestro). **No es una reescritura.**

### 3.2 Terminales — la "app de TPV"

**Finas**: instalan `Gluuh TPV.exe` (el shell Electron, **ya compilado**) apuntado al
nodo por la LAN. El mecanismo ya existe: `config.json` del terminal > `GLUUH_URL` >
localhost (`apps/desktop/src/main.ts`). No necesitan base de datos propia: pegan al
nodo. Descubren el nodo por **mDNS** (`_gluuh._tcp`) y **caen a la nube** si el nodo no
aparece y hay internet.

El PC principal puede llevar **las dos cosas** (Servidor + TPV): en un bar pequeño, un
solo equipo hace de servidor y de caja (guía 15 §10.1).

> **Excepción acotada (futuro, doc 09 F4):** un móvil-comandera que se salga del
> alcance del WiFi del local sí necesitaría copia offline propia. Ese es el único
> caso que justifica PowerSync **por dispositivo**, y no se construye ahora (YAGNI).

### 3.3 Nube (módulo de pago)
Supabase (Postgres + RLS multi-tenant, ya montado) + el backoffice `app.gluuh.com` +
la plataforma `admin.gluuh.com`. Es **espejo** de todos los nodos del dueño y la capa
de **gestión remota + multi-local + backup remoto**. Sin el módulo contratado, el
local funciona igual con su nodo; lo que no tiene es el "verlo desde casa".

---

## 4. El diseño clave: sincronización partida por clase de dato

Sincronizar todo bidireccionalmente sería complejísimo (CRDTs, conflictos). No hace
falta: **se parte por quién manda sobre cada dato.**

| Clase de dato | Tablas | Quién manda | Dirección | Conflictos |
|---|---|---|---|---|
| **Operativo + fiscal** | `sales_order`, `order_line`, `payment`, caja, `invoice`/VERIFACTU, estado de mesa | **El nodo local** (ahí ocurre la venta) | Nodo → nube, **una sola dirección** | Ninguno: son inserciones **inmutables**, la nube nunca las reescribe |
| **Catálogo + config** | `product`, `category`, `family`, `menu*`, `product_format`, `modifier*`, `tenant_branding`, `printer`, `plano_elemento` | Compartido (dueño desde casa **o** backoffice local) | **Bidireccional** | **Gana la última edición** (LWW por `updated_at`, que ya existe con trigger en todas las tablas) |

Por qué funciona y es lo más simple que sirve (ponytail):

- **Lo operativo no tiene conflictos** porque un pedido/pago no se edita a la vez
  desde dos sitios: se crea en el local, se registra, y sube. La nube lo lee, nunca
  lo pisa. La idempotencia por `client_id` (ya en el esquema) evita duplicados si la
  subida se reintenta.
- **El catálogo casi nunca se edita en dos sitios a la vez.** Que el dueño cambie el
  precio de la caña desde el sofá mientras un camarero lo edita en el local en el
  mismo segundo es tan raro que un **last-write-wins por fila** (comparar
  `updated_at`) basta. No hacen falta CRDTs. Si dos ediciones chocan, gana la más
  reciente y se registra en el log — suficiente para una carta.
- **La subida operativa es una cola "outbox"**: una tabla en el nodo con las
  operaciones pendientes que empuja a la nube cuando hay internet (detalle y DDL en
  la guía 16). Es mucho más barata de mantener y depurar que un motor de sync
  bidireccional por dispositivo.

Consecuencia de diseño: esto **re-encuadra `packages/sync`**. El PowerSync
por-dispositivo del doc 06 deja de ser el camino principal (la LAN no lo necesita); o
bien se usa **PowerSync self-hosted EN el nodo** (una instancia por local) o bien una
**cola outbox propia**. Es la decisión abierta del Bloque E1 — recomendación en §8.

---

## 5. Los tres estados (qué funciona en cada uno)

| Estado | Operar en el local | Ver/editar desde casa | Sincronización |
|---|---|---|---|
| **Todo online** (LAN + internet) | ✅ todo, por el nodo | ✅ en vivo (nube) | Continua, en segundo plano |
| **Internet caído, LAN arriba** (el caso típico del bar) | ✅ **todo**: vender, comandar (móvil→KDS), imprimir, cobrar | ❌ el dueño no ve el local mientras esté sin internet (obvio: la nube no alcanza un nodo desconectado). El backoffice **local** del nodo sí funciona | La outbox **encola**; al volver internet, todo sube sin duplicados |
| **Nodo caído** (mini-PC roto/robado) | ❌ la LAN se queda sin fuente de verdad | ✅ si hay internet, las terminales **caen a la nube** (E4) y el dueño ve el último espejo | Se restaura el nodo desde backup en un mini-PC de repuesto |

**El caso "se rompe/roban el PC"** (la preocupación del doc 06 contra el modelo Glop)
se responde así: la nube tiene el espejo (si el módulo está contratado) **y** hay
backup local reciente. Honestidad: **si el cliente NO paga el módulo nube Y el
mini-PC muere Y no hay backup reciente → se pierde hasta el último backup.** Por eso
el módulo nube es también la historia de recuperación ante desastres, y hay que
venderlo así.

---

## 6. Copia de seguridad (dos niveles)

1. **Local (incluida en la base):** a USB/disco cada noche. **Ya construido**
   (`apps/desktop/src/backup.ts`, planificador diario; D2 lo hace visible). Es la
   feature de confianza que desarma la objeción de Glop en la puerta del bar.
2. **Nube (módulo de pago):** copia remota fuera del local. Es un **subproducto
   natural** de la sincronización nodo→nube (la nube ES la copia fuera de sitio),
   más instantáneas periódicas para "volver al estado de anteayer". Es lo que
   protege ante incendio/robo del local entero.

---

## 6-bis. Las fotos: la nube es el archivo, el nodo es la copia de trabajo

Las fotos (productos, categorías, logos) son **datos de configuración**, así que siguen
la regla del §4: bidireccionales con LWW. En concreto:

1. **La nube es el archivo duradero.** Toda foto acaba en el Storage de Supabase: es lo
   que sobrevive a que se queme el local o se rompa el mini-PC.
2. **Al instalar un nodo (o un TPV nuevo): descarga completa por internet.** Se traen el
   catálogo entero **y todas las fotos** al disco del nodo. Una vez, con conexión.
3. **En el día a día, cero internet.** Las terminales piden las fotos **al nodo por la
   LAN**. Van instantáneas aunque el bar lleve una semana sin línea.
4. **Subir una foto sin internet SÍ funciona.** Se guarda en el nodo → todas las
   terminales la ven al momento → la **outbox** la sube a Supabase cuando vuelva la
   conexión. Y si la sube el dueño desde casa (nube), baja al nodo en la siguiente
   sincronización.

No hay conflicto entre "guardarlas en Supabase" y "poder cambiarlas sin internet": son
las dos caras del mismo flujo.

## 6-ter. Actualizar el nodo = código **+ esquema de base de datos**

**Esta es la pieza que nadie piensa y la que duele.** Mandar una versión nueva al parque
no es solo reemplazar un `.exe`: si esa versión trae migraciones nuevas (p. ej. la
`0098`), el nodo tiene que **aplicarlas a su Postgres local** antes de arrancar con el
código nuevo. Reglas:

- **Al arrancar**, el nodo aplica las migraciones pendientes **en orden**. Por eso era
  crítico que las migraciones **reproduzcan la BD desde cero** (auditado el 13-07; lo
  cerró la migración `0096`). Sin eso, esto no se sostiene.
- **Si una migración falla → NO arrancar con el esquema roto**: se queda en la versión
  anterior, no se actualiza, y lo canta en el panel del servidor.
- **Nunca a mitad de servicio.** La descarga va en segundo plano; la instalación se
  aplica en **ventana segura**: de madrugada, o sin ninguna cuenta abierta, o cuando el
  dueño pulsa el botón. (`electron-updater` ya está cableado en `apps/desktop` con
  `autoInstallOnAppQuit = true` — "nunca reiniciar en mitad del servicio". Ese criterio
  se mantiene y se endurece para el servidor.)
- El nodo **reporta su versión** (ya existe: `device.version` + `device_heartbeat`,
  migración 0080), así que desde la nube se ve qué versión tiene cada local.

## 6-quater. El panel del servidor

El servicio deja un **icono en la bandeja**; al abrirlo se ve de un vistazo si el local
está sano. Contenido y qué hay ya construido:

| Bloque | Qué muestra | Estado |
|---|---|---|
| **Servicios** | BD · Datos (PostgREST) · Login · Web · Realtime | ❌ nuevo |
| **Terminales** | Cuáles están en línea ahora mismo | ✅ existe (`device_heartbeat`, 0080) |
| **Impresoras** | Alcanzables o caídas | ✅ existe (tabla `printer`, 0079) |
| **Datos** | Productos, mesas, pedidos de hoy · **cuánto ocupan** la BD y las fotos | ❌ nuevo |
| **Nube** | Internet ✓/✗ · última subida OK · **operaciones pendientes** | ❌ nuevo (la outbox del §4) |
| **Copias** | Última copia, dónde, tamaño | ✅ existe (`backup.ultima`) |
| **Versión** | Versión actual · última actualización · buscar actualizaciones | ✅ existe (`device.version`) |

## 7. El módulo de nube (lo que se cobra)

Coherente con el modelo de módulos del doc [03](03-sistema-de-modulos.md) y el doc 06
(no se cobra "dónde está la BD", se cobran capacidades):

- **Ver desde casa:** el backoffice `app.gluuh.com` lee el espejo en la nube — ventas
  del día, informes, estado de mesas, caja — desde cualquier sitio.
- **Editar desde casa y que baje al TPV:** el dueño cambia precios o añade productos
  en la nube; el cambio viaja nube → nodo → terminales (el refresco de catálogo por
  realtime, **D3, ya existe** para el tramo nodo→TPV). Offline, se aplica al
  reconectar el nodo.
- **Multi-local (ver más de un restaurante):** un dueño es **un `tenant` con N
  `location`** (confirmado en `docs/dossier/06`: "un grupo/cadena es un tenant con
  varios locales"). Cada `location` tiene su nodo; la nube los **agrega** y el
  backoffice muestra todos, con selector de local y vistas consolidadas. La RLS por
  `tenant_id` ya aísla; el filtro por `location_id` ya está en los índices.
- **Backup remoto** (el nivel 2 de §6).

> Matiz de negocio a decidir por el responsable: si "más de un restaurante" incluye
> **empresas legalmente distintas** (franquiciado con varios NIF), eso es
> **multi-tenant** (varios `tenant` bajo una cuenta de acceso), no multi-`location`,
> y es un caso aparte. El caso normal (un dueño, varios locales de la misma empresa)
> es multi-`location` y ya está soportado por el modelo.

---

## 8. Decisión abierta y recomendación: ¿PowerSync o cola propia?

El Bloque E1 deja abierto "PowerSync self-hosted en el nodo vs réplica propia". Con el
modelo de este doc (nodo = fuente de verdad en LAN, sync partido por clase de dato),
la recomendación **ponytail** es:

**Empezar con cola outbox propia, NO PowerSync.** Porque:

- La LAN ya no necesita sync bidireccional por dispositivo (las terminales pegan al
  nodo directo). El único sync es nodo↔nube, y ahí el patrón es simple: outbox
  inmutable hacia arriba (operativo) + LWW por fila (catálogo). Eso son ~2 tablas y
  un worker, no un motor de replicación.
- PowerSync self-hosted añade una infraestructura entera (servicio de replicación,
  reglas de sync, operativa) para un problema que la cola resuelve con Postgres puro
  y el `client_id`/`updated_at` que ya existen.
- Se conserva `packages/sync` como base para el **caso futuro** (móvil-comandera
  offline fuera del WiFi, F4): ahí sí PowerSync por dispositivo gana su sitio.

Es una decisión reversible: si la cola propia se queda corta (muchos locales, mucho
volumen), se migra a PowerSync self-hosted sin cambiar el modelo de datos (mismas
tablas, mismos campos de sync). La guía 16 implementa la cola.

---

## 9. Qué cambia respecto a los docs previos

- **doc 06:** se mantiene entero salvo el punto "la nube es la fuente de verdad y no
  hay servidor local" → ahora **el nodo local es la fuente de verdad operativa**. Se
  añade una nota de superación al principio del doc 06 apuntando aquí.
- **guía [06-offline-powersync](../implementacion/06-offline-powersync.md):** su
  diseño de PowerSync **por dispositivo** deja de ser el camino principal. Se
  conserva como referencia del caso futuro F4 (móvil offline). El camino principal
  (nodo + cola) está en la **guía 16**.
- **doc 09 Bloque E:** sigue siendo el plan de trabajo; la guía 16 le pone el DDL y
  el detalle de fichero.

---

## 10. Riesgos y bordes a vigilar

- **Numeración fiscal offline:** el único conflicto real. Cada nodo/dispositivo
  reserva un rango (`number_range` + `reservar_rango()`, doc 09 E2 / guía 06 fase 3);
  dos TPV del mismo local no repiten número. VERIFACTU admite remisión diferida: se
  emite local y se remite a AEAT al reconectar. **Es la última pieza antes de vender**
  (doc 09 F1).
- **El nodo es un punto único de fallo dentro del local.** Mitigación: arranque
  automático como servicio (E5), fallback a nube (E4) y backup frecuente. Un segundo
  nodo en caliente es sobre-ingeniería para un bar (YAGNI); para cadenas grandes,
  reevaluar.
- **Reloj del mini-PC:** el LWW por `updated_at` y la huella VERIFACTU dependen de la
  hora. Un mini-PC con la hora mal descuadra el "gana la última edición" y la cadena
  fiscal. Sincronizar por NTP al arrancar y avisar si hay deriva grande.
- **Primer arranque / provisión del nodo:** al instalar el nodo hay que sembrarlo con
  el tenant y su catálogo desde la nube (o desde el pack de entrega). Definido en la
  guía 16 fase 1.

---

## 11. Siguiente paso

La ejecución está en **[guía 16 — Nodo local y sincronización](../implementacion/16-nodo-local-y-sincronizacion.md)**:
DDL de la outbox y el estado de sync, el `/sync/upload` real, el empaquetado del nodo
como servicio, mDNS + fallback, los dos niveles de backup y la agregación multi-local.
Reutiliza el Bloque E (E1-E5) del doc 09 y sustituye el camino de la guía 06 por el
modelo de nodo.
