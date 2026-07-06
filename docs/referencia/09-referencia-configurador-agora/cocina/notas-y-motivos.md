# Cocina › Notas de Preparación y Motivos de Cancelación

> Dos catálogos de **textos predefinidos** para agilizar la operativa: **Notas de Preparación** (las anotaciones de cocina de un toque: "poco hecho", "sin cebolla", "celíaco"…) y **Motivos de Cancelación** (por qué se anula una línea). Las notas son justo las *"anotaciones para cocina"* que pediste. Ligan con [03 — Catálogo](../../03-catalogo-productos-y-modificadores/) y [05 — KDS](../../05-cocina-kds-y-comanderas/).

Capturas: `Notas de Preparación`, `Motivos de Cancelación` (listados + editores).

---

## A. Notas de Preparación (notas de cocina predefinidas)

**Listado** — Id · **Texto** · Prioridad · **Global** · **Familias y categorías asociadas** (53 registros). Ej.: `VUELTA Y VUELTA`, `POCO HECHO`, `AL PUNTO`, `MUY HECHO`, `SIN GUARNICION`, `CELIACO` (→ familia `PUNTOS CARNE`); `SIN AZUCAR`, `DOBLE AZUCAR`, `LECHE FRIA`, `LECHE SIN LACTOSA` (→ `CAFE`).

**Editar Nota Predefinida:**
- **Texto** · **Prioridad** · ☑ **Mostrar en TPV** · ☐ **Mostrar en Carta Digital / Pedido en Mesa / Delivery**.
- Radio: **Asociar a todas las familias y categorías** / **Asociar solo a las seleccionadas**.
- Estilo: Texto · Color · Imagen.

> Clave: las notas se **filtran por familia/categoría** → al vender un filete (`PUNTOS CARNE`) aparecen "poco hecho/al punto/muy hecho"; al vender un café, "sin azúcar/doble azúcar". Es lo que activa *Solicitar automáticamente notas de preparación* del producto ([producto.md §1](../productos/producto.md)). Estas notas viajan a la **comanda de cocina/KDS**, no al ticket de cliente (salvo que la plantilla lo active, [plantillas-ticket.md §D#4](../administracion/plantillas-ticket.md)).

```sql
create table prep_note (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  texto text not null,
  prioridad int default 0,
  mostrar_tpv boolean default true,
  mostrar_online boolean default false,     -- carta digital/pedido en mesa/delivery
  global boolean default false,             -- todas las familias/categorías
  color text, imagen_url text
);
create table prep_note_scope (              -- si no es global
  prep_note_id uuid references prep_note(id),
  family_id uuid, category_id uuid
);
```

## B. Motivos de Cancelación

**Listado** — Id · Nombre · **Generar Merma** · Prioridad. Ej.: `SALE TARDE`, `FRIO`, `NO LO HA PEDIDO` (3 registros, Generar Merma `No`).

**Editar Motivo:** Texto · Prioridad · ☐ **Generar merma** · ☑ **Imprimir cancelación en cocina**.

> Conecta con *Solicitar motivo al cancelar líneas preparadas o impresas* ([locales.md §10](../administracion/locales.md)). **Generar merma** descuenta el stock como pérdida ([06 — Inventario](../../06-compras-proveedores-e-inventario/)); **imprimir en cocina** avisa a la partida de que anulen el plato. Alimenta el informe de **cancelaciones por usuario** del Cierre Z.

```sql
create table cancel_reason (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  texto text not null, prioridad int default 0,
  genera_merma boolean default false,
  imprime_cocina boolean default true
);
```

🔴 ambos faltan como configurador.

## Mejoras sobre Ágora

- Notas con **icono/atajo** y orden por uso real (las más usadas primero).
- Derivar notas de **alérgenos** (CELIACO ↔ alérgeno gluten) para coherencia.
- Motivo de cancelación **obligatorio** según permiso, y métrica de motivos para detectar problemas de cocina (muchos "FRIO" = revisar tiempos).
