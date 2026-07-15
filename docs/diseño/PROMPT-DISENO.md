# Prompt para diseñar pantallas de la operativa Gluuh (HTML)

Genera tú los mockups (Stitch, v0, Gemini, otro Claude, Figma AI…) con el **prompt maestro**
de abajo, y me los pasas (HTML o imagen). Yo los integro en la app (Next/Tailwind), auto-alojo
las fuentes y cableo los datos reales.

---

## 1) Pantallas que NECESITO ver (por prioridad)

Marco con ⭐ las que más me desbloquean. Para cada una, pega su "brief" en el prompt maestro.

| # | Pantalla | Brief para el prompt |
|---|---|---|
| ⭐1 | **Pantalla de ventas (TPV)** | Rejilla de botones de PRODUCTO agrupados por FAMILIA (pestañas o columna de familias a un lado), el TICKET en curso a la derecha (líneas: nombre, uds, precio, total), teclado numérico bajo el ticket, y un botón **COBRAR** grande. Barra superior con mesa/sala, camarero y hora. |
| ⭐2 | **Visor de cobro (grande)** | Al cobrar: el TOTAL A PAGAR ENORME centrado, botones grandes de forma de pago (Efectivo, Tarjeta, Bizum), teclado numérico para el entregado, y el CAMBIO calculado grande. Pensado para verse de lejos y con problemas de vista (alto contraste). |
| ⭐3 | **Utilidades** | Menú de herramientas del TPV en botones grandes: Cierre de día, Abrir cajón, Imprimir última, Buscar documento, Enviar por email, Invitación, Ajustes. Rejilla de tiles. |
| 4 | **Cierre de caja (Z)** | Resumen del día: total ventas, por forma de pago, efectivo teórico vs contado, descuadre. Campo para meter el efectivo contado (con teclado numérico). Botón "Cerrar día" grande. Aviso si hay mesas abiertas. |
| 5 | **Selección/edición masiva de artículos** | Dos columnas: FAMILIAS con checkbox a la izquierda, ARTÍCULOS de la familia con checkbox a la derecha. Botones "Marcar todos / Desmarcar / Selección individual". Barra inferior con acción (cambiar precio, asignar, etc.) y Aceptar/Cancelar. |
| 6 | **Enviar factura por email** | Diálogo sobre el cobro: hasta 2 correos, mensaje predefinido editable, botón Enviar. Sencillo. |
| 7 | **Ajustes del terminal / accesibilidad** | Toggles grandes: tema claro/oscuro, tamaño de texto (Normal/Grande/Enorme), alto contraste, mostrar decimales, botones solo texto. Todo con interruptores grandes táctiles. |

> El **lanzador de inicio** ya tiene diseño (`docs/diseño/gluuh-inicio-diseño.html`). Úsalo como
> referencia de estilo para el resto.

---

## 2) PROMPT MAESTRO (cópialo y rellena el brief)

```
Eres un diseñador de UI experto en TPV de hostelería (estilo Glop y Ágora). Diseña UNA pantalla
en HTML para "Gluuh", un TPV para bares y restaurantes en España. Devuélveme SOLO el HTML.

MARCA Y ESTILO (obligatorio, es la identidad Gluuh):
- Tema OSCURO. Morado principal #572370, morado claro #7C3D9B. Fondos: #150A1B, #1F1330, #2C1B3D.
  Texto #F6F1F9, texto tenue #B9A5C6. Acentos: verde menta #3FD8A4 (éxito/confirmar), ámbar
  #F5A623 (ayuda/acción secundaria). Un único acento naranja/ámbar para acciones de dinero.
- Motivo de marca: un ESCUDO (polígono de 6 lados) como forma de las placas de icono.
- Moderno, por TILES/tarjetas con bordes redondeados (14-18px), degradados sutiles, sombras suaves.
- Es la OPERATIVA (la usa un camarero en una pantalla TÁCTIL): botones GRANDES (mínimo 56px de
  alto), texto legible, nada de menús diminutos ni cosas solo-hover. NO es un panel de escritorio.

REGLAS TÉCNICAS (imprescindibles):
- UN SOLO fichero HTML autocontenido: TODO el CSS inline en <style>. Sin JavaScript de librerías.
- NADA que se baje de internet: SIN Google Fonts, SIN CDNs, SIN imágenes externas. Usa fuentes
  del sistema (system-ui, "Segoe UI", sans-serif). (Corre en un bar SIN internet.) Si de verdad
  necesitas una fuente concreta, NÓMBRALA en un comentario pero no la enlaces.
- Táctil primero: objetivos grandes, buen espaciado, sin depender de hover. Accesible: buen
  contraste, foco visible (outline), tamaños de texto cómodos.
- Responsive: se ve bien en 1024x768 (TPV típico) y en pantallas grandes. Sin scroll horizontal.
- Datos de ejemplo realistas de un bar español (cañas, tapas, raciones, mesas, camareros).

LA PANTALLA A DISEÑAR:
[[[ PEGA AQUÍ EL "BRIEF" DE LA PANTALLA (de la tabla de arriba) ]]]

Devuelve solo el HTML completo, listo para abrir en un navegador.
```

---

## 3) Cuando me pases el resultado

- Vale HTML suelto o una imagen. Si es HTML, mejor: lo adapto a Next/Tailwind más rápido.
- Yo me encargo de: auto-alojar las fuentes, cablear datos reales (productos, ticket, formas de
  pago…), integrar el teclado en pantalla, y respetar la separación operativa/backoffice.
- Si quieres que clave una pantalla igual que una captura de Glop/Ágora, pásame la imagen además.
