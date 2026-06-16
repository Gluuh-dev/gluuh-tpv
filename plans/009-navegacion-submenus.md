# Plan 009: Navegación profesional del panel con submenús expandibles

> **Executor**: toca SOLO `apps/web/app/(panel)/layout.tsx`. No cambies lógica de sesión/datos.
> Verifica typecheck + build. STOP conditions aplican. No actualices `plans/README.md`.

## Status
- **Priority**: P1 | **Effort**: M | **Risk**: LOW | **Depends on**: 005 | **Category**: UI
- **Planned at**: commit `8b109f2` (main), 2026-06-15

## Why
El usuario quiere un diseño más profesional "con submenús" en todas las páginas. La barra lateral
del panel aparece en todas las pantallas de gestión, así que reestructurarla en **grupos con submenús
expandibles** (estilo backoffice profesional) es el cambio de mayor alcance. Mantener todas las rutas
existentes (sin 404).

## Current state
`apps/web/app/(panel)/layout.tsx` — shell del panel (client component). Hoy: sidebar con DOS secciones
planas (`GESTION`, `OPERATIVA`) renderizadas por `NavSection`; cabecera con empresa + usuario + ThemeToggle
+ Salir; carga sesión/tenant/usuario en useEffect. Rutas existentes:
- Gestión: /dashboard, /carta, /sala, /empleados, /personalizar, /informes, /ajustes
- Operativa: /tpv, /comandera, /cocina, /kiosko, /pantalla, /ofertas
Usa tokens del tema (`bg-card`, `text-muted-foreground`, `bg-accent`…) y `lucide-react`. `usePathname()` para activo.

## Commands
| Instalar | `pnpm install` | exit 0 |
| Typecheck web | `pnpm --filter @gluuh/web typecheck` | exit 0 |
| Build web | `pnpm --filter @gluuh/web build` | exit 0 (con `.env.local`, ver Step 0) |

## Scope
**In scope**: `apps/web/app/(panel)/layout.tsx`.
**Out of scope**: cualquier otra pantalla, globals.css, lógica de auth/datos (consérvala igual).

## Git workflow
- Rama: `advisor/009-navegacion-submenus`. Conventional commits (`feat(panel): nav con submenús expandibles`). No push.

## Steps

### Step 0 (base + entorno)
1. `git reset --hard 8b109f2` → verifica `git rev-parse --short HEAD` = `8b109f2` (si no, STOP).
2. `pnpm install` (exit 0).
3. Crea `apps/web/.env.local` con placeholders (gitignored):
   `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder0000000000` / `SUPABASE_SECRET_KEY=sb_secret_placeholder0000000000` / `SUPABASE_SERVICE_ROLE_KEY=placeholder`.
4. `pnpm --filter @gluuh/web typecheck` → exit 0.

### Step 1: Estructura de navegación con grupos + submenús
Reescribe la barra lateral con **grupos colapsables** (cada grupo = un encabezado clicable con chevron
que expande/colapsa sus items). Estructura (mantén TODAS las rutas existentes, no inventes destinos nuevos):
- **Principal**
  - Inicio → `/dashboard`
- **Carta y sala** (grupo expandible)
  - Carta → `/carta`
  - Sala y mesas → `/sala`
  - Personalización → `/personalizar`
- **Operativa** (grupo expandible)
  - TPV → `/tpv`
  - Comandera → `/comandera`
  - Cocina (KDS) → `/cocina`
  - Kiosko → `/kiosko`
  - Display → `/pantalla`
  - Ofertas → `/ofertas`
- **Personal** (grupo expandible)
  - Empleados → `/empleados`
- **Análisis y ajustes** (grupo expandible)
  - Informes → `/informes`
  - Ajustes → `/ajustes`

Comportamiento:
- Cada grupo tiene encabezado con icono + título + chevron (`ChevronDown`/`ChevronRight` de lucide) que
  alterna expandido/colapsado (estado `useState`/`Record<string,boolean>`).
- El grupo que contiene la ruta activa arranca **expandido** por defecto.
- Item activo resaltado (`bg-accent text-foreground font-medium`); inactivo `text-muted-foreground hover:bg-accent`.
- Indentación de sub-items (p. ej. `pl-9`) para jerarquía visual clara.
- Conserva la cabecera (empresa, usuario, ThemeToggle, Salir) y el pie con empresa/rol.
- Mantén intacta TODA la lógica del useEffect (sesión/tenant/usuario) y `salir()`.

### Step 2: Pulido profesional del shell
- Logo/marca arriba con el cuadrado de acento (`bg-brand`) ya existente.
- Densidad y espaciado consistentes (items `h-9`, texto `text-sm`, iconos `h-4 w-4`).
- Scroll interno del nav si desborda (`overflow-y-auto`).
- Todo con tokens del tema (sin literales de paleta gris). Responsive: la sidebar puede ocultarse en móvil como ya hace (`hidden md:flex`).

### Step 3: Verificación
- `pnpm --filter @gluuh/web typecheck` → exit 0.
- `pnpm --filter @gluuh/web build` → exit 0.
- `grep -nE "bg-slate-|text-slate-|bg-gray-|text-gray-" apps/web/app/(panel)/layout.tsx` → 0 coincidencias.

## Done criteria (NO actualices plans/README.md)
- [ ] Sidebar con grupos colapsables (chevron) y submenús; grupo de la ruta activa expandido.
- [ ] Todas las rutas existentes presentes; ningún destino nuevo/inexistente.
- [ ] Lógica de sesión/datos/salir intacta.
- [ ] typecheck 0, build 0; sin literales de paleta gris.
- [ ] Solo `(panel)/layout.tsx` modificado.

## STOP conditions
- El fichero no coincide con "Current state" (deriva) → informa.
- Algún cambio obligaría a tocar otra pantalla o a crear rutas nuevas → no lo hagas; usa solo rutas existentes.
- build falla por tu cambio → arréglalo; si no, STOP.

## Maintenance notes
- Si más adelante se añaden sub-páginas reales (p. ej. Ajustes → Empresa/Fiscal/Impresoras), se cuelgan
  como nuevos items de su grupo.
- Para el revisor: confirmar que no hay 404 (todas las rutas existen) y que el grupo activo se autoexpande.
