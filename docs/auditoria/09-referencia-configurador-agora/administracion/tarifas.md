# Administración › Tarifas (listas de precio)

> Una **tarifa** = lista de precios. Cada producto tiene un **precio por tarifa** ([producto.md §8](../productos/producto.md)) y cada **Centro de Venta** usa una tarifa ([centros-de-venta.md](centros-de-venta.md)). Así un mismo producto cuesta distinto en barra vs terraza vs cafetería sin duplicarlo. Define también si el precio es con **impuestos incluidos** o no.

Capturas: `Tarifas` (listado) + `Editar tarifa`.

---

## Ágora — qué muestra

**Listado** — Id · Nombre · **Tipo**:

| Id | Nombre | Tipo de precio |
|----|--------|----------------|
| 1 | **LOCAL** | Impuestos incluidos |
| 6 | **COFFEE** | Impuestos incluidos |

**Editar tarifa:** **Nombre** + **Tipo de Precio** (`Impuestos incluidos` / `Impuestos excluidos`) + **Grupos de Puntos de Venta** *(colapsada → `[propuesta]`: en qué grupos de terminales aplica la tarifa)*.

> ⚠️ **Corrección importante:** las filas `LOCAL`/`COFFEE` de los *Precios de venta* del producto son **tarifas**, no centros de venta. Cada centro de venta **apunta a** una tarifa. (Ajustado en [producto.md §8](../productos/producto.md).)

---

## Qué necesitamos / Mapeo

- Tarifas reutilizables con **tipo de precio** (incluido/excluido). En hostelería ES casi siempre **impuestos incluidos** (precio de carta), que `@gluuh/core` `calcularImpuestosIncluidos` desglosa hacia atrás.
- Precio de producto **por tarifa** (no por local ni por terminal directamente).

```sql
create table price_list (              -- "Tarifa"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,                -- LOCAL, COFFEE...
  precio_incluye_impuestos boolean default true
);
-- product_price.price_list_id → price_list(id)   (ver producto.md §8)
```

- 🟡 los precios existen en operativa; la gestión de **múltiples tarifas** 🔴 falta.

## Mejoras sobre Ágora

- **Herencia de tarifa**: si COFFEE no fija precio para un producto, usa LOCAL (no obligar a rellenar todas).
- Tarifas con **vigencia** (happy hour, temporada) y por **canal** (sala vs delivery vs carta online) — más potente que el simple nombre de Ágora.
- Aviso si una tarifa mezcla productos con precio incluido y excluido.
