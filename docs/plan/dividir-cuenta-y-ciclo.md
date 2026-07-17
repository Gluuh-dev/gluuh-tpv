# Dividir cuenta + ciclo de vida de la cuenta (diseño)

> Documento vivo. Objetivo: dejar **perfecto** cómo se divide una cuenta, cómo se
> cobra por partes, y **dónde vive la cuenta en cada momento** (ticket · mesa ·
> aparcado · para llevar · cobrada). Todo lo marcado 🟢 es lo que ya hace el código;
> 🟡 lo que falta; ❓ decisión pendiente de confirmar.

Referencias al código: `apps/web/app/tpv/page.tsx` salvo que se diga otra cosa.

---

## 1. Estado actual — ciclo de vida de una `sales_order`

Una "cuenta" es una fila de `sales_order` con sus `order_line`. Vive en **un** sitio,
determinado por sus columnas, no por un campo "ubicación":

| Dónde vive | Columnas que lo determinan | Vista en el TPV |
|---|---|---|
| **Ticket** (en pantalla) | la comanda en memoria; `ordenAbiertaId` = null hasta guardar | pantalla de venta |
| **Mesa** | `table_id` = mesa, estado abierto | plano de salas (mesa OCUPADA) |
| **Aparcado** | `table_id` = null, `aparcado_como` con etiqueta | vista "Aparcado" |
| **Para llevar** | `table_id` = null, `cliente_nombre` con nombre | vista "Para llevar" |
| **Cobrada** | `estado = 'COBRADA'` | sale del circuito (recibo) |

### Estados (`sales_order.estado`)
`ABIERTA` · `ENVIADA_COCINA` · `SERVIDA` · `POR_COBRAR` · `COBRADA` · `ANULADA`.

> El 4º estado de mesa de Glop ("cuenta solicitada") **no es una columna**: se deriva
> de `estado = 'POR_COBRAR'` (ver skill gluuh-base-datos).

### Transiciones (hoy) 🟢
```
[comanda nueva] --guardar--> ABIERTA --enviar cocina--> ENVIADA_COCINA --> SERVIDA
                                                             |
                              imprimir cuenta / solicitar cobro  --> POR_COBRAR
                                                             |
                                                          cobrar --> COBRADA
                                                             |
                                                          anular --> ANULADA
```
- **POR_COBRAR** lo pone `imprimirRecibo()` al imprimir la proforma de una mesa
  ([page.tsx:822](../../apps/web/app/tpv/page.tsx#L822)) y el fallo de cobro
  ([page.tsx ~1489](../../apps/web/app/tpv/page.tsx#L1489)).
- **COBRADA** lo pone `cobrar()` vía `crearOrden("COBRADA", ...)`
  ([page.tsx:1470](../../apps/web/app/tpv/page.tsx#L1470)).

### Cuándo la cuenta "sale del ticket" y va a Aparcado 🟢
- **Aparcar a mano**: venta directa sin mesa que se guarda con etiqueta →
  `table_id = null`, `aparcado_como = alias || cliente || "Aparcado HH:MM"`
  ([page.tsx:1409](../../apps/web/app/tpv/page.tsx#L1409)).
- **Dividir (hoy)**: el doc 1 se queda en la mesa; los docs 2..N se crean con
  `table_id = null` + `aparcado_como = "Mesa X (2)"` → **Aparcado**
  (RPC `dividir_cuenta`, [page.tsx ejecutarDivision](../../apps/web/app/tpv/page.tsx#L1594)).
  👉 **Esto es lo que no gusta**: las partes se dispersan en Aparcado, mezcladas con
  lo aparcado a mano.
- Qué entra en la vista **Aparcado** (`recargarAparcados`): `table_id` null,
  `cliente_nombre` null, `estado in (ABIERTA, ENVIADA_COCINA, SERVIDA, POR_COBRAR)`
  ([page.tsx:1742](../../apps/web/app/tpv/page.tsx#L1742)).

### Cobro y navegación (hoy) 🟢
`cobrar()` ([page.tsx:1436](../../apps/web/app/tpv/page.tsx#L1436)):
1. Calcula el desglose fiscal (`/api/ticket`) — si falla, aborta sin tocar nada.
2. `crearOrden("COBRADA")` + inserta `payment` (todo el total de una).
3. Libera la mesa (`LIBRE`), `ordenAbiertaId = null`, recarga mesas.
4. VERIFACTU: `/api/factura` (o la cola `fiscal_outbox`).
5. Muestra el **recibo** en pantalla. **NO navega** a las mesas.

> El cobro atómico de servidor ya existe: RPC **`cobrar_cuenta`** (migración 0119),
> pero **`page.tsx` aún no la usa** (sigue el camino directo). La RPC **exige
> `suma(pagos) == total`**: hoy **no hay pago parcial** (marcado como "puerta 6,
> guía 19 §16" en el propio 0119).

### Nomenclatura 🟢 (ya corregido)
"Barra" se retiró de cara al usuario: ventas sin mesa y cuentas guardadas son
**"Aparcado"**. "BARRA" como **estación de cocina** (COCINA/BARRA/CAMARERO) se
mantiene: es otra cosa.

---

## 2. Qué necesitamos de la cuenta para dividir

### 2.1 Lo que el modal ya recibe por línea 🟢
De `lineasComanda()`, el modal recibe por cada línea:

| campo | qué es | uso al dividir |
|---|---|---|
| `id` | clave de comanda (`productId\|formato\|mods` + sufijo) | identidad de la línea al repartir uds |
| `nombre` | nombre mostrado | tarjetas y justificante |
| `uds` | unidades | cuántas se pueden mover a cada cuenta |
| `precio` | unitario, impuesto **incluido** | subtotales de cada parte |

### 2.2 Lo que hace falta para PERSISTIR una parte (para el documento fiscal / justificante)
Cuando una parte se materializa (se cobra o se aparca), necesita, por línea:
`product_id`, `nombre`, `cantidad (uds)`, `precio_unitario`, `tipo_impositivo`,
`notas`, `estacion`, `modificadores`/`menuParte`. Esto ya lo arma `filasDe()` en
`ejecutarDivision` a partir de `meta = lineasComanda()`
([page.tsx:1615](../../apps/web/app/tpv/page.tsx#L1615)).

### 2.3 Tabla nueva propuesta — `cuenta_parte` (migración **0123**) 🟡
Guarda la división de una cuenta y su estado de cobro, para que **reaparezca al
volver a la mesa**.

| columna | tipo | para qué |
|---|---|---|
| `id` | uuid pk | — |
| `tenant_id` | uuid not null → tenant | RLS por tenant (obligatorio, patrón repo) |
| `order_id` | uuid not null → sales_order (on delete cascade) | de qué cuenta es |
| `indice` | int | "Parte 1/2/3…" |
| `tipo` | text | `IGUAL` \| `IMPORTE` \| `PRODUCTOS` |
| `importe` | numeric(12,2) | lo que paga esa parte |
| `lineas` | jsonb null | solo `PRODUCTOS`: `[{key, product_id, nombre, uds, precio}]` |
| `cobrada` | boolean default false | si ya se cobró |
| `cobrada_at` | timestamptz null | cuándo |
| `payment_id` | uuid null → payment | qué pago la cubrió |
| `client_id` | uuid default gen_random_uuid() | idempotencia + sync nodo↔nube |
| `created_at` / `updated_at` | timestamptz | LWW sync |

Reglas: `tenant_id` + RLS `current_tenant_id()` + trigger `set_tenant_id()`;
índice `(tenant_id, order_id)`; publicar en realtime para el TPV/sync.

---

## 3. Comportamiento deseado (lo que hay que dejar perfecto)

1. 🟡 **Las divisiones se guardan**: al dividir, se persisten en `cuenta_parte`.
2. 🟡 **Reaparecen al volver a la mesa**: entras en la mesa → ves las partes y
   cuáles están cobradas; en "Cobrar" seleccionas rápido la que falta.
3. 🟡 **Cobro parcial**: cobras una parte → pago real + marca `cobrada` + imprime
   justificante; la mesa queda `POR_COBRAR` con lo que falta.
4. 🟡 **La cuenta NO se dispersa a Aparcado** al dividir: sigue en la mesa como una
   sola cuenta con sus partes.
5. 🟡 **Al cobrar (terminar) → navegar a las mesas** (salón), no quedarse en el
   recibo. ❓ ¿Siempre, o solo si la cuenta era de mesa? (una venta directa sin mesa
   quizá quiera volver a ticket en blanco).
6. 🟢 **Nombre**: todo "Aparcado" (hecho).

---

## 4. Ciclo de vida propuesto (con partes)

```
Mesa con cuenta (ABIERTA/…)
      │  abrir "Dividir/Cobrar por partes"
      ▼
Definir partes (IGUAL / IMPORTE / PRODUCTOS)  ── guardar ──► cuenta_parte (persistido)
      │
      ├─ Cobrar parte N ─► pago parcial ─► parte.cobrada=true ─► imprime justificante
      │        │
      │        ▼
      │   ¿faltan partes?  ── sí ──► mesa POR_COBRAR (vuelves a la mesa cuando quieras)
      │        │ no
      ▼        ▼
   Todas cobradas ─► sales_order COBRADA ─► UNA factura (VERIFACTU) ─► mesa LIBRE ─► ir a MESAS
```

- **Mesa siempre POR_COBRAR** mientras haya partes pendientes: en el plano se ve
  "cuenta solicitada" (ya derivado del estado, sin columna nueva).
- **Una factura por mesa** al cerrar; los justificantes por persona **no** son
  fiscales. VERIFACTU se dispara **una vez**, al cerrar.

---

## 5. Cambios en el servidor

### 5.1 Migración 0123 — `cuenta_parte` 🟡
Tabla del §2.3 (RLS + trigger + realtime).

### 5.2 Cobro parcial 🟡 — extender `cobrar_cuenta` (recomendado)
Añadir un modo parcial (p. ej. `p_cerrar boolean`):
- **parcial** (`p_cerrar = false`): inserta los pagos de la parte, **deja la mesa
  `POR_COBRAR`**, **no factura**. Marca la(s) `cuenta_parte` cobrada(s).
- **cierre** (`p_cerrar = true` o cuando `suma(payment) == total`): `COBRADA` +
  encola factura + libera mesa.

Es exactamente la "puerta 6" del roadmap (guía 19 §16). Atómico y seguro. Implica
además **migrar el caller** de `page.tsx` a `cobrar_cuenta` (hoy usa el camino viejo).

### 5.3 Sync nodo↔nube 🟡
`cuenta_parte` entra en la sincronización LWW por `updated_at` (como el catálogo).

---

## 6. Decisiones tomadas ✅ (17-07)

1. **Navegación al terminar de cobrar** → **Mesas si era de mesa; ticket en blanco si
   era venta directa.** (`cobrar()` navega según origen).
2. **Re-dividir** → **conservar lo ya cobrado**; solo se rehace el reparto de lo
   pendiente. Nunca se pierde un cobro hecho.
3. **Método de pago por parte** → **abrir la pantalla de cobro** (CobrarModal) con el
   importe de esa parte: efectivo con cambio, tarjeta, mixto. Reutiliza lo existente.
4. **Editar con partes cobradas** → **bloquear lo cobrado**, re-repartir el resto.
5. **Factura** → **una factura por mesa** al cerrar + **justificantes** por persona
   (no fiscales). Factura real por parte = fuera de v1.
6. **Mezclar modos** → **SÍ se permite mezclar.** Clave (§6.1): IGUAL/IMPORTE reparten
   **el pendiente**, no el total.

### 6.1 Modelo de mezcla — "cobra lo suyo y al resto divídelo" ⭐
Caso real que manda en el diseño: *"unos se van y dicen 'cóbrame una pizza y una
Coca-Cola'; se lo cobras. Los demás siguen en la mesa y al irse dicen 'divídenos lo
que falte a partes iguales'."*

Consecuencias de diseño:
- **PRODUCTOS** saca líneas concretas del pendiente y las cobra.
- **IGUAL / IMPORTE** operan **sobre el pendiente** (`total − ya cobrado`), **no**
  sobre el total original. → "a partes iguales" = repartir **lo que queda** entre N.
- Una misma cuenta puede tener partes de distinto `tipo` a lo largo del tiempo (por eso
  `cuenta_parte.tipo` es por parte, no por cuenta).
- Regla de oro: en todo momento **`Σ(partes cobradas) + pendiente = total`**. Cada cobro
  reduce el pendiente; cuando el pendiente llega a 0, la mesa se cierra y factura.

**Ejemplo numérico** (total 40 €):
```
1) Cobrar por PRODUCTOS: pizza 8 + Coca 2 = 10 €   → cobrado 10, pendiente 30
2) Dividir el PENDIENTE (30 €) a PARTES IGUALES entre 3 → 3 × 10 €
3) Cobrar las 3 partes → cobrado 40, pendiente 0    → mesa COBRADA + 1 factura
```

---

## 7. Estado de implementación (hoy)

- 🟢 Modal `DividirCuentaModal` con 3 pestañas (IGUAL/PRODUCTOS/IMPORTE), estilo
  `ModalTPV` (arrastrable/redimensionable), justificante proforma por parte.
- 🟢 Renombrado Barra → Aparcado.
- 🟡 Persistencia de partes (`cuenta_parte`) — **pendiente** (este documento).
- 🟡 Cobro parcial + navegación a mesas — **pendiente**.
