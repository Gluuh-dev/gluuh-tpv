# 10 — Pantalla de cocina (KDS) y tipos de ticket

**Fecha:** 03-07-2026. Especificación de la pantalla de cocina (KDS) y del sistema
de impresión de tickets, tomada de la referencia de Glop (capturas del cliente) y
cruzada con lo que hoy tiene `apps/web/app/cocina`. Es el objetivo a construir; no
está implementado salvo lo indicado en §6.

---

## 1. Cómo se ve la pantalla de cocina

- **Barra inferior de estados (4 pestañas), con color:**
  - `RECIBIDO` (blanco) → `EN PREPARACIÓN` (naranja) → `PARA SERVIR` (verde) →
    `RECLAMADO` (rojo, urgente/pasado de tiempo).
  - El color de cada comanda/línea indica su estado de un vistazo (a 2 m).
- **Información por línea:**
  - Cantidad · nombre del artículo · **grupo de cocina** (BEBIDAS, ENTRANTES,
    PRIMEROS, SEGUNDOS, CAFÉS…) · **mesa** · **empleado** que la tomó ·
    **temporizador** (tiempo transcurrido / cuenta atrás).
  - **Modificadores** debajo del artículo: `- CON NARANJA`, `- AL PUNTO`,
    `* BARBACOA`, `* QUESO MANCHEGO` (los `*` = extras/ingredientes añadidos).
  - **Nota** de cocina (icono) y **badge** con la cantidad total del mismo
    artículo pendiente (p. ej. 3 FANTA LIMÓN juntas).
  - **Medias raciones**: "(1/2 RACIÓN)" como formato del artículo.
- **Cabecera por comanda:** Mesa + empleado + temporizador global de la mesa.

## 2. Las 4 formas de ver la pantalla (selector "Elige el tipo de vista")

1. **Mesas** (*vista por comanda individual*) — una **columna por mesa** con sus
   líneas. Es la vista de servicio en sala.
2. **Grupos de cocina** (*vista por grupos de cocina*) — una **columna por grupo**
   (PRIMEROS, BEBIDAS, CAFÉS…). Cada partida ve lo suyo.
3. **Cascada** (*vista ordenada por artículos*) — **lista** con columnas
   `CANT · ARTÍCULO · GRUPO · MESA · tiempo`. Rápida para alta rotación.
4. **Mesas agrupadas** (*vista general de comandas*) — **rejilla** de mesas, visión
   de conjunto.
- Además, una **vista maestro-detalle**: lista de mesas a la izquierda (con su
  temporizador y empleado) y el detalle de la seleccionada a la derecha.
- El operador cambia de vista en caliente; se puede fijar una por defecto.

## 3. Configuración de la pantalla (panel de ajustes del KDS)

- **General:** Seleccionar vista al iniciar (mostrar el selector al arrancar) ·
  Tipo de vista por defecto · **Fast food** (servido automático de tickets según
  el 2º aviso) + **Tiempo fast food** · Activar temporizadores · Vibrar en alarma ·
  Color de fondo · **Filtro Grupo Cocina** (qué grupos ve ESTA pantalla) ·
  **Filtro por salón** · Número de columnas.
- **Config del ticket · Config de líneas · Config avanzada** (red/impresoras).
- La configuración es **por dispositivo** (cada pantalla KDS la suya) → va en la
  tabla `setting` ámbito DEVICE (mecanismo ya existente).

## 4. Seleccionar qué productos salen en la pantalla (filtrado)

- Cada producto tiene un **grupo de cocina / estación** (bebidas → barra, comida →
  cocina, café → cafetera…). Hoy Gluuh tiene `estacion` (COCINA/BARRA/CAMARERO);
  esto pide un **grupo de cocina más granular** (ENTRANTES/PRIMEROS/SEGUNDOS/
  BEBIDAS/CAFÉS…) o mapear grupos a estaciones.
- Cada **pantalla KDS filtra por los grupos que le tocan** (Filtro Grupo Cocina) →
  la pantalla de cocina no ve las bebidas y la de barra no ve los primeros.
- Un producto **sin grupo/estación no se manda a preparar** (no aparece en ninguna
  KDS ni se imprime en cocina) — p. ej. una bolsa de patatas de barra.

## 5. Los 4 tipos de ticket (impresión configurable)

El mismo pedido genera documentos distintos según a quién van dirigidos:

| Ticket | Para quién | Contenido |
|---|---|---|
| **Ticket de cliente** (factura/recibo) | el cliente | local, líneas, impuestos, total, QR VERIFACTU + leyenda. **Ya existe** (§6). |
| **Ticket del pedido** (comanda completa) | control / archivo | resumen del pedido entero, todas las líneas y modificadores, mesa/empleado, sin precios de cara al cliente. |
| **Ticket para el camarero** | el que sirve (el pase) | qué llevar a la mesa y a qué mesa; agrupado por pase; sin precios. |
| **Ticket para el cocinero** (comanda de cocina) | la partida | **solo los artículos de su grupo de cocina**, con modificadores y notas grandes, mesa y hora; sin precios. |

- **Enrutado por grupo/impresora:** cada grupo de cocina imprime en **su** impresora
  (bebidas → barra, comida → cocina). Requiere una tabla de impresoras + reglas de
  enrutado (`device`/`setting` + la cola `print_job` de la app de escritorio).
- Cada tipo de ticket se puede **activar/desactivar** y asignar a impresora en la
  configuración.

## 6. Estado actual en Gluuh vs esta spec

Hoy `apps/web/app/cocina/page.tsx`:
- ✅ Tablero de comandas `ENVIADA_COCINA` en **tiempo real** (Supabase Realtime).
- ✅ **Una** vista (tarjetas por comanda) + filtro por estación (Cocina/Barra/
  Camarero/Todas) + tema oscuro.
- ✅ Avance de estado por botón: `PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO`
  (equivalen a Recibido/En preparación/Para servir; **falta RECLAMADO**).
- ✅ Minutos transcurridos por tarjeta.

**Falta para llegar a la spec:**
1. Las **4 vistas** (mesas / grupos de cocina / cascada / mesas agrupadas) + selector
   + maestro-detalle. Hoy solo hay la de tarjetas.
2. Estado **RECLAMADO** (urgente/pasado de tiempo, rojo) — probablemente derivado
   del temporizador (si supera X min sin avanzar).
3. **Granularidad por línea** (grupo, empleado, badge de cantidad agregada,
   modificadores destacados) — hoy la tarjeta es por comanda.
4. **Grupo de cocina** por producto (más granular que `estacion`) para las vistas
   y el enrutado.
5. **Panel de configuración** del KDS (vista al iniciar, fast food, temporizadores,
   filtros, nº columnas…) en `setting` ámbito DEVICE.
6. **Impresión multi-ticket** (cliente / pedido / camarero / cocinero) con enrutado
   por grupo a su impresora — hoy solo el ticket de cliente. Depende de la cola
   `print_job` y la config de impresoras (guía 03).

## 7. Cambios de datos que implica

- `product`: campo **grupo de cocina** (o tabla `grupo_cocina` + FK) más granular
  que `estacion`. (Reutilizar `estacion` si se decide no granularizar.)
- `sales_order`/`order_line`: el estado de preparación ya existe a nivel de pedido
  (`estado_preparacion`); para RECLAMADO y para avanzar **por línea/grupo** puede
  hacer falta estado a nivel de `order_line`.
- `setting` (DEVICE): configuración del KDS por pantalla.
- Impresión: tabla de **impresoras** + reglas de **enrutado por grupo** + tipos de
  ticket activables (liga con `print_job` de la guía 03).

## 8. Orden sugerido de construcción

1. **Grupo de cocina** por producto + filtro por grupo en la KDS (la base de todo).
2. **Las 4 vistas** + selector + config por dispositivo (`setting` DEVICE).
3. Estado **RECLAMADO** por temporizador + avance por línea/grupo.
4. **Impresión multi-ticket** (cocinero/camarero/pedido) con enrutado por grupo a
   impresora — junto con la cola `print_job` de la app de escritorio.
