# Compras y Stocks › Documentos de compra (Pedido → Albarán → Factura)

> El **flujo de aprovisionamiento** en tres documentos encadenados: **Pedido a Proveedor** (lo que pido) → **Albarán de Entrada** (lo que recibo, actualiza stock y PMP) → **Factura de Proveedor** (lo que pago, agrupa albaranes). Es la operativa de [06 — Compras e inventario](../../06-compras-proveedores-e-inventario/).

```
Pedido a Proveedor ──recibir──► Albarán de Entrada ──facturar──► Factura de Proveedor
  (Confirmar Pedido)              (Confirmar → +stock, +PMP)       (agrupa albaranes, pago)
```

Capturas: `Pedidos a Proveedor`, `Albaranes de Entrada`, `Facturas de Proveedor` (listados + editores).

---

## 1. Pedido a Proveedor

**Listado** — Id · Número · Doc. Proveedor · Fecha · **F. Entrega** · Almacén · Proveedor · Estado · Base($) · Total($).

**Editor** — cabecera (diálogo): **Proveedor** · **Almacén** · **Doc. Proveedor** · **Fecha** · **Fecha Entrega**. Cuerpo:
- **Productos**: Producto · Cantidad · **Unidad** · **Servida** (cuánto se ha recibido ya) · Precio U.C · % Imp · Dto % · Dto $ · Total $.
- Botones: **Propuesta Reposición** (genera líneas automáticamente según stock mínimo) · **Importar** · **Confirmar Pedido**.

> **Propuesta Reposición** = el sistema sugiere qué pedir por bajo stock → mejora directa que recomendamos en [almacenes.md](almacenes.md).

## 2. Albarán de Entrada (recepción)

**Listado** — Id · Número · Doc. Proveedor · Fecha · Almacén · Proveedor · **Estado** · **Factura** · Base($) · Total($).

**Editor** — cabecera (diálogo): Proveedor · Almacén · Doc. Proveedor · Fecha. Cuerpo:
- **Productos**: Producto · Cantidad · Unidad · Precio U.C · % Imp · Dto % · Dto $ · Total $ · **Doc. Pedido** (enlace al pedido).
- Botones: **Pte. Recibir** (trae líneas pendientes de pedidos) · **Importar** · **Confirmar** · **Pie** (Dto % / Dto $ global).

> Al **Confirmar** el albarán: **entra el stock** en el almacén y se **recalcula el PMP** ([almacenes.md §4](almacenes.md)). El "Doc. Pedido" cierra el ciclo pedido→recepción y marca "Servida" en el pedido.

## 3. Factura de Proveedor

**Listado** — Id · Número · Doc. Proveedor · Fecha · Fecha Recepción · Almacén · Proveedor · Base($) · Total($) · **Pendiente($)** · **Estado**.

**Editor** — cabecera (diálogo): Proveedor · **Doc. Proveedor** · **Fecha de Emisión** · **Fecha de Recepción**. Cuerpo:
- **Albaranes**: tabla (Fecha · Almacén · Proveedor · Documento · Doc. Proveedor · Base · Total) — **añadir/quitar albaranes** que agrupa la factura.
- Botones: **Guardar PDF** · **Enviar** (email).

> La factura **agrupa N albaranes** (típico: una factura mensual del proveedor con todos los albaranes del mes). **Pendiente** rastrea el pago; **IVA/IGIC soportado** para el resumen fiscal.

---

## Mapeo a nuestro modelo

```sql
create table purchase_order (            -- Pedido a Proveedor
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  numero text, serie_id uuid, supplier_id uuid, stock_location_id uuid,
  doc_proveedor text, fecha date, fecha_entrega date, estado text);
create table purchase_order_line (
  order_id uuid references purchase_order(id), product_id uuid,
  cantidad numeric(14,3), unidad text, servida numeric(14,3) default 0,
  precio numeric(12,4), imp numeric(6,3), dto numeric(6,3), total numeric(12,2));

create table goods_receipt (             -- Albarán de Entrada
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  numero text, serie_id uuid, supplier_id uuid, stock_location_id uuid,
  doc_proveedor text, fecha date, estado text, purchase_invoice_id uuid);
create table goods_receipt_line (
  receipt_id uuid references goods_receipt(id), product_id uuid,
  cantidad numeric(14,3), unidad text, precio numeric(12,4),
  imp numeric(6,3), dto numeric(6,3), total numeric(12,2),
  purchase_order_id uuid);              -- "Doc. Pedido"

create table purchase_invoice (          -- Factura de Proveedor
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  numero text, serie_id uuid, supplier_id uuid,
  doc_proveedor text, fecha_emision date, fecha_recepcion date,
  base numeric(12,2), total numeric(12,2), pendiente numeric(12,2), estado text);
-- purchase_invoice agrupa goods_receipt (1:N vía goods_receipt.purchase_invoice_id)
```

- Multi‑tenant RLS. Series de compra desde [almacenes.md §2](almacenes.md) (`PC`/`AC`/`FC`, [series.md](../administracion/series.md)). Confirmar albarán → `stock_movement` (entrada) + recálculo PMP en `stock_item`. 🔴 todo el módulo falta.

## Mejoras sobre Ágora

- **Recepción parcial** clara (Servida vs pedida) con alertas de lo pendiente.
- **Conciliación factura↔albaranes** automática y aviso de discrepancias de precio/cantidad.
- **OCR/import** de factura de proveedor (PDF/e‑factura) para alta semiautomática.
- Pago: integración con vencimientos y conciliación bancaria (Pendiente $).
