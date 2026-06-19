# Guía de diseño completa — Senzu (portable)

Cómo se ve y se estructura este proyecto, de arriba abajo, para **replicarlo en
otros proyectos**. Estética **Supabase / Notion**: densa, plana, minimalista,
oscuro por defecto, verde de marca, un solo acento.

> Para la versión **paste-ready con shadcn/ui** (tokens en `globals.css` +
> mapeo de cada patrón a su componente shadcn), usa la skill
> `.claude/skills/ui-kit-shadcn/`. Esta guía es la especificación visual
> completa (humana).

---

## 1. Principios

1. **Tokens, no valores sueltos.** Color/espaciado/tipografía salen del sistema. Un `bg-white` o un hex suelto rompe el modo oscuro = bug.
2. **Reutiliza antes de crear.** Si el primitivo existe, úsalo. Bloque repetido 2 veces → extráelo.
3. **Denso y minimalista.** UI de técnicos: información compacta, sin aire decorativo.
4. **El icono dice QUÉ, el color dice ESTADO.** No repitas la info.
5. **Claro y oscuro siempre.** Consecuencia de usar tokens. Oscuro es el modo principal.

---

## 2. Color

### 2a. Escala + tokens (valores reales)

Escala gris de 12 pasos (Radix **Slate** en claro / **Gray** en oscuro). Todo lo
estructural deriva de aquí.

| Token | Claro | Oscuro | Uso (clase) |
|---|---|---|---|
| `--bg-default` | `#fbfcfd` | `#191919` | fondo de página · `bg-background` |
| `--bg-surface` | `#f8f9fa` | `#202020` | card / panel / navbar · `bg-surface` |
| `--bg-overlay` | `#f1f3f5` | `#222225` | hover / elevado · `bg-surface-overlay` |
| `--bg-muted` | `#eceef0` | `#292a2d` | seleccionado · `bg-surface-muted` |
| `--border-muted` | `#e6e8eb` | `#303134` | `border-border-muted` |
| `--border-default` | `#dfe1e4` | `#393a3d` | `border-border` |
| `--border-strong` | `#c1c4c8` | `#5f6063` | `border-border-strong` |
| `--text-muted` | `#8b8d98` | `#a1a4aa` | labels, hints · `text-(--text-muted)` |
| `--text-secondary` | `#60646c` | `#cdced1` | cuerpo 2º · `text-(--text-secondary)` |
| `--text-primary` | `#1c2024` | `#ededee` | principal · `text-foreground` |
| `--input-bg` | `#f8f9fa` | `#3F3F3F` | relleno de inputs |
| `--search-bg` | (= input) | `#262626` | buscador |
| `--sidebar-item-active` | `#eceef0` | `#2c2c2c` | item de nav activo |
| `--sidebar-item-hover` | `#f1f3f5` | `#383838` | item de nav hover |

### 2b. Marca (verde Supabase) — único acento
`--brand #34B27B` · hover `#2e9d6d` · active `#28885f` · muted `rgba(52,178,123,.15)`.
Clases: `bg-brand` / `text-brand` / `hover:bg-brand-hover` / `border-brand/20`.

### 2c. Estado semántico (paleta fija — no inventes otro azul/verde)
| Estado | Texto | Fondo tenue | Hex (claro / oscuro) |
|---|---|---|---|
| OK / éxito / activo | `text-emerald-500` | `bg-emerald-500/15` | `#34B27B` / `#3ecf8e` |
| Peligro / error | `text-rose-500` | `bg-rose-500/12` | `#EF4444` / `#f87171` |
| Aviso / parcial | `text-amber-500` | `bg-amber-500/15` | `#F5A623` |
| Info / neutro-destacado | `text-sky-500` | `bg-sky-500/15` | `#3B82F6` / `#60a5fa` |
| Silenciado | `text-violet-*` | `bg-violet-500/15` | — |

---

## 3. Tipografía

- **Inter** (`font-sans`) para todo. **Source Code Pro / mono** + `tabular-nums` para datos/números (no "bailan").
- Tamaños **dimensionales** `text-[Npx]` (escala fina intencional — NO `text-sm`/`text-base`):

| Nivel | Clase | Uso |
|---|---|---|
| Micro-label | `text-[10px]` / `text-[10.5px]` | labels de sección: `uppercase tracking-wider font-semibold text-(--text-muted)` |
| Meta / 2º | `text-[11px]` | teléfono, hints, descripciones |
| Cuerpo compacto | `text-[12px]` / `text-[12.5px]` | filas, items de lista |
| Cuerpo | `text-[13px]` / `text-[14px]` | contenido, breadcrumb (13px) |
| Título inline de página | `text-[20px]` `font-semibold` | PageHeading |
| Título de panel | `text-[15px]` / `text-[16px]` `font-semibold` | cabeceras |

Pesos: `font-semibold` (títulos/labels), `font-medium` (2º importante), normal (cuerpo).

---

## 4. Densidad, espaciado, radios

- **Gaps:** `gap-1`/`1.5`/`2` (elementos de fila), `gap-3` (bloques).
- **Padding:** card `p-2.5`/`p-3`/`p-4`; filas `px-2 py-1.5`; header/panel `px-4 py-3`.
- **Vertical:** `space-y-2`/`2.5`/`4`; entre secciones `mb-5`.
- **Alturas:** inputs/botones densos `h-7`/`h-8`; chips `h-5`/`h-6`; header y user-row `h-11`.
- **Radios:** `--radius-small 8px` (controles, chips · `rounded-md`), `--radius-medium 12px` (cards · `rounded-lg`), `--radius-large 14px` (cabeceras · `rounded-xl`/`rounded-2xl`).

Card estándar: `rounded-lg border border-border bg-surface p-3`.

---

## 5. Layout global

Estructura de toda página autenticada: **Sidebar (izq.) + [Header arriba +
contenido]**. Una sola instancia del shell; lo que cambia es la página.

```
┌────────────┬───────────────────────────────────────────┐
│            │ Header  h-11  (breadcrumb · slot · acciones)│
│  Sidebar   ├───────────────────────────────────────────┤
│  w-60      │                                            │
│ (w-12 col) │   PageHeading (título 20px + descripción)  │
│            │   Contenido (flex-1, scroll)               │
└────────────┴───────────────────────────────────────────┘
```

### 5a. Sidebar (navbar global)
`web/src/shared/components/layout/sidebar.tsx`
- **Desktop (`lg+`):** fija, `h-screen`, `bg-surface`, `border-r border-border`, `transition-all duration-300`. Ancho **`w-60`** (240px) · colapsada **`w-12`** (48px, solo iconos).
- **Móvil (`<lg`):** drawer `fixed inset-y-0 left-0 z-50 w-60` que entra con `translate-x`, sobre backdrop `fixed inset-0 z-40 bg-black/60 backdrop-blur-sm`. Se abre con el hamburguer del header.
- **Arriba:** fila de usuario `h-11` (alinea con el header) → abre el `UserMenu`.
- **Quick actions:** búsqueda, IA, nueva alarma, avisos (en fila o apiladas según colapsado).
- **Secciones de nav:** `INICIO · ALARMAS · MONITOREO · ADMINISTRACIÓN · SOPORTE`. Cada link: icono + label (solo icono al colapsar). Item activo `bg-(--sidebar-item-active)`, hover `bg-(--sidebar-item-hover)` (gris, **no** verde).

### 5b. Header
`web/src/shared/components/layout/header.tsx`
- `sticky top-0 z-30 h-11 border-b border-border bg-surface px-4 flex items-center gap-4`.
- Contenido: hamburguer (móvil + cuando el sidebar está colapsado) · **breadcrumbs** (icono home + ruta, 13px, tooltips) · **slot de página** (`#page-header-slot`, flex-1) donde la página inyecta su título/acciones.
- Iconos `w-3.5 h-3.5`/`w-4 h-4`, `text-foreground/80 hover:text-foreground hover:bg-surface-overlay`.
- **Atajos globales:** `Ctrl/⌘+K` búsqueda · `Ctrl/⌘+,` ajustes · `Ctrl/⌘+Shift+N` nueva alarma · (chat IA) `Ctrl/⌘+J`.

### 5c. Footer
**No hay footer global** — el layout es header + contenido. Footers solo puntuales:
- **Login:** texto de copyright/tagline bajo la tarjeta (`text-[10.5px] text-(--text-muted)`).
- **Ajustes:** `SettingsFooter` dentro de los paneles de settings.
El resto de páginas hacen scroll dentro del contenido, sin footer.

### 5d. Anatomía de página + PageHeader
`web/src/shared/components/layout/page-header.tsx` — **renderiza por portal** el
título/acciones en el slot del header (no inline en el cuerpo):
- Props: `title?` (se omite si coincide con el último breadcrumb), `subtitle?` (tooltip), `center?` (p. ej. un buscador), `actions?` (botones primarios a la derecha), `overflowActions?` (secundarias en un `⋮`).
- `PageHeading` (`page-heading.tsx`): título **20px** + descripción, ya dentro del contenido.
- **Páginas full-screen** (sin padding global): dashboard, create-alarm, settings, config-alarm/:id, monitoring, structure-bd, farmers/:id/stations. El resto llevan padding estándar.

---

## 6. Menús, submenús, popovers, tooltips

UN estilo para todos (evita que cada popover salga distinto).
- **Content:** `bg-surface-overlay border border-border p-1 rounded-medium shadow-xl` (constante en `popover-surface.ts`).
- **Item:** `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer` · activo `bg-surface-muted text-foreground` · normal `text-(--text-secondary) hover:bg-surface-muted hover:text-foreground`. Icono `w-4 h-4 text-(--text-muted)`; check del activo `w-4 h-4`.
- **Cabecera de grupo/submenú:** `px-2.5 pt-2.5 pb-1 text-[10px] font-medium text-(--text-muted)`.
- **Trigger de icono:** `w-7 h-7 rounded grid place-items-center text-foreground/80 hover:text-foreground hover:bg-surface-overlay cursor-pointer`.
- **Tooltip** (`info-hint.tsx`): `bg-surface border border-border rounded-lg shadow-md text-[11px] text-foreground px-2.5 py-1.5`, `placement="top" delay 200`. **Todo botón de icono sin texto: tooltip + `aria-label`** (icono mudo = bug).

---

## 7. Slide-over / paneles redimensionables (clave)

`web/src/shared/components/ui/slide-over.tsx`. Un panel con **5 modos** que el
usuario elige (menú "cómo se muestra") y se **persisten por `prefsKey`**.

| Modo | Qué es | Render |
|---|---|---|
| `push` | Barra lateral que **empuja** el contenido | `fixed inset-y-0 right-0`; el layout aplica `margin-right` = ancho; ancho **arrastrable** |
| `overlay` | Lateral **flotante** (no empuja); clic fuera cierra | `fixed inset-y-0 right-0` + backdrop `bg-black/30` |
| `corner` | **Flotante en la esquina** (estilo Notion/chat); no oscurece ni bloquea scroll | `fixed bottom-20 right-5 w-[440px] h-[680px] max-h-[calc(100vh-7rem)] rounded-2xl border shadow-2xl`, entra con `translate-y` |
| `center` | Modal **centrado** + backdrop `bg-black/50 backdrop-blur-sm` | caja `h-[85vh] max-w-2xl rounded-xl border shadow-2xl`, scale-in |
| `full` | **Pantalla completa** | `fixed inset-0 bg-background`; contenido centrado `max-w-3xl mx-auto` |

- Solo `center`/`full` bloquean el scroll del body.
- **Redimensionar** (solo `push`): manija a la izquierda, arrastrar para ajustar **360–1000px**, ancho persistido.
- **Cerrar** = **minimizar** (`—`) en `corner`/`center`/`full`; **contraer** (`»`) en `push`/`overlay`.
- **Stacking:** varios paneles en z-order; `Esc` cierra solo el último.
- **Cabecera del panel** `h-11`.

---

## 8. Modales
`modal-container.tsx` + `useModalStore`. Tipos: `confirm` (variantes danger/success), `alert`, `custom`/`form`. Tamaños `sm/md/lg/xl/full`. Backdrop `bg-black/50 backdrop-blur-sm`, entrada fade + scale (~200ms). Footer de formulario: secundario `variant="light"` izq., primario `bg-emerald-500 text-white` der.

---

## 9. Toasts
- `useToast` (no el `addToast` crudo de la librería).
- **`ToastContainer`** (ricos): título + mensaje + acciones, abajo-derecha, auto-dismiss con barra de progreso.
- **`Toast`** (simple): feedback rápido, centro-abajo, ~200px, enter-up / exit-shrink.
- Colores: emerald (éxito), rose (error), amber (aviso), sky (info), violet (silenciado).
- API: `toast.success('Guardado')` · `toast.error(...)` · `const t = toast.sequence('Guardando…'); t.success('Listo')`.

---

## 10. Formularios y controles
- **Texto:** `TextField` / `TextArea` (`text-field.tsx`) — nunca `<input>` crudo con clases a mano. Fondo `bg-(--input-bg)`, borde `border-border`, **foco siempre esmeralda** (`focus:border-brand`/ring), label `text-[10px] uppercase`, hint opcional. El foco indica "campo activo", nunca estado.
- **Teléfono:** `PhoneInput` (E.164).
- **Selects/dropdowns:** trigger denso `size="sm"` `bg-surface border-border`.
- **Buscador:** `SearchInput` (`bg-(--search-bg)`, botón de limpiar).
- **Numérico con unidad + tooltip:** patrón `ConfigField` (ver feature de referencia).

---

## 11. Tablas y listas densas
- Tablas de gestión (agricultores, alarmas, logs): paginación, búsqueda, chips de estado, favoritos.
- Listas/filas densas: `px-2.5 py-2` o `px-3 py-2.5`, separador `divide-y divide-border`, punto de estado `w-1.5 h-1.5 rounded-full`, valores en `font-mono tabular-nums`.
- Filtros: `FilterPopoverButton` / `FilterMenu` / `LogFilterBar`. Logs: `LogTable` (virtualizada).

---

## 12. Estados (loading / vacío / error)
- **Loading:** `Spinner` (HeroUI) en paneles; skeletons por página (p. ej. `FarmersPageSkeleton`) — no hay primitivo de skeleton, se hace por pantalla.
- **Vacío:** `EmptyState` — variantes `success / search / inbox / info / spark`, tamaños `sm/md/lg` (icono + título + descripción).
- **Error:** `global-error.tsx` (raíz, pantalla completa + recargar) y `(dashboard)/error.tsx` (segmento, centrado `min-h-60vh` + reintentar/inicio). Errores de sistema → toast `error` (rose). Errores de formulario → caja inline `bg-rose-500/10 border border-rose-500/30`.

---

## 13. Badges, chips, avatares (estado semántico)
- `ChannelChip`: canal push (bell) / sms (message) / call (phone), color verde/rojo/gris, interactivo o solo lectura.
- `AlarmStateBadge`: color/icono por estado. `PriorityBadge`: por severidad.
- `Avatar` / `RecipientAvatar`: circular, iniciales o foto, auto-color.
- `StatTile`: KPI (número + label + icono).
- Chip estándar: `inline-flex items-center gap-1 h-6 px-2 rounded-md bg-surface-overlay border border-border text-[11px]`.

---

## 14. Iconografía
- **lucide-react** para UI general. Tamaños: en chips `w-3 h-3`; filas/botones `w-3.5 h-3.5`/`w-4 h-4`; cabeceras `w-5 h-5`.
- Iconos de sensor: con un mapeador `getSensorIcon()` (tipo → icono + color), no a mano.

---

## 15. Animaciones
`@keyframes` + clases en `globals.css`, reutilizables: `animate-fade-in`, `animate-slide-in-right/-left`, `animate-slide-in-right-fade` (items escalonados), `animate-live-pulse` (punto "en directo"), `animate-pulse-alarm`. Transiciones simples: `transition-colors` o `transition-all duration-200 ease-out`. Sin librerías extra.

---

## 16. Login (anatomía)
`web/src/app/login/page.tsx` — tarjeta centrada, viewport completo, fondo `bg-background`.
- Logo de marca (~60px, centrado) · título "Senzu" (22px semibold) · subtítulo tagline (12px muted).
- **Tarjeta** `rounded-xl border border-border bg-surface shadow-lg p-6 max-w-[380px]`: alerta de error (rose, descartable) → `TextField` Usuario → `TextField` Contraseña (`type=password`) → botón submit `bg-emerald-500 text-white w-full h-10` ("Iniciando sesión…" en carga).
- Footer: tagline `text-[10.5px] text-(--text-muted)`. Móvil: `p-4`, mismo centrado.

---

## 17. Inventario de componentes (`web/src/shared/components/ui/`)

| Componente | Para |
|---|---|
| `text-field` (TextField/TextArea) | inputs de texto unificados |
| `phone-input` | teléfono E.164 |
| `search-input` | buscador con limpiar |
| `avatar` / `recipient-avatar` | avatares circulares |
| `empty-state` | estados vacíos (5 variantes) |
| `modal-container` (+ useModalStore) | modales confirm/alert/custom |
| `slide-over` (+ `slide-over-mode-menu`) | paneles laterales con 5 modos + resize |
| `toast-container` / `toast/Toast` | notificaciones ricas / simples |
| `channel-chip` | canal de aviso (push/sms/call) |
| `alarm-state-badge` / `priority-badge` | estado / prioridad |
| `stat-tile` | KPI |
| `copy` | copiar al portapapeles |
| `info-hint` | tooltip "?" / ⓘ |
| `filter-popover-button` / `filter-menu` / `log-filter-bar` | filtros |
| `log-table` | tabla de logs virtualizada |
| `chart-status` | estado de carga/error de gráficas |
| `app-switch` | cambiador de app |
| `popover-surface` | constante de estilo de popover |

---

## 18. Mapa de páginas

| Ruta | Qué es |
|---|---|
| `/login` | Login (tarjeta centrada) |
| `/dashboard/resumen` | KPIs/resumen (gráficas) |
| `/dashboard/tiempo-real` · `/mapa` · `/comparativas` · `/operaciones` | monitoreo en vivo, mapa, analítica, actividad |
| `/farmers` | lista de agricultores (tabla, paginación, favoritos) |
| `/farmers/[entId]/stations` | estaciones del agricultor (canvas, full-screen) |
| `/create-alarm` | asistente de alarma (5 pasos, full-screen) |
| `/config-alarm` | lista de alarmas |
| `/config-alarm/[id]/[tab]` | detalle de alarma (tabs: Resumen/Diagnóstico/Cronología/Predicción/Config/Avanzado/Investigación; usa slide-overs) |
| `/contacts` | contactos (tabla + modal) |
| `/changelog` · `/feedback` · `/help` | cambios, feedback, ayuda |
| `/settings/profile` · `/settings/admin` | perfil, hub admin (SQL editor, advisor, IA) |
| `/admin/errors` · `/admin/notification-errors` | logs de errores |

Modales/slide-overs: detalle de alarma (poner en vista, rearmar, silenciar, editar, activar/desactivar, borrar) y el chat de IA.

---

## Checklist antes de dar por hecho un componente
- [ ] Cero colores hardcodeados: estructura con tokens, estado con emerald/rose/amber/sky.
- [ ] Tipografía con la escala `text-[Npx]`, no `text-sm` al azar.
- [ ] ¿Existe ya un primitivo? Reutilízalo; ¿repites un bloque? extráelo.
- [ ] Modales con el sistema de modales; toasts con `useToast`; popovers con el estilo único.
- [ ] Botón de icono → tooltip + `aria-label`.
- [ ] Funciona en claro y oscuro.
- [ ] Animaciones reutilizando las clases de `globals.css`.
