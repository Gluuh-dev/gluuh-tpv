---
name: gluuh-tpv-glop
description: >-
  Cómo trabajar en la pantalla de venta del TPV de Gluuh (apps/web/app/tpv)
  para llevarla al nivel de Glop TPV y superarlo: layout objetivo, refactor en
  componentes, comportamiento exacto de cada función (aparcar dispara comanda,
  pre-ticket como estado de mesa, traspasos, dividir, invitación auditable,
  F10/F11/F12), creación rápida de productos desde el TPV, y reglas táctiles y
  fiscales que no se pueden romper. Úsala SIEMPRE que toques el TPV de venta,
  su cobro, el grid de productos, el plano dentro del TPV o añadas botones u
  operaciones de venta.
---

# TPV de venta estilo Glop — guía de trabajo

Documentos madre (leer el que toque antes de programar):
`docs/implementacion/02-refactor-tpv.md` (estructura de componentes),
`05-paridad-glop.md` (cada función con su DDL y esfuerzo),
`07-creacion-rapida-desde-tpv.md`, `08-analisis-glop.md` (anatomía y manuales
de Glop), `09-referencias-ux-competencia.md` (cifras táctiles).

## Estado del código

- Hoy el TPV es `apps/web/app/tpv/page.tsx` (~1.300 líneas monolíticas). El
  refactor (guía 02) lo divide en `tpv/components/*` y `tpv/hooks/*`
  (`useComanda` = estado del ticket con descuentos/precios manuales; con test).
  **Si el refactor no está hecho aún, hazlo antes de añadir funciones.**
- Estado local con useState/useMemo; NO introducir stores globales de datos.
  Zustand solo existe para UI (`ui-store`, `assistant-store`).
- Datos: Supabase browser client (`app/lib/supabaseBrowser.ts`), RLS por tenant.
  Operario por PIN (RPC `validar_pin`), persistido en localStorage `gluuh_operario`.

## Layout objetivo (validado contra Glop, Ágora, Revo y Lightspeed)

```
┌ Cabecera ticket: alias · cliente · mesa · comensales (siempre visible) ┐
│ TICKET (líneas, editor)   │ FUNCIONES │ CATEGORÍAS + GRID DE PRODUCTOS │
│ Total grande              │ de cuenta │ (imagen o color de familia)    │
│ TECLADO (Und/Precio/DTO)  │           │                                │
│ [COBRAR acento]           │           │            pestañas de zona ▕  │
├ BARRA DE ESTADO: operario · terminal · caja/turno · tarifa · sala · red ┤
```

- Columna de funciones = **acciones de CUENTA**: Aparcar, Pasar a mesa, Cliente,
  Invitación, Cons. propio, Dividir, Último doc., Utilidades. Las acciones de
  **LÍNEA** (anular, nota, descuento) van con el ticket/teclado. No mezclarlas.
- **Un solo color de acento, reservado a Cobrar** (el naranja de Glop; en Gluuh
  sale de `tenant_branding`). Nada más compite en color.
- Los botones **no cambian de posición** entre versiones (memoria muscular).

## Comportamientos exactos (así funciona Glop; así debe funcionar Gluuh)

- **Aparcar = guardar y marchar**: aparcar una cuenta con líneas sin enviar
  DISPARA la comanda a cocina. Un gesto. (`sales_order.aparcado_como`.)
- **Imprimir cuenta (F10)** = pre-ticket: imprime SIN cobrar ni facturar, marca
  "CUENTA — no válido como factura", pedido a `POR_COBRAR` y la mesa pasa al
  4º estado visual "cuenta solicitada" (derivado, sin columna).
- **Pasar a mesa**: origen → modo selección en el plano → destino; si el destino
  tiene cuenta, ofrecer FUSIONAR (así se "juntan mesas", sin botón dedicado).
  Traspaso parcial: tocar una línea N veces mueve N unidades.
- **Dividir**: modo Auto (total ÷ comensales, dentro del pago mixto) y modo
  Manual (dos columnas, pasar líneas/cantidades; genera 2º `sales_order`).
- **Invitación**: checkbox por línea, cobra a 0 € pero SIEMPRE registra (informe
  `invitaciones` ya existe). Nunca borrar la línea. **Cons. propio** aplica la
  tarifa de empleado (con tarifas P1-3), no un descuento ad hoc.
- **Cobro**: F12 = cobrar (efectivo exacto en 1 toque) · F11 = cobrar+imprimir ·
  F10 = cuenta. Atajos impresos en el botón. "A devolver" en tipografía gigante.
  Tipo de documento: Ticket (F2) por defecto, Factura (F1) exige cliente con NIF.
- **Anular tras enviar a cocina ≠ borrar antes**: anular exige motivo
  (`cancel_reason`) y queda en informes.
- **Creación rápida** (guía 07): botón `+ Nuevo` al final del grid → modal de
  3 campos (nombre, precio, categoría preseleccionada); TODO lo demás se hereda
  de la familia (clase fiscal → `ivaAuto`, color, estación). Long-press sobre un
  producto → editar precio/nombre/**Agotado hoy** (`product.agotado_hasta`,
  botón gris "AGOTADO", nunca oculto ni movido de sitio). PIN de encargado si el
  operario es camarero. Precio NULL = pedir precio al vender.

## Reglas que no se rompen

1. **Fiscal**: los precios de carta llevan impuesto INCLUIDO;
   `calcularImpuestosIncluidos` de `@gluuh/core` desglosa hacia atrás. El % por
   producto se resuelve por clase fiscal × territorio (`ivaAuto`). Jamás
   hardcodear un %.
2. **Cobro = factura**: con VERIFACTU activo, no se imprime ticket sin que
   `/api/factura` haya persistido y encadenado. Si falla, el pedido queda
   `POR_COBRAR` y se reintenta; el cobro nunca se pierde.
3. **Táctil** (cifras verificadas, doc 09 §9.6): botones de carta ≥ 1×1 cm
   físico; Cobrar/Enviar ~2×2 cm; 8-10 mm entre acciones opuestas; toque pintado
   en < 100 ms (UI optimista local: la red NUNCA en el camino del render); el
   feedback fuera del dedo (resaltar la línea añadida en el ticket).
4. **Impresión**: si `window.gluuh` existe (app de escritorio), usar
   `window.gluuh.imprimir(PrintJob)`; si no, `window.print()` (CSS 80 mm actual).
5. Español en código/UI, TypeScript estricto, tests Vitest junto al fichero.
