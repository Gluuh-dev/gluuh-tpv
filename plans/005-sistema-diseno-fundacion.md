# Plan 005: Fundación del sistema de diseño (tokens, acento de marca intercambiable, primitivos compartidos, convenciones)

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada verificación y
> confirma el resultado esperado antes de continuar. Toca solo los ficheros en alcance.
> Si ocurre algo de "STOP conditions", detente e informa. No actualices `plans/README.md`
> (lo hace tu revisor). Antes de reportar, audita cada afirmación contra un resultado real.

> **Drift check (primero)**:
> `git diff --stat 09857da..HEAD -- apps/web/app/globals.css apps/web/components/ui/button.tsx apps/web/app/(panel)/layout.tsx`
> Si algún fichero en alcance cambió, compara los extractos de "Current state" con el código real; si no coinciden, STOP.

## Status
- **Priority**: P1 | **Effort**: M | **Risk**: LOW | **Depends on**: none | **Category**: dx (design system)
- **Planned at**: commit `09857da`, 2026-06-15

## Why this matters
Se va a rediseñar TODAS las pantallas de la web con un estilo profesional tipo Supabase
(superficies neutras, poco redondeo, densidad alta, claro/oscuro). El backoffice (`(panel)/*`)
y el login ya usan el sistema de tokens; las pantallas operativas (kiosko/kds/pantalla/cocina/
tpv/comandera/ofertas) usan colores Tailwind hardcodeados (`bg-slate-900`, `text-white`, etc.)
que ignoran el tema. Antes de tocar 18 pantallas hay que **fijar el sistema de diseño** para
que todas hereden coherencia. Decisión de producto tomada: **el acento se mantiene NEUTRO por
ahora**, pero debe quedar como **un único token intercambiable** (`--brand`) para introducir el
color del logo más adelante con un cambio de una línea. Este plan es la keystone: los planes
006/007 (pantallas) dependen de él. Es de bajo riesgo porque el acento neutro = el primary
actual, así que no hay cambio visual hoy.

## Current state

### El tema vive en `apps/web/app/globals.css` (Tailwind 4, CSS-first)
Bloque `@theme inline` registra tokens semánticos shadcn. Extractos relevantes:
```css
/* globals.css:6-9 */
@theme inline {
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-heading: var(--font-sans);
  /* Tokens semánticos (shadcn) */
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  ...
/* globals.css:44-51 — escala índigo LEGADA (landing); NO la toques */
  --color-brand-50: #eef2ff; ... --color-brand-800: #3730a3;
```
```css
/* globals.css:63-98 — :root (claro) */
:root {
  --primary: oklch(0.205 0 0);            /* neutro casi-negro */
  --primary-foreground: oklch(0.985 0 0);
  ...
  color-scheme: light;
}
/* globals.css:100-120 — .dark */
.dark {
  --primary: oklch(0.922 0 0);            /* neutro casi-blanco */
  --primary-foreground: oklch(0.205 0 0);
  ...
}
```
> Nota: existe una escala `--color-brand-50..800` (índigo) usada por la landing. Es DISTINTA del
> token `--brand` que crea este plan (utilidades `bg-brand-500` vs `bg-brand` no colisionan). No
> elimines la escala índigo en este plan.

### Botón (shadcn) — variante por defecto
```tsx
// apps/web/components/ui/button.tsx:12
default: "bg-primary text-primary-foreground hover:bg-primary/80",
```

### Tema claro/oscuro YA funciona
`apps/web/app/providers.tsx` usa `next-themes` (`attribute="class"`, `defaultTheme="system"`).
`apps/web/components/theme-toggle.tsx` existe y se usa en el panel y el login.

### Convención de primitivos
Los componentes viven en `apps/web/components/ui/*` (shadcn, con `data-slot`, importan `cn` de
`@/lib/utils` y usan `radix-ui`). Exemplar: `apps/web/components/ui/button.tsx`. Las pantallas
importan con alias `@/components/ui/...` y `@/lib/...`.

## Commands you will need
| Instalar | `pnpm install` | exit 0 |
| Build web | `pnpm --filter @gluuh/web build` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 |

> Nota worktree: si `pnpm --filter @gluuh/web build` falla por dependencias `@radix-ui`/`radix-ui`
> en un primer install dentro del worktree, ejecuta `pnpm install` de nuevo; es un artefacto de
> hoisting del worktree, no del código. El build pasa en limpio.

## Scope
**In scope**:
- `apps/web/app/globals.css` (añadir tokens `--brand`/`--brand-foreground` + registrarlos en `@theme inline`)
- `apps/web/components/ui/button.tsx` (variante `default` → usa brand)
- `apps/web/components/ui/page-header.tsx` (crear)
- `apps/web/components/ui/stat-card.tsx` (crear)
- `apps/web/components/ui/empty-state.tsx` (crear)
- `apps/web/DESIGN.md` (crear — guía de convenciones para los planes 006/007)

**Out of scope** (NO tocar):
- La escala índigo legada `--color-brand-50..800` en globals.css.
- Cualquier pantalla (`app/**/page.tsx`, layouts) — eso es 006/007.
- Otros componentes de `components/ui/*` salvo `button.tsx`.
- `providers.tsx`, `theme-toggle.tsx` — el tema ya funciona.

## Git workflow
- Rama: `advisor/005-sistema-diseno-fundacion`
- Conventional commits, p. ej. `feat(ui): token de acento intercambiable + primitivos de layout`.
- No push ni PR.

## Steps

### Step 1: Token de acento de marca intercambiable (neutro hoy)
En `apps/web/app/globals.css`:

(a) En `@theme inline`, junto a `--color-primary`, registra el token de utilidad:
```css
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
```
(b) En `:root` (claro), añade — con comentario bien visible — el acento NEUTRO (igual al primary actual):
```css
  /* === ACENTO DE MARCA (intercambiable) ===========================================
     Hoy NEUTRO (= primary). Para introducir el color del logo más adelante, cambia
     SOLO estas dos líneas aquí y sus equivalentes en el bloque .dark de abajo. ===== */
  --brand: oklch(0.205 0 0);
  --brand-foreground: oklch(0.985 0 0);
```
(c) En `.dark`, añade el equivalente neutro oscuro:
```css
  --brand: oklch(0.922 0 0);
  --brand-foreground: oklch(0.205 0 0);
```
**Verify**: `grep -n "\-\-brand" apps/web/app/globals.css` → al menos 5 coincidencias (theme inline x2, :root x2, .dark x2 — el grep cuenta líneas, espera ≥5).

### Step 2: Botón primario usa el acento
En `apps/web/components/ui/button.tsx:12`, cambia la variante `default`:
```tsx
default: "bg-brand text-brand-foreground hover:bg-brand/90",
```
(Como `--brand` == primary neutro hoy, no hay cambio visual; el día que se ponga color, todos los botones primarios lo toman.)
**Verify**: `pnpm --filter @gluuh/web typecheck` → exit 0; `grep -n "bg-brand" apps/web/components/ui/button.tsx` → 1 coincidencia.

### Step 3: Primitivo `PageHeader`
Crea `apps/web/components/ui/page-header.tsx`. Encabezado de página reutilizable (título + descripción + slot de acciones), para dar ritmo consistente a todas las pantallas del backoffice:
```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```
**Verify**: incluido en el typecheck del Step 6.

### Step 4: Primitivo `StatCard`
Crea `apps/web/components/ui/stat-card.tsx`. Tarjeta de KPI (dashboard/informes), superficie neutra con borde limpio:
```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, hint, icon, className,
}: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
```
**Verify**: incluido en el typecheck del Step 6.

### Step 5: Primitivo `EmptyState`
Crea `apps/web/components/ui/empty-state.tsx`. Estado vacío consistente (listas sin datos):
```tsx
import type { ReactNode } from "react";

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```
**Verify**: incluido en el typecheck del Step 6.

### Step 6: Documento de convenciones `apps/web/DESIGN.md`
Crea `apps/web/DESIGN.md` con esta guía (la consumirán los planes 006/007):
```markdown
# Sistema de diseño — Gluuh TPV (web)

Estilo: profesional, sobrio, tipo Supabase. Superficies neutras, poco redondeo, densidad alta,
claro/oscuro nativo.

## Reglas duras
- **Nunca** colores Tailwind hardcodeados de paleta (`bg-slate-900`, `text-white`, `bg-zinc-*`,
  `text-gray-*`, etc.) en pantallas. Usa SIEMPRE tokens semánticos:
  `bg-background` `text-foreground` `bg-card` `text-muted-foreground` `border-border`
  `bg-muted` `bg-accent` `text-destructive` `bg-primary/text-primary-foreground`.
- Acción primaria: `bg-brand text-brand-foreground` (token intercambiable; hoy neutro).
- Radios: usa las utilidades del tema (`rounded-md`, `rounded-lg`); nada de `rounded-full`
  para tarjetas/botones (las píldoras solo para chips/estados muy puntuales).
- Bordes 1px `border-border` + sombra sutil `shadow-sm` para tarjetas; nada de sombras grandes.

## Primitivos a reutilizar (no reinventar)
- `@/components/ui/page-header` — encabezado de página (título + descripción + acciones).
- `@/components/ui/stat-card` — KPIs.
- `@/components/ui/empty-state` — listas vacías.
- `@/components/ui/{button,card,input,label,select,dialog,table,badge,textarea}` — shadcn.

## Pantallas a oscuras (KDS/Display/Kiosko)
Las pantallas operativas a pantalla completa pueden forzar fondo oscuro, pero SIEMPRE vía
tokens: usa `bg-background text-foreground` dentro de un contenedor con la clase `dark` si se
quiere forzar oscuro independientemente del tema del usuario. No uses `bg-slate-900` literal.

## Tipografía y espaciado
- Títulos de página: `text-2xl font-semibold tracking-tight` (usa `PageHeader`).
- Números/importes: `tabular-nums`.
- Ritmo vertical de secciones: `space-y-6`; dentro de tarjetas `p-4`/`p-5`.
```
**Verify**: `test -f apps/web/DESIGN.md`.

### Step 7: Verificación global
```
pnpm --filter @gluuh/web typecheck
pnpm --filter @gluuh/web build
```
Ambos exit 0.

## Test plan
- No hay tests unitarios de UI en el repo. Verificación = typecheck + build de web pasan, y los
  nuevos primitivos compilan. Visual: sin cambios hoy (acento neutro = primary).

## Done criteria (NO actualices plans/README.md — lo hace tu revisor)
- [ ] `grep -n "\-\-brand" apps/web/app/globals.css` → ≥5 coincidencias; existen `--color-brand`, `--brand`, `--brand-foreground` en claro y oscuro.
- [ ] `apps/web/components/ui/button.tsx` variante default usa `bg-brand text-brand-foreground`.
- [ ] Existen `apps/web/components/ui/{page-header,stat-card,empty-state}.tsx` y `apps/web/DESIGN.md`.
- [ ] `pnpm --filter @gluuh/web typecheck` exit 0.
- [ ] `pnpm --filter @gluuh/web build` exit 0.
- [ ] La escala índigo `--color-brand-50..800` sigue intacta en globals.css.
- [ ] Solo ficheros en "In scope" modificados/creados.

## STOP conditions
- Los extractos de "Current state" no coinciden con el código real (deriva).
- `bg-brand` no resuelve a una utilidad válida tras registrar `--color-brand` (revisa que el
  registro en `@theme inline` esté correcto) → si typecheck/build siguen fallando tras un intento, STOP e informa.
- Quitar/renombrar `bg-primary` rompe otros componentes: NO lo quites; solo cambia la variante `default` del botón.

## Maintenance notes
- **Punto de cambio del color de marca**: cuando exista el logo, editar SOLO `--brand`/`--brand-foreground`
  en `:root` y `.dark` de globals.css. Todo lo demás lo hereda.
- Planes 006 (operativas+públicas) y 007 (backoffice) dependen de este: consumen `DESIGN.md` y los primitivos.
- Para el revisor: confirmar que no hay cambio visual hoy (acento neutro) y que el build pasa.
