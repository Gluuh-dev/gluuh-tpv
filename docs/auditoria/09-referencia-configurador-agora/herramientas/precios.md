# Herramientas › Precios (programación, márgenes, modificación masiva, etiquetas, import/export)

> Conjunto de utilidades de **gestión de precios**: programar tarifas por franja, ajustar márgenes, modificar precios en masa, imprimir etiquetas de cambios y round‑trip con Excel. Operan sobre las [Tarifas](../administracion/tarifas.md) y los precios de [producto.md §8](../productos/producto.md). (Subsección *Precios* de Herramientas; la otra es *Visualización* → [planos-mesas.md](planos-mesas.md), [configuracion-botones.md](configuracion-botones.md), [ordenar-productos.md](ordenar-productos.md), [acciones-personalizadas.md](acciones-personalizadas.md).)

Capturas: `Programador de Tarifas`, `Etiquetado de Cambios de Precio`, `Ajustar Márgenes`, `Modificación Global de Precios`, `Importar/Exportar Precios desde/a Excel`.

---

## 1. Programador de Tarifas ★ (precios por franja / happy hour)

> "Configure el rango de fechas, franjas horarias y días de la semana en que aplicar **distintas tarifas a cada centro de venta**. Si en una franja no se especifica tarifa, se aplica la tarifa por defecto del centro."

Por cada programación: **Centro de Venta** · **Tarifa** · **Rango de Fechas** (`Siempre` o Desde/Hasta) · **Franja Horaria** (Inicio/Fin) · **Días de la Semana** (L M X J V S D). Botón **➕ Añadir** (N programaciones) y *Eliminar esta programación*.

> Es el motor de **precios programados** (happy hour, terraza nocturna, mediodía): cambia la **tarifa activa** de un centro según fecha/hora/día. En Gluuh, reutiliza [periodos-servicio.md](../administracion/periodos-servicio.md) y [centros-de-venta.md](../administracion/centros-de-venta.md).

```sql
create table price_list_schedule (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  sales_center_id uuid, price_list_id uuid,
  desde date, hasta date,                 -- null = siempre
  hora_inicio time, hora_fin time,
  dias_semana int[]                       -- [1..7]
);
-- resolver tarifa activa = match por centro + fecha/hora/día; fallback a la tarifa por defecto del centro
```

## 2. Ajustar Márgenes

Selección **Familias · Categorías · Tarifa** → tabla por producto con **Pr. Coste Ref. · Pr. Venta Principal/Añadido/Menú Ant.** y **Nuevo Pr. Coste · Nuevo Pr. Venta Principal/Añadido/Menú**. Botones **Copiar · Actualizar**.

> Recalcula el **PVP a partir del coste y un margen objetivo** (food cost %), mostrando antiguo vs nuevo antes de aplicar. Liga con el escandallo/coste ([almacenes.md](../administracion/../09-referencia-configurador-agora/compras-stocks/almacenes.md), [06](../../06-compras-proveedores-e-inventario/)). Operación de actualización masiva sobre `product_price`.

## 3. Modificación Global de Precios

Selección **Familias · Categorías** → tabla de productos. Botones **Copiar Tarifa** (clona precios de una tarifa a otra) · **Modificar Precios** (subida/bajada %/importe en masa) · **Aplicar**.

> Cambio masivo de precios (p. ej. +5% a todo) y **clonar una tarifa** completa en otra (LOCAL→COFFEE). Update masivo sobre `product_price`.

## 4. Etiquetado de Cambios de Precio

**Parámetros:** **Tarifa · Fecha · Hora** → **Buscar** lista los **productos cuyo precio cambió** desde ese momento (Id · Nombre · Familia · Actualizado · Precio · Precio Añadido · Supl. Menú), filtrables. Botón **Imprimir** (etiquetas).

> Imprime **etiquetas de lineal** solo de lo que ha variado de precio → evita reetiquetar todo. Usa las [Plantillas de Etiquetas](../administracion/plantillas-etiquetas.md). Requiere un campo `actualizado_en` por `product_price`.

## 5. Importar / Exportar Precios (Excel)

- **Importar Precios desde Excel**: seleccionar fichero `.xlsx` → actualiza precios en masa.
- **Exportar Precios a Excel**: filtrar **Familias · Categorías** → genera `precios.xlsx`.

> Round‑trip para editar precios en hoja de cálculo. En Gluuh: endpoints en `apps/api` con **plantilla validada** (mejora sobre [exportar-productos.md](exportar-productos.md) y el tope de [administracion-web.md](../administracion/administracion-web.md)). Generación/parseo en backend.

---

## Mapeo y prioridad

| Herramienta | Mapeo | Prioridad |
|-------------|-------|-----------|
| Programador de Tarifas | `price_list_schedule` + resolución de tarifa activa | **alta** (happy hour real) |
| Ajustar Márgenes | update masivo `product_price` desde coste+margen | media‑alta (rentabilidad) |
| Modificación Global / Copiar Tarifa | update/clonado masivo `product_price` | media |
| Etiquetado de Cambios | `product_price.actualizado_en` + etiquetas | baja (retail) |
| Import/Export Excel | endpoints `apps/api` | media |

> Todo pasa por `@gluuh/core` para mantener **impuesto incluido** y desglose correcto; los cambios de precio deben quedar **auditados** (quién, cuándo) y, si afectan a documentos ya emitidos, **no** retroactivos (VERIFACTU). 🔴 falta.

## Mejoras sobre Ágora

- **Programación visual** de tarifas (calendario + franjas) reutilizando periodos de servicio; vista previa del precio activo "ahora".
- **Simulador de margen**: ver food cost % y beneficio antes de aplicar; alertas de productos por debajo de margen objetivo.
- Import/Export con **plantilla validada** y a Google Sheets; histórico de cambios de precio por producto.
