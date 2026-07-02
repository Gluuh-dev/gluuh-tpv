---
name: gluuh-ux-operativa
description: >-
  Lenguaje de diseño de las pantallas OPERATIVAS de Gluuh (TPV, comandera,
  kiosko, cocina/KDS, pantalla de recogida, visor, cartelería): táctil,
  intuitivo y rápido al estilo Glop TPV pero con la marca del cliente. Incluye
  los principios (cero lectura, un acento, memoria muscular, cifras táctiles en
  mm y ms), la CHECKLIST DE AUDITORÍA UX para analizar cualquier pantalla
  existente y decidir qué cambiar, y el estado actual de cada pantalla con sus
  huecos. Úsala SIEMPRE que diseñes, revises o audites UI operativa, elijas
  tamaños/colores/disposición de botones táctiles, o te pregunten si una
  pantalla es "fácil e intuitiva". Para el backoffice usa ui-kit-shadcn.
---

# UX operativa — el estilo Glop hecho bien

**Dos niveles de interfaz** (decisión de proyecto, `docs/17` §1): el
**backoffice** es estilo Supabase/Notion (skill `ui-kit-shadcn`); la
**operativa** — todo lo que toca un camarero, un cocinero o un cliente — es
esta skill: colorida, táctil, con la marca del bar (`tenant_branding`), densa
en información y de cero lectura. Referencias completas:
`docs/implementacion/08-analisis-glop.md` (anatomía Glop) y
`09-referencias-ux-competencia.md` (Revo/SumUp/Lightspeed/Square/Toast + cifras).

## Los 10 principios (por qué Glop se siente "fácil")

1. **Cero lectura en el 90% de las ventas**: la imagen/el color ES el botón
   (Coca-Cola se reconoce por el logo, no por el texto). Categorías con foto,
   productos con foto o color de familia; el texto es la confirmación, no la vía.
2. **Un solo acento de color, reservado a la acción de dinero** (Cobrar). En
   Gluuh el acento sale del branding del cliente. Si dos botones compiten en
   color, uno sobra.
3. **El contexto siempre visible, nunca en un menú**: cabecera del ticket
   (alias · cliente · mesa · comensales) + barra de estado inferior (operario ·
   terminal · caja/turno · tarifa · sala · red). Un vistazo = saber dónde estás.
4. **Lo frecuente a un toque, lo excepcional en Utilidades**: vender, cobrar,
   marchar y aparcar son directos; abonar, buscar documento o reimprimir viven
   agrupados en un solo botón "Utilidades" con permisos.
5. **Memoria muscular sagrada**: a las 2-3 semanas el camarero opera sin mirar.
   Los botones NO cambian de sitio entre versiones; un producto agotado se pone
   gris pero no desaparece ni se recoloca.
6. **Acciones de CUENTA separadas de acciones de LÍNEA**: columna de funciones
   (Aparcar, Pasar a mesa, Dividir…) ≠ teclado/ticket (anular línea, nota,
   descuento). Mezclarlas es el error nº1 de diseño de TPV.
7. **Cifras táctiles, en unidades físicas**: botones de carta ≥ 1×1 cm reales
   en el monitor del bar; acciones primarias ~2×2 cm; 8-10 mm entre acciones
   opuestas; bordes de pantalla necesitan botones más altos (11-12 mm) que el
   centro (7 mm). Base CSS: 48×48 px + 8 px de separación.
8. **< 100 ms por toque, feedback fuera del dedo**: UI optimista local (la red
   jamás en el camino del render) y la confirmación visible donde el dedo no
   tapa — resaltar la línea recién añadida en el ticket, no el botón pulsado.
9. **Estados por color, no por texto**: mesa libre / ocupada / reservada /
   **cuenta solicitada** (4º estado, estilo Glop); en el plano, pintar además
   el tiempo sin atender y los platos listos de cocina (patrón Revo/Tiller).
10. **Long-press = segundo nivel**: pulsación larga sobre un producto → editar
    precio/agotar (con PIN de encargado); sobre una mesa → reservas (ya existe).
    Un solo gesto que abre todo lo demás: "editas lo que tocas".

## Checklist de auditoría UX (pásala a cualquier pantalla operativa)

- [ ] ¿La acción principal es el elemento más grande y el único con acento?
- [ ] ¿Se puede operar el flujo completo sin leer ningún texto?
- [ ] ¿El contexto (quién/dónde/cuánto) está visible sin abrir nada?
- [ ] ¿Todo lo frecuente está a ≤ 2 toques? ¿Lo excepcional está agrupado?
- [ ] ¿Botones ≥ 1 cm físico, primarios ~2 cm, opuestos separados ≥ 8 mm?
- [ ] ¿Cada toque responde en < 100 ms con feedback fuera del dedo?
- [ ] ¿Los estados se distinguen por color/forma a 2 metros de distancia?
- [ ] ¿Nada cambia de posición respecto a la versión anterior?
- [ ] ¿Funciona con la marca del cliente (branding) y en su territorio fiscal?
- [ ] ¿Long-press da acceso a la edición en contexto con permiso adecuado?
- [ ] ¿Sirve igual para el novato del primer día (alta rotación) que para el
      veterano que no mira? (diseñar para el recién contratado)
- [ ] ¿Se probó en condiciones de bar: luz fuerte, prisa, dedos mojados, de pie?

## Estado actual y qué cambiar (auditoría a 02-07-2026)

| Pantalla | Veredicto | Qué cambiar (guía) |
|---|---|---|
| TPV (`app/tpv`) | Funcional pero "web", no "TPV" | Falta: columna de funciones de cuenta, barra de estado, cabecera cliente/comensales, imágenes en botones, F10/F11/F12, Utilidades. Todo en guía 05. Antes: refactor (guía 02) |
| Cobro (modales) | Bien (efectivo+cambio, mixto, propina) | "A devolver" más grande (legible a 1 m), tipo de documento, atajos impresos en el botón (guía 05 §5.8) |
| Kiosko (`app/kiosko`) | Bien de diseño (branding completo) | El pago es simulado (módulo PAGOS); revisar checklist táctil |
| Cocina/KDS (`app/cocina`) | Bien (oscuro, tiempos, estaciones) | Añadir orden por pases cuando lleguen; revisar tamaño de tarjetas a 2 m |
| Pantalla recogida (`app/pantalla`) | Bien | — |
| Comandera (`app/comandera`) | Funcional | Auditar tamaños táctiles (uso a una mano, en movimiento: mínimos más altos); navegación abajo, no arriba |
| Cartelería (`app/ofertas`) | Bien | — |
| Editor de planos (`planos-de-mesas`) | Mejor que Glop | Valorar lista lateral de plantillas "toca + para añadir" (más descubrible); borrar el editor viejo `(panel)/sala` |
| Plano dentro del TPV | Bien (estados+saldo) | Añadir 4º estado "cuenta solicitada", tiempo sin atender y "platos listos" (datos ya existentes) |

## Qué NO copiar de Glop

Su estética (verde flúo 2010, densidad caótica, skins), su modal de cobro
sobrecargada y su configuración solo-backoffice. Copiamos la **disposición y
los flujos**; la piel es nuestra: marca del cliente + tokens. Lo que Glop hace
mal y nosotros no: rendimiento (<100 ms), edición en contexto (long-press),
configuración desde la propia pantalla.
