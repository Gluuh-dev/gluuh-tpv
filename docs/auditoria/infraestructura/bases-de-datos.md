# Bases de datos y servicios — el stack de datos del TPV Gluuh

> **Qué BD usamos, dónde vive cada dato y qué servicios necesitamos para funcionar bien.** La respuesta no es "una base de datos", sino **tres capas coordinadas**: la **nube Supabase (PostgreSQL)** como verdad canónica, una **SQLite local por dispositivo** para operar sin internet, y un **servidor LAN edge opcional** en el PC del local. Las une **PowerSync**; las protege **RLS por `tenant_id`**; las completa un puñado de servicios gestionados (Auth, Storage, Realtime, Edge Functions). Complementa [`cuentas-y-acceso.md`](cuentas-y-acceso.md), [`servicio-local-pc.md`](servicio-local-pc.md) y, en detalle técnico, [`../implementacion/modelo-de-datos.md`](../implementacion/modelo-de-datos.md) y [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md). El "qué" del modelo de datos y sincronización está en [`../../06-base-de-datos-y-sincronizacion.md`](../../06-base-de-datos-y-sincronizacion.md).

---

## 1. Qué BD usamos y por qué

### 1.1 PostgreSQL (Supabase) como verdad canónica

La fuente de verdad **canónica** del negocio es **PostgreSQL gestionado por Supabase**, en la UE. No es una elección cosmética; es el motor que hace posible todo lo demás:

| Necesidad del TPV | Qué da PostgreSQL/Supabase |
|---|---|
| **Multi-tenant seguro** | **Row-Level Security (RLS)** nativa: el aislamiento por `tenant_id` vive en la base, no en el cliente. Sin contexto → cero filas. |
| **Datos flexibles** | **JSONB** para modificadores de línea, configuración (`setting`), programación de promociones, sin migrar el esquema por cada opción. |
| **Sincronización** | **Logical replication / CDC**, base sobre la que PowerSync construye los buckets. |
| **Integridad fiscal** | Transacciones ACID sólidas: la numeración correlativa y la huella encadenada VERIFACTU no toleran "casi". |
| **Informes** | Vistas, **materialized views**, funciones RPC `security definer` para agregar server-side. |
| **Operación gestionada** | Backups con PITR, Auth, Storage, Realtime y Edge Functions en la misma plataforma → menos piezas que operar. |
| **Escala** | Escala vertical/horizontal real, particionado por fecha, índices compuestos; soporta de un bar a una cadena. |

### 1.2 SQLite local (como hace Ágora) — pero no como única verdad

Ágora y la mayoría de TPV de mostrador serios guardan su operativa en una **SQLite local** dentro del propio terminal. El motivo es innegociable en hostelería: **un TPV no puede caerse en hora punta** porque se fue la fibra. Por eso **cada dispositivo Gluuh lleva su propia SQLite** y lee/escribe contra ella de forma **instantánea, sin esperar a la red**.

La diferencia con el modelo "solo SQLite" de un TPV clásico es clave:

- En un TPV clásico monopuesto, **la SQLite local *es* la verdad** y la nube (si existe) es un volcado posterior. Difícil de escalar a varios locales, frágil ante pérdida del equipo, complicado para informes de cadena.
- En Gluuh, **la SQLite local es la verdad *operativa*** (rápida, offline), pero **la nube es la verdad *canónica*** (duradera, multi-local, auditada). PowerSync las reconcilia. Las SQLite locales son **recreables** desde la nube: si se pierde una tablet, no se pierde un solo ticket.

> **Regla mental:** *la SQLite local nunca bloquea; la nube nunca miente.* Lo que el camarero necesita (carta, mesas, cobrar, ticket) está en local al instante; lo que necesita el negocio (histórico, informes, cumplimiento) vive consolidado en la nube.

---

## 2. Capas de datos

Tres capas, con responsabilidades distintas y no negociables.

```
┌────────────────────── (3) NUBE · Supabase (PostgreSQL) ─────────────────────┐
│  VERDAD CANÓNICA · multi-tenant RLS · UE                                     │
│  PostgreSQL  ·  Auth  ·  Storage  ·  Realtime  ·  Edge Functions / RPC       │
│  PowerSync Service (buckets por tenant_id + location_id)                     │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                     │  internet (intermitente)
┌──────────────── (2) SERVIDOR LAN edge · opcional, PC del local ─────────────┐
│  CACHE COHERENTE entre terminales · funciona aunque caiga la fibra          │
│  PowerSync/Postgres local  ·  print server  ·  puente de hardware           │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                     │  LAN (Ethernet / WiFi del local)
┌──────────────── (1) DISPOSITIVO · SQLite local por terminal ────────────────┐
│  VERDAD OPERATIVA · offline-first · latencia cero                           │
│  TPV (Tauri) · Comandera (PWA/Expo) · KDS (PWA) · Pantalla (PWA)            │
│  @gluuh/core en el dispositivo: huella + QR VERIFACTU sin red               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Capa 1 — SQLite local por dispositivo (operativa offline)

- Cada terminal (TPV de caja, comandera, KDS, pantalla) tiene una **SQLite gestionada por PowerSync**.
- Solo contiene los **datos calientes**: la carta vigente, las mesas, las comandas abiertas, los últimos cierres, las últimas N semanas de tickets. **No** el histórico completo.
- `@gluuh/core` corre **aquí**: calcula la huella SHA-256 encadenada y el QR VERIFACTU **sin red** → el ticket sale impreso al instante (ver §6 y [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) §3).

### 2.2 Capa 2 — Servidor LAN edge (opcional, recomendado en locales grandes)

- Un **mini-PC o NAS en la LAN** (a menudo el propio PC del local que hospeda el **servicio Gluuh**, ver [`servicio-local-pc.md`](servicio-local-pc.md)) corre una instancia de **PowerSync/Postgres local** + el namespace de tiempo real + el print server.
- **Para qué:** si cae internet, los terminales **siguen sincronizando entre sí por la LAN** — la comanda llega del móvil al KDS sin pasar por la nube. Es un **edge cache coherente**, no una segunda verdad: sube a la nube al reconectar.
- En locales pequeños (1–2 terminales) **es prescindible**: cada SQLite local basta y la nube reconcilia.

### 2.3 Capa 3 — Nube Supabase (verdad canónica + servicios)

- **PostgreSQL** con RLS: el registro duradero, auditado y multi-local.
- **Servicios gestionados** alrededor (Auth, Storage, Realtime, Edge Functions) — §4.
- **PowerSync Service**: el componente que define los buckets y reconcilia con cada SQLite.

### 2.4 Tabla — qué dato vive dónde, y por qué

| Dato | SQLite local | LAN edge | Nube (canónica) | Por qué |
|---|:---:|:---:|:---:|---|
| **Carta vigente** (productos, precios, modificadores, alérgenos) | ✅ copia | ✅ cache | ✅ **origen** | Se configura en la nube, baja sincronizada; el TPV la lee offline. |
| **Mesas / plano / estado de mesa** | ✅ | ✅ | ✅ | Operativa caliente; estado de mesa con LWW por timestamp **de servidor**. |
| **Comandas abiertas** (`order`, `order_line`) | ✅ **escritura** | ✅ relay | ✅ consolida | Se crean offline; inserciones inmutables → sin conflicto. |
| **Pagos / cobros** | ✅ **escritura** | ✅ relay | ✅ consolida | Idempotentes por `client_id` UUID; nunca se cobra dos veces. |
| **Registro VERIFACTU** (huella, QR, CSV) | ✅ se genera | ✅ encola | ✅ **persiste + envía AEAT** | Huella en local (determinista); envío a AEAT diferido desde la nube/API. |
| **Numeración fiscal** (series, siguiente nº) | ✅ rango/serie asignado | — | ✅ **árbitro** | Serie por terminal offline; el backend valida la continuidad al subir. |
| **Histórico de tickets / informes** | ❌ (bajo demanda) | ❌ | ✅ **único sitio** | Datos fríos; consultarlos en hora punta no debe pesar en el dispositivo. |
| **Stock de ingredientes** | ✅ deltas | ✅ | ✅ reconcilia | Decrementos **relativos**, no valores absolutos (menos conflictos). |
| **Usuarios / roles / permisos** | ✅ subconjunto del local | ✅ | ✅ **origen** | El PIN por superficie se valida en local; el alta vive en la nube. |
| **Logos, imágenes de producto** | ✅ cache | ✅ cache | ✅ **Storage** | Binarios en Storage con URL; se cachean para mostrar offline. |
| **Certificado mTLS VERIFACTU (.p12)** | ❌ **nunca** | ❌ **nunca** | 🔒 **Storage privado + referencia en BD** | Secreto crítico: solo lo usa `apps/api`; el cliente jamás lo toca (§4.3). |
| **Configuración (`setting` GLOBAL/LOCAL/DEVICE)** | ✅ resuelta para el device | ✅ | ✅ **origen** | Baja sincronizada; el dispositivo aplica la resolución DEVICE→LOCAL→GLOBAL. |

> **Principio de reparto:** *cliente = lo necesario para operar mi local ahora*; *nube = todo, para siempre, de todos los locales*. Cuanto más estrecho es el bucket de un dispositivo, mejor rendimiento, más privacidad y menos superficie de ataque.

---

## 3. Sincronización — PowerSync

La sincronización **no se construye a mano**. Es el riesgo número uno del proyecto y **PowerSync** lo resuelve (ver regla nº1 en [`../../06-base-de-datos-y-sincronizacion.md`](../../06-base-de-datos-y-sincronizacion.md) §7).

### 3.1 Buckets por `tenant_id` + `location_id`

PowerSync define **"sync rules"** que agrupan los datos en **buckets**:

- Un bucket por **`tenant_id`** (datos del tenant: catálogo, usuarios, config).
- Sub-segmentado por **`location_id`** (operativa del local: mesas, comandas, cobros).
- Una tablet de la sala de un local **nunca descarga** datos de otro local ni de otro tenant.
- El claim del bucket sale del **mismo `tenant_id`/`location_id` del JWT** que activa la RLS → un solo origen de verdad para el aislamiento.

```
TENANT (cadena)
  └── LOCATION (local físico) ← location_id
        ├── 🖥 TPV (Tauri)        ─┐
        ├── 📱 Comandera (PWA)     ├─ bucket PowerSync = tenant_id + location_id
        ├── 👨‍🍳 KDS (PWA)           │  → descarga SOLO su local
        └── 🪧 Pantalla (PWA)     ─┘
```

### 3.2 Cola de escritura idempotente, validada por NestJS

PowerSync sincroniza en **ambos sentidos**, pero las **escrituras no entran crudas en Postgres**: pasan por el **write-path de NestJS** (`/sync/upload`), que valida **RBAC + fiscal + numeración** antes de persistir.

```
┌──────────── DISPOSITIVO ────────────┐
│ UI React ─► SQLite local ─► cola de  │
│            (verdad operativa)  escritura (uuid cliente) │
└───────────────────┬──────────────────┘
                    │  al haber red (directo o vía LAN edge)
                    ▼
┌──────────── API NestJS (write-path) ─────────┐
│  valida: RBAC por tenant · lógica fiscal ·   │
│  numeración legal VERIFACTU · idempotencia   │
└───────────────────┬───────────────────────────┘
                    ▼
┌──────────── PostgreSQL (canónico) ──────────┐
│  persiste ─► CDC/replicación ─► PowerSync    │
│  Service ─► baja a las SQLite del local      │
└───────────────────────────────────────────────┘
```

- **Idempotencia:** cada mutación lleva un **`client_id` (UUID)** generado en el dispositivo. Un reenvío tras reconexión **no duplica** comanda, pago ni factura (UPSERT por ese id, dedup en backend).
- **Reintentos:** si no hay red, las mutaciones se acumulan en SQLite y se reenvían con **backoff exponencial** (1s, 2s, 4s… máx 5 min). El usuario sigue cobrando.
- **Conflictos:** modelamos el dominio como **inserciones inmutables** (~90% de las operaciones de hostelería son inserts → sin conflicto). Para los pocos campos mutables compartidos (estado de mesa), **last-write-wins por timestamp de servidor**; el stock con **decrementos relativos**; la numeración fiscal **la arbitra el servidor**.

> **Por qué no escribir directo a Postgres desde el cliente:** porque la frontera de seguridad y de legalidad es el backend, no la UI. La RLS protege el aislamiento, pero la **lógica fiscal y la numeración legal** exigen un punto único validado. Nada "sucio" entra en la verdad canónica.

---

## 4. Servicios necesarios para funcionar

Más allá de las tablas, el TPV necesita cuatro servicios gestionados de Supabase. Para cada uno: **para qué sirve · cómo lo resolvemos · qué necesitamos · prioridad**.

### 4.1 Auth — identidad de usuarios y dispositivos

- **Para qué sirve:** que el dueño/encargado entre al backoffice; que cada terminal del local tenga una sesión; que el JWT porte `tenant_id` + `location_id` que activan RLS y buckets.
- **Cómo lo resolvemos:** **Supabase Auth** emite el JWT con los claims de tenant/local. En el local, sobre esa sesión de dispositivo se valida un **PIN por superficie** (RPC `validar_pin`) que identifica al empleado del turno sin re-login (terminal compartido). El **servicio del PC** se da de alta con usuario+contraseña de la empresa y obtiene un token de servicio (ver [`cuentas-y-acceso.md`](cuentas-y-acceso.md)).
- **Qué necesitamos:** Supabase Auth configurado con claims personalizados (`tenant_id`, `location_id`, `role`); RPC `validar_pin`; tokens de servicio/dispositivo para el nodo LAN.
- **Prioridad:** 🔴 **Crítica** — sin identidad no hay RLS ni aislamiento.

### 4.2 Realtime — KDS, estado de mesa, eventos

- **Para qué sirve:** que el KDS de cocina vea la comanda en cuanto el camarero la envía; que el estado de mesa y la pantalla de cliente se actualicen en vivo; el dashboard del día.
- **Cómo lo resolvemos:** **dos capas separadas** (ver [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) §2.3):
  - **Datos durables** — Supabase Realtime (hoy) → PowerSync (objetivo): la comanda y sus estados, que **sobreviven a un reinicio** y replican a la SQLite. El KDS **nunca depende** de un evento efímero para tener el dato.
  - **Eventos efímeros** — Socket.IO en la LAN: la "campana" de nueva comanda, "mesa lista", bump. Avisos, no datos.
- **Qué necesitamos:** canales Realtime `cocina`/`pantalla` sobre `sales_order` (ya existen); a futuro, el gateway Socket.IO en LAN.
- **Prioridad:** 🟠 **Alta** — el KDS sin tiempo real no es un KDS.

### 4.3 Storage — logos, imágenes de producto y certificados (con cuidado)

- **Para qué sirve:** binarios que no van en la BD: **logos del tenant**, **fotos de producto**, plantillas de ticket, y —caso delicado— el **certificado VERIFACTU**.
- **Cómo lo resolvemos:**
  - Logos e imágenes de producto: **bucket de Storage** con políticas por `tenant_id`; URL en la BD (`logo_url`, `foto_url`); se **cachean en el dispositivo** para mostrarse offline.
  - **Certificado mTLS VERIFACTU (.p12):** **NUNCA en el cliente, nunca en una SQLite local.** Se guarda en un **bucket privado de Storage** (o gestor de secretos) y en la BD solo una **referencia segura** (`verifactu_config.certificado_ref`). Lo usa **exclusivamente `apps/api`** para hablar con la AEAT por mTLS. El `.p12` en claro jamás sale del backend.
- **Qué necesitamos:** buckets Storage (público con políticas para imágenes; **privado** para certificados); columna de referencia, no el binario; CDN para imágenes.
- **Prioridad:** 🟠 **Alta** (imágenes) · 🔴 **Crítica** (manejo seguro del certificado).

### 4.4 Edge Functions / RPC — informes y envío a la AEAT

- **Para qué sirve:** cómputo server-side que no debe correr en el cliente: **informes agregados** (nunca traer 50k filas al navegador) y orquestación del **envío de lotes VERIFACTU a la AEAT**.
- **Cómo lo resolvemos:**
  - **Informes = funciones RPC/vistas** en Postgres (`rpt_<informe>(params)`), `security definer`, con RLS por `current_tenant_id()`, que agregan (`SUM/COUNT/GROUP BY`) y bajan solo el resultado. Histórico sobre **vistas materializadas** refrescadas en el cierre.
  - **Envío AEAT** lo dispara el write-path/NestJS (donde vive el certificado mTLS); Edge Functions/cron pueden orquestar reintentos y el refresco de materializadas.
- **Qué necesitamos:** una RPC por informe (base ya hecha: 11 informes reales); vistas materializadas; cron de refresco; el cliente AEAT con mTLS en `apps/api`.
- **Prioridad:** 🟠 **Alta** (informes) · 🔴 **Crítica** (envío AEAT, por ley).

---

## 5. Multi-tenant + RLS

Modelo: **shared schema + columna `tenant_id` + RLS**. El aislamiento vive **en la base, no en el cliente** (ver [`../../06-base-de-datos-y-sincronizacion.md`](../../06-base-de-datos-y-sincronizacion.md) §2 y [`../implementacion/modelo-de-datos.md`](../implementacion/modelo-de-datos.md) §0).

### 5.1 Patrón de aislamiento (canónico)

```sql
-- Toda tabla de negocio: tenant_id NOT NULL + RLS forzada
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE  ROW LEVEL SECURITY;   -- la app NO usa BYPASSRLS
CREATE POLICY orders_rw ON public.orders FOR ALL
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
```

- `current_tenant_id()` lee `current_setting('app.tenant_id')`, que la app fija por petición desde el `tenant_id` del **JWT** (`SET LOCAL app.tenant_id = …`).
- **Seguro por defecto:** sin contexto de tenant, las políticas devuelven **cero filas**.
- El rol de aplicación **no** tiene `BYPASSRLS`; los **secretos** (service-role) solo en `apps/api`.

### 5.2 Índices por `tenant_id` + fecha (regla de oro de rendimiento)

Con RLS, **`tenant_id` debe ser la primera columna de los índices compuestos**; si no, las consultas pueden ir **100× más lentas**.

```sql
CREATE INDEX idx_orders_tenant_location_status
  ON orders (tenant_id, location_id, status);
CREATE INDEX idx_invoice_tenant_fecha
  ON invoice (tenant_id, fecha);          -- informes por rango de fechas
```

### 5.3 Vistas y materializadas para informes

- Cada informe es una **vista/RPC** con RLS, no una consulta cruda desde el cliente.
- El **histórico** se sirve sobre **materialized views** refrescadas en el cierre de caja, para no calcular sobre la operativa en hora punta.
- **Coherencia fiscal:** Resumen Fiscal, Diario de Facturas y Documento 347 deben cuadrar con VERIFACTU (`@gluuh/core`) y con las series.

---

## 6. El flujo de un dato: una venta, del dispositivo a la nube

```
┌──────────────────────── EN EL TERMINAL (offline-first) ────────────────────────┐
│ 1. Camarero añade líneas a la comanda                                          │
│      → INSERT en SQLite local (instantáneo, sin red)                            │
│ 2. Cobra                                                                        │
│      → @gluuh/core EN EL DISPOSITIVO:                                            │
│           · nº de serie POR TERMINAL (TPV1-2026-…)                              │
│           · huella SHA-256 encadenada (determinista, vector AEAT)               │
│           · construirUrlQR() → QR de cotejo                                      │
│      → imprime ticket YA con su QR  (cliente servido al instante)               │
│      → encola en SQLite: order + payment + registro VERIFACTU                   │
│        cada mutación con client_id (UUID) para idempotencia                     │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    │  cola de escritura (backoff exponencial)
                                    ▼  (directa, o por el LAN edge si no hay internet)
┌──────────────────────── API NestJS (write-path) ──────────────────────────────┐
│ 3. /sync/upload valida:                                                         │
│      · RBAC por tenant (¿este usuario/terminal puede?)                          │
│      · fiscal (¿base/cuota cuadran? ¿clase × territorio correcta?)              │
│      · numeración (¿la cadena de esta serie encadena sin huecos?)              │
│      · idempotencia (¿ya vi este client_id? → no duplicar)                      │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    ▼
┌──────────────────────── PostgreSQL / Supabase (canónico) ─────────────────────┐
│ 4. Persiste order, payment, invoice, verifactu_record (RLS por tenant_id)      │
│ 5. CDC/replicación → PowerSync Service → baja a las SQLite de TODOS los         │
│    terminales del local (el KDS ya tenía la comanda por Realtime)              │
│ 6. apps/api remite el lote VERIFACTU a la AEAT por mTLS (certificado en backend)│
│      → estado_aeat actualizado; visible en el Visor VERIFACTU del backoffice   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

> **Lo que el cliente necesita (ticket + QR) se resuelve en local al instante; lo que necesita Hacienda (recepción del registro) se sincroniza después.** Nunca se bloquea un cobro por falta de red.

---

## 7. Backups y retención

| Aspecto | Cómo lo resolvemos |
|---|---|
| **Backups de la nube** | **PITR** (point-in-time recovery) gestionado por Supabase + export periódico **cifrado**. |
| **SQLite locales** | **No son backup**: son recreables desde la nube. Perder una tablet no pierde datos. |
| **Retención fiscal** | Registros de facturación y VERIFACTU **≥ 6 años** (criterio mercantil). **No se borran**, ni siquiera ante una solicitud RGPD de borrado del cliente final. |
| **Export por tenant (RGPD)** | Procedimiento de **portabilidad**: export completo de los datos de un tenant a formato abierto (derecho de acceso/portabilidad, art. 15/20 RGPD). |
| **Borrado RGPD selectivo** | Bloqueo/anonimización de **datos personales** (cliente de fidelización) tras el plazo legal, **preservando** el registro fiscal asociado (la factura no se borra; se desvincula el dato personal). |
| **Migraciones** | Versionadas en `supabase/migrations/*.sql`; **cambios aditivos preferidos** (compatibles con sync; PowerSync re-sincroniza el esquema del cliente). `apps/api/db/schema.sql` es **espejo** de referencia. |

> **Tensión a gestionar:** *retención fiscal (no borrar) vs. derecho al olvido (borrar)*. Se resuelve separando el **registro fiscal** (se conserva ≥6 años) del **dato personal** (se anonimiza). La factura sobrevive; el nombre del cliente, no.

---

## 8. Rendimiento y escala

| Técnica | Cuándo / por qué |
|---|---|
| **Índices con `tenant_id` primero** | Siempre. Con RLS, evita escaneos 100× más lentos (§5.2). |
| **Paginación server-side** | Listados de tickets/productos: nunca traer todo al cliente; `LIMIT/OFFSET` o keyset por fecha. |
| **Agregación en RPC/vistas** | Informes: `SUM/COUNT/GROUP BY` en Postgres, baja solo el resultado (§4.4). |
| **Materialized views** | Históricos pesados; refresco en el cierre, no en hora punta. |
| **Particionado por fecha** | Tablas grandes (`order`, `order_line`, `invoice`) **cuando crezca el volumen** — particionar por `tenant_id`/mes. |
| **Buckets estrechos** | Limitar la SQLite local a lo necesario (últimas N semanas) → menos peso, mejor arranque, más privacidad. |
| **Datos calientes vs. fríos** | Local = operativa reciente; nube = histórico bajo demanda. |

---

## 9. Residencia de datos y RGPD (UE)

- **Residencia:** PostgreSQL/Supabase y Storage en **región de la UE** (datos fiscales y personales de clientes españoles no salen de la UE).
- **Cifrado:** en reposo (gestionado) y en tránsito (TLS); el certificado mTLS AEAT en bucket privado/gestor de secretos.
- **Base legal y minimización:** se recogen solo los datos necesarios; el cliente de fidelización requiere **consentimiento** explícito.
- **Derechos del interesado:** acceso/portabilidad vía export por tenant (§7); borrado/anonimización **selectiva** preservando el registro fiscal.
- **Secretos fuera del repo y del cliente:** `.env*` en `.gitignore`; solo `.env.example` versionado. Service-role de Supabase, claves de pasarela y certificado AEAT **solo en `apps/api`/agente** (ver [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) §7).

---

## 10. Tabla resumen — decisiones del stack de datos

| Decisión | Elección | Prioridad |
|---|---|:---:|
| Motor canónico (nube) | **PostgreSQL / Supabase** (UE) | 🔴 Crítica |
| BD local por dispositivo | **SQLite** vía PowerSync | 🔴 Crítica |
| Capa intermedia LAN | **Servidor edge** (PowerSync/Postgres local) en el PC del local | 🟡 Recomendada (locales grandes) |
| Multi-tenant | **shared schema + `tenant_id` + RLS** (seguro por defecto) | 🔴 Crítica |
| Sincronización | **PowerSync** bidireccional, buckets `tenant_id`+`location_id` | 🔴 Crítica |
| Write-path | **NestJS** valida RBAC + fiscal + numeración; nada crudo en Postgres | 🔴 Crítica |
| Idempotencia | **`client_id` UUID** por mutación | 🔴 Crítica |
| Identidad | **Supabase Auth** (JWT con `tenant_id`/`location_id`) + PIN por superficie | 🔴 Crítica |
| Tiempo real | **Realtime** durable (KDS/mesa) + **Socket.IO LAN** efímero | 🟠 Alta |
| Storage | imágenes públicas con políticas; **certificado VERIFACTU privado**, nunca en cliente | 🟠/🔴 |
| Informes | **RPC/vistas + materializadas** en Postgres, agregación server-side | 🟠 Alta |
| Backups | **PITR** + export cifrado; SQLite locales recreables | 🔴 Crítica |
| Retención fiscal | registros VERIFACTU **≥ 6 años**, no borrar | 🔴 Crítica (legal) |
| Residencia | **región UE**; RGPD con borrado selectivo del dato personal | 🔴 Crítica (legal) |

---

*Documento de auditoría · Infraestructura — Bases de datos y servicios. Relacionados:*
*[`README.md`](README.md) · [`cuentas-y-acceso.md`](cuentas-y-acceso.md) · [`servicio-local-pc.md`](servicio-local-pc.md) · [`hardware-deteccion-y-configuracion.md`](hardware-deteccion-y-configuracion.md) ·*
*[`../implementacion/modelo-de-datos.md`](../implementacion/modelo-de-datos.md) · [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) ·*
*[`../01-arquitectura-y-plataforma/`](../01-arquitectura-y-plataforma/) · [`../../06-base-de-datos-y-sincronizacion.md`](../../06-base-de-datos-y-sincronizacion.md).*
