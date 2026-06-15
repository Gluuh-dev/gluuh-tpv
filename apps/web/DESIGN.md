# Sistema de diseño — Gluuh TPV (web)

Estilo: profesional, sobrio, tipo Supabase. Superficies neutras, poco redondeo, densidad alta, claro/oscuro nativo.

## Reglas duras
- **Nunca** colores Tailwind hardcodeados de paleta (`bg-slate-900`, `text-white`, `bg-zinc-*`, `text-gray-*`) en pantallas. Usa SIEMPRE tokens semánticos: `bg-background` `text-foreground` `bg-card` `text-muted-foreground` `border-border` `bg-muted` `bg-accent` `text-destructive` `bg-primary/text-primary-foreground`.
- Acción primaria: `bg-brand text-brand-foreground` (token intercambiable; hoy neutro).
- Radios: usa utilidades del tema (`rounded-md`, `rounded-lg`); nada de `rounded-full` para tarjetas/botones.
- Bordes 1px `border-border` + sombra sutil `shadow-sm` para tarjetas; nada de sombras grandes.

## Primitivos a reutilizar (no reinventar)
- `@/components/ui/page-header` — encabezado de página.
- `@/components/ui/stat-card` — KPIs.
- `@/components/ui/empty-state` — listas vacías.
- `@/components/ui/{button,card,input,label,select,dialog,table,badge,textarea}` — shadcn.

## Pantallas a oscuras (KDS/Display/Kiosko)
Pueden forzar fondo oscuro, pero SIEMPRE vía tokens: usa `bg-background text-foreground` dentro de un contenedor con la clase `dark` si se quiere forzar oscuro. No uses `bg-slate-900` literal.

## Tipografía y espaciado
- Títulos de página: `text-2xl font-semibold tracking-tight` (usa `PageHeader`).
- Números/importes: `tabular-nums`.
- Ritmo vertical: `space-y-6`; dentro de tarjetas `p-4`/`p-5`.
