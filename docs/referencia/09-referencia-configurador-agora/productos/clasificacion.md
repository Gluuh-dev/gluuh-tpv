# Productos › Clasificación: Grupos Mayores · Familias · Categorías

> La **taxonomía del catálogo**. Ágora clasifica los productos por **dos ejes paralelos**, no una sola jerarquía: **Familia** (eje "operativo/fiscal/cocina", agrupado bajo **Grupo Mayor**) y **Categoría** (eje "pantalla/menús"). Un producto pertenece a **una familia** y a **una o varias categorías**. Es la base del catálogo de [03 — Catálogo y modificadores](../../03-catalogo-productos-y-modificadores/).

> 🛈 **Pestañas colapsadas:** donde Ágora muestra una sección plegada sin detalle (p. ej. *Centros de Venta*, *Grupos de Puntos de Venta*), aquí proponemos las opciones que **creemos necesarias** — van marcadas como **`[propuesta]`**.

Capturas: `Grupos Mayores`, `Familias`, `Categorías` (listados + editores).

---

## 1. Los dos ejes (concepto clave)

```
EJE A — operativo/fiscal/cocina          EJE B — pantalla/menús
  Grupo Mayor   (Bebida, Comida)           Categoría        (CAFE, HAMBURGUESAS…)
      └─ Familia (CAFE, CERVEZA, RON…)         └─ Categoría Padre (VARIADO…)
            └─ Familia Padre (TOSTADAS→1/2 TOSTADA)
                  └─ PRODUCTO ──pertenece a 1 familia y a N categorías──┘
```

- **Familia**: clasificación principal del producto (informes, orden en factura, suele alinear con estación de cocina). Se agrupa en **Grupo Mayor** para informes de alto nivel.
- **Categoría**: organización para la **pantalla de venta** y la **configuración de menús**. Un producto puede estar en varias.
- Flags independientes **Mostrar en TPV** y **Mostrar en Menús** en familia y categoría.

> Para nuestro doc 03 esto matiza: no es "Familias → Categorías → Productos" en cascada, sino **familia (1) + categorías (N)** sobre el producto. Conviene mantener los dos ejes.

---

## 2. Grupos Mayores

**Listado** (Id · Nombre): `Bebida`, `Comida`. CRUD.

**Editar Grupo Mayor:** Nombre + **Familias del Grupo** (buscar y añadir familias). Es decir, el Grupo Mayor agrupa familias.

**Para qué:** el **"desglose por Grupo Mayor"** del ticket ([plantillas-ticket.md §D #10](../administracion/plantillas-ticket.md)) y los informes "ventas por grupo". Ej.: total Bebida vs Comida en el Z.

**Mapeo:** `mayor_group (id, tenant_id, nombre)`; `family.mayor_group_id`. 🔴 falta.

---

## 3. Familias

**Listado** — Id · Nombre · **Grupo Mayor** · **Familia Padre** · **Orden Imp. Fact.** · **Mostrar en TPV** · **Mostrar en Menús**. (Ej.: CAFE, CERVEZA, RON… `No`/`Sí`; **AÑADIDOS** y **AÑADIDOS CARAJILLO** `No`/`No`; `1/2 TOSTADA` con Familia Padre `TOSTADAS`.)

> Nota: existen familias **AÑADIDOS** / **AÑADIDOS CARAJILLO** → así modela Ágora los **modificadores/extras** como familias ocultas (No en TPV, No en menús). En nuestro modelo los tratamos como **grupos de modificadores** propios (ver [03](../../03-catalogo-productos-y-modificadores/)), más limpio.

**Editar Familia:**
| Bloque | Campos |
|--------|--------|
| Familia | Nombre · **Familia Padre** (jerarquía) · **Grupo Mayor** · **Orden de impresión en factura** (`0`) |
| Estilo | Texto · **Color** (`#bacde2`) · Imagen · ☑ Mostrar en pantalla de venta · ☑ Mostrar en configuración de menús |
| Productos de la familia | buscar (F3) y añadir productos (tabla Producto · Familia · Categorías) |
| **Grupos de Puntos de Venta** *(colapsada)* | **`[propuesta]`** en qué **grupos de terminales** aparece la familia (p. ej. solo `TPVS COFFEE`) → visibilidad por zona/terminal |

---

## 4. Categorías

**Listado** — Id · Nombre · **Categoría Padre** · Etiquetas · **Mostrar en TPV** · **Mostrar en Menús** (47 registros). Filtro por **Etiquetas**. Ej.: `CAFE` Sí/No, `GINEBRA` (padre `VARIADO`) No/No, `BOCADILLOS` Sí/Sí, `PRIMEROS MENU` No/Sí.

**Editar Categoría:**
| Bloque | Campos |
|--------|--------|
| Categoría | Nombre · **Etiquetas** · **Categoría Padre** |
| Estilo | Texto · Color (`#bacde2`) · Imagen · ☑ Mostrar en pantalla de venta · ☑ Mostrar en configuración de menús |
| Productos de la Categoría | buscar (F3) y añadir |
| **Centros de Venta** *(colapsada)* | **`[propuesta]`** en qué **locales/centros** está disponible la categoría (visibilidad multi‑local) |
| **Grupos de Puntos de Venta** *(colapsada)* | **`[propuesta]`** en qué **grupos de terminales** se muestra (p. ej. carta de cafetería vs restaurante) |

> **Etiquetas**: sistema de tags libres para filtrar/segmentar (informes, reposición, menús…) — coincide con "Etiquetas de Categorías" de [administracion-web.md](../administracion/administracion-web.md).

---

## Mapeo a nuestro modelo

```sql
create table mayor_group (id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, nombre text not null);

create table family (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  parent_id uuid references family(id),         -- Familia Padre
  mayor_group_id uuid references mayor_group(id),
  orden_factura int default 0,                  -- Orden de impresión en factura
  -- estilo
  color text, imagen_url text, texto text,
  mostrar_tpv boolean default true,
  mostrar_menus boolean default true
);

create table category (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  parent_id uuid references category(id),       -- Categoría Padre
  etiquetas text[],
  color text, imagen_url text, texto text,
  mostrar_tpv boolean default true,
  mostrar_menus boolean default true
);

-- producto: 1 familia + N categorías
-- product.family_id  +  product_category(product_id, category_id)

-- [propuesta] visibilidad por ámbito (pestañas colapsadas)
create table category_visibility (
  category_id uuid references category(id),
  location_id uuid,            -- Centros de Venta
  device_group_id uuid         -- Grupos de Puntos de Venta
);
```

- Coherente con multi‑tenant RLS y con el catálogo de [03]. El **color/imagen** alimenta los botones de la pantalla táctil ([02 — Interfaz](../../02-interfaz-tactil/)). 🔴 falta como configurador (la operativa ya pinta familias/productos).

## Mejoras sobre Ágora

- **No modelar los añadidos como "familias ocultas"** (AÑADIDOS/AÑADIDOS CARAJILLO): usar **grupos de modificadores** de primera clase ([03]) — más claro y reutilizable.
- **Color/imagen heredables**: si el producto no tiene color, hereda el de su familia/categoría (menos trabajo de alta).
- Visibilidad por **local y por grupo de terminal** de serie (las pestañas colapsadas que proponemos), clave para cartas distintas por zona (cafetería vs restaurante) sin duplicar productos.
- **Etiquetas** como filtro transversal real en informes y en la carta online.
