# Compras y Stocks › Almacenes

> Define cada **almacén** (de dónde sale/entra el stock): su numeración de compra, datos fiscales propios opcionales, **método de valoración de coste** y proveedor de reposición por defecto. Confirma la elección de **PMP (Precio Medio Ponderado)** de [06 — Inventario](../../06-compras-proveedores-e-inventario/).

Capturas: `Almacenes` (listado) + `Editar Almacén`.

---

## A. Listado
**Id · Nombre**: `Almacén General`. CRUD. (Cada [Centro de Venta](../administracion/centros-de-venta.md) apunta a un almacén; cada [Punto de Venta](../administracion/puntos-de-venta.md) usa el de su centro.)

## B. Editar Almacén — secciones

### 1. Almacén
- **Nombre** · Dirección · Población · Provincia · Código Postal.

### 2. Series (numeración de compra del almacén)
- **Pedidos** · **Albaranes** · **Facturas** → series propias de los documentos de **compra** (ligan con [series.md](../administracion/series.md): `PC`/`AC`/`FC`).

### 3. Información Fiscal (opcional)
- ☐ **Al crear pedidos y albaranes de compra, usar estos datos fiscales** en lugar de los de empresa → **Cif** · **Nombre Fiscal** (útil si el almacén factura como otra razón social).

### 4. Actualización de Precios de Coste ★
| Evento | Método |
|--------|--------|
| **Al comprar** | `Precio de Compra` |
| **Al traspasar** | **`Precio Medio Ponderado`** (PMP) |
| **Al fabricar** | `Precio de Fabricación` |

> Confirma el modelo de valoración de [06]: el coste se recalcula con **PMP** en traspasos. Clave para el **escandallo/food cost** real.

### 5. Reposición de Productos
- **Usar Proveedor**: `Por Defecto` (qué proveedor se usa al reponer desde este almacén).

### 6. Colapsada → **`[propuesta]`**
- **Grupos de Puntos de Venta**: qué terminales/locales operan contra este almacén.

---

## Mapeo a nuestro modelo

```sql
create table stock_location (            -- "Almacén"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  direccion text, poblacion text, provincia text, cp text,
  -- series de compra
  serie_pedido_id uuid, serie_albaran_id uuid, serie_factura_id uuid,
  -- fiscal propio (opcional)
  usa_fiscal_propio boolean default false, nif text, nombre_fiscal text,
  -- valoración de coste
  coste_al_comprar text default 'PRECIO_COMPRA',
  coste_al_traspasar text default 'PMP',        -- Precio Medio Ponderado
  coste_al_fabricar text default 'PRECIO_FABRICACION',
  proveedor_reposicion_id uuid
);
create table stock_item (                -- existencias por (almacén, producto)
  stock_location_id uuid references stock_location(id),
  product_id uuid,
  cantidad numeric(14,3) default 0,
  coste_medio numeric(12,4) default 0,   -- PMP
  stock_minimo numeric(14,3),
  primary key (stock_location_id, product_id)
);
```

- Multi‑tenant RLS. El descuento de stock al vender pasa por la **receta/escandallo** ([06]); el **PMP** se recalcula en cada entrada. 🔴 falta como configurador (inventario modelado en [06], sin configurador aún).

## Mejoras sobre Ágora

- **Multi‑almacén real** con traspasos y trazabilidad (Ágora ya lo soporta; reforzar con auditoría de movimientos).
- Alertas de **stock mínimo** integradas con el aviso del TPV ([locales.md §8](../administracion/locales.md)) y generación de pedido de compra sugerido.
- Valoración visible (valor de inventario a PMP) en informes.
