# 02 — Diseño de interfaz táctil: que el TPV vaya perfecto y sea fácil de usar

> El TPV se usa **de pie, con prisa, a una mano, con las manos mojadas o con guantes**, y muchas
> veces mirando al cliente y no a la pantalla. Una interfaz táctil de TPV no es "una web con
> botones grandes": es una máquina de meter comandas y cobrar en el mínimo número de toques, sin
> errores y sin pensar. Este documento fija los **principios, layouts, estados y ergonomía** para
> las superficies operativas de Gluuh (`/tpv`, `/comandera`, `/kds`, `/pantalla`, `/kiosko`).
> Para la estética base ver [`GUIA_DISENO_COMPLETA.md`](../../GUIA_DISENO_COMPLETA.md) y para el
> inventario de pantallas cliente/cocina [`14-pantallas-cliente-kiosko-y-kds.md`](../../14-pantallas-cliente-kiosko-y-kds.md).

---

## 1. Dos mundos de diseño (recordatorio)

La memoria de diseño del proyecto separa **dos niveles**, y este documento es sobre el segundo:

| Nivel | Superficies | Estética | Densidad |
|-------|-------------|----------|----------|
| **Backoffice** | `app/(panel)/*` | Supabase/Notion: oscuro, verde `#34B27B`, denso, plano | Alta: ratón + teclado, `text-[12px]`, filas `py-1.5` |
| **Operativa táctil** | `/tpv`, `/comandera`, `/kds`, `/pantalla`, `/kiosko`, `/ofertas` | Colorida, **marca del cliente**, alto contraste, objetivos grandes | Baja: dedo, `text-[16px]+`, botones `h-16`+ |

> **Decisión.** No se reutiliza la densidad del backoffice en la operativa. El backoffice optimiza
> *información por pixel*; la operativa optimiza *aciertos por segundo*. Son sistemas distintos que
> comparten tokens de color de marca pero no escala tipográfica ni tamaños de control.

---

## 2. Principios de UI táctil (innegociables)

### 2.1 Tamaño del objetivo táctil

El dedo no es un cursor. La yema cubre ~10–14 mm; con prisa o de pie el punto de contacto se
desvía. Referencias del sector y nuestra decisión:

| Fuente | Mínimo recomendado |
|--------|--------------------|
| WCAG 2.2 (2.5.8, AA) | 24×24 px |
| WCAG 2.1 (2.5.5, AAA) | 44×44 px |
| Apple HIG | 44×44 pt |
| Material Design | 48×48 dp |
| **Gluuh TPV (decisión)** | **64×64 px** botón de producto · **56 px** acción · nunca < 48 px |

> **Por qué subimos a 64 px.** El usuario tiene prisa, a veces guantes de cocina, y no mira la
> pantalla al pulsar. 44 px es el mínimo *accesible*, no el óptimo *operativo*. En el grid de
> productos del TPV de mostrador buscamos celdas grandes y separadas para que **acertar sea el caso
> por defecto, no la excepción**.

```
Objetivo táctil mínimo vs recomendado (a escala aproximada)

  44px            48px              64px (Gluuh producto)
 ┌────┐          ┌─────┐          ┌────────────┐
 │ ok │          │ ok  │          │            │
 └────┘          └─────┘          │  CAÑA      │
 WCAG AAA        Material         │  1,80 €    │
                                  └────────────┘
```

Clases Tailwind de referencia:

```html
<!-- Botón de producto (grid del TPV) -->
<button class="h-20 min-h-[5rem] rounded-2xl px-3 text-[16px] font-semibold
               active:scale-95 active:brightness-95 transition select-none touch-manipulation">
  Caña <span class="block text-[13px] opacity-80 tabular-nums">1,80 €</span>
</button>

<!-- Acción de la botonera (Cobrar, Borrar, Enviar a cocina) -->
<button class="h-14 min-h-[3.5rem] px-5 rounded-xl text-[16px] font-semibold
               active:scale-95 touch-manipulation">Cobrar</button>

<!-- Tecla numérica del teclado de cantidad/efectivo -->
<button class="h-16 w-full rounded-xl text-[22px] font-semibold tabular-nums">7</button>
```

### 2.2 Espaciado y "fat finger"

- **Separación mínima entre objetivos: 8 px** (`gap-2`); en zonas de acción crítica (Cobrar junto a
  Cancelar) **16 px** (`gap-4`) y/o color distinto.
- **Nunca** poner una acción destructiva (Borrar línea, Anular ticket) pegada a una frecuente (Enviar
  a cocina). Sepárala, dale otro color y, si es irreversible, confirma.
- Padding generoso dentro del botón: el área pulsable debe llegar al borde visual, no haber un
  texto pequeño centrado en una caja grande con relleno "muerto".

### 2.3 Sin hover, sin dobles toques, sin gestos ocultos

- **No existe `:hover`** en táctil. Cualquier información o acción que dependa de pasar el ratón por
  encima **es invisible**. Prohibido: tooltips imprescindibles, menús que se abren al hover,
  estados que solo se ven al pasar por encima.
- **Un toque = una acción.** Evitar el doble toque (el navegador lo interpreta como zoom; añade
  `touch-action: manipulation` / `touch-manipulation`). Si hace falta "abrir detalle", que sea un
  toque sobre una zona clara, no un doble toque.
- **Gestos sí, pero como atajo, nunca como única vía.** Swipe para borrar línea está bien **si**
  además hay un botón visible de borrar. Un gesto que no se ve no se descubre.

### 2.4 Feedback inmediato (< 100 ms)

Cada toque debe responder **al instante**, aunque la operación de red tarde:

- **Visual:** `active:scale-95`, cambio de brillo/fondo en `:active` (no en `:hover`).
- **Háptico:** vibración corta donde el dispositivo lo permita (`navigator.vibrate(10)`).
- **Sonoro:** click opcional configurable (útil en barra ruidosa; molesto en sala — que el local lo
  decida).
- **Optimista:** la línea aparece en el ticket **antes** de confirmar con el servidor; si falla, se
  revierte con un toast de error. Nunca bloquear la UI esperando la red.

### 2.5 Tipografía grande, legible, números que no bailan

| Uso | Tamaño | Clase |
|-----|--------|-------|
| Nombre de producto en grid | 16–18 px | `text-[16px]`/`text-[18px] font-semibold` |
| Precio en grid / línea de ticket | 14–16 px | `text-[15px] tabular-nums` |
| **Total a cobrar** | 28–40 px | `text-[32px] font-bold tabular-nums` |
| Número de pedido (display/KDS) | 64–96 px | `text-[72px] font-black tabular-nums` |
| Etiqueta de acción | 16 px | `text-[16px] font-semibold` |

- **Inter** para texto; **`tabular-nums`** obligatorio en todo importe/cantidad/número de mesa para
  que las cifras no se muevan al cambiar.
- Mínimo absoluto en operativa: **14 px**. Por debajo no se lee de pie a 50–70 cm.

### 2.6 Contraste alto

- Texto sobre color de marca: comprobar contraste real. Un verde de marca claro con texto blanco
  puede no llegar a AA — preferir texto oscuro o un tono de marca más profundo para el texto.
- Objetivo: **≥ 4.5:1** para texto normal (WCAG AA), **≥ 3:1** para texto grande y para el borde de
  los controles. La operativa se usa con reflejos y brillo alto: mejor pasarse de contraste.

---

## 3. Velocidad operativa: "más rápido que el papel"

> **Métrica norte.** Tomar una comanda en el TPV debe ser **igual o más rápido que apuntarla en una
> comanda de papel**. Si el camarero piensa "tardo menos a boli", el diseño ha fallado.

### 3.1 Presupuesto de toques

| Tarea | Objetivo de toques | Cómo se consigue |
|-------|--------------------|------------------|
| Añadir 1 producto frecuente | **1** | Está en favoritos/primera pantalla, sin submenú |
| Añadir 1 producto de carta | **2–3** | Familia → producto (→ modificador si aplica) |
| Poner cantidad 3 de un producto | **2** | Producto + tecla "×3" o pulsar 3 veces el producto |
| Enviar comanda a cocina | **1** | Botón grande siempre visible |
| Cobrar en efectivo importe exacto | **2** | Cobrar → Efectivo (sugerido = total) |
| Cobrar con tarjeta | **2** | Cobrar → Tarjeta (dispara datáfono) |
| Cambiar de mesa | **2** | Selector de mesa → mesa |

> **Decisión.** Ningún producto de uso diario debe estar a más de **2 toques** del estado inicial.
> Si un producto se vende mucho, sube a favoritos (manual o por frecuencia automática).

### 3.2 Aceleradores

- **Favoritos / "Top ventas":** primera pestaña del grid. Configurable por local; opción de
  autollenado por los más vendidos de la última semana.
- **Búsqueda con teclado:** un campo siempre accesible; al escribir filtra por nombre/código. Para
  cartas largas es más rápido que navegar familias. Teclado en pantalla **grande**.
- **Teclado numérico** para cantidad, peso (productos a granel) y efectivo. Teclas `h-16`, números
  `text-[22px] tabular-nums`, tecla de borrar diferenciada.
- **Cantidad rápida:** pulsar el producto N veces suma N; o seleccionar línea y usar `+ / −` y
  `×N`. Long-press sobre el producto → abre cantidad numérica.
- **Accesos directos físicos:** lector de **código de barras** y teclas de teclado (si hay) deben
  funcionar (enfocar búsqueda → leer → añade).
- **Sin confirmaciones innecesarias:** añadir un producto no pide confirmar. Solo se confirma lo
  destructivo (anular ticket cobrado) o lo legalmente sensible.

### 3.3 Medir de verdad

Instrumentar (en producción) el **tiempo y nº de toques por comanda** y el **time-to-pay**. Si la
mediana de "abrir mesa → enviar a cocina" supera, p. ej., 15 s para una ronda de 4 productos
frecuentes, hay fricción que arreglar. La velocidad es un requisito medible, no una sensación.

---

## 4. Layout del TPV de mostrador (`/tpv`)

Pensado para **tablet/monitor horizontal** (10"–15"), apaisado, fijo en barra. Tres zonas:
**ticket (izq.) · grid de productos (centro/der.) · botonera de acciones (abajo/lateral)**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Mesa 12 · 4 pax · 00:18  │ [Familias]  CERVEZAS  REFRESCOS  CAFÉS  TAPAS  ▸  │  ← top bar + tabs familia
├───────────────────────────┼──────────────────────────────────────────────────┤
│  TICKET                   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  ───────────────────────  │  │ Caña   │ │ Tercio │ │ Doble  │ │ S/Alc  │       │  ← grid de productos
│  2× Caña          3,60 €  │  │ 1,80 € │ │ 2,20 € │ │ 2,50 € │ │ 2,00 € │       │     celdas h-20+
│  1× Tortilla      4,50 €  │  └────────┘ └────────┘ └────────┘ └────────┘       │
│  1× Café c/leche  1,30 €  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│    └ sin lactosa          │  │ Clara  │ │ Tinto  │ │ Vermut │ │ Sidra  │       │
│  ───────────────────────  │  │ 1,80 € │ │ 1,90 € │ │ 2,80 € │ │ 2,40 € │       │
│                           │  └────────┘ └────────┘ └────────┘ └────────┘       │
│  Subtotal        9,40 €   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  IGIC (7%)       0,61 €   │  │  ...   │ │  ...   │ │  ...   │ │  ...   │       │
│  ─────────────────────    │  └────────┘ └────────┘ └────────┘ └────────┘       │
│  TOTAL          9,40 €    │  [🔍 Buscar…]                     [#123]  [+ Mesa] │
├───────────────────────────┴──────────────────────────────────────────────────┤
│  [ − ]  [ + ]  [ ×N ]  [ Nota ]   │   [ Dividir ]  [ Imprimir ]  │  [ ENVIAR ▸ COCINA ]  [ COBRAR ] │
└──────────────────────────────────────────────────────────────────────────────┘
        acciones sobre la línea            acciones de ticket            acciones primarias (grandes, color)
```

Reglas del layout:

- **Ticket a la izquierda** (lectura natural izq→der; el camarero confirma de un vistazo lo añadido).
  Cada línea es un objetivo táctil para seleccionarla y editarla; **swipe-izquierda → borrar** con
  botón visible de respaldo.
- **Grid de productos** ocupa el mayor área. Celdas `h-20+`, `gap-2`, color por familia (ver §6).
  Familias en **pestañas grandes** arriba, no en un dropdown.
- **Botonera inferior** dividida en tres bloques con separación clara: editar línea · ticket ·
  **primarias** (Enviar a cocina y Cobrar, las más grandes, color de marca/acento, esquina alcanzable).
- **Selector de mesa/sala** en la top bar (mesa actual + tiempo abierto) y como acción `+ Mesa`.
  Cambiar de mesa o abrir el plano de sala desde aquí (ver §5.1).
- **Total siempre visible y grande**, abajo del ticket, `text-[32px] font-bold tabular-nums`.

### 4.1 Selector de sala / plano de mesas

```
┌───────────────────────────────────────────────┐
│  SALA   TERRAZA   BARRA   │   [ Lista ] [ Plano ]│
├───────────────────────────────────────────────┤
│   ┌────┐  ┌────┐  ┌────┐      ┌──────┐          │
│   │ M1 │  │ M2 │  │ M3 │      │  B   │  barra   │
│   │libre│ │18€ │  │⏱cobrar│   │ ··· │          │
│   └────┘  └────┘  └────┘      └──────┘          │
│   verde   ámbar    rojo                          │
│   ┌────┐  ┌────┐  ┌────┐                         │
│   │ M4 │  │ M5 │  │ M6 │   ⏱ = lleva > X min     │
│   └────┘  └────┘  └────┘      sin actualizar     │
└───────────────────────────────────────────────┘
```

Estados de mesa por color (ver §7). El plano refleja la disposición real del local (editable en
backoffice). Toque en mesa → abre/retoma su ticket.

---

## 5. Layout de la comandera (camarero, móvil — `/comandera`)

Móvil **vertical**, una mano. El pulgar manda: las **acciones primarias van abajo** (zona del
pulgar), la información arriba. Flujo en pasos cortos: **mesa → carta → ticket → enviar**.

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ ← Mesa 12 · 4 pax   │     │ ← CERVEZAS          │     │ ← Mesa 12   3 líneas │
│─────────────────────│     │─────────────────────│     │─────────────────────│
│  [🔍 Buscar carta ] │     │ ┌─────────────────┐ │     │ 2× Caña      3,60 € │
│                     │     │ │ Caña     1,80 € │ │     │ 1× Tortilla  4,50 € │
│  FAMILIAS           │     │ ├─────────────────┤ │     │ 1× Café      1,30 € │
│ ┌────────┐┌────────┐│     │ │ Tercio   2,20 € │ │     │   └ sin lactosa     │
│ │CERVEZAS││ CAFÉS  ││     │ ├─────────────────┤ │     │─────────────────────│
│ └────────┘└────────┘│     │ │ Doble    2,50 € │ │     │ TOTAL        9,40 € │
│ ┌────────┐┌────────┐│     │ ├─────────────────┤ │     │                     │
│ │ TAPAS  ││ VINOS  ││     │ │ Clara    1,80 € │ │     │ líneas: tocar para  │
│ └────────┘└────────┘│     │ └─────────────────┘ │     │ editar / nota / −   │
│ ┌────────┐┌────────┐│     │                     │     │─────────────────────│
│ │POSTRES ││ COPAS  ││     │  ● ● ● scroll       │     │  zona del pulgar ↓  │
│ └────────┘└────────┘│     │                     │     │ ┌─────────────────┐ │
│─────────────────────│     │─────────────────────│     │ │ ENVIAR ▸ COCINA │ │
│  [ Ver ticket (4) ] │     │  [ Ver ticket (4) ] │     │ └─────────────────┘ │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
   selector de mesa            carta (lista táctil)          ticket + enviar
```

- Filas de carta como **lista de ancho completo** (`h-14`+), más rápidas a una mano que un grid
  pequeño en móvil.
- **"Ver ticket (N)"** persistente abajo, con contador, como el carrito de un e-commerce.
- **Enviar a cocina** ocupa el ancho y vive en la franja del pulgar.
- Botón **atrás** arriba-izquierda; el resto de navegación, abajo.
- Optimista y **offline-first**: la comanda se guarda local y sincroniza; el camarero no espera red
  en mitad de la sala.

---

## 6. Layout del KDS (cocina — `/kds`)

Pantalla grande, **se mira a distancia (1–3 m)**, manos ocupadas/sucias → toques contados y grandes,
texto enorme, color por estado y por tiempo. Ver también
[`14 §5`](../../14-pantallas-cliente-kiosko-y-kds.md).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  COCINA · PARRILLA          Pendientes 3 · En curso 2          14:32   ▣ todo  │
├───────────────┬───────────────┬───────────────┬───────────────────────────────┤
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐                 │
│ │ #A-37 ⏱2:10│ │ │ #A-35 ⏱5:48│ │ │ #A-34 ⏱8:20│ │ │ #A-33 ⏱11:0│ ← rojo: tarde│
│ │ Mesa 12   │ │ │ Barra     │ │ │ Llevar    │ │ │ Mesa 4    │                 │
│ │───────────│ │ │───────────│ │ │───────────│ │ │───────────│                 │
│ │ 1 Hamburg.│ │ │ 2 Tortilla│ │ │ 1 Entrec. │ │ │ 1 Pulpo   │                 │
│ │   sin cebo│ │ │ 1 Ensalad.│ │ │   al punto│ │ │ 2 Croquet.│                 │
│ │ 1 Patatas │ │ │           │ │ │ 1 Patatas │ │ │           │                 │
│ │───────────│ │ │───────────│ │ │───────────│ │ │───────────│                 │
│ │[ EMPEZAR ]│ │ │[  LISTO  ]│ │ │[  LISTO  ]│ │ │[  LISTO  ]│                 │
│ └───────────┘ │ └───────────┘ │ └───────────┘ │ └───────────┘                 │
│  ámbar        │  azul         │  azul         │  rojo (sobrepasa SLA)          │
└───────────────┴───────────────┴───────────────┴───────────────────────────────┘
```

- **Una comanda = una tarjeta**; columnas o flujo de izquierda (recién entrada) a derecha (más
  antigua/urgente).
- **Cronómetro por tarjeta** (`⏱`): verde/sin color al entrar, **ámbar** al acercarse al objetivo,
  **rojo** al pasarlo. Umbrales configurables por estación.
- **Avanzar de estado con un toque grande** (`EMPEZAR` → `LISTO` → fuera). Botón al ancho de la tarjeta.
- **Modificadores y notas resaltados** (sin cebolla, al punto) en color distinto para que no se pasen
  por alto.
- **Enrutado por estación** (parrilla/fríos/postres): cada KDS ve solo lo suyo; cabecera indica
  estación. Respaldo con impresora de impacto.
- Sin scroll que esconda comandas: si no caben, paginar o reducir, **nunca** ocultar la más urgente.

---

## 7. Layout de la pantalla de cliente (`/pantalla`) y display de estado

Pantalla grande en zona de recogida, **se lee a 3–6 m**. Números gigantes, dos columnas.

```
┌──────────────────────────────────────────────────────────────┐
│                   TU PEDIDO · GLUUH                            │
├───────────────────────────────┬──────────────────────────────┤
│        EN PREPARACIÓN          │      LISTO PARA RECOGER       │
│                                │                              │
│        A-37    A-38            │          A-34   A-35         │
│        A-39                    │          A-36                │
│                                │                              │
│   (números ámbar, grandes)     │   (números verdes + parpadeo │
│                                │    + sonido al pasar a listo)│
└───────────────────────────────┴──────────────────────────────┘
```

- Números `text-[72px]+ font-black tabular-nums`.
- **"Listo"**: parpadeo y/o sonido al transicionar, para que el cliente levante la vista.
- Sin interacción (es señalización); coherente en tiempo real con KDS y kiosko (mismo estado en BD,
  Supabase Realtime en producción — ver [`14 §9`](../../14-pantallas-cliente-kiosko-y-kds.md)).
- El **kiosko** (`/kiosko`) es vertical, autoservicio, botones aún más grandes, fotos/emojis, y debe
  bloquear gestos de navegación del navegador (modo kiosko). Ver [`14 §4`](../../14-pantallas-cliente-kiosko-y-kds.md).

---

## 8. Añadir producto con modificadores y notas (sin frenar la operativa)

> El detalle del modelo de modificadores va en otra carpeta de la auditoría. Aquí, **solo el
> principio de diseño táctil**: que personalizar un producto **no penalice** al 80 % de productos
> que no se personalizan.

Reglas:

1. **Producto simple = 0 pasos extra.** Una caña entra de un toque. **Jamás** abrir un diálogo de
   modificadores para algo que no tiene modificadores.
2. **Modificadores solo cuando existen.** Si el producto los tiene, al añadirlo se abre una hoja
   (bottom-sheet en móvil, panel lateral en mostrador) con opciones grandes; con valores por
   defecto ya marcados, de modo que "aceptar" sea un toque si no se cambia nada.
3. **Obligatorios vs opcionales.** Un punto de cocción (al punto/hecho) puede ser obligatorio →
   no se cierra hasta elegir, pero con un default sensato pre-seleccionado. Los extras son
   opcionales y nunca bloquean.
4. **Notas libres = último recurso.** Botón "Nota" con teclas rápidas frecuentes ("sin gluten",
   "para llevar", "sin hielo") antes que escribir. Escribir es lento; los chips son un toque.

```
┌─────────────────────────────────────┐
│  Hamburguesa completa        9,50 € │
│ ─────────────────────────────────── │
│  PUNTO  (obligatorio)               │
│  ( ) Poco  (•) Al punto  ( ) Hecho  │   ← default pre-marcado
│ ─────────────────────────────────── │
│  QUITAR                             │
│  [ Cebolla ] [ Pepinillo ] [ Salsa ]│   ← chips toggle, grandes
│  EXTRAS (+)                         │
│  [ Bacon +1€ ] [ Queso +0,80€ ]     │
│ ─────────────────────────────────── │
│  Nota:  [ sin gluten ] [ + escribir]│
│ ─────────────────────────────────── │
│        [ Cancelar ]   [ AÑADIR ▸ ]  │   ← AÑADIR grande, derecha
└─────────────────────────────────────┘
```

> **Decisión.** La hoja de modificadores se abre **encima** del flujo, con un toque la cierras
> aceptando los defaults. El coste de personalizar lo paga quien personaliza, no toda la operativa.

---

## 9. Estados visuales (color + icono + cronómetro, nunca solo color)

> Principio de la guía base: **el icono dice QUÉ, el color dice ESTADO**. Y nunca depender solo del
> color (daltonismo + reflejos): siempre icono y/o texto de apoyo.

### 9.1 Estado de mesa

| Estado | Color | Icono/texto | Significado |
|--------|-------|-------------|-------------|
| Libre | Verde / neutro `emerald` | "Libre" | Sin ticket abierto |
| Ocupada | Ámbar `amber` | importe + ⏱ tiempo | Ticket abierto, consumiendo |
| Por cobrar | Rojo/acento `rose` | "Cobrar" + total | Cuenta pedida / cierre pendiente |
| Atención | Pulso + ⏱ | "⏱ 35 min" | Lleva mucho sin actividad (aviso, no error) |

### 9.2 Estado de plato/pedido (KDS) — `PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO`

| Estado | Color | Cronómetro | Acción |
|--------|-------|-----------|--------|
| Pendiente | Neutro/ámbar | corre desde que entra | `EMPEZAR` |
| En preparación | Azul `sky` | corre; ámbar→rojo según SLA | `LISTO` |
| Listo | Verde `emerald` | se detiene | sale del KDS / pasa a display |
| Entregado | Gris | — | histórico |

Colores tomados de la paleta semántica fija de la guía (`emerald/amber/sky/rose/violet`) — no
inventar tonos nuevos. Cronómetros con `tabular-nums` para que no salten.

---

## 10. Ergonomía física

- **Zona del pulgar (móvil):** en vertical a una mano, el tercio inferior es lo cómodo; el tercio
  superior exige reajustar la mano. → **Acciones primarias abajo**, navegación/título arriba, lo
  destructivo fuera del arco natural del pulgar.
- **Mano dominante / modo zurdo:** opción para **espejar** la botonera (acciones primarias a
  izquierda/derecha) en comandera y TPV. Un diestro sujeta la tablet con la izquierda y toca con la
  derecha; un zurdo, al revés. Configurable por usuario.
- **Mostrador fijo:** el TPV de barra suele estar inclinado y a la derecha del operario → acciones
  primarias (Cobrar/Enviar) en la **esquina inferior derecha**, alcanzables sin estirarse.
- **Brillo y antirreflejos:** la operativa se usa en terraza con sol y en barra con focos. Diseñar
  para **brillo alto y contraste alto**; evitar grises sutiles que desaparecen al sol. Recomendado:
  pantallas mate/antirreflejo y un tema "alto contraste" para exterior.
- **Higiene:** superficies que se limpian; UI que tolera toques accidentales de un trapo (no
  acciones críticas en bordes donde roza la mano al limpiar).

---

## 11. Accesibilidad básica

| Requisito | Decisión |
|-----------|----------|
| **Contraste** | Texto ≥ 4.5:1 (AA); texto grande y bordes de control ≥ 3:1. Verificar el texto sobre el verde de marca. |
| **Tamaño de texto** | Mínimo 14 px en operativa; permitir escalado del SO sin romper layout. |
| **No solo color** | Todo estado lleva **icono + texto**, no solo color (daltonismo ~8 % varones, + reflejos). |
| **Objetivos** | ≥ 48 px siempre; 64 px en lo frecuente (§2.1). Cumple WCAG 2.5.8 con holgura. |
| **Lector de pantalla** | Obligatorio en **backoffice** (`app/(panel)`): `aria-label` en iconos mudos, foco visible, navegación por teclado, semántica (`<button>`, `<table>`). En la operativa táctil dedicada es secundario, pero los botones siguen siendo `<button>` con `aria-label`. |
| **Foco de teclado** | Backoffice navegable 100 % con teclado; foco esmeralda visible (ver guía base §10). |

> La skill de accesibilidad del repo (`.agents/skills/accessibility/`, WCAG 2.2) aplica
> especialmente al **backoffice**. En la operativa el foco es el objetivo táctil y el contraste.

---

## 12. Errores comunes de TPV táctiles (y cómo los evitamos)

| Error común | Síntoma | Solución Gluuh |
|-------------|---------|----------------|
| Botones pequeños y juntos | Toques fallidos, comandas erróneas | 64 px + `gap-2`/`gap-4` (§2.1–2.2) |
| Depender de hover | Acciones invisibles en táctil | Prohibido; todo visible (§2.3) |
| Doble toque / zoom accidental | Acciones duplicadas, descuadres | `touch-manipulation`, un toque = una acción (§2.3) |
| Confirmaciones por todo | Lentitud, "clickitis" | Solo confirmar lo destructivo/legal (§3.2) |
| Cobrar pegado a Cancelar | Cobros/anulaciones por error | Separar + color + confirmar lo irreversible (§2.2) |
| Bloquear UI esperando red | Camarero parado en sala | UI optimista + offline-first (§2.4, §5) |
| Estado solo por color | Inaccesible, falla con reflejos | Icono + texto + color (§9) |
| Texto pequeño/gris | Ilegible de pie, al sol | ≥14 px, alto contraste, `tabular-nums` (§2.5–2.6) |
| Carta solo por familias profundas | Lento para platos frecuentes | Favoritos + búsqueda (§3.2) |
| Gestos ocultos como única vía | Funciones que nadie descubre | Gesto = atajo, con botón visible (§2.3) |
| Modificadores siempre | Penaliza el producto simple | Hoja solo si hay modificadores (§8) |
| Densidad de backoffice en TPV | Demasiada info, objetivos minúsculos | Dos sistemas separados (§1) |

---

## 13. Checklist táctil (antes de dar por buena una pantalla operativa)

- [ ] Objetivos ≥ 48 px (64 px en lo frecuente), separación ≥ 8 px (≥ 16 px junto a destructivo).
- [ ] Cero dependencia de `:hover`; feedback en `:active` (visual + háptico opcional) < 100 ms.
- [ ] `touch-manipulation`; ningún flujo exige doble toque.
- [ ] Producto frecuente a ≤ 2 toques; enviar a cocina y cobrar a 1–2 toques.
- [ ] Total y números con `tabular-nums`, texto ≥ 14 px, contraste AA.
- [ ] Estado siempre con **icono + texto**, no solo color; cronómetros donde aplique.
- [ ] Acciones primarias en la zona alcanzable (pulgar abajo / esquina inferior derecha); modo zurdo.
- [ ] Producto simple sin diálogos extra; modificadores con defaults pre-marcados.
- [ ] UI optimista / offline-first; nunca bloquear esperando red.
- [ ] Legible al sol (alto contraste, sin grises sutiles); botones son `<button>` con `aria-label`.
