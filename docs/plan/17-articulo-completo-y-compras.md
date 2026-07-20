# 17 · El artículo completo, y las compras desde el TPV

**Estado:** plan vigente desde 20-07-2026 · sale de un inventario **verificado**
contra la BD real (`count(*)`, no estimaciones), `apps/web/app` y `apps/tpv`.

---

## 0 · La foto honesta

Lo que hay hoy, separado por lo único que importa: **si tiene datos y si alguien
lo lee**.

| Concepto | Modelo | Datos | ¿Alguien lo LEE al vender? |
|---|---|---|---|
| Identidad, familia, categorías m2m | ✅ | 224 prod · 168 m2m | ✅ |
| Precio base (`product.precio`) | ✅ | 224 | ✅ **es el único precio que se cobra** |
| Formatos (`product_format`) | ✅ | 116 en 48 prod | ⚠️ solo para mostrar |
| Fiscalidad, alérgenos, etiquetas | ✅ | 224 / 110 / 18 | ✅ |
| Extras y comentarios + herencia | ✅ | 58 grupos · 216 opciones · 14 asignaciones | ✅ |
| Menús (`menu`/`menu_group`/`menu_choice`) | ✅ | 2 / 8 / 30 | ✅ |
| Precio por tarifa (`product_price`) | ✅ | 75 filas · 1 tarifa | ❌ **se guarda y no se cobra** |
| Impresoras (`printer`/`print_route`) | ✅ | **0 / 0** | — nunca configurado |
| Flags Glop (0128/0129) | ✅ | **0 en todos** | ❌ **write-only** |
| Escandallo (`recipe_item`) | ✅ | **0** | ❌ sin pantalla |
| Ingredientes y stock | ✅ | **0** en las 5 tablas | ❌ sin pantalla |
| Promociones, descuentos | ✅ | 0 | — |
| Productos asociados / añadidos que son artículos | ❌ **no existe** | — | — |

### Las tres mentiras que hay que matar

1. **Los flags de 0128/0129 no hacen nada.** `preguntar_precio`, `controla_stock`,
   `no_imprimir_si_cero`, `carta_digital`, `color`, `icono`… los escribe la ficha
   nueva y **no los lee nadie**. Una casilla que no hace nada es peor que no
   tenerla: el dueño la marca, se queda tranquilo, y el bar se comporta igual.
2. **Las tarifas se guardan y no se cobran.** `valorar_linea_pedido` (0053) valora
   **siempre** con `product.precio`. Hay 75 precios de tarifa guardados que no ha
   cobrado nadie nunca.
3. **La pestaña «Comentarios y extras» de la ficha nueva es de mentira.** Muestra
   datos demo y no guarda. Y el modelo bueno **ya existe y funciona en el Next**.

---

## 1 · Cómo se decide dónde sale un artículo impreso

Hoy, en tres saltos, y el artículo **nunca nombra una impresora**:

```
product.estacion  (o la de su categoría si está vacía)
      ↓
print_route (estacion + room_id de la mesa)  →  si no, (estacion + room_id NULL)
      ↓
printer  →  si no hay ruta, cae al ROL por defecto de la estación
```

Es un buen modelo — permite «la misma estación va a otra impresora según la
sala» sin tocar los artículos. **El problema es que `printer` y `print_route`
están a cero**: nadie ha dado de alta una impresora nunca, así que todo cae al
camino local.

**Decisión: NO se añade «impresora» al artículo.** Lo que falta es la pantalla de
impresoras y rutas, no una columna más en `product`. Un artículo que apunte a una
impresora concreta se rompe el día que cambian el aparato.

⚠️ Trampa ya corregida (20-07): había **dos listas de estaciones** distintas
—panel `COCINA/BARRA/CAMARERO/NINGUNA`, ficha nueva `BARRA/COCINA/PLANCHA`— y la
ficha convertía a `BARRA` lo que no conocía. Un `CAMARERO` se perdía al guardar,
sin error.

---

## 2 · Extras y comentarios: se heredan (y ya funciona)

Un artículo **no** define solo sus extras:

```
biblioteca de grupos ──asignación──> FAMILIA ──> CATEGORÍAS ──> ARTÍCULO
                                       (INCLUIR / EXCLUIR en cada nivel)
```

«Todas las hamburguesas llevan punto de la carne» se dice **una vez** en la
familia. El artículo puede además tener grupos propios, y puede **quitarse** uno
heredado que no le pegue (una exclusión a su nivel).

Dentro de un nivel, primero los EXCLUIR y luego los INCLUIR (INCLUIR gana). Un
nivel más concreto puede deshacer lo del de arriba.

Portado a `apps/tpv/.../modificadores.ts` con **11 tests** (y comprobado que los
tests cazan una inversión del orden). Es el mismo algoritmo que usa el TPV de
Next para vender: si divergieran, el camarero vería unos extras al vender y el
dueño otros al configurar.

---

## 3 · Menús: un menú NO es un artículo

`menu` → `menu_group` (los pasos) → `menu_choice` (las opciones, que sí son
`product`). El TPV lo inyecta como pseudo-producto y guarda `order_line` con
`product_id NULL`.

Por eso `product.es_menu_del_dia` **es un flag muerto**: marcar un artículo como
«menú del día» no crea ningún menú. O se conecta a `menu`, o se quita la casilla.

⚠️ **El pase de cocina se adivina con un regex del nombre del grupo**
(`"postre"`→4, `"bebid"`→5). Si el dueño llama a un paso «Para picar», ese paso
sale sin pase. Necesita `menu_group.orden_prep`, que está diseñado y no existe.

---

## 4 · Compras y stock: qué haría falta de verdad

Hay **cinco tablas vacías y sin ninguna pantalla**: `ingredient`, `recipe_item`,
`stock_move`, `warehouse`, `supplier`, `unit_of_measure`. No es un módulo a medias:
es un esqueleto.

Y falta la pieza central: **no hay documento de compra**. `stock_move` es un
apunte suelto (`ingredient_id, tipo, cantidad, motivo`) sin albarán, sin
proveedor, sin precio de compra y sin fecha de factura. Con eso no se puede
gestionar una compra: se puede anotar que entró algo.

### Lo que falta modelar

| Pieza | Por qué |
|---|---|
| `purchase_doc` (albarán/factura: proveedor, fecha, nº, estado, total) | Sin esto no hay «compras», hay apuntes |
| `purchase_line` (qué, cuánto, a qué precio, qué impuesto) | El **coste real**, que es lo que hoy se teclea a mano en `product_format.coste` |
| `stock_move.purchase_line_id` + `warehouse_id` | Trazar de dónde salió cada entrada |
| Stock **de artículo**, no solo de ingrediente | Una botella de vino se compra y se vende tal cual: obligar a inventarse un ingrediente por cada referencia es papeleo inútil |
| `supplier` ↔ artículo/ingrediente (referencia y precio del proveedor) | Para que al recibir un albarán el sistema sepa qué es cada línea |

⚠️ **La decisión de fondo, y no la tomo yo:** hoy el stock cuelga de
`ingredient`. Un bar real compra **las dos cosas**: cajas de cerveza (que se
venden tal cual) y kilos de tomate (que se transforman). El modelo honesto es que
una línea de compra pueda apuntar a **un artículo o a un ingrediente**, y que el
escandallo (`recipe_item`) solo haga falta para lo segundo. Eso son 3-4
migraciones y una pantalla nueva de verdad.

---

## 5 · Orden de trabajo

Por valor y por riesgo, no por lo vistoso.

**Fase A — que la ficha deje de mentir** *(en marcha)*
- [x] Resolutor de herencia de extras portado y probado.
- [ ] Pestaña «Comentarios y extras» contra datos reales, diciendo de dónde
      viene cada grupo (familia / categoría / propio) y dejando quitarse los
      heredados.
- [ ] Quitar o conectar los flags muertos. Los que no se puedan conectar ya,
      **fuera de la pantalla** hasta que hagan algo.

**Fase B — que las comandas salgan por donde toca**
- [ ] Pantalla de impresoras y rutas (`printer` / `print_route`): es lo que falta
      para que `estacion` sirva de algo.

**Fase C — precios de verdad**
- [ ] Decidir tarifas: o `valorar_linea_pedido` aplica `product_price`, o se
      quitan las columnas de salón/terraza de la ficha. Hoy es un campo que
      miente.

**Fase D — compras y stock** *(el módulo grande)*
- [ ] Modelo de compra (§4), pantalla de albaranes, y stock por artículo.
- [ ] Escandallo solo para lo que se transforma.

**Regla de las cuatro fases:** nada llega a la pantalla si no lo lee alguien al
vender, imprimir o cobrar. Si no, se añade a la lista de mentiras.

---

## 7 · Familias y Categorías — lo que aún NO tienen modelo

De la ficha de Ágora y del panel Next (inventario 20-07), lo que un TPV serio
configura de familia/categoría y que aquí **falta modelo o consumidor** (no se
mete a ciegas — es la skill `gluuh-pantalla-config`):

- **Jerarquía padre/subfamilia** (`family.familia_padre_id`, `category.categoria_padre_id`):
  columnas existen, **0 datos**, y la UI es un árbol (trabajo aparte). Pendiente.
- **Grupo mayor** (`family.grupo_mayor_id` + tabla `grupo_mayor`, 0 filas): para el
  desglose Bebida/Comida del ticket. Falta CRUD del grupo mayor primero.
- **Imágenes de familia/categoría** (`foto_url`, 0 datos las dos): subida como en
  el aspecto del artículo. Hoy el botón usa color/icono, que basta.
- **Horario de disponibilidad por categoría** (`category_horario`) y **visibilidad
  por centro** (`category_sales_center`): tablas + editor en Next YA existen, pero
  **0 filas** — funcionalidad sin estrenar. Portar cuando haga falta.
- **Etiquetas de categoría** (`tag`/`entity_tag`, `modelo-de-datos.md:461`): [NUEVO],
  sin construir.

✅ Lo que SÍ está en la pantalla nueva: nombre, color, orden (venta + factura en
familia), combinable, mostrar en venta/menús, texto de botón; y en categoría
además familia, **estación**, **icono** (que el Next NI edita — se rellenaba por
SQL) y nombre/descripción de carta QR.
