# 07 — Creación y edición rápida desde el TPV

**Objetivo:** eliminar la mayor fricción de nuestros referentes. Medido con sus
propios manuales (docs 08 §8.4 y 09 §9.4): dar de alta un producto vendible exige en
**Ágora** 3-4 pantallas de backoffice con un formulario de ~10 secciones y 30+
campos, y en **Glop** 2 entidades (familia + artículo) con ~8 pestañas — y ninguno
de los grandes (Square, Lightspeed, Toast) documenta alta desde el ticket. En un
bar, "hoy hay tarta de la abuela" tiene que poder venderse **en menos de 10
segundos, sin salir del TPV**. Mismo patrón para clientes y para marcar agotados.

Principio: la creación rápida **no es otra entidad** — escribe en las mismas tablas
(`product`, `customer`) con defaults heredados; el backoffice sigue siendo el sitio
para el detalle (alérgenos, escandallo, imagen…). Cero duplicación.

## 7.1 Producto nuevo desde el grid (el caso estrella)

- **Dónde:** último botón del grid de productos, `+ Nuevo` (punteado, discreto).
  Visible para ENCARGADO/PROPIETARIO; el camarero lo ve pero al tocarlo pide PIN de
  encargado (patrón ya usado para validar operario).
- **Modal de 3 campos** (táctil, teclado en pantalla):
  1. Nombre
  2. Precio (impuesto incluido, como toda la carta)
  3. Categoría — **preseleccionada la que está abierta en el grid**
- **Todo lo demás se hereda** y no se pregunta: clase fiscal → la de la categoría/
  familia (el % sale solo de `ivaAuto`, como ya hace `(panel)/carta`); color → el de
  la familia; estación de preparación → la de la categoría; activo → sí.
- **Precio en blanco = precio variable** (patrón de Square): si se guarda sin
  precio, al venderlo salta el teclado y se teclea en el momento. Útil para "según
  mercado" (pescado del día).
- Al guardar: insert en `product`, el grid se refresca y **la primera pulsación ya lo
  vende**. Opción secundaria en el modal: "Crear y añadir al ticket".
- Implementación: reutilizar la lógica de `components/producto-dialog.tsx` extrayendo
  el insert a `lib/productos.ts` compartido entre backoffice y TPV (no duplicar el
  cálculo de clase fiscal). Componente nuevo `tpv/components/ModalProductoRapido.tsx`.

## 7.2 Edición rápida: pulsación larga sobre un producto

Long-press (o clic derecho) en un botón del grid → hoja táctil con lo que un
encargado toca en servicio:

- **Precio** (teclado numérico grande)
- **Nombre**
- **Agotado hoy** (7.3)
- "Ficha completa" → enlace al backoffice (`/carta?producto=<id>`) para lo demás

Mismo gate de PIN que 7.1. El TPV ya usa long-press para reservas de mesa: reutilizar
ese mismo patrón de interacción.

## 7.3 Agotado / "86" (lo que Toast llama *86 an item*)

- Migración: `alter table product add column if not exists agotado_hasta timestamptz;`
- Marcar "Agotado hoy" → `agotado_hasta = mañana 06:00` (se reactiva solo; nada de
  acordarse de desmarcarlo). "Agotado indefinido" → fecha lejana, se quita a mano.
- En el grid: botón en gris con franja "AGOTADO", no añade al ticket. En kiosko y
  comandera: **marcado como agotado, no oculto** (patrón Toast: el cliente ve que
  existía y se acabó; y el botón no cambia de sitio — memoria muscular).
- El flag cuelga de `product`, nunca del botón/carta: así se agota a la vez en TPV,
  kiosko y comandera (el bug célebre de Toast con artículos duplicados).
- La disponibilidad se aplica **al instante** en todos los dispositivos (Realtime),
  sin paso de "publicar" — a diferencia de los cambios de estructura de carta.
- Fase 2 (con módulo stock): tercer estado "quedan N" mostrado en el propio botón,
  descontando al enviar a cocina y auto-agotando al llegar a 0 (patrón Toast).
- Es probablemente la feature con mejor ratio utilidad/esfuerzo de toda la guía.

## 7.4 Cliente rápido desde el ticket

Ya diseñado en la guía 05 (§5.5): el buscador de cliente incluye "+ Nuevo" con dos
campos (nombre, teléfono). Insert en `customer`; el resto de la ficha, en backoffice.

## 7.5 Venta libre (producto sin ficha)

Para lo verdaderamente puntual ("me traen un género hoy y no volverá"): botón
**Venta libre** en Utilidades → precio + descripción + clase fiscal (por defecto
GENERAL). Implementación sin tocar el esquema: productos genéricos ocultos
pre-creados por clase fiscal ("VARIOS 10%", "VARIOS 21%"…, `activo = false` para que
no salgan en el grid) y la línea lleva la descripción tecleada como nota. Si el uso
real lo pide, se promociona a columna propia — no antes.

## 7.6 Lo que NO se hace desde el TPV (a propósito)

Familias/categorías nuevas, alérgenos, escandallos, menús combo, imágenes, tarifas:
todo eso es backoffice. La creación rápida existe para el servicio, no para sustituir
la administración — si el modal pasa de 3 campos, se ha roto el objetivo.

## Criterios de aceptación

- [ ] Cronómetro en mano: producto nuevo creado y vendido desde el TPV en < 10 s
      (nombre + precio + guardar, categoría ya preseleccionada).
- [ ] El producto creado aparece en `(panel)/carta` con su clase fiscal correcta y
      el IVA/IGIC calculado igual que uno creado desde el backoffice.
- [ ] Long-press permite cambiar un precio en < 5 s; PIN de encargado exigido si el
      operario activo es camarero.
- [ ] Producto marcado "Agotado hoy" desaparece de kiosko/comandera y reaparece solo
      al día siguiente.
- [ ] Venta libre genera línea con la clase fiscal elegida y desglose correcto en el
      ticket fiscal.
