# Cocina › Tipos de Preparación (estaciones) y Órdenes de Preparación (pases)

> Las dos taxonomías que rigen el **enrutado a cocina**: **Tipo de Preparación** = la **estación** (barra, cocina, tostador) a la que va un producto; **Orden de Preparación** = el **pase/marcha** (bebidas, primeros, segundos, postres). Cada producto tiene una de cada ([producto.md §1](../productos/producto.md)). Base de [04 — Impresión](../../04-impresion-y-tickets/) y [05 — KDS](../../05-cocina-kds-y-comanderas/).

Capturas: `Tipos de Preparación`, `Órdenes de Preparación` (listados + editor).

---

## A. Tipos de Preparación (= estaciones)

Listado simple **Id · Nombre**: `Barra`, `Cocina`, `Tostadas`.

> Es la **estación** (`product.estacion` / "Tipo Prep."). Decide a qué **impresora física o monitor KDS** se enruta cada línea ([puntos-de-venta.md §7](../administracion/puntos-de-venta.md), [monitores-cocina.md](monitores-cocina.md)). Coincide con las impresoras `PR_COCINA`/`PR_TICKETS`/`PR_TOSTADOR`.

**Mapeo:** `prep_station (id, tenant_id, nombre)`. 🔴 falta como configurador.

---

## B. Órdenes de Preparación (= pases / marcha)

Listado **Id · Nombre · Prioridad · Marchar**:

| Id | Nombre | Prioridad | Marchar |
|----|--------|----------:|:-------:|
| 1 | Bebidas | 0 | No |
| 2 | Primeros | 1 | No |
| 3 | Segundos | 2 | Sí |
| 4 | Terceros | 3 | Sí |
| 5 | Cuartos | 4 | Sí |
| 6 | Quintos | 5 | Sí |
| 7 | Postres | 6 | Sí |

**Editar Orden de Preparación:** Nombre · Prioridad · ☑ **Incluir como opción al marchar platos** (☐ Iniciar preparación al marchar) · ☐ **Iniciar preparación al enviar a cocina**.

> Es el **pase** (`product.orden_prep` / "Orden Prep."). La **prioridad** ordena el servicio; **Marchar** indica si el pase se "marcha" manualmente (el camarero da la orden de empezar). Bebidas/Primeros salen ya (Marchar No); Segundos en adelante esperan al **marchaje**. Confirma el flujo de pases de [05 §pases].

**Mapeo:**
```sql
create table prep_course (              -- "Orden de Preparación"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  prioridad int default 0,
  marchable boolean default false,           -- opción al marchar
  iniciar_al_marchar boolean default false,
  iniciar_al_enviar boolean default false
);
```
🔴 falta como configurador (los estados de comanda existen en `@gluuh/core`/operativa).

## Mejoras sobre Ágora

- Vincular **estación → impresora/KDS** visualmente (un mapa de enrutado), en vez de repetirlo en cada terminal/monitor.
- Marchaje desde la comandera con un toque, reflejado en KDS en tiempo real ([05]).
- Estación y pase como **enums compartidos** en `@gluuh/core` para que TPV, KDS e impresión coincidan sin desincronizarse.
