# Catálogo de elementos del plano (SVG) — prompts y rejilla

> Define los **elementos del plano de sala** (mesas, barra, paredes, puerta, plantas, decoración…)
> como **SVG** sobre una **rejilla de celdas**. Para cada elemento: cuántas **celdas** ocupa,
> el **viewBox** del SVG y un **prompt** listo para generar el SVG. Encaja con la tabla
> `plano_elemento` (mig. 0028) y con `restaurant_table` (`pos_x/pos_y/capacidad`).

---

## 1. Sistema de rejilla

- **Celda base = 40 px.** Todo se mide y se ancla en celdas (snapping).
- **Lienzo de diseño de referencia = 5×5 celdas (200×200 px).** Cada elemento se dibuja dentro
  de ese módulo y **ocupa un número entero de celdas** (`ancho × alto` en celdas).
- **Coordenadas en BD:** `pos_x`, `pos_y`, `ancho`, `alto` van en **píxeles** = `celdas × 40`.
  - Ej.: una mesa de `2×2` celdas → `ancho=80, alto=80`. Una barra de `5×1` → `ancho=200, alto=40`.
- **viewBox del SVG** = `0 0 (ancho_celdas·40) (alto_celdas·40)`, así el SVG escala 1:1 con el footprint.
- **Snapping del editor:** al arrastrar, `pos_x`/`pos_y` se redondean al múltiplo de 40 más cercano.

```
        1 celda = 40px
   ┌────┬────┬────┬────┬────┐   módulo de diseño 5×5 (200×200)
   │    │    │    │    │    │
   ├────┼────┼────┼────┼────┤   una MESA_CUADRADA_4 ocupa el centro 2×2;
   │    │ ██ │ ██ │    │    │   las sillas viven en el borde (sprite 3×3).
   ├────┼────┼────┼────┼────┤
   │    │ ██ │ ██ │    │    │
   ├────┼────┼────┼────┼────┤
   │    │    │    │    │    │
   └────┴────┴────┴────┴────┘
```

## 2. Convenciones de estilo (para que todos peguen)

- **Vista cenital** (planta), estilo **flat**, trazo limpio. **Sin texto** dentro del SVG
  (el número de mesa y el importe los pinta la app encima).
- **viewBox** según footprint; `width`/`height` al 100% (la app escala).
- **Paleta neutra** (el color de estado lo aplica la app: libre = `currentColor`/borde,
  ocupada = ámbar, reservada = azul). Sillas en `currentColor` con opacidad.
  - Madera/barra: `#8a5a2b`. Plantas: verdes `#2f9e44`/`#2b8a3e`. Paredes: gris `#9aa0a6`.
- **Stroke** 2px, esquinas redondeadas 6–8px. **Estados** vía `class`/`currentColor`, no hardcodear.
- Exportar **optimizado** (sin metadatos), `fill="currentColor"` donde el estado deba teñir.

## 3. Tabla maestra (footprint en celdas)

| id | tipo (`plano_elemento`/mesa) | Celdas (an×al) | viewBox | Uso |
|----|------|:--:|:--:|------|
| `mesa_cuadrada_2` | mesa (cap 2) | 2×2 (sprite 2×3) | 0 0 80 120 | 2 sillas (arriba/abajo) |
| `mesa_cuadrada_4` | mesa (cap 3–4) | 2×2 (sprite 3×3) | 0 0 120 120 | 1 silla por lado |
| `mesa_doble_6` | mesa (cap 5–6) | 2×4 (sprite 3×5) | 0 0 120 200 | 1 en cada extremo + 2 por lado |
| `mesa_redonda_4` | mesa redonda | 2×2 (sprite 3×3) | 0 0 120 120 | 4 sillas alrededor |
| `mesa_redonda_8` | mesa redonda | 3×3 (sprite 4×4) | 0 0 160 160 | 8 sillas alrededor |
| `silla` | decor | 1×1 | 0 0 40 40 | silla suelta |
| `barra_recta` | `BARRA` | 5×1 (modular) | 0 0 200 40 | mostrador; repetible |
| `barra_esquina` | `BARRA` | 2×2 | 0 0 80 80 | esquina en L |
| `pared` | `PARED` | 1×N (modular) | 0 0 40 40 | muro; se estira |
| `puerta` | `PUERTA` | 2×1 | 0 0 80 40 | hueco con arco de apertura |
| `entrada` | `PUERTA` | 2×2 | 0 0 80 80 | acceso/recepción |
| `planta_pequena` | `PLANTA` | 1×1 | 0 0 40 40 | maceta |
| `planta_palmera` | `PLANTA` | 2×2 | 0 0 80 80 | palmera (terraza) |
| `pasillo` | `DECOR` | N×1 | 0 0 40 40 | guía de paso (suelo) |
| `aseo` | `DECOR` | 2×2 | 0 0 80 80 | zona WC |
| `futbolin` | `DECOR` | 2×3 | 0 0 80 120 | ocio |
| `billar` | `DECOR` | 2×4 | 0 0 80 160 | ocio |
| `caja_tpv` | `DECOR` | 1×1 | 0 0 40 40 | punto de cobro |
| `sombrilla` | `DECOR` | 2×2 | 0 0 80 80 | terraza |
| `taburete` | `DECOR` | 1×1 | 0 0 40 40 | banqueta (barra/mesa alta) |
| `mesa_alta` | mesa | 1×1 (sprite 2×2) | 0 0 80 80 | velador/mesa alta con taburetes |
| `jardinera` | `PLANTA` | 1×3 (modular) | 0 0 40 120 | macetero alargado / verde separador |
| `separador` | `PARED` | 1×3 (modular) | 0 0 40 120 | biombo/panel para dividir zonas |
| `banco_corrido` | `DECOR` | N×1 (modular) | 0 0 40 40 | banqueta corrida (banquette) |
| `columna` | `PARED` | 1×1 | 0 0 40 40 | pilar estructural |
| `cordon_poste` | `DECOR` | 1×1 | 0 0 40 40 | poste con cordón (cola/acceso) |
| `alfombra_zona` | `DECOR` | N×M | (variable) | mancha translúcida para delimitar un área |
| `estufa_terraza` | `DECOR` | 1×1 | 0 0 40 40 | seta calefactora |

> Las **mesas** son `restaurant_table` (su forma/sillas se derivan de `capacidad`); el resto son
> `plano_elemento`. El **asset SVG** se referencia por `id` (p. ej. en `plano_elemento.icono`
> o una columna `sprite`). Estado (libre/ocupada/reservada) lo aplica la app por encima.

---

## 4. Prompts por elemento

> Formato del prompt pensado para un generador de SVG (o para pedírselo a un modelo).
> Mantén **viewBox**, **estilo flat cenital**, **sin texto** y **`fill="currentColor"`** donde indique.

### Mesas

**`mesa_cuadrada_4`** · 2×2 (sprite 3×3, viewBox `0 0 120 120`)
```
SVG cenital flat de una mesa de restaurante CUADRADA con 4 sillas, una centrada en cada lado.
viewBox 0 0 120 120. Cuerpo de mesa cuadrado 80x80 centrado, esquinas redondeadas 8px,
relleno claro (#f5f1ea) y borde 2px en currentColor. 4 sillas idénticas como rectángulos
redondeados de 26x10 (las superior/inferior horizontales, las laterales verticales 10x26),
separadas 6px del cuerpo, en currentColor con opacity 0.45. Sin texto. Sin sombra.
```

**`mesa_cuadrada_2`** · 2×2 (sprite 2×3, viewBox `0 0 80 120`)
```
SVG cenital flat de mesa pequeña CUADRADA con 2 sillas (arriba y abajo). viewBox 0 0 80 120.
Cuerpo 80x80 con esquinas redondeadas 8px, relleno #f5f1ea, borde 2px currentColor. 2 sillas
horizontales 26x10 centradas arriba y abajo, currentColor opacity 0.45. Sin texto.
```

**`mesa_doble_6`** · 2×4 (sprite 3×5, viewBox `0 0 120 200`)
```
SVG cenital flat de mesa RECTANGULAR vertical (doble) para 6, viewBox 0 0 120 200. Cuerpo
80x160 centrado, esquinas redondeadas 8px, relleno #f5f1ea, borde 2px currentColor. Sillas:
1 horizontal arriba, 1 horizontal abajo (26x10) y 2 verticales (10x26) a cada lado, repartidas;
currentColor opacity 0.45. Sin texto.
```

**`mesa_redonda_4`** · 2×2 (sprite 3×3, viewBox `0 0 120 120`)
```
SVG cenital flat de mesa REDONDA para 4, viewBox 0 0 120 120. Círculo de radio 38 centrado,
relleno #f5f1ea, borde 2px currentColor. 4 sillas (rect redondeado 24x10) a 0/90/180/270°,
currentColor opacity 0.45. Sin texto.
```

**`mesa_redonda_8`** · 3×3 (sprite 4×4, viewBox `0 0 160 160`)
```
SVG cenital flat de mesa REDONDA grande para 8, viewBox 0 0 160 160. Círculo radio 52 centrado,
relleno #f5f1ea, borde 2px currentColor. 8 sillas (24x10) distribuidas cada 45°, currentColor
opacity 0.45. Sin texto.
```

**`silla`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de una silla suelta, viewBox 0 0 40 40. Rectángulo redondeado 24x12 (asiento)
y una línea fina como respaldo. currentColor opacity 0.5. Sin texto.
```

### Barra y estructura

**`barra_recta`** · 5×1 modular (viewBox `0 0 200 40`)
```
SVG cenital flat de un tramo de BARRA/mostrador recto, viewBox 0 0 200 40. Rectángulo 200x40
esquinas redondeadas 6px, relleno madera #8a5a2b, una franja interior más clara #a9743a de 6px
en el borde superior (encimera). Modular y repetible en horizontal. Sin texto.
```

**`barra_esquina`** · 2×2 (viewBox `0 0 80 80`)
```
SVG cenital flat de esquina de barra en forma de L, viewBox 0 0 80 80. Forma en L de 24px de
grosor, relleno madera #8a5a2b con franja clara #a9743a en el borde interior. Sin texto.
```

**`pared`** · 1×N modular (viewBox `0 0 40 40`)
```
SVG de un módulo de PARED, viewBox 0 0 40 40. Rectángulo 40x40 relleno gris #9aa0a6 sin borde,
pensado para estirarse en una dirección y formar muros. Sin texto.
```

**`puerta`** · 2×1 (viewBox `0 0 80 40`)
```
SVG cenital flat de PUERTA, viewBox 0 0 80 40. Hueco en la pared: dos topes de pared a los lados
(gris #9aa0a6) y un arco de apertura discontinuo (stroke dashed currentColor opacity 0.5) que
sugiere la hoja abriéndose. Sin texto.
```

**`entrada`** · 2×2 (viewBox `0 0 80 80`)
```
SVG cenital flat de ENTRADA/recepción, viewBox 0 0 80 80. Felpudo rectangular redondeado 60x30
con borde discontinuo y una flecha sutil hacia dentro. currentColor opacity 0.5. Sin texto.
```

### Vegetación y decoración

**`planta_pequena`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de maceta con planta, viewBox 0 0 40 40. Círculo macetero marrón #8a5a2b radio 9
centrado y 5–6 hojas verdes #2f9e44 saliendo radialmente. Sin texto.
```

**`planta_palmera`** · 2×2 (viewBox `0 0 80 80`)
```
SVG cenital flat de palmera vista desde arriba, viewBox 0 0 80 80. Tronco central pequeño y
6–8 hojas largas verdes (#2b8a3e/#2f9e44) en abanico desde el centro. Para terraza. Sin texto.
```

**`sombrilla`** · 2×2 (viewBox `0 0 80 80`)
```
SVG cenital flat de sombrilla de terraza, viewBox 0 0 80 80. Círculo a gajos alternando blanco
y amarillo #f1c40f, con punto central. Sin texto.
```

**`pasillo`** · N×1 (viewBox `0 0 40 40`)
```
SVG de guía de PASILLO en el suelo, viewBox 0 0 40 40. Banda semitransparente con línea
discontinua central, color currentColor opacity 0.15. Modular en horizontal. Sin texto.
```

**`aseo`** · 2×2 (viewBox `0 0 80 80`)
```
SVG cenital flat de zona de ASEO, viewBox 0 0 80 80. Rectángulo redondeado tenue con un icono
simple de WC (silueta) en currentColor opacity 0.5. Sin texto extra.
```

**`futbolin`** · 2×3 (viewBox `0 0 80 120`)
```
SVG cenital flat de futbolín, viewBox 0 0 80 120. Rectángulo verde campo #2f9e44 con líneas
blancas y 4 barras grises cruzando. Sin texto.
```

**`billar`** · 2×4 (viewBox `0 0 80 160`)
```
SVG cenital flat de mesa de billar, viewBox 0 0 80 160. Rectángulo verde tapete #1e7d3a con
borde madera #8a5a2b, 6 troneras (círculos oscuros) en esquinas y centros laterales. Sin texto.
```

**`caja_tpv`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de un punto de cobro/TPV, viewBox 0 0 40 40. Rectángulo redondeado (mostrador)
con una pantalla pequeña marcada. currentColor. Sin texto.
```

### Mobiliario extra y separadores de área

**`taburete`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de taburete redondo, viewBox 0 0 40 40. Círculo radio 12 centrado, relleno
#f5f1ea y borde 2px currentColor; pequeño aro interior sutil. Sin patas visibles (vista cenital).
Sin texto.
```

**`mesa_alta`** · 1×1 + taburetes (sprite 2×2, viewBox `0 0 80 80`)
```
SVG cenital flat de mesa alta/velador con 2 taburetes, viewBox 0 0 80 80. Círculo central radio 18
(#f5f1ea, borde 2px currentColor) y 2 taburetes (círculos radio 9, currentColor opacity 0.45) a los
lados. Sin texto.
```

**`jardinera`** · 1×3 modular (viewBox `0 0 40 120`)
```
SVG cenital flat de JARDINERA rectangular alargada, viewBox 0 0 40 120. Caja 40x120 esquinas
redondeadas 6px, borde madera #8a5a2b, relleno tierra #6b4a2b, y una hilera continua de hojas
verdes #2f9e44/#2b8a3e por encima. Modular en vertical; sirve también de separador verde. Sin texto.
```

**`separador`** · 1×3 modular (viewBox `0 0 40 120`)
```
SVG cenital flat de SEPARADOR/biombo para dividir zonas, viewBox 0 0 40 120. Panel fino 14x120
centrado, esquinas redondeadas 4px, relleno gris cálido #b9b2a7 con vetas sutiles; semiopaco.
Modular (se repite/estira para formar la línea divisoria entre áreas). Sin texto.
```

**`banco_corrido`** · N×1 modular (viewBox `0 0 40 40`)
```
SVG cenital flat de BANCO CORRIDO (banquette) modular, viewBox 0 0 40 40. Cojín rectangular
40x28 redondeado, relleno tapizado #d8cfbf con costura central; se repite en horizontal para
hacer un banco largo pegado a la pared. Sin texto.
```

**`columna`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de COLUMNA/pilar, viewBox 0 0 40 40. Cuadrado 24x24 centrado con esquinas
redondeadas, relleno gris #9aa0a6 y un cuadrado interior más oscuro. Estructural. Sin texto.
```

**`cordon_poste`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de POSTE con cordón (control de cola/acceso), viewBox 0 0 40 40. Círculo
pequeño (base del poste) en gris metálico #8a8f96 y un arco de cordón saliendo hacia un lado
(stroke 3px #9aa0a6). Sin texto.
```

**`alfombra_zona`** · N×M variable (viewBox `0 0 (an·40) (al·40)`)
```
SVG de ALFOMBRA/zona para delimitar un área, viewBox según footprint. Rectángulo redondeado que
cubre el footprint, relleno currentColor opacity 0.08 con borde discontinuo currentColor opacity
0.25. Va DETRÁS de las mesas y agrupa visualmente una zona (p. ej. "lounge"). Sin texto.
```

**`estufa_terraza`** · 1×1 (viewBox `0 0 40 40`)
```
SVG cenital flat de ESTUFA de terraza (seta calefactora), viewBox 0 0 40 40. Círculo radio 14
(pantalla) gris #b0b6bd con anillos concéntricos y un punto central naranja #e8590c (calor).
Sin texto.
```

---

## 5. Ejemplos SVG de arranque (hechos a mano)

> Sirven ya, sin generador. `currentColor` permite teñir por estado desde la app.

**`mesa_cuadrada_4`** (viewBox `0 0 120 120`):
```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" fill="none">
  <!-- sillas -->
  <g fill="currentColor" opacity="0.45">
    <rect x="47" y="6"  width="26" height="10" rx="4"/>
    <rect x="47" y="104" width="26" height="10" rx="4"/>
    <rect x="6"  y="47" width="10" height="26" rx="4"/>
    <rect x="104" y="47" width="10" height="26" rx="4"/>
  </g>
  <!-- cuerpo -->
  <rect x="20" y="20" width="80" height="80" rx="8" fill="#f5f1ea" stroke="currentColor" stroke-width="2"/>
</svg>
```

**`barra_recta`** (viewBox `0 0 200 40`):
```svg
<svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="200" height="40" rx="6" fill="#8a5a2b"/>
  <rect x="0" y="0" width="200" height="7" rx="4" fill="#a9743a"/>
</svg>
```

**`planta_pequena`** (viewBox `0 0 40 40`):
```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <g fill="#2f9e44">
    <circle cx="20" cy="12" r="6"/><circle cx="12" cy="18" r="6"/><circle cx="28" cy="18" r="6"/>
    <circle cx="15" cy="24" r="5"/><circle cx="25" cy="24" r="5"/>
  </g>
  <circle cx="20" cy="28" r="9" fill="#8a5a2b"/>
</svg>
```

---

## 6. Integración

- **Mesas**: el SVG por `capacidad` (cuadrada ≤4 / doble ≥5 / redonda). La app pinta encima
  número y total, y el color de estado (`currentColor` → libre/ocupada/reservada).
- **`plano_elemento`**: `icono`/`sprite` guarda el `id` del asset; `ancho/alto` (px = celdas·40)
  fijan el footprint; `pos_x/pos_y` la posición (snapping a 40).
- **Editor de plano** (pendiente): paleta con estos elementos, arrastrar y soltar con snapping
  a la rejilla; cada elemento conoce su footprint en celdas.

---

## 7. Prompt de lámina de muestrario (un elemento de cada, fondo transparente)

> Una sola imagen con **un único ejemplar de cada elemento**, para recortarlos como
> assets. **Fondo transparente** (el suelo se pone después, debajo).

```
Una sola imagen, vista estrictamente CENITAL (desde arriba, 90°, proyección ortográfica,
SIN perspectiva). FONDO de un único color liso MAGENTA puro (#FF00FF), totalmente
uniforme y plano, tipo croma, para poder recortar/extraer los elementos con facilidad
(ese color no aparece en ningún objeto). Sin cuadrícula, sin suelo, sin alfombras, sin
sombras proyectadas sobre el fondo. Estilo ilustración PLANA y limpia, mismo grosor de
línea y misma escala relativa en todo, sombras muy sutiles o ninguna.

Coloca UN ÚNICO ejemplar de cada uno de estos objetos, separados entre sí y bien
espaciados para que cada uno se distinga, en una cuadrícula imaginaria de huecos
(mobiliario de interior y de exterior de un restaurante):

mesa cuadrada con sus sillas, mesa rectangular con sus sillas, mesa redonda con sus
sillas, silla suelta, taburete, mesa alta, tramo de barra, separador / biombo,
jardinera, maceta con planta, palmera, sombrilla, banco, columna, puerta, futbolín,
mesa de billar, estufa de terraza, poste con cordón, papelera.

Las mesas se ven COMPLETAMENTE LIMPIAS por su parte de arriba: NADA encima de ellas
(sin platos, sin objetos, sin números, sin texto de ningún tipo). Maderas cálidas,
verdes naturales en las plantas, grises neutros en lo estructural. Nada de etiquetas
ni nombres.
```
