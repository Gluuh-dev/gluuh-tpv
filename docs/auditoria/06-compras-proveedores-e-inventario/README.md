# 06 — Compras, proveedores e inventario

> Módulo de **aprovisionamiento e inventario** del TPV Gluuh. Cubre proveedores, artículos de
> compra (materias primas), escandallo (coste de receta), pedidos y recepción, facturas de
> compra con IVA/IGIC soportado, stock por almacén, descuento automático al vender e informes
> de gestión. El catálogo de venta (`product`, `ingredient`, `recipe_line`) se define en la
> [carpeta 03 — Catálogo de productos](../03-catalogo-productos/README.md); aquí **no se
> redefine**, se referencia y se extiende con la cara de aprovisionamiento. Requisitos de
> producto en [`docs/03-requisitos-funcionales.md`](../../03-requisitos-funcionales.md)
> (módulo Catálogo → «Escandallos / inventario»).

---

## 1. Alcance y decisiones de modelo

Este módulo introduce una distinción que es la fuente de la mayoría de los errores en TPV de
hostelería y que aquí queremos resolver de raíz:

| Concepto | Tabla | Qué es | Quién lo «toca» |
|---|---|---|---|
| **Producto de venta** | `product` (carpeta 03) | Lo que el cliente pide y paga (un «Gin-tonic», un «Solomillo») | TPV, carta, fiscalidad |
| **Ingrediente / artículo de compra** | `ingredient` (carpeta 03) + `stock_item` | La materia prima que se compra y se almacena (ginebra, solomillo a granel) | Compras, almacén |
| **Escandallo** | `recipe_line` (carpeta 03) | La receta que une producto ↔ ingredientes con cantidades | Cocina, control de costes |

> **Decisión de modelo.** `ingredient` (definido en 03) es el **identificador semántico** de la
> materia prima y el ancla del escandallo. Pero el control de **stock, coste y compra** vive en
> tablas nuevas de este módulo (`stock_item`, `stock_movement`, …) enlazadas 1:1 con
> `ingredient`. ¿Por qué separarlos en vez de hinchar `ingredient`? Porque (a) el escandallo es
> estable y editorial mientras que el stock es transaccional y de alto volumen; (b) un mismo
> ingrediente puede tener stock en **varios almacenes** (relación 1:N que no cabe en la ficha de
> receta); y (c) hay artículos de compra **sin escandallo** (botellines, refrescos, servilletas)
> que necesitan stock pero no aparecen en ninguna `recipe_line`. Por eso `stock_item` admite
> tanto `ingredient_id` como un enlace directo a `product_id` (venta directa por unidad).

Todas las tablas son **multi-tenant con RLS por `tenant_id`** (patrón `current_tenant_id()`,
ver migraciones en `supabase/migrations/*.sql` y el espejo de referencia en
`apps/api/db/schema.sql`).

---

## 2. Proveedores

### 2.1 Ficha de proveedor

Datos mínimos para operar y para que la **factura de compra** cuadre con Hacienda (IVA/IGIC
soportado deducible):

| Campo | Tipo | Notas |
|---|---|---|
| Razón social / nombre comercial | texto | obligatorio |
| NIF / CIF | texto | validar formato ES; clave para factura soportada |
| Dirección fiscal | texto | factura |
| Contacto (persona, tel, email) | texto | pedidos y reclamaciones |
| Condiciones de pago | enum + días | `contado` / `15 días` / `30 días` / `60 días` (FFE` net_days`) |
| Forma de pago | enum | transferencia / domiciliación / efectivo |
| IBAN | texto | para remesas |
| **Días de reparto** | máscara de días | L-M-X-J-V-S-D + hora de corte de pedido |
| Pedido mínimo | importe | aviso si el pedido no llega |
| Territorio fiscal | enum | `peninsula` / `canarias` (define si la compra es IVA o **IGIC**) |
| Activo | bool | baja lógica, nunca borrado (hay histórico de compras) |

### 2.2 Catálogo del proveedor (`supplier_product`)

Cada proveedor sirve un subconjunto de artículos, **con su referencia, su unidad de compra y su
precio**. El mismo artículo (`stock_item`) puede ser servido por varios proveedores a distinto
precio → esto habilita la **comparativa de precios** (§9).

- Referencia del proveedor (su código de artículo) + descripción tal como la factura.
- Unidad de compra (caja, garrafa, saco) y **cantidad por unidad de compra** (caja de 12 ud,
  garrafa de 5 L).
- Precio de compra vigente + **histórico de precios** (`supplier_price_history`): nunca se
  sobrescribe un precio, se cierra el anterior con `valid_to` y se abre el nuevo. Esto permite
  valorar compras antiguas y graficar evolución de coste.

---

## 3. Artículos de compra y unidades de conversión

El corazón del módulo. Un artículo se **compra** en una unidad, se **almacena/valora** en otra y
se **usa en receta** en una tercera. Hay que poder convertir entre las tres.

```
 UNIDAD DE COMPRA        UNIDAD DE STOCK (base)      UNIDAD DE USO (receta)
   1 caja           →        12 botellas        →         700 ml/botella
   1 saco           →          25 kg            →           g
   1 garrafa        →           5 L             →           ml
```

- **Unidad base de stock** (`stock_uom`): la unidad canónica en la que se guarda y valora el
  stock de ese artículo (p. ej. `g`, `ml`, `ud`). Toda conversión pasa por ella.
- **Factor de compra** (`purchase_to_stock_factor`): cuántas unidades base entran por unidad de
  compra. 1 caja = 12 × 700 ml = `8400` ml.
- **Merma** (`waste_pct`): porcentaje de pérdida por limpieza/desecho/manipulado. Un solomillo
  entero rinde ~80 % en porciones útiles ⇒ `waste_pct = 0.20`. La merma encarece el coste real
  por gramo **usado** (§4).

> **Regla de oro:** el stock **siempre** se mueve en unidad base. Comprar convierte
> compra→base; vender por receta convierte uso→base. Así nunca se mezclan «cajas» con «gramos».

---

## 4. Escandallo (coste de receta) — fórmulas

El escandallo recorre las `recipe_line` del producto (definidas en carpeta 03) y suma el coste
de cada ingrediente en su cantidad de uso, aplicando la merma.

### 4.1 Coste de un ingrediente en la receta

```
coste_unitario_base = coste_medio_ponderado / unidad_base        (€ por g, ml, ud)

coste_linea = cantidad_uso × coste_unitario_base × ( 1 / (1 − waste_pct) )
```

El factor `1 / (1 − merma)` reparte el desperdicio: si compras 1000 g pero solo aprovechas 800 g
(merma 0,20), cada gramo **servido** cuesta como 1,25 g comprados.

### 4.2 Coste total del plato y food cost

```
coste_receta   = Σ coste_linea           (sobre todas las recipe_line del producto)
precio_venta_sin_iva = precio_carta / (1 + tipo_impuesto)      (IVA o IGIC del producto)

food_cost_%    = coste_receta / precio_venta_sin_iva × 100
margen_bruto   = precio_venta_sin_iva − coste_receta
margen_%       = margen_bruto / precio_venta_sin_iva × 100

precio_sugerido_sin_iva = coste_receta / food_cost_objetivo      (p. ej. objetivo 30 %)
precio_sugerido_carta   = precio_sugerido_sin_iva × (1 + tipo_impuesto)
```

> El impuesto se resuelve por **clase fiscal × territorio** vía `@gluuh/core` `ivaAuto` y la
> tabla `tax_rate`/`resolver_iva()` (deben coincidir, ver CLAUDE.md). En Canarias el producto
> lleva **IGIC**, no IVA.

### 4.3 Ejemplo numérico — Gin-tonic

| Ingrediente | Cantidad uso | Coste base | Merma | Coste línea |
|---|---|---|---|---|
| Ginebra | 50 ml | 0,030 €/ml | 0 % | 1,500 € |
| Tónica | 200 ml | 0,0025 €/ml | 0 % | 0,500 € |
| Limón | 1 rodaja (15 g) | 0,004 €/g | 20 % | 15 × 0,004 / 0,8 = 0,075 € |
| Hielo + mermas | — | — | — | 0,050 € |
| **Coste receta** | | | | **2,125 €** |

Precio de carta **8,00 €**, IGIC Canarias 7 % ⇒ base = 8,00 / 1,07 = **7,477 €**.

```
food_cost_% = 2,125 / 7,477 = 28,4 %      → sano (objetivo bar ≈ 22–30 %)
margen_bruto = 7,477 − 2,125 = 5,352 €
precio_sugerido (objetivo 25 %) = 2,125 / 0,25 = 8,50 € sin imp. → 9,10 € en carta
```

---

## 5. Compras: pedido → recepción → factura

```
        ┌─────────────┐   envío    ┌──────────────┐  llega   ┌────────────────┐
 BORRADOR│ purchase_   │──────────►│ pedido        │────────►│ goods_receipt  │
   pedido │ order       │ (al prov.) │ ENVIADO       │ albarán │ (recepción)    │
        └─────────────┘            └──────────────┘          └───────┬────────┘
                                                                     │ entrada stock
                            comparación pedido vs recibido           ▼
                            (faltas, excesos, roturas)        stock_movement (IN)
                                                                     │
                                          ┌──────────────┐ casa con  │
                                          │purchase_invoice│◄─────────┘
                                          │ IVA/IGIC sop.  │  recepción(es)
                                          └──────────────┘
```

### 5.1 Pedido a proveedor (`purchase_order`)
- Cabecera (proveedor, almacén destino, fecha prevista, estado) + líneas
  (`purchase_order_line`: artículo del proveedor, cantidad pedida en unidad de compra, precio).
- Estados: `borrador → enviado → parcial → recibido → cerrado / cancelado`.
- Sugerencia de pedido automática a partir de **stock mínimo** y consumo (§7.4).

### 5.2 Recepción de mercancía / albarán (`goods_receipt`)
- Se registra **lo que realmente llega**, que puede no coincidir con lo pedido.
- Cada línea: cantidad recibida, lote/caducidad opcional, precio del albarán.
- **Comparación pedido vs recibido**: el sistema marca `cantidad_pedida − cantidad_recibida`
  (faltas/parciales) y `> pedida` (excesos), y deja la diferencia visible para reclamar.
- Al confirmar la recepción se generan **movimientos de entrada** (`stock_movement` tipo `IN`),
  convirtiendo compra→base, y se **recalcula el coste medio ponderado** (§6.2).

### 5.3 Factura de compra (`purchase_invoice`)
- Casa con una o varias recepciones; valida que importes y cantidades cuadren con los albaranes.
- Desglosa **base imponible + cuota soportada por tipo** (IVA 21/10/4 % o IGIC 7/3/0 % según
  territorio del proveedor). Esta cuota es el **IVA/IGIC soportado deducible** → alimenta el
  resumen fiscal de compras.
- Vencimientos según `condiciones de pago` del proveedor (control de tesorería).

---

## 6. Inventario / stock

### 6.1 Modelo de stock
- `stock_location` — almacén/local físico (cocina, barra, bodega, local 2). Multi-local.
- `stock_item` — un artículo inventariable (1:1 con `ingredient`, o directo a `product` para
  venta por unidad). Define `stock_uom`, factores y `waste_pct`.
- `stock_level` — existencias **por (artículo × almacén)**: `qty_on_hand`, `min_qty`,
  `avg_cost` (PMP vigente).
- `stock_movement` — **libro mayor inmutable** de todo movimiento. Nunca se edita una existencia
  a mano; se inserta un movimiento. El `qty_on_hand` es la suma de movimientos (o un cache
  reconciliado), coherente con la regla de sync «decrementos relativos» de la carpeta 06 de
  producto.

| Tipo de movimiento | Signo | Origen |
|---|---|---|
| `IN` entrada por compra | + | recepción de albarán |
| `OUT_SALE` salida por venta | − | venta vía receta (o stock directo) |
| `WASTE` merma | − | rotura, caducidad, invitación marcada como merma |
| `ADJUST` regularización | ± | recuento físico (§6.3) |
| `TRANSFER` traspaso | ±/∓ | entre almacenes (dos líneas) |

### 6.2 Valoración: Precio Medio Ponderado (PMP / coste medio)

> **Decisión:** se usa **PMP (coste medio móvil)**, no FIFO. Razón: en hostelería el producto es
> perecedero y de alta rotación, los lotes se mezclan físicamente (la garrafa nueva se vuelca
> sobre la media) y el PMP da un coste estable para escandallo sin necesidad de trazar capas FIFO
> por lote. Si en el futuro se exige trazabilidad por lote (caducidades), se añade sin romper el
> PMP, que sigue valiendo para coste.

En cada entrada se recalcula:

```
nuevo_avg_cost = (qty_actual × avg_cost_actual + qty_entrada × coste_entrada)
                 ────────────────────────────────────────────────────────────
                              (qty_actual + qty_entrada)
```

Las salidas valoran al `avg_cost` vigente y **no** lo modifican.

### 6.3 Recuento físico / inventario (`inventory_count`)
- Se «congela» el stock teórico, se introduce el **contado real** por artículo y almacén.
- El sistema calcula la **desviación** (teórico − real) y la valora a PMP (€ de descuadre).
- Al cerrar, genera movimientos `ADJUST` que dejan el teórico = real. Auditable (quién, cuándo).

### 6.4 Stock mínimo y alertas de reposición
- `min_qty` por artículo × almacén; opcionalmente `max_qty` (punto de reposición).
- Alerta cuando `qty_on_hand ≤ min_qty`; genera **propuesta de pedido** al proveedor preferente
  con la cantidad que falta para `max_qty`, agrupada por proveedor.

---

## 7. Descuento de stock automático al vender

Cuando se **cobra** una línea de venta (no al pedir, para no descontar comandas anuladas):

1. **Producto con escandallo:** por cada `recipe_line` se inserta un `stock_movement` `OUT_SALE`
   con `cantidad_uso × cantidad_vendida`, convertida a unidad base. Ej.: vender 3 gin-tonics
   descuenta 150 ml de ginebra, 600 ml de tónica, etc.
2. **Producto sin escandallo (stock directo):** botellín, refresco, snack. El `product` está
   ligado directamente a un `stock_item`; se descuenta 1 unidad base por unidad vendida.
3. **Mermas e invitaciones** marcadas en el TPV generan `WASTE` en vez de `OUT_SALE` (no son
   coste de venta, son pérdida).

> Idempotencia: el movimiento referencia la línea de venta (`sale_line_id`); si la venta se
> anula, se inserta el movimiento **inverso** (no se borra), conservando el libro mayor.

---

## 8. Informes

| Informe | Fórmula / base | Para qué |
|---|---|---|
| **Consumo teórico vs real** | Σ `OUT_SALE` (teórico por receta) vs desviaciones de recuento | detectar robo/merma oculta |
| **Rotación** | consumo periodo / stock medio | identificar inmovilizado y caducidades |
| **Valor de stock** | Σ `qty_on_hand × avg_cost` por almacén | balance, foto a cierre |
| **Food cost por plato / global** | §4 | rentabilidad de carta |
| **Márgenes** | margen_% por producto/familia | reingeniería de carta |
| **Comparativa de precios** | min/avg precio por artículo entre proveedores | negociación de compras |
| **IVA/IGIC soportado** | Σ cuota de `purchase_invoice` por tipo | liquidación fiscal |

---

## 9. Esquema de datos (PostgreSQL, multi-tenant RLS)

> Convenciones: `tenant_id uuid` en todas las tablas, FK a la organización; índice por
> `tenant_id` + claves de negocio; importes `numeric(14,4)` para cantidades base y
> `numeric(12,2)` para € de carta; RLS activada con política `using (tenant_id =
> current_tenant_id())`. `ingredient`, `product` y `recipe_line` provienen de la carpeta 03.

```sql
-- ─────────────────────────── PROVEEDORES ───────────────────────────
create table supplier (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  razon_social    text not null,
  nombre_comercial text,
  nif             text,
  tax_territory   text not null default 'peninsula',  -- 'peninsula' | 'canarias'
  email           text,
  telefono        text,
  iban            text,
  payment_method  text default 'transferencia',
  net_days        int  default 30,                    -- condiciones de pago
  delivery_days   text default 'LMXJV',               -- máscara días de reparto
  order_cutoff    time,                               -- hora de corte de pedido
  min_order_eur   numeric(12,2) default 0,
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index supplier_tenant_idx on supplier(tenant_id);

create table stock_location (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  nombre      text not null,                          -- 'Cocina', 'Barra', 'Bodega'
  local_id    uuid,                                   -- multi-local (FK a location)
  activo      boolean not null default true
);
create index stock_location_tenant_idx on stock_location(tenant_id);

-- ─────────────────────── ARTÍCULO INVENTARIABLE ────────────────────
create table stock_item (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  ingredient_id   uuid references ingredient(id),     -- 1:1 con escandallo (carpeta 03)
  product_id      uuid references product(id),        -- venta directa sin receta (botellín)
  nombre          text not null,
  stock_uom       text not null,                      -- unidad base: 'g','ml','ud'
  waste_pct       numeric(5,4) not null default 0,    -- merma 0..1
  is_purchasable  boolean not null default true,
  is_sellable_direct boolean not null default false,
  created_at      timestamptz not null default now(),
  check (ingredient_id is not null or product_id is not null)
);
create index stock_item_tenant_idx   on stock_item(tenant_id);
create index stock_item_ingredient_idx on stock_item(ingredient_id);

-- ─────────────────── CATÁLOGO Y PRECIOS DE PROVEEDOR ───────────────
create table supplier_product (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  supplier_id     uuid not null references supplier(id),
  stock_item_id   uuid not null references stock_item(id),
  ref_proveedor   text,                               -- código del proveedor
  descripcion     text,
  purchase_uom    text not null,                      -- 'caja','garrafa','saco'
  purchase_to_stock_factor numeric(14,4) not null,    -- unidades base por unidad de compra
  precio_compra   numeric(12,4) not null,             -- precio vigente (cache)
  preferente      boolean not null default false,     -- proveedor por defecto del artículo
  unique (tenant_id, supplier_id, stock_item_id)
);
create index supplier_product_item_idx on supplier_product(tenant_id, stock_item_id);

create table supplier_price_history (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  supplier_product_id uuid not null references supplier_product(id),
  precio_compra     numeric(12,4) not null,
  valid_from        timestamptz not null default now(),
  valid_to          timestamptz                       -- null = vigente
);
create index sph_item_idx on supplier_price_history(tenant_id, supplier_product_id);

-- ───────────────────────────── PEDIDOS ─────────────────────────────
create table purchase_order (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  supplier_id   uuid not null references supplier(id),
  location_id   uuid not null references stock_location(id),
  numero        text,
  estado        text not null default 'borrador',     -- borrador|enviado|parcial|recibido|cerrado|cancelado
  fecha_prevista date,
  created_at    timestamptz not null default now()
);
create index po_tenant_idx on purchase_order(tenant_id, estado);

create table purchase_order_line (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  purchase_order_id uuid not null references purchase_order(id) on delete cascade,
  supplier_product_id uuid not null references supplier_product(id),
  qty_pedida        numeric(14,4) not null,           -- en unidad de compra
  precio_unitario   numeric(12,4) not null
);
create index pol_po_idx on purchase_order_line(tenant_id, purchase_order_id);

-- ───────────────────── RECEPCIÓN / ALBARÁN ─────────────────────────
create table goods_receipt (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  purchase_order_id uuid references purchase_order(id),  -- puede ser recepción libre
  supplier_id       uuid not null references supplier(id),
  location_id       uuid not null references stock_location(id),
  albaran_ref       text,
  fecha             date not null default current_date,
  created_at        timestamptz not null default now()
);
create index gr_tenant_idx on goods_receipt(tenant_id);

create table goods_receipt_line (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  goods_receipt_id  uuid not null references goods_receipt(id) on delete cascade,
  supplier_product_id uuid not null references supplier_product(id),
  qty_recibida      numeric(14,4) not null,           -- unidad de compra
  precio_unitario   numeric(12,4) not null,
  lote              text,
  caducidad         date
);
create index grl_gr_idx on goods_receipt_line(tenant_id, goods_receipt_id);

-- ───────────────────── FACTURA DE COMPRA ───────────────────────────
create table purchase_invoice (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  supplier_id   uuid not null references supplier(id),
  numero        text,
  fecha         date not null,
  fecha_venc    date,
  base_imponible numeric(12,2) not null,
  cuota_iva_21  numeric(12,2) default 0,
  cuota_iva_10  numeric(12,2) default 0,
  cuota_iva_4   numeric(12,2) default 0,
  cuota_igic_7  numeric(12,2) default 0,              -- territorio canario
  cuota_igic_3  numeric(12,2) default 0,
  total         numeric(12,2) not null,
  estado_pago   text not null default 'pendiente'
);
create index pi_tenant_idx on purchase_invoice(tenant_id, estado_pago);

create table purchase_invoice_receipt (   -- N:M factura ↔ albaranes
  tenant_id          uuid not null,
  purchase_invoice_id uuid not null references purchase_invoice(id) on delete cascade,
  goods_receipt_id   uuid not null references goods_receipt(id),
  primary key (purchase_invoice_id, goods_receipt_id)
);

-- ─────────────────────── EXISTENCIAS Y MOVIMIENTOS ─────────────────
create table stock_level (
  tenant_id     uuid not null,
  stock_item_id uuid not null references stock_item(id),
  location_id   uuid not null references stock_location(id),
  qty_on_hand   numeric(14,4) not null default 0,     -- en unidad base
  avg_cost      numeric(12,6) not null default 0,     -- PMP € por unidad base
  min_qty       numeric(14,4) default 0,
  max_qty       numeric(14,4),
  primary key (stock_item_id, location_id)
);
create index sl_tenant_idx on stock_level(tenant_id);

create table stock_movement (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  stock_item_id uuid not null references stock_item(id),
  location_id   uuid not null references stock_location(id),
  tipo          text not null,                        -- IN|OUT_SALE|WASTE|ADJUST|TRANSFER
  qty           numeric(14,4) not null,               -- signo según tipo, en unidad base
  coste_unitario numeric(12,6),                        -- coste de la entrada (para PMP)
  ref_type      text,                                 -- 'goods_receipt'|'sale_line'|'inventory_count'
  ref_id        uuid,
  created_at    timestamptz not null default now()
);
create index sm_item_loc_idx on stock_movement(tenant_id, stock_item_id, location_id);
create index sm_ref_idx       on stock_movement(tenant_id, ref_type, ref_id);

-- ───────────────────── INVENTARIO FÍSICO ───────────────────────────
create table inventory_count (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  location_id   uuid not null references stock_location(id),
  estado        text not null default 'abierto',      -- abierto|cerrado
  fecha         timestamptz not null default now(),
  created_by    uuid
);
create index ic_tenant_idx on inventory_count(tenant_id, estado);

create table inventory_count_line (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  inventory_count_id uuid not null references inventory_count(id) on delete cascade,
  stock_item_id     uuid not null references stock_item(id),
  qty_teorico       numeric(14,4) not null,           -- congelado al abrir
  qty_real          numeric(14,4),                    -- contado
  avg_cost          numeric(12,6)                      -- para valorar la desviación
);
create index icl_count_idx on inventory_count_line(tenant_id, inventory_count_id);
```

Política RLS (mismo patrón en todas):

```sql
alter table supplier enable row level security;
create policy supplier_rls on supplier
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
-- … repetir para cada tabla del módulo …
```

> **Espejo de referencia.** Recuerda mantener `apps/api/db/schema.sql` como espejo de estas
> migraciones (ver `supabase/README.md`): si se aplica este DDL como migración, actualizar
> también el schema de referencia.

---

## 10. Backoffice: pantallas y campos

| Pantalla | Campos / acciones clave |
|---|---|
| **Proveedores** | ficha (§2.1), catálogo servido, histórico de precios, ver pedidos/facturas |
| **Artículos de compra** | unidad base, factores de conversión, merma, proveedor preferente |
| **Escandallos** | editor de `recipe_line`, food cost % en vivo, precio sugerido (§4) |
| **Pedidos** | crear/enviar, sugerencia automática por stock mínimo, estado |
| **Recepción** | introducir albarán, comparativa pedido vs recibido, lote/caducidad |
| **Facturas de compra** | casar con albaranes, desglose IVA/IGIC, vencimientos |
| **Stock** | existencias por almacén, alertas de reposición, traspasos |
| **Inventario** | abrir recuento, hoja de conteo, desviaciones valoradas, cerrar |
| **Informes** | consumo, rotación, valor de stock, márgenes, comparativa de precios |

Todo configurable por tenant; las clases fiscales y tipos (IVA/IGIC) se heredan del catálogo y
del territorio del proveedor — no se reintroducen aquí.

---

## 11. Resumen accionable (orden de implementación)

1. `stock_location` + `stock_item` (cimiento; sin esto no hay nada).
2. `supplier` + `supplier_product` + histórico de precios.
3. `stock_movement` + `stock_level` con recálculo de **PMP** (trigger o servicio).
4. **Descuento automático al vender** vía `recipe_line` y stock directo (§7).
5. Pedidos → recepción → factura (compra completa, con comparativa y casado).
6. `inventory_count` (recuento) y alertas de stock mínimo.
7. Informes (§8) sobre los movimientos ya existentes.

> El escandallo (carpeta 03) y este módulo se cierran mutuamente: la receta **define** el
> consumo, el stock lo **ejecuta** y lo **valora**, y el food cost cierra el círculo entre
> compra y precio de carta.
