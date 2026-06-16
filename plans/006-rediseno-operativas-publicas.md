# Plan 006: Rediseño profesional (estilo Supabase) de las pantallas operativas y públicas

> **Executor instructions**: Sigue el plan. Toca solo los ficheros en alcance. Aplica las reglas
> de `apps/web/DESIGN.md`. Verifica typecheck + build al final. Si algo de "STOP conditions" ocurre,
> detente e informa. No actualices `plans/README.md`. Audita cada afirmación contra un resultado real.

> **Base**: este plan se construye SOBRE la fundación de diseño (plan 005). Tu Step 0 te pondrá en
> el commit correcto que ya la incluye.

## Status
- **Priority**: P1 | **Effort**: L | **Risk**: MED | **Depends on**: 005 | **Category**: dx (rediseño UI)
- **Planned at**: commit `09857da` (+ fundación 005), 2026-06-15

## Why this matters
Las pantallas operativas (kiosko, kds/cocina, pantalla/display, ofertas, tpv, comandera) usan hoy
colores Tailwind hardcodeados (`bg-slate-900`, `text-white`, `text-slate-400`…) que **ignoran el
tema** (no responden a claro/oscuro) y dan un aspecto inconsistente con el backoffice. Las públicas
(login, registro, landing, admin) están mejor pero con detalles sueltos. Este plan las lleva todas
al sistema de tokens y a un estilo profesional, sobrio y coherente tipo Supabase, manteniendo la
funcionalidad intacta.

## Current state
- Sistema de diseño y reglas: **lee `apps/web/DESIGN.md`** (creado en el plan 005). Es la fuente de
  verdad de este trabajo. Primitivos disponibles: `@/components/ui/{page-header,stat-card,empty-state,
  button,card,input,label,select,dialog,table,badge,textarea}`.
- Tokens semánticos disponibles (de `globals.css`): `bg-background text-foreground bg-card
  text-card-foreground text-muted-foreground border-border bg-muted bg-accent text-accent-foreground
  bg-primary text-primary-foreground bg-brand text-brand-foreground text-destructive bg-destructive/10`.
- Las pantallas son client components (`"use client"`), usan `supabaseBrowser()` y Realtime. **No
  cambies su lógica** (queries, estados, handlers) — solo su presentación/markup/clases.
- Ejemplo del problema (no es exhaustivo): `apps/web/app/cocina/page.tsx` usa `bg-slate-900`,
  `bg-slate-800`, `text-white`, `text-slate-400` directamente.

### Ficheros y su rol (léelos antes de tocarlos)
Operativas a pantalla completa (hoy fuerzan oscuro con slate):
- `apps/web/app/cocina/page.tsx` — KDS de cocina (tarjetas de comanda, estados).
- `apps/web/app/pantalla/page.tsx` — display de cliente (pedidos listos).
- `apps/web/app/kiosko/page.tsx` — kiosko de autopedido (catálogo + carrito).
- `apps/web/app/ofertas/page.tsx` — cartelería de ofertas.
- `apps/web/app/kds/page.tsx` — comprueba qué hace (puede reexportar cocina).
Operativas tipo TPV:
- `apps/web/app/tpv/page.tsx` — TPV de navegador (productos + ticket).
- `apps/web/app/comandera/page.tsx` — comandera móvil.
Públicas:
- `apps/web/app/login/page.tsx` — tiene un `text-slate-400` suelto (línea ~56).
- `apps/web/app/registro/page.tsx`
- `apps/web/app/page.tsx` — landing.
- `apps/web/app/admin/page.tsx` — alta de empresas (solo admin plataforma).

## Commands you will need
| Instalar | `pnpm install` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Build web | `pnpm --filter @gluuh/web build` | exit 0 (necesita env, ver Step 0) |

## Scope
**In scope** (solo presentación; uno o varios commits):
- Los 11 ficheros listados arriba en "Ficheros y su rol".
**Out of scope** (NO tocar):
- `globals.css`, `components/ui/*`, `DESIGN.md` (son del plan 005; ya están bien).
- `(panel)/*` (backoffice — es el plan 007).
- Cualquier lógica: queries Supabase, Realtime, handlers, estados, navegación, validaciones.
- `lib/*`, rutas API.

## Git workflow
- Rama: `advisor/006-rediseno-operativas-publicas`
- Conventional commits, p. ej. `style(web): rediseñar cocina/pantalla/kiosko con tokens del tema`.
- Puedes commitear por grupos de pantallas. No push ni PR.

## Steps

### Step 0 (base + entorno)
1. `git reset --hard a8f95bc` (commit que incluye 001–005; está en el object store compartido).
2. Verifica `git rev-parse --short HEAD` → `a8f95bc`. Si no, STOP ("base fix failed").
3. `pnpm install` (exit 0). Si un build posterior falla por hoisting de `@radix-ui`/`radix-ui`, NO es tu código.
4. **Para poder correr `pnpm --filter @gluuh/web build`** necesitas variables de entorno (las pantallas
   inicializan Supabase en build). Crea `apps/web/.env.local` con PLACEHOLDERS (no son secretos):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder0000000000
   SUPABASE_SECRET_KEY=sb_secret_placeholder0000000000
   SUPABASE_SERVICE_ROLE_KEY=placeholder
   ```
   (Este fichero es local y gitignored; no se commitea.)
5. Confirma estado base verde: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 1: Pantallas operativas a pantalla completa (cocina, pantalla, kiosko, ofertas, kds)
Para CADA una, lee el fichero y reescribe SOLO el markup/clases siguiendo `DESIGN.md`:
- Sustituye TODO color hardcodeado por tokens: `bg-slate-900`→`bg-background`, `bg-slate-800`→`bg-card`,
  `text-white`→`text-foreground`, `text-slate-400/300`→`text-muted-foreground`, bordes→`border-border`.
- Estas pantallas pueden ir en **oscuro permanente** (cocina/pantalla/kds son para monitores): envuelve
  el contenedor raíz en `<div className="dark">` (o añade `className="dark"` al `<main>`) para forzar el
  tema oscuro vía tokens — NUNCA con `bg-slate-*` literal. Así el contraste es alto y sigue siendo theme-driven.
- Estados de preparación / colores de estado: usa los tokens semánticos o las variables `--chart-*` ya
  definidas; evita hexadecimales sueltos salvo los que ya vengan de datos (p. ej. color de oferta del tenant).
- Jerarquía profesional: cabecera clara, tarjetas con `rounded-lg border border-border`, tipografía
  `text-2xl font-semibold tracking-tight` para títulos, `tabular-nums` para números/importes/tiempos.
- Toque: botones grandes (`size="lg"`), buen espaciado; kiosko es táctil.
**Verify**: tras cada pantalla, `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 2: TPV y comandera
Misma operación en `tpv/page.tsx` y `comandera/page.tsx`: tokens del tema, primitivos donde encaje
(`EmptyState` para carrito vacío, `Button` para acciones, `Card` para el ticket). Mantén el layout de
dos columnas (catálogo / ticket) si ya lo tiene; púlelo. Acción de cobro = `bg-brand`.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 3: Públicas (login, registro, landing, admin)
- `login/page.tsx`: reemplaza el `text-slate-400` suelto por `text-muted-foreground`; revisa que todo
  use tokens.
- `registro/page.tsx`, `admin/page.tsx`: alinéalas al estilo del login (Card centrada, `PageHeader`
  donde aplique, tokens).
- `page.tsx` (landing): aspecto profesional y sobrio; puede seguir usando la escala índigo de marca
  (`brand-600`) que ya existe para la landing, pero el resto en tokens. No rompas enlaces/CTA.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 4: Verificación final
```
pnpm --filter @gluuh/web typecheck   # exit 0
pnpm --filter @gluuh/web build       # exit 0 (con el .env.local de placeholders)
```
Y comprueba que NO quedan colores hardcodeados de paleta en los ficheros en alcance:
```
grep -rnE "bg-slate-|text-slate-|bg-zinc-|text-zinc-|bg-gray-|text-gray-|text-white|bg-white|bg-black" \
  apps/web/app/{cocina,pantalla,kiosko,ofertas,kds,tpv,comandera,login,registro,admin,page}.tsx \
  apps/web/app/cocina/page.tsx 2>/dev/null
```
Ajusta el comando a las rutas reales; el objetivo: **0 coincidencias** de esos literales en las pantallas
en alcance (excepción tolerada: `page.tsx` landing si reutiliza la escala `brand-*` de marca — eso NO es
un literal de paleta gris, así que no saldrá en el grep).

## Test plan
- No hay tests de UI. Verificación = typecheck 0 + build 0 + grep sin literales de paleta gris/blanco/negro.
- La lógica no se toca, así que el comportamiento se conserva (mismo árbol de datos/handlers).

## Done criteria (NO actualices plans/README.md)
- [ ] `pnpm --filter @gluuh/web typecheck` exit 0.
- [ ] `pnpm --filter @gluuh/web build` exit 0.
- [ ] `grep` de literales `bg-slate-/text-slate-/text-white/bg-white/...` en los ficheros en alcance → 0 coincidencias (salvo escala `brand-*` en landing).
- [ ] Todas las pantallas usan tokens y los primitivos del plan 005 donde encaja.
- [ ] Ninguna lógica modificada (queries/Realtime/handlers intactos) — `git diff` muestra solo cambios de markup/clases.
- [ ] Solo ficheros en "In scope" modificados.

## STOP conditions
- Un fichero en alcance no coincide con su descripción (deriva grande) → informa.
- Aplicar tokens obligaría a cambiar lógica (p. ej. un color viene de datos del tenant y no hay token) →
  para ese caso conserva el valor de datos (no es un literal de paleta) y continúa; documenta en NOTES.
- `build` falla por algo que NO sea env/radix del worktree (un error real en una pantalla que tocaste) →
  arréglalo si es tuyo; si no logras, STOP e informa qué pantalla y el error.

## Maintenance notes
- Cuando se introduzca el color de marca (token `--brand` en globals.css), los botones primarios y
  acciones de cobro lo tomarán automáticamente.
- Para el revisor: confirmar que NO se tocó lógica (solo presentación) y que claro/oscuro funciona en
  las pantallas migradas (las de monitor van en oscuro forzado vía `.dark`, no vía slate literal).
