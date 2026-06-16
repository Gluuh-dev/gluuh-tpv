# Plan 007: Pulido del backoffice contra el sistema de diseño

> **Executor instructions**: Sigue el plan. Toca solo los ficheros en alcance. Aplica `apps/web/DESIGN.md`.
> Verifica typecheck + build al final. STOP conditions aplican. No actualices `plans/README.md`.

> **Base**: se construye SOBRE la fundación (plan 005); tu Step 0 te pone en el commit que la incluye.

## Status
- **Priority**: P2 | **Effort**: M | **Risk**: LOW | **Depends on**: 005 | **Category**: dx (rediseño UI)
- **Planned at**: commit `09857da` (+ fundación 005), 2026-06-15

## Why this matters
El backoffice (`(panel)/*`) ya usa tokens y está cercano al estilo Supabase, pero de forma desigual:
encabezados de página ad-hoc, tarjetas con estilos repetidos, estados vacíos inconsistentes. Este plan
lo homogeneiza usando los primitivos del plan 005 (`PageHeader`, `StatCard`, `EmptyState`) para que todo
el panel tenga el mismo ritmo, densidad y aspecto profesional, sin tocar lógica.

## Current state
- Lee `apps/web/DESIGN.md` (reglas + primitivos). Primitivos: `@/components/ui/{page-header,stat-card,empty-state,...}`.
- El layout del panel (`apps/web/app/(panel)/layout.tsx`) ya tiene sidebar con secciones, tokens y toggle
  de tema — está bien; tócalo solo para detalles menores (p. ej. enlace activo con `bg-brand/10` si mejora).
- Las páginas ya usan tokens (`text-muted-foreground`, `Card`, etc.) pero cada una arma su cabecera a mano
  (`<h1 className="text-2xl font-semibold">…</h1>` + `<p className="text-muted-foreground">`).

### Ficheros y su rol
- `apps/web/app/(panel)/dashboard/page.tsx` — inicio con KPIs (candidato a `StatCard`).
- `apps/web/app/(panel)/carta/page.tsx` — familias→categorías→productos.
- `apps/web/app/(panel)/sala/page.tsx` — plano de mesas.
- `apps/web/app/(panel)/empleados/page.tsx` — empleados/PIN.
- `apps/web/app/(panel)/personalizar/page.tsx` — branding/ofertas.
- `apps/web/app/(panel)/informes/page.tsx` — informes (candidato a `StatCard`).
- `apps/web/app/(panel)/ajustes/page.tsx` — ajustes.
- `apps/web/app/(panel)/layout.tsx` — shell del panel (retoques menores opcionales).

## Commands you will need
| Instalar | `pnpm install` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Build web | `pnpm --filter @gluuh/web build` | exit 0 (necesita env, ver Step 0) |

## Scope
**In scope**: los 8 ficheros listados arriba.
**Out of scope** (NO tocar):
- `globals.css`, `components/ui/*`, `DESIGN.md` (plan 005).
- Pantallas NO-panel (operativas/públicas — son el plan 006).
- Cualquier lógica: queries Supabase, Realtime, handlers, estados, navegación.
- `lib/*`, rutas API.

## Git workflow
- Rama: `advisor/007-pulido-backoffice`
- Conventional commits, p. ej. `style(panel): homogeneizar cabeceras y KPIs con primitivos`.
- No push ni PR.

## Steps

### Step 0 (base + entorno)
1. `git reset --hard a8f95bc` (incluye 001–005; en el object store compartido).
2. Verifica `git rev-parse --short HEAD` → `a8f95bc`. Si no, STOP ("base fix failed").
3. `pnpm install` (exit 0).
4. Crea `apps/web/.env.local` con PLACEHOLDERS (gitignored, no secretos) para poder construir:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder0000000000
   SUPABASE_SECRET_KEY=sb_secret_placeholder0000000000
   SUPABASE_SERVICE_ROLE_KEY=placeholder
   ```
5. Estado base verde: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 1: Cabeceras con `PageHeader`
En cada página del panel que tenga una cabecera ad-hoc (título + descripción), sustitúyela por
`<PageHeader title="…" description="…" actions={…} />` (import desde `@/components/ui/page-header`).
Mueve los botones de acción de la cabecera al prop `actions`.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 2: KPIs con `StatCard`
En `dashboard/page.tsx` e `informes/page.tsx`, donde se muestren métricas/KPIs en tarjetas, usa
`<StatCard label value hint icon />` (import desde `@/components/ui/stat-card`) en lugar de tarjetas
ad-hoc. Conserva exactamente los datos/valores que ya se calculan (no cambies la lógica de cálculo).
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 3: Estados vacíos y consistencia
- Donde haya listas que pueden estar vacías (carta sin productos, sala sin mesas, empleados, informes
  sin datos), usa `<EmptyState title description action />` en vez de textos sueltos tipo "No hay…".
- Repasa que todas las páginas usen tokens (sin `text-slate-*`/`bg-slate-*` sueltos) y radios del tema.
- Ritmo: contenedor de página `space-y-6`; tarjetas `rounded-lg border border-border` + `p-4/p-5`.
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 4: Verificación final
```
pnpm --filter @gluuh/web typecheck   # exit 0
pnpm --filter @gluuh/web build       # exit 0
grep -rnE "bg-slate-|text-slate-|bg-zinc-|text-zinc-|bg-gray-|text-gray-" apps/web/app/\(panel\)/   # 0 coincidencias
```

## Test plan
- Sin tests de UI. Verificación = typecheck 0 + build 0 + grep sin literales de paleta gris en `(panel)/`.
- Lógica intacta → comportamiento conservado.

## Done criteria (NO actualices plans/README.md)
- [ ] `pnpm --filter @gluuh/web typecheck` exit 0 y `pnpm --filter @gluuh/web build` exit 0.
- [ ] `PageHeader` usado en las páginas del panel con cabecera; `StatCard` en dashboard/informes; `EmptyState` en listas vacías.
- [ ] `grep` de literales de paleta gris en `(panel)/` → 0 coincidencias.
- [ ] Ninguna lógica modificada (queries/handlers intactos).
- [ ] Solo ficheros en "In scope" modificados.

## STOP conditions
- Un fichero no coincide con su descripción (deriva) → informa.
- Aplicar un primitivo obligaría a cambiar lógica de datos → conserva la lógica, adapta solo la presentación; si no encaja, deja esa parte como está y documenta en NOTES.
- `build` falla por algo real en una página que tocaste → arréglalo si es tuyo; si no, STOP e informa.

## Maintenance notes
- Al introducir el color de marca (`--brand`), botones primarios del panel lo tomarán solos.
- Para el revisor: confirmar que el panel se ve homogéneo (mismas cabeceras/tarjetas) y que no se tocó lógica.
