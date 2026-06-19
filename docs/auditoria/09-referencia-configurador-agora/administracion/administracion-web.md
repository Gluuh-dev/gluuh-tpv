# Administración › Administración Web

> Configuración del **propio backoffice web** (no del negocio): idioma, logo de la web, límites de listados y **filtros de categorías por módulo**. Es meta‑configuración de la herramienta de administración.

Captura: `Administración Web`.

---

## Ágora — qué muestra

**Configuración**
- **Idioma** — `Español`.
- **Logo** — imagen (`lapalma`, tamaño recomendado **360×112 px**) del backoffice web.

**Listado de productos**
- **Nº Max** — `20000` (tope de productos cargados en el listado web).
- ☑ **Incluir tarifas** — mostrar columnas de tarifas en el listado.

**Etiquetas de Categorías** (qué categorías se muestran/filtran en cada módulo web; todas = sin filtro)
- Informes — `Todas`
- Reposición Almacén — `Todas`
- Pedidos a Proveedor — `Todas`
- Conteos de Inventario — `Todas`
- Traspasos de Almacén — `Todas`
- Platos de Menús — `Todas`
- Notas de Preparación — `Todas`

---

## Qué necesitamos / Mapeo

- **Idioma y logo del backoffice** → ya encaja con nuestra personalización de marca (memoria de diseño: backoffice verde Supabase/Notion). `setting scope=GLOBAL` claves `web.idioma`, `web.logo`.
- **Límite de listado** (`Nº Max`): nosotros preferimos **paginación/virtualización** (Next.js) en vez de un tope duro — ver [react-best-practices] y la operativa de tablas. Mejora directa sobre Ágora.
- **Filtros de categorías por módulo**: en nuestro backoffice, filtros guardables por vista; menos necesario si las tablas ya filtran/paginan bien.

> Prioridad **baja**: es configuración de la herramienta, no del negocio. Útil tenerla, pero no bloquea operativa ni fiscalidad.

## Mejoras sobre Ágora

- Sustituir `Nº Max 20000` por **paginación + búsqueda server‑side** (no cargar 20k filas en el navegador).
- Logo e idioma del backoffice unificados con la **marca del local** ([Empresa](empresa.md) + personalización), no un ajuste aparte.
