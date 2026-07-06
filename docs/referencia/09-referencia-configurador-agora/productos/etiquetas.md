# Productos › Etiquetas (tags)

> Maestro de **etiquetas/tags** libres que se asignan a familias, categorías y productos para **filtrar y segmentar** (informes, reposición, menús, carta online). Es el sistema de "Etiquetas" que aparece en [clasificacion.md](clasificacion.md) y [administracion-web.md](../administracion/administracion-web.md).

Captura: `Etiquetas Productos` → *Listado de Etiquetas* (vacío en este negocio).

---

## Ágora — qué muestra

CRUD simple **Id · Nombre** (Nuevo · Copiar · Editar · Eliminar · Buscar). Lista vacía aquí (no usan tags todavía).

## Qué necesitamos / Mapeo

- Tabla `tag` (id, tenant_id, nombre) y relaciones N:N con familia/categoría/producto.
- Filtro por etiqueta en listados, informes y carta digital.

```sql
create table tag (id uuid primary key default gen_random_uuid(), tenant_id uuid, nombre text);
create table entity_tag (tag_id uuid, entity_type text, entity_id uuid);  -- product|category|family
```

> Prioridad **media**: muy útil para cartas segmentadas (ej. tags `vegano`, `picante`, `novedad`, `temporada`) pero no bloquea operativa. 🔴 falta.

## Mejoras sobre Ágora

- Tags con **color/icono** para verlos en carta y carta digital (vegano 🌱, picante 🌶️).
- Tags **inteligentes/derivados** (p. ej. "sin gluten" derivado de alérgenos) además de los manuales.
