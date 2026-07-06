# 08 — Análisis Glop TPV: cómo se ve, cómo funciona, qué imitamos

**Glop es la referencia visual y operativa nº1 para nuestro TPV.** Este documento
analiza sus tres pantallas clave (capturas aportadas el 02-07-2026: pantalla de
venta, diálogo de cobro y editor de salón) botón a botón, más lo aprendido de sus
manuales y ayuda online, y termina en decisiones concretas para Gluuh. Complementa
la tabla función-a-función de `docs/plan/04-tpv-estilo-glop.md`.

## 8.1 Pantalla de venta — anatomía completa (captura 1)

Proporciones aproximadas: **ticket+funciones ≈ 30% izquierda · carta ≈ 65% ·
pestañas de zona ≈ 5% derecha · barra de estado abajo**.

### Cabecera del ticket (arriba-izquierda)
- Botón **Asignar cliente** (icono persona) + campos visibles siempre: **Alias**,
  **Cliente**, **Nº Mesa**, **Comensales**, **Gr. Cocina** (grupo de cocina activo,
  aquí "BEBIDAS").
- Lección: el contexto del ticket (quién, dónde, cuántos) está **siempre visible**,
  no escondido en un menú. Un vistazo y sabes qué cuenta tienes delante.

### Ticket (columna izquierda)
- Tabla `Artículo | Uds. | Imp. | Total`, línea seleccionada resaltada en verde.
- Bajo el ticket, franja de totales: `Uds. · Precio · Artículos (5)` y el **total
  en grande (7,00 €)** con marco verde.
- Lección: el nº de artículos junto al total es un chequeo rápido contra la mesa
  ("os he puesto 5 cosas").

### Columna de funciones (entre ticket y carta, botones verticales con icono)
`Aparcar · Pasar a mesa · Cons. propio · Borrar cuenta · Dividir pagos · Camarero ·
Último doc.` — exactamente las acciones de cuenta, ni una más. Las acciones de
**línea** van en otra fila (ver teclado): Glop separa con claridad *qué actúa sobre
la cuenta* y *qué actúa sobre la línea/venta*.

### Bloque del teclado (abajo-izquierda)
- Fila superior de acciones de venta: `Comp. menú · Com. y extra · Invitación ·
  Anular línea · Imp. y aparcar`.
- Teclado `1-9 , 0 C <` con dos modos-toggle: **Und.** (verde, activo) y **Precio**
  — el número tecleado se interpreta según el modo. Nuestro TPV ya funciona igual
  (`Und./PREC`), validado.
- `Utilidades` (engranaje) y `Abrir cajón` junto al teclado.
- **Cobrar**: botón naranja, el más grande de la pantalla, esquina inferior derecha
  del bloque izquierdo — el único elemento no-verde de toda la UI. Lección: **un
  solo color de acento reservado para la acción de cobrar**; se encuentra sin mirar.

### Carta (derecha)
- **Fila de categorías arriba con foto real** (REFRESCO, CERVEZAS, CAFÉS, ALCOHOL,
  WHISKYS, LICORES, VINOS, COCKTAIL, ENSALADA, TAPAS, BOCADILLOS, PESCADOS, PLATOS,
  CARNES, PIZZAS, POSTRES, HELADOS…), con flechas de scroll vertical a la derecha.
- **Grid de productos con imagen de marca** (Coca-Cola normal/light/zero, Fanta,
  Aquarius, Vichy, Nestea, Casera, Red Bull, Schweppes, Bitter Kas, Seven Up,
  Sprite, zumos, Choleck…) y el nombre en franja inferior del botón.
- Lección doble: (1) la imagen del producto **es** el botón — en bebidas de marca el
  camarero reconoce el logo antes que el texto; (2) categorías con foto + productos
  con foto = cero lectura en el 90% de las ventas.

### Pestañas de zona (borde derecho, verticales)
`Ticket · Barra · Salón Glop · Terraza · Para llevar · Hotel` — cambiar de zona de
venta es **un toque siempre disponible**, no un "volver atrás". Nuestro menú lateral
de salas cumple la función; el patrón pestaña-fija-vertical es más rápido.

### Barra de estado (inferior, verde)
`CAJA ACTUAL 24/08/2017 12:19 · TURNO ACTUAL 1 · EMPLEADO ENCARGADO · TERMINAL 1 ·
TARIFA ACTIVA TARIFA B… · SALÓN` — el estado operativo completo en una franja de
20 px. Ya está decidida para nuestro TPV (guía 05 §5.1); esta es la referencia.

## 8.2 Diálogo de cobro (captura 2)

- **Zona 1 — formas de pago:** lista vertical `CONTADO / TARJETA / CHEQUE`
  (CONTADO preseleccionado). Un toque cambia la forma; el caso común no requiere
  tocar nada.
- **Zona 2 — acciones:** `Cancelar · Enviar por Email · Imprimir cuenta (F10) ·
  Cobrar Imprimir (F11) · Cobrar (F12)`. El **atajo de teclado impreso en el botón**
  enseña sin manual; F12 (cobrar sin imprimir) es el flujo de barra, F11 el de
  restaurante. Cobrar (F12) en naranja sólido = mismo acento que en la venta.
- **Zona 3 — resultado en grande:** `Total Ticket: 8,90` y **`A devolver: 11,10`**
  en tipografía enorme visible a un metro — el camarero teclea "20" y lee el cambio
  sin acercarse.
- Resto: cabecera con `Cliente / Empleado / Terminal` (editables al vuelo),
  `Tipo doc` (TICKET ▾ — aquí se cambia a factura), fecha/importe, `B. Imp` +
  `Impuesto` (desglose visible antes de cobrar), notas, **3 filas de importes** para
  pago mixto con borrado por fila, botón `Descuento`, display de entregado con
  teclado, y `Zonas de impresión: Activadas`.
- Lo que ya tenemos equivalente: entregado+cambio, mixto, propina. Lo que faltaba y
  confirma la guía 05: tipo de documento, proforma (F10), atajos F, email (fase 2).

## 8.3 Editor de salón (captura 3)

- Panel izquierdo con pestañas **Mesas | Objetos**: lista de plantillas de mesa
  (cuadrada 4, redonda, rectangular 6/8…) con botón `+` para añadir al lienzo.
- Lienzo: paredes (líneas negras), puerta (arco), valla rayada, árbol, cactus,
  sombrillas sobre mesas de terraza; cada elemento con su `X` roja de borrar; mesas
  numeradas 21-33 con sillas dibujadas.
- **Veredicto: aquí no copiamos — ya somos mejores.** Nuestro
  `(panel)/planos-de-mesas` tiene todo esto más suelos por zona, rotación, clonado,
  atajos de teclado, vista móvil y colores de marca. Lo único a valorar: la lista
  lateral de plantillas "toca + para añadir" es más descubrible que nuestro menú de
  añadir — revisar en una iteración de UI.

## 8.4 Lo aprendido de manuales y ayuda de Glop

Fuentes verificadas: manual oficial de hostelería
(https://www.glop.es/manuales/2017/Manual-Glop-tpv-hosteleria.pdf, leído íntegro),
FAQs oficiales (https://www.glop.es/faqs/) y videotutoriales
(https://www.glop.es/videos-glop/, demo completa
https://www.youtube.com/watch?v=XsoMfMtD_kA). Capturas oficiales adicionales:
venta+cobro, traspaso de mesas, dividir cuenta y editor de salones en
`glop.es/wp-content/uploads/2018/10/…` (URLs en el informe de investigación).

### Alta de artículos: siempre backoffice (Glop tampoco tiene creación rápida)
- La ficha vive en Artículos → Artículos: código, descripción (+ descripción de
  cocina aparte), familia, IVA **heredado de la familia**, imagen JPG o color+texto
  para el botón, y una batería de checks que cambian su naturaleza (stock, menú,
  pack, venta por peso…).
- **La familia precarga casi todo** (impuesto, formatos, extras, comentarios de
  cocina, zona de impresión, grupo de cocina, tamaño del botón), así que el alta
  normal queda en nombre + familia + precio — la misma herencia en cascada de
  nuestra guía 07 §7.1. Pero **no existe alta desde la pantalla de venta**: su
  único recurso en caliente es el "artículo variable" (checks *Descripción libre*
  y *Preguntar precio*: pide nombre y precio al venderlo — equivalente a nuestra
  venta libre §7.5 y al precio en blanco de Square).
- Formatos de venta por artículo (caña/copa/jarra) con precio **por cada una de
  hasta 20 tarifas**, y actualización masiva de precios tarifa-origen → destino
  con previsualización ("VER CAMBIOS").

### Operativa de mesas (el detalle que las capturas no muestran)
- **Aparcar = guardar y marchar**: al aparcar, la comanda se dispara a las zonas
  de impresión (cocina/barra). Un solo gesto. Nuestro botón Aparcar (guía 05 §5.3)
  debe imitar esto: aparcar sin haber marchado envía a cocina.
- **"Imp. y aparcar" = pre-ticket**: imprime el justificante de cuenta, no cobra,
  y la mesa pasa a un **cuarto estado visual**: libre / ocupada / reservada /
  **cuenta solicitada**. Adoptarlo: nuestro plano tiene 3 estados; el cuarto es el
  que le dice al camarero "esta mesa está esperando para pagar".
- **Traspaso en 3 toques**: mesa origen → botón "Traspaso mesa" → mesa destino
  (con indicador parpadeante de "modo traspaso"). Si el destino tiene cuenta, se
  fusionan — así resuelve Glop "juntar mesas" (no hay botón dedicado). Y
  **traspaso parcial de líneas**: tocas cada línea N veces para mover N unidades
  y eliges destino. → Refina nuestra guía 05 §5.4 y §5.10.
- **Dividir Pagos, dos modos**: Auto (total ÷ comensales) y Manual (arrastrar
  artículos a sub-cuentas) — exactamente los dos modos de nuestra guía 05 §5.10.
- **El salón tiene reglas propias**: documento por defecto al cobrar, tarifa
  propia (terraza más cara), pedir comensales/cliente/empleado al abrir, y
  **artículos de mesa automáticos** (p. ej. "servicio de pan" × comensales) que se
  cargan solos al abrir la mesa.

### Botones aclarados por la documentación
- **Cons. propio** no es un descuento: aplica la **"Tarifa Empleado"** a la cuenta.
- **Invitación**: ventana con checkbox por línea, 100% de descuento (se cobra a
  0 €), reversible, y **siempre registrada como incidencia auditable** por
  empleado/jornada — nunca se borra la línea. Confirma nuestro diseño (05 §5.6).
- **Utilidades** centraliza lo excepcional: buscar documento (y **abonar** con
  documento de abono, nunca editando el original), cobros pendientes (fiar con
  cliente obligatorio, pagos parciales), descuento por línea. Cada opción es un
  permiso por empleado.
- **Camarero**: selector con foto; identificación por clave, tarjeta/pulsera o
  huella; y un parámetro **"zurdo" que invierte el layout** para ese empleado.
- **Tarifas**: hasta 20, resueltas por contexto (terminal → salón → cliente →
  empleado → franja horaria).
- **No documentados oficialmente**: los atajos F10/F11/F12 del cobro (visibles en
  la captura) y el botón "Último doc." — verificar contra la demo si hace falta.

### Configuración de botonera (el "configurable" de Glop)
- Por **terminal**, desde backoffice: qué familias/artículos ve cada terminal,
  orden, tamaño, **familia destacada** (la que se reabre sola tras cada venta),
  skins de color, modo tablet 10", un botón auxiliar de acción rápida.
- Los **permisos de venta son binarios por botón** del TPV por perfil/empleado:
  la botonera efectiva de cada camarero es su perfil.
- **Grupos de trabajo**: botoneras temáticas por franja (desayunos, menú del
  mediodía) con artículos preformateados de varias familias.
- No hay editor libre de la disposición de los botones de acción: eso es fijo.

### Módulos y precios (su modelo de negocio)
- Licencia única sin cuotas (distribuidores: Mini ~120-200 € sin módulos, Pro
  ~290-459 €, Business ~570 €) + **21 módulos de pago separados a ~135-250 €/ud**
  (el comandero Android es extra, ~165 €/mando; monitor cocina 157 €, delivery,
  carta QR, Glop Cloud para informes, fidelización, tienda online, cobro
  automático…). La nube es un módulo de informes, no el sistema.
- **Activar un módulo = recibir un archivo de licencia, cargarlo en el programa y
  reiniciar** (manual §6.5). Nuestro contraataque exacto (auditoría doc 06 +
  guía 04): interruptor en la página Módulos, activación instantánea, pantallas
  emparejadas por código — sin archivos, sin reinicios, sin 150 € por pieza.
- Detalle fiscal aprovechable: su ventana de cobro ofrece **"Albarán"**, que según
  su propia FAQ "no registra ventas oficiales" — en la era VERIFACTU eso es un
  argumento comercial directo a nuestro favor (nosotros: todo cobro genera
  registro encadenado).

### Quejas de usuarios (dónde ganarles)
- **Rendimiento**: reseñas de Trustpilot (4/5, ~67 reseñas) con casos de
  "una venta de 7 artículos congelaba la pantalla 2 minutos" tras meses de uso —
  base de datos Firebird local que degrada. → Nuestro <100 ms optimista (09 §9.6).
- **Soporte**: te remiten al distribuidor que te lo vendió.
- **Arquitectura anticuada**: Windows + BD local; sin backoffice remoto real.
- **Coste modular**: personalizar encarece rápido; la versión barata no admite
  módulos.
- **Informes poco visuales** y personalización de botonera solo desde backoffice.

## 8.5 Decisiones para Gluuh (resumen ejecutable)

| Patrón Glop | Decisión | Dónde se implementa |
|---|---|---|
| Cabecera de ticket con alias/cliente/mesa/comensales siempre visible | Adoptar | guía 05 §5.5 |
| Columna de funciones de cuenta separada de acciones de línea | Adoptar tal cual (misma agrupación) | guía 05 §5.2 |
| Un solo acento naranja para Cobrar | Adoptar (nuestro acento = color de marca del cliente, `tenant_branding`) | guía 02 (refactor) |
| Categorías y productos con foto | Adoptar | guía 05 §5.9 |
| Pestañas de zona fijas en el borde | Adoptar (sustituye al menú lateral actual dentro de la venta) | guía 05 §5.2 |
| Barra de estado inferior completa | Adoptar | guía 05 §5.1 |
| Atajos impresos en los botones de cobro (F10/F11/F12) | Adoptar | guía 05 §5.8 |
| "A devolver" gigante legible a un metro | Adoptar | guía 05 §5.8 |
| Modo Und./Precio en el teclado | Ya lo tenemos | — |
| Editor de salón | No copiar (el nuestro es superior); valorar lista de plantillas lateral | backlog UI |
| Estética verde-flúo 2010, densidad caótica | **No copiar**: misma disposición, nuestra piel (marca del cliente + `docs/especificaciones/guia-de-diseno.md`) | — |
