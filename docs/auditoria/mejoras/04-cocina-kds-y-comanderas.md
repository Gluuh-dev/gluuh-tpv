# Mejoras — Cocina, KDS y comanderas (Gluuh vs Ágora)

> Documento consolidado de mejoras de **cocina, KDS (Kitchen Display System) y comanderas**
> de Gluuh frente a Ágora. Destila las "Mejoras sobre Ágora" de las fichas del configurador
> ([estaciones-y-pases](../09-referencia-configurador-agora/cocina/estaciones-y-pases.md),
> [notas-y-motivos](../09-referencia-configurador-agora/cocina/notas-y-motivos.md),
> [plantillas-comandas](../09-referencia-configurador-agora/cocina/plantillas-comandas.md),
> [monitores-cocina](../09-referencia-configurador-agora/cocina/monitores-cocina.md),
> [plantillas-ticket](../09-referencia-configurador-agora/administracion/plantillas-ticket.md))
> y la auditoría de operativa ([05 — Cocina/KDS/comanderas](../05-cocina-kds-y-comanderas/README.md),
> [04 — Impresión y tickets](../04-impresion-y-tickets/README.md)).
>
> **Nuestro estilo (la diferencia de fondo).** Donde Ágora configura listas y estilos
> manuales repetidos por terminal, Gluuh apuesta por: operativa **colorida y táctil**,
> **tiempo real** (Supabase Realtime / Socket.IO en LAN + PowerSync para offline), **failover
> en LAN aunque caiga internet**, y un **backoffice único** que configura todas las
> superficies sin desincronizarlas. Más intuitivo, y cada ajuste explica **para qué sirve**.

---

## Índice de mejoras

1. [Enrutado estación → impresora *o* KDS unificado](#1-enrutado-estación--impresora-o-kds-unificado)
2. [Cronómetros y alertas por color / SLA de serie](#2-cronómetros-y-alertas-por-color--sla-de-serie)
3. [Marchaje de pases desde la comandera, reflejado en KDS](#3-marchaje-de-pases-desde-la-comandera-reflejado-en-kds)
4. [Impresora + KDS como failover](#4-impresora--kds-como-failover)
5. [Notas de cocina con icono/atajo y derivadas de alérgenos](#5-notas-de-cocina-con-iconoatajo-y-derivadas-de-alérgenos)
6. [Motivos de cancelación con métrica](#6-motivos-de-cancelación-con-métrica)
7. [Los tres nombres por producto (carta / ticket / cocina)](#7-los-tres-nombres-por-producto-carta--ticket--cocina)
8. [Fuente extra-grande y alto contraste en la comanda](#8-fuente-extra-grande-y-alto-contraste-en-la-comanda)
9. [Bump bar y modo táctil](#9-bump-bar-y-modo-táctil)
10. [Métricas de tiempos de preparación](#10-métricas-de-tiempos-de-preparación)

---

## 1. Enrutado estación → impresora *o* KDS unificado

**Para qué sirve.** Que al **enviar una comanda** cada producto llegue solo a quien lo
cocina: las cervezas a la **barra**, las carnes a la **parrilla**, los postres a su
partida. La línea no debe verla cocina entera, solo la estación responsable. Es el
cimiento de todo lo demás (KDS por estación, impresión, SLA por estación).

**Cómo Ágora.** Dos taxonomías separadas — **Tipo de Preparación** (la *estación*: Barra,
Cocina, Tostadas) y **Orden de Preparación** (el *pase*: Bebidas, Primeros…). El enrutado a
**impresora** y la asignación a **monitor KDS** se configuran como mundos aparte, y hay que
repetir el mapeo estación → destino en cada terminal y en cada monitor. Es correcto pero
ceremonioso y propenso a desincronizarse.

**Cómo lo mejoramos.** Un **único mapa de enrutado** en el backoffice: cada estación apunta
a su **destino** (impresora *o* pantalla KDS *o* ambas), configurado una sola vez y
compartido por todos los terminales. Estación y pase viven como **enums compartidos en
`@gluuh/core`**, de modo que TPV, comandera, KDS e impresión usan los mismos valores y no
pueden divergir. El dato ya está modelado (`Producto.estacion`, `order_line.estacion` en
PowerSync); al crear cada línea se resuelve su estación desde el producto, el KDS se
**filtra por estación** y la impresión se **agrupa por estación → su impresora (IP/LAN)**.
Recomendación: normalizar la `text` libre actual a una tabla `station` por `tenant_id`.

```
Producto ──(config backoffice, 1 sola vez)──▶ ESTACIÓN
Al ENVIAR, el sistema divide la comanda por estación:
   Bebidas  ──▶ BARRA    → impresora 9100  y/o  KDS barra
   Carnes   ──▶ PARRILLA → KDS parrilla    (+ impresora respaldo)
   Postres  ──▶ POSTRES  → KDS postres
```

**Prioridad: 🔴 Alta** — es la base; sin enrutado real `/cocina` muestra "todo junto".

---

## 2. Cronómetros y alertas por color / SLA de serie

**Para qué sirve.** Que el cocinero vea **de un vistazo** qué comanda lleva esperando
demasiado y debe priorizar, sin leer relojes. El color comunica urgencia mejor que un
número.

**Cómo Ágora.** Ofrece **"Estilos Personalizados"**: reglas condicionales manuales del tipo
"si espera > 10 min → fondo rojo" que el instalador escribe a mano, monitor por monitor.
Potente, pero es trabajo de configuración y queda apagado si nadie lo monta.

**Cómo lo mejoramos.** **Semáforo de SLA de serie**, activo por defecto y configurable por
estación (no como estilo manual que hay que inventar). El código ya calcula los minutos
transcurridos sobre el `created_at` **del servidor** (no el reloj del dispositivo, que puede
ir desincronizado):

| Tramo | Color | Significado |
|---|---|---|
| 0–5 min | Verde | En tiempo |
| 5–10 min | Ámbar `#f59e0b` | Atención |
| > 10 min | Rojo | Fuera de SLA — prioridad |

Separamos además **color de estado** (qué fase: pendiente/en preparación/listo, ya en
`app/lib/estados.ts`) de **color de tiempo** (cuánto lleva): p. ej. **fondo** por estado +
**borde/halo** por SLA. Así un plato puede estar "en preparación" (fondo ámbar de estado) y
a la vez "fuera de SLA" (halo rojo de tiempo) sin que un color tape al otro.

**Prioridad: 🔴 Alta** — alto valor para reducir tiempos, y casi todo el cálculo ya existe.

---

## 3. Marchaje de pases desde la comandera, reflejado en KDS

**Para qué sirve.** El **marchaje** es la orden de la sala a cocina de **empezar** un pase:
los segundos no se preparan hasta que el camarero "marcha el pase 2" (cuando los comensales
casi han terminado los primeros). Evita que todo salga a la vez y se enfríe.

**Cómo Ágora.** El pase ("Orden de Preparación") tiene una casilla **Marchar** y opciones
*Iniciar preparación al marchar* / *al enviar a cocina*. La lógica existe, pero el marchaje
es una acción de configuración/terminal, no un gesto fluido reflejado en vivo.

**Cómo lo mejoramos.** **Marchaje con un toque desde la comandera**, reflejado en el KDS **en
tiempo real**. El pase nace **retenido**; al pulsar "Marchar pase 2", sus líneas pasan a
`PENDIENTE` y **aparecen en el KDS** con su `marchado_at` **reiniciando el cronómetro de
SLA** (§2) — el reloj cuenta desde que cocina debe empezar, no desde que se tomó la mesa.
Requiere la deuda priorizada en la auditoría: **estado por `order_line`** + un campo `pase`
(entero) en la línea. El aviso instantáneo viaja por la capa efímera (Socket.IO en LAN,
*objetivo*) y el dato durable por Realtime/PowerSync, de modo que aunque se pierda la
campana, la comanda marchada **sigue estando** en la cola.

```
Comandera:  [ Marchar ▶ pase 2 ]  ──(toque)──▶  líneas pase 2 → PENDIENTE
                                                 ⏱ SLA arranca de cero
            ───────── reflejo inmediato en LAN ─────────▶  KDS parrilla
```

**Prioridad: 🟡 Media** — gran valor en restaurante de mesa; depende del estado por línea.

---

## 4. Impresora + KDS como failover

**Para qué sirve.** Que **nunca se pierda una comanda** aunque la pantalla de cocina se
cuelgue, se quede sin luz o falle la red de ese equipo. La cocina no puede pararse porque
caiga un monitor.

**Cómo Ágora.** El monitor de cocina ya admite una **impresora de respaldo** ("Opciones de
Impresión": impresora + *imprimir al completar comanda* + *consolidar líneas"). Es un
respaldo pasivo: imprime según una regla, no reacciona a la caída de la pantalla.

**Cómo lo mejoramos.** Reforzar ese respaldo como **failover automático**: si la pantalla KDS
no confirma recepción (heartbeat) o cae, las comandas de esa estación se **desvían
automáticamente a su impresora** — preferiblemente **impresora de impacto** (Epson TM-U220B),
porque el papel **térmico se borra con el calor y el vapor** de la cocina. Todo el camino
crítico va por **LAN local** (RAW 9100): si se va la fibra, cocina sigue imprimiendo y el
KDS sigue funcionando contra el servidor local. La **cola de impresión es persistente** por
impresora con reintentos y backoff; si la cocina está offline, los tickets se acumulan y se
vacían al recuperar, sin duplicar (idempotencia por `id` de trabajo). La comanda de respaldo
se marca **"REIMPRESIÓN"** para que cocina no la prepare dos veces.

**Prioridad: 🟡 Media** — robustez clave en hora punta; el respaldo básico ya está en el modelo.

---

## 5. Notas de cocina con icono/atajo y derivadas de alérgenos

**Para qué sirve.** Las **notas de preparación** son las anotaciones de cocina de un toque
("poco hecho", "sin cebolla", "celíaco") que viajan en la comanda/KDS — no al ticket de
cliente. Agilizan al camarero y evitan errores de cocina.

**Cómo Ágora.** Catálogo de **Notas de Preparación** (53 registros) con Texto · Prioridad ·
Global · familias/categorías asociadas, y estilo (color/imagen). Se **filtran por familia**:
al vender un filete (`PUNTOS CARNE`) salen "poco hecho/al punto/muy hecho"; al vender un
café, "sin azúcar/doble azúcar". Muy completo, pero el orden y la presentación son manuales y
no hay vínculo con los alérgenos.

**Cómo lo mejoramos.** Tres saltos de usabilidad:

- **Icono/atajo por nota** y **orden por uso real** (las más pulsadas primero), no por
  prioridad fija escrita a mano — la carta de notas se autoajusta a cómo trabaja el local.
- **Derivar notas de alérgenos**: "CELIACO" queda **ligado al alérgeno gluten**, de modo que
  marcar la nota y declarar el alérgeno son coherentes y no se contradicen. En la comanda y
  el KDS los alérgenos se **resaltan** (rojo en impresora de impacto a 2 colores).
- Mantener el **filtrado por familia/categoría** (gran acierto de Ágora) y el toggle de
  mostrar la nota online (carta digital / pedido en mesa / delivery).

**Prioridad: 🟡 Media** — mejora de calidad y seguridad alimentaria sobre una base que Ágora ya tiene bien.

---

## 6. Motivos de cancelación con métrica

**Para qué sirve.** Registrar **por qué** se anula una línea ("SALE TARDE", "FRÍO", "NO LO HA
PEDIDO"), avisar a cocina de que no la prepare, y descontar stock como merma cuando proceda.
Y, sobre todo, **convertir las anulaciones en información de gestión**.

**Cómo Ágora.** Catálogo de **Motivos de Cancelación** con *Generar Merma* + *Imprimir
cancelación en cocina*, ligado a "solicitar motivo al cancelar líneas preparadas o
impresas". Alimenta el informe de cancelaciones por usuario del Cierre Z. Sólido en lo
operativo.

**Cómo lo mejoramos.** Dos vueltas de tuerca:

- **Motivo obligatorio según permiso** al cancelar líneas ya impresas/preparadas (no se anula
  "en silencio"); con **aviso a cocina** para que la partida pare el plato.
- **Métrica de motivos** para **detectar problemas**: muchos "FRÍO" → revisar tiempos de la
  estación; muchos "SALE TARDE" → cuello de botella en un pase. La cancelación deja de ser
  solo una merma contable y pasa a ser un **indicador de cocina**, cruzable con el SLA (§2) y
  los tiempos de preparación (§10).

**Prioridad: 🟢 Baja-Media** — valor de gestión; la base operativa de Ágora ya cubre lo imprescindible.

---

## 7. Los tres nombres por producto (carta / ticket / cocina)

**Para qué sirve.** Un mismo plato se **nombra distinto** según quién lo mira, y cada
audiencia necesita lo suyo: el camarero quiere el nombre comercial, el cliente uno legible en
el ticket, y el cocinero uno **corto y en mayúsculas** que lea de un vistazo (incluso en otro
idioma del personal de cocina).

- **`nombre_carta`** — pantalla/TPV: *"Pizza Margarita Artesana 32cm"*.
- **`nombre_ticket`** — ticket de cliente/factura: *"Pizza Margarita"*.
- **`nombre_cocina`** — comanda/impresora/KDS: *"MARGARITA 32"*.

**Cómo Ágora.** Existe el "Texto para comanda" del producto (el nombre de cocina), que la
plantilla de comandas usa. Cubre el caso, pero como campo suelto sin una resolución
centralizada de los tres nombres.

**Cómo lo mejoramos.** `nombre_carta` **obligatorio**; `nombre_ticket` y `nombre_cocina`
**opcionales con fallback**, resuelto en **un único sitio** (función SQL `nombre_para(p,
destino)` + su espejo TS `nombrePara`) para que pantalla, ticket y cocina **nunca se
desincronicen**. El alta de un producto sigue siendo de un solo campo; los nombres
específicos se añaden solo cuando aportan (platos largos, cocina con personal extranjero,
marca comercial). El KDS y la comanda impresa consumen siempre `nombrePara(producto,
"cocina")`.

**Prioridad: 🟡 Media** — claridad operativa con coste bajo; el fallback evita fricción en el alta.

---

## 8. Fuente extra-grande y alto contraste en la comanda

**Para qué sirve.** La comanda se lee **con prisa, con vapor y a distancia**. La legibilidad
no es estética: un nombre mal leído es un plato mal hecho.

**Cómo Ágora.** La **Plantilla de Comandas** ya prioriza la legibilidad: fuente **Grande**,
ancho 32/42/48 columnas, agrupación por producto, separación por pase/estación, sin precios
ni QR (la cocina no los necesita). Es una buena base.

**Cómo lo mejoramos.**

- **Fuente extra-grande y alto contraste por defecto** (no "grande" opcional) — pensado para
  cocina real.
- **Separación automática por estación** además de por pase, para que **cada partida vea solo
  lo suyo** sin configurarlo a mano.
- **La misma plantilla sirve para impresora y KDS**: una sola config de comanda, coherencia
  visual entre papel y pantalla, en vez de dos configuraciones separadas que divergen.

```
================================================
            MESA 12   ***  PASE 1  ***
------------------------------------------------
 Estacion: PARRILLA            Comensales: 3
 2x  ENTRECOT 300                  (C2)
       > al punto    > +salsa pimienta
 !! ALERGIA: FRUTOS SECOS (mesa) !!   (rojo)
================================================
```

**Prioridad: 🟢 Baja-Media** — pulido sobre algo que Ágora ya hace razonablemente bien.

---

## 9. Bump bar y modo táctil

**Para qué sirve.** Que el cocinero **avance comandas con las manos ocupadas o sucias**, sin
buscar botones pequeños en una pantalla. El *bump bar* es la barra física de teclas que
"baja" (bump) la comanda terminada.

**Cómo Ágora.** El monitor define botones de partida (iniciar / finalizar / servir / imprimir
orden) y un modo de visualización (clásico / columnas / tarjetas). Orientado a ratón/táctil
clásico, sin ergonomía específica de cocina.

**Cómo lo mejoramos.**

- **Bump bar (teclado HID estándar)**: no necesita driver — se captura `keydown` y se mapea
  (`Enter` = bump/listo, flechas = navegar, una tecla = recuperar/deshacer bump). Es la
  mejora de **mayor ratio valor/esfuerzo** para cocina.
- **Modo táctil grande**: tarjetas amplias, botones gruesos, dos vistas — **por estación**
  (el cocinero de la partida ve solo lo suyo) y **por pase/línea caliente** (el jefe de
  cocina "canta" el pase agrupado por mesa).
- **Aviso sonoro** en comanda nueva y **recuperar** comanda (retroceso `LISTO →
  EN_PREPARACION`) para deshacer un bump por error.

```
Bump bar:  ◀ prev   ▶ next   ⮐ bump(listo)   ↺ recuperar
```

**Prioridad: 🔴 Alta** — máxima ergonomía para cocina; bajo esfuerzo técnico.

---

## 10. Métricas de tiempos de preparación

**Para qué sirve.** Saber **cuánto tarda cada plato y cada estación**, para dimensionar
turnos, detectar cuellos de botella y poner SLA realistas. Lo que no se mide no se mejora.

**Cómo Ágora.** No ofrece métricas de tiempos de cocina de serie; los "estilos
personalizados" reaccionan al tiempo en pantalla pero no lo **registran** para informar.

**Cómo lo mejoramos.** Registrar `tiempo_prep = listo_at − created_at` (con `marchado_at`
para pases marchados, §3) por **línea y estación**, y un **histórico del turno** (comandas
`ENTREGADO` del día). Con eso: tiempo medio por estación, P95, comparativa de pases, y cruce
con los motivos de cancelación (§6) y el semáforo de SLA (§2) para afinar los tramos de color
a la realidad del local. Alimenta el roadmap de la fase Escala. Todo se calcula sobre marcas
de tiempo del **servidor** (BD), no del dispositivo.

**Prioridad: 🟢 Baja (fase Escala)** — alto valor analítico, pero después de tener el dato por línea y el KDS por estación.

---

## Tabla resumen

| # | Mejora | Para qué sirve (en una línea) | Cómo Ágora | Cómo lo mejoramos | Prioridad |
|---|--------|-------------------------------|------------|-------------------|:---------:|
| 1 | **Enrutado estación → impresora *o* KDS unificado** | Cada producto solo a quien lo cocina | Estación y pase separados, mapeo repetido por terminal/monitor | Mapa único de enrutado + enums compartidos en `@gluuh/core`; `station` por tenant | 🔴 Alta |
| 2 | **Cronómetro y alertas por color / SLA** | Ver urgencias de un vistazo | "Estilos personalizados" manuales por monitor | Semáforo de SLA de serie por estación; color de estado vs color de tiempo | 🔴 Alta |
| 3 | **Marchaje de pases desde la comandera** | Que cada pase se cocine cuando toca | Casilla "Marchar" en config del pase | Toque en comandera → KDS en tiempo real; SLA arranca al marchar; estado por línea + `pase` | 🟡 Media |
| 4 | **Impresora + KDS como failover** | No perder comandas si cae la pantalla | Impresora de respaldo pasiva | Failover automático a impresora de impacto en LAN; cola persistente + reintentos | 🟡 Media |
| 5 | **Notas de cocina con icono/atajo y alérgenos** | Anotar cocina de un toque, sin errores | Notas filtradas por familia, orden/estilo manual | Icono/atajo, orden por uso real, derivadas de alérgenos | 🟡 Media |
| 6 | **Motivos de cancelación con métrica** | Saber por qué se anula y detectar problemas | Catálogo + merma + Cierre Z | Motivo obligatorio por permiso + métrica (muchos "FRÍO" = revisar tiempos) | 🟢 Baja-Media |
| 7 | **Tres nombres por producto** | Cada audiencia ve el nombre que necesita | "Texto para comanda" suelto | `nombre_carta` obligatorio + ticket/cocina con fallback centralizado (SQL + TS) | 🟡 Media |
| 8 | **Fuente extra-grande en la comanda** | Leer con prisa, vapor y distancia | Plantilla de comandas, fuente "Grande" | Extra-grande/alto contraste por defecto; misma plantilla papel + KDS | 🟢 Baja-Media |
| 9 | **Bump bar y modo táctil** | Avanzar comandas con manos ocupadas | Botones de partida, modo clásico | Bump bar HID sin driver, táctil grande, sonido, recuperar; vista estación y pase | 🔴 Alta |
| 10 | **Métricas de tiempos de preparación** | Medir para mejorar y dimensionar | Sin métricas de serie | `tiempo_prep` por línea/estación, histórico de turno, cruce con SLA y cancelaciones | 🟢 Baja (Escala) |

---

## Orden de ataque recomendado

1. **Enrutado por estación real** (#1) — habilita KDS por estación, impresión dividida y SLA por estación.
2. **Bump bar + sonido + SLA por colores** (#9, #2) — máxima ergonomía y reducción de tiempos, bajo esfuerzo.
3. **Estado por `order_line` + `pase`** → desbloquea **marchaje** (#3), 86 parcial y métricas por línea (#10).
4. **Failover impresora+KDS** (#4) y **tres nombres** (#7) — robustez y claridad.
5. **Notas con alérgenos** (#5) y **métrica de cancelaciones** (#6) — calidad y gestión.
6. **Métricas de tiempos** (#10) — fase Escala, sobre el dato por línea ya disponible.

> Todo sobre **LAN del local**: comandar, enrutar, imprimir y mostrar en KDS **funcionan
> aunque caiga internet**; PowerSync sincroniza con la nube al reconectar. Ese es el rasgo que
> nos separa de un TPV atado a la conexión.
