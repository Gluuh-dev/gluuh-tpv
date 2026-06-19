# Compras y Stocks › Unidades de Medida

> Define **unidades** y sus **factores de conversión** a una unidad base. Permite comprar en una unidad (botella, barril, caja) y consumir/valorar en otra (cl, litro, unidad). Es la conversión compra↔uso que pide el escandallo de [06 — Inventario](../../06-compras-proveedores-e-inventario/).

Capturas: `Unidades de Medida` (listado + editor).

---

## Ágora — qué muestra

**Listado** — Id · Nombre · **Unidad Base**:

| Id | Nombre | Unidad Base |
|----|--------|-------------|
| 1 | Unidad | Unidad |
| 3 | CENTILITRO | 1 |
| 4 | BARRIL DE CERVEZA | LITRO |

**Editar Unidades de Medida:** **Nombre** · **Unidad Base** + tabla **Unidad · Factor de Conversión**. Ej. para `CENTILITRO`:
- `BOT 70 CL` → `1 × BOT 70 CL = 70 × 1` (una botella = 70 cl)
- `BOT 100 CL` → `1 × BOT 100 CL = 100 × 1` (una botella = 100 cl = 1 L)

> Modelo: una unidad base (cl, litro, unidad) y **sub‑unidades con factor** (botella, barril, caja). Permite: comprar "1 barril" y descontar "cañas de 25 cl" del stock, o comprar "1 caja" y vender "unidades".

---

## Mapeo a nuestro modelo

```sql
create table unit_of_measure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  unidad_base text not null              -- 'cl' | 'litro' | 'unidad'
);
create table unit_conversion (
  unit_id uuid references unit_of_measure(id),
  unidad text not null,                  -- 'BOT 70 CL', 'BARRIL'
  factor numeric(14,4) not null          -- 1 BOT 70 CL = 70 (unidad base)
);
```

> El producto referencia **Ud. de Medida** (uso/stock) y **Ud. de Compra** ([producto.md §7](../productos/producto.md)); la conversión une ambas. El **escandallo** valora la receta en unidad base y el **PMP** ([almacenes.md](almacenes.md)) en esa misma unidad. 🔴 falta.

## Mejoras sobre Ágora

- **Unidades estándar precargadas** (g, kg, ml, cl, l, unidad, docena) con sus factores SI — no empezar de cero.
- Conversión con **merma** (un barril rinde menos por espuma/posos): factor efectivo configurable.
- Validación: avisar si un factor de conversión es incoherente (0 o negativo).
