---
name: ui-kit-shadcn
description: >-
  Sistema de diseño PORTABLE (para empezar otros proyectos) basado en este
  proyecto pero con componentes shadcn/ui + Tailwind v4. Define los tokens de
  color exactos (modo claro y oscuro, verde de marca), la tipografía, densidad,
  radios, el navbar/sidebar global responsive, los menús y submenús (popover),
  y el slide-over / modal de IA REDIMENSIONABLE con sus 5 modos
  (barra lateral, lateral flotante, flotante en la esquina, centrado, pantalla
  completa). Úsala al montar la UI de un proyecto nuevo con shadcn: copia los
  tokens, instala los componentes y sigue los patrones. Mapea cada patrón a su
  componente shadcn (Sheet, Dialog, DropdownMenu, Popover, Tooltip…).
---

# UI Kit (shadcn) — sistema de diseño portable

Estética **Supabase/Notion**: densa, plana, minimalista, oscuro por defecto,
verde de marca, un solo acento. Stack destino: **Next.js + Tailwind v4 +
shadcn/ui**. Todo el color sale de **variables CSS** (claro/oscuro automático);
los componentes son shadcn, tematizados con estas variables.

Regla madre: **tokens, no valores sueltos.** Un `bg-white` o un hex suelto es un
bug de estilo. **El icono dice QUÉ, el color dice ESTADO.**

---

## 0. Setup shadcn (una vez)

```bash
npx shadcn@latest init      # baseColor: Slate, CSS variables: yes
npx shadcn@latest add button dropdown-menu popover dialog sheet tooltip \
  input textarea card badge scroll-area separator avatar tabs
```

Pega los tokens del §1 en `app/globals.css` (sustituyen los que genera shadcn).
Modo oscuro con `class` (`<html class="dark">`); usa `next-themes`.

---

## 1. Tokens de color (pegar en globals.css)

Escala de 12 pasos (Radix Slate en claro / Gray en oscuro) + marca + estados.
shadcn lee `--background`, `--foreground`, `--card`, `--popover`, `--primary`,
`--muted`, `--accent`, `--border`, `--input`, `--ring`, `--destructive`,
`--radius`: los aliaso al final para que sus componentes salgan ya con el tema.

```css
@layer base {
  :root {
    /* Escala gris (claro) */
    --scale-1:#fbfcfd; --scale-2:#f8f9fa; --scale-3:#f1f3f5; --scale-4:#eceef0;
    --scale-5:#e6e8eb; --scale-6:#dfe1e4; --scale-7:#d7d9dc; --scale-8:#c1c4c8;
    --scale-9:#8b8d98; --scale-10:#7e8086; --scale-11:#60646c; --scale-12:#1c2024;

    /* Fondos / superficies */
    --bg-default: var(--scale-1);   /* página            → bg-background */
    --bg-surface: var(--scale-2);   /* card, panel, nav   → bg-surface    */
    --bg-overlay: var(--scale-3);   /* hover, elevado     → bg-surface-overlay */
    --bg-muted:   var(--scale-4);   /* seleccionado       → bg-surface-muted */
    --input-bg:   var(--bg-surface);

    /* Bordes */
    --border-muted: var(--scale-5);
    --border-default: var(--scale-6);
    --border-strong: var(--scale-8);

    /* Texto */
    --text-muted: var(--scale-9);      /* labels, hints   */
    --text-secondary: var(--scale-11); /* cuerpo 2º       */
    --text-primary: var(--scale-12);   /* principal       */

    /* Marca (verde Supabase) — único acento */
    --brand:#34B27B; --brand-hover:#2e9d6d; --brand-active:#28885f;
    --brand-muted: rgba(52,178,123,.15);

    /* Estado semántico */
    --success:#34B27B; --warning:#F5A623; --danger:#EF4444; --info:#3B82F6;

    color-scheme: light;
  }

  .dark {
    /* Escala gris (oscuro) */
    --scale-1:#111113; --scale-2:#19191b; --scale-3:#222225; --scale-4:#292a2d;
    --scale-5:#303134; --scale-6:#393a3d; --scale-7:#46474a; --scale-8:#5f6063;
    --scale-9:#6c6d70; --scale-10:#7c7d80; --scale-11:#b2b3b5; --scale-12:#ededee;

    /* Fondos tipo Notion: página #191919 · superficies #202020 */
    --bg-default:#191919; --bg-surface:#202020;
    --sidebar-item-active:#2c2c2c; --sidebar-item-hover:#383838;
    --input-bg:#3F3F3F;            /* input resalta sobre la superficie */
    --search-bg:#262626;

    --text-muted:#a1a4aa; --text-secondary:#cdced1;
    --success:#3ecf8e; --danger:#f87171; --info:#60a5fa; /* warning igual */
    color-scheme: dark;
  }
}

/* Tailwind v4: expón los tokens como utilidades (bg-surface, text-brand…). */
@theme inline {
  --color-background: var(--bg-default);
  --color-surface: var(--bg-surface);
  --color-surface-overlay: var(--bg-overlay);
  --color-surface-muted: var(--bg-muted);
  --color-foreground: var(--text-primary);
  --color-border: var(--border-default);
  --color-border-muted: var(--border-muted);
  --color-border-strong: var(--border-strong);
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-info: var(--info);
  --radius-small: 8px; --radius-medium: 12px; --radius-large: 14px;

  /* Alias shadcn → estos tokens (para que sus componentes hereden el tema). */
  --color-card: var(--bg-surface);
  --color-popover: var(--bg-overlay);
  --color-primary: var(--brand);
  --color-primary-foreground: #ffffff;
  --color-muted: var(--bg-muted);
  --color-muted-foreground: var(--text-muted);
  --color-accent: var(--bg-overlay);
  --color-input: var(--border-default);
  --color-ring: var(--brand);
  --color-destructive: var(--danger);
}
```

### Lo que usas en JSX
| Para | Clase | NUNCA |
|---|---|---|
| Fondo de página | `bg-background` | `bg-white`, `bg-slate-50` |
| Superficie (card/panel/nav) | `bg-surface` | `bg-white`, `bg-gray-100` |
| Hover / elevado | `bg-surface-overlay` | `bg-slate-100` |
| Seleccionado | `bg-surface-muted` | — |
| Borde | `border-border` (`-muted` / `-strong`) | `border-gray-200` |
| Texto | `text-foreground` / `text-(--text-secondary)` / `text-(--text-muted)` | `text-black`, `text-slate-600` |
| Marca | `bg-brand` / `text-brand` / `hover:bg-brand-hover` | hex `#34B27B` |

> `text-(--text-muted)` es Tailwind v4 leyendo la variable directa. Correcto.

### Estado semántico (paleta fija — no inventes otro azul/verde)
| Estado | Texto | Fondo tenue |
|---|---|---|
| OK / éxito | `text-emerald-500` | `bg-emerald-500/15` |
| Peligro / error | `text-rose-500` | `bg-rose-500/12` |
| Aviso | `text-amber-500` | `bg-amber-500/15` |
| Info / neutro-destacado | `text-sky-500` | `bg-sky-500/15` |

---

## 2. Tipografía

- Fuente: **Inter** (`font-sans`). Números/datos: **mono** + `tabular-nums`.
- Tamaños **dimensionales** `text-[Npx]` (intencional, escala fina — NO `text-sm`):

| Nivel | Clase | Uso |
|---|---|---|
| Micro-label | `text-[10px]` | labels de sección, casi siempre `uppercase tracking-wider font-semibold text-(--text-muted)` |
| Meta | `text-[11px]` | hints, teléfono, descripciones |
| Cuerpo compacto | `text-[12.5px]` | filas, items |
| Cuerpo | `text-[13px]`/`text-[14px]` | contenido |
| Título panel | `text-[15px]`/`text-[16px]` `font-semibold` | cabeceras |

---

## 3. Densidad, espaciado, radios

- Gaps `gap-1`/`1.5`/`2`; bloques `gap-3`. Vertical `space-y-2`/`2.5`/`4`.
- Padding card `p-2.5`/`p-3`/`p-4`; filas `px-2 py-1.5`.
- Alturas: inputs/botones densos `h-7`/`h-8`; chips `h-5`/`h-6`.
- Radios: `rounded-md` (controles, chips), `rounded-lg` (cards), `rounded-2xl` (input de chat / cabeceras destacadas).

Card estándar: `rounded-lg border border-border bg-surface p-3`.

---

## 4. Navbar global + header (responsive)

**Sidebar global** (una sola instancia; cambia por pantalla, no hay varias):
- Desktop (`lg+`): fija, `h-screen`, `bg-surface`, `border-r border-border`.
  Ancho **`w-60`** (240px) expandida · **`w-12`** (48px) colapsada (solo iconos),
  `transition-all duration-300`.
- Móvil (`<lg`): **drawer** `fixed inset-y-0 left-0 z-50 w-60` que entra con
  `translate-x`, sobre backdrop `fixed inset-0 z-40 bg-black/60 backdrop-blur-sm`.
  Se abre con el hamburguer del header.
- Item de nav: activo `bg-(--sidebar-item-active)`, hover `bg-(--sidebar-item-hover)`
  (gris, NO verde). El icono dice qué; el verde se reserva para acentos puntuales.

**Header de panel/contenido**: altura **`h-11`** (44px), `px-3`, `border-b border-border`,
`bg-surface`, `flex items-center gap-1.5`. La primera fila del sidebar también es
`h-11` para alinear con el header. Iconos del header `w-3.5 h-3.5`/`w-4 h-4`,
color `text-foreground/80 hover:text-foreground hover:bg-surface-overlay`.

shadcn: el sidebar es propio (un `<aside>` + estado colapsado); el drawer móvil =
`Sheet` (`side="left"`). No necesitas el bloque `sidebar` de shadcn salvo que
quieras sus grupos.

---

## 5. Menús y submenús (popover / dropdown)

UN estilo para todos. shadcn `DropdownMenu` y `Popover` con estas clases en el
content:

```
bg-surface-overlay border border-border p-1 rounded-medium shadow-xl
```

- Item: `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer`
  · activo `bg-surface-muted text-foreground` · normal `text-(--text-secondary) hover:bg-surface-muted hover:text-foreground`.
- Icono del item `w-4 h-4 text-(--text-muted)`; check del activo `w-4 h-4`.
- Cabecera de grupo (submenú/sección): `px-2.5 pt-2.5 pb-1 text-[10px] font-medium text-(--text-muted)`.
- Trigger de icono: `w-7 h-7 rounded grid place-items-center text-foreground/80 hover:text-foreground hover:bg-surface-overlay cursor-pointer`.

Tooltips (shadcn `Tooltip`): content `bg-surface border border-border rounded-lg
shadow-md text-[11px] text-foreground px-2.5 py-1.5`, `delay 200`. Todo botón de
icono sin texto: **tooltip + `aria-label`** (un icono mudo es un bug).

---

## 6. Slide-over / modal de IA REDIMENSIONABLE (la pieza estrella)

Un panel con **5 modos** que el usuario elige en su cabecera (icono "cómo se
muestra") y se **persisten**. El modo se guarda por `key` (p. ej. `localStorage`
o zustand `persist`).

| Modo | Qué es | Render |
|---|---|---|
| `push` | Barra lateral que **empuja** el contenido | `fixed inset-y-0 right-0`, ancho **arrastrable** (ver abajo); el layout pone `margin-right` = ancho |
| `overlay` | Lateral **flotante** (no empuja); clic fuera cierra | `fixed inset-y-0 right-0` + backdrop `bg-black/30` |
| `corner` | **Flotante en la esquina** (estilo Notion/chat). NO oscurece, no bloquea scroll | `fixed bottom-20 right-5 w-[440px] h-[680px] max-h-[calc(100vh-7rem)] rounded-2xl border shadow-2xl`, entra con `translate-y` |
| `center` | Modal **centrado** con backdrop | `fixed inset-0 grid place-items-center` + caja `h-[85vh] max-w-2xl rounded-xl border shadow-2xl` |
| `full` | **Pantalla completa** | `fixed inset-0 bg-background` |

Reglas transversales:
- Sólo `center`/`full` bloquean el scroll del body; `push`/`overlay`/`corner` lo dejan.
- En `corner` el panel **sale del botón flotante** (mismo anclaje `bottom-20 right-5`).
- Cabecera del panel `h-11`; botón de cerrar = **minimizar** (`—`) en `corner`/`center`/`full`
  (colapsan a una burbuja), o **contraer** (`»`, dos flechas) en `push`/`overlay`.
- En `full` el contenido se **centra** (`max-w-3xl mx-auto`) y el historial pasa a barra lateral.

**Mapeo shadcn:** `overlay` → `Sheet side="right"`. `center` → `Dialog`. `corner` y
`full` → un `<div>` `fixed` propio (no hay primitivo). `push` → `<div>` `fixed`
propio + ajuste de `margin-right` del layout. Todos comparten el mismo cuerpo:

```tsx
const W = { sm:384, md:448, lg:512, xl:576 };
// Redimensionar (solo push): manija a la izquierda del panel, ancho persistido.
function ResizeHandle({ onDrag }: { onDrag: (dx:number)=>void }) {
  return (
    <div
      role="separator" aria-orientation="vertical" title="Arrastra para redimensionar"
      onPointerDown={(e)=>{ e.currentTarget.setPointerCapture(e.pointerId);
        const x0=e.clientX; const move=(ev:PointerEvent)=>onDrag(x0-ev.clientX);
        const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};
        document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
      }}
      className="absolute inset-y-0 left-0 z-20 w-2.5 -translate-x-1/2 cursor-ew-resize flex justify-center group/rz"
    >
      <span className="h-full w-px bg-transparent group-hover/rz:bg-foreground/40 transition-colors" />
    </div>
  );
}
// clamp del ancho: Math.round(Math.max(360, Math.min(Math.min(1000, innerWidth-160), w)))
```
*ponytail: la manija sólo en `push`; `overlay/center/corner/full` usan tamaño fijo.*

**Input de chat (estilo Notion):** tarjeta `rounded-2xl border border-border
bg-surface px-3.5 pt-3 pb-2.5 focus-within:border-brand focus-within:ring-1
focus-within:ring-brand/30`; dentro: chips de contexto arriba, `Textarea`
borderless en medio, barra inferior con `+` a la izquierda y enviar (`rounded-full
bg-brand`) a la derecha.

**Lanzador flotante global (estilo Notion):** botón `fixed bottom-20 right-5 z-40
w-12 h-12 rounded-full overflow-hidden shadow-lg ring-1 ring-border`; visible en
todas las páginas, desaparece cuando el panel está abierto. Atajo global de
teclado para abrir/cerrar (`Ctrl/Cmd+J`) con `preventDefault`.

---

## 7. Animaciones

`transition-colors` (hover de color), `transition-all duration-200 ease-out`
(layout/entradas). Entradas de panel: `translate-x`/`translate-y` + `opacity`.
No metas librerías de animación para esto.

---

## Checklist antes de dar por hecho un componente
- [ ] Cero colores hardcodeados: estructura con tokens, estado con emerald/rose/amber/sky.
- [ ] Tipografía `text-[Npx]`, no `text-sm` al azar.
- [ ] ¿Existe ya el componente shadcn? Úsalo y tematízalo, no lo reinventes.
- [ ] Botón de icono → tooltip + `aria-label`.
- [ ] Funciona en claro y oscuro (consecuencia de usar tokens).
- [ ] Verifica con `tsc --noEmit`.
