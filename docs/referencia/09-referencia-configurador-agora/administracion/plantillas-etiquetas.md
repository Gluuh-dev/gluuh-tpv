# Administración › Plantillas de Etiquetas

> Editor de **etiquetas de producto** (código de barras, precio, lote/caducidad) para impresora de etiquetas térmica (EPL/ZPL). Distinto de las **plantillas de ticket** ([`plantillas-ticket.md`](plantillas-ticket.md)): aquí se diseña la pegatina física del artículo/balanza/estantería. Ruta Ágora: `#/admin/labels`.

Capturas: `Plantillas de Etiquetas` (listado, vacío) + `Editar Plantilla de Etiquetas`.

---

## Ágora — qué muestra

**Listado** (Id · Nombre) — vacío en este negocio. CRUD **Nuevo · Copiar · Editar · Eliminar**.

**Editor:**
- **Nombre**
- **Formato** — `EPL` (desplegable; típicamente EPL/ZPL/otros lenguajes de etiquetadora)
- **Tamaño (mm)** — `101` × `35`
- **Separación** — `Hueco` (gap entre etiquetas; alternativas: marca negra / continuo)
- **Añadir ▾** — insertar elementos en el diseño (texto, código de barras, precio, campo de producto…)
- Lienzo de **diseño** de la etiqueta (zona central editable)
- **Código Barras** (campo de prueba) · **Impresora** (`Ágora Printer`) · botón **Imprimir** (prueba)

---

## Qué necesitamos

- CRUD de plantillas de etiqueta con **formato de etiquetadora** (EPL/ZPL), **tamaño** y **tipo de separación**.
- Diseñador con campos del producto: **nombre, precio, código de barras (EAN), lote, caducidad, alérgenos**.
- Impresión de prueba a impresora de etiquetas.

> Prioridad: **baja** para un bar/restaurante típico (no lo usan: lista vacía). Relevante para tiendas/obrador/take‑away con etiquetado de producto envasado o balanza. Encaja con inventario y compras ([06](../../06-compras-proveedores-e-inventario/)).

## Mapeo a nuestro modelo

- Tabla `label_template` (id, tenant_id, nombre, formato, ancho_mm, alto_mm, separacion, diseño jsonb). 🔴 falta (fase posterior).
- Render a EPL/ZPL desde `apps/api` o un agente de impresión local (ver [04 — Impresión](../../04-impresion-y-tickets/)).

## Mejoras sobre Ágora

- Plantillas predefinidas por tamaños comunes (40×25, 60×40, 101×35).
- Campos de **alérgenos y caducidad** listos para etiquetado alimentario (cumplimiento info al consumidor).
- Vista previa WYSIWYG (Ágora muestra lienzo, pero sin datos reales en la captura).
