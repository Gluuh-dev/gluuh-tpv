# 05 — Cocina (KDS), comanderas y pantalla de cliente

> Auditoría y diseño de la **operativa en sala y cocina**: el KDS que sustituye al papel, la
> comandera del camarero (móvil/tablet, offline‑first) y las pantallas de cara al cliente, con su
> **flujo en tiempo real**. Profundiza y referencia [10 — Comanderas, KDS e impresión](../../10-comanderas-kds-e-impresion.md),
> [14 — Pantallas: kiosko, KDS, display y ofertas](../../14-pantallas-cliente-kiosko-y-kds.md) y
> [09 — Hardware](../../09-hardware.md).
>
> **Nota de estado (importante).** Distinguimos lo **implementado hoy** de lo **diseñado/objetivo**.
> El repo, a fecha de auditoría, mueve los datos por **Supabase Realtime** (`postgres_changes` sobre
> `sales_order`) y tiene la base de **PowerSync** en `packages/sync`. La capa de **eventos efímeros
> por Socket.IO** (campana, "mesa lista") descrita en docs/10 está **especificada pero aún no
> implementada** (no hay ningún `@WebSocketGateway` en `apps/`). Donde algo es objetivo y no código
> actual, se marca **(objetivo)**.

---

## 1. Mapa de superficies y estado real

| Superficie | Ruta / fichero | Para quién | Estado en repo |
|---|---|---|---|
| **Cocina / KDS** | `apps/web/app/cocina/page.tsx` | Cocina | ✅ Real, autenticado (RLS por empresa) |
| Alias KDS | `apps/web/app/kds/page.tsx` | — | ↪️ `redirect("/cocina")` |
| **Comandera (web)** | `apps/web/app/comandera/page.tsx` | Camarero | ✅ Demo funcional (PIN + Supabase) |
| **Comandera (móvil)** | `apps/mobile/src/Comandera.tsx` | Camarero | ✅ Esqueleto funcional (Expo + Supabase) |
| **Display de cliente** | `apps/web/app/pantalla/page.tsx` | Cliente (local) | ✅ Real, branding por tenant |
| Kiosko / Ofertas | `apps/web/app/{kiosko,ofertas}` | Cliente | ✅ Demo (ver doc 14) |

> **Hallazgo de auditoría.** `/kds` ya no es pantalla propia: redirige a `/cocina` (autenticada,
> multi‑empresa). Conviene alinear los docs (que aún citan `/kds`). La cocina actual **muestra todo
> junto**; el **filtrado por estación** (§3) es el siguiente paso.

---

## 2. Dos máquinas de estados que conviven en una misma fila

El punto más sutil del dominio: **cada pedido (`sales_order`) tiene DOS estados ortogonales**, ambos
verificados en `@gluuh/core`. No confundirlos.

### 2.1 `EstadoComanda` — ciclo comercial / de mesa
`packages/core/src/domain/order-state.ts`

```
   ABIERTA ──▶ ENVIADA_COCINA ──▶ SERVIDA ──▶ POR_COBRAR ──▶ COBRADA (final)
      │              │               │            │
      │              │               │            └──▶ ABIERTA (reabrir)
      └──────────────┴───────────────┴────────────┴──▶ ANULADA (final)
```

| Desde | Transiciones válidas |
|---|---|
| `ABIERTA` | `ENVIADA_COCINA`, `POR_COBRAR`, `ANULADA` |
| `ENVIADA_COCINA` | `SERVIDA`, `POR_COBRAR`, `ANULADA` |
| `SERVIDA` | `POR_COBRAR`, `ANULADA` |
| `POR_COBRAR` | `COBRADA`, `ABIERTA`, `ANULADA` |
| `COBRADA` / `ANULADA` | — (estados finales) |

Garantizada por `puedeTransicionar()` / `transicionar()`, que lanza `TransicionInvalidaError`.
`esEstadoFinal()` detecta los terminales.

### 2.2 `EstadoPreparacion` — ciclo de cocina (KDS / display)
`packages/core/src/domain/operations.ts` (espejo cliente‑safe en `apps/web/app/lib/estados.ts`)

```
   PENDIENTE ──▶ EN_PREPARACION ──▶ LISTO ──▶ ENTREGADO (final)
```

Avance **estrictamente lineal** vía `PREPARACION_SIGUIENTE` (un solo "siguiente" por estado;
`ENTREGADO → null`). Es lo que el KDS avanza con un toque/bump y lo que el display muestra al cliente.

### 2.3 Cómo se cruzan (lo que hace el código hoy)
La cocina y el display consultan exactamente:

```ts
sb.from("sales_order")
  .eq("estado", "ENVIADA_COCINA")          // EstadoComanda
  .neq("estado_preparacion", "ENTREGADO")  // EstadoPreparacion
```

Es decir: **un pedido entra al KDS cuando su `EstadoComanda` pasa a `ENVIADA_COCINA`**, y dentro del
KDS **avanza por su `EstadoPreparacion`**. Cuando la cocina lo marca `ENTREGADO` (o el camarero lo
da por `SERVIDA`), desaparece de la cola. Mantener ambas columnas coherentes es responsabilidad del
write‑path; recomendación: que marcar `LISTO`/`ENTREGADO` en el KDS **no** mute `EstadoComanda`
(separación de responsabilidades cocina vs. sala), y que `SERVIDA` la fije la comandera al entregar.

> **Recomendación.** Falta una **máquina de estado por LÍNEA** (`order_line`). Hoy solo hay estado
> por pedido. Para pases reales (§5) y para 86/agotado parcial conviene un `estado_preparacion` por
> línea, agregándose al del pedido ("pedido LISTO" = todas sus líneas LISTO). Marcar como deuda.
> Ojo: `order_line` **ya tiene** columna `estacion` (existe el enrutado en datos, falta el estado).

---

## 3. KDS — Kitchen Display System

### 3.1 Objetivos (no negociables)
- **Sustituir el papel** de cocina: cero tickets perdidos, cero letra ilegible.
- **Reducir errores**: modificadores y alérgenos visibles, color para urgencias.
- **Reducir tiempos**: cronómetro por comanda y métricas de preparación.

### 3.2 Vista por estación vs. vista de pase/línea

| Vista | Qué muestra | Para quién |
|---|---|---|
| **Por estación** | Solo lo de *esta* estación (parrilla / fríos / postres / barra) | El cocinero de la partida |
| **Pase / línea** | Todas las estaciones de cada mesa, agrupadas, para "cantar" el pase | El jefe de cocina / expedición |

Hoy `/cocina` es una **única cola sin filtrar**. Objetivo: parámetro `?estacion=parrilla` (o sesión
por estación) que filtre por la estación de cada `order_line` (§4). El **pase** agrupa por mesa y
señala cuándo *todas* las estaciones de una mesa están `LISTO`.

### 3.3 Cronómetros y colores por tiempo de espera
El código ya calcula minutos transcurridos: `Math.floor((Date.now() - created_at)/60000)`. Sobre eso
se define el **semáforo de SLA** (recomendado, configurable por estación):

| Tramo | Color | Significado |
|---|---|---|
| 0–5 min | Verde | En tiempo |
| 5–10 min | Ámbar `#f59e0b` | Atención |
| > 10 min | Rojo | Fuera de SLA — prioridad |

Los colores **por estado** ya existen en `app/lib/estados.ts` (`COLOR`): gris pendiente, ámbar en
preparación, verde listo. Conviene separar **color de estado** (qué fase) de **color de tiempo**
(cuánto lleva) — p. ej. fondo por estado, borde/halo por SLA.

### 3.4 Wireframe — KDS vista por estación (PARRILLA)

```
┌─ KDS · PARRILLA ───────────────────────── 13:42 · ▣ sonido ──┐
│                                                              │
│ ┌── MESA 5 · #A-37 ──┐ ┌── MESA 2 ─────────┐ ┌── BARRA ────┐ │
│ │ ⏱ 03:12   verde    │ │ ⏱ 08:40  ÁMBAR    │ │ ⏱ 11:50 ROJO│ │
│ │ Pase 1             │ │ Pase 2            │ │ Para llevar │ │
│ │ 1x Entrecot        │ │ 2x Solomillo      │ │ 1x Hambur.  │ │
│ │   · al punto       │ │   · poco hecho    │ │   · sin pan │ │
│ │ 1x Pollo           │ │ 1x Chuletón       │ │             │ │
│ │ [EN PREP] [LISTO]  │ │ [LISTO]           │ │ [LISTO]     │ │
│ └────────────────────┘ └───────────────────┘ └─────────────┘ │
│                                                              │
│  Bump bar:  ◀ prev   ▶ next   ⮐ bump(listo)   ↺ recuperar    │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Funciones del KDS (checklist)

| Función | Estado | Nota de implementación |
|---|---|---|
| Marcar comanda EN_PREPARACION / LISTO | ✅ (avance lineal) | Botón "siguiente" usa `PREPARACION_SIGUIENTE` |
| Marcar **plato/línea** suelto | ⬜ objetivo | Requiere estado por `order_line` (§2.3) |
| **Bump bar** (teclado HID) | ⬜ objetivo | Mapear teclas → "next/prev/bump/recuperar" |
| **Aviso sonoro** nueva comanda | ⬜ objetivo | Hoy refresco silencioso; añadir `Audio` al `INSERT` |
| **Recuperar** comanda (deshacer bump) | ⬜ objetivo | Permitir retroceso `LISTO → EN_PREPARACION` |
| **Histórico** del turno | ⬜ objetivo | Vista de `ENTREGADO` del día |
| **Métricas de tiempos** | ⬜ objetivo (fase Escala) | `tiempo_prep = listo_at − created_at` |

> **Recomendación.** El bump bar es un teclado USB que emite teclas estándar; no necesita driver:
> capturar `keydown` y mapear (`Enter`=bump, flechas=navegar). Es la mejora de ergonomía con mayor
> ratio valor/esfuerzo para cocina con manos ocupadas.

---

## 4. Enrutado de comandas por estación

> Resumen aquí; el detalle de **impresión** (ESC/POS, ePOS, CloudPRNT, cajón) está en
> [10 §3](../../10-comanderas-kds-e-impresion.md) y el hardware en [09 §3](../../09-hardware.md).

Modelo objetivo (docs/10 §2.4 y docs/09 §3):

```
Producto ──(config backoffice)──▶ ESTACIÓN
Al ENVIAR comanda, el sistema la DIVIDE por estación:
   • Bebidas / cervezas  ──▶ BARRA      (impresora y/o KDS barra)
   • Carnes a la brasa   ──▶ PARRILLA   (KDS parrilla)
   • Postres             ──▶ POSTRES    (KDS postres)
Cada estación tiene un DESTINO configurable:
   impresora de comandas │ pantalla KDS │ ambas (con respaldo)
```

**Estado real en datos (hallazgo).** El enrutado **ya está modelado**, falta la lógica que lo use:
- `packages/core/src/domain/types.ts`: `Producto.estacion?: string` ("estación a la que se enruta").
- `packages/sync/src/schema.ts` (PowerSync): `product.estacion` y `order_line.estacion` (`column.text`).
- `packages/hardware/src/index.ts`: contrato `PrintJob` (`lineas`, `cortar`, `abrirCajon` = pulso
  `ESC p`, `qr`) e interfaz `Printer.imprimir(job)` — **esqueleto sin implementación**.

Lo que **falta**: ningún componente lee `estacion` para **filtrar el KDS** ni para **dividir** la
comanda hacia impresoras; `/cocina` muestra todo junto. Recomendación: resolver `order_line.estacion`
al crear la línea (desde `product.estacion`), filtrar el KDS por estación, y agrupar la impresión por
`estacion` → su `printer` (IP/LAN). **Respaldo recomendado: KDS en pase + impresora de impacto**
(docs/09: el térmico se borra con calor). Conviene normalizar a una tabla `station` por `tenant_id`
en lugar del `text` libre actual.

---

## 5. Comandera (camarero, móvil/tablet)

### 5.1 Flujo (verificado en `comandera/page.tsx` y `mobile/Comandera.tsx`)

```
Login PIN ─▶ Plano de sala ─▶ Mesa ─▶ (comensal / pase) ─▶ Carta (categorías)
        ─▶ Producto ─▶ Modificadores / notas ─▶ Añadir ─▶ ENVIAR A COCINA
        ─▶ [Cobro en mesa opcional]
```

Lo que el código ya hace: autentica (sesión Supabase + empleado por **PIN**, validado con la RPC
`validar_pin`), carga `location`, `restaurant_table`, `category` y `product` (solo `disponible =
true`), arma la comanda en estado local (`Record<productId, cantidad>`) y la envía. `enviar()`
inserta en `sales_order` con `canal:"COMANDERA"`, `tipo_operacion:"VENTA"`, `estado:"ENVIADA_COCINA"`,
`estado_preparacion:"PENDIENTE"` y un **`client_id` UUID** generado en cliente
(`crypto.randomUUID()` en web, `uuid()` manual en móvil), inserta las `order_line` y marca la mesa
`OCUPADA`. Ese UUID de cliente es la clave para la **idempotencia** (§7).

### 5.2 Wireframe — comandera (tablet/móvil)

```
┌─ Mesa 5 · Ana ───────────── ⬤ online ─┐    ┌─ Comanda · Mesa 5 ────────┐
│ [Entrantes][Carnes][Postres][Bebidas] │    │ Pase 1                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐│    │ 2x Croquetas      9,00    │
│ │Croquetas │ │ Entrecot │ │ Ensalada ││    │ 1x Entrecot      18,00    │
│ │  4,50 ✓  │ │ 18,00 ✓  │ │  AGOTADO ││    │   · al punto              │
│ └──────────┘ └──────────┘ └───⊘──────┘│    │ ───────────────────────── │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐│    │ Total          27,00 €    │
│ │  Pulpo   │ │  Caña    │ │  Café    ││    │ [ ENVIAR A COCINA ]       │
│ │ 14,00 ✓  │ │  2,50 ✓  │ │  1,40 ✓  ││    │ [ Cobrar ]  [ Marchar ▶ ] │
│ └──────────┘ └──────────┘ └──────────┘│    └───────────────────────────┘
└───────────────────────────────────────┘
```

### 5.3 Offline‑first total
- La comanda **se construye y persiste local** (objetivo: **SQLite vía PowerSync**) y se propaga al
  reconectar / instantáneamente en LAN. Hoy el move es Supabase directo; PowerSync es la base ya
  presente en `packages/sync` para cerrar el offline real.
- **Principio**: comandar e imprimir el camino crítico **no dependen de internet** (LAN local).

### 5.4 86 / agotado en tiempo real
El producto agotado se marca y **lo ve toda la sala y la cocina al instante**. En el código, los
productos se filtran por `disponible`; el objetivo es que el toggle 86 emita por la capa realtime y
las comanderas lo reflejen sin recargar (botón "Agotado" deshabilitado en la carta).

### 5.5 Pases y comanda por comensal/asiento
- **Comanda por comensal/asiento** y por **pase** (entrantes / principales / postres).
- **"Marchar" un pase** = la sala ordena a cocina **empezar** ese pase (los principales no se
  preparan hasta marchar). Implementación recomendada: el pase nace **retenido**; "Marchar pase 2"
  pasa sus líneas a `PENDIENTE` visibles en KDS (con `created_at`/`marchado_at` reiniciando el SLA).
- Requiere el **estado por línea** de §2.3 y un campo `pase` (entero) en `order_line`.

---

## 6. Pantallas de cara al cliente

### 6.1 Display de estado del pedido (`/pantalla`)
Real y autenticado: dos columnas **"En preparación"** y **"Listo para recoger"**, números grandes
(`numero_pedido`), branding por `tenant`. Lee `sales_order` (mismo filtro que la cocina) en tiempo
real por Supabase Realtime. Objetivo: **sonido/parpadeo** al pasar a `LISTO`.

```
┌──────────── BAR LA PALMA ────────────┐
│   EN PREPARACIÓN    │  LISTOS         │
│   ───────────────   │  ──────────     │
│      A-37  A-38     │   A-31  A-33    │
│      A-40           │   A-35   ★      │
└──────────────────────────────────────┘
```

### 6.2 Customer‑facing display (visor de barra) — objetivo
Pantalla pequeña frente al cliente en barra que refleja **la línea que se está cobrando** y el total
(transparencia de precio, docs/09 §6 "visor de cliente"). Distinto del display de recogida: este es
1:1 con el TPV de barra durante el cobro.

---

## 7. Arquitectura de tiempo real

### 7.1 Reparto de responsabilidades (la regla)

| Capa | Qué transporta | Naturaleza | Estado |
|---|---|---|---|
| **Supabase Realtime** (hoy) / **PowerSync** (objetivo) | **Datos persistentes**: comanda, `order_line`, estados, 86 | Estado durable, replicado a SQLite | ✅ Realtime: canales `"cocina"` y `"pantalla"`, `postgres_changes` (`event:"*"`) sobre `sales_order`. PowerSync base en `packages/sync`, aún sin cablear al KDS |
| **Socket.IO** *(objetivo)* | **Eventos efímeros**: campana nueva comanda, "mesa lista", bump | Notificación, no se persiste | ⬜ no implementado |

> **Regla mental.** Si necesitas que **sobreviva a un reinicio**, va por la capa de datos
> (PowerSync). Si es un **"¡oye, mira!"** instantáneo y desechable, va por Socket.IO. Hoy la campana
> se simularía reaccionando al `INSERT` que llega por Realtime; el objetivo es desacoplarla a un
> evento Socket.IO para no atar UX efímera a la replicación de datos.

### 7.2 Diagrama del flujo

```
        ┌──────────────┐        envía comanda          ┌──────────────┐
        │  Comandera   │ ───────(datos, durable)──────▶│  PowerSync /  │
        │ (SQLite loc.)│                                │  Supabase BD │
        └──────┬───────┘                                └──────┬───────┘
               │  campana (efímero, objetivo)                  │ replica
               ▼                                               ▼
        ┌──────────────┐        evento "nueva"          ┌──────────────┐
        │  Socket.IO   │ ──────(objetivo)──────────────▶│   KDS /cocina │
        │  (LAN local) │                                │ (cola + ⏱)   │
        └──────┬───────┘                                └──────┬───────┘
               │  "mesa lista" / "pedido listo"                │ estado_prep
               ▼                                               ▼
        ┌──────────────┐                                ┌──────────────┐
        │  Comandera   │                                │  /pantalla   │
        │ (avisa sala) │                                │ display clt. │
        └──────────────┘                                └──────────────┘

   ── todo sobre LAN del local: funciona aunque caiga internet ──
```

### 7.3 Funcionamiento en LAN aunque caiga internet
- **Servidor local** (mini‑PC/NAS, docs/09 §8) hospeda la cola de comandas, el enrutado y —objetivo—
  el namespace Socket.IO en LAN. Comanderas → servidor → KDS/impresoras por **Ethernet/WiFi del
  local**, sin pasar por la nube.
- PowerSync sincroniza con Supabase **cuando vuelve internet**; mientras, el local opera.

### 7.4 Ejemplos de payload (objetivo)

Evento Socket.IO — **nueva comanda a cocina** (campana):
```json
{
  "evento": "comanda.nueva",
  "tenant_id": "t_001",
  "location_id": "loc_01",
  "order_id": "5f9d…",
  "numero_pedido": 37,
  "mesa": "Mesa 5",
  "estacion": "parrilla",
  "pase": 1,
  "ts": "2026-06-19T13:42:05.120Z"
}
```

Evento Socket.IO — **pedido listo** (a display y comandera):
```json
{
  "evento": "preparacion.listo",
  "order_id": "5f9d…",
  "numero_pedido": 37,
  "estacion": "parrilla",
  "ts": "2026-06-19T13:49:50.000Z"
}
```

Cambio durable (lo que realmente persiste y replica, Realtime/PowerSync):
```json
{
  "tabla": "sales_order",
  "op": "UPDATE",
  "id": "5f9d…",
  "estado": "ENVIADA_COCINA",
  "estado_preparacion": "LISTO"
}
```

---

## 8. Hardware objetivo (resumen)

> Detalle, modelos y precios en [09 — Hardware](../../09-hardware.md).

| Rol | Recomendado | Ref. |
|---|---|---|
| **KDS** | Monitor 21–27" + **Android box / mini‑PC**, o pantalla KDS dedicada anti‑grasa con **bump bar** | 09 §3 |
| **Impresora cocina** | **Epson TM‑U220B** (impacto, 2 colores: rojo alérgenos) — el térmico se borra con calor | 09 §3 |
| **Impresora barra** | Epson TM‑m30III / Star TSP143IV, **Ethernet en LAN** | 09 §2 |
| **Comandera** | **Sunmi V2s** (comandar+cobrar+imprimir) o móvil/tablet barato si solo comanda | 09 §4 |
| **Red** | Switch gestionable + AP UniFi + **SAI** + router con **failover 4G** + IP fijas por equipo | 09 §8 |
| **Servidor local** | Mini‑PC/NAS para mesas/comandas/enrutado en LAN (kits medio/grande) | 09 §8 |

---

## 9. Buenas prácticas para hora punta

| Riesgo en rush | Práctica recomendada |
|---|---|
| **Doble envío** (camarero toca 2x) | **Idempotencia**: UUID generado en el cliente (ya se hace en móvil) como clave del pedido; `UPSERT` por ese id. Eventos Socket.IO con `evento_id` deduplicados en consumidor. |
| **Caída de WiFi/internet** | **Offline‑first**: comanda en SQLite/PowerSync, impresión y KDS en **LAN local**; sync diferido al reconectar. |
| **Reconexión** | Backoff exponencial; al reconectar, **rehidratar desde la BD** (no confiar solo en eventos perdidos): los eventos Socket.IO son "best effort", la verdad está en la cola persistida. |
| **Pérdida de eventos efímeros** | El KDS **no depende** de la campana para tener el dato: el pedido llega por la capa durable; el evento solo añade el aviso. Si se pierde, el dato sigue ahí. |
| **Estados imposibles** | Validar SIEMPRE con `puedeTransicionar()` (comanda) y `PREPARACION_SIGUIENTE` (cocina) en el write‑path, no solo en la UI. |
| **Relojes desincronizados** | El SLA/cronómetro se calcula sobre `created_at` de la BD (servidor), no sobre el reloj del dispositivo. |
| **Tormenta de refrescos** | Hoy cada cambio dispara un `cargar()` completo. Objetivo: aplicar el delta del evento Realtime en vez de re‑consultar toda la cola; debounce en picos. |

---

## 10. Resumen de decisiones y deuda

| Aspecto | Decisión / estado |
|---|---|
| Datos durables (comanda, líneas, 86) | **PowerSync / Supabase Realtime** |
| Eventos efímeros (campana, mesa lista) | **Socket.IO en LAN** — *objetivo, no implementado* |
| Estado comercial | `EstadoComanda` (`order-state.ts`) — validado |
| Estado cocina | `EstadoPreparacion` (`operations.ts`) — lineal, validado |
| Enrutado | Por **estación**, configurable en backoffice (objetivo de datos: `station`) |
| KDS actual | `/cocina` real autenticado; `/kds` → redirect |
| Impresión | ESC/POS por LAN — ver doc 10 |

**Deuda priorizada (recomendación):**
1. **Estado por `order_line`** + campo `pase` → habilita pases reales, "marchar" y 86 parcial.
2. **Modelo de `station`** (`product.station_id`, `order_line.station_id`) → KDS por estación y enrutado de impresión.
3. **Capa Socket.IO en LAN** (`@WebSocketGateway`) para campana, sonido y "pedido listo".
4. **Bump bar + sonido** en `/cocina` (alto valor, bajo esfuerzo).
5. **Métricas de tiempos** (`tiempo_prep`) para la fase Escala.
6. Aplicar **deltas** en Realtime en vez de recargar la cola completa.
