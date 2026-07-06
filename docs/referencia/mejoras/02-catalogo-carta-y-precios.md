# 02 — Catálogo, Carta y Precios: cómo Gluuh mejora a Ágora

> **Propósito.** Consolidar las mejoras de **catálogo, carta y precios** de Gluuh frente a Ágora,
> destiladas de las fichas del [configurador de Ágora](../09-referencia-configurador-agora/).
> Para cada bloque: **para qué sirve · cómo lo hace Ágora · cómo lo mejoramos · prioridad**.
>
> **Nuestro estilo.** El **backoffice de configuración** sigue el lenguaje Supabase/Notion
> (verde `#34B27B`, modo oscuro, shadcn): denso pero ordenado, todo buscable, todo configurable.
> La **operativa** (TPV, KDS, kiosko, carta QR) va **colorida y con la marca del cliente**.
> El objetivo declarado: **más intuitivo que Ágora**, sin "familias ocultas" ni campos crípticos.
>
> **Regla fiscal transversal.** Los precios de carta llevan **impuesto INCLUIDO**; el desglose
> (base + cuota) lo hace **siempre** `@gluuh/core` (`calcularImpuestosIncluidos`, `ivaAuto`),
> resolviendo IVA/IGIC/IPSI por **clase fiscal × territorio**. Nunca se duplica esa lógica.

---

## 1. Modificadores / añadidos reutilizables ★

**Para qué sirve.** Vender un producto base y dejar que el cliente lo personalice con extras
que **suman precio** y van a cocina: "Pizza Margarita **+ extra de queso (1,50 €)**", "sin cebolla",
"punto de la carne", "tamaño de café". Es el corazón de la carta de hostelería.

**Cómo lo hace Ágora.** Modela los extras como **familias ocultas** (`AÑADIDOS`,
`AÑADIDOS CARAJILLO`) marcadas como *No mostrar en TPV / No mostrar en menús*. Cada producto
que necesita un añadido lo arrastra desde esa familia; el modelo es indirecto y se recrea
producto a producto. ([clasificacion.md §3](../09-referencia-configurador-agora/productos/clasificacion.md),
[producto.md §5](../09-referencia-configurador-agora/productos/producto.md))

**Cómo lo mejoramos.** **Grupos de modificadores de primera clase**, reutilizables y compartidos
por muchos productos:

- Un **añadido es un producto** con `vende_anadido = true` y un **`precio_anadido`** propio
  (distinto del precio como principal). El "extra de queso" cuesta 1,50 € como añadido aunque
  como producto suelto valga otra cosa.
- Se agrupa en un **grupo de modificadores** con reglas **mín/máx** (`Extras` 0..n;
  `Punto de la carne` 1..1). El mismo grupo "Extras pizza" se enchufa a todas las pizzas.
- Al vender, el flag **Solicitar automáticamente añadidos** abre el grupo; elegir queso
  **suma su `precio_anadido`** y **hereda la clase fiscal** del producto base (con aviso si
  difiere). "Sin cebolla" sale por **Solicitar automáticamente notas de preparación**.
- Toda la suma de precios pasa por `@gluuh/core` → el desglose IVA/IGIC y el VERIFACTU cuadran.

> **Ejemplo Pizza Margarita.** Producto `Pizza Margarita` (precio carta 9,00 € impuesto incl.) →
> grupo de modificadores `Extras` (mín 0 / máx n) que incluye `Extra queso` (`precio_anadido` 1,50 €).
> Vender la pizza abre el grupo; al marcar queso el ticket muestra 10,50 € y `@gluuh/core`
> reparte base + cuota de los 10,50 €.

**Prioridad: 🔴 ALTA.** Sin esto no hay carta de hostelería real.

---

## 2. Nombres múltiples por producto (carta · botón · ticket · cocina · etiqueta) ★

**Para qué sirve.** Cada destino necesita **su propio texto**: en la carta "Café solo de la casa",
en el botón táctil "SOLO" (cabe poco), en el ticket del cliente el nombre formal, en la comanda
de cocina lo que entiende el cocinero, y hasta 5 textos para etiquetas EPL.

**Cómo lo hace Ágora.** Lo tiene, pero repartido y poco evidente: campo **Nombre** (carta),
**Texto** del botón en la pestaña Estilo, **Texto para documento** (ticket) y **Texto para comanda**
en Estilo de impresión, más **Texto 1–5 para Etiqueta**. Cinco campos en tres pestañas distintas.
([producto.md §2–3](../09-referencia-configurador-agora/productos/producto.md))

**Cómo lo mejoramos.**

- Mismo modelo (`nombre_carta`, `texto_boton`, `nombre_ticket`, `nombre_cocina`, `texto_etiqueta[1..5]`),
  pero **con herencia**: si dejas `nombre_cocina` vacío, se usa `nombre_carta`. No tecleas cinco veces.
- **Idioma por destino**: `nombre_cocina` puede ir en el idioma del cocinero; el ticket y la carta
  digital, en el idioma del cliente (ver §11, recursos i18n).
- **Variables** en los textos (p. ej. tamaño/variante) en lugar de duplicar productos.
- Presentado en una **sola tarjeta "Nombres"** del editor, no disperso en pestañas.

**Prioridad: 🔴 ALTA.** Botón, ticket y cocina necesitan textos distintos desde el día 1.

---

## 3. Dos ejes de clasificación: Familia + Categoría ★

**Para qué sirve.** Un producto necesita clasificarse por **dos lógicas distintas a la vez**:
una **operativa/fiscal/cocina** (para informes, orden en factura, estación) y otra de
**pantalla/menús** (cómo se agrupa en el TPV y en los menús).

**Cómo lo hace Ágora.** Dos ejes paralelos: **Familia** (agrupada bajo **Grupo Mayor**, con
jerarquía Familia Padre) y **Categoría** (con Categoría Padre). Un producto tiene **1 familia +
N categorías**. Cada uno con flags *Mostrar en TPV* / *Mostrar en Menús*.
([clasificacion.md](../09-referencia-configurador-agora/productos/clasificacion.md))

**Cómo lo mejoramos.** Mantenemos los dos ejes (son correctos), pero:

- **Visibilidad por local y por grupo de terminal de serie** (las pestañas que Ágora deja
  colapsadas): una misma carta sirve cafetería vs restaurante **sin duplicar productos**.
- **Etiquetas/tags transversales** (§5) como tercer filtro ligero, sin tocar la jerarquía.
- UI que explica el porqué de cada eje en vez de dos listados crípticos.

**Prioridad: 🟡 MEDIA-ALTA.** Estructural; necesario antes de cargar 700 productos bien.

---

## 4. Color e imagen heredables

**Para qué sirve.** Pintar los botones de la operativa (colores de marca) sin dar de alta
imagen/color en cada uno de los 700 productos.

**Cómo lo hace Ágora.** Color, imagen y texto se definen en familia, categoría **y** producto,
pero **sin herencia**: si el producto no tiene color, sale soso; hay que rellenarlo a mano.
([producto.md §2](../09-referencia-configurador-agora/productos/producto.md),
[clasificacion.md](../09-referencia-configurador-agora/productos/clasificacion.md))

**Cómo lo mejoramos.** **Herencia en cascada**: si el producto no tiene color/imagen, **hereda
el de su familia o categoría**. Se da de alta el estilo una vez por familia y todos los productos
lo toman; sólo se sobrescribe la excepción. Menos trabajo de alta, operativa coherente con la marca.

**Prioridad: 🟢 MEDIA.** Calidad de vida; gran ahorro en catálogos grandes.

---

## 5. Etiquetas / tags (con color e inteligentes)

**Para qué sirve.** Marcar productos transversalmente (`vegano`, `picante`, `novedad`, `temporada`,
`sin gluten`) para filtrar en informes, reposición, menús y **carta digital**.

**Cómo lo hace Ágora.** CRUD simple **Id · Nombre**, asignable a familias/categorías/productos.
En este negocio la lista está **vacía** (no lo usan).
([etiquetas.md](../09-referencia-configurador-agora/productos/etiquetas.md))

**Cómo lo mejoramos.**

- Tags con **color e icono** visibles en carta y carta digital (vegano 🌱, picante 🌶️).
- Tags **derivados/inteligentes**: "sin gluten" se calcula desde alérgenos (§6), no se marca a mano.
- Filtro real por etiqueta en informes y en la carta online.

**Prioridad: 🟢 MEDIA.** No bloquea operativa; muy útil para cartas segmentadas.

---

## 6. Alérgenos: contiene vs trazas y derivados de ingredientes ★

**Para qué sirve.** **Cumplimiento legal** (14 alérgenos UE, Reglamento 1169/2011): mostrar al
cliente qué lleva cada plato, en carta, ticket y carta digital.

**Cómo lo hace Ágora.** Maestro con los **14 oficiales** (nombre + icono), asignables al producto
(pestaña Ficha). Sólo marca **presencia** (sí/no), sin matiz, y la asignación es **manual**.
([alergenos.md](../09-referencia-configurador-agora/productos/alergenos.md))

**Cómo lo mejoramos.**

- **Distinguir "contiene" vs "trazas"** (`tipo CONTIENE | TRAZAS`) — Ágora no lo hace.
- **Derivación automática desde el escandallo**: si un ingrediente tiene gluten, el producto
  hereda el alérgeno. Menos errores que marcarlo a mano plato por plato.
- Iconos **accesibles** (texto alternativo, no sólo color/imagen) para la carta digital.
- Lista precargada de los 14, **editable por tenant** (icono propio, idioma).
- (Opcional) **aviso en TPV** si se vende un producto con un alérgeno crítico para el cliente seleccionado.

**Prioridad: 🔴 ALTA.** Es obligación legal; el matiz contiene/trazas y la derivación son el diferencial.

---

## 7. Menús / combos con pasos y mín/máx ★

**Para qué sirve.** Vender un **menú del día / combo** como un solo producto en el que el cliente
**elige por pasos** (primero, segundo, postre, bebida), cada paso de una categoría, con su
suplemento y su pase de cocina.

**Cómo lo hace Ágora.** Menú = producto con su clase fiscal y **Grupos de Platos** (pasos):
cada grupo tiene `Nº Platos` **fijo** y una categoría de la que elegir. El suplemento de un plato
sale del campo *Supl. Menú* del producto.
([menus.md](../09-referencia-configurador-agora/productos/menus.md))

**Cómo lo mejoramos.**

- **Mín/máx por paso** en lugar de `Nº Platos` fijo: "elige **1 o 2** entrantes".
- **Suplemento visible en el paso** (no enterrado en la ficha del producto): el camarero lo ve al elegir.
- **Aviso/desglose fiscal** claro cuando el menú combina IVA/IGIC de distintos tipos
  (bebida 21 % + comida 10 %): decisión `@gluuh/core` documentada, no opaca.

**Prioridad: 🟡 MEDIA-ALTA.** Menú del día es estándar en restaurante; el editor por pasos falta hoy.

---

## 8. Tarifas (listas de precio) con herencia, vigencia y canal

**Para qué sirve.** Que un mismo producto cueste **distinto** en barra/terraza/cafetería/delivery
**sin duplicarlo**: una tarifa es una lista de precios; cada centro de venta apunta a una tarifa.

**Cómo lo hace Ágora.** Tarifas (`LOCAL`, `COFFEE`) con **Tipo de precio**
(impuestos incluidos/excluidos). El producto tiene un **precio por tarifa**
(principal · añadido · suplemento de menú). Hay que rellenar el precio en cada tarifa.
([tarifas.md](../09-referencia-configurador-agora/administracion/tarifas.md),
[producto.md §8](../09-referencia-configurador-agora/productos/producto.md))

**Cómo lo mejoramos.**

- **Herencia de tarifa**: si `COFFEE` no fija precio, usa `LOCAL`. No obligas a rellenar todas.
- Tarifas con **vigencia** (happy hour, temporada) y por **canal** (sala vs delivery vs carta online).
- **Aviso** si una tarifa mezcla productos con precio incluido y excluido.
- En hostelería ES casi siempre **impuestos incluidos**; el desglose lo hace `@gluuh/core`.

**Prioridad: 🔴 ALTA.** Multi-tarifa es base de precios por zona/canal.

---

## 9. Programador de tarifas / happy hour visual ★

**Para qué sirve.** Cambiar **automáticamente** la tarifa activa de un centro según **fecha,
franja horaria y día de la semana**: happy hour de tarde, terraza nocturna, precio de mediodía.

**Cómo lo hace Ágora.** Tabla de programaciones **Centro · Tarifa · Rango de fechas · Franja ·
Días (L-D)**; si una franja no especifica tarifa, se aplica la tarifa por defecto del centro.
Funcional pero presentado como formulario de filas.
([precios.md §1](../09-referencia-configurador-agora/herramientas/precios.md))

**Cómo lo mejoramos.**

- **Programación visual** (calendario + franjas), reutilizando los periodos de servicio del local.
- **Vista previa del precio activo "ahora"**: el configurador te dice qué tarifa rige en este momento.
- Resolución de tarifa activa centralizada (match centro + fecha/hora/día, fallback a la del centro).
- Cambios de precio **auditados** y **no retroactivos** sobre documentos ya emitidos (VERIFACTU).

**Prioridad: 🔴 ALTA.** Happy hour real es muy pedido y hoy no existe.

---

## 10. Márgenes, simulador y modificación masiva de precios

**Para qué sirve.** Fijar el PVP **a partir del coste y un margen objetivo** (food cost %),
y mover precios en masa (+5 % a todo, clonar una tarifa en otra) sin tocar producto a producto.

**Cómo lo hace Ágora.** Herramientas separadas: **Ajustar Márgenes** (coste→PVP por familia/categoría/
tarifa, antiguo vs nuevo), **Modificación Global** (% o importe en masa, copiar tarifa),
**Etiquetado de Cambios de Precio** (reimprime sólo lo que cambió) e **Import/Export Excel**.
([precios.md §2–5](../09-referencia-configurador-agora/herramientas/precios.md))

**Cómo lo mejoramos.**

- **Simulador de margen**: ver food cost % y beneficio **antes** de aplicar; **alertas** de productos
  por debajo del margen objetivo.
- Vista **antiguo → nuevo** clara antes de confirmar; todo el update masivo pasa por `@gluuh/core`
  para mantener impuesto incluido.
- Import/Export con **plantilla validada** (y Google Sheets); **histórico de cambios** por producto.

**Prioridad: 🟡 MEDIA-ALTA.** Rentabilidad real; el simulador es el diferencial frente a Ágora.

---

## 11. Carta digital QR con marca propia y multi-idioma ★

**Para qué sirve.** Que el cliente vea la carta en su móvil por **QR/URL**, con la **marca del local**,
fotos, alérgenos, añadidos y precios; opcionalmente pedir y pagar (Scan & Pay).

**Cómo lo hace Ágora.** SmartMenu: editor propio (nombre, descripción, color, CSS, imagen, T&C,
hasta 3 tarifas, moneda, mostrar añadidos/alérgenos, categorías, URL+QR, sugerencias). Es un
**editor aparte** del backoffice/ticket. ([carta-digital.md](../09-referencia-configurador-agora/herramientas/carta-digital.md))

**Cómo lo mejoramos.**

- **Misma base de marca** que el backoffice y el ticket (color/logo del local), no un editor desconectado.
- **Multi-idioma** reutilizando los recursos i18n (§traducciones): idioma del cliente **autodetectado**,
  fallback al idioma de referencia. Traducir 700 productos a mano no escala → **traducción asistida**
  (sugerir, revisar, confirmar) a nivel de **dato** (no sólo UI).
- Fotos por producto y **filtros** (vegano/picante) desde las etiquetas (§5).
- Pedido/pago integrado con el **cobro offline-first y VERIFACTU**; QR generado por `@gluuh/core`
  (que ya hace el QR VERIFACTU); enlace público con caché/CDN.

> **Traducciones (recursos i18n).** i18n a nivel de **literal del catálogo** (no sólo de interfaz):
> tabla `translation(entity, campo, locale, texto)`. Alimenta carta digital, ticket y la propia UI
> del personal. ([recursos.md](../09-referencia-configurador-agora/herramientas/recursos.md))

**Prioridad: 🟡 MEDIA-ALTA.** Diferenciador comercial fuerte; el kiosko ya existe como base.

---

## 12. Promociones automáticas por canal y descuentos manuales con control

**Para qué sirve.** Dos cosas distintas: **promociones** que se aplican **solas** al cumplir reglas
(3x2, descuento por volumen, vigencia) y **descuentos** que el operario aplica **a mano** a una línea
o al ticket, con autorización.

**Cómo lo hace Ágora.**
**Promociones**: motor con vigencia, programación, tipo (descuento directo, NxM…), uds. requeridas,
descontar sobre más caros/baratos. (3x2 = uds. 3, sobre los más baratos, 100 %, por grupos.)
**Descuentos**: predefinidos (línea/ticket, % o importe) con flag *Solicitar autorización*.
([promociones.md](../09-referencia-configurador-agora/administracion/promociones.md),
[descuentos.md](../09-referencia-configurador-agora/administracion/descuentos.md))

**Cómo lo mejoramos.**

- Promos por **canal** (sólo delivery, sólo carta online) y por **cliente/grupo**.
- **Prioridad y exclusión** entre promociones (qué gana si varias aplican) — Ágora no lo aclara.
- **Trazabilidad fiscal**: la promo/descuento aplicado queda en la línea para auditoría, abonos
  correctos y VERIFACTU; el cálculo pasa por `@gluuh/core` con impuesto incluido.
- Descuentos manuales con **límite por rol** (camarero ≤ 10 %, encargado sin límite), **motivo
  obligatorio** (lista + libre) y **botones visibles según permiso** (lo que no puedes usar, no se ve).
  La autorización se respalda en **backend/RLS**, no sólo en UI.

**Prioridad: 🟡 MEDIA-ALTA** (promociones) · **🟢 MEDIA** (descuentos manuales).

---

## 13. Entradas / vales canjeables (eventos y catering)

**Para qué sirve.** Emitir un **vale/entrada** al vender (consumición incluida, abono de evento,
bono de catering) que se **canjea** después por un producto, con plantilla de impresión y caducidad.

**Cómo lo hace Ágora.** Plantillas de entrada + tipos de entrada (validez en días, "imprimir con" /
"canjear usando"). En este negocio la lista está **vacía** (nicho de eventos/catering).
([entradas.md](../09-referencia-configurador-agora/productos/entradas.md))

**Cómo lo mejoramos.**

- **QR único** por entrada (canje por escáner/móvil, no sólo impresión térmica).
- **Caducidad y un solo uso verificados en backend** (anti-fraude e idempotente con el offline-first),
  no sólo en el cliente.
- Venta de **bonos a distancia** desde la carta digital.

**Prioridad: 🟢 BAJA** en bar/restaurante estándar; **🟡 MEDIA-ALTA** para eventos/catering.

---

## Tabla resumen

| # | Mejora | Cómo Ágora | Cómo lo mejoramos | Prioridad |
|---|--------|-----------|-------------------|:---------:|
| 1 | **Modificadores reutilizables** | Familias ocultas (`AÑADIDOS`) por producto | Grupos mín/máx compartidos; `precio_anadido`; herencia fiscal; pizza+queso | 🔴 Alta |
| 2 | **Nombres múltiples** | 5 campos en 3 pestañas, sin herencia | Tarjeta única, herencia (vacío→carta), idioma por destino, variables | 🔴 Alta |
| 3 | **Familia + Categoría** | Dos ejes correctos, visibilidad colapsada | Visibilidad por local/terminal de serie; tags transversales | 🟡 Media-alta |
| 4 | **Color/imagen heredables** | Definidos en 3 niveles, sin herencia | Cascada producto→familia/categoría; alta una vez | 🟢 Media |
| 5 | **Etiquetas/tags** | CRUD nombre simple | Color/icono en carta; tags derivados (sin gluten) | 🟢 Media |
| 6 | **Alérgenos** | 14 UE, sólo "presencia", manual | Contiene vs trazas; derivados de escandallo; accesibles | 🔴 Alta |
| 7 | **Menús por pasos** | Pasos con `Nº Platos` fijo | Mín/máx por paso; suplemento visible; aviso fiscal mixto | 🟡 Media-alta |
| 8 | **Tarifas** | Lista por nombre, rellenar todas | Herencia, vigencia, canal; aviso incl./excl. | 🔴 Alta |
| 9 | **Programador / happy hour** | Tabla de filas centro·tarifa·franja | Calendario visual; precio activo "ahora"; no retroactivo | 🔴 Alta |
| 10 | **Márgenes y masivo** | Ajustar márgenes / global / Excel | Simulador food cost %, alertas, plantilla validada, histórico | 🟡 Media-alta |
| 11 | **Carta digital QR** | SmartMenu editor aparte | Marca compartida, i18n a nivel dato, pago VERIFACTU, QR core | 🟡 Media-alta |
| 12 | **Promociones / descuentos** | Motor NxM + descuentos manuales | Por canal/cliente, prioridad/exclusión, límite por rol, motivo, RLS | 🟡 Media-alta / 🟢 Media |
| 13 | **Entradas / vales** | Plantillas + tipos (lista vacía) | QR único, un solo uso en backend, bonos a distancia | 🟢 Baja (🟡 catering) |

---

### Principios que recorren todo el bloque

1. **Impuesto incluido + desglose en `@gluuh/core`**: precios, añadidos, menús, promociones,
   descuentos y cambios masivos resuelven IVA/IGIC/IPSI por el mismo motor. Nunca se recalcula a mano.
2. **Herencia en todo lo que se repite**: nombres, color/imagen, tarifa, idioma. Dar de alta una vez.
3. **Backoffice Supabase/Notion para configurar, operativa colorida con marca para vender.**
4. **Trazabilidad y no-retroactividad fiscal**: cambios de precio, promos y descuentos quedan
   auditados (quién/cuándo) y no alteran documentos VERIFACTU ya emitidos.
5. **"Para qué sirve" explícito** en cada pantalla del configurador: más intuitivo que Ágora.
