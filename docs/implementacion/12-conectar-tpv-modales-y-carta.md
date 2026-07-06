# 12 — Conectar el TPV: variaciones, modificadores, anotaciones, dividir y cobrar

**Fecha:** 04-07-2026. Guía de CABLEADO: qué tablas intervienen y cómo enganchar en
`apps/web/app/tpv/page.tsx` los tres modales nuevos (`app/tpv/components/*Modal.tsx`) y
el flujo de carta → línea → cobro. Complementa la guía 11 (configuración) y la 05
(paridad Glop). El backoffice de todo esto ya está hecho; aquí queda el TPV.

## 0. Estado

- **Hecho (backoffice + datos)**: carta en páginas propias (familias/categorías/
  productos), variaciones (`product_format`), modificadores (`modifier_group`/
  `modifier`), notas de preparación (`nota_preparacion`), formas de pago con flags
  (`abre_cajon`/`cuenta_arqueo`), series por tipo, precios recalculados server-side.
- **Hecho (componentes listos para enchufar)**: `ModificadoresModal.tsx`,
  `DividirCuentaModal.tsx`, `CobrarModal.tsx` en `app/tpv/components/` —
  presentacionales, reciben props y emiten callbacks. **No están cableados** en
  `page.tsx` (lo edita el usuario).
- **Falta**: conectarlos, y aplicar los flags de forma de pago / nombres de impresión.

## 1. Tablas implicadas (todas con RLS por `tenant_id`)

| Concepto | Tabla | Columnas clave |
|---|---|---|
| Familia (color, orden) | `family` | `nombre, color, orden` |
| Categoría (estación, foto) | `category` | `nombre, family_id, orden, estacion, foto_url` |
| Producto | `product` | `nombre, precio, tipo_impositivo, clase_fiscal, category_id, estacion, foto_url, vendido_por_peso, agotado_hasta, disponible, nombre_ticket, nombre_cocina, orden` |
| **Variación de precio** | `product_format` | `product_id, nombre, precio, orden` (caña/tubo/tercio, media/entera) |
| **Modificador (grupo)** | `modifier_group` | `product_id, nombre, min_sel, max_sel` |
| **Modificador (opción)** | `modifier` | `modifier_group_id, nombre, precio_extra` |
| **Anotación rápida** | `nota_preparacion` | `nombre, descripcion` (poco hecho / sin sal / alergias) |
| Cuenta / pedido | `sales_order` | `estado, estado_preparacion, tipo_operacion, total, table_id, customer_id, comensales, aparcado_como` |
| Línea de pedido | `order_line` | `product_id, nombre, cantidad, precio_unitario, tipo_impositivo, notas, estacion` |
| Cobro | `payment` | `order_id, metodo, importe` |
| Forma de pago | `payment_method` | `nombre, tipo, abre_cajon, cuenta_arqueo, orden` |
| Serie de documento | `invoice_series` | `codigo(prefijo), nombre, tipo, predeterminada, activa` |

## 2. Elegir familia / categoría / producto (ya existe)

El grid del TPV ya pinta categorías (color de familia) y productos (foto o color). No
requiere cambios de datos. La **estación** de cada producto (heredada de la categoría,
0050) decide a qué impresora va al marchar — ya cableado en `imprimirComandas()`.

## 3. Variaciones de precio — `product_format`

Al pulsar un producto que tiene formatos, mostrar el selector de formato antes de añadir
la línea. En `page.tsx` ya existe el estado `formatoPop` y el modal (busca
`{formatoPop && …}`): la clave de comanda es `"productId|formatId"` y `precioEfectivo`
ya resuelve el precio del formato. **No hace falta modal nuevo**: verifica que al pulsar
un producto con `formatos[p.id]?.length` se abra `setFormatoPop(p)`.

## 4. Modificadores y anotaciones — `ModificadoresModal.tsx`

Réplica de la pantalla "ENTRECOT" de Ágora. Se abre al pulsar un producto que tenga
`modifier_group` (o siempre, si quieres permitir anotación manual).

**Props del componente** (ver el fichero para la firma exacta):
- `producto={{ nombre, precio }}`
- `gruposComentario` = grupos SIN precio (min/max), de `modifier_group`+`modifier` con
  `precio_extra = 0` (p. ej. "Punto de la carne"): `[{ nombre, opciones: [{id,nombre}] }]`.
- `extras` = opciones CON precio (`precio_extra > 0`): `[{ id, nombre, precioExtra }]`.
- `onGuardar({ comentarios, extras: [{id,uds}], comentarioManual })`, `onCancelar()`.

**Cómo cablear el resultado en la comanda** (patrón ya presente en `page.tsx`
`finalizarLinea`/`modProd`): la clave de comanda admite `"productId|fid|mod1,mod2"`;
`precioEfectivo` suma `modById[m].precio_extra`; el texto de comentarios +
`comentarioManual` va a `order_line.notas` (se imprime en cocina y sale en el KDS). Las
anotaciones rápidas pueden salir también de `nota_preparacion` (cárgala una vez y
pásala como chips al modal).

## 5. Invitación / Consumo propio (ya existe)

`tipoOperacion` (`VENTA`|`INVITACION`|`AUTOCONSUMO`) ya está en `page.tsx` y en
`crearOrden` (campos `tipo_operacion`, `motivo_no_venta`). La invitación cobra a 0 €
pero **siempre registra la línea** (informe de invitaciones). No borrar la línea.
Cons. propio aplicará la tarifa de empleado cuando se cablee `product_price` (0047).

## 6. Dividir cuenta — `DividirCuentaModal.tsx`

Réplica de "Dividir cuenta" de Ágora. **Props**:
- `lineas=[{ id, nombre, uds, precio }]`, `total`, `comensales?`
- `onAceptar(docs: [{ lineas: [{id,uds}] }])` — reparto elegido
- `onCobrarTodos()`, `onCancelar()`, `onAbrirCajon?()`

**Qué hacer en el backend al aceptar** (guía 05 §Dividir):
- **Automática**: total ÷ Nº docs, dentro del pago mixto (no crea pedidos nuevos, cobra
  por partes).
- **Manual**: mover líneas/unidades a un 2º documento → genera un **segundo
  `sales_order`** con esas líneas y deja el resto en el original; luego cada uno se cobra
  por separado. Recalcula `total` de ambos.

## 7. Cobrar — `CobrarModal.tsx`

Réplica de la pantalla "Cobrar" de Ágora (pago mixto, propina, descuento, tipo de doc,
"A devolver" gigante, F10/F11/F12). **Props**:
- `total, baseImponible, impuesto` (los das tú desde `@gluuh/core`;
  **el modal NO calcula impuestos**), `cliente?, empleado?, terminal?`
- `formasPago=[{ id, nombre, tipo }]` — de `payment_method` (ordena por `orden`)
- `tiposDoc?` (Factura simplificada / completa; la completa exige cliente con NIF)
- `onCobrar(pagos:[{formaPagoId, importe}], { imprimir, tipoDoc, propina, descuento, notas })`
- `onImprimirCuenta()` (F10, pre-ticket sin cobrar), `onEmail?()`, `onCancelar()`

**Cableado**:
1. Al confirmar: por cada línea de pago inserta un `payment` (`metodo`, `importe`).
2. **Abrir cajón** si alguna forma de pago usada tiene `abre_cajon = true`
   (`window.gluuh.abrirCajon()`).
3. Marca del `payment_method` si `cuenta_arqueo = false` → no suma al arqueo Z.
4. **Fiscal (crítico)**: con `VERIFACTU_ACTIVO`, no imprimir ticket hasta que
   `/api/factura` (que ya lee las líneas del pedido real, no del cliente) haya
   persistido y encadenado. Si falla, el pedido queda `POR_COBRAR` y se reintenta.
5. F11 = cobrar+imprimir · F10 = imprimir cuenta (proforma) · F12 = cobrar.
6. El **logo del ticket**: pasa `extra.logoUrl = branding.logo_ticket_url || logo_url`
   a `imprimirTicket` (0056); usa `nombre_ticket` del producto en las líneas y
   `nombre_cocina` en las comandas (0051).

## 8. Datos de ejemplo

`supabase/seed-ejemplo-carta.sql` — carta completa de un bar español (familias con
color, categorías con estación, productos, formatos de cerveza, punto de la carne +
extras del entrecot, media/entera del pulpo, notas de preparación). Idempotente
(no siembra si el tenant ya tiene familias). Ejecútalo con el `tenant_id` correcto
(hoy `328063c3-…`; ese id no existe en la BD conectada — créalo o cámbialo).

## 9. Checklist de conexión (en `page.tsx`, cuando el usuario lo integre)

- [ ] Producto con formatos → abre selector de formato (`formatoPop`).
- [ ] Producto con `modifier_group` → abre `ModificadoresModal`; el resultado va a la
      clave de comanda (extras al precio) y a `order_line.notas` (comentarios).
- [ ] Chips de `nota_preparacion` en el editor de línea (anotación en 1 toque).
- [ ] Botón Dividir → `DividirCuentaModal`; manual genera 2º `sales_order`.
- [ ] Botón Cobrar → `CobrarModal`; inserta `payment` por línea, abre cajón según
      `abre_cajon`, respeta VERIFACTU, imprime con logo de ticket y nombres de impresión.
- [ ] Consumir `tpv.botones` (columnas/precio/foto/tamaño) y `caja.*` (fondo, cajón).

## Criterios de aceptación

- [ ] Pedir una cerveza pide el formato (caña/tubo/tercio) y cobra su precio.
- [ ] Pedir un entrecot deja elegir punto (obligatorio) y extras (suman al precio);
      el punto y la nota manual salen impresos en cocina.
- [ ] Dividir una mesa en 2 genera dos documentos cobrables por separado.
- [ ] Cobrar admite pago mixto (efectivo+tarjeta), muestra "A devolver", abre el cajón
      solo con formas de pago marcadas, e imprime con el logo de tickets.
