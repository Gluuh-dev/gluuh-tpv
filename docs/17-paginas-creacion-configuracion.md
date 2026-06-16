# 17 · Páginas de creación y configuración — especificación definitiva

> **Propósito.** Este documento es la **especificación maestra** del panel de creación y
> configuración de Gluuh TPV. Define, sin ambigüedad, **qué páginas** existen, **qué campos**
> tiene cada formulario (con el **nombre real de columna** de `supabase/migrations/*.sql`),
> qué **estados**, **acciones** y **navegación** debe tener cada pantalla, y **quién ve qué**
> según el rol. El objetivo: que con este documento se pueda construir TODO el backoffice
> "perfecto" — competitivo con **Ágora TPV** y tan profesional como el **dashboard de Supabase**.
>
> Amplía y reemplaza como referencia a `docs/16-configuracion-campos.md` (que queda como
> resumen). Aquí está el detalle completo.
>
> **Leyenda de estado:** ✅ ya existe (implementado en `apps/web`) · 🟡 falta / parcial.
> **Leyenda de campos obligatorios:** ● obligatorio · ○ opcional · ⚙️ automático/derivado.

---

## Índice

1. [Filosofía de UX (estilo Supabase)](#1-filosofía-de-ux-estilo-supabase)
2. [Mapa de navegación e información (IA) y matriz de roles](#2-mapa-de-navegación-e-información-ia-y-matriz-de-roles)
3. [Patrones transversales (formularios, tablas, estados)](#3-patrones-transversales)
4. [Inicio / Dashboard](#4-inicio--dashboard)
5. [Catálogo](#5-catálogo)
6. [Sala](#6-sala)
7. [TPV (operativa)](#7-tpv-operativa)
8. [Cocina / KDS, Kiosko, Display, Ofertas, Comandera](#8-pantallas-operativas-secundarias)
9. [Personal: empleados, roles y permisos, flujo de dispositivo](#9-personal)
10. [Caja](#10-caja)
11. [Dispositivos](#11-dispositivos)
12. [Marca / Personalización](#12-marca--personalización)
13. [Fiscal](#13-fiscal)
14. [Seguridad](#14-seguridad)
15. [Plataforma (admin Gluuh)](#15-plataforma-admin-gluuh)
16. [Tabla resumen final (páginas · estado · prioridad)](#16-tabla-resumen-final)

---

## 1. Filosofía de UX (estilo Supabase)

El backoffice debe **verse y comportarse como el dashboard de Supabase**: sobrio, denso,
profesional, rápido. Las pantallas operativas (TPV, comandera, KDS, kiosko) siguen la
**dirección Ágora** (colorida, táctil, botones grandes); pero todo lo que sea **gestión y
configuración** adopta el lenguaje Supabase.

### 1.1 Cómo se ve Supabase (y cómo lo trasladamos)

| Rasgo de Supabase | Traslación a Gluuh | Estado |
|---|---|---|
| **Rail de iconos** estrecho a la izquierda + **panel secundario** contextual que se abre/cierra | Ya implementado: `apps/web/app/(panel)/layout.tsx` (rail de 64px `w-16` + `aside w-56` plegable, botón `PanelLeftClose`) | ✅ |
| **Esquinas poco redondeadas** (≤8px) | Tokens `rounded-md` (6px) / `rounded-lg` (8px); evitar `rounded-2xl` salvo en superficies "marketing" (kiosko/preview) | ✅ |
| **Bordes 1px claros** que separan zonas | `border border-border` por defecto en tarjetas, tablas, inputs | ✅ |
| **Formularios densos, etiqueta arriba** | Patrón `space-y-1.5` → `<Label>` + `<Input>` + ayuda (`text-xs text-muted-foreground`) | ✅ (ver `ajustes`, `personalizar`) |
| **Modo claro / oscuro** | `ThemeToggle` en la cabecera; variables CSS `--background`, `--foreground`, `--brand`… | ✅ |
| **Estados vacíos con guía** + acción | Primitivo `EmptyState` (icono + título + descripción + acción) | ✅ existe, 🟡 falta usarlo en todas |
| **Tablas con acciones** (fila → editar/borrar) | Primitivo `Table` (shadcn); patrón fila + acción a la derecha | ✅ existe, 🟡 inconsistente |
| **Cabecera de página** con título + descripción + acciones | Primitivo `PageHeader` (título 2xl + descripción + slot de acciones) | ✅ |
| **Tarjetas KPI** | Primitivo `StatCard` (icono + label + valor + hint) | ✅ |
| **Sub-navegación dentro de un apartado** (pestañas/secciones) | 🟡 **falta**: Ajustes y Personal deberían tener pestañas internas (Supabase: "Settings → General/Auth/Database…") | 🟡 |
| **Panel lateral / drawer de detalle** para editar sin salir de la lista | 🟡 **falta**: usar `Dialog` (ya existe) o un *side sheet* para crear/editar | 🟡 |
| **Breadcrumbs** y "guardado automático / Guardar" visible | 🟡 parcial (hay mensajes "Guardado ✓") | 🟡 |

### 1.2 Principios de interacción

- **Lista → detalle.** Cada entidad tiene una **lista** (tabla o rejilla) y un **detalle**
  editable. Crear/editar puede ser página propia o **drawer lateral** (preferido para
  entidades simples: familia, mesa, modificador).
- **Densidad por defecto, aire donde importa.** Tablas compactas; formularios agrupados en
  tarjetas por bloque temático.
- **Feedback inmediato.** Toda acción de guardado muestra estado (`Guardando…` → `Guardado ✓`)
  y los errores se muestran en línea (no `alert()`; hoy quedan `alert`/`prompt` por migrar).
- **Sin callejones sin salida.** Estado vacío siempre con CTA. Estado sin permiso con mensaje
  claro. Estado de error con reintento.
- **Atajos de teclado** (fase posterior): `C` crear, `/` buscar, `Esc` cerrar drawer.

---

## 2. Mapa de navegación e información (IA) y matriz de roles

### 2.1 Roles del sistema (columna `app_user.rol`)

`CHECK (rol IN ('ADMIN_PLATAFORMA','PROPIETARIO','ENCARGADO','CAMARERO','COCINA'))`

- **ADMIN_PLATAFORMA** — equipo Gluuh. No es de un tenant; gestiona la plataforma (`/admin`).
- **PROPIETARIO** — dueño del negocio. Acceso total al backoffice de su tenant.
- **ENCARGADO** — gestión diaria; casi todo menos configuración sensible (fiscal, plan, borrado).
- **CAMARERO** — solo operativa (TPV, comandera). No entra al backoffice de gestión.
- **COCINA** — solo KDS/cocina.

> **Identificación en dispositivo (clave):** la tablet/terminal entra **una vez** con la
> cuenta de empresa (sesión Supabase). Luego **cada empleado se identifica con su PIN**
> (`validar_pin`), la sesión queda abierta y la UI muestra lo permitido por su rol. Ver §9.4.

### 2.2 Mapa de navegación (IA propuesta — reorganiza el actual)

El rail actual tiene 4 grupos (Inicio, Operativa, Carta y sala, Gestión). Se propone esta IA
ampliada (los apartados nuevos en 🟡):

```
┌─ INICIO
│   └─ Resumen (dashboard, KPIs)                                   ✅
│
├─ OPERATIVA  (pantallas a pantalla completa, fuera del panel)
│   ├─ TPV                                                          ✅
│   ├─ Comandera                                                    ✅
│   ├─ Cocina (KDS)                                                 ✅
│   ├─ Kiosko                                                       ✅
│   ├─ Display (pantalla de turnos)                                 ✅
│   └─ Ofertas (cartelería)                                         ✅
│
├─ CATÁLOGO                                                         (hoy todo en "Carta")
│   ├─ Familias                                                     ✅
│   ├─ Categorías                                                   ✅
│   ├─ Productos                                                    ✅ (alta básica) / 🟡 ficha completa
│   ├─ Modificadores (grupos y opciones)                           🟡 (tablas existen)
│   ├─ Menús / Combos                                              🟡 (no hay tabla aún)
│   └─ Tarifas (precios por sala/horario)                          🟡 (no hay tabla aún)
│
├─ SALA
│   ├─ Salas y zonas                                               ✅
│   └─ Mesas (capacidad, plano)                                    ✅ / 🟡 capacidad+plano
│
├─ GESTIÓN
│   ├─ Empleados                                                   ✅
│   ├─ Roles y permisos                                            🟡
│   ├─ Informes                                                     ✅ (básico)
│   └─ Caja (arqueos, movimientos, cierre Z)                       🟡
│
├─ CONFIGURACIÓN  (Ajustes con pestañas internas)
│   ├─ Negocio (empresa + local)                                   ✅ (en Ajustes)
│   ├─ Fiscal (territorio, serie, Verifactu/TicketBAI)             ✅ (en Ajustes)
│   ├─ Formas de pago                                              🟡
│   ├─ Dispositivos (impresoras, cajón, datáfono, balanza)         🟡
│   ├─ Marca / Personalización                                     ✅
│   └─ Seguridad (contraseña, passkeys, sesiones)                  ✅ / 🟡 sesiones
│
└─ PLATAFORMA  (solo ADMIN_PLATAFORMA, ruta /admin)
    ├─ Empresas (alta)                                             ✅
    └─ Solicitudes de contacto                                     ✅
```

### 2.3 Matriz de visibilidad por rol

> "✔" = ve y usa · "👁" = solo lectura · "—" = oculto. (El rol se filtra hoy en
> `NAV_GROUPS[].items[].roles`.)

| Apartado / Página | PROPIETARIO | ENCARGADO | CAMARERO | COCINA |
|---|:--:|:--:|:--:|:--:|
| Inicio / Dashboard | ✔ | ✔ | — | — |
| TPV | ✔ | ✔ | ✔ | — |
| Comandera | ✔ | ✔ | ✔ | — |
| Cocina (KDS) | ✔ | ✔ | — | ✔ |
| Kiosko / Display / Ofertas | ✔ | ✔ | — | — |
| Catálogo · Familias / Categorías | ✔ | ✔ | — | — |
| Catálogo · Productos | ✔ | ✔ | 👁 (86/agotado) | 👁 (86/agotado) |
| Catálogo · Modificadores / Menús / Tarifas | ✔ | ✔ | — | — |
| Sala · Salas y mesas | ✔ | ✔ | — | — |
| Gestión · Empleados | ✔ | ✔ | — | — |
| Gestión · Roles y permisos | ✔ | — | — | — |
| Gestión · Informes | ✔ | ✔ | — | — |
| Gestión · Caja (arqueo/Z) | ✔ | ✔ | 👁 (su turno) | — |
| Config · Negocio | ✔ | 👁 | — | — |
| Config · Fiscal | ✔ | — | — | — |
| Config · Formas de pago | ✔ | ✔ | — | — |
| Config · Dispositivos | ✔ | ✔ | — | — |
| Config · Marca / Personalización | ✔ | — | — | — |
| Config · Seguridad | ✔ | 👁 (la suya) | 👁 (la suya) | 👁 (la suya) |
| Plataforma (/admin) | — | — | — | — |

> **Implementación de permisos.** Hoy el filtro es por `rol` en el cliente + RLS por `tenant_id`
> + checks en RPC (`crear_empleado` exige PROPIETARIO/ENCARGADO). Para permisos finos (§9.3) se
> propone una columna `app_user.permisos jsonb` y/o tabla `role_permission`. **Crítico:** el
> filtrado en el cliente es solo UX; la **autorización real** debe estar en RLS/RPC del backend.

---

## 3. Patrones transversales

Estos patrones aplican a **todas** las secciones de creación/configuración. No se repiten en
cada apartado; aquí quedan definidos una vez.

### 3.1 Anatomía de una página de **lista**

- **`PageHeader`**: título + descripción + acciones (botón primario "Nuevo…", buscador, filtros).
- **Buscador** (🟡 falta): input con icono, filtra en cliente (o servidor si >200 filas).
- **Filtros** (🟡 falta): por estado/familia/rol según entidad (chips o `Select`).
- **Tabla o rejilla**: columnas clave + columna de acciones (editar / activar / borrar).
- **Paginación** (🟡 falta): cuando proceda (>50 filas).
- **Estados** (§3.3).

### 3.2 Anatomía de un **formulario** (crear/editar)

- Etiqueta **arriba** (`<Label>`), input a ancho completo, ayuda **debajo** (`text-xs`).
- Campos agrupados en **tarjetas por bloque** (Datos básicos / Fiscal / Disponibilidad…).
- Validación **en línea** (mensaje rojo bajo el campo); deshabilitar "Guardar" mientras inválido.
- Botonera fija abajo: **Guardar** (primario) · **Cancelar** · (en editar) **Eliminar** (destructivo, con confirmación).
- Indicador de guardado: `Guardando…` → `Guardado ✓` (toast o badge).

### 3.3 Estados estándar de cada página

| Estado | Qué se muestra | Primitivo |
|---|---|---|
| **Cargando** | Skeleton de la tabla/tarjetas, o texto "Cargando…" (mínimo) | 🟡 hoy texto; falta skeleton |
| **Vacío** | `EmptyState`: icono + "Sin X todavía" + descripción + CTA "Crear X" | `EmptyState` ✅ |
| **Error** | Tarjeta de error con mensaje + botón "Reintentar" | 🟡 falta primitivo `ErrorState` |
| **Sin permiso** | Mensaje "No tienes acceso a esta sección" + volver (como `/admin` no-auth) | 🟡 falta primitivo reutilizable |
| **Guardando / éxito / fallo** | Estado en el botón + toast/badge | ✅ parcial |

### 3.4 Acciones y navegación comunes

- **Crear**: botón primario en `PageHeader` → drawer/página de alta → al guardar, vuelve a la lista con la fila nueva resaltada.
- **Editar**: clic en fila → drawer/página → guardar → vuelta a la lista.
- **Activar/Desactivar** (soft): toggle en la fila (patrón ya usado en empleados/productos).
- **Eliminar**: con `confirm` (hoy nativo; migrar a `Dialog` de confirmación).
- **Reordenar**: drag & drop con `orden` (🟡 falta; hoy `orden` es campo numérico manual).

---

## 4. Inicio / Dashboard

**Ruta:** `/dashboard` · **Archivo:** `apps/web/app/(panel)/dashboard/page.tsx` · **Estado:** ✅

### 4.1 Páginas

| Página | Descripción | Estado |
|---|---|---|
| Resumen | KPIs del día + gráfica de ventas por hora + últimos pedidos + top productos + accesos rápidos | ✅ |

### 4.2 Contenido (no es un formulario; es lectura)

| Bloque | Datos / origen | Estado |
|---|---|---|
| KPI "Ventas hoy" | `sum(sales_order.total)` del día | ✅ |
| KPI "Tickets" | `count(sales_order)` del día | ✅ |
| KPI "Ticket medio" | ventas / tickets | ✅ |
| KPI "Mesas" | ocupadas/total desde `restaurant_table.estado` | ✅ |
| Gráfica "Ventas por hora" | agregación por hora (barras CSS) | ✅ |
| "Últimos pedidos" | últimos 6 `sales_order` con badge de `estado` | ✅ |
| "Top productos hoy" | agregación de `order_line.cantidad` por `nombre` | ✅ |
| Accesos rápidos | TPV / Cocina / Kiosko / Display | ✅ |
| **Selector de rango** (hoy/semana/mes) | 🟡 hoy fijo a "hoy" | 🟡 |
| **Comparativa** (vs ayer / vs semana pasada) | 🟡 | 🟡 |
| **Filtro por local** (multi-location) | 🟡 (hoy 1 local por tenant) | 🟡 |

### 4.3 Estados

- **Cargando**: KPIs muestran "…"; gráficas vacías. ✅
- **Vacío** (sin ventas): mensajes "Sin pedidos hoy todavía", "Aún sin ventas de productos". ✅
- **Error**: 🟡 falta (hoy fallaría silenciosamente).
- **Sin permiso**: oculto a CAMARERO/COCINA por nav. ✅

### 4.4 Acciones

- "Abrir TPV" (CTA principal) → `/tpv`. ✅
- Tarjetas de acceso rápido → pantallas operativas. ✅

---

## 5. Catálogo

Hoy todo vive en una sola página `/carta`. La especificación lo **descompone** en sub-páginas
(estilo Supabase: una sección por entidad), manteniendo `/carta` como vista combinada opcional.

**Jerarquía real (Ágora):** `family` → `category` (con `family_id`) → `product` (con `category_id`).

### 5.1 Familias

**Tabla:** `family` · **Páginas:** lista + crear/editar (drawer) · **Estado:** ✅ (alta básica)

#### Formulario "Familia"

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío, ≤60 | — | "Bebidas, Comidas, Postres…" | ✅ |
| Color | `color` | color (`#hex`) | ○ | hex válido | `#64748b` | "Color con el que se pinta en el TPV" | 🟡 (existe en BD; falta editor en UI) |
| Orden | `orden` | number | ○ | entero ≥0 | `family.length` | "Posición en el TPV" | ✅ (auto) / 🟡 reordenar D&D |

- **Acciones:** Crear (form rápido inline ✅) · Editar nombre/color/orden (🟡) · Eliminar (✅, con aviso "sus categorías quedan sin familia").
- **Estados:** vacío → `EmptyState` "Sin familias ni categorías" ✅.

### 5.2 Categorías

**Tabla:** `category` (cols: `nombre`, `orden`, `family_id`) · **Estado:** ✅ (alta básica)

#### Formulario "Categoría"

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío, ≤60 | — | — | ✅ |
| Familia | `family_id` | select (familias) | ○ | uuid o null | "Sin familia" | "Hereda el color de la familia" | ✅ |
| Orden | `orden` | number | ○ | entero ≥0 | `cats.length` | — | ✅ (auto) / 🟡 D&D |

- **Acciones:** Crear ✅ · Editar (🟡) · Eliminar ✅ ("sus productos quedan sin categoría").

### 5.3 Productos ★ (la ficha central)

**Tabla:** `product` · **Estado:** ✅ alta rápida en `/carta`; 🟡 **ficha completa** (foto, alérgenos, descripción, código de barras, modificadores, disponibilidad por canal).

**Columnas reales de `product`:** `id, tenant_id, category_id, nombre, precio, tipo_impositivo,
clase_fiscal, es_alcohol, estacion, foto_url, disponible, created_at, updated_at`.

#### Formulario "Producto" — bloques

**Bloque A · Datos básicos**

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío, ≤80 | — | — | ✅ |
| Categoría | `category_id` | select | ○ | uuid o null | la actual | — | ✅ |
| Descripción | `descripcion` (🟡 falta columna) | textarea | ○ | ≤300 | — | "Se muestra en kiosko/carta digital" | 🟡 |
| Foto | `foto_url` | imagen (upload a Storage `media`) | ○ | jpg/png/webp, <2MB | — | "Recomendado para kiosko" | 🟡 (columna ✅, uploader falta) |
| Código de barras | `codigo_barras` (🟡 falta columna) | texto | ○ | EAN-8/13 | — | "Para lector de barras" | 🟡 |

**Bloque B · Precio y fiscalidad** (★ crítico)

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Precio (PVP) | `precio` | number (decimal) | ● | >0, 2 decimales | — | "Impuesto **incluido**" | ✅ |
| Clase fiscal | `clase_fiscal` | select | ● | GENERAL/REDUCIDO/SUPERREDUCIDO/EXENTO | REDUCIDO | "Determina el % según territorio" | ✅ |
| Tipo impositivo (%) | `tipo_impositivo` | ⚙️ derivado (solo lectura) | ⚙️ | — | `resolver_iva()` | "IVA/IGIC/IPSI **automático** por clase × territorio" | ✅ |
| Es alcohol | `es_alcohol` | switch | ○ | — | false | "Si se activa, fuerza clase **GENERAL**" | ✅ |

> **Regla fiscal (innegociable).** El % **no se teclea**: lo resuelve `ivaAuto(clase, territorio)`
> (cliente, `@gluuh/core`) y `resolver_iva()` (SQL, `tax_rate`). Ambos **deben coincidir**.
> Península 21/10/4/0 · Canarias IGIC 7/3/0/0 · Ceuta/Melilla IPSI 10/4/1/0. El alta en
> `/carta` ya lo aplica al insertar (`tipo_impositivo: ivaAuto(...)`).

**Bloque C · Disponibilidad y enrutado**

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Disponible (86) | `disponible` | switch | ○ | — | true | "Agotado = no aparece en TPV/kiosko" | ✅ |
| Estación / centro producción | `estacion` | select (barra/cocina/parrilla/…) | ○ | texto | null | "A qué impresora/KDS se enruta" | 🟡 (columna ✅, UI falta) |
| Disponible por canal | `canales` (🟡 falta) | multiselect (TPV/COMANDERA/KIOSKO/ONLINE) | ○ | — | todos | "Limita en qué canales se vende" | 🟡 |
| Disponible por horario | (🟡 ver Tarifas §5.6) | — | ○ | — | — | "Ej. solo en horario de desayunos" | 🟡 |

**Bloque D · Alérgenos (14 UE)** — `product_allergen` ↔ `allergen` (catálogo global)

| Campo | Origen | Tipo input | Oblig. | Estado |
|---|---|---|---|---|
| Alérgenos | `allergen.codigo` (14) → filas en `product_allergen` | multiselect con iconos | ○ | 🟡 (tablas existen; UI falta) |

> **14 alérgenos UE** (poblar `allergen`): gluten, crustáceos, huevos, pescado, cacahuetes,
> soja, lácteos, frutos de cáscara, apio, mostaza, sésamo, sulfitos, altramuces, moluscos.

**Bloque E · Modificadores** — `modifier_group` (con `min_sel`, `max_sel`) → `modifier`

| Campo | Origen | Tipo input | Estado |
|---|---|---|---|
| Grupos asociados | `modifier_group` del producto | lista editable (añadir grupo) | 🟡 |

**Bloque F · Escandallo (receta → stock)** — `recipe_item` → `ingredient`

| Campo | Origen | Tipo input | Estado |
|---|---|---|---|
| Ingredientes y cantidades | `recipe_item.cantidad` + `ingredient` | tabla editable | 🟡 (tablas existen; fase posterior) |

- **Acciones:** Crear · Editar (ficha completa) · Duplicar (🟡 útil) · Activar/Desactivar (86) ✅ · Eliminar ✅.
- **Lista de productos:** hoy embebida bajo cada categoría en `/carta` ✅. Falta vista tabla global con buscador y filtro por familia/categoría/disponibilidad (🟡).
- **Estados:** vacío "Sin productos en esta categoría" ✅; falta error/skeleton (🟡).

### 5.4 Modificadores (extras / quitar)

**Tablas:** `modifier_group` (`nombre`, `min_sel`, `max_sel`, `product_id`) · `modifier`
(`nombre`, `precio_extra`, `modifier_group_id`) · **Estado:** 🟡 (tablas existen; sin UI).

#### Formulario "Grupo de modificadores"

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | "Punto de la carne, Extras, Quitar…" | 🟡 |
| Mínimo selección | `min_sel` | number | ● | ≥0 | 0 | "0 = opcional" | 🟡 |
| Máximo selección | `max_sel` | number | ● | ≥`min_sel` | 1 | "1 = elige uno" | 🟡 |
| Producto | `product_id` | select / contexto | ● | uuid | — | (hoy el grupo cuelga de **un** producto) | 🟡 |

> **Mejora sugerida:** hoy `modifier_group.product_id` ata el grupo a **un** producto. Para
> reutilizar grupos (p. ej. "Punto de carne" en varios platos) conviene un modelo
> **muchos-a-muchos** (`product_modifier_group`). Documentado como 🟡.

#### Formulario "Modificador" (opción)

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Estado |
|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | 🟡 |
| Precio extra | `precio_extra` | number | ○ | ≥0 | 0 | 🟡 |

- En la comanda, los modificadores elegidos se serializan en `order_line.modificadores jsonb`.

### 5.5 Menús / Combos (1º / 2º / postre, precio fijo)

**Estado:** 🟡 **no existe tabla**. Es una pieza clave para competir con Ágora. Propuesta de
modelo nuevo:

```
menu            (id, tenant_id, nombre, precio_fijo numeric(12,2), activo, orden, disponible_desde, disponible_hasta)
menu_section    (id, tenant_id, menu_id, nombre  -- "Primero","Segundo","Postre", orden, min_sel=1, max_sel=1)
menu_option     (id, tenant_id, menu_section_id, product_id, suplemento numeric(12,2) DEFAULT 0)
```

#### Formulario "Menú / Combo"

| Campo | Columna (propuesta) | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `menu.nombre` | texto | ● | no vacío | — | "Menú del día, Combo Burger…" | 🟡 |
| Precio fijo | `menu.precio_fijo` | number | ● | >0 | — | "Precio cerrado, impuesto incluido" | 🟡 |
| Activo | `menu.activo` | switch | ○ | — | true | — | 🟡 |
| Disponible horario | `disponible_desde/_hasta` | time | ○ | — | — | "Ej. comidas 13–16h" | 🟡 |
| Secciones | `menu_section[]` | repetidor | ● | ≥1 sección | — | "Primero / Segundo / Postre" | 🟡 |
| Opciones por sección | `menu_option[]` (producto + suplemento) | multiselect productos + €| ● | ≥1 opción/sección | — | "Platos elegibles; suplemento opcional" | 🟡 |

- **Operativa en TPV:** un botón de "menú/combo" abre un asistente que pide elegir 1 opción por
  sección; el resultado entra como líneas en la comanda con precio repartido o como una línea de
  menú con sub-líneas (decisión de implementación; ver §7.4).

### 5.6 Tarifas (precios por sala / horario)

**Estado:** 🟡 **no existe tabla**. Ágora permite distinta tarifa en terraza vs barra, o happy
hour. Propuesta:

```
price_list      (id, tenant_id, nombre, activa)
price_rule      (id, tenant_id, price_list_id, room_id NULL, dia_semana NULL, hora_desde NULL, hora_hasta NULL)
product_price   (id, tenant_id, price_list_id, product_id, precio numeric(12,2))
```

#### Formulario "Tarifa"

| Campo | Columna (propuesta) | Tipo input | Oblig. | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|
| Nombre | `price_list.nombre` | texto | ● | — | "Terraza, Happy hour…" | 🟡 |
| Activa | `price_list.activa` | switch | ○ | true | — | 🟡 |
| Aplicar en sala | `price_rule.room_id` | select salas | ○ | todas | "Vacío = todas las salas" | 🟡 |
| Día/Horario | `price_rule.dia_semana/hora_*` | día + time | ○ | siempre | "Franja en que aplica" | 🟡 |
| Precios | `product_price[]` | tabla producto→precio | ● | hereda base | "Solo los que cambian" | 🟡 |

---

## 6. Sala

**Ruta:** `/sala` · **Archivo:** `apps/web/app/(panel)/sala/page.tsx` · **Estado:** ✅ (salas y
mesas básicas); 🟡 capacidad y plano visual.

### 6.1 Salas / zonas

**Tabla:** `room` (`nombre`, `orden`, `location_id`).

#### Formulario "Sala / zona"

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | "Salón, Terraza, Barra" | ✅ |
| Orden | `orden` | number | ○ | ≥0 | `rooms.length` | — | ✅ (auto) |
| Local | `location_id` | (contexto) | ● | uuid | local actual | (multi-local: fase posterior) | ✅ |

- **Acciones:** Crear ✅ · Eliminar (cascada a mesas, con confirm) ✅ · Editar/renombrar 🟡.

### 6.2 Mesas

**Tabla:** `restaurant_table` (`nombre`, `room_id`, `estado`, `pos_x`, `pos_y`, `updated_at`).

#### Formulario "Mesa"

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | "Mesa 5, T1…" | ✅ |
| Sala | `room_id` | (contexto) | ● | uuid | sala actual | — | ✅ |
| Capacidad (comensales) | `capacidad` (🟡 **falta columna**) | number | ○ | ≥1 | 4 | "Nº de comensales" | 🟡 |
| Posición X / Y | `pos_x`, `pos_y` | ⚙️ (drag en plano) | ○ | entero | null | "Se fija arrastrando en el plano" | 🟡 (columnas ✅) |
| Estado | `estado` | (operativo, no se edita aquí) | ⚙️ | LIBRE/OCUPADA/PIDIENDO/SERVIDA/POR_COBRAR | LIBRE | — | ✅ |

- **Acciones:** Crear una ✅ · **Crear varias numeradas** (hoy `prompt`; migrar a `Dialog`) ✅ ·
  Eliminar ✅ · **Editor de plano** (arrastrar mesas, `pos_x/pos_y`) 🟡 — pieza diferenciadora.
- **Estados:** vacío `EmptyState` "Sin salas todavía" ✅.

---

## 7. TPV (operativa)

**Ruta:** `/tpv` · **Archivo:** `apps/web/app/tpv/page.tsx` · **Estado:** ✅ (layout Ágora,
teclado, ticket en vivo, cobro, VERIFACTU). No es una página de configuración, pero se
**especifica su funcionamiento** porque consume todo lo configurado en Catálogo/Sala/Fiscal.

### 7.1 Flujo general

```
(Sesión empresa) → [PIN empleado opcional] → Selección Mesa o "Barra / venta directa"
→ Pantalla de venta: Categorías (a color) → Productos → líneas en ticket
→ Teclado (cantidad, DTO%, DTO€, PREC, CAN) → Acciones (Preparar/Marchar/Entregar/Cobrar)
→ Cobro (Efectivo / Pagos: Tarjeta/Bizum) → Ticket con QR VERIFACTU
```

### 7.2 Pantalla de venta (estructura actual ✅)

- **Cabecera:** nombre de mesa/Barra + fecha/hora + **barra de acento** con el color de la
  categoría activa (`colorCat` derivado de `family.color`). ✅
- **Columna izquierda (ticket en vivo):** líneas (uds · producto · precio · total), **TOTAL**
  grande, y **teclado numérico**. ✅
- **Columna derecha:** rejilla de **categorías a color** → al tocar, rejilla de **productos**
  de esa categoría (precio en rojo). ✅
- **Barra de acciones (footer):** Cobrar Efectivo · Pagos · Imprimir · Preparar · Marchar ·
  Entregar Comanda · Volver. ✅

### 7.3 Teclado y operaciones de línea (✅)

| Tecla | Función | Estado |
|---|---|---|
| `0–9`, `,` | Componen el **buffer** (cantidad / valor) | ✅ |
| `CLR` | Limpia buffer y deselecciona línea | ✅ |
| Tocar producto | Añade `buffer` uds (o 1) del producto | ✅ |
| Tocar línea | La selecciona (`lineaSel`) para DTO/PREC/CAN | ✅ |
| `DTO%` | Descuento % a la línea seleccionada o a **todas** si no hay selección | ✅ |
| `DTO€` | Descuento en € (idem) | ✅ |
| `PREC` | Fija **precio manual** de la línea seleccionada | ✅ |
| `CAN` | Elimina la línea seleccionada (y sus dto/precio) | ✅ |

### 7.4 Funciones que faltan en TPV (🟡, para paridad con Ágora)

| Función | Descripción | Estado |
|---|---|---|
| **Botón de Menú/Combo** | Asistente 1º/2º/postre con precio fijo (consume §5.5) | 🟡 |
| **Modificadores en venta** | Al añadir producto con grupos, pedir extras/quitar → a `order_line.modificadores` | 🟡 |
| **Dividir cuenta** | Por comensales, por importe o por productos; generar varios `payment`/tickets | 🟡 |
| **Pago mixto** | `payment.metodo='MIXTO'` o varios `payment` por orden (efectivo + tarjeta) | 🟡 |
| **Invitación / autoconsumo / merma** | `sales_order.tipo_operacion` ≠ VENTA + `motivo_no_venta` (no factura, sí traza) | 🟡 |
| **Aparcar / recuperar** | Guardar comanda abierta (`estado='ABIERTA'`) y retomarla; hoy la mesa pasa a OCUPADA pero no se reabre la comanda en curso | 🟡 |
| **Propina** | `payment.propina` (existe en BD) en el cobro | 🟡 |
| **Comensales** | Pedir nº al abrir mesa (`sales_order.comensales`) | 🟡 |
| **Selección de empleado por PIN en TPV** | Hoy el TPV usa el usuario de sesión; la comandera sí pide PIN | 🟡 |
| **Buscar producto** | Buscador rápido por nombre/código de barras | 🟡 |

### 7.5 Cobro y ticket (✅ con matices)

- `cobrar(metodo)` llama a `/api/ticket` (motor `@gluuh/core`: desglose de impuestos + huella +
  QR VERIFACTU), crea `sales_order` (COBRADA) + `order_line` + `payment`, libera la mesa, y
  muestra el modal de ticket con **QR y leyenda VERIFACTU**. ✅
- Métodos hoy: Efectivo, Tarjeta, Bizum (`payment.metodo` admite EFECTIVO/TARJETA/BIZUM/QR/WALLET/MIXTO). ✅/🟡
- **Falta:** persistir `invoice` + `tax_line` + `verifactu_record` reales (hoy el ticket se
  calcula pero la factura formal y su registro encadenado no se guardan desde el TPV web). 🟡 (crítico fiscal).

---

## 8. Pantallas operativas secundarias

Todas a pantalla completa (fuera del panel). Su **configuración** vive en otras secciones
(Catálogo, Marca, Dispositivos).

### 8.1 Cocina / KDS

**Ruta:** `/cocina` · **Archivo:** `apps/web/app/cocina/page.tsx` · **Estado:** ✅

- Muestra `sales_order` en `estado='ENVIADA_COCINA'` y `estado_preparacion ≠ ENTREGADO`,
  **en tiempo real** (Realtime). Tarjetas con líneas, tiempo transcurrido y botón "avanzar
  estado" (`PENDIENTE→EN_PREPARACION→LISTO→ENTREGADO`, lib `estados`). ✅
- **Configuración pendiente (🟡):** vista **por estación** (`product.estacion`), aviso sonoro,
  filtros por estación, modo "pase". Hoy es una sola cola global.

### 8.2 Kiosko

**Ruta:** `/kiosko` · **Estado:** ✅ — pedido autoservicio; usa `tenant_branding` (logo, colores,
títulos) y `crear_pedido(tipo_consumo, items)`. Config en **Marca/Personalización** (§12).

### 8.3 Display (pantalla de turnos)

**Ruta:** `/pantalla` · **Estado:** ✅ — muestra `numero_pedido` y `estado_preparacion` (estilo
fast-food "en preparación / listo"). Sin configuración propia más allá de Marca.

### 8.4 Ofertas / cartelería

**Ruta:** `/ofertas` · **Estado:** ✅ — reproduce en bucle las `offer` activas (emoji/imagen/
vídeo). Se **configuran** en Personalización (§12).

### 8.5 Comandera

**Ruta:** `/comandera` · **Archivo:** `apps/web/app/comandera/page.tsx` · **Estado:** ✅

- **Login por PIN** (`validar_pin`) → plano de mesas → carta (categorías → productos) → comanda →
  "Enviar a cocina" (`canal='COMANDERA'`). ✅ Es el **patrón de identificación por PIN** que el
  TPV debería adoptar (§9.4).
- **Pendiente (🟡):** modificadores, notas, por pase/comensal, cobro en mesa, offline real.

---

## 9. Personal

**Ruta:** `/empleados` · **Archivo:** `apps/web/app/(panel)/empleados/page.tsx` · **Estado:** ✅
(alta + activar/desactivar); 🟡 edición, permisos finos, gestión de PIN.

### 9.1 Empleados

**Tabla:** `app_user` (`nombre`, `email`, `rol`, `pin_hash`, `activo`, `auth_user_id`, `password_hash`).
**Alta vía RPC** `crear_empleado(p_nombre, p_email, p_rol, p_pin)` (hashea el PIN con bcrypt;
exige rol PROPIETARIO/ENCARGADO; rol creado ∈ {ENCARGADO, CAMARERO, COCINA}).

#### Formulario "Empleado"

| Campo | Columna / param | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | "Ana García" | ✅ |
| Email | `email` | email | ○ | formato email; único | — | "Para acceso al backoffice (opcional)" | ✅ |
| Rol | `rol` | select | ● | ENCARGADO/CAMARERO/COCINA | CAMARERO | "Define qué ve y puede hacer" | ✅ |
| PIN | `pin_hash` (param `p_pin`) | password numérico | ● | ≥4 dígitos | — | "Para identificarse en TPV/comandera" | ✅ |
| Activo | `activo` | switch | ○ | — | true | "Inactivo no puede operar" | ✅ |
| Permisos finos | `permisos jsonb` (🟡 **falta columna**) | (ver §9.3) | ○ | — | según rol | "Overrides por acción" | 🟡 |

- **Acciones:** Crear ✅ · Activar/Desactivar ✅ · **Editar** (nombre/rol/email) 🟡 · **Cambiar/Resetear PIN** 🟡 · **Eliminar** 🟡.
- **Lista:** tabla con Nombre/Rol/Estado + acción ✅. Falta filtro por rol y buscador (🟡).
- **Estados:** vacío "Aún no hay empleados" ✅; error en línea (mensaje de RPC) ✅.

### 9.2 Control horario (fichajes) — `shift`

**Estado:** 🟡 (tabla `shift` existe: `entrada`, `salida`, `user_id`). Página de
"Fichajes/Turnos" para entrada/salida y reporte de horas. Sin UI hoy.

### 9.3 Roles y permisos finos

**Estado:** 🟡 (solo existe el enum `rol`). Para competir con Ágora hace falta **permisos por
acción**. Propuesta de UI (matriz rol × permiso) respaldada por `app_user.permisos jsonb` o tabla
`role_permission(tenant_id, rol, permiso, permitido)`.

#### Catálogo de permisos sugerido (página "Roles y permisos")

| Permiso (clave) | Descripción | PROPIETARIO | ENCARGADO | CAMARERO | COCINA |
|---|---|:--:|:--:|:--:|:--:|
| `venta.cobrar` | Cobrar tickets | ✔ | ✔ | ✔ | — |
| `venta.descuento` | Aplicar DTO%/€ | ✔ | ✔ | ⚙️ configurable | — |
| `venta.precio_manual` | Cambiar precio (PREC) | ✔ | ✔ | — | — |
| `venta.anular_linea` | Anular líneas (CAN) | ✔ | ✔ | ⚙️ | — |
| `venta.invitacion` | Invitaciones/autoconsumo | ✔ | ✔ | — | — |
| `caja.abrir_cerrar` | Apertura/cierre Z | ✔ | ✔ | — | — |
| `caja.retirada` | Retiradas de efectivo | ✔ | ✔ | — | — |
| `catalogo.editar` | Editar carta | ✔ | ✔ | — | — |
| `empleados.gestionar` | Crear/editar empleados | ✔ | ✔ | — | — |
| `config.fiscal` | Datos fiscales / serie | ✔ | — | — | — |
| `informes.ver` | Ver informes | ✔ | ✔ | — | — |

> **Interfaz:** matriz de switches (filas = permisos, columnas = roles) + posibilidad de
> **override por empleado** en su ficha. **Autorización real en backend** (RLS/RPC), no solo UI.

### 9.4 Flujo de dispositivo (identificación por PIN) — ★

**Estado:** ✅ en comandera; 🟡 en TPV; falta documentación/UX unificada.

```
1. La tablet/terminal se asocia a la EMPRESA (login Supabase una vez; sesión persistente).
   └─ (futuro) registrar el dispositivo en la tabla `device` (tipo TPV/COMANDERA/KDS).
2. La app queda "abierta" en modo dispositivo. NO se cierra sesión entre empleados.
3. Cada empleado pulsa su PIN → `validar_pin(pin)` devuelve {id, nombre, rol} dentro del tenant.
4. La UI se adapta al rol del empleado identificado y ATRIBUYE sus acciones
   (`sales_order.user_id`, `order_event.user_id`, `cash_session.abierta_por`).
5. Tras inactividad o "cambiar usuario", vuelve a la pantalla de PIN (la sesión de empresa sigue).
```

**Pantallas implicadas:**
- **Pantalla de PIN** (teclado numérico grande) — ✅ en comandera; 🟡 falta en TPV.
- **Indicador de empleado activo** + "cambiar" — ✅ comandera; 🟡 TPV.
- **Config del dispositivo** (qué local, qué serie de facturación, qué impresora por defecto):
  apoyada en `device` (`tipo`, `serie_dispositivo`, `ultima_huella`) — 🟡 sin UI.

---

## 10. Caja

**Estado:** 🟡 **sin UI** (tablas `cash_session` y `cash_move` existen). Pieza imprescindible.

**Tablas:** `cash_session` (`fondo_inicial`, `abierta_por`, `abierta_en`, `cerrada_en`,
`total_efectivo`, `total_tarjeta`, `descuadre`, `device_id`, `location_id`) · `cash_move`
(`tipo` ENTRADA/SALIDA, `importe`, `motivo`).

### 10.1 Páginas

| Página | Descripción | Estado |
|---|---|---|
| Estado de caja | Caja abierta actual: fondo, ventas por método, movimientos | 🟡 |
| Apertura de caja | Form de apertura (fondo inicial) | 🟡 |
| Movimiento (entrada/retirada) | Form rápido | 🟡 |
| Arqueo / Cierre Z | Conteo real vs teórico → descuadre → cierre | 🟡 |
| Historial de cierres (Z/X) | Lista de sesiones cerradas | 🟡 |

### 10.2 Formularios

**Apertura de caja**

| Campo | Columna | Tipo input | Oblig. | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|
| Fondo inicial | `fondo_inicial` | number | ● | 0 | "Efectivo de cambio al abrir" | 🟡 |
| Abierta por | `abierta_por` | ⚙️ (empleado por PIN) | ⚙️ | — | — | 🟡 |
| Dispositivo | `device_id` | ⚙️/select | ○ | — | — | 🟡 |

**Movimiento de caja**

| Campo | Columna | Tipo input | Oblig. | Validación | Ayuda | Estado |
|---|---|---|---|---|---|---|
| Tipo | `tipo` | select (ENTRADA/SALIDA) | ● | — | "Entrada de cambio / retirada" | 🟡 |
| Importe | `importe` | number | ● | >0 | — | 🟡 |
| Motivo | `motivo` | texto | ○ | — | "Pago proveedor, cambio…" | 🟡 |

**Arqueo / Cierre Z** (informe + cierre)

| Dato | Origen | Tipo | Estado |
|---|---|---|---|
| Total efectivo teórico | ventas efectivo + fondo + entradas − salidas | ⚙️ | 🟡 |
| Efectivo contado | input number | ● | 🟡 |
| Descuadre | contado − teórico | ⚙️ → `descuadre` | 🟡 |
| Total tarjeta | `payment` TARJETA | ⚙️ → `total_tarjeta` | 🟡 |
| Cierre | sella `cerrada_en` + cierre Z (correlativo) | acción | 🟡 |

### 10.3 Formas de pago (configuración) — Config

**Estado:** 🟡 (hoy los métodos están **hardcodeados** en el TPV: Efectivo/Tarjeta/Bizum). El
enum BD admite EFECTIVO/TARJETA/BIZUM/QR/WALLET/MIXTO. Propuesta: tabla `payment_method`
(`tenant_id`, `nombre`, `tipo`, `activo`, `orden`, `abre_cajon bool`, `requiere_referencia bool`).

| Campo | Columna (propuesta) | Tipo input | Oblig. | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | — | "Efectivo, Tarjeta, Bizum…" | 🟡 |
| Tipo | `tipo` | select (enum BD) | ● | EFECTIVO | — | 🟡 |
| Activo | `activo` | switch | ○ | true | — | 🟡 |
| Abre cajón | `abre_cajon` | switch | ○ | (efectivo: true) | "Manda 'kick' al cajón" | 🟡 |
| Orden | `orden` | number | ○ | — | — | 🟡 |

---

## 11. Dispositivos

**Estado:** 🟡 **sin UI** y **sin tabla de impresoras** (la tabla `device` existe para terminales,
no para periféricos). Es donde se configura el **hardware** (ver `docs/09` y `docs/10`).

### 11.1 Impresoras

**Estado:** 🟡 (proponer tabla `printer`). Modelo sugerido:

```
printer (id, tenant_id, location_id, nombre, conexion 'RED'|'USB'|'BT',
         host, puerto int DEFAULT 9100, ancho '58'|'80',
         centro_produccion 'CAJA'|'COCINA'|'BARRA'|..., abre_cajon bool, copias int DEFAULT 1,
         lenguaje 'ESCPOS' DEFAULT, activa bool)
```

#### Formulario "Impresora"

| Campo | Columna (propuesta) | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre | `nombre` | texto | ● | no vacío | — | "Caja, Cocina, Barra" | 🟡 |
| Conexión | `conexion` | select | ● | RED/USB/BT | RED | — | 🟡 |
| IP (host) | `host` | texto (IPv4) | ●(si RED) | IP válida | — | "IP fija de la impresora" | 🟡 |
| Puerto | `puerto` | number | ○ | 1–65535 | 9100 | "ESC/POS raw = 9100" | 🟡 |
| Ancho de papel | `ancho` | select | ● | 58/80 | 80 | "mm" | 🟡 |
| Centro de producción | `centro_produccion` | select | ● | — | CAJA | "Qué imprime: ticket, comanda cocina/barra" | 🟡 |
| Abre cajón | `abre_cajon` | switch | ○ | — | false | "Sólo en la de caja" | 🟡 |
| Copias | `copias` | number | ○ | 1–5 | 1 | — | 🟡 |
| Probar impresión | (acción) | botón | — | — | — | "Imprime un ticket de prueba" | 🟡 |

> **Enrutado** (docs/10 §2.4): cada `product.estacion` se mapea a una impresora/KDS por su
> `centro_produccion`. La comanda se divide por estación al enviar.

### 11.2 Cajón portamonedas

**Estado:** 🟡 — normalmente colgado de la impresora de caja (`printer.abre_cajon`), se abre con
el comando ESC/POS *kick* tras cobro en efectivo. Config: switch en la impresora + "Probar
apertura".

### 11.3 Datáfono / pasarela de pago

**Estado:** 🟡 (ver `docs/08`). Config sugerida: proveedor (Redsys/Stripe Terminal/SumUp…),
modo (integrado/semiintegrado/manual), credenciales (en backend, **no** en el repo).

| Campo | Tipo input | Oblig. | Ayuda | Estado |
|---|---|---|---|---|
| Proveedor | select | ● | Redsys, Stripe, SumUp… | 🟡 |
| Modo | select | ● | Integrado / Semiintegrado / Manual | 🟡 |
| Credenciales / terminal ID | texto (secreto, backend) | ○ | "Nunca en el cliente" | 🟡 |

### 11.4 Balanza

**Estado:** 🟡 — para productos a peso (puerto serie/USB). Config: modelo/protocolo, productos
"a peso" (vincula con `ingredient.unidad`/producto por kg).

### 11.5 Terminales (`device`) — registro

**Estado:** 🟡 (tabla `device` existe). Lista de terminales TPV/comandera/KDS registrados con su
`serie_dispositivo` (numeración offline sin huecos) y `ultima_sync`/`ultima_huella`. UI: lista +
alta + "desvincular".

---

## 12. Marca / Personalización

**Ruta:** `/personalizar` · **Archivo:** `apps/web/app/(panel)/personalizar/page.tsx` ·
**Estado:** ✅ (marca + ofertas con vista previa en vivo).

### 12.1 Marca — `tenant_branding`

**Columnas:** `nombre_comercial`, `logo_url`, `color_primario`, `color_secundario`,
`kiosko_titulo`, `kiosko_subtitulo`.

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre comercial | `nombre_comercial` | texto | ○ | ≤60 | — | "Cómo se ve en kiosko/cartelería" | ✅ |
| Logo | `logo_url` | imagen (Storage `media/<tenant>/marca`) | ○ | png/svg/webp | — | — | ✅ |
| Color principal | `color_primario` | color + hex | ○ | hex | `#e11d48` | — | ✅ |
| Color secundario | `color_secundario` | color + hex | ○ | hex | `#0f172a` | — | ✅ |
| Título kiosko | `kiosko_titulo` | texto | ○ | ≤40 | — | "¡Bienvenido!" | ✅ |
| Subtítulo kiosko | `kiosko_subtitulo` | texto | ○ | ≤60 | — | "Haz tu pedido aquí" | ✅ |

- **Vista previa del kiosko en vivo** (panel derecho) ✅. Acción "Guardar marca" ✅.

### 12.2 Ofertas / cartelería — `offer`

**Columnas:** `titulo`, `descripcion`, `precio`, `media_tipo` (EMOJI/IMAGEN/VIDEO), `media_url`,
`emoji`, `color`, `orden`, `activa`.

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Título | `titulo` | texto | ● | no vacío | "Nueva oferta" | — | ✅ |
| Descripción | `descripcion` | texto | ○ | — | — | — | ✅ |
| Precio | `precio` | texto | ○ | — | — | "Ej. 9,90 €" (texto libre) | ✅ |
| Tipo de medio | `media_tipo` | select | ● | EMOJI/IMAGEN/VIDEO | EMOJI | — | ✅ |
| Emoji | `emoji` | texto | ○(si EMOJI) | — | 🍔 | — | ✅ |
| Archivo (imagen/vídeo) | `media_url` | upload (Storage `media/<tenant>/ofertas`) | ○(si IMAGEN/VIDEO) | img/video | — | "Pantalla completa, en bucle" | ✅ |
| Color | `color` | color | ○ | hex | `#e11d48` | — | ✅ |
| Orden | `orden` | number | ○ | — | último+1 | — | ✅ / 🟡 D&D |
| Activa | `activa` | switch (ojo) | ○ | — | true | "Oculta = no se muestra" | ✅ |
| Programación horaria | `hora_inicio`/`hora_fin` (🟡 falta) | time | ○ | — | — | "Mostrar solo en una franja" | 🟡 |

- **Acciones por oferta:** activar/ocultar (ojo) ✅ · guardar ✅ · borrar ✅. Vista previa por tarjeta ✅.
- **Estados:** vacío `EmptyState` "Sin ofertas todavía" ✅.

---

## 13. Fiscal

**Ruta:** hoy en `/ajustes` · **Archivo:** `apps/web/app/(panel)/ajustes/page.tsx` ·
**Estado:** ✅ (datos del local + territorio + serie). Debería ser una **pestaña "Fiscal"** dentro
de Configuración. **Solo PROPIETARIO** (datos sensibles).

### 13.1 Datos del local y régimen — `location`

**Columnas:** `nombre`, `direccion`, `cif`, `razon_social`, `territorio_fiscal`,
`regimen_facturacion`, `serie_factura`. (Y `tenant.nombre` para el nombre de empresa.)

| Campo | Columna | Tipo input | Oblig. | Validación | Defecto | Ayuda | Estado |
|---|---|---|---|---|---|---|---|
| Nombre de la empresa | `tenant.nombre` | texto | ● | no vacío | — | — | ✅ |
| Nombre del local | `location.nombre` | texto | ● | no vacío | — | — | ✅ |
| CIF/NIF | `cif` | texto | ● | formato CIF/NIF ES | (`PENDIENTE`) | "Obligatorio para facturar" | ✅ |
| Razón social | `razon_social` | texto | ● | no vacío | — | — | ✅ |
| Dirección | `direccion` | texto | ○ | — | — | "Dirección fiscal" | ✅ |
| Territorio fiscal | `territorio_fiscal` | select | ● | PENINSULA_BALEARES/CANARIAS/CEUTA_MELILLA/FORAL_PV/FORAL_NAVARRA | PENINSULA_BALEARES | "**Decide IVA/IGIC/IPSI**" | ✅ |
| Régimen de facturación | `regimen_facturacion` | select | ● | VERIFACTU/TICKETBAI/BATUZ/OTRO | VERIFACTU | "VERIFACTU (común) o TicketBAI (PV)" | 🟡 (columna ✅; falta en el form de Ajustes) |
| Serie de factura | `serie_factura` | texto | ● | ≤10 | F | "Prefijo de numeración" | ✅ |

> **Validación clave:** el `cif` por defecto es `PENDIENTE`; **no se puede facturar** hasta
> rellenarlo. Mostrar aviso en dashboard/TPV si sigue `PENDIENTE`.

### 13.2 Tipos impositivos — `tax_rate` (referencia, normalmente no se edita)

**Estado:** ✅ (datos sembrados). Tabla `tax_rate (territorio, clase_fiscal, porcentaje)` con
IVA/IGIC/IPSI. UI sugerida: tabla **de solo lectura** (informativa) con los % vigentes por
territorio; edición solo para casos excepcionales (avanzado).

| territorio | GENERAL | REDUCIDO | SUPERREDUCIDO | EXENTO |
|---|:--:|:--:|:--:|:--:|
| PENINSULA_BALEARES (IVA) | 21 | 10 | 4 | 0 |
| CANARIAS (IGIC) | 7 | 3 | 0 | 0 |
| CEUTA_MELILLA (IPSI) | 10 | 4 | 1 | 0 |
| FORAL_PV / FORAL_NAVARRA | 21 | 10 | 4 | 0 |

### 13.3 VERIFACTU / TicketBAI (estado y registros)

**Estado:** 🟡 (motor en `@gluuh/core` y API `/fiscal/*`; falta pantalla de control). Página
sugerida "Fiscal → Envíos":

| Dato | Origen | Estado |
|---|---|---|
| Estado de remisión a AEAT | `verifactu_record.estado_envio` (PENDIENTE/ENVIADO/ACEPTADO/RECHAZADO/OFFLINE) | 🟡 |
| Certificado digital (mTLS) | config backend (`apps/api`, **no** en repo) | 🟡 |
| Últimas facturas | `invoice` + `tax_line` | 🟡 |
| Reintentar envío / ver QR | acciones | 🟡 |

> **Crítico:** hoy el TPV web calcula el ticket+QR pero **no persiste** `invoice` + `tax_line` +
> `verifactu_record` (huella encadenada). Cerrar este circuito es prioritario para cumplimiento.

---

## 14. Seguridad

**Estado:** ✅ (passkeys + cambio implícito por Supabase); 🟡 gestión de sesiones. Debería ser
pestaña "Seguridad" en Configuración. Cada usuario gestiona **su** seguridad.

### 14.1 Acceso y credenciales

| Elemento | Origen | Tipo | Oblig. | Ayuda | Estado |
|---|---|---|---|---|---|
| Cambiar contraseña | Supabase Auth (`updateUser`) | form (actual + nueva) | — | "Mín. 6–8 caracteres" | 🟡 (falta form propio) |
| Passkeys (WebAuthn) | `registrarPasskey` (`lib/passkeys`) | botón "Registrar passkey" | — | "Entra con huella/Face ID/Windows Hello" | ✅ |
| PIN de empleado | `app_user.pin_hash` | (en ficha de empleado, §9.1) | ● | "Para TPV/comandera" | ✅ alta / 🟡 reset |

### 14.2 Sesiones y dispositivos

| Elemento | Origen | Tipo | Estado |
|---|---|---|---|
| Sesiones activas | Supabase Auth | lista + "cerrar sesión en todos" | 🟡 |
| Cerrar sesión (este dispositivo) | `signOut` | botón (ya en cabecera) | ✅ |
| Bloqueo por inactividad (modo dispositivo) | timeout → pantalla PIN | config | 🟡 |

### 14.3 RGPD (relacionado, ver `docs/12`)

| Elemento | Origen | Estado |
|---|---|---|
| Consentimiento marketing de clientes | `customer.consentimiento_marketing` | 🟡 (UI de clientes no existe aún) |
| Exportar / borrar datos de cliente | derecho RGPD | 🟡 |

---

## 15. Plataforma (admin Gluuh)

**Ruta:** `/admin` · **Archivo:** `apps/web/app/admin/page.tsx` · **Estado:** ✅ · **Acceso:**
solo `platform_admin` (`es_admin_plataforma()`).

### 15.1 Alta de empresas

**Vía API** `/api/admin/crear-empresa` (service key; crea tenant + propietario + local).

| Campo | Tipo input | Oblig. | Validación | Ayuda | Estado |
|---|---|---|---|---|---|
| Nombre de la empresa | texto | ● | no vacío | → `tenant.nombre` | ✅ |
| Email de acceso | email | ● | formato email, único | login del propietario | ✅ |
| Contraseña inicial | password | ● | ≥6 | "Se comparte con el cliente" | ✅ |

- **Lista de empresas:** `tenant` (nombre, email_admin, plan, alta) ✅. Falta: editar plan,
  activar/desactivar (`tenant.activo`), entrar como (impersonar) — 🟡.

### 15.2 Solicitudes de contacto — `contact_request`

**Columnas:** `nombre`, `email`, `telefono`, `mensaje`, `atendida`. Llegan desde la web pública
(insert anónimo).

| Acción | Origen | Estado |
|---|---|---|
| Ver solicitudes | lista `contact_request` | ✅ |
| Marcar "atendida" | `contact_request.atendida` | 🟡 (columna ✅; falta toggle) |
| Convertir en empresa | enlazar con alta (§15.1) | 🟡 |

### 15.3 Estados

- **Cargando** ✅ · **Sin permiso** ("Acceso restringido", solo admin Gluuh) ✅ · **Vacío** ("Sin
  solicitudes") ✅ · **Error** 🟡.

---

## 16. Tabla resumen final

> Prioridad sugerida para alcanzar paridad con Ágora + acabado Supabase.
> **Alta** = bloquea operación/venta/cumplimiento o muy visible · **Media** = competitividad ·
> **Baja** = avanzado/fase posterior.

| Apartado | Páginas (lista · crear · editar) | Estado actual | Prioridad |
|---|---|---|:--:|
| **Inicio / Dashboard** | Resumen | ✅ (falta rango/comparativa/error) | Media |
| **Catálogo · Familias** | lista+alta ✅ · editar color/orden 🟡 | ✅ / 🟡 | Media |
| **Catálogo · Categorías** | lista+alta ✅ · editar 🟡 | ✅ / 🟡 | Media |
| **Catálogo · Productos** | alta rápida ✅ · **ficha completa** (foto, alérgenos, descripción, código barras, canal) 🟡 | ✅ / 🟡 | **Alta** |
| **Catálogo · Modificadores** | tablas BD ✅ · UI 🟡 | 🟡 | **Alta** |
| **Catálogo · Menús/Combos** | sin tabla ni UI 🟡 | 🟡 | **Alta** |
| **Catálogo · Tarifas** | sin tabla ni UI 🟡 | 🟡 | Baja |
| **Sala · Salas** | lista+alta ✅ · editar 🟡 | ✅ / 🟡 | Media |
| **Sala · Mesas** | alta ✅ · **capacidad** 🟡 · **editor de plano** 🟡 | ✅ / 🟡 | Media |
| **TPV (operativa)** | venta ✅ · **menú/combo, dividir, mixto, aparcar, modificadores, invitación** 🟡 | ✅ / 🟡 | **Alta** |
| **Cocina / KDS** | cola tiempo real ✅ · por estación/sonido 🟡 | ✅ / 🟡 | Media |
| **Kiosko / Display / Ofertas / Comandera** | funcionan ✅ · mejoras 🟡 | ✅ / 🟡 | Media |
| **Personal · Empleados** | alta+activar ✅ · **editar/reset PIN/borrar** 🟡 | ✅ / 🟡 | **Alta** |
| **Personal · Roles y permisos** | enum rol ✅ · **permisos finos** 🟡 | 🟡 | **Alta** |
| **Personal · Fichajes** | tabla `shift` ✅ · UI 🟡 | 🟡 | Baja |
| **Personal · Flujo de dispositivo (PIN)** | comandera ✅ · **TPV PIN + registro `device`** 🟡 | ✅ / 🟡 | **Alta** |
| **Caja** | apertura/movimiento/arqueo/**cierre Z**/historial — sin UI 🟡 | 🟡 | **Alta** |
| **Caja · Formas de pago** | hardcoded ✅ · config 🟡 | 🟡 | Media |
| **Dispositivos · Impresoras** | sin tabla/UI 🟡 (enrutado por `estacion`) | 🟡 | **Alta** |
| **Dispositivos · Cajón** | switch en impresora 🟡 | 🟡 | Media |
| **Dispositivos · Datáfono** | sin UI 🟡 | 🟡 | Media |
| **Dispositivos · Balanza** | sin UI 🟡 | 🟡 | Baja |
| **Dispositivos · Terminales (`device`)** | tabla ✅ · UI 🟡 | 🟡 | Media |
| **Marca / Personalización** | marca + ofertas ✅ · programación horaria/D&D 🟡 | ✅ / 🟡 | Baja |
| **Fiscal · Datos del local** | ✅ · falta `regimen_facturacion` en form 🟡 | ✅ / 🟡 | **Alta** |
| **Fiscal · Tipos `tax_rate`** | datos ✅ · vista informativa 🟡 | ✅ / 🟡 | Baja |
| **Fiscal · VERIFACTU/TicketBAI (envíos + persistir `invoice`/`verifactu_record`)** | motor ✅ · **circuito incompleto** 🟡 | 🟡 | **Alta** |
| **Seguridad · Passkeys** | ✅ | ✅ | Baja |
| **Seguridad · Contraseña/Sesiones** | cambio 🟡 · sesiones 🟡 | 🟡 | Media |
| **Configuración (pestañas internas)** | hoy páginas sueltas 🟡 | 🟡 | Media |
| **Plataforma · Empresas** | alta+lista ✅ · plan/activar/impersonar 🟡 | ✅ / 🟡 | Media |
| **Plataforma · Solicitudes** | lista ✅ · marcar atendida/convertir 🟡 | ✅ / 🟡 | Baja |

---

### Notas de implementación (resumen para construir)

- **Reutilizar primitivos existentes:** `PageHeader`, `EmptyState`, `StatCard`, `Card`, `Table`,
  `Dialog`, `Select`, `Input`, `Label`, `Switch`/checkbox, `Button`, `Badge`, `password-input`,
  `theme-toggle`. Crear los que faltan: `ErrorState`, `Skeleton`, `Drawer/SideSheet`,
  `ConfirmDialog`, `ColorField`, `ImageUpload`, `MultiSelect`, `PermissionMatrix`, `PinPad`.
- **Migrar `alert()`/`prompt()`** (sala, comandera) a `Dialog`/`ConfirmDialog`.
- **Columnas que faltan en BD** (nuevas migraciones): `product.descripcion`,
  `product.codigo_barras`, `product.canales`, `restaurant_table.capacidad`,
  `app_user.permisos`, `offer.hora_inicio/hora_fin`; **tablas nuevas:** `menu`/`menu_section`/
  `menu_option`, `price_list`/`price_rule`/`product_price`, `printer`, `payment_method`,
  (opcional) `product_modifier_group`, `role_permission`. Mantener espejo en
  `apps/api/db/schema.sql` (ver `supabase/README.md`).
- **Autorización real en backend** (RLS/RPC), no solo el filtrado de nav por rol del cliente.
- **Cerrar el circuito fiscal** (persistir `invoice`/`tax_line`/`verifactu_record` desde el cobro)
  es el punto más crítico para cumplimiento VERIFACTU.
