# Mejoras 01 — Diseño y Experiencia (TPV Gluuh vs Ágora)

> Consolida las mejoras de **diseño y experiencia** de Gluuh frente a Ágora. Ágora es potente
> pero **denso y técnico**: muchos perfiles fijos, listados sin reordenar visualmente, salas como
> listas, una pantalla "Editar Local" que es la más densa del producto. Gluuh apuesta por lo
> contrario: **más intuitivo, visual y configurable sin migraciones**, con **una sola base de
> código en dos niveles** (backoffice y operativa). Cada sección sigue el patrón
> **Para qué sirve · Cómo lo hace Ágora · Cómo lo mejoramos · Prioridad**.

Fichas fuente:
[planos-mesas](../09-referencia-configurador-agora/herramientas/planos-mesas.md) ·
[configuracion-botones](../09-referencia-configurador-agora/herramientas/configuracion-botones.md) ·
[ordenar-productos](../09-referencia-configurador-agora/herramientas/ordenar-productos.md) ·
[acciones-personalizadas](../09-referencia-configurador-agora/herramientas/acciones-personalizadas.md) ·
[administracion-web](../09-referencia-configurador-agora/administracion/administracion-web.md) ·
[usuarios-y-perfiles](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md) ·
[locales](../09-referencia-configurador-agora/administracion/locales.md) ·
[02 — Interfaz táctil](../02-interfaz-tactil/README.md).

---

## 1. Sistema de diseño: dos niveles, una base de código

**Para qué sirve.** El mismo software se usa en dos contextos opuestos: **gestionar "desde casa"**
(ratón, teclado, mucha información por pantalla) y **operar en el local** (de pie, con prisa, a una
mano, a veces con guantes o las manos mojadas). Un único estilo no sirve a los dos: el backoffice
optimiza *información por píxel*, la operativa optimiza *aciertos por segundo*.

**Cómo lo hace Ágora.** Una estética uniforme y técnica para todo. La administración web es densa
y orientada a usuario experto; la operativa hereda esa lógica de configuración. No hay una
separación de diseño declarada entre "configurar" y "operar".

**Cómo lo mejoramos.** Dos niveles explícitos que comparten *tokens de marca* pero **no** escala
tipográfica ni tamaños de control ([02 §1](../02-interfaz-tactil/README.md#1-dos-mundos-de-diseño-recordatorio)):

| Nivel | Superficies | Estética | Densidad | Control |
|-------|-------------|----------|----------|---------|
| **(A) Backoffice** | `app/(panel)/*` | Supabase/Notion: oscuro, verde `#34B27B`, plano, componentes shadcn | Alta: `text-[12px]`, filas `py-1.5` | Ratón + teclado |
| **(B) Operativa** | `/tpv` `/comandera` `/kds` `/pantalla` `/kiosko` | Colorida, **marca del cliente**, alto contraste, pantalla completa | Baja: `text-[16px]+`, botones `h-16`+ | Dedo |

La marca del cliente tiñe la operativa (logo, color primario); el backoffice mantiene el verde
Gluuh para que el gestor reconozca "su herramienta". **Una sola base de código React**, dos
sistemas de tokens.

**Prioridad: alta** (es la decisión raíz de la que cuelga todo lo demás).

---

## 2. Navegación del backoffice (clara, no un menú denso)

**Para qué sirve.** Encontrar rápido lo que se quiere configurar o consultar. El backoffice tiene
decenas de pantallas (catálogo, salas, usuarios, fiscalidad, informes, ajustes); si el menú es un
árbol largo y técnico, el gestor se pierde.

**Cómo lo hace Ágora.** Menú denso con muchas entradas técnicas al mismo nivel. La pantalla
"Editar Local" llega a ser **la más densa del producto** ([locales](../09-referencia-configurador-agora/administracion/locales.md)),
con ~12 bloques heterogéneos (pasarela, series, propinas, stock, cierre Z…) apilados sin jerarquía
clara. La meta-config del propio backoffice (idioma, logo, "Nº Max 20000") convive con la del
negocio ([administracion-web](../09-referencia-configurador-agora/administracion/administracion-web.md)).

**Cómo lo mejoramos.**

- **Sidebar agrupado por intención**, no por entidad: *Catálogo · Sala y mesas · Personas y
  permisos · Fiscalidad (VERIFACTU/IGIC) · Informes · Ajustes*. Buscador global (⌘K) que salta a
  cualquier pantalla u opción de `setting`.
- **Romper "Editar Local"** en pestañas digeribles con texto de ayuda por bloque; la meta-config
  del backoffice (logo, idioma) se unifica con la **marca del local**, no como ajuste aparte
  ([administracion-web →](../09-referencia-configurador-agora/administracion/administracion-web.md)).
- **Paginación + búsqueda server-side** en listados (Next.js): se elimina el tope duro
  "Nº Max 20000" — no se cargan 20k filas en el navegador.

**Prioridad: alta.**

---

## 3. Editor de plano de sala: drag-and-drop sobre SVG (vs lista)

**Para qué sirve.** Reproducir la disposición real del local (mesas, barra, terraza, decoración) y
enlazar cada mesa a su **ubicación numerada**, de modo que el camarero vea en operativa el **mismo
plano** con el estado en tiempo real de cada mesa. El usuario marca esta pieza como **clave para
replicar igual o mejor** ([planos-mesas](../09-referencia-configurador-agora/herramientas/planos-mesas.md)).

**Cómo lo hace Ágora.** Sí tiene editor gráfico: lienzo con rejilla, catálogo de elementos (mesas
redondas/cuadradas/rectangulares con 2/4/6/8 sillas, barra, billar, plantas, paredes), ~30 tipos de
suelo, y asignación de ubicación al colocar la mesa. Es bueno, pero **rasterizado** (pixela al
escalar) y con un flujo de diálogos encadenados.

**Cómo lo mejoramos.**

- **Lienzo SVG/Canvas con drag-and-drop real** (`dnd-kit`/`react-konva`): arrastrar, redimensionar,
  rotar, **snap a rejilla**; se guarda `{x, y, w, h, rot, z}` por elemento.
- **Catálogo de elementos vectorial (SVG)**: escala sin pixelar y **se tiñe con el color de marca**
  del local. Mesa = componente enlazado a `location_table`.
- **El plano de config y el plano operativo son el MISMO componente**: en operativa pinta el estado
  en tiempo real (libre/ocupada/por cobrar/atención) vía Supabase Realtime/PowerSync; tocar una
  mesa abre/retoma su ticket ([02 §4.1](../02-interfaz-tactil/README.md)).
- **Mejoras netas sobre Ágora**: capacidad/comensales por mesa, **QR por mesa** (Scan&Pay),
  unir/separar mesas y mover comanda arrastrando, **heatmap de ocupación/rotación** para informes,
  y **plantillas de sala** predefinidas.

> Modelo sin migración por opción: `floor_plan` (por centro de venta) + `floor_plan_element`
> (con `location_table_id` cuando es mesa). Ver
> [planos-mesas §Mapeo](../09-referencia-configurador-agora/herramientas/planos-mesas.md#mapeo-a-nuestro-modelo).

**Prioridad: alta** (pieza estrella, hoy la operativa pinta salas pero no hay editor gráfico).

---

## 4. Botonera responsive (vs perfiles fijos por dispositivo)

**Para qué sirve.** Que los botones del TPV/comandera tengan el tamaño y densidad adecuados a cada
terminal: móvil/comandera → **botones grandes** (dedo, prisa); TPV de mostrador → **medianos** (más
densidad en pantalla grande).

**Cómo lo hace Ágora.** **Perfiles fijos** de layout que el gestor crea y asigna por punto de venta
(`Smartphone/Grandes`, `Tablet/Grandes`, `Básica-TPV WEB/Medianos`…). Cada cambio de terminal pide
mantener un perfil más ([configuracion-botones](../09-referencia-configurador-agora/herramientas/configuracion-botones.md)).

**Cómo lo mejoramos.**

- **Responsive automático**: un layout que **adapta columnas y tamaño al viewport** respetando los
  mínimos táctiles (≥ 64 px en lo frecuente, [02 §2.1](../02-interfaz-tactil/README.md)). Menos
  configuración manual: un layout, muchos tamaños.
- **Favoritos y reordenación** por el propio usuario (drag-drop) sin bajar de los mínimos táctiles.
- **Modo alto contraste / texto grande** integrado para sol y accesibilidad.

> Lo que en Ágora son N perfiles, aquí es **un `setting` `scope=DEVICE`** que solo afina lo que el
> automático no resuelva (p. ej. fijar "grandes" en una comandera concreta).

**Prioridad: media.**

---

## 5. Ordenar productos y familias: drag-and-drop táctil (vs ↑/↓)

**Para qué sirve.** Fijar el **orden de aparición** en la pantalla de venta. El orden importa para
la **velocidad**: lo más vendido, primero, a ≤ 2 toques.

**Cómo lo hace Ágora.** Tres herramientas con el mismo patrón (productos en categoría, productos en
familia, familias/categorías por grupo de TPV): lista reordenable con **↑/↓** + "Ordenar por
Id/Nombre" + Aplicar ([ordenar-productos](../09-referencia-configurador-agora/herramientas/ordenar-productos.md)).

**Cómo lo mejoramos.**

- **Drag-and-drop táctil** real (no solo ↑/↓), con **vista previa de la rejilla del TPV** mientras
  ordenas — ves cómo quedará la botonera.
- **Orden por uso** con un clic: sugerir el orden según ventas (lo más vendido arriba).
- **Orden por franja horaria** (desayunos arriba por la mañana) reutilizando periodos de servicio.

**Prioridad: media.**

---

## 6. Acciones personalizadas y cobro de un toque

**Para qué sirve.** Botones de acción en el TPV: **cobro directo** con un medio concreto (sin pasar
por el selector → cobro de un toque, clave de velocidad) o **abrir una URL/app** externa (reservas,
fidelización, balanza).

**Cómo lo hace Ágora.** Lista de acciones (Texto · Tipo · Valor) con icono por tema (claro/oscuro),
permiso por rol y flag "mostrar URL en diálogo Ágora" (in-app vs externo)
([acciones-personalizadas](../09-referencia-configurador-agora/herramientas/acciones-personalizadas.md)).

**Cómo lo mejoramos.**

- Cobro directo con **propina rápida** y apertura de cajón **configurable por acción**.
- Acciones que llaman a **nuestras propias rutas** (abrir KDS, reimprimir, llamar a cocina), no solo
  URLs externas.
- **Color de marca** y posición/orden en la botonera, además del icono por tema que ya tiene Ágora.

**Prioridad: media.**

---

## 7. Vista previa en vivo

**Para qué sirve.** Que el gestor **vea el resultado mientras configura**, sin tener que ir a un
terminal real a comprobarlo. Reduce el ensayo-error y el miedo a "tocar algo".

**Cómo lo hace Ágora.** Configuración y resultado están **separados**: se ajusta en la web y se
comprueba en el TPV. No hay previsualización fiel del layout operativo dentro del configurador.

**Cómo lo mejoramos.** Como la operativa y el configurador **comparten componentes**, el backoffice
embebe una **vista previa real** del TPV/plano/botonera que refleja cada cambio al instante
(grid de productos, orden, plano de sala, plantilla de ticket asignada a un modo de venta). El
gestor configura con la marca del cliente ya aplicada y ve exactamente lo que verá el camarero.

**Prioridad: media.**

---

## 8. Asistentes y valores por defecto (no empezar de cero)

**Para qué sirve.** Que poner en marcha un local sea cuestión de minutos, no de rellenar decenas de
pantallas técnicas en blanco.

**Cómo lo hace Ágora.** Configuración granular pero **desde cero**: el gestor crea perfiles de
usuario, series, layouts, etc., sin plantillas de partida claras. La potencia se paga en tiempo de
puesta en marcha.

**Cómo lo mejoramos.**

- **Perfiles RBAC predefinidos** (Administrador / Encargado / Camarero / Informes) listos para
  **clonar y ajustar** ([usuarios-y-perfiles →](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md#mejoras-sobre-ágora)).
- **Plantillas de sala** y **botoneras por tipo de negocio** (cafetería / restaurante / fast-food).
- **Asistente de alta de local**: marca + IGIC/IVA según territorio + series + VERIFACTU en pocos
  pasos, con **defaults sensatos** y validados (p. ej. límite legal de factura simplificada).
- **Defaults pre-marcados** también en operativa: los modificadores obligatorios llevan un valor por
  defecto, de modo que "aceptar" sea un toque ([02 §8](../02-interfaz-tactil/README.md)).

**Prioridad: alta** (define la percepción de "fácil" frente a Ágora).

---

## 9. "Todo configurable" sin migraciones — modelo `setting`

**Para qué sirve.** Permitir que cada negocio (y cada local, y cada dispositivo) ajuste el
comportamiento sin que cada opción nueva implique tocar el esquema de base de datos ni desplegar
una migración.

**Cómo lo hace Ágora.** "Editar Local" mezcla ~12 bloques globales en una pantalla; muchos ajustes
viven como columnas/entidades específicas. Añadir una opción nueva tiende a requerir cambios de
modelo ([locales](../09-referencia-configurador-agora/administracion/locales.md)).

**Cómo lo mejoramos.** Casi todo es **una fila en `setting`** clave/valor por `tenant_id`, con
**ámbito** y herencia:

```
scope:  GLOBAL  →  LOCAL  →  DEVICE
resolución efectiva: DEVICE > LOCAL > GLOBAL > default
```

- **GLOBAL**: comportamiento por defecto del negocio (propinas, recargo por servicio, operativa de
  venta, cierre Z, VERIFACTU).
- **LOCAL**: override puntual para un local con `location_id` (p. ej. una pasarela distinta).
- **DEVICE**: afinado por terminal (p. ej. serie de numeración por TPV para cobro offline sin
  pelear el número, o tamaño de botón concreto).

**Ventaja decisiva**: añadir una opción = **insertar una clave**, no migrar el esquema. El multi-
local hereda lo global y sobrescribe solo donde haga falta. Ver
[locales §Decisión de modelado](../09-referencia-configurador-agora/administracion/locales.md#decisión-de-modelado-ámbito-global-no-por-local).

**Prioridad: alta** (habilita "todo configurable" sin coste de migración).

---

## 10. Accesibilidad táctil

**Para qué sirve.** Que la operativa funcione **de pie, con prisa, a una mano, con guantes, al sol**
y para personas con baja visión o daltonismo — sin toques fallidos ni comandas erróneas.

**Cómo lo hace Ágora.** Botones grandes en comanderas y tamaño por perfil, pero los mínimos
táctiles y la accesibilidad no están formalizados como sistema.

**Cómo lo mejoramos** (decisiones de [02 §2, §9–§11](../02-interfaz-tactil/README.md)):

- **Objetivo táctil ≥ 64 px** en lo frecuente (producto), 56 px acción, **nunca < 48 px**;
  separación ≥ 8 px (≥ 16 px junto a acciones destructivas).
- **Sin `:hover`, sin dobles toques, sin gestos ocultos**: `touch-manipulation`, gesto = atajo
  con botón visible de respaldo.
- **Feedback < 100 ms** (`active:scale-95`, háptico opcional) y **UI optimista / offline-first**:
  nunca bloquear esperando la red.
- **Estado = icono + texto + color** (nunca solo color: daltonismo + reflejos), cronómetros con
  `tabular-nums`.
- **Contraste alto** (AA ≥ 4.5:1; verificar texto sobre el verde de marca), **modo alto contraste**
  para exterior y **modo zurdo** (espejar botonera).

**Prioridad: alta** (es el núcleo de "que el TPV vaya perfecto").

---

## 11. Explicar "para qué sirve" en la propia UI

**Para qué sirve.** Que el gestor entienda cada opción sin manual. Ágora es **potente pero
técnico**: muchos ajustes sin explicación contextual obligan a saber de antemano qué hacen.

**Cómo lo hace Ágora.** Etiquetas técnicas escuetas (p. ej. "Calcular sobre: Impuestos incluidos",
"Nº Max 20000") sin ayuda inline sobre el efecto real.

**Cómo lo mejoramos.** Cada ajuste lleva **microcopy de propósito** ("Para qué sirve") junto al
control: una línea que dice qué cambia y dónde se nota, con enlace a más detalle. Los bloques
sensibles (series, VERIFACTU, importe máximo de factura simplificada) **avisan** de implicaciones
legales y **validan** contra los límites (400 €/3.000 €). Tono claro, en español, sin jerga.

**Prioridad: media** (gran impacto en la percepción de intuitividad, bajo coste por pantalla).

---

## Tabla resumen

| # | Mejora | Para qué sirve | Salto sobre Ágora | Prioridad |
|---|--------|----------------|-------------------|:--------:|
| 1 | Dos niveles, una base de código | Gestionar vs operar con el diseño adecuado | Separación formal backoffice/operativa | **Alta** |
| 2 | Navegación del backoffice | Encontrar rápido sin menú denso | Agrupar por intención + ⌘K; romper "Editar Local" | **Alta** |
| 3 | Editor de plano DnD sobre SVG | Diseñar sala y verla en operativa en vivo | Vectorial, mismo componente, QR/heatmap/plantillas | **Alta** |
| 4 | Botonera responsive | Botones del tamaño justo por terminal | Auto-adaptación vs perfiles fijos | Media |
| 5 | Ordenar con DnD táctil | Lo más vendido primero (velocidad) | Drag-drop + preview + orden por uso/hora | Media |
| 6 | Acciones personalizadas | Cobro de un toque / lanzar apps | Propina/cajón por acción, rutas propias, marca | Media |
| 7 | Vista previa en vivo | Configurar viendo el resultado | Preview real embebida (componentes compartidos) | Media |
| 8 | Asistentes y defaults | Puesta en marcha en minutos | Perfiles/plantillas/wizard listos para clonar | **Alta** |
| 9 | `setting` GLOBAL/LOCAL/DEVICE | Todo configurable sin migrar | Insertar clave, no migrar esquema; herencia | **Alta** |
| 10 | Accesibilidad táctil | Que el TPV vaya perfecto con prisa/guantes/sol | Mínimos 64 px, sin hover, optimista, no-solo-color | **Alta** |
| 11 | "Para qué sirve" en la UI | Entender sin manual | Microcopy de propósito + validación legal inline | Media |

> **Decisión transversal.** Gluuh no copia a Ágora opción por opción: copia su **potencia** y la
> envuelve en una experiencia **más visual, más intuitiva y configurable sin migraciones**. La clave
> técnica que lo hace barato es doble: **una sola base de código en dos niveles** (componentes
> compartidos entre configurar y operar) y el **modelo `setting` con ámbito GLOBAL/LOCAL/DEVICE**.
