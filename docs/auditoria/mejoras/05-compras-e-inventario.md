# 05 — Compras e Inventario: cómo Gluuh mejora a Ágora

> Documento de **mejoras consolidadas** del módulo de aprovisionamiento e inventario de Gluuh
> frente a Ágora. Destila las fichas de la auditoría
> ([proveedores](../09-referencia-configurador-agora/compras-stocks/proveedores.md),
> [almacenes](../09-referencia-configurador-agora/compras-stocks/almacenes.md),
> [documentos de compra](../09-referencia-configurador-agora/compras-stocks/documentos-compra.md),
> [unidades de medida](../09-referencia-configurador-agora/compras-stocks/unidades-medida.md),
> [inventario](../09-referencia-configurador-agora/compras-stocks/inventario.md),
> [app de almacén](../09-referencia-configurador-agora/compras-stocks/app-almacen.md),
> [exportar productos](../09-referencia-configurador-agora/herramientas/exportar-productos.md))
> y el modelo de datos de [06 — Compras, proveedores e inventario](../06-compras-proveedores-e-inventario/README.md).

**Nuestra filosofía.** Dos niveles, como en el resto del producto:

1. **Backoffice estilo Supabase/Notion** — el sitio donde el gestor *configura y analiza*:
   proveedores, escandallos, precios, informes. Limpio, ordenado, todo **configurable por tenant**.
2. **App de almacén táctil y offline-first** — el sitio donde el operario *trabaja*: recibir,
   contar, mermar y traspasar con botones grandes, escáner y sin depender de internet.

Ágora ya cubre la mecánica (multi-almacén, PMP, pedido→albarán→factura, app de almacén LAN).
Donde ganamos es en **intuición, automatización y datos accionables**: que el sistema *proponga*
en vez de obligar a recordar, que cada número explique *para qué sirve*, y que todo se sincronice
sin fricción entre la barra, la cocina y la oficina.

> **Cómo leer cada bloque:** *Para qué sirve · Cómo Ágora · Cómo lo mejoramos · Prioridad.*

---

## 1. Precio y referencia por producto-proveedor con histórico y comparación

**Para qué sirve.** Un mismo artículo (p. ej. aceite de oliva) lo sirven varios proveedores a
distinto precio, con distinta referencia y distinta unidad de compra. Saber *quién es el más
barato hoy* y *cómo ha evolucionado el coste* es la base para negociar y para que el escandallo
valore bien.

**Cómo Ágora.** La ficha de proveedor recoge datos fiscales, contacto y operativa, y liga con
*Proveedores Habituales* del producto, pero la comparativa de precios y el histórico no son un
foco del configurador: el precio se gestiona producto a producto sin una vista de evolución.

**Cómo lo mejoramos.**
- Tabla `supplier_product` con **referencia del proveedor, unidad de compra y factor a unidad
  base**, y un flag `preferente` (proveedor por defecto del artículo).
- **Histórico inmutable** (`supplier_price_history`): un precio nunca se sobrescribe; se cierra
  el anterior (`valid_to`) y se abre el nuevo. Permite valorar compras antiguas y **graficar la
  evolución del coste**.
- Informe **comparativa de precios** (min/avg por artículo entre proveedores) directamente en el
  backoffice, para decidir a quién pedir.
- **Import del catálogo del proveedor por CSV/plantilla** para no teclear cientos de referencias.

**Prioridad: 🔴 Alta** — es el cimiento de la comparativa y del coste real.

---

## 2. Pedido mínimo, días de reparto y propuesta de reposición automática

**Para qué sirve.** Cada proveedor reparte ciertos días y exige un pedido mínimo. El gestor no
debería recordar de memoria qué falta ni cuándo puede pedirlo: el sistema debe **proponer el
pedido** cuando el stock baja, agrupado por proveedor y respetando sus condiciones.

**Cómo Ágora.** Existe el botón **Propuesta Reposición** en el pedido a proveedor (genera líneas
por bajo stock) y un proveedor de reposición por defecto en el almacén. Es un buen punto de
partida, pero las condiciones del proveedor (días de reparto, hora de corte, pedido mínimo) no
están integradas en la propuesta.

**Cómo lo mejoramos.**
- Campos en la ficha de proveedor: **días de reparto** (máscara `LMXJVSD`), **hora de corte de
  pedido**, **pedido mínimo (€)**, condiciones y forma de pago, IBAN, territorio fiscal.
- **Propuesta de reposición automática**: cuando `qty_on_hand ≤ min_qty`, se genera una propuesta
  al **proveedor preferente** con la cantidad que falta hasta `max_qty`, **agrupada por
  proveedor**, y con **aviso si no se alcanza el pedido mínimo**.
- Aviso del próximo día de reparto disponible según la máscara y la hora de corte.

**Prioridad: 🔴 Alta** — convierte el inventario en un sistema que avisa, no que se consulta.

---

## 3. Recepción parcial clara: servida vs pedida

**Para qué sirve.** Lo que llega casi nunca coincide con lo pedido (faltas, roturas, excesos).
Hace falta ver de un vistazo **qué queda pendiente** para reclamar y para cerrar el pedido bien.

**Cómo Ágora.** El pedido tiene columna **Servida** (cuánto se ha recibido ya) y el albarán
enlaza con **Doc. Pedido**; el botón **Pte. Recibir** trae las líneas pendientes. La mecánica
existe, pero la lectura de discrepancias depende de comparar a ojo.

**Cómo lo mejoramos.**
- Estados de pedido explícitos: `borrador → enviado → parcial → recibido → cerrado / cancelado`.
- En la recepción, el sistema marca por línea **`pedida − recibida`** (faltas/parciales) y los
  **excesos (> pedida)**, dejando la diferencia **visible para reclamar** al proveedor.
- **Lote y caducidad opcionales** por línea de recepción (base de trazabilidad y de alertas de
  caducidad).
- Al confirmar la recepción: movimientos `IN` (compra→base) y **recálculo de PMP** en una sola
  operación auditable.

**Prioridad: 🟡 Media-alta** — evita pérdidas silenciosas por mercancía no servida.

---

## 4. Conciliación factura ↔ albaranes y OCR/import de factura

**Para qué sirve.** El proveedor suele facturar una vez al mes agrupando todos los albaranes.
Hay que **casar la factura con sus recepciones**, detectar que precios y cantidades cuadran, y
no teclear la factura a mano.

**Cómo Ágora.** La factura de proveedor **agrupa N albaranes** (tabla de albaranes en el editor,
añadir/quitar) y rastrea **Pendiente** para el pago. Funciona, pero la conciliación es manual y
no hay captura automática del documento.

**Cómo lo mejoramos.**
- Relación N:M factura↔albaranes (`purchase_invoice_receipt`) con **validación de que importes y
  cantidades cuadran**, y **aviso de discrepancias** de precio/cantidad respecto a los albaranes.
- **OCR / import de factura** (PDF / e-factura / Facturae) para alta semiautomática: el sistema
  pre-rellena líneas y el gestor solo confirma.
- Desglose de **base + cuota soportada por tipo** (IVA 21/10/4 % o **IGIC 7/3/0 %** según el
  territorio del proveedor) → alimenta el **IVA/IGIC soportado deducible** del resumen fiscal.
- **Vencimientos** según condiciones de pago y enlace a conciliación bancaria (campo Pendiente).
- Aviso al crear un documento con un **nº de factura de proveedor ya existente** (evita duplicar).

**Prioridad: 🟡 Media** (la conciliación) · **🟢 Baja-diferida** (el OCR, valor alto pero no bloqueante).

---

## 5. Unidades de medida y conversión compra ↔ stock ↔ uso

**Para qué sirve.** Se **compra** en una unidad (caja, garrafa, barril), se **almacena/valora**
en otra (g, ml, ud) y se **usa en receta** en una tercera. Sin conversión fiable, se mezclan
"cajas" con "gramos" y el coste se descuadra.

**Cómo Ágora.** Modelo de unidad base + sub-unidades con **factor de conversión** (1 botella =
70 cl, 1 barril = N litros). Correcto, pero se parte de cero al configurar.

**Cómo lo mejoramos.**
- **Unidades estándar precargadas** (g, kg, ml, cl, l, unidad, docena) con sus factores SI — no
  empezar de cero.
- **Regla de oro:** el stock siempre se mueve en **unidad base**; comprar convierte compra→base,
  vender por receta convierte uso→base.
- **Merma de conversión** (`waste_pct`): un barril rinde menos por espuma, un solomillo entero
  rinde ~80 % útil. Factor efectivo configurable que encarece el coste por unidad *usada*.
- **Validación**: avisar si un factor es 0, negativo o incoherente.

**Prioridad: 🔴 Alta** — sin esto, ni el stock ni el escandallo son fiables.

---

## 6. Escandallo ligado a fabricación (coste automático)

**Para qué sirve.** El escandallo (receta de coste) une producto ↔ ingredientes. Cuando se
**fabrica** (una salsa madre, prep de obrador, un batch de pan), el producto resultante debe
heredar su coste de la suma de ingredientes, **sin recalcular a mano**.

**Cómo Ágora.** Las **Fabricaciones** consumen ingredientes y dan de alta el producto a su
*coste de fabricación*, con botón **Actualizar Pr. Coste**. La actualización es una acción manual
y la fabricación no está atada en vivo al escandallo.

**Cómo lo mejoramos.**
- **Fabricación ligada al escandallo**: el coste del producto fabricado se actualiza **solo** al
  cambiar los ingredientes o su PMP — no hace falta pulsar "actualizar".
- Food cost en vivo en el editor de escandallo: `coste_receta`, `food_cost_%`, `margen_%` y
  **precio sugerido** para un food cost objetivo, con el impuesto resuelto por **clase fiscal ×
  territorio** (IVA o IGIC) vía `@gluuh/core` `ivaAuto`.
- **Descuento automático de stock al cobrar** (no al pedir): cada `recipe_line` genera un
  `OUT_SALE` convertido a unidad base; idempotente por `sale_line_id` (la anulación inserta el
  inverso, no borra).

**Prioridad: 🔴 Alta** — el escandallo automático es lo que cierra el círculo coste ↔ carta.

---

## 7. Valoración PMP visible (valor de inventario)

**Para qué sirve.** Saber **cuánto vale el inventario** a fecha (para balance y para comparar
periodos) y tener un **coste estable** para el escandallo, sin trazar capas FIFO por lote.

**Cómo Ágora.** Valoración por **PMP (Precio Medio Ponderado)** configurable por evento (al
comprar / traspasar / fabricar) y **Cierres de Almacén** que congelan la valoración a fecha.
Sólido; lo que falta es exponerlo como dato accionable.

**Cómo lo mejoramos.**
- **PMP recalculado en cada entrada** con la fórmula de coste medio móvil; las salidas valoran al
  PMP vigente y no lo modifican (decisión documentada: PMP, no FIFO, por alta rotación y mezcla
  física de lotes).
- **Valor de stock visible** en informes: `Σ qty_on_hand × avg_cost` por almacén, foto a cierre.
- **Cierre de almacén automático mensual** + informe de variación de valor y de mermas entre
  periodos.
- Informes derivados: **rotación** (inmovilizado/caducidades) y **consumo teórico vs real**
  (detección de merma oculta o robo).

**Prioridad: 🟡 Media** — el PMP ya existe; el valor es ganar visibilidad e informes.

---

## 8. Recuento por móvil / escáner y ciego

**Para qué sirve.** Inventariar contando *físicamente* con el lector, no a mano. Y **a ciegas**
(sin ver el teórico) para que el conteo sea honesto y detecte descuadres reales.

**Cómo Ágora.** **Variaciones de Stock** cubren ajuste / traspaso / **inventario (recuento)**, y
la **exportación de productos** permite contar con una herramienta externa y reimportar. El
recuento nativo móvil/ciego no es el foco.

**Cómo lo mejoramos.**
- **Recuento con escáner** (lector o cámara): contar leyendo el código, no tecleando.
- **Recuento ciego**: el operario no ve el teórico; el sistema calcula la **desviación**
  (teórico − real) y la **valora a PMP** (€ de descuadre) al cerrar.
- Recuento **por ubicaciones** dentro del almacén, con conciliación al cerrar.
- Al cerrar, movimientos `ADJUST` que dejan teórico = real, **auditables** (quién, cuándo).
- **Alertas de descuadre** y de caducidad; trazabilidad de lote.

**Prioridad: 🟡 Media-alta** — el recuento fiable es lo que da credibilidad a todo el inventario.

---

## 9. Alertas de stock mínimo en el TPV

**Para qué sirve.** Que la barra/cocina vea que **se está agotando** un artículo *en el momento
de vender*, no al día siguiente en la oficina.

**Cómo Ágora.** El aviso de stock existe a nivel de local, pero la integración con la venta en
el TPV no es directa.

**Cómo lo mejoramos.**
- `min_qty` (y opcional `max_qty`) por **artículo × almacén**.
- **Aviso en el TPV** cuando un producto cae por debajo del mínimo (resaltado en carta o aviso al
  cobrar), enlazado con la **propuesta de pedido** del §2.
- Misma señal alimenta la **propuesta de reposición** del backoffice — una sola fuente de verdad.

**Prioridad: 🟡 Media** — alto valor operativo, depende de tener stock mínimo configurado.

---

## 10. App de almacén táctil con escaneo por cámara (offline-first)

**Para qué sirve.** Que el personal de almacén **reciba, cuente, merme y traspase** desde una
tablet con botones grandes, **sin entrar al configurador** y **sin depender de internet**.

**Cómo Ágora.** App de almacén LAN (`warehouse/app`) con 5 acciones táctiles: **Pedidos,
Albaranes, Mermas, Inventarios, Traspasos**. Valida el patrón "app de operación" separada del
configurador, igual que el TPV frente al backoffice.

**Cómo lo mejoramos.**
- **Escaneo de código de barras con la cámara** (PWA) para recibir y contar más rápido, sin
  lector dedicado.
- **Offline-first real**: contar y recibir sin internet; sincroniza al reconectar vía PowerSync
  (mismo patrón de la plataforma).
- **Una sola base de código** con el resto de apps táctiles (TPV / comandera / KDS), envuelta en
  modo kiosco a pantalla completa; comparte modelo (`@gluuh/core` / Supabase) reusando
  `stock_movement`, `goods_receipt`, `stock_variation`.
- Recuento ciego y por ubicaciones también desde la app.

**Prioridad: 🟡 Media** — gran ergonomía operativa; se apoya en el resto del módulo ya construido.

---

## 11. Merma con flujo propio

**Para qué sirve.** La merma (rotura, caducidad, desperdicio, invitación marcada) **no es coste
de venta, es pérdida**, y debe registrarse con su propio motivo para analizarla aparte.

**Cómo Ágora.** El **Ajuste de Stock** con **motivo** enlaza con *Generar merma*; la app de
almacén tiene un botón **Mermas** dedicado. Existe, pero conceptualmente va mezclado con el ajuste.

**Cómo lo mejoramos.**
- Tipo de movimiento `WASTE` **separado** de `OUT_SALE` y de `ADJUST`, con **motivo** propio
  (rotura, caducidad, invitación, prep fallida).
- **Mermas e invitaciones del TPV** generan `WASTE` automáticamente (no contaminan el coste de
  venta), enlazadas con los motivos de cancelación.
- Informe de mermas por periodo, motivo y artículo; cruce con consumo teórico vs real.

**Prioridad: 🟢 Baja-media** — depende del modelo de movimientos; aporta análisis de pérdidas.

---

## 12. Import / Export con plantilla validada

**Para qué sirve.** Mover catálogo e inventario a/desde Excel/CSV (o una hoja para contar) **sin
romper datos** al reimportar, y agilizar altas masivas.

**Cómo Ágora.** **Exportar Productos** filtrable por almacén/familia/categoría a Excel/CSV para
capturar con apps externas y reimportar. Útil, pero sin validación de plantilla.

**Cómo lo mejoramos.**
- **Plantilla validada** (cabeceras fijas, tipos comprobados) que **rechaza filas inválidas** con
  mensaje claro antes de importar.
- **Export server-side** (endpoint en `apps/api` que serializa `product` / `stock_item`): no
  cargar 20k filas en el navegador.
- Export también a **Google Sheets** y formato compatible con el **conteo móvil**.

**Prioridad: 🟢 Baja** — la app de almacén nativa cubre el recuento; el import/export es comodidad.

---

## Tabla resumen

| # | Mejora | Para qué sirve (1 línea) | Cómo lo mejoramos (clave) | Prioridad |
|---|--------|--------------------------|---------------------------|-----------|
| 1 | Precio/referencia por producto-proveedor | Comparar y elegir el más barato | Histórico inmutable + comparativa + import catálogo | 🔴 Alta |
| 2 | Pedido mínimo, reparto, reposición auto | El sistema propone qué pedir | Propuesta por bajo stock, agrupada por proveedor, respeta mínimo/reparto | 🔴 Alta |
| 3 | Recepción parcial (servida vs pedida) | Ver y reclamar lo pendiente | Estados claros + faltas/excesos visibles + lote/caducidad | 🟡 Media-alta |
| 4 | Conciliación factura↔albaranes + OCR | Casar factura mensual sin teclear | N:M validado + OCR/Facturae + IVA/IGIC soportado | 🟡 Media / 🟢 Baja (OCR) |
| 5 | Unidades y conversión compra↔stock↔uso | No mezclar cajas con gramos | Unidades SI precargadas + merma de conversión + validación | 🔴 Alta |
| 6 | Escandallo ligado a fabricación | Coste de producto fabricado automático | Coste auto al cambiar ingredientes + food cost en vivo + descuento al cobrar | 🔴 Alta |
| 7 | Valoración PMP visible | Saber cuánto vale el inventario | PMP móvil + valor de stock en informes + cierre mensual auto | 🟡 Media |
| 8 | Recuento por móvil/escáner y ciego | Inventarios fiables | Escaneo + ciego + desviación valorada a PMP + auditable | 🟡 Media-alta |
| 9 | Alertas de stock mínimo en TPV | Avisar al vender, no al día siguiente | min/max por artículo×almacén + aviso TPV → propuesta pedido | 🟡 Media |
| 10 | App almacén táctil + escáner cámara | Operar sin entrar al configurador | PWA offline-first, cámara, base de código única | 🟡 Media |
| 11 | Merma con flujo propio | Distinguir pérdida de coste de venta | `WASTE` separado, motivo propio, mermas del TPV automáticas | 🟢 Baja-media |
| 12 | Import/Export con plantilla validada | Mover datos sin romperlos | Plantilla validada + export server-side + Google Sheets | 🟢 Baja |

---

> **Hilo conductor.** Todo se apoya en un **libro mayor inmutable** (`stock_movement`) y un
> **PMP** vivo: la receta *define* el consumo, el stock lo *ejecuta y valora*, y el food cost
> cierra el círculo entre compra y precio de carta. El backoffice analiza; la app de almacén
> opera; el TPV avisa — y todo sincroniza por PowerSync. La diferencia con Ágora no es la
> mecánica, sino que **el sistema propone, explica y avisa** en lugar de esperar a que el gestor
> recuerde. Modelo de datos completo en
> [06 — Compras, proveedores e inventario](../06-compras-proveedores-e-inventario/README.md).
