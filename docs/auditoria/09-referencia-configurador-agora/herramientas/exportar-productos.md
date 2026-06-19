# Herramientas › Exportar Productos

> Utilidad de **exportación** del catálogo/inventario a fichero (Excel/CSV) para capturar datos con **apps externas** (p. ej. contar inventario con una hoja o un lector externo y reimportar). Primera ficha de la sección **Herramientas**.

Captura: `Exportar Productos`.

---

## Ágora — qué muestra

> "La exportación de productos le permitirá agilizar procesos de gestión de almacén, como entradas de mercancía e inventarios, ayudándole a capturar la información con aplicaciones externas."

**Opciones de Exportación:**
- **Almacén** (`Almacén General`)
- **Tipo de Exportación** (`Inventario` / catálogo / precios…)
- **Familias** (`Todas` o filtro)
- **Categorías** (`Todas` o filtro)
- **Tipo Fichero** (`Excel` / CSV…)

---

## Qué necesitamos / Mapeo

- Export server‑side del catálogo/inventario filtrable por almacén/familia/categoría a **Excel/CSV** (y reimport para inventario, ver [inventario.md](inventario.md)).
- No requiere tabla nueva: es un **endpoint** (`apps/api`) que serializa `product`/`stock_item`. Generar el fichero en backend (no cargar 20k filas en el navegador, mejora sobre el tope de [administracion-web.md](../administracion/administracion-web.md)).

> Prioridad **media**: útil para inventarios con herramienta externa, pero nuestra app de almacén ([app-almacen.md](../compras-stocks/app-almacen.md)) cubre el recuento nativo. 🔴 falta.

## Mejoras sobre Ágora

- **Import/Export con plantilla validada** (cabeceras fijas, validación de tipos) para evitar errores al reimportar.
- Export también a **Google Sheets** y formato compatible con el conteo móvil.
