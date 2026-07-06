# Administración › Centros de Venta (zonas/salas)

> Un **Centro de Venta** es una **zona de venta** (sala, barra, terraza, servicio de cafetería…) con su **tarifa**, su **almacén**, sus **ubicaciones/mesas** y sus **impresoras**. Es el nivel entre el negocio y la mesa, y lo referencian terminales, productos y el cierre Z. Resuelve qué es el "centro de venta" citado en muchas otras fichas.

Capturas: `Centros de Venta` (listado) + `Editar Centro de Venta`.

---

## A. Listado

**Id · Nombre · Tarifa · Tipo · Prioridad** (12 registros):

| Id | Nombre | Tarifa | Tipo |
|----|--------|--------|------|
| 4 | General | LOCAL | Impuestos incluidos |
| 7 | Reservado | LOCAL | Impuestos incluidos |
| 8 | Auxiliar | LOCAL | Impuestos incluidos |
| 11–20 | C‑09:40, C‑10:00, C‑10:20 … C‑EXTRA | **COFFEE** | Impuestos incluidos |

> Dos usos visibles: zonas de **restaurante** (General/Reservado/Auxiliar → tarifa LOCAL) y **franjas de servicio de cafetería/catering** por hora (C‑09:40… → tarifa COFFEE). El centro fija la **tarifa** que se cobra.

## B. Editar Centro de Venta — secciones

### 1. Centro de Venta
| Campo | Demo | Nota |
|-------|------|------|
| **Nombre** | | |
| **Tarifa** | | lista de precios que aplica ([tarifas.md](tarifas.md)) |
| **Almacén** | `Almacén General` | de dónde descuenta stock |
| Grupo Inicial | `<Ninguno>` | grupo de productos que se abre por defecto |
| **Pedir Comensales** | `Nunca` | Nunca/Siempre/Preguntar (nº de comensales) |
| **Pedir Identificador de Ticket** | `Nunca` | nombre/ref del ticket al abrir |
| ☐ Iniciar pedido telefónico al abrir ubicación | | |
| ☐ Habilitar tiempo de inactividad | | |

### 2. Estilo
- Texto · Color (`#bacde2`) · Imagen · **Prioridad** · **Botones Ubicación** (`Ver Consumo` — qué muestran los botones de mesa).

### 3. Ubicaciones/Mesas ★
- **Añadir ubicación/mesa** + lista (reordenable, borrable). Aquí se dan de alta las **mesas** del centro → es el **plano de sala** ([02 — Interfaz](../../02-interfaz-tactil/), [07 — Configuración §salas](../../07-configuracion-y-administracion/)).

### 4. Impresoras (por tipo de documento)
- **Proformas** → Impresora de Proformas · **Fra. Simpl.** → Impresora de Fact. Simpl. · **Facturas** → Impresora de Facturas · **Albaranes/Pedidos** → Impresora de Albaranes/Pedidos · botón **Por Defecto**.

> Las impresoras se asignan en **dos niveles**: por **centro de venta** (aquí) y por **terminal** ([puntos-de-venta.md §6](puntos-de-venta.md)). El terminal puede heredar las del centro.

---

## Mapeo a nuestro modelo

```sql
create table sales_center (             -- "Centro de Venta" (zona/sala)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  price_list_id uuid references price_list(id),   -- Tarifa
  almacen_id uuid,                                -- Almacén
  grupo_inicial_id uuid,
  pedir_comensales text default 'NUNCA',          -- NUNCA|SIEMPRE|PREGUNTAR
  pedir_identificador text default 'NUNCA',
  pedido_telefonico boolean default false,
  tiempo_inactividad boolean default false,
  color text, imagen_url text, prioridad int default 0,
  botones_ubicacion text default 'VER_CONSUMO'
);
create table location_table (           -- "Ubicación/Mesa"
  id uuid primary key default gen_random_uuid(),
  sales_center_id uuid references sales_center(id),
  nombre text not null,
  pos_x int, pos_y int,                 -- plano de sala
  estado text default 'LIBRE'
);
create table sales_center_printer (     -- impresoras por tipo de doc
  sales_center_id uuid references sales_center(id),
  doc_tipo text,                        -- PROFORMA|FRA_SIMP|FACTURA|ALBARAN
  printer_id uuid
);
```

> Jerarquía que aclara todo lo anterior:
> ```
> tenant (empresa, datos fiscales)
>   └─ configuración GLOBAL ("Editar Local")
>   └─ sales_center (zona: General, Reservado, COFFEE…)  → tarifa + almacén + impresoras
>         └─ location_table (mesa/ubicación)             → plano de sala
>   device (TPV/comandera) opera sobre un centro; usa su almacén/impresoras salvo override
> ```
> Multi‑tenant RLS. 🔴 falta como configurador (la operativa pinta salas/mesas, pero sin este modelo de centro con tarifa/almacén/impresoras).

## Mejoras sobre Ágora

- **Plano visual** de mesas (arrastrar/soltar, unir/separar) en vez de una simple lista ([07 §salas]).
- Centro de venta = nuestro **multi‑local/zona** real: cada uno con su tarifa, almacén e impresoras, heredando lo global.
- Las "franjas horarias como centro" (C‑09:40…) son un apaño de Ágora para catering: nosotros lo modelamos mejor con **periodos de servicio** ([periodos-servicio.md](periodos-servicio.md)) + un único centro de cafetería.
