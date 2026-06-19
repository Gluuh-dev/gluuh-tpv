# Compras y Stocks › Proveedores

> Ficha de **proveedor** (a quién se compra): datos fiscales, contacto, **personas de contacto** múltiples, recargo de equivalencia y operativa de compra. Base del módulo de compras de [06 — Compras, proveedores e inventario](../../06-compras-proveedores-e-inventario/).

Capturas: `Proveedores` (listado) + `Editar Proveedor`.

---

## A. Listado
Columnas **Id · Nombre Fiscal · Nombre Comercial · CIF/NIF · Cuenta Contable · Teléfono · Dirección · Población · Provincia · Cód. Postal · Email**. CRUD (0 registros aquí).

## B. Editar Proveedor — secciones

### 1. Datos Administrativos
- **Nombre Fiscal** · **Nombre** (comercial) · **CIF** · **Cuenta Contable** · ☐ **Aplicar recargo de equivalencia**.

### 2. Datos de Contacto
- Teléfono · Página Web · Email.

### 3. Ubicación
- Dirección · Población · Provincia · Código Postal.

### 4. Personas de Contacto
- Tabla **Nombre · Teléfono · Email · Almacén · Dirección · Población · Provincia** (N personas, con **almacén** asociado → comercial que sirve a cada almacén).

### 5. Operativa de Compra
- ☐ **Mostrar solo productos de este proveedor** en documentos de compra.
- ☐ **Avisar al crear un documento de compra con un número existente** (evita duplicar nº de factura de proveedor).

### 6–7. Colapsadas → **`[propuesta]`**
- **Grupos de Puntos de Venta**: en qué locales/grupos está disponible el proveedor.
- **Notas**: observaciones internas (condiciones, incidencias).

---

## Mapeo a nuestro modelo

```sql
create table supplier (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre_fiscal text not null, nombre_comercial text,
  nif text, cuenta_contable text,
  recargo_equivalencia boolean default false,
  telefono text, web text, email text,
  direccion text, poblacion text, provincia text, cp text,
  mostrar_solo_sus_productos boolean default false,
  avisar_doc_duplicado boolean default false,
  notas text
);
create table supplier_contact (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references supplier(id),
  nombre text, telefono text, email text,
  almacen_id uuid,                    -- almacén que atiende
  direccion text, poblacion text, provincia text
);
-- precios/condiciones por (proveedor, producto) → supplier_product (ver 06)
```

- Coincide con la propuesta de [06]. Validar NIF/CIF; el **recargo de equivalencia** afecta a las facturas de compra (IVA soportado). Liga con *Proveedores Habituales* del producto ([producto.md §7](../productos/producto.md)). 🔴 falta.

## Mejoras sobre Ágora

- **Precio y referencia por producto‑proveedor** con histórico, para comparar y elegir el más barato.
- **Días de reparto / pedido mínimo** y generación automática de pedido por bajo stock.
- Importar catálogo de proveedor (CSV) y conciliar facturas de compra.
