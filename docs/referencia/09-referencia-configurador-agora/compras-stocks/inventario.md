# Compras y Stocks › Inventario (movimientos, variaciones, fabricación, cierres)

> Las operaciones de **stock**: el **histórico de movimientos** (libro mayor de existencias), las **variaciones** (ajuste / traspaso / recuento), las **fabricaciones** (producir un producto desde ingredientes) y los **cierres de almacén** (valoración a fecha). Completa el módulo de [06 — Inventario](../../06-compras-proveedores-e-inventario/).

Capturas: `Histórico de Movimientos`, `Variaciones de Stock`, `Fabricaciones`, `Cierres de Almacén`.

---

## 1. Histórico de Movimientos (libro mayor)

Filtros: **Desde · Hasta · Producto · Almacén** → tabla **Fecha · Tipo · Referencia · Cant. (Uds. Venta) · Stock (Uds. Venta)**.

> El **registro inmutable** de cada entrada/salida (compra, venta vía receta, ajuste, traspaso, fabricación, merma) con el **stock resultante**. Es la fuente de verdad de existencias y trazabilidad. En unidades de venta (convertidas, ver [unidades-medida.md](unidades-medida.md)).

```sql
create table stock_movement (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  stock_location_id uuid, product_id uuid,
  fecha timestamptz, tipo text,            -- COMPRA|VENTA|AJUSTE|TRASPASO|FABRICACION|MERMA
  referencia text,                         -- doc origen
  cantidad numeric(14,3), stock_resultante numeric(14,3),
  coste_unit numeric(12,4)
);
```

## 2. Variaciones de Stock (ajuste / traspaso / recuento)

**Listado** ("Listado de Inventarios") — Id · Fecha · **Tipo** · **Almacén Origen** · **Almacén Destino** · **Estado Traspaso** · Fecha Recepción · Motivo · Total Coste($).

**Editor** — diálogo: **Fecha** · **Tipo** (`Ajuste de Stock` / Traspaso / Inventario) · **Motivo** · **Almacén** (y destino si traspaso). Líneas: **Producto · Variación · Unidad · Pr. Coste($) · Total Coste($)** + **Importar**.

> Tres operaciones en una entidad:
> - **Ajuste de Stock** (regularización): corrige existencias (+/−) con **motivo** → enlaza con *Generar merma* de [notas-y-motivos.md](../cocina/notas-y-motivos.md).
> - **Traspaso**: mueve stock **origen→destino** entre almacenes, con **estado** y fecha de recepción (coste = PMP, [almacenes.md §4](almacenes.md)).
> - **Inventario** (recuento): introduce el conteo físico y genera la variación contra el teórico.

```sql
create table stock_variation (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  fecha date, tipo text,                   -- AJUSTE|TRASPASO|INVENTARIO
  motivo text,
  almacen_origen_id uuid, almacen_destino_id uuid,   -- destino solo en traspaso
  estado_traspaso text, fecha_recepcion date
);
create table stock_variation_line (
  variation_id uuid references stock_variation(id), product_id uuid,
  variacion numeric(14,3), unidad text, pr_coste numeric(12,4), total numeric(12,2));
```

## 3. Fabricaciones (producción)

**Listado** — Id · Fecha · **Documento** · Almacén · Notas · **Total Coste($)**.

**Editor** — diálogo: Fecha · Almacén · **Documento** (autogenerado) · Notas. Líneas: Producto · … · **Coste Ud. Stock($) · Total Coste($)** + **Imprimir Etiquetas** · **Actualizar Pr. Coste** · **Guardar como PDF**.

> **Fabricar** = consumir ingredientes y **producir** un producto (salsa madre, prep de obrador, pan, batch). Da de alta stock del producto fabricado a su **coste de fabricación** (= suma de ingredientes, [almacenes.md §4](almacenes.md) "Al fabricar"). **Actualizar Pr. Coste** recalcula el coste del producto resultante.

```sql
create table manufacturing (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  fecha date, documento text, stock_location_id uuid, notas text,
  total_coste numeric(12,2));
create table manufacturing_line (
  manufacturing_id uuid references manufacturing(id), product_id uuid,
  cantidad numeric(14,3), coste_unit numeric(12,4), total numeric(12,2));
-- consumo de ingredientes vía receta/escandallo (06)
```

## 4. Cierres de Almacén (valoración a fecha)

**Listado** — Id · Fecha · Almacén · **Valoración($)**. Botones: Nuevo · **Revisar** · Eliminar.

**Crear cierre** — **Fecha de cierre** · **Almacén**. Congela la **valoración del inventario** (a PMP) a esa fecha → base para contabilidad y comparación entre periodos.

```sql
create table stock_closing (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  fecha date, stock_location_id uuid, valoracion numeric(14,2));
create table stock_closing_line (
  closing_id uuid references stock_closing(id), product_id uuid,
  cantidad numeric(14,3), coste_unit numeric(12,4), valor numeric(14,2));
```

---

> Todo multi‑tenant RLS. El **descuento automático por venta** (vía receta), las **mermas** (motivos de cancelación) y las compras (albaranes) escriben en `stock_movement`; el **PMP** se mantiene en `stock_item`. 🔴 todo el módulo de inventario falta como configurador (modelado en [06]).

## Mejoras sobre Ágora

- **Recuento por móvil/escáner** (contar con el lector, no a mano) y ciego (sin ver el teórico) para inventarios fiables.
- **Alertas de descuadre** y de caducidad; trazabilidad de lote.
- Cierre de almacén **automático mensual** + informe de variación de valor y mermas.
- Conectar fabricación con el **escandallo** para que el coste del producto fabricado se actualice solo al cambiar ingredientes.
