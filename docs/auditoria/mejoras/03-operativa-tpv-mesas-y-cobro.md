# 03 — Operativa TPV, mesas y cobro: cómo superamos a Ágora

> Destilación de las **"Mejoras sobre Ágora"** de las fichas de sala, modos de venta, formas de pago,
> pasarela, control de efectivo, acciones personalizadas y clientes
> ([`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/)), reescritas con
> **nuestra dirección de diseño**: operativa **colorida con la marca del cliente**, táctil, rápida y
> **offline‑first**; backoffice **Supabase/Notion** para configurarlo todo. Más intuitivo, todo
> configurable, y **explicando para qué sirve cada cosa**.
>
> Base táctil: [`../02-interfaz-tactil/README.md`](../02-interfaz-tactil/README.md) (presupuesto de
> toques, estados de mesa, ergonomía). Patrón de cada bloque:
> **Para qué sirve · Cómo lo hace Ágora · Cómo lo mejoramos · Prioridad**.

---

## Principio rector de esta área

El TPV se usa **de pie, con prisa, a una mano**. Por eso toda esta área se mide en **aciertos por
segundo**, no en información por pixel. Tres decisiones cruzan todo el documento:

1. **Un solo componente de sala**: el editor de plano del backoffice y el plano operativo del TPV son
   **el mismo render** con dos modos (diseño / tiempo real). No se mantienen dos vistas.
2. **Offline‑first sin excusas**: el cobro, la comanda y la emisión VERIFACTU funcionan sin internet;
   la red es una optimización, nunca un bloqueo (serie por terminal → sin colisiones).
3. **Todo configurable sin migrar**: casi cada flag vive en `setting` por ámbito
   `GLOBAL > LOCAL > DEVICE`, no como columna nueva. Añadir una opción es insertar una clave.

---

## 1. Plano de sala operativo = el mismo componente que el editor ★★

**Para qué sirve.** Que el camarero vea la sala **tal cual es** (la disposición real de mesas, barra,
terraza) con el **estado de cada mesa en tiempo real** y abra/retome su comanda de un toque. Es la
pantalla que el cliente marca como **clave para replicar igual o mejor**.

**Cómo lo hace Ágora.** El editor "Planos de Mesas" es un lienzo con rejilla donde se colocan mesas,
barra, paredes, plantas y ~30 texturas de suelo, y cada mesa se enlaza a una **ubicación** numerada de
un Centro de Venta. En operativa, el camarero ve ese plano con el estado de la mesa. El editor y el
plano operativo son piezas separadas; el catálogo de elementos es de bitmaps fijos.

**Cómo lo mejoramos.**

- **Mismo componente, dos modos.** Un lienzo **SVG/Canvas con drag‑and‑drop** (`dnd-kit` /
  `react-konva`): arrastrar, redimensionar, rotar y *snap* a rejilla. El **plano de configuración** y
  el **plano operativo** son el mismo render; en operativa pinta el **estado en tiempo real**
  (libre / ocupada / por cobrar / atención) vía Supabase Realtime/PowerSync. Una mesa = un componente
  enlazado a `location_table` — se diseña una vez, se reutiliza en TPV y comandera.
- **Estados por color + icono + cronómetro** (nunca solo color): Libre (verde), Ocupada (ámbar +
  importe + ⏱), Por cobrar (rojo + total), Atención (pulso si lleva mucho sin actividad). Ver
  [02 §9.1](../02-interfaz-tactil/README.md).
- **Unir / separar mesas** y **mover comanda** entre mesas con arrastrar‑soltar (mesa de 2 que se junta
  con la de al lado; trasladar la cuenta a otra mesa sin re‑teclear). Ágora obliga a flujos de menú;
  nosotros, un gesto con botón visible de respaldo.
- **Capacidad / comensales por mesa**: cada mesa sabe cuántos caben y cuántos hay sentados; alimenta el
  bloque "datos de comensales" del cierre Z y el control de aforo.
- **QR por mesa** generado por el sistema: el cliente lo escanea para **Pedido en Mesa** o **Scan&Pay**
  (§3). Ágora no lo da por mesa de serie.
- **Catálogo de elementos en SVG vectorial**, tintable con la **marca del cliente** (no bitmaps): mesas
  redondas/cuadradas/rectangulares de 2/4/6/8 sillas, barra, paredes, decoración. Escala sin pixelar en
  TPV de 15" y en tablet de comandera; zoom y paneo con gestos.
- **Multi‑zona** (un plano por Centro de Venta) con pestañas; **plantillas de sala** predefinidas para
  arrancar rápido.
- **Heatmap de ocupación/rotación** para informes — qué mesas rotan más, dónde está el cuello.

**Prioridad: 🔴 Alta.** Es la pieza señalada como crítica. Hoy la operativa pinta salas pero **sin
editor gráfico ni el modelo `floor_plan`/`floor_plan_element`**.

---

## 2. Centros de venta (zonas) con tarifa, almacén e impresoras propias

**Para qué sirve.** Una sala, barra o terraza con su **lista de precios**, su **almacén** del que
descuenta stock, sus **ubicaciones/mesas** y sus **impresoras**. Es el nivel entre el negocio y la mesa.

**Cómo lo hace Ágora.** "Centro de Venta" con tarifa, almacén, grupo inicial de productos, "pedir
comensales" (Nunca/Siempre/Preguntar), color/prioridad, lista de ubicaciones e impresoras por tipo de
documento. Para catering, modela cada franja horaria como un centro distinto (C‑09:40, C‑10:00…), un
apaño que multiplica registros.

**Cómo lo mejoramos.**

- **Plano visual** de mesas (arrastrar/soltar, unir/separar) en lugar de una lista plana de ubicaciones
  (§1).
- Centro de venta = nuestro **multi‑local/zona real**: cada uno hereda lo **global** y sobrescribe lo
  que necesite (tarifa, almacén, impresoras). Sin duplicar config.
- Las "franjas como centro" de Ágora las modelamos mejor con **periodos de servicio** (horarios) sobre
  **un único** centro de cafetería — menos ruido, mismo resultado.
- Impresoras en **dos niveles** (centro y terminal) con herencia: el terminal usa las del centro salvo
  override.

**Prioridad: 🟡 Media.** La operativa pinta salas, pero falta el modelo de centro con
tarifa/almacén/impresoras como configurador.

---

## 3. Modos de venta con estados en tiempo real para el cliente ★

**Para qué sirve.** Cada forma de pedir tiene su flujo: **Scan&Pay** (QR, el cliente pide y paga),
**Pedido en Mesa**, **Delivery** y **Take Away**. Define quién cobra, con qué medio, qué tarifa, si va
a cocina y qué se notifica.

**Cómo lo hace Ágora.** "Configuración de Pago y Pedidos": por cada tipo se fija TPV, usuario, forma de
pago y tarifa; Scan&Pay permite **dividir cuenta**; Pedido en Mesa pide comensales y elige *pagar al
finalizar / más tarde*; Delivery añade zonas de reparto (coste, mínimo, tiempo), horarios con tope de
pedidos/15 min, y **notificaciones por email** con cabecera/pie. Cada modo dispara cocina, cobro y
factura según corresponda.

**Cómo lo mejoramos.**

- **Estados en tiempo real para el cliente** (recibido → en preparación → en camino → entregado / listo
  para recoger) por **web/push y pantalla de cliente**, no solo email. El mismo estado que ve el KDS lo
  ve el cliente (Supabase Realtime).
- **Activar/desactivar cada modo con un switch** por local, con su **plantilla de ticket** asignada y
  **previsualizable**. El **QR de Scan&Pay** lo genera el sistema (por mesa, §1).
- **Reparto** de primera: asignación de repartidor, **ruta**, cobro en entrega, y zonas por **mapa/CP**
  en vez de lista escrita a mano.
- **Tope de pedidos por franja ligado a la capacidad real de cocina** (KDS), no un número fijo a ciegas
  — evita saturar la cocina en hora punta.
- **Preparación programada**: pedidos con hora de recogida/entrega que entran al KDS **en el momento
  correcto**, no al crearse.

**Prioridad: 🟡 Media.** Los modos existen en operativa; faltan el configurador por local y los
**estados en tiempo real al cliente** (que es nuestra ventaja).

---

## 4. Cobro de un toque (acciones personalizadas), dividir cuenta y propinas

**Para qué sirve.** Cobrar en el **mínimo número de toques**. Un botón que cobra todo con un medio
concreto sin abrir el selector; partir la cuenta entre comensales; ofrecer propina sin fricción.

**Cómo lo hace Ágora.** "Acciones Personalizadas": botones de **cobro directo** (Efectivo / Tarjeta /
AgoraPay) o de **URL/aplicación** externa, con icono por tema. La división de cuenta vive dentro de
Scan&Pay; las propinas sugeridas (ninguna / % / importes) se configuran en "Editar Local".

**Cómo lo mejoramos.**

- **Cobro de un toque** como acción de primera clase en la botonera, con **color de marca**, orden
  configurable, **propina rápida** y **apertura de cajón** configurables **por acción**. Cumple el
  presupuesto de 2 toques para cobrar de [02 §3.1](../02-interfaz-tactil/README.md).
- Acciones que llaman a **nuestras propias rutas** (abrir KDS, reimprimir, llamar a cocina) además de
  URLs externas — no solo lanzar webs.
- **Dividir cuenta** flexible: por comensales, por productos seleccionados o a partes iguales, con
  arrastrar líneas entre subcuentas; cada parte emite su ticket VERIFACTU.
- **Propinas configurables** (ninguna / % / importes fijos) mostradas en cobro **y** en pago en mesa,
  y **por forma de pago** (ya se reportan en el cierre Z, "propinas por forma de pago").

**Prioridad: 🟡 Media.** El cobro existe en operativa; falta el configurador de acciones, el divisor de
cuenta completo y las propinas configurables.

---

## 5. Formas de pago configurables con conciliación y monedero

**Para qué sirve.** Definir cada medio de cobro (Efectivo, Tarjeta, Transferencia, pasarela, vale…) y
su comportamiento: si abre cajón, da cambio, entra en arqueo, admite propina, exige cliente, usa
pasarela o tiene importe máximo. Alimenta el cobro y el cuadre de caja.

**Cómo lo hace Ágora.** "Formas de Pago" con prioridad (orden en la botonera) y un conjunto de
casillas: devolver cambio, abrir cajón, incluir en arqueo, registrar propina, usar en
devoluciones/pedidos telefónicos, obligar cliente + tipo, máximo permitido, usar pasarela, imprimir
vales. "La Palma" aparece como medio propio de fidelización suelto.

**Cómo lo mejoramos.**

- **Conciliación con pasarela**: cruzar automáticamente cada cobro con la **liquidación del datáfono**
  (AgoraPay/Redsys) — descuadres a la vista, no a final de mes.
- **Monedero/fidelización de primera clase** (tipo "La Palma") con **saldo** real, no una forma de pago
  improvisada.
- **Máximo legal en efectivo** (límite de pagos en efectivo entre empresa y particular) con **aviso**
  automático; y validación del **límite de factura simplificada** (400 € general).
- **Visibilidad por grupo de terminales**: qué medios aparecen en qué TPV (datáfonos solo en
  comanderas, etc.).
- Todo el comportamiento como **casillas con su "para qué"** explicado en la propia UI, no jerga.

**Prioridad: 🟡 Media.** El cobro existe; este configurador de medios + conciliación falta.

---

## 6. Pasarela con conciliación y Tap to Pay

**Para qué sirve.** Integrar el **datáfono/pasarela** para cobrar en mesa: a qué terminal atiende cada
datáfono, en qué puerto, y cómo se traduce el medio que devuelve la pasarela al medio interno (para
arqueo y cierre Z).

**Cómo lo hace Ágora.** "Pasarela de Pago — Cobro en Mesa": puerto de escucha, tabla **datáfono ↔ TPV**
y mapeo **forma de pago de la pasarela ↔ forma de pago interna**. La pasarela de pago global (Ágora
Payments) guarda comercio/tienda/claves con botón "comprobar credenciales".

**Cómo lo mejoramos.**

- **Conciliación automática** datáfono ↔ liquidación bancaria (continúa §5).
- **Tap to Pay** (móvil como datáfono) y **QR de pago**, además del TPV físico — cobrar sin hardware
  dedicado.
- **Reintentos e idempotencia**: tras un corte de red no se cobra dos veces; la operación es segura por
  diseño (clave para offline‑first).
- **Test de credenciales** con feedback claro (✓/✗ y motivo), ocultar/mostrar claves, y **aviso si la
  pasarela no soporta el territorio** (p. ej. IGIC canario).
- **Secretos siempre fuera del cliente**: la integración corre en `apps/api`/agente local, nunca en el
  navegador, con credenciales cifradas.

**Prioridad: 🔴 Alta.** Falta el modelo `payment_gateway_config` + test de credenciales; es
prerrequisito del cobro con datáfono y del pago en mesa.

---

## 7. Control de efectivo con abstracción multi‑marca

**Para qué sirve.** Cajones/recicladores **inteligentes** que cuentan, validan y dispensan dinero
solos: dan el cambio exacto y **reducen descuadres y robos**.

**Cómo lo hace Ágora.** "Control de Efectivo": elige el tipo de dispositivo (Cashlogy, CashKeeper,
CashInfinity, CashGuard, CashDro por ficheros o web service, CashProtect) y se asigna **por terminal**.
Cada marca trae su protocolo propio.

**Cómo lo mejoramos.**

- **Abstracción común `CashDevice`** (igual que hicimos con `Printer`) con **drivers por marca** — la
  app no se acopla a un fabricante; cambiar de máquina no cambia el código.
- **Arqueo automático contra el contador físico** del cajón al cerrar jornada → **cero descuadres**, sin
  contar a mano.
- **Modo degradado offline‑first**: si el cajón cae, se sigue cobrando en efectivo manual sin parar la
  caja; al volver, reconcilia.
- Integración desde un **agente local LAN** (`@gluuh/hardware`), no desde el navegador.

**Prioridad: 🟢 Baja‑Media.** Diferenciador de gama alta; `packages/hardware` es hoy un esqueleto. Va
después de cobro/pasarela básicos.

---

## 8. Clientes con validación de NIF y RGPD de serie

**Para qué sirve.** A quién se emite **factura completa** (no la simplificada de barra): datos
fiscales, condiciones comerciales (tarifa, descuento, recargo de equivalencia), direcciones de
entrega para delivery, y avisos al asignarlo en el TPV.

**Cómo lo hace Ágora.** Ficha de cliente (CRM ligero): datos administrativos con tipo de documento
(NIF/CIF/NIE/Pasaporte/VAT) y CIF/NIF, tipo de cliente, subcliente, tarifa, % descuento, recargo de
equivalencia, direcciones de entrega, promociones, precios especiales y **observaciones con aviso** al
seleccionarlo. Los **tipos de cliente** son un CRUD de solo nombre. El consentimiento publicitario es
una simple casilla.

**Cómo lo mejoramos.**

- **Validación de NIF/CIF/VAT en vivo** según tipo de documento y país — **clave para una factura
  VERIFACTU correcta** (un NIF mal teclado rompe la factura legal).
- **RGPD de serie**: el flag "Enviar Publicidad" con **fecha y origen del consentimiento**, y
  **export/borrado** del cliente a un clic (derecho al olvido). Ver [12 — Seguridad y RGPD].
- **Buscar cliente por NIF / teléfono / email desde el TPV en 1 toque** y asignarlo al ticket sin salir
  del cobro.
- **Tipos de cliente con tarifa y descuento por defecto** asociados (Ágora solo guarda el nombre), y
  marcar grupos visibles/ocultos en TPV y carta online.
- Mantener el **aviso de observaciones** de Ágora ("cobra en efectivo", "moroso") — es muy útil.

**Prioridad: 🟡 Media.** Hay clientes en operativa pero falta el maestro CRM con validación fiscal y
RGPD; la validación de NIF es la pieza con más impacto fiscal.

---

## 9. Auto‑registro de terminal por QR

**Para qué sirve.** Dar de alta un TPV o comandera nuevo **sin teclear configuración**: que herede su
rol (impresoras, Z, pasarela, control de efectivo, serie) del grupo al que pertenece.

**Cómo lo hace Ágora.** Cada "Punto de Venta" (terminal) se configura a mano: tipo, grupo, maestro LAN,
opciones de cobro, operativa, **Informe Z propio**, balanza/visor, impresión por documento y enrutado
de cocina por estación. Alta manual, campo a campo.

**Cómo lo mejoramos.**

- **Auto‑registro por QR de emparejamiento**: el dispositivo nuevo escanea, se da de alta solo y
  **hereda la config de su grupo**. Cero tecleo.
- **Serie de numeración por terminal** ligada aquí → varios TPV cobran **offline sin colisionar** el
  número (sin huecos en la cadena VERIFACTU).
- **Enrutado de cocina a impresora física O pantalla KDS** indistintamente (Ágora aquí solo lista
  impresoras); el **visor de cliente** es nuestra **pantalla PWA**, no solo un display físico.
- **Config de terminal versionada y auditada** (quién cambió qué), apoyada en RLS multi‑tenant.

**Prioridad: 🟡 Media.** Todo el bloque de terminales falta como configurador; el auto‑registro es lo
que lo hace "intuitivo" frente al alta manual de Ágora.

---

## 10. Tabla resumen

| # | Mejora | Para qué sirve | Salto sobre Ágora | Prioridad |
|---|--------|----------------|-------------------|:---------:|
| 1 | **Plano de sala = mismo componente** | Ver y operar la sala real en tiempo real | Editor DnD + plano operativo unificados, unir/mover mesas, QR y comensales por mesa | 🔴 Alta |
| 2 | Centros de venta (zonas) | Tarifa/almacén/impresoras por zona | Plano visual, periodos de servicio vs "franja=centro", herencia | 🟡 Media |
| 3 | **Modos de venta** | Scan&Pay / Mesa / Delivery / Take Away | **Estados en tiempo real al cliente**, reparto por mapa, tope ligado a KDS, prep. programada | 🟡 Media |
| 4 | Cobro de un toque + dividir + propinas | Cobrar en mínimos toques | Cobro directo configurable, divisor flexible, propinas por medio | 🟡 Media |
| 5 | Formas de pago | Comportamiento de cada medio | Conciliación, monedero real, máximos legales, visibilidad por terminal | 🟡 Media |
| 6 | **Pasarela cobro en mesa** | Datáfono ↔ terminal ↔ medio interno | Conciliación auto, **Tap to Pay**, idempotencia, test credenciales | 🔴 Alta |
| 7 | Control de efectivo | Cajón inteligente: cambio exacto, cero robo | Abstracción `CashDevice` multi‑marca, arqueo automático, modo degradado | 🟢 Baja‑Media |
| 8 | **Clientes (CRM)** | A quién se emite factura completa | **Validación NIF/VAT en vivo**, RGPD (consentimiento + borrado), búsqueda 1 toque | 🟡 Media |
| 9 | Auto‑registro de terminal | Alta de TPV sin teclear | QR de emparejamiento + herencia de grupo, serie por terminal offline | 🟡 Media |

> **Hilo común:** un **único componente de sala** reutilizado en diseño y operativa; **estados en
> tiempo real** (mesa, pedido, cliente) como ventaja transversal; **offline‑first** en cobro, pasarela
> y efectivo; y **todo configurable** por ámbito `GLOBAL > LOCAL > DEVICE` sin migraciones. El **cómo
> construirlo** va en [`../implementacion/`](../implementacion/).
