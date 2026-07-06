# Productos › Editar Producto (ficha central) ★

> **La pantalla más importante del catálogo.** Define el producto de venta: identidad, **clase fiscal**, **estación de cocina**, **varios nombres** (carta/botón/ticket/comanda/etiqueta), **añadidos/modificadores con su precio**, códigos de barras, stock/compras, y **precios por centro de venta**. Confirma y refina casi todo el modelo de [03 — Catálogo y modificadores](../../03-catalogo-productos-y-modificadores/). (701 productos en este negocio.)

> 🛈 Pestañas colapsadas (Precios Especiales · Formatos de Venta · Ficha · Carta Digital) → opciones **`[propuesta]`** al final.

Capturas: `Productos` (listado, 2 vistas) + `Editar Producto` (7 capturas).

---

## A. Listado de Productos

Columnas vistas: Id · **Nombre** · **Familia** · **Categorías** · **PLU** · **Cód. Barras** · **Impuesto** · **Tipo de Prep.** · **Orden de Prep.** · **Principal** · **Añadido** · **Imp. Compra** · **Origen** · **Tipo Pr. Coste** · **Pr. LOCAL Pri.** · **Pr. LOCAL Aña.** · **Supl. Menú LOCAL** · **Pr. COFFEE Pri.** · **Pr. COFFEE Aña.** · **Supl. Menú COFFEE**. CRUD + **…▾** (acciones masivas).

Ej.: `CAFE SOLO` · Familia CAFE · Cat. CAFE · Impuesto **Reducido** · Tipo Prep. **Barra** · Orden Prep. **Bebidas** · Principal **Sí** · Añadido **No** · Origen **Compra a proveedor** · Pr. LOCAL 1.30 · Pr. COFFEE 1.30.

> Las columnas de precio se **duplican por centro de venta** (LOCAL / COFFEE) y por tipo (**Principal / Añadido / Suplemento de menú**). Esto valida precios por local + precio distinto como añadido + suplemento en menú.

---

## B. Editar Producto — secciones

### 1. Producto (identidad y comportamiento)
| Campo | Demo (`CAFE SOLO`) | Nuestro mapeo |
|-------|--------------------|---------------|
| **Nombre** | `CAFE SOLO` | nombre de carta/pantalla |
| **Imp. Venta** | `Reducido` | **clase fiscal** → `@gluuh/core` `ivaAuto` (Reducido/General/Superreducido/Exento) × territorio |
| **Tipo Prep.** | `Barra` | **estación** → enrutado a impresora/KDS ([04](../../04-impresion-y-tickets/)/[05](../../05-cocina-kds-y-comanderas/)) |
| **Orden Prep.** | `Bebidas` | **pase/orden** de preparación |
| **Familia** | `CAFE` | FK familia ([clasificacion.md](clasificacion.md)) |
| Código PLU | | código rápido de venta |
| Tiempo Preparación (min) | | para KDS (cronómetro) |
| Tiempo Preaviso (min) | | aviso anticipado en KDS |
| ☑ **Permitir venta como producto principal** | sí | se puede vender solo |
| ☐ **Permitir venta como añadido de otro producto** | no | **puede ser modificador de otro** (¡clave!) |
| ☐ Limitar disponibilidad de producto | | 86/agotado, horarios |
| ☐ **Realizar la venta del producto por peso** | | balanza ([puntos-de-venta.md §5](../administracion/puntos-de-venta.md)) |
| ☑ **Solicitar automáticamente añadidos** | sí | al añadirlo, abre los modificadores |
| ☑ **Solicitar automáticamente notas de preparación** | sí | al añadirlo, pide nota de cocina |
| ☐ No imprimir en ticket si el precio de venta es cero | | |
| ☐ Preguntar antes de imprimir en cocina cambios de cantidad | | |
| **Prod. Relacionados** (botón) | | sugerencias/venta cruzada |

### 2. Estilo (botón en pantalla táctil)
- **Texto** del botón (`SOLO`) · **Color** (`#bacde2`) · **Imagen** (foto del café) · ☐ **Crear botón de venta directa**.

### 3. Estilo de impresión — LOS NOMBRES MÚLTIPLES ★
Aquí está, confirmado, el sistema de **varios nombres por producto** (supera los "3 nombres" que ya documentamos):

| Campo Ágora | Demo | Nuestro nombre |
|-------------|------|----------------|
| (Producto) **Nombre** | `CAFE SOLO` | `nombre_carta` (pantalla/TPV) |
| (Estilo) **Texto** | `SOLO` | `texto_boton` (etiqueta corta del botón) |
| **Texto para documento** | `CAFE SOLO` | `nombre_ticket` (factura/ticket cliente) |
| **Texto para comanda** | `CAFE SOLO` | `nombre_cocina` (comanda/KDS/impresora cocina) |
| **Texto 1–5 para Etiqueta** | | `texto_etiqueta[1..5]` (etiquetas EPL, [plantillas-etiquetas.md](../administracion/plantillas-etiquetas.md)) |

> Esto **confirma y amplía** los 3 nombres de [03](../../03-catalogo-productos-y-modificadores/)/[04](../../04-impresion-y-tickets/): carta, botón, ticket, comanda y hasta 5 textos de etiqueta. Cada destino resuelve su propio nombre.

### 4. Categorías
Buscar (F3) y añadir **N categorías** (eje pantalla/menús). El producto ya tiene su **Familia** en §1; aquí van las categorías. Confirma el modelo de **1 familia + N categorías** de [clasificacion.md](clasificacion.md).

### 5. Añadidos del Producto — LOS MODIFICADORES ★
Tabla **Nombre · Mínimo · Máximo** (con añadir/editar/borrar/reordenar). Cada fila es un **grupo de añadidos** con reglas de selección **min/max** (p. ej. "Extras" 0..n; "Punto de la carne" 1..1).

> Esto es exactamente el modelo de [03 §modificadores]. El **caso del usuario** ("Pizza Margarita" + extra de queso que suma 1,50 €) se monta así:
> - El **extra de queso** es un **producto** con ☑ *Permitir venta como añadido* y un **Precio Añadido** (§8) de 1,50 €.
> - Se incluye en un **grupo de añadidos** de la Pizza (mín 0 / máx n).
> - Al vender la pizza, ☑ *Solicitar automáticamente añadidos* abre el grupo; al elegir queso, **suma su Precio Añadido** y hereda la clase fiscal.
> - "Sin cebolla" / nota → ☑ *Solicitar automáticamente notas de preparación*.

### 6. Códigos de Barras
Lista de N códigos (EAN); **"el primer código será el principal"**. Para venta por escáner y etiquetas.

### 7. Almacén y compras
| Campo | Demo | Nota |
|-------|------|------|
| **Controlar stock** | `No` | activa descuento de inventario |
| **Precio Coste** | `Por Almacén` | coste por almacén / único |
| **Origen** | `Sólo inventario` ó `Compra a proveedor` | "Sólo inventario" ⇒ solo entra por regularización, **no se compra a proveedor** |
| Ud. de Medida / Ud. de Compra | `Unidad` | conversión compra→uso ([06](../../06-compras-proveedores-e-inventario/)) |
| Últ. Entrada / Coste Ud. | `<Sin Valor>` | calculados |
| **Proveedores Habituales** · **Almacenes** · **% Margen** · **% Coste** (botones) | | enlazan con compras/escandallo |

### 8. Precios de venta (por **tarifa**) ★
Tabla por **tarifa** (filas `LOCAL`, `COFFEE` = las [Tarifas](../administracion/tarifas.md), no los centros) × columnas:
| Columna | Demo | Significado |
|---------|------|-------------|
| **Precio** | 1.30 | precio de venta como **principal** (impuesto **incluido**) |
| **Precio Añadido** | 0.00 | precio cuando se vende **como añadido/extra** de otro producto |
| **Supl. Menú** | 0.00 | **suplemento** si entra en un menú |
| **Impuesto** | `Por defecto` | override de clase fiscal por centro (o hereda §1) |
| **Etiqueta Lineal** (botón) | | imprime etiqueta de lineal/estantería |

> Confirma 3 cosas de [03]: **precio por local**, **precio distinto como añadido**, y **suplemento en menú**, todos con **impuesto incluido** y desglose vía `@gluuh/core` `calcularImpuestosIncluidos`.

### 9–12. Pestañas colapsadas → **`[propuesta]`**
| Pestaña | Propuesta nuestra |
|---------|-------------------|
| **Precios Especiales** | Precios por **cliente/grupo/tarifa** y por **vigencia** (fechas/horas) — override del precio base. Liga con [clientes.md](../administracion/clientes.md) y promociones. |
| **Formatos de Venta** | **Variantes/tamaños** (tapa/ración, mediana/familiar, caña/jarra) cada uno con su precio y, si aplica, su código. Es la "Variante" de [03]. |
| **Ficha** | **Escandallo** (ingredientes/receta para coste y stock) + **14 alérgenos UE** + info nutricional. Liga con [06](../../06-compras-proveedores-e-inventario/) y alérgenos de [03]. |
| **Carta Digital** | Descripción larga, **foto**, alérgenos visibles, precio para la **carta online/QR (SmartMenu)** y visibilidad en e‑commerce. |

---

## Mapeo a nuestro modelo (resumen)

```sql
create table product (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  -- nombres múltiples
  nombre_carta text not null,
  texto_boton text,
  nombre_ticket text,        -- "Texto para documento"
  nombre_cocina text,        -- "Texto para comanda"
  texto_etiqueta text[],     -- Texto 1..5 etiqueta
  -- clasificación / fiscal / cocina
  clase_fiscal text not null,            -- Imp. Venta (Reducido/General/...)
  family_id uuid references family(id),
  estacion text,                         -- Tipo Prep. (Barra/Cocina/Tostadas)
  orden_prep text,                       -- pase (Bebidas/...)
  plu text,
  tiempo_prep_min int, tiempo_preaviso_min int,
  -- comportamiento
  vende_principal boolean default true,
  vende_anadido boolean default false,   -- puede ser modificador de otro
  limitar_disponibilidad boolean default false,
  venta_por_peso boolean default false,
  solicitar_anadidos boolean default false,
  solicitar_notas boolean default false,
  no_imprimir_si_cero boolean default false,
  preguntar_cambio_cantidad boolean default false,
  -- estilo
  color text, imagen_url text, boton_directo boolean default false,
  -- stock/compras
  controlar_stock boolean default false,
  origen text default 'COMPRA_PROVEEDOR',   -- SOLO_INVENTARIO | COMPRA_PROVEEDOR
  ud_medida text, ud_compra text
);
create table product_category (product_id uuid, category_id uuid);
create table product_barcode (product_id uuid, code text, principal boolean);
create table product_price (              -- §8 por TARIFA
  product_id uuid references product(id),
  price_list_id uuid,                     -- Tarifa: LOCAL / COFFEE (ver tarifas.md)
  precio numeric(10,2),                   -- principal (IVA/IGIC incl.)
  precio_anadido numeric(10,2),
  suplemento_menu numeric(10,2),
  impuesto_override text                  -- null ⇒ usa clase_fiscal
);
create table product_modifier_group (    -- §5 "Añadidos del Producto"
  product_id uuid references product(id),
  nombre text, minimo int default 0, maximo int, orden int
);
-- los miembros del grupo son productos con vende_anadido=true y precio_anadido
```

- Multi‑tenant RLS. Precio con **impuesto incluido**; desglose y clase fiscal **siempre** en `@gluuh/core` (no duplicar). 🟡 producto existe en operativa; este nivel de configurador (nombres múltiples, añadidos min/max, precio por centro) 🔴 falta.

## Mejoras sobre Ágora

- **Nombres con variables/idioma**: `nombre_cocina` en el idioma del cocinero; herencia si se deja vacío (usa `nombre_carta`).
- **Añadidos reutilizables** (grupos de modificadores compartidos por muchos productos), no recreados producto a producto — más limpio que el enfoque "familia AÑADIDOS" de Ágora ([clasificacion.md]).
- **Escandallo y alérgenos de primera clase** en la pestaña *Ficha* (no opcional): coste real + cumplimiento de info al consumidor.
- **Precio por centro** con herencia (si COFFEE no fija precio, usa LOCAL) para no teclear dos veces.
- Validación: si `vende_anadido` está activo, exigir `precio_anadido` coherente; avisar si la clase fiscal del añadido difiere de la del producto base.
