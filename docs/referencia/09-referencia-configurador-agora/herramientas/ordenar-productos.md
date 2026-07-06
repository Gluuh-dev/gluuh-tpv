# Herramientas › Ordenar (productos, familias y categorías)

> Utilidades para fijar el **orden de aparición** en la pantalla de venta: productos dentro de una categoría/familia, y el orden de las familias/categorías por grupo de terminales. El orden importa para la **velocidad** (lo más vendido, primero).

Capturas: `Ordenar Productos en Categoría`, `Ordenar Productos en Familia`, `Ordenar Familias y Categorías`.

---

## Ágora — qué muestra (3 herramientas, mismo patrón)

Selector del contenedor + lista reordenable con **↑/↓** (o **Ordenar por Id** / **Ordenar por Nombre**) + **Aplicar**:

1. **Ordenar Productos en Categoría** — elige `Categoría` (p. ej. `CAFE`) → ordena `CAFE SOLO, CAFE CORTADO, CAFE CON LECHE, MANCHADA, CARAJILLO…`.
2. **Ordenar Productos en Familia** — elige `Familia` (p. ej. `1/2 TOSTADA`) → ordena sus productos.
3. **Ordenar Familias y Categorías** — elige `Grupo de Puntos de Venta` (p. ej. `TPVS`) → ordena los **grupos** (`CAFE, SANDWICHS, BOCADILLOS, HAMBURGUESAS, REFRESCO…`) tal como salen en ese TPV.

> El **orden por grupo de terminales** permite que la cafetería y el restaurante tengan distinta disposición de botones sin duplicar el catálogo.

## Mapeo a nuestro modelo

- Un campo **`orden`** (int) en cada relación: `product_category.orden`, `family.orden`/`category.orden` por `device_group`. Reordenar = actualizar `orden` con drag‑drop.

```sql
alter table product_category add column orden int default 0;
create table group_layout_order (        -- orden de familias/categorías por grupo de TPV
  device_group_id uuid, entity_type text, entity_id uuid, orden int
);
```

🔴 falta (los listados existen; el orden manual por pantalla, no).

## Mejoras sobre Ágora

- **Drag‑and‑drop táctil** real (no solo ↑/↓), con vista previa de la rejilla del TPV.
- **Orden por uso**: sugerir orden según ventas (lo más vendido arriba) con un clic.
- Orden por **franja horaria** (desayunos arriba por la mañana) reutilizando [periodos-servicio.md](../administracion/periodos-servicio.md).
