# Plan 008: Reconstruir la pantalla TPV con el layout y la funcionalidad del TPV clásico de hostelería (estilo Ágora)

> **Executor instructions**: Sigue el plan. Toca solo `apps/web/app/tpv/page.tsx`. NO cambies el
> esquema de BD ni las rutas API. Conserva la lógica de datos existente (queries, cobro, cocina) y
> reorganízala en el nuevo layout + añade el teclado y la barra de acciones. Verifica typecheck + build.
> Si algo de "STOP conditions" ocurre, detente e informa. No actualices `plans/README.md`.

## Status
- **Priority**: P1 | **Effort**: L | **Risk**: MED | **Depends on**: 005 (sistema de diseño, ya en main) | **Category**: feature/UI
- **Planned at**: commit `590b4a3`, 2026-06-15

## Why this matters
El objetivo de diseño del TPV es el **TPV clásico de hostelería estilo Ágora** (referencia del usuario):
columna de ticket + teclado numérico a la izquierda, rejilla de **categorías a color** a la derecha, y
**barra de acciones** abajo (Cobrar en Efectivo, Imprimir, Preparar, Marchar, Entregar Comanda, Pagos…).
La pantalla actual funciona pero tiene un layout genérico de "carta + carrito". Este plan la reconstruye
al patrón Ágora y añade el teclado funcional (cantidades, descuentos, precio manual, cancelar línea),
reutilizando la lógica de datos/cobro/cocina que YA existe.

## Current state
Fichero único: `apps/web/app/tpv/page.tsx` (client component). Hoy hace:
- Carga sesión, `location` (id, territorio_fiscal), `app_user` (id), `restaurant_table` (mesas),
  `category` (cats), `product` (prods: id, nombre, precio, tipo_impositivo, category_id, disponible=true).
- Pantalla de selección mesa/barra → pantalla de venta (tabs de categoría + grid de productos + aside de cuenta).
- Estado: `comanda: Record<productId, cantidad>`, `total` (useMemo), `add/sub`.
- `crearOrden(estado, estadoPrep)` inserta en `sales_order` (+ `order_line`).
- `enviarCocina()` → crearOrden("ENVIADA_COCINA","PENDIENTE") + marca mesa OCUPADA.
- `cobrar(metodo)` → POST `/api/ticket` (body `{territorio, lineas:[{precio,tipo,cantidad}]}`) → crea orden
  COBRADA + `payment` + mesa LIBRE → muestra modal con QR VERIFACTU (`ticket.verifactu.qrDataUrl`, `numSerieFactura`).
- Helper `lineasComanda()` devuelve `[{id,nombre,cantidad,precio,tipo}]`.
- `TERR` mapea territorios forales a PENINSULA_BALEARES para el motor fiscal.

**Datos de color para las categorías**: la tabla `family` (migración 0012) tiene columna `color` y
`category.family_id` referencia a `family`. Puedes cargar `family` (id, nombre, color) y colorear cada
categoría con el color de su familia; si una categoría no tiene familia, usa un color neutro del tema.

Sistema de diseño disponible (plan 005, ya en main): tokens (`bg-card`, `text-foreground`,
`bg-brand`…), `apps/web/DESIGN.md`, primitivos en `@/components/ui/*`. Iconos: `lucide-react` (ya es dependencia).

## Commands you will need
| Instalar | `pnpm install` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Build web | `pnpm --filter @gluuh/web build` | exit 0 (necesita `.env.local`, ver Step 0) |

## Scope
**In scope**: `apps/web/app/tpv/page.tsx` (reescritura del componente).
**Out of scope** (NO tocar): esquema BD / migraciones; rutas API (`/api/ticket`); otros componentes/pantallas;
`globals.css`. NO añadas columnas ni cambies contratos de datos.

## Git workflow
- Rama: `advisor/008-tpv-estilo-agora`
- Conventional commits, p. ej. `feat(tpv): layout estilo Ágora + teclado (DTO/CAN/PREC) + barra de acciones`.
- No push ni PR.

## Steps

### Step 0 (base + entorno)
1. `git reset --hard 590b4a3` (es el HEAD de `main`; está en el object store compartido).
2. Verifica `git rev-parse --short HEAD` → `590b4a3`. Si no, STOP.
3. `pnpm install` (exit 0).
4. Crea `apps/web/.env.local` con PLACEHOLDERS (gitignored, no secretos) para poder construir:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder0000000000
   SUPABASE_SECRET_KEY=sb_secret_placeholder0000000000
   SUPABASE_SERVICE_ROLE_KEY=placeholder
   ```
5. `pnpm --filter @gluuh/web typecheck` → exit 0 (estado base).

### Step 1: Cargar color de categorías
Añade a la carga inicial una query de `family` (`id,nombre,color`). Crea un mapa
`colorCategoria(categoryId)` = color de la familia de esa categoría (vía `category.family_id`), con
fallback a un color neutro. (Carga `category` con `family_id`: `select id,nombre,orden,family_id`.)
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 2: Layout estilo Ágora (3 zonas)
Reescribe la pantalla de venta (tras elegir mesa/barra) con esta estructura, usando tokens del tema:
- **Cabecera** con barra de acento de color (`bg-brand` o el color de la mesa/familia): muestra nombre
  de mesa/barra, referencia, camarero (nombre de `app_user` si lo tienes; si no, omítelo) y fecha.
- **Cuerpo en dos columnas**:
  - **Izquierda (ticket + teclado)**: lista de líneas con columnas `Uds | Producto | Precio | Total`
    (cada línea seleccionable al tocarla → línea activa resaltada). Debajo, **Total grande** en € muy
    visible (`text-3xl/4xl font-bold tabular-nums`). Debajo, **teclado numérico**: botones `7 8 9`,
    `4 5 6`, `1 2 3`, `0`, `,`, y los especiales `DTO%`, `DTO €`, `CAN`, `CLR`, `PREC`.
  - **Derecha (categorías → productos)**: rejilla de **tiles de categoría a color** (color del Step 1)
    con icono `lucide` (usa uno genérico como `Utensils`/`Coffee`/`Beer` o el mismo para todas si no
    hay mapeo claro) y el nombre. Al tocar una categoría, muestra sus productos como tiles (nombre +
    precio). Mantén un botón para volver a categorías.
- **Barra inferior de acciones** (fija abajo): `Cobrar en Efectivo`, `Imprimir`, `Preparar`, `Marchar`,
  `Entregar Comanda`, `Pagos`, `Volver`. (Ver Step 4 para qué hace cada una.)
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 3: Teclado funcional (estado del buffer numérico)
Añade estado `buffer: string` (lo que se teclea) y `lineaSel: string | null` (id de producto de la línea
activa). Comportamiento:
- Dígitos y `,` → concatenan al `buffer` (muestra el buffer en el teclado).
- Tocar un **producto** → añade `Number(buffer) || 1` unidades de ese producto a la comanda; vacía el buffer.
- Tocar una **línea** del ticket → `lineaSel = id`.
- `CLR` → vacía el buffer (y deselecciona la línea).
- `CAN` → elimina del ticket la línea seleccionada (`lineaSel`).
- `DTO %` → aplica `Number(buffer)`% de descuento a la línea seleccionada (o a toda la comanda si no hay
  línea seleccionada). Guarda el descuento en estado cliente (p. ej. `descuentos: Record<id,{tipo:'PCT'|'EUR',valor:number}>`).
- `DTO €` → igual pero descuento en €.
- `PREC` → fija el precio unitario de la línea seleccionada a `Number(buffer.replace(',','.'))` (precio manual;
  guárdalo en estado cliente `preciosManuales: Record<id,number>` y úsalo en los cálculos).
- El **Total** y las líneas reflejan precio manual y descuentos.
> Los descuentos y precios manuales viven en estado cliente y afectan al **precio efectivo** que se envía
> a cobro/cocina; NO se persisten como columnas nuevas (sin cambios de esquema). Documenta esto en NOTES.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 4: Cablear la barra de acciones a la lógica existente
- **Cobrar en Efectivo** → `cobrar("Efectivo")` (reutiliza la función actual; pásale los precios efectivos
  ya con descuento/precio manual aplicados en `lineasComanda`).
- **Pagos** → abre un pequeño selector con `Tarjeta`/`Bizum`/`Efectivo` que llama a `cobrar(metodo)`.
- **Imprimir** → tras cobrar, permite imprimir el ticket: usa `window.print()` (o abre el modal del ticket
  y un botón Imprimir que llame a `window.print()`). No integres hardware ESC/POS (fuera de alcance).
- **Preparar** → `enviarCocina()` con estado_preparacion "PENDIENTE" (manda la comanda a cocina; ya existe).
- **Marchar** → envía/actualiza a estado_preparacion "EN_PREPARACION" (marcar para empezar a preparar).
- **Entregar Comanda** → estado_preparacion "ENTREGADO".
  (Para Marchar/Entregar puedes reutilizar `crearOrden`/un update de estado análogo a `enviarCocina`;
  si requiere lógica nueva compleja de actualización por orden existente, implementa la versión simple:
  crear la orden con ese estado_preparacion. No inventes flujos que toquen otras pantallas.)
- **Volver** → `reset()` (vuelve a selección de mesa/barra).
- Conserva intactos: el cálculo fiscal vía `/api/ticket`, el modal del ticket con QR VERIFACTU, el
  `payment` insert y el cambio de estado de mesa.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 5: Verificación final
```
pnpm --filter @gluuh/web typecheck   # exit 0
pnpm --filter @gluuh/web build       # exit 0 (con .env.local)
```
Comprueba que en `tpv/page.tsx` no hay literales de paleta gris (`bg-slate-`, `text-slate-`, etc.) —
usa tokens y los colores de familia (que vienen de datos, en `style={{}}`).

## Test plan
- No hay tests de UI. Verificación = typecheck 0 + build 0 + revisión de que las acciones llaman a la
  lógica correcta. La lógica de cobro/fiscal/cocina se reutiliza, no se reescribe.
- (Tras el merge, el usuario validará visualmente y el flujo en `localhost:3100/tpv`.)

## Done criteria (NO actualices plans/README.md)
- [ ] `pnpm --filter @gluuh/web typecheck` exit 0 y `pnpm --filter @gluuh/web build` exit 0.
- [ ] La pantalla de venta tiene: ticket (`Uds|Producto|Precio|Total`), Total grande, teclado con `DTO% DTO€ CAN CLR PREC`, rejilla de categorías a color, y barra de acciones (Cobrar Efectivo, Imprimir, Preparar, Marchar, Entregar, Pagos, Volver).
- [ ] El teclado funciona: cantidad antes de tocar producto; CAN borra línea; CLR limpia; DTO%/€ y PREC afectan al total.
- [ ] Cobrar genera el ticket fiscal con QR (lógica `/api/ticket` intacta) e Imprimir hace `window.print()`.
- [ ] Solo `apps/web/app/tpv/page.tsx` modificado.
- [ ] Sin literales de paleta gris en el fichero.

## STOP conditions
- El fichero actual no coincide con "Current state" (deriva) → informa.
- Implementar Marchar/Entregar requeriría tocar otras pantallas o el esquema → implementa la versión
  simple (crear orden con ese estado_preparacion) y documéntalo; no salgas de alcance.
- `build` falla por algo real en tu reescritura → arréglalo; si no logras tras un intento razonable, STOP e informa.

## Maintenance notes
- Descuentos y precio manual son estado cliente (afectan al precio efectivo cobrado y al ticket fiscal),
  no se persisten en columnas nuevas. Si en el futuro se quiere histórico de descuentos, añadir columnas a
  `order_line` (fuera de alcance aquí).
- Impresión: hoy `window.print()`; la integración ESC/POS real es trabajo aparte (roadmap hardware).
- Para el revisor: confirmar que la lógica fiscal/cobro/cocina se reutiliza intacta y que el layout
  coincide con la referencia Ágora (ticket+teclado izq, categorías color dcha, acciones abajo).
