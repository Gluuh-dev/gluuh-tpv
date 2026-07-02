# 02 — Refactor del TPV (trocear el monolito)

**Objetivo:** dividir `apps/web/app/tpv/page.tsx` (1.298 líneas) en componentes y
hooks **sin cambiar ningún comportamiento**, para que las guías 05 (paridad Glop) y
07 (creación rápida) tengan dónde apoyarse. Regla de oro: en esta tarea no se añade
ni una feature; si un diff no es "mover código", no pertenece aquí.

## Estructura destino

```
apps/web/app/tpv/
  page.tsx                 ← composición y poco más (~150 líneas)
  components/
    GateOperario.tsx       ← selección de usuario + PIN (RPC validar_pin/listar_operarios)
    SelectorZona.tsx       ← menú lateral salas / barra / para llevar / reservas
    PlanoSala.tsx          ← plano SVG interactivo (mesas, estados, saldos, reservas long-press)
    GridProductos.tsx      ← categorías + grid de productos
    Ticket.tsx             ← líneas, selección, editor de línea (± / nota / eliminar)
    Teclado.tsx            ← KEYPAD_ROWS, DTO%, DTO€, PREC, CLR, CAN
    ModalCobroEfectivo.tsx ← entregado, botones rápidos, cambio
    ModalPagos.tsx         ← métodos, propina, pago mixto
    ModalReserva.tsx       ← crear/editar/borrar reserva de mesa
    TicketImpreso.tsx      ← el recibo 80 mm oculto para window.print()
  hooks/
    useOperario.ts         ← operario activo + localStorage gluuh_operario
    useComanda.ts          ← estado del ticket: líneas, descuentos, preciosManuales,
                             precioEfectivo, total, alta/edición/borrado de línea
    useMesas.ts            ← salas, mesas, plano_elemento, estados, cuenta abierta por mesa
```

Notas:
- Los tipos compartidos del TPV (línea de ticket, descuento, contexto de venta) van en
  `apps/web/app/tpv/types.ts` — no a `@gluuh/core` (son de UI, no de dominio).
- `useComanda` es el corazón: absorbe `descuentos`, `preciosManuales` y el cálculo de
  `precioEfectivo` que hoy están sueltos en el componente. Es el único hook con lógica
  de verdad → **añadirle test Vitest** (`useComanda.test.ts` con `renderHook`):
  alta de línea, descuento % y €, precio manual, total.
- Los modales comparten hoy JSX repetido: extraer un `ModalTpv` contenedor solo si al
  moverlos queda duplicación evidente; no diseñar un sistema de modales.

## Método (para no romper nada)

1. Un componente por commit, del más hoja al más raíz: `Teclado` → `Ticket` →
   `GridProductos` → modales → `PlanoSala` → `GateOperario` → hooks al final.
2. Tras cada extracción: `pnpm --filter @gluuh/web typecheck` + humo manual del flujo
   completo (abrir mesa → líneas → descuento → cobrar → ticket).
3. Prohibido "aprovechar para": renombrar variables, cambiar estilos o arreglar bugs
   descubiertos (anotarlos y abrir tarea aparte).
4. `git mv`/copias literales primero, imports después; el diff de cada commit debe
   leerse como movimiento, no como reescritura.

## Criterios de aceptación

- [ ] `page.tsx` < 200 líneas; ningún fichero nuevo > 350.
- [ ] Cero cambios visibles: mismo flujo de venta, cobro, reservas y para llevar.
- [ ] `useComanda.test.ts` cubre línea/descuentos/precio manual/total y pasa.
- [ ] `pnpm typecheck` y `pnpm test` en verde.
