# Guía de diseño — backoffice Gluuh TPV (estilo Supabase)

Cómo se ve y se estructura el **backoffice** (`apps/web/app/(panel)`), de arriba
abajo. Estética **Supabase / Notion**: densa, plana, minimalista, oscuro por
defecto, verde de marca, un solo acento. Portada y adaptada de la guía "Senzu"
el 06-07-2026; los tokens y patrones son los mismos, los ejemplos son de Gluuh.

> Para la versión **paste-ready con shadcn/ui** (tokens en `globals.css` +
> mapeo de cada patrón a su componente shadcn), usa la skill
> `.agents/skills/ui-kit-shadcn/`. Esta guía es la especificación visual
> completa (humana). La **operativa táctil** (TPV, comandera, KDS, kiosko) NO
> sigue esta guía: es colorida y con la marca del cliente — ver la skill
> `gluuh-ux-operativa` y `../referencia/02-interfaz-tactil/`.

---

## 1. Principios

1. **Tokens, no valores sueltos.** Color/espaciado/tipografía salen del sistema. Un `bg-white` o un hex suelto rompe el modo oscuro = bug.
2. **Reutiliza antes de crear.** Si el primitivo existe, úsalo. Bloque repetido 2 veces → extráelo.
3. **Denso y minimalista.** UI de gestión: información compacta, sin aire decorativo.
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
En el backoffice el verde es fijo (marca Gluuh); la marca del **cliente** solo
tiñe la operativa (`tenant_branding`).

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

- **Inter** (`font-sans`) para todo. **Mono** + `tabular-nums` para datos/números e importes (no "bailan").
- Tamaños **dimensionales** `text-[Npx]` (escala fina intencional — NO `text-sm`/`text-base`):

| Nivel | Clase | Uso |
|---|---|---|
| Micro-label | `text-[10px]` / `text-[10.5px]` | labels de sección: `uppercase tracking-wider font-semibold text-(--text-muted)` |
| Meta / 2º | `text-[11px]` | hints, descripciones |
| Cuerpo compacto | `text-[12px]` / `text-[12.5px]` | filas, items de lista |
| Cuerpo | `text-[13px]` / `text-[14px]` | contenido, breadcrumb (13px) |
| Título inline de página | `text-[20px]` `font-semibold` | PageHeader |
| Título de panel | `text-[15px]` / `text-[16px]` `font-semibold` | cabeceras |

Pesos: `font-semibold` (títulos/labels), `font-medium` (2º importante), normal (cuerpo).

---

## 4. Densidad, espaciado, radios

- **Gaps:** `gap-1`/`1.5`/`2` (elementos de fila), `gap-3` (bloques).
- **Padding:** card `p-2.5`/`p-3`/`p-4`; filas `px-2 py-1.5`; header/panel `px-4 py-3`.
- **Vertical:** `space-y-2`/`2.5`/`4`; entre secciones `mb-5`.
- **Alturas:** inputs/botones densos `h-7`/`h-8`; chips `h-5`/`h-6`; header `h-11`.
- **Radios:** `--radius-small 8px` (controles, chips · `rounded-md`), `--radius-medium 12px` (cards · `rounded-lg`), `--radius-large 14px` (cabeceras · `rounded-xl`/`rounded-2xl`).

Card estándar: `rounded-lg border border-border bg-surface p-3`.

---

## 5. Layout global

Estructura de toda página del panel: **rail de navegación (izq.) + submenú
contextual + contenido**. Una sola instancia del shell (`app/(panel)/layout.tsx`);
lo que cambia es la página.

```
┌──────┬────────┬──────────────────────────────────────────┐
│      │        │ Header  h-11  (breadcrumb · acciones)     │
│ Rail │ Submenú├──────────────────────────────────────────┤
│ w-60 │  w-56  │  PageHeader (título 20px + descripción)   │
│(w-12)│        │  Contenido (flex-1, scroll)               │
└──────┴────────┴──────────────────────────────────────────┘
```

### 5a. Rail (navegación global)
- Fijo, `h-screen`, `bg-surface`, `border-r border-border`. Ancho **`w-60`**
  (240px) · colapsado **`w-12`** (48px, solo iconos). Estado persistente (Zustand).
- Organización estilo Ágora (definida en `apps/web/app/lib/nav.ts`), 7 entradas:
  `Inicio · Operativa · Administración · Compras y Stocks · Herramientas · Informes · Ayuda`.
- Cada entrada abre un **submenú contextual** (`aside w-56`) con sus páginas y
  una página índice por sección.
- Item activo `bg-(--sidebar-item-active)`, hover `bg-(--sidebar-item-hover)`
  (gris, **no** verde).
- **Móvil:** drawer `fixed inset-y-0 left-0 z-50 w-60` sobre backdrop
  `bg-black/60 backdrop-blur-sm`.

### 5b. Header
- `sticky top-0 z-30 h-11 border-b border-border bg-surface px-4 flex items-center gap-4`.
- Contenido: hamburguesa (móvil/colapsado) · **breadcrumbs** (13px) · slot de
  página (título/acciones) · toggle claro/oscuro.
- Iconos `w-3.5 h-3.5`/`w-4 h-4`, `text-foreground/80 hover:text-foreground hover:bg-surface-overlay`.

### 5c. Footer
**No hay footer global** — el layout es header + contenido. El resto de páginas
hacen scroll dentro del contenido, sin footer.

### 5d. Anatomía de página + PageHeader
- `PageHeader`: título **20px** `font-semibold` + descripción `text-(--text-muted)`
  + **acción primaria** a la derecha ("Nuevo …").
- **Páginas full-screen** (sin padding global): las operativas (`/tpv`, `/kds`,
  `/kiosko`, `/pantalla`) y los editores a lienzo completo (planos de mesas).
  El resto del panel lleva padding estándar.

---

## 6. Menús, submenús, popovers, tooltips

UN estilo para todos (evita que cada popover salga distinto).
- **Content:** `bg-surface-overlay border border-border p-1 rounded-medium shadow-xl`.
- **Item:** `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer` · activo `bg-surface-muted text-foreground` · normal `text-(--text-secondary) hover:bg-surface-muted hover:text-foreground`. Icono `w-4 h-4 text-(--text-muted)`.
- **Cabecera de grupo/submenú:** `px-2.5 pt-2.5 pb-1 text-[10px] font-medium text-(--text-muted)`.
- **Trigger de icono:** `w-7 h-7 rounded grid place-items-center text-foreground/80 hover:text-foreground hover:bg-surface-overlay cursor-pointer`.
- **Tooltip:** `bg-surface border border-border rounded-lg shadow-md text-[11px] px-2.5 py-1.5`. **Todo botón de icono sin texto: tooltip + `aria-label`** (icono mudo = bug).

---

## 7. Slide-over / paneles laterales (patrón portable)

Patrón portado de Senzu, **aún no implementado en Gluuh** (hoy crear/editar va
en `Dialog` sobre la misma página): un panel con modos que el usuario elige y
se persisten por clave.

| Modo | Qué es |
|---|---|
| `push` | Barra lateral que **empuja** el contenido; ancho arrastrable 360–1000px |
| `overlay` | Lateral **flotante** (no empuja); clic fuera cierra |
| `corner` | **Flotante en la esquina** (estilo Notion); no bloquea el resto |
| `center` | Modal **centrado** + backdrop `bg-black/50 backdrop-blur-sm` |
| `full` | **Pantalla completa**; contenido centrado `max-w-3xl mx-auto` |

Adoptarlo cuando una ficha (producto, empleado) crezca más de lo que un Dialog
aguanta; hasta entonces, Dialog.

---

## 8. Modales
`Dialog` (shadcn). Confirmaciones destructivas con variante danger. Backdrop
`bg-black/50 backdrop-blur-sm`, entrada fade + scale (~200ms). Footer de
formulario: secundario a la izquierda, primario `bg-brand text-white` a la derecha.

---

## 9. Toasts
- **sonner** (`toast.success('Guardado')` · `toast.error(…)`), abajo-derecha.
- Colores semánticos: emerald (éxito), rose (error), amber (aviso), sky (info).
- Todo guardado/borrado/activación confirma con toast; los errores de formulario
  van inline (caja `bg-rose-500/10 border border-rose-500/30`), no en toast.

---

## 10. Formularios y controles
- **Texto:** `Input` / `PasswordInput` — nunca `<input>` crudo con clases a mano.
  Fondo `bg-(--input-bg)`, borde `border-border`, **foco siempre esmeralda**
  (`focus:border-brand`/ring), label `text-[10px] uppercase`, ayuda debajo.
  El foco indica "campo activo", nunca estado.
- **Selects:** trigger denso `size="sm"` `bg-surface border-border` (shadcn `Select`).
- **Buscador:** input con icono y botón de limpiar, fondo `bg-(--search-bg)`.
- **Formularios largos:** agrupar en tarjetas por bloque; etiqueta arriba, input
  a ancho completo, ayuda debajo.

---

## 11. Tablas y listas densas
- Tablas de gestión (productos, empleados, ventas, series): `Table` densa con
  búsqueda, chips/badges de estado y acciones por fila.
- Filas: `px-2.5 py-2` o `px-3 py-2.5`, separador `divide-y divide-border`,
  punto de estado `w-1.5 h-1.5 rounded-full`, importes en `font-mono tabular-nums`.
- Filtros arriba de la tabla, nunca en un panel aparte.

---

## 12. Estados (loading / vacío / error)
- **Loading:** spinner en paneles; skeletons por página donde el layout lo pida.
- **Vacío:** `EmptyState` — icono + título + descripción + **acción** ("Crea tu
  primera familia"). Sin estados vacíos mudos.
- **Error:** error de sistema → toast rose; error de formulario → caja inline.

---

## 13. Badges, chips, avatares (estado semántico)
- `Badge` de estado con la paleta fija de §2c (activo/oculto, cobrado/abierta,
  enviado/error AEAT…).
- Chip estándar: `inline-flex items-center gap-1 h-6 px-2 rounded-md bg-surface-overlay border border-border text-[11px]`.
- `StatCard`: KPI del dashboard (número grande `tabular-nums` + label + icono).

---

## 14. Iconografía
- **lucide-react** para todo. Tamaños: en chips `w-3 h-3`; filas/botones
  `w-3.5 h-3.5`/`w-4 h-4`; cabeceras `w-5 h-5`.
- Icono solo ≠ botón: si va solo, tooltip + `aria-label`.

---

## 15. Animaciones
`@keyframes` + clases en `globals.css`, reutilizables: `animate-fade-in`,
`animate-slide-in-right/-left`. Transiciones simples: `transition-colors` o
`transition-all duration-200 ease-out`. Sin librerías extra.

---

## 16. Login (anatomía)
Tarjeta centrada, viewport completo, fondo `bg-background`:
logo de marca (~60px) · título (22px semibold) · subtítulo (12px muted) ·
**tarjeta** `rounded-xl border border-border bg-surface shadow-lg p-6 max-w-[380px]`
con alerta de error (rose, descartable) → email → contraseña (`PasswordInput`) →
botón `bg-brand text-white w-full h-10` ("Iniciando sesión…" en carga).
El acceso de empleados en la operativa es distinto: **PIN numérico** (ver
skill `gluuh-ux-operativa`).

---

## 17. Primitivos del panel (reutilizar, no reinventar)

| Primitivo | Para |
|---|---|
| `PageHeader` | título 20px + descripción + acción primaria |
| `StatCard` | KPI del dashboard |
| `EmptyState` | estados vacíos con guía + acción |
| `Card` / `Table` / `Badge` | superficie, listados densos, estados |
| `Dialog` | crear/editar sobre la misma página |
| `Select` / `Input` / `PasswordInput` | formularios |
| toasts (sonner) | confirmaciones y errores de sistema |
| `ProductoDialog` | ficha rápida de producto (creación desde cualquier pantalla) |

El inventario vivo y el mapeo shadcn están en la skill `.agents/skills/ui-kit-shadcn/`.

---

## 18. Mapa de páginas del panel

| Sección (rail) | Páginas |
|---|---|
| **Inicio** | `/dashboard` (KPIs del día) |
| **Operativa** | TPV, comandera, KDS, kiosko, pantalla, ofertas · `/caja`, `/movimientos-de-caja` |
| **Administración** | `/ajustes` (empresa y fiscal), `/series`, `/plantillas-ticket`, `/etiquetas`, `/periodos-servicio`, `/perfiles`, `/empleados`, `/invitaciones` · catálogo: `/familias-y-productos`, `/carta`, `/menus`, `/alergenos`, `/unidades`, `/grupos-mayores` · precios: `/impuestos`, `/tarifas`, `/promociones`, `/descuentos`, `/formas-de-pago` |
| **Compras y Stocks** | almacenes, proveedores, inventario (🟡 módulo pendiente) |
| **Herramientas** | `/personalizar` (marca unificada), `/planos-de-mesas`, `/dispositivos`, `/copias-de-seguridad`, zona técnica con clave |
| **Informes** | `/ventas-diarias`, `/diario-de-ventas`, `/diario-de-pedidos`, `/evolucion-de-ventas`, `/top-50-productos`, `/rendimiento-de-usuarios`, `/cancelaciones-por-usuario`, `/resumen-fiscal`, `/visor-de-verifactu` |

El detalle campo a campo de cada página está en
[`paginas-creacion-configuracion.md`](paginas-creacion-configuracion.md).

---

## 19. Patrón estándar de página de gestión

**Toda página de gestión del panel se construye igual** (rescatado del plan de
construcción de junio; con esto, cada página nueva ≈ 1 commit):

1. `PageHeader`: título 20px + descripción + acción primaria ("Nuevo …").
2. Si es lista: **buscador/filtros** arriba.
3. **Tabla densa** (`Table`) o tarjetas: columnas clave + badge de estado de
   color + acciones por fila (editar, borrar, activar/ocultar).
4. **Crear/editar en `Dialog`** sobre la misma página → todo se configura sin
   cambiar de pantalla.
5. **Estados**: `EmptyState` (vacío con guía + botón), spinner (carga), toast
   (éxito/error).
6. **Reglas**: solo tokens (cero hex/`bg-white`); filtrado por rol; funciona en
   claro y oscuro; `tenant_id` en los inserts; RLS por tenant.
7. Números e importes en `tabular-nums`; iconos lucide con `aria-label` si van solos.

---

## Checklist antes de dar por hecho un componente
- [ ] Cero colores hardcodeados: estructura con tokens, estado con emerald/rose/amber/sky.
- [ ] Tipografía con la escala `text-[Npx]`, no `text-sm` al azar.
- [ ] ¿Existe ya un primitivo? Reutilízalo; ¿repites un bloque? extráelo.
- [ ] Modales con `Dialog`; toasts con sonner; popovers con el estilo único.
- [ ] Botón de icono → tooltip + `aria-label`.
- [ ] Funciona en claro y oscuro.
- [ ] Animaciones reutilizando las clases de `globals.css`.
