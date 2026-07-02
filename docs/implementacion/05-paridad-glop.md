# 05 — Paridad Glop en la pantalla de venta

**Objetivo:** cerrar la tabla 4.2 de `docs/auditoria_02_07_26/04-tpv-estilo-glop.md`.
Requiere la guía 02 (refactor) hecha: todo lo de aquí son componentes nuevos o campos
en `useComanda`, no líneas extra en un monolito. Orden sugerido = orden del documento
(de más barato y visible a más caro).

## 5.1 Barra de estado inferior (0,5 d)

`components/BarraEstado.tsx`, fija abajo del TPV: operario · terminal (nombre del
`device` vinculado, guía 04) · caja/turno (¿hay `cash_session` abierta?) · tarifa
activa (placeholder "General" hasta P1-3) · sala actual · estado de red
(`navigator.onLine` + evento `window.gluuh.onEvento` si hay desktop). Es la pieza que
más "TPV serio" transmite por hora invertida.

## 5.2 Columna de funciones + Utilidades (1 d)

Columna entre ticket y grid (como Glop): Aparcar · Pasar a mesa · Cliente ·
Invitación · Cons. propio · Dividir · Último doc. · Utilidades. En pantallas
estrechas, colapsa a un botón "···". `Utilidades` abre un modal táctil con: Abrir
cajón (si `window.gluuh`), Reimprimir último, Módulos y pantallas (guía 04, solo
encargado), Exportar backup ahora (solo desktop).

## 5.3 Aparcar y recuperar (1 d)

- Migración: `alter table sales_order add column if not exists aparcado_como text;`
  (no tocar el enum de estados: aparcado = pedido `ABIERTA` sin mesa con etiqueta).
- Botón Aparcar: pide etiqueta opcional (por defecto, hora "14:32") y limpia el TPV.
- Botón/badge "Aparcados (N)": lista táctil → recuperar carga la comanda.

## 5.4 Pasar a mesa (0,5 d)

Con cuenta abierta: "Pasar a mesa" → plano en modo selección → update de la mesa del
`sales_order` (y estados de mesa origen/destino). Si la mesa destino tiene cuenta,
ofrecer **fusionar** (mover las líneas) o cancelar.

## 5.5 Cliente y comensales en el ticket (1 d)

- Verificar columnas en `sales_order` (`customer_id`, `comensales`); añadir con
  migración si faltan. Decidir de una vez `customer` vs `client` (auditoría §1.4):
  **`customer`** (la de 0001, con RGPD) y migrar/retirar `client`.
- Botón Cliente: buscador por nombre/teléfono + alta rápida (nombre y teléfono, dos
  campos — patrón de la guía 07). Alias y comensales editables en la cabecera del
  ticket, como Glop.

## 5.6 Invitación y consumo propio (1 d)

- `tipo_operacion` ya existe en el pedido y en `@gluuh/core` (INVITACION /
  AUTOCONSUMO, con su tratamiento legal — `docs/14`). Botones en la columna de
  funciones: marcan el tipo (toda la cuenta) o la línea seleccionada, con
  confirmación y PIN de encargado si el operario es camarero.
- En el cobro: las líneas de invitación van a 0 € pero **se registran** (el informe
  `(panel)/invitaciones` ya existe y las mostrará).

## 5.7 Último documento (0,5 d)

Guardar en estado local la última factura emitida por el terminal; botón muestra
número/total y ofrece **reimprimir** (mismo `PrintJob`). Fase 2 (con series por
terminal): buscar en `invoice` por `device_id`.

## 5.8 Cobro: proforma, tipo de documento y atajos (1,5 d)

- **Imprimir cuenta** (proforma): imprime el ticket SIN cobrar ni facturar, marcado
  "CUENTA — no válido como factura". Pedido pasa a `POR_COBRAR`.
- **Tipo de documento** en el modal de pagos: `Ticket (F2)` por defecto; `Factura
  (F1)` exige cliente con NIF (selector de 5.5) y pasa `tipo` a `/api/factura`
  (los tipos F1/F2 ya existen en `@gluuh/core`).
- **Atajos**: `F10` imprimir cuenta · `F11` cobrar+imprimir · `F12` cobrar (efectivo
  exacto en un toque). `useEffect` global con `keydown` en el TPV; en Electron
  funcionan igual (son teclas del renderer).

## 5.9 Imágenes en los botones de producto (1 d)

- Migración: `alter table product add column if not exists imagen_url text;`
- Subida en `(panel)/carta` (producto-dialog) reutilizando `subirMedia` de
  `app/lib/branding.ts` (bucket de Storage ya en uso para branding/ofertas).
- `GridProductos`: botón con imagen de fondo + nombre en franja inferior; fallback
  exacto al diseño actual (color de familia). Los refrescos con su marca — el efecto
  Glop más visible — sale de aquí.

## 5.10 Dividir cuenta (3-4 d, la más grande)

- **Por líneas**: modal a dos columnas (cuenta actual → cuenta nueva), pasar líneas
  tocándolas (y partir cantidades: 3 cañas → 1+2). Genera un segundo `sales_order`
  `POR_COBRAR` en la misma mesa; cada uno se cobra por separado.
- **Por comensales**: atajo que divide el total en N pagos iguales dentro del pago
  mixto existente (sin partir líneas; es lo que un camarero usa el 90% del tiempo).
- Reutiliza `ModalPagos` tal cual para cada parte.

## Criterios de aceptación

- [ ] Un camarero puede: aparcar una cuenta en barra, recuperarla, pasarla a la mesa
      12, asignarle cliente y 4 comensales, invitar una línea, imprimir la cuenta,
      dividir en 2 y cobrar cada parte — sin salir del TPV ni usar el ratón.
- [ ] `F12` cobra en efectivo exacto en un toque desde el TPV con líneas.
- [ ] Los botones de producto muestran imagen cuando existe y color cuando no.
- [ ] La barra de estado refleja operario/terminal/caja/sala/red en todo momento.
- [ ] Todo lo anterior funciona igual en la web y dentro de Gluuh Desktop.
