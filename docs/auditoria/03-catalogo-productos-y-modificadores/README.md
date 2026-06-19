# 03 · Catálogo de productos y modificadores

> El catálogo es el corazón del TPV. Todo lo demás (comanda, KDS, fiscalidad, stock,
> informes) cuelga de cómo modelemos productos, variantes, modificadores, ingredientes,
> alérgenos y menús. Este documento ausculta lo que ya existe en `supabase/migrations/*`
> y propone el modelo objetivo —**completamente configurable desde backoffice**— sin
> romper la lógica fiscal de `@gluuh/core` (precio de carta con **impuesto incluido**).

---

## 1. Resumen ejecutivo

El usuario insiste en un caso concreto que el modelo debe resolver con elegancia:

> *"Pulso **Pizza Margarita**. Quiero **añadir** ingredientes que **suman** un extra
> (+queso 1,50 €, +jamón 2,00 €), **quitar** ingredientes (sin cebolla), y dejar una
> **nota libre** para cocina (poco hecha; alérgico, cuidado). En un entrecot quiero que
> me **obligue** a elegir el punto de la carne."*

De ahí salen cinco mecanismos que este documento modela en profundidad:

| Mecanismo | Qué resuelve | Afecta precio | Afecta cocina |
|---|---|---|---|
| **Variante** | tamaño/formato (tapa/ración, mediana/familiar) | sí (precio propio) | a veces |
| **Grupo de modificadores** | la pregunta ("Elige punto", "Extras") | — | — |
| **Modificador** | la respuesta (+queso, sin cebolla, al punto) | sí, si tiene `precio_extra` | sí |
| **Ingrediente / receta** | escandallo: coste y stock | no (coste interno) | informativo |
| **Nota de cocina** | texto libre por línea/comensal | no | sí |

Decisión rectora: **lo que el cliente paga** y **lo que cocina prepara** son dos vistas
del mismo árbol de selección; lo serializamos una sola vez en `order_line.modificadores`
(jsonb) con precio desglosado, y de ahí derivan ticket, factura VERIFACTU, KDS y stock.

### Estado actual del esquema (lo que ya está en migraciones)

| Tabla existente | Migración | Limitación a resolver |
|---|---|---|
| `family`, `category`, `product` | 0001, 0012, 0016 | sin variantes; `tipo_impositivo` numérico **y** `clase_fiscal` conviven (redundancia) |
| `modifier_group`, `modifier` | 0001 | **ligados a un solo `product_id`** → no reutilizables; sin obligatoriedad real, sin "incluido por defecto" |
| `allergen`, `product_allergen` **y** `product.alergenos text[]` | 0001, 0016 | **dos fuentes de verdad** para alérgenos |
| `ingredient`, `recipe_item`, `stock_move` | 0001 | OK, pero los alérgenos no se derivan de ingredientes |
| `menu`, `menu_group`, `menu_choice` | 0013 | 1 elección por grupo; sin suplementos por elección |
| `order_line.modificadores jsonb` | 0001 | el contenedor correcto; falta **contrato de serialización** documentado |

> Las propuestas de DDL de §10 son **aditivas** (ALTER/CREATE IF NOT EXISTS) y respetan
> RLS por `tenant_id` vía `current_tenant_id()`, igual que el resto del esquema.

---

## 2. Jerarquía del catálogo

```
Familia (family)            ── "Pizzas", "Carnes", "Bebidas"        color, orden
  └─ Categoría (category)   ── "Pizzas clásicas", "Pizzas premium"   orden, estación
       └─ Producto (product)── "Pizza Margarita"                     PVP, clase fiscal, foto
            ├─ Variante (product_variant) ── "Mediana 9,50 € · Familiar 13,90 €"
            ├─ Grupos de modificadores ──── "Tamaño masa", "Extras", "Sin…"
            ├─ Receta (recipe_item) ──────── tomate 80 g, mozzarella 120 g…
            └─ Alérgenos ──────────────────── gluten, lácteos
```

**Decisiones:**

- **Familia → Categoría → Producto** se mantiene (es el modelo Ágora que ya seguimos y
  el que esperan los hosteleros españoles). `family.color` pinta los botones del TPV.
- La **estación de cocina** (`product.estacion`: COCINA/BARRA/PLANCHA…) se hereda de la
  categoría por defecto y se puede sobreescribir por producto; gobierna el enrutado al
  KDS/impresora (ver §8 y doc 10).

### 2.1 Variantes (tamaños y formatos)

Un producto puede venderse en varios **formatos con precio propio**. No es un modificador:
es una unidad de venta distinta (distinto PVP, posible distinto código de barras y, en
casos límite, distinta clase fiscal —p. ej. botella vs. copa de vino).

| Producto | Variantes | Por qué variante y no modificador |
|---|---|---|
| Cerveza | Caña 1,80 · Tercio 2,50 · Jarra 3,90 | cada formato tiene **precio absoluto**, no un “+X” |
| Pizza | Mediana 9,50 · Familiar 13,90 | el precio no es base+extra; es un PVP por tamaño |
| Ración | Tapa 3,50 · Media 7,00 · Ración 12,00 | idem |

Regla práctica: **si el precio es absoluto por opción → variante**; **si es base + suma →
modificador con `precio_extra`**. Si el producto no tiene variantes, se vende a
`product.precio` (variante implícita "Única").

---

## 3. Modificadores y añadidos — el corazón

### 3.1 Modelo: Grupo → Modificador

Un **grupo de modificadores** es *la pregunta*; un **modificador** es *cada respuesta
posible*. El grupo define la **cardinalidad** (`min_sel`/`max_sel`) y si es obligatorio.

| Grupo | obligatorio | min | max | Modificadores |
|---|---|---|---|---|
| Punto de la carne | sí | 1 | 1 | Poco hecho · Al punto · Muy hecho |
| Tamaño de masa | sí | 1 | 1 | Fina (0) · Gruesa (0) · Sin gluten (+1,50) |
| Extras | no | 0 | 5 | Extra queso (+1,50) · Jamón (+2,00) · Champiñón (+1,00) |
| Quitar ingredientes | no | 0 | 4 | Sin cebolla · Sin orégano · Sin ajo (todos 0 €) |

- **Obligatorio** = `min_sel ≥ 1`. El TPV no deja enviar la línea a cocina hasta cubrirlo.
- **`max_sel = 1`** → selector tipo *radio*; **`max_sel > 1`** → *checkbox* múltiple.
- Modificador **con precio** (`precio_extra > 0`) o **gratis** (`= 0`, p. ej. "sin cebolla").

### 3.2 Modificadores reutilizables (la mejora clave)

Hoy `modifier_group` cuelga de **un único** `product_id` → para poner "Extras" en 30
pizzas hay que duplicarlo 30 veces. **Decisión: desacoplar el grupo del producto** y unir
por una tabla puente `product_modifier_group`, con asignación también **a familia/categoría
entera** (herencia). Así "Punto de la carne" se define una vez y se asigna a toda la
familia "Carnes".

```
modifier_group (reutilizable, sin product_id)
   └─ modifier (cada opción, con precio_extra)

product_modifier_group   ── enlaza grupo ↔ producto         (asignación directa)
category_modifier_group  ── enlaza grupo ↔ categoría/familia (herencia)
```

Resolución efectiva de grupos de un producto = `grupos asignados a su familia`
`∪ grupos de su categoría` `∪ grupos asignados directamente`, ordenados por `orden`.
La asignación directa puede **sobreescribir** (override) min/max heredados.

### 3.3 Ingredientes incluidos por defecto (el "sin…")

El "sin cebolla" no debería teclearse a mano. Modelamos los **ingredientes de venta que
vienen incluidos y son quitables** como modificadores con `incluido_por_defecto = true` y
`precio_extra = 0`. En pantalla aparecen **preseleccionados**; deseleccionarlos genera el
texto "Sin cebolla" que viaja a cocina (negativo, no suma).

> Esto es la cara **comercial/cocina** del ingrediente. La cara **coste/stock** vive en
> `recipe_item` (§4). Un mismo ingrediente físico puede tener ambas; se enlazan opcionalmente
> con `modifier.ingredient_id` para descontar stock cuando se añade un extra.

### 3.4 Modificadores anidados (opcional, fase 2)

Caso real: "Extra de salsa → ¿cuál? (barbacoa / brava / alioli)". Se modela con
`modifier.child_group_id` apuntando a otro grupo que solo se muestra si el padre está
seleccionado. Se deja como **extensión**; el 95 % de la hostelería no lo necesita y añade
complejidad de UI. Marcado en DDL pero desactivado por defecto.

### 3.5 Efecto en PRECIO e IMPUESTO

Reglas (coherentes con `@gluuh/core` y precio con **impuesto incluido**):

1. **Precio de línea** = `precio_variante (o product.precio) + Σ precio_extra de modificadores`,
   todo **con impuesto incluido**, multiplicado por `cantidad`.
2. **El extra hereda la clase fiscal del producto.** Un +queso en una pizza (REDUCIDO 10 %)
   tributa al 10 %; el modificador **no** lleva su propia clase fiscal salvo excepción
   explícita (`modifier.clase_fiscal` override, p. ej. recargo de servicio).
3. El **desglose de base e impuesto** se hace una sola vez sobre el total de la línea con
   `calcularImpuestosIncluidos(total_linea, %)`; **nunca** se desglosa extra a extra (evita
   descuadres por redondeo). El `%` se resuelve con `resolver_iva(clase_fiscal, territorio)`.

```
Pizza Margarita (REDUCIDO, 10 %)        9,50 €  (imp. incl.)
  + Extra queso                         +1,50
  + Jamón                               +2,00
  − Sin cebolla                          0,00
  ───────────────────────────────────────────
  PVP línea (imp. incl.)               13,00 €
  → base 11,82 € + IVA 10 % 1,18 €  (un solo calcularImpuestosIncluidos)
```

---

## 4. Ingredientes vs. modificadores (receta/escandallo)

Son dos conceptos que **no** hay que confundir:

| | **Modificador (venta)** | **Ingrediente / receta (coste)** |
|---|---|---|
| Para qué | qué elige el cliente, qué prepara cocina | cuánto cuesta y qué stock consume |
| Tabla | `modifier` / `modifier_group` | `ingredient` / `recipe_item` |
| Precio | `precio_extra` (PVP al cliente) | `coste_unitario` (interno) |
| Visible al cliente | sí | no |
| Mueve stock | solo si `modifier.ingredient_id` enlaza uno | sí, vía `stock_move` al vender |

- **Escandallo** (`recipe_item`): "Pizza Margarita = tomate 80 g + mozzarella 120 g + masa
  1 ud". Sirve para coste teórico, margen y descuento de stock al cobrar.
- **Relación con alérgenos:** cada `ingredient` declara sus alérgenos; los alérgenos del
  **producto** se pueden **derivar** automáticamente como la unión de los de su receta (§5).
- Un **extra** (`+queso`) que enlace `ingredient_id` descuenta stock al añadirse; un "sin
  cebolla" puede (opcional) **devolver** stock teórico, aunque por simplicidad lo dejamos sin
  efecto en stock (la cebolla ya estaba en el escandallo y la merma es despreciable).

---

## 5. Alérgenos (14 UE obligatorios)

Reglamento (UE) 1169/2011. La lista canónica ya vive en `apps/web/lib/alergenos.ts`:

`gluten · crustáceos · huevos · pescado · cacahuetes · soja · lácteos · frutos de cáscara ·
apio · mostaza · sésamo · sulfitos · altramuces · moluscos`

### 5.1 Dos fuentes de verdad — a unificar

Existen **dos** representaciones (deuda técnica a resolver):

1. `product.alergenos text[]` (0016) — array de códigos, simple, usado por la web.
2. `allergen` + `product_allergen` (0001) — tabla join normalizada, no poblada.

**Decisión: `product.alergenos text[]` es la fuente canónica de la *asignación manual*.**
Es lo que la web ya lee/escribe y casa con el seed. La tabla `allergen` se conserva solo
como **catálogo de referencia** (código → nombre, traducciones, icono); `product_allergen`
se **deprecia** (documentar en `supabase/README.md`). Validar el array contra el catálogo
con un CHECK o trigger.

### 5.2 Alérgenos derivados de ingredientes

Añadimos `ingredient.alergenos text[]`. El alérgeno **efectivo** de un producto =
`product.alergenos (declarado)` `∪` `Σ alergenos de su receta` `∪` `Σ alergenos de
modificadores seleccionados`. Mostramos la **unión**, marcando si es declarado o derivado.

### 5.3 Visualización

- **Carta** (web/QR): iconos por alérgeno bajo cada producto.
- **TPV**: badge en el botón si el producto tiene alérgenos; aviso al añadir si hay nota
  "alérgico" en la línea.
- **Ticket/factura**: no es obligatorio listarlos en el ticket, pero sí en la carta. Se
  imprime al pie un aviso legal y la URL/QR a la carta con alérgenos.
- **KDS**: si la línea trae nota "alérgico", se resalta en rojo (ver §8).

---

## 6. Menús, combos y menú del día

Un **menú** es un producto **compuesto** con **pasos de elección**, precio (normalmente)
fijo. Ya existe `menu`/`menu_group`/`menu_choice` (0013). Evolución mínima:

```
Menú del día — 13,50 € (imp. incl.)
  Paso 1 · Primer plato   (elige 1)  Ensalada · Sopa · Croquetas (+1,00 suplemento)
  Paso 2 · Segundo        (elige 1)  Pollo · Merluza (+2,00) · Entrecot (+3,50)
  Paso 3 · Postre/Café    (elige 1)  Flan · Fruta · Café
  Paso 4 · Bebida         (elige 1)  Agua · Refresco · Copa de vino
```

**Decisiones de modelado:**

- Renombramos conceptualmente `menu_group → menu_step` (paso) y `menu_choice` gana
  `suplemento numeric(12,2) DEFAULT 0` (imp. incl.) para platos premium dentro del menú.
- `min_sel`/`max_sel` por paso (hoy implícito 1) para permitir "elige 2 tapas".
- **Fiscalidad del menú:** el precio fijo del menú lleva su `clase_fiscal` (normalmente
  REDUCIDO). Si una bebida alcohólica dentro del menú debiera ir a GENERAL, hay dos
  estrategias: (a) **simple** — todo el menú a su clase única (lo más común y lo que la
  AEAT acepta en menú cerrado); (b) **prorrateo** — repartir base por clase. **Elegimos (a)**
  por defecto, con (b) como flag de configuración para quien lo necesite.
- En la comanda el menú se materializa como **una línea cabecera** (el menú, con su PVP) y
  **sub-líneas informativas** de cada elección (precio 0, salvo suplementos). KDS las ve
  como platos individuales con su estación.

---

## 7. Notas de cocina

- **Nota de línea**: texto libre en `order_line.notas` ("poco hecha", "sin sal").
- **Nota por comensal/asiento**: `order_line.comensal int` (qué silla) permite agrupar y
  notas dirigidas; "alérgico, cuidado" se marca con flag `order_line.aviso_alergia boolean`
  para resaltarla.
- **Atajos configurables**: notas frecuentes predefinidas por tenant (`quick_note`) para no
  teclear ("Para llevar", "Sin hielo", "Bien hecho") — un tap en vez de teclado.
- Las notas viajan **íntegras** al KDS y a la impresora de cocina, nunca a la factura
  (no son conceptos facturables). Ver §8.

---

## 8. Recorrido a cocina (KDS / impresora)

```
order_line ──┐
             ├─ producto + variante + modificadores (sin cebolla, extra queso)
             ├─ notas + aviso_alergia + comensal/pase
             └─ estacion  ──► enrutado: COCINA | PLANCHA | BARRA | POSTRES
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                  ▼
            KDS (pantalla cocina)         Impresora térmica de partida
   "1× Pizza Margarita                    cada estación imprime solo SUS líneas
    + extra queso, + jamón
    SIN CEBOLLA            ⚠ ALÉRGICO"
```

Los **modificadores negativos** ("sin…") y la **alergia** se imprimen **destacados**
(mayúsculas/negrita/rojo) porque son los que más errores causan en cocina.

---

## 9. Contrato de la línea de comanda (`order_line.modificadores`)

El jsonb es el **contrato serializado** de lo que el cliente eligió. Formato propuesto
(estable, versionado con `v`):

```jsonc
{
  "v": 1,
  "variante": { "id": "…", "nombre": "Familiar", "precio": 13.90 },
  "grupos": [
    {
      "grupo_id": "…", "nombre": "Extras",
      "seleccion": [
        { "modifier_id": "…", "nombre": "Extra queso", "precio_extra": 1.50, "signo": "+" },
        { "modifier_id": "…", "nombre": "Jamón",       "precio_extra": 2.00, "signo": "+" }
      ]
    },
    {
      "grupo_id": "…", "nombre": "Quitar",
      "seleccion": [
        { "modifier_id": "…", "nombre": "Sin cebolla", "precio_extra": 0, "signo": "-" }
      ]
    }
  ],
  "extra_total": 3.50
}
```

La línea resultante (filas relevantes de `order_line`):

```jsonc
{
  "nombre": "Pizza Margarita (Familiar)",
  "cantidad": 1,
  "precio_unitario": 17.40,          // 13.90 variante + 3.50 extras (imp. incl.)
  "tipo_impositivo": 10,             // resuelto por clase_fiscal × territorio
  "modificadores": { /* jsonb de arriba */ },
  "notas": "Poco hecha",
  "aviso_alergia": true,
  "estacion": "COCINA",
  "pase": 1
}
```

**Por qué jsonb y no tablas hijas:** la línea es un **hecho histórico inmutable** (precio y
nombre congelados al vender, igual que `order_line.nombre` ya hace). Si el modificador
cambia de precio mañana, la comanda de ayer no debe mutar. El jsonb captura el snapshot;
las FKs (`modifier_id`) son solo trazabilidad/informes, nunca fuente del precio.

---

## 10. Esquema de datos propuesto (DDL)

> Aditivo sobre lo existente. Todas las tablas con `tenant_id` + RLS `current_tenant_id()`
> e índice por `(tenant_id, …)`. Se omite el boilerplate de policy/grant repetido por
> brevedad; sigue el patrón de 0012/0013.

```sql
-- ── 10.1 Variantes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_variant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  nombre        text NOT NULL,                 -- "Mediana", "Familiar", "Tapa"
  precio        numeric(12,2) NOT NULL,        -- PVP, impuesto incluido
  clase_fiscal  text,                          -- NULL = hereda de product
  codigo_barras text,
  orden         int NOT NULL DEFAULT 0,
  activo        boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_variant_tenant_product
  ON public.product_variant (tenant_id, product_id, orden);

-- ── 10.2 Grupos de modificadores REUTILIZABLES ───────────────────────────────
--  Se elimina la dependencia product_id de modifier_group (0001) y se enlaza por puente.
ALTER TABLE public.modifier_group
  ADD COLUMN IF NOT EXISTS reutilizable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS obligatorio  boolean GENERATED ALWAYS AS (min_sel >= 1) STORED,
  ADD COLUMN IF NOT EXISTS tipo         text NOT NULL DEFAULT 'AÑADIR'   -- AÑADIR | QUITAR | ELEGIR
                            CHECK (tipo IN ('AÑADIR','QUITAR','ELEGIR')),
  ADD COLUMN IF NOT EXISTS orden        int NOT NULL DEFAULT 0;
ALTER TABLE public.modifier_group ALTER COLUMN product_id DROP NOT NULL;  -- ahora opcional

ALTER TABLE public.modifier
  ADD COLUMN IF NOT EXISTS incluido_por_defecto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ingredient_id uuid REFERENCES public.ingredient(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clase_fiscal  text,        -- NULL = hereda del producto
  ADD COLUMN IF NOT EXISTS child_group_id uuid REFERENCES public.modifier_group(id) ON DELETE SET NULL, -- anidado (fase 2)
  ADD COLUMN IF NOT EXISTS orden int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Puente producto ↔ grupo (asignación directa, con override de cardinalidad)
CREATE TABLE IF NOT EXISTS public.product_modifier_group (
  tenant_id    uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.modifier_group(id) ON DELETE CASCADE,
  orden        int NOT NULL DEFAULT 0,
  min_sel_ovr  int,                            -- override opcional
  max_sel_ovr  int,
  PRIMARY KEY (product_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_pmg_tenant_product
  ON public.product_modifier_group (tenant_id, product_id, orden);

-- Puente categoría/familia ↔ grupo (herencia)
CREATE TABLE IF NOT EXISTS public.category_modifier_group (
  tenant_id    uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES public.category(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.modifier_group(id) ON DELETE CASCADE,
  orden        int NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, group_id)
);

-- ── 10.3 Alérgenos en ingredientes (derivación) ──────────────────────────────
ALTER TABLE public.ingredient
  ADD COLUMN IF NOT EXISTS alergenos text[] NOT NULL DEFAULT '{}';

-- product.alergenos text[] (0016) sigue siendo la fuente canónica de la declaración manual.
-- allergen (0001) queda como catálogo de referencia código→nombre→icono.
ALTER TABLE public.allergen
  ADD COLUMN IF NOT EXISTS icono text,
  ADD COLUMN IF NOT EXISTS orden int NOT NULL DEFAULT 0;

-- ── 10.4 Menús: pasos con suplemento ─────────────────────────────────────────
ALTER TABLE public.menu_group  -- = "paso"
  ADD COLUMN IF NOT EXISTS min_sel int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_sel int NOT NULL DEFAULT 1;
ALTER TABLE public.menu_choice
  ADD COLUMN IF NOT EXISTS suplemento numeric(12,2) NOT NULL DEFAULT 0;  -- imp. incl.

-- ── 10.5 Notas rápidas configurables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quick_note (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  texto      text NOT NULL,            -- "Para llevar", "Sin hielo"
  orden      int NOT NULL DEFAULT 0
);

-- ── 10.6 order_line: notas por comensal y aviso de alergia ────────────────────
ALTER TABLE public.order_line
  ADD COLUMN IF NOT EXISTS comensal      int,
  ADD COLUMN IF NOT EXISTS aviso_alergia boolean NOT NULL DEFAULT false;
```

### 10.7 Notas sobre RLS, índices y `tenant_id`

- **Toda** tabla nueva replica el patrón de 0012: `ENABLE ROW LEVEL SECURITY` + policy
  `FOR ALL USING/WITH CHECK (tenant_id = current_tenant_id())` + `GRANT ALL TO authenticated`.
- Las tablas puente (`product_modifier_group`, `category_modifier_group`) llevan `tenant_id`
  redundante **a propósito**: simplifica la policy (sin JOIN para evaluar RLS) y los índices.
- `resolver_iva(clase, territorio)` y la tabla `tax_rate` (0012) **no se tocan**: el catálogo
  guarda `clase_fiscal`, y el `%` se resuelve al vender. Mantener `product.tipo_impositivo`
  como **caché derivada** o deprecarlo en favor de `clase_fiscal` (decidir y documentar; hay
  redundancia 0001 vs 0012).

---

## 11. Ejemplo completo: Pizza Margarita configurada

```jsonc
{
  "product": {
    "nombre": "Pizza Margarita",
    "category": "Pizzas clásicas",
    "clase_fiscal": "REDUCIDO",          // → 10 % península, 3 % Canarias (IGIC)
    "alergenos": ["gluten", "lacteos"],
    "variantes": [
      { "nombre": "Mediana",  "precio": 9.50 },
      { "nombre": "Familiar", "precio": 13.90 }
    ]
  },
  "grupos": [
    {
      "nombre": "Tamaño de masa", "tipo": "ELEGIR", "min_sel": 1, "max_sel": 1,
      "modificadores": [
        { "nombre": "Fina",       "precio_extra": 0 },
        { "nombre": "Gruesa",     "precio_extra": 0 },
        { "nombre": "Sin gluten", "precio_extra": 1.50 }
      ]
    },
    {
      "nombre": "Extras", "tipo": "AÑADIR", "min_sel": 0, "max_sel": 5,
      "modificadores": [
        { "nombre": "Extra queso", "precio_extra": 1.50, "ingredient_id": "moz-…" },
        { "nombre": "Jamón",       "precio_extra": 2.00 },
        { "nombre": "Champiñón",   "precio_extra": 1.00 }
      ]
    },
    {
      "nombre": "Quitar", "tipo": "QUITAR", "min_sel": 0, "max_sel": 4,
      "modificadores": [
        { "nombre": "Cebolla", "precio_extra": 0, "incluido_por_defecto": true },
        { "nombre": "Orégano", "precio_extra": 0, "incluido_por_defecto": true }
      ]
    }
  ]
}
```

(La línea de comanda resultante de seleccionar Familiar + extra queso + jamón − cebolla
ya se mostró en §9.)

---

## 12. Flujo de selección en pantalla (TPV)

```
┌──────────────────────────────────────────────────────────┐
│  Pizza Margarita                                          │
│                                                          │
│  TAMAÑO        ( Mediana )  [ Familiar ]   ← variante     │
│                                                          │
│  Tamaño de masa  *obligatorio              ← min 1        │
│    ( Fina )  ( Gruesa )  ( Sin gluten +1,50 )            │
│                                                          │
│  Extras         opcional                                 │
│    [✓ Extra queso +1,50] [✓ Jamón +2,00] [ Champiñón ]  │
│                                                          │
│  Quitar                                                  │
│    [ Cebolla ✗ ]  [✓ Orégano ]            ← preselec.    │
│                                                          │
│  Nota: _poco hecha___________  [⚠ Alérgico]              │
│                                                          │
│  Total línea: 17,40 €            [ Añadir a la comanda ] │
└──────────────────────────────────────────────────────────┘
```

Validación: el botón "Añadir" se **deshabilita** mientras algún grupo obligatorio
(`min_sel ≥ 1`) no esté cubierto. El total se recalcula en vivo: `variante + Σ extras`.

---

## 13. Configuración desde backoffice (pantallas y campos)

Rutas existentes a extender: `app/(panel)/familias-y-productos`, `app/(panel)/carta`,
`app/(panel)/menus`, `producto-dialog.tsx`.

| Pantalla | Campos / acciones |
|---|---|
| **Familias y categorías** | nombre, color, orden, estación por defecto |
| **Producto** (`producto-dialog`) | nombre, descripción, foto, categoría, **variantes** (tabla nombre+precio), **clase fiscal**, alérgenos (14 checkboxes), código de barras, disponible, estación |
| **Receta / escandallo** | añadir ingredientes + cantidad; muestra coste teórico y margen; derivación de alérgenos |
| **Grupos de modificadores** | CRUD de grupos reutilizables: nombre, tipo (AÑADIR/QUITAR/ELEGIR), min/max, lista de modificadores con `precio_extra` e `incluido_por_defecto` |
| **Asignación de modificadores** | asignar grupos a producto y/o a categoría/familia; reordenar; override min/max |
| **Menús** | pasos (nombre, min/max), platos por paso con suplemento, precio y clase fiscal del menú, estrategia fiscal (única/prorrateo) |
| **Ingredientes** | nombre, unidad, stock, stock mínimo, coste, alérgenos |
| **Notas rápidas** | lista de atajos por tenant |

---

## 14. Decisiones clave (resumen) y deuda a saldar

| Decisión | Justificación |
|---|---|
| Grupos de modificadores **reutilizables** + puente producto/categoría | evita duplicar "Extras" en N productos; herencia por familia |
| Modificadores **incluidos por defecto** para el "sin…" | un tap, no teclado; genera negativo limpio a cocina |
| El extra **hereda la clase fiscal** del producto | un solo `calcularImpuestosIncluidos` por línea; sin descuadres |
| `order_line.modificadores` **jsonb con snapshot de precios** | la comanda es hecho histórico inmutable |
| Variante ≠ modificador (precio absoluto vs. suma) | claridad de modelo y de UI |
| `product.alergenos text[]` **canónico**, `product_allergen` deprecado | una sola fuente; ya es lo que usa la web |
| Menú = línea cabecera + sub-líneas a cocina; fiscal "clase única" por defecto | simple, aceptado por AEAT en menú cerrado |

**Deuda técnica explícita a resolver:**
1. Redundancia `product.tipo_impositivo` (0001) vs `clase_fiscal` (0012) → elegir canónico.
2. Doble alérgenos `product.alergenos` vs `product_allergen` → deprecar la tabla join.
3. `modifier_group.product_id NOT NULL` (0001) bloquea reutilización → migración a opcional + puente.
4. `tax_rate`/`resolver_iva` (SQL) deben seguir cuadrando con `ivaAuto` de `@gluuh/core` (test).
```
