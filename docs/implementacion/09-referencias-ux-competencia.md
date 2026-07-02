# 09 — Referencias UX de la competencia (más allá de Glop)

Investigación web del 02-07-2026 con fuentes verificadas. Glop tiene documento
propio ([08-analisis-glop.md](08-analisis-glop.md)); aquí, lo que vale la pena
robar del resto. Cada sección: fuente → qué se ve → lección para Gluuh.

## 9.1 Revo XEF (revo.works — el TPV iPad "premium" español)

Fuentes oficiales verificadas: https://revo.works/en/revoxef ·
https://support.revo.works/es/articles/120 (método TPV) ·
https://support.revo.works/es/articles/191 (pantalla de productos) ·
https://support.revo.works/es/articles/193 (plano de mesas) ·
https://tickalo.com/software/revo/ (capturas de distribuidor).

- **Modos de trabajo por dispositivo**: Mesas / Barra-TPV / Take-away-Delivery /
  Noche — mismo motor, distinta pantalla de aterrizaje. En modo barra: cobrar
  cierra la comanda y abre una nueva sola; salir sin cobrar la **auto-aparca** en
  una "mesa virtual" (mejor que un diálogo de confirmación).
  → Gluuh: el modo se define por dispositivo (con la identidad de la guía 04), y
  el auto-aparcado al salir con líneas es más seguro que nuestro auto-marchar.
- **"Top ítems"**: pestaña automática con los 16 más vendidos (sustituible por
  favoritos manuales). El 80% del servicio son 20 productos: que se pongan delante
  solos. → Categoría virtual "Más vendidos" calculada de `order_line` — barata.
- **Gestos**: long-press sobre producto = teclear cantidad; dos dedos = previsualizar.
- **El plano como dashboard**: cada mesa muestra foto del camarero que la lleva,
  círculo de comensales que cambia de color por estado, **gorro de chef cuando el
  KDS marca platos listos**, icono de tarifa especial. Swipe-down sobre mesa =
  acciones rápidas; swipe horizontal = cambiar de sala.
  → Nuestro plano ya pinta estado+saldo; añadir "platos listos" (dato ya existente
  en `estado_preparacion`) y el camarero de la cuenta es diferencial real.
- **Modificadores con mín/máx** ("elige 1 punto de carne, hasta 3 extras"): valida
  la comanda al tomarla, no en cocina. → Para nuestra fase de modificadores.
- **Tarifa vinculada a zona del plano** (terraza ≠ barra): patrón español clásico;
  encaja con nuestro suelo por zonas y con P1-3 (tarifas).

## 9.2 SumUp POS Pro / Tiller (el TPV "para no técnicos")

Fuentes verificadas: https://www.tillersystems.com/es/blog/la-version-3-ya-esta-disponible/ ·
https://www.sumup.com/es-es/resumen-punto-de-venta/tpv-pro/ ·
https://apps.apple.com/es/app/sumup-tpv-pro/id1244086538. Catálogo por IA:
https://help.sumup.com/es-ES/articles/1ZHM8V5zKlAdEriUqiXwHu-catalogo-de-productos
(SPA, contenido según buscador).

- **Categorías en columna vertical izquierda** (rediseño v3): maximiza la rejilla
  de productos en pantallas apaisadas. **Color de botón elegido por el negocio**:
  el camarero memoriza posición+color, no texto.
  → Ya tenemos color por familia; exponer color por producto es una columna.
- **Plano con temporizador**: tiempo desde la última interacción pintado en la
  mesa; progreso de cocina en el borde; rosa = reserva, verde = ticket impreso.
  → "Tiempo sin atender" > estado binario ocupada/libre. Dato ya disponible
  (`updated_at` del pedido).
- **Edición de carta en caliente desde cualquier dispositivo** (móvil incluido):
  ya lo cumplimos con el backoffice web + Realtime — convertirlo en argumento de
  venta explícito.
- **Onboarding por IA**: "fotografía tu carta y la IA crea el catálogo". La
  barrera nº1 de adopción de un TPV es teclear 200 productos.
  → Muy replicable (visión LLM → filas en `product`); candidata a feature estrella
  de captación. Anotada como idea P2, encaja con el panel asistente ya existente.
- **Pantalla de cliente de serie** (8" orientada al cliente en su hardware):
  refuerza nuestra decisión del visor en 2º monitor (guía 03 pieza 5) — con el QR
  VERIFACTU como contenido natural.

## 9.3 Lightspeed Restaurant K-Series (el estándar internacional de servicio en mesa)

Fuentes oficiales verificadas:
https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050328394 (pantalla de venta) ·
https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050328554 (edición de líneas) ·
https://k-series-support.lightspeedhq.com/hc/en-us/articles/43162671781659 (navegación 2025) ·
review con capturas: https://www.mobiletransaction.org/lightspeed-restaurant-pos-review/

- **Ticket agrupado por asiento y curso/pase** (quién come qué, en qué pase): el
  estándar del servicio con mesas. → Nuestra fase de "pases" de cocina (los
  `prep_course` del modelo objetivo).
- **Teclado numérico colapsable**: presente para cantidad/pago, oculto cuando
  estorba (en edición se pliega solo). → Aplicable a nuestra vista móvil del TPV.
- **Doble toque en línea = +1 unidad**: el atajo más usado en barra. Trivial.
- **"Remove" ≠ "Void"**: borrar antes de enviar a cocina es libre; anular después
  exige **motivo obligatorio** y queda en informes. Casa perfecto con la
  trazabilidad VERIFACTU y con nuestra tabla `cancel_reason` (ya existe, stub).
- **Quickpay**: un toque para el pago más común. Equivale a nuestro F12.
- **Navegación que desaparece durante la comanda** (rediseño 2025): cromo mínimo;
  barra arriba en tablet, abajo en móvil (uso a una mano).
- **Sus carencias (de las reviews)**: sin imágenes en botones de producto, sin
  tipografía escalable, creación de artículos solo en Back Office con ficha de 6
  pestañas. → Exactamente lo que nuestras guías 05 §5.9 y 07 resuelven.

## 9.4 Ágora (nuestro referente funcional): la fricción medida

Fuentes oficiales verificadas (manual online):
https://www.agorapos.com/manual/agora-restaurant/html/navigation.html (índice) ·
…/html/TPV.html (pantalla de venta, captura `img/pos_sale.png`) ·
…/html/WA_Administracion_Productos.html (alta de producto, captura
`img/WA_Products_Edit.png`, 1453×3412 px — más de dos pantallas de alto) ·
…/html/WA_Administracion_Familias.html · …/html/WA_Administracion_Tarifas.html ·
…/html/WA_Herramientas_ConfiguracionDeBotones.html · PDF completo (24,6 MB):
https://www.agorapos.com/manual/agora-restaurant/manual-agora-restaurant.pdf

**Su pantalla de venta** (captura oficial examinada): 3 columnas — ticket a la
izquierda (con modificadores "con Bacon", notas "Muy hecho", descuento %/€),
~11 botones de operación en el centro (Cobrar en Efectivo, Pagos, Imprimir,
Preparar, Marchar, Abrir cajón, Mover/Dividir Ticket, Tickets en Mesa…), catálogo
a la derecha con dos filas de familias que incluyen pestañas **"Más Vendidos"** y
"Todas Bebidas". Cabecera con fecha de negocio, mesa, cliente, nº asiento,
comensales y orden de preparación. ~25 acciones visibles a la vez.
→ Mismo layout canónico que Glop y que el nuestro; el "Más Vendidos" coincide con
el Top ítems de Revo (§9.1) — tercera confirmación de esa pestaña automática.

**El alta de producto, medida con su propio manual** (la queja que motiva nuestra
guía 07):
1. Abrir la **Administración Web** — aplicación separada del TPV.
2. Formulario "Editar Producto": **una sola página con ~10 secciones y 30+ campos
   visibles** (datos, estilo del botón, estilos de impresión, tallas, categorías,
   añadidos, códigos de barras, trazabilidad/almacén, matriz de precios, y 4
   acordeones más). Sin alta simplificada.
3. La **familia** se crea en otra pantalla (con su propio estilo de botón).
4. Los **precios** son una matriz centro de venta × tarifa (Barra 2,50 € /
   Terraza 3,00 € / Salón 3,00 €), **con impuesto por tarifa** — N celdas por
   producto.
5. La **botonera del TPV** se configura en una cuarta pantalla (Herramientas →
   Configuración de Botones), separada del producto.

**Conclusión medible**: dar de alta una Coca-Cola vendible con botón = **3-4
pantallas de backoffice y decenas de campos**. Glop es análogo (2 entidades,
~8 pestañas — doc 08 §8.4). Nuestra guía 07 lo deja en **1 modal de 3 campos desde
el propio TPV**, con el IVA resuelto por territorio (sin matriz de impuestos) —
este es el argumento demostrable en una demo comercial.

**Otras lecciones de Ágora**: el aspecto de un botón se configura en 3 sitios
distintos (producto, familia, layout) — en Gluuh debe ser uno; y su modelo
precio×tarifa×centro×impuesto es la complejidad que nuestro "precio con impuesto
incluido resuelto por clase fiscal × territorio" elimina de raíz.

## 9.5 Square y Toast (los americanos: velocidad y edición in situ)

Fuentes oficiales verificadas — Square:
https://squareup.com/help/us/en/article/8335-create-and-edit-items ·
https://squareup.com/help/us/en/article/8334-set-up-item-grid ·
https://squareup.com/help/us/en/article/5429-process-custom-sale-amounts ·
https://squareup.com/help/us/en/article/7804-organize-your-menu-with-square-for-restaurants.
Toast: https://support.toasttab.com/article/86-an-Item ·
https://support.toasttab.com/en/article/Quick-Edit-Mode-1492794309057 ·
https://doc.toasttab.com/doc/platformguide/adminInventoryUpdateQuickEdit.html.

**Square — alta de artículo en el punto de venta:**
- Ni Square documenta crear un artículo desde el ticket en mitad de la venta — el
  hueco que nuestra guía 07 cubre existe también frente a los americanos.
- Lo más cercano: **long-press sobre un hueco vacío de la rejilla → "+" → Create a
  new item**. El artículo aterriza donde el usuario pulsó (memoria espacial) y se
  sincroniza a todos los terminales. El formulario empieza por el **azulejo**
  (color + etiqueta + imagen), luego nombre y precio; la ficha completa va al
  Dashboard. → Confirma el diseño de 3 campos de la guía 07 §7.1.
- **Precio en blanco = precio variable**: al vender salta el teclado y se teclea el
  precio en el momento. → Adoptado como opción en la guía 07 §7.1.
- **"Custom Amount"**: importe libre con impuesto asignable en 2 toques — la venta
  jamás se bloquea porque falte una ficha. Equivale a nuestra "venta libre" (§7.5).
- **Editar la rejilla exige reautenticación real** (el passcode de empleado no
  basta) — misma frontera de permisos que nuestro PIN de encargado.
- **Grupo visual ≠ categoría de informes ≠ ruta de impresión**: tres conceptos
  desacoplados en Square for Restaurants. A recordar cuando llegue la
  configuración de botonera.

**Toast — 86 y Quick Edit (el patrón long-press llevado al extremo):**
- **Un solo gesto para todo**: long-press sobre el botón del producto → Quick Edit.
  Desde ahí: agotar (86), cambiar precio, nombre, color del botón, añadir/quitar/
  reordenar artículos y fijar stock. ~5 toques para agotar un plato.
- Frontera nítida: el terminal edita **las hojas del árbol** (artículos,
  precios, colores); la **estructura** (menús, grupos, modificadores) solo en el
  backoffice. → Exactamente la frontera de nuestra guía 07 §7.6.
- Tres estados de stock: disponible / **cantidad restante** (el número se muestra
  en el propio botón, descuenta **al enviar a cocina** y auto-agota al llegar a 0)
  / agotado (botón gris con "0", no oculto — también en carta online).
- **La disponibilidad se aplica al instante, sin "publicar"**; los cambios de
  estructura sí requieren publish. Dos velocidades deliberadas.
- Su bug célebre (artículos duplicados entre cartas no se agotan a la vez) enseña:
  el stock cuelga del **producto**, nunca del botón — nuestra columna
  `product.agotado_hasta` ya lo cumple.

## 9.6 UX táctil: cifras verificadas para nuestro TPV

Fuentes: Apple (https://developer.apple.com/design/tips/), Google
(https://support.google.com/accessibility/android/answer/7101858), WCAG 2.2
(https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), NN/g
(https://www.nngroup.com/articles/touch-target-size/ y
https://www.nngroup.com/articles/response-times-3-important-limits/), Hoober
(https://www.uxmatters.com/mt/archives/2013/03/common-misconceptions-about-touch.php).

- **Tamaños**: mínimo Apple 44×44 pt / Google 48×48 dp + 8 dp de separación / NN/g
  1×1 cm físico. Para acciones primarias del TPV (Cobrar, Enviar a cocina): ~2×2 cm.
  Razonar en **milímetros del monitor real** del bar, no en px lógicos.
- **La precisión no es uniforme**: centro de pantalla ~7 mm basta; bordes superior
  e inferior necesitan 11-12 mm → carta en el centro, barra de estado y barras de
  acción con botones más altos.
- **Separación entre acciones opuestas** (añadir vs anular línea): 8-10 mm entre
  centros como mínimo.
- **Latencia**: < 100 ms por toque para sensación de instantaneidad (Nielsen). El
  render del ticket es siempre optimista y local; Supabase, la huella VERIFACTU y
  la red **nunca** en el camino del toque. El envío AEAT, siempre asíncrono.
- **El dedo tapa el botón que pulsa**: el feedback va fuera del punto de contacto —
  resaltar la línea recién añadida en el ticket (ya lo hacemos con la selección).

## 9.7 Top lecciones aplicables (síntesis)

1. Layout validado por todos: rejilla central + ticket lateral + categorías
   verticales + teclado colapsable.
2. Modos de trabajo por dispositivo (barra/sala/llevar), no por navegación.
3. El plano de mesas es el dashboard del servicio: camarero, comensales, tiempo
   sin atender, platos listos.
4. Velocidad = memoria muscular: color+posición fijos, top ítems automáticos,
   doble-tap +1, long-press cantidad.
5. Borrar-antes ≠ anular-después (motivo obligatorio, auditable).
6. Nadie resuelve bien el "producto rápido desde el TPV" — ni Square ni Lightspeed
   lo documentan; es nuestro hueco competitivo (guía 07).
7. Long-press como puerta única de edición in situ (Toast): agotar, precio, color —
   con permiso de encargado; la estructura de carta, solo en backoffice.
8. Disponibilidad instantánea sin "publicar"; la venta nunca se bloquea (importe
   libre siempre disponible; precio en blanco = variable).
9. Tamaños y latencia con cifras (sección 9.6): botones ≥1 cm, primarios ~2 cm,
   toque pintado en <100 ms con UI optimista.
10. Diferenciadores baratos: modo zurdo (ticket a izquierda o derecha), navegación
    oculta en comanda, pantalla de cliente con QR fiscal.
