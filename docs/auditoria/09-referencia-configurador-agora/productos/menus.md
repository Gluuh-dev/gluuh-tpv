# Productos › Menús (combos / menú del día)

> Un **menú** es un producto compuesto: se vende como uno solo pero el cliente **elige platos por pasos** (primer plato, segundo, postre, bebida). Cada paso ofrece productos de una categoría. Confirma el modelo de **menús/combos** de [03 — Catálogo §menús](../../03-catalogo-productos-y-modificadores/).

Capturas: `Menús` (listado) + `Editar Menú`.

---

## A. Listado de Menús

Columnas **Id · Nombre · Familia · Categorías · Impuesto · Vendible**. (5 menús.) Ej.: `MENÚ`, `1/2 MENÚ`, `1/2 MENÚ FIN DE SEMANA`, `MENU FIN DE SEMANA`, `CATERING DELBON` — todos Categoría `MENU`, Impuesto `Reducido`, Vendible `Sí`.

---

## B. Editar Menú — secciones

### 1. Menú (identidad)
| Campo | Demo | Nota |
|-------|------|------|
| **Nombre** | `MENÚ` | |
| **Imp. Venta** | `Reducido` | clase fiscal del menú (el menú tiene su propio impuesto) |
| Familia | `<Ninguno>` | opcional |
| ☑ **Permitir la venta de este menú** | sí | "Vendible" |
| ☐ Limitar disponibilidad de menú | | horarios (p. ej. solo mediodía) |
| Código PLU | | |

### 2. Estilo
- Texto (`MENÚ`) · **Color** (`#f8e71c`, amarillo) · Imagen · ☑ Crear botón de venta directa.

### 3. Estilo de impresión
- **Texto para documento** (`MENÚ`) · **Texto para comanda** (`MENÚ`) · **Ind. Platos Comanda** (cómo se listan los platos del menú en la comanda de cocina).

### 4. Categorías
- Categoría(s) donde aparece el menú en pantalla (`MENU`).

### 5. Grupo de Platos ★ (los pasos del menú)
Tabla **Nombre · Cat. Productos · Nº Platos · Ord. Preparación** (con añadir/editar/borrar/reordenar):

| Nombre | Cat. Productos | Nº Platos | Ord. Preparación |
|--------|----------------|:---------:|------------------|
| BEBIDAS | BEBIDAS | 1 | Bebidas |
| PRIMEROS | PRIMEROS MENU | 1 | Primeros |
| SEGUNDOS | SEGUNDOS MENU | 1 | Segundos |
| POSTRE | POSTRES MENU | 1 | Postres |

> Cada **grupo de platos** = un **paso de elección**: el cliente escoge `Nº Platos` producto(s) de la **categoría** indicada, y ese plato va a cocina con su **orden de preparación** (pase). El **suplemento** de un plato concreto sale del campo *Supl. Menú* del producto ([producto.md §8](producto.md)).

### 6–7. Pestañas colapsadas → **`[propuesta]`**
- **Ficha**: escandallo agregado del menú (coste = suma de platos) + alérgenos combinados.
- **Carta Digital**: descripción y foto del menú para la carta online.

---

## Mapeo a nuestro modelo

```sql
create table menu (                       -- es un product con tipo='MENU'
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  clase_fiscal text not null,             -- Imp. Venta del menú
  vendible boolean default true,
  limitar_disponibilidad boolean default false,
  plu text, color text, imagen_url text,
  nombre_ticket text, nombre_cocina text, ind_platos_comanda text
);
create table menu_step (                  -- "Grupo de Platos"
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references menu(id),
  nombre text,                            -- 'PRIMEROS'
  category_id uuid,                       -- de qué categoría se elige
  num_platos int default 1,
  orden_prep text,                        -- pase
  orden int
);
-- el suplemento por plato = product_price.suplemento_menu (ver producto.md)
```

- El menú reusa el modelo de producto (nombres múltiples, clase fiscal, estilo). El **impuesto del menú** lo resuelve `@gluuh/core`; OJO con menús que mezclan tipos (bebida 21% + comida 10%): decidir si el menú lleva un único tipo (como hace Ágora: `Reducido`) o desglose proporcional — **decisión fiscal a confirmar** con [07-facturación](../../../07-facturacion-y-cumplimiento-legal.md). 🟡 menús existen en operativa; este editor por pasos 🔴 falta.

## Mejoras sobre Ágora

- **Suplemento visible** en el paso (no solo en la ficha del producto) para que el camarero lo vea al elegir.
- **Mín/máx por paso** (no solo "Nº Platos" fijo): p. ej. "elige 1 o 2 entrantes".
- Aviso/desglose fiscal claro cuando el menú combina IVA/IGIC de distintos tipos.
