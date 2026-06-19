# Infraestructura › Hardware: detección y configuración (impresoras y pantallas)

> **Cómo conectamos, detectamos y configuramos** impresoras de ticket y pantallas
> (cliente, KDS, visor) en Gluuh. El navegador **no** habla con hardware serie/USB/ESC‑POS;
> lo hace el **servicio local del PC** (puente de hardware — ver
> [`servicio-local-pc.md`](servicio-local-pc.md)). Aquí se decide qué se **autodetecta**,
> cómo se **lista**, cómo el usuario lo **configura** desde el backoffice (estilo
> Supabase/Notion) y cómo se valida con una **impresión/prueba**. Profundiza en lo que
> [04 — Impresión y tickets](../04-impresion-y-tickets/) (vías ESC/POS, plantillas) y
> [09 — Hardware](../../09-hardware.md) (modelos, precios) ya cubren, y mapea a la entidad
> `printer` y a las asignaciones de [puntos de venta](../09-referencia-configurador-agora/administracion/puntos-de-venta.md)
> y [centros de venta](../09-referencia-configurador-agora/administracion/centros-de-venta.md).

---

## El principio de partida

> El **JS de un navegador o una PWA no abre sockets TCP crudos, ni USB, ni serie, ni
> Bluetooth clásico** (sandbox). Por eso **todo el descubrimiento y el envío de bytes
> ESC/POS los hace el servicio local** instalado en el PC del local (el "nodo local"):
> escanea la LAN, enumera USB/serie, empareja Bluetooth, enumera monitores del SO, y expone
> a la web/app una **API limpia** (WebSocket/REST en LAN) del tipo "estas son las impresoras
> y pantallas que veo; imprime este `PrintJob`; abre el cajón; lista displays".

```
   ☁ Backoffice (Next.js, Supabase)          🖥 PC del local
   "Dispositivos detectados"        ──LAN──►  SERVICIO GLUUH (puente de hardware)
   listar · nombrar · asignar                 ├─ escaneo de red (9100 + mDNS + SNMP)
   plantilla · probar                         ├─ enumeración USB / serie
        ▲                                      ├─ emparejamiento Bluetooth
        │  config (entidad printer / display)  ├─ enumeración de monitores del SO
        └──────────── Supabase ◄──────────────┘  └─ cola de impresión + estado
```

La carta de impresión hablada en [04 §2](../04-impresion-y-tickets/) (RAW 9100, ePOS‑Print,
CloudPRNT, Bluetooth/Sunmi, agente) es el **transporte**; este documento es **cómo
encontramos cada impresora y la damos de alta** sin que el usuario teclee IPs a mano.

---

## Impresoras de ticket

### Tipos de conexión

**Para qué sirve** · cada local tiene un parque heterogéneo (cocina fija de impacto, barra
térmica de red, comandera Sunmi en mano, impresora de delivery en la nube). Necesitamos
soportar todas con el **mismo modelo de datos** (`printer.via`).

**Cómo lo resolvemos** · una sola entidad `printer` con un campo `via` que selecciona el
transporte; el servicio local implementa cada uno. Tabla:

| Vía | `printer.via` | Transporte | ¿Autodetectable? | Pros | Contras | Cuándo |
|-----|---------------|-----------|:----------------:|------|---------|--------|
| **Red RAW 9100** | `raw9100` | TCP socket → IP:9100 (ESC/POS crudo) | ✅ (sonda 9100 + mDNS + SNMP) | Universal, fiable, offline en LAN, cualquier marca | Necesita IP estable (reserva DHCP) | **Cocina/barra fijas** — vía principal |
| **ePOS‑Print** (Epson) | `epos` | HTTP(S) al mini‑servidor de la impresora | ✅ (mDNS `_http`/SNMP, modelo Epson) | Sin drivers, imprime desde el propio navegador | Solo Epson; iOS irregular | **Web POS** en red local con Epson |
| **CloudPRNT** (Star) | `cloudprnt` | REST inverso: la impresora hace *polling* a nuestra nube | ⚙️ se **autorregistra** (no se escanea) | Sin abrir puertos, ideal remoto/delivery | Latencia de polling (2–10 s), depende de la nube, solo Star | **Delivery/pedidos online** a cocina |
| **USB** | `usb` | USB‑Print (clase impresora) vía servicio local | ✅ (enumeración USB: VID/PID) | Plug‑and‑play en el PC del TPV | Atado a ese PC; sin red | TPV de mostrador con su térmica |
| **Bluetooth / Sunmi** | `bt` / `sunmi` | SPP/BLE o `InnerPrinter` SDK (app nativa) | ✅ (emparejamiento BT) / ⚙️ integrada | Imprime en mano, en la mesa | Atada al dispositivo y su SDK; alcance BT | **Comandera móvil**, cobro en mesa |
| **Serie (RS‑232/COM)** | `serial` | Puerto COM vía servicio local | ⚠️ parcial (enumerar COM, no el modelo) | Hardware legacy, balanzas/visores | Hay que fijar baudios a mano | Equipos antiguos, visor VFD |

> **Decisión Gluuh.** Camino crítico (comanda a cocina, ticket de cobro) por **RAW 9100 en
> LAN** desde el servicio local → **funciona sin internet**. **CloudPRNT** solo para
> delivery. **ePOS‑Print** como comodín para web POS con Epson. Comandera **Sunmi** por su
> impresora integrada. Coincide con la recomendación de [04 §2.2](../04-impresion-y-tickets/)
> y [09 §2‑3](../../09-hardware.md).

**Qué necesitamos** · implementar en `packages/hardware` un `Transport` por `via` detrás de
la interfaz `Printer` existente; reserva DHCP por impresora ([09 §8](../../09-hardware.md)).

**Prioridad** · 🔴 Alta — `raw9100` primero (cubre el 80%), luego `epos` y `sunmi`.

---

### Detección automática (la clave)

**Para qué sirve** · que el instalador **no teclee IPs ni VID/PID**. Pulsa "Buscar
dispositivos" y la app muestra lo que hay enchufado en el local. Es la diferencia entre una
instalación de 30 segundos y una tarde de soporte telefónico.

**Cómo lo resolvemos** · el servicio local ejecuta, en paralelo, cuatro sondas y consolida
los hallazgos en una lista de **candidatos** (sin duplicar la misma impresora vista por dos
vías — se deduplica por MAC/serial):

1. **Escaneo de red (impresoras IP).**
   - **Sonda al puerto 9100**: por cada host vivo de la subred (`/24` por defecto), intento
     de conexión TCP a `:9100`; si abre, es candidata RAW/ESC‑POS.
   - **mDNS / Bonjour** (descubrimiento sin escanear toda la subred, lo preferido):
     consultar los servicios **`_printer._tcp`**, **`_pdl-datastream._tcp`** (RAW 9100),
     **`_ipp._tcp`** y **`_http._tcp`**. Devuelven nombre anunciado, host, puerto y a menudo
     el **modelo** en el TXT (`ty=`, `usb_MDL=`). Las Epson/Star modernas se anuncian solas.
   - **SNMP** (modelo, fabricante y **estado** real): tras encontrar una IP, consultar
     `sysDescr` (1.3.6.1.2.1.1.1) y la MIB de impresora (`prtMarkerSupplies`,
     `hrPrinterStatus`, `prtAlertDescription`) para sacar **marca/modelo**, nivel de papel y
     errores. Permite mostrar "Epson TM‑m30III · sin papel" sin que el usuario lo sepa.

2. **Enumeración USB** · listar dispositivos de **clase impresora** (USB‑Print) por VID/PID;
   mapear VID conocido → fabricante (Epson `04B8`, Star `0519`, Bixolon `1504`…). Plug‑and‑play.

3. **Enumeración serie** · listar puertos COM disponibles (no se puede inferir el modelo →
   el usuario confirma baudios). Útil para visor VFD/balanza.

4. **Emparejamiento Bluetooth** · listar dispositivos BT/BLE emparejados o a la vista cuyo
   perfil sea SPP/impresora; en **Sunmi** la `InnerPrinter` ya viene integrada (cero pasos).

5. **Impresoras "cloud" que se registran solas** · **CloudPRNT** (Star) y **ePOS** con
   servidor: no se escanean; la impresora, configurada con la URL de nuestro endpoint, hace
   *polling* / *handshake* y **aparece en la lista al primer contacto** con su serial. El
   usuario solo la **adopta** (le pone nombre y asignaciones).

```
            ┌──────────────────────── SERVICIO LOCAL ────────────────────────┐
   "Buscar" │   ┌─ sonda :9100 ─┐  ┌─ mDNS _printer/_pdl ─┐  ┌─ SNMP modelo/estado ─┐  │
   ────────►│   │ red /24        │  │ anunciadas           │  │ marca · papel · error│  │
            │   └────────┬───────┘  └──────────┬───────────┘  └──────────┬───────────┘  │
            │   ┌─ USB (VID/PID) ─┐  ┌─ Serie (COM) ─┐  ┌─ Bluetooth (SPP/BLE) ─┐       │
            │   └────────┬────────┘  └──────┬────────┘  └──────────┬────────────┘       │
            │            └──────────── dedup por MAC/serial ───────┘                    │
            │   (+ cloud: CloudPRNT/ePOS que se autorregistran por handshake)           │
            └──────────────────────────────┬──────────────────────────────────────────┘
                                           ▼
                              Lista de CANDIDATOS → la app
```

**Qué se autodetecta y qué no:**

| Sí se autodetecta | No (o parcial) |
|-------------------|----------------|
| Impresoras IP en LAN (9100/mDNS) y su **modelo/estado** (SNMP) | El **rol** que cumple (cocina vs barra) — lo decide el usuario |
| Impresoras USB (fabricante por VID) | El **ancho** real de papel si el modelo no lo expone (58/80) — confirmar |
| Impresoras BT emparejadas; Sunmi integrada | Baudios/paridad de un **serie** legacy — manual |
| Cloud que se autorregistran (CloudPRNT/ePOS) | Qué **estación/plantilla** asignar — siempre humano |

**Qué necesitamos** · librerías de mDNS y SNMP en el servicio local; permiso de red local
(escaneo de subred); en macOS/Windows, multicast permitido por firewall.

**Prioridad** · 🔴 Alta — sin autodetección la configuración es frágil. mDNS + 9100 primero;
SNMP (estado) en una segunda iteración.

---

### Configuración en la app (flujo de alta)

**Para qué sirve** · convertir un **candidato detectado** en una `printer` con nombre,
ancho, asignaciones y plantilla, validada con una **impresión de prueba**. Estilo backoffice
(formulario Supabase/Notion), no operativa táctil.

**Cómo lo resolvemos** · flujo **detectar → listar → configurar → probar**:

```
 [1] DETECTAR          [2] LISTAR (la app)              [3] CONFIGURAR              [4] PROBAR
 servicio local        Dispositivos detectados          Editar impresora           Impresión de prueba
 ─────────────         ───────────────────────          ──────────────────         ──────────────────
 "Buscar               ┌─────────────────────────────┐  Nombre   [Cocina parrilla]  ┌────────────────┐
  dispositivos"   ───► │ ● 192.168.1.50  Epson TM‑m30 │► Vía      [raw9100        ]  │  *** PRUEBA *** │
                       │   RAW 9100 · OK              │  Ancho    (•)80mm ( )58mm    │  Cocina parrilla│
                       │ ● USB  Star TSP143  · OK     │  Code page[PC858 ▼]          │  áéíóú ñ € 12,34│
                       │ ○ BT   Sunmi InnerPrinter   │  Estación [Parrilla ▼] ★     │  [QR cotejo]    │
                       │ ⚠ 192.168.1.51 (sin papel)  │  Documento[Comanda cocina▼]  │  ── corte ──    │
                       └─────────────────────────────┘  Plantilla[Por defecto ▼]    └────────────────┘
                          (verde=ok, ámbar=aviso)       Copias   [1]                  ☑ ¿Salió bien?
                          [Adoptar] por fila            Centro   [Todos ▼]            [Sí, guardar]
                                                        ☑ Corta papel ☐ Cajón        [No, revisar]
```

1. **Listar** — la app muestra los candidatos del servicio local con un **semáforo de
   estado** (verde OK, ámbar aviso —sin papel, ip duplicada—, gris desconectado).
2. **Adoptar/nombrar** — el usuario nombra la impresora (`"Cocina parrilla"`, `"Barra"`).
3. **Elegir ancho** — **80 mm (≈48 col)** o **58 mm (≈32 col)** ([04 §6](../04-impresion-y-tickets/));
   se autopropone por modelo si SNMP lo expuso.
4. **Asignar** — el paso que conecta hardware con negocio:
   - **Estación / tipo de preparación** (Cocina, Barra, Tostadas) → es el **enrutado por
     estación** de [puntos de venta §7](../09-referencia-configurador-agora/administracion/puntos-de-venta.md#7-impresoras-de-cocina-enrutado-por-estación)
     (`device_kitchen_route`).
   - **Tipo de documento** (Factura simplificada, Factura, Albarán, Proforma, Cajón) con
     *cuándo imprimir* (Nunca/Siempre/Preguntar), **copias** y **plantilla** → es
     [puntos de venta §6](../09-referencia-configurador-agora/administracion/puntos-de-venta.md)
     (`device_doc_print`) y, a nivel zona, [centros de venta §4](../09-referencia-configurador-agora/administracion/centros-de-venta.md)
     (`sales_center_printer`).
   - **Centro de venta** que la usa (Todos por defecto), para filtrar por zona/sala.
5. **Plantilla** — se elige una `ticket_template` ([04 §7](../04-impresion-y-tickets/)); el
   renderer la combina con `nombre_para(destino)` para producir el `PrintJob`.
6. **Probar** — botón **Impresión de prueba**: el servicio emite un ticket fijo (nombre,
   acentos `áéíóú ñ € 12,34` para validar el **code page**, un QR, corte y —si procede—
   pulso de cajón). El usuario confirma **"¿Salió bien?"** antes de guardar. Sin prueba OK,
   la impresora queda en estado *borrador*.

**Mapeo a la entidad `printer`** (espejo de [04 §7.1](../04-impresion-y-tickets/) y del
mapeo de [puntos de venta](../09-referencia-configurador-agora/administracion/puntos-de-venta.md#mapeo-a-nuestro-modelo)):

```sql
create table printer (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  location_id   uuid,                                  -- centro/local (null ⇒ global)
  nombre        text not null,                         -- "Cocina parrilla"
  via           text not null,                         -- raw9100|epos|cloudprnt|usb|bt|sunmi|serial
  -- conexión (según la vía; se rellena desde la detección)
  host          text,                                  -- IP (raw9100/epos)
  puerto        int  default 9100,
  mac           text,                                  -- clave de deduplicación/seguimiento
  modelo        text,                                  -- de mDNS/SNMP/VID (informativo)
  usb_vidpid    text,                                  -- USB
  bt_addr       text,                                  -- Bluetooth
  com_port      text, baudios int,                     -- serie
  -- formato
  ancho_mm      int  not null default 80,              -- 80 | 58
  code_page     text not null default 'PC858',         -- acentos ES + €
  corta_papel   boolean not null default true,
  cajon         boolean not null default false,
  -- estado/operación
  estado        text not null default 'borrador',      -- borrador|ok|offline|sin_papel|error
  ultima_prueba timestamptz,
  respaldo_id   uuid references printer(id)            -- failover (impresora de respaldo)
);
```

> Las **asignaciones** (estación, documento, copias, plantilla, centro) **no** viven en
> `printer`: viven en `device_kitchen_route`, `device_doc_print` y `sales_center_printer`
> (ver mapeos citados). `printer` es **el hardware**; el enrutado es **negocio**. Así una
> misma impresora sirve a varias estaciones/documentos sin duplicarse.

**Qué necesitamos** · pantalla de backoffice "Dispositivos" (lista + editor), endpoint
`POST /hardware/print-test` en el servicio local, y los configuradores de
`device_doc_print`/`device_kitchen_route` (hoy 🔴 faltan según
[puntos de venta](../09-referencia-configurador-agora/administracion/puntos-de-venta.md)).

**Prioridad** · 🔴 Alta — es la pantalla que el instalador usa el día 1.

---

### Estado y errores

**Para qué sirve** · que cuando la **mesa 5 no imprime en cocina** el camarero lo sepa al
instante, y que la cocina **no pierda comandas** por un atasco de papel.

**Cómo lo resolvemos** · el servicio local mantiene por impresora una **cola persistente** y
publica su **estado** (vía Supabase Realtime / WebSocket LAN). Mismos principios que
[04 §8.3](../04-impresion-y-tickets/):

| Estado | Origen | Reacción |
|--------|--------|----------|
| **sin papel** | SNMP `prtAlertDescription` / respuesta de la impresora | aviso ámbar en UI; encolar; sugerir respaldo |
| **tapa abierta** | SNMP/estado | aviso; reintentar al cerrar |
| **offline / timeout** | socket no responde (4 s) | reintento con backoff; tras N fallos, **failover** |
| **cajón atascado** | pulso sin confirmación | aviso manual |

- **Reintentos con backoff** y **cola persistente** por impresora: si la cocina está
  offline, los tickets se acumulan y se vacían al recuperar (no se pierden comandas).
- **Idempotencia**: cada `PrintJob` lleva `id`; reintentar no duplica.
- **Failover** (`printer.respaldo_id`): si la impresora principal de una estación no
  responde tras los reintentos, el trabajo se desvía a su impresora de **respaldo** (p. ej.
  el KDS de cocina imprime en la térmica de barra) y se avisa en UI.
- **Camino crítico en LAN**: si cae internet, la cocina sigue imprimiendo
  ([09 §10](../../09-hardware.md)).

**Qué necesitamos** · campo `respaldo_id`, cola persistente en el servicio local, canal de
estado en tiempo real, y panel de "salud de dispositivos" en el backoffice.

**Prioridad** · 🟡 Media — el sistema funciona sin failover, pero es lo que evita el soporte
de "no me imprime en cocina".

---

## Pantallas

### Tipos

**Para qué sirve** · mostrar información al cliente (precio/total) y a la cocina (comandas);
y un visor de barra. Hay tres familias con detección distinta.

| Tipo | Qué es | Hardware | Cómo se detecta/da de alta | Rol de dispositivo |
|------|--------|----------|----------------------------|--------------------|
| **CDS — pantalla de cliente** | 2º monitor del PC del TPV (total/publicidad) | display HDMI/USB‑C del propio TPV | **enumeración de monitores del SO** (servicio local/Tauri) → elegir cuál | parte del TPV (Tauri) |
| **CDS — dispositivo propio** | tablet/monitor con su navegador en rol "pantalla" | tablet, mini‑PC + monitor | **emparejamiento por QR** como un terminal más | rol `pantalla` (PWA) |
| **KDS de cocina** | pantalla(s) de cocina con las comandas | tablet/monitor + box, KDS dedicado | **emparejamiento por QR**; el dispositivo **elige su monitor** | rol `kds` (PWA) |
| **Visor / poste VFD** | display de 2 líneas de barra (precio) | VFD serie/USB | **serie/USB vía servicio local** (puerto COM); fija comandos | periférico del TPV |

> El **CDS dispositivo** y el **KDS** son, a efectos de alta, **terminales** (como el TPV o
> la comandera): se dan de alta por **QR de emparejamiento** y heredan config de su grupo —
> ver [conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md).
> El **CDS 2º monitor** y el **VFD** no son terminales: son **periféricos** del PC del TPV,
> los ve el servicio local.

### Detección / configuración

**Para qué sirve** · asignar a cada pantalla **qué muestra** sin cablear nada a mano.

**Cómo lo resolvemos** ·

- **Monitores del SO (CDS 2º monitor, VFD)** · el servicio local (o Tauri) **enumera los
  displays** conectados al PC del TPV (índice, resolución, posición, primario/secundario) y
  los expone; el usuario asigna **rol** (cliente) y **resolución/orientación**. El VFD se
  detecta como puerto serie/USB y se le fija el set de comandos del modelo.
- **KDS y pantallas‑dispositivo** · se dan de alta por **emparejamiento (QR)**: el monitor
  abre la PWA en su URL, muestra un código, el admin lo vincula desde el backoffice como un
  terminal con rol `kds`/`pantalla`. La propia pantalla **elige su monitor** si tiene varios.

```
   CDS 2º monitor (periférico)          KDS / pantalla‑dispositivo (terminal)
   ───────────────────────────          ─────────────────────────────────────
   servicio local enumera displays      la pantalla abre la PWA → muestra QR
        ▼                                     ▼
   [Display 1] primario (TPV)           backoffice escanea/teclea código
   [Display 2] 1920×1080  ◄─ asignar    → vincula como rol KDS / pantalla
        ▼  rol = "pantalla cliente"     → hereda config del grupo
   probar: mostrar total de prueba      → elige su monitor / centro
```

### Asignación

**Para qué sirve** · que cada pantalla muestre lo de **su** centro/estación.

**Cómo lo resolvemos** · igual que las impresoras de cocina, una pantalla KDS se configura
con **qué centros, estaciones (tipos de preparación) y pases** muestra, su impresora de
respaldo y su modo de visualización — exactamente
[monitores de cocina](../09-referencia-configurador-agora/cocina/monitores-cocina.md)
(`kitchen_monitor` + `kitchen_monitor_scope`). El CDS de cliente se asigna a **un centro/
terminal** (muestra el ticket en curso de ese TPV).

**Qué necesitamos** · enumeración de displays en el servicio local/Tauri; el alta por QR de
[conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md); los
configuradores `kitchen_monitor*` (hoy 🔴 faltan).

**Prioridad** · 🟡 Media — KDS por QR primero (mayor valor); CDS 2º monitor y VFD después.

---

## Flujo completo: detección → listar → configurar → probar

```
 ┌─────────┐   "Buscar"   ┌──────────────────┐   adoptar   ┌────────────────────┐   guardar OK
 │ USUARIO │ ───────────► │  SERVICIO LOCAL  │ ──────────► │   BACKOFFICE app   │ ───────────►  Supabase
 │ (admin) │              │  (puente HW)     │  candidatos │  listar · nombrar  │   printer /
 └─────────┘              │                  │             │  ancho · estación  │   display /
      ▲                   │  9100 · mDNS     │             │  documento·planti. │   kitchen_monitor
      │                   │  SNMP · USB      │             │  copias · centro   │
      │   "¿salió bien?"  │  serie · BT      │             └─────────┬──────────┘
      │   ◄────────────── │  displays SO     │ ◄── PrintJob de prueba │
      │      ticket de    │  cola + estado   │     (POST /print-test) │
      └──── prueba ◄──────┴──────────────────┘ ◄──────────────────────┘
```

1. **Detección** — el servicio local escanea (9100/mDNS/SNMP), enumera (USB/serie/BT) y
   lista monitores; las cloud se autorregistran. → **candidatos**.
2. **Listar** — la app pinta los candidatos con semáforo de estado.
3. **Configurar** — el admin adopta, nombra, fija ancho/code page y **asigna**
   estación/documento/plantilla/copias/centro.
4. **Probar** — impresión/visualización de prueba; sin OK no se persiste como activa.
5. **Persistir** — `printer` / `display` / `kitchen_monitor` + sus asignaciones en Supabase,
   con RLS por `tenant_id`; el servicio local cachea para operar **offline en LAN**.

---

## Resumen de decisiones

| Aspecto | Decisión |
|---------|----------|
| Quién habla con el hardware | **Servicio local del PC** ([`servicio-local-pc.md`](servicio-local-pc.md)); el navegador no |
| Vía principal de impresión | **RAW 9100 en LAN** (offline); CloudPRNT solo delivery; ePOS web POS; Sunmi comandera |
| Descubrimiento de impresoras IP | **mDNS `_printer`/`_pdl-datastream`** + sonda **:9100** + **SNMP** (modelo/estado) |
| Descubrimiento local | enumeración **USB** (VID/PID), **serie** (COM), **Bluetooth** (SPP/BLE), Sunmi integrada |
| Cloud | **CloudPRNT/ePOS se autorregistran** por handshake; el usuario solo las adopta |
| Alta de impresora | detectar → **adoptar/nombrar** → ancho → **estación/documento/plantilla/copias/centro** → **prueba** |
| Modelo de datos | `printer` (hardware) + asignaciones en `device_kitchen_route` / `device_doc_print` / `sales_center_printer` |
| Estado/errores | semáforo en tiempo real, **cola persistente**, reintentos con backoff, **failover** (`respaldo_id`) |
| Pantallas | CDS 2º monitor = **enumerar displays del SO**; KDS y pantalla‑dispositivo = **QR** (terminal); VFD = serie/USB |
| Asignación de pantallas | KDS → `kitchen_monitor` (centro/estación/pase); CDS → centro/terminal |
| Acentos | **PC858** (`ESC t 19`), validado en la impresión de prueba |
| Offline | todo el camino crítico en **LAN**; Supabase para config canónica y sync |

---

## Referencias

- [04 — Impresión y tickets](../04-impresion-y-tickets/) — vías ESC/POS, plantillas, code
  page, cola/reintentos, entidad `printer`/`ticket_template`.
- [09 — Hardware](../../09-hardware.md) §2‑3 (impresoras, cocina/KDS), §5 (cajón RJ11), §8
  (red, IP fijas).
- [`servicio-local-pc.md`](servicio-local-pc.md) — el puente de hardware que ejecuta la
  detección y el envío.
- [Puntos de venta](../09-referencia-configurador-agora/administracion/puntos-de-venta.md)
  §6‑7 — impresión por documento y enrutado de cocina por estación.
- [Centros de venta](../09-referencia-configurador-agora/administracion/centros-de-venta.md)
  §4 — impresoras por centro (herencia terminal↔centro).
- [Monitores de cocina](../09-referencia-configurador-agora/cocina/monitores-cocina.md)
  — configuración del KDS (alcance, respaldo, visualización).
- [Conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md) —
  emparejamiento por QR de KDS y pantallas.
- `packages/hardware` — interfaces `PrintJob` / `Printer` (transportes por `via`).
