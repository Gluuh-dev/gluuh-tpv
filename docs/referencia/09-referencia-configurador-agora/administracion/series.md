# Administración › Series

> Listado maestro de **series de numeración legal** de documentos. Cada serie tiene un contador propio (`Siguiente Nº`) que **no puede tener huecos** ni reiniciarse: es la base de la trazabilidad fiscal y de la cadena VERIFACTU. Ágora separa series de **TPV** y de **Administración Web** (sufijo `W`), y de **proveedor** (sufijo `C`).

Captura: `Series` → *Listado de Series* (18 registros).

---

## Ágora — qué muestra

Tabla con columnas **Id · Nombre · Tipo · Siguiente Nº · En Uso** y acciones **Nuevo · Copiar · Editar · Eliminar · Buscar**.

| Nombre | Tipo | Siguiente Nº | En Uso | Origen |
|--------|------|-------------:|:------:|--------|
| `T`   | Fra. Simp.       | 195580 | Sí | TPV |
| `F`   | Factura          | 357    | Sí | TPV |
| `A`   | Albarán          | 2005   | Sí | TPV |
| `TD`  | Dev. Simp.       | 376    | Sí | TPV |
| `FD`  | Devolución       | 2      | Sí | TPV |
| `P`   | Pedido           | 7      | Sí | TPV |
| `PC`  | Ped. Proveedor   | 1      | Sí | Compras |
| `AC`  | Alb. Proveedor   | 1      | Sí | Compras |
| `FC`  | Fra. Proveedor   | 1      | Sí | Compras |
| `TW`  | Fra. Simp.       | 2      | No | Web |
| `FW`  | Factura          | 314    | No | Web |
| `AW`  | Albarán          | 23     | No | Web |
| `TDW` | Dev. Simp.       | 40     | No | Web |
| `FDW` | Devolución       | 11     | No | Web |
| `PW`  | Pedido           | 2      | No | Web |
| `PCW` | Ped. Proveedor   | 1      | No | Web |
| `ACW` | Alb. Proveedor   | 1      | No | Web |
| `FCW` | Fra. Proveedor   | 1      | No | Web |

**Patrón de nombres:** base = tipo (`T` fra. simplificada/ticket, `F` factura, `A` albarán, `D` devolución, `P` pedido); sufijo `D` = devolución, `C` = proveedor/compra, `W` = administración web.

---

## Tipos de documento (lo que necesitamos cubrir)

| Tipo | Ejemplo serie | Uso |
|------|------|-----|
| **Factura simplificada** (ticket) | `T` | El 95% de la hostelería: cobro normal en TPV |
| **Factura** (completa, con datos cliente) | `F` | Cliente que pide factura |
| **Devolución de fra. simplificada** | `TD` | Abono de ticket |
| **Devolución de factura** | `FD` | Abono de factura |
| **Albarán** | `A` | Entrega sin valor fiscal de cobro |
| **Pedido** | `P` | Comanda/pedido |
| **Pedido / Albarán / Factura de proveedor** | `PC`/`AC`/`FC` | Compras (ver [06](../../06-compras-proveedores-e-inventario/)) |

Cada tipo, además, **duplicado por origen** TPV vs Web (sufijo `W`).

---

## Qué necesitamos

- Tabla maestra de series con **contador atómico** por serie (sin huecos, sin reinicio dentro del ejercicio salvo cambio de serie por año).
- **Serie por tipo de documento × origen** (TPV/Web/Proveedor), como Ágora.
- **Serie por terminal** (lo que Ágora **no** hace y nosotros sí necesitamos): para que varios TPV cobrando **offline** a la vez no compitan por el mismo número y cada cadena VERIFACTU quede íntegra. Ver [01 §4 — ticaje sin internet](../../01-arquitectura-y-plataforma/).
- Marca **En Uso** para impedir borrado de series con documentos emitidos.

## Mapeo a nuestro modelo

```sql
-- propuesta; multi-tenant con RLS por tenant_id
create table document_series (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  location_id  uuid not null,
  device_id    uuid,                 -- null = compartida del local; set = por terminal (offline)
  nombre       text not null,        -- 'T', 'F', 'TW', 'PC'...
  tipo         text not null,        -- FRA_SIMP|FACTURA|DEV_SIMP|DEVOLUCION|ALBARAN|PEDIDO|PED_PROV|ALB_PROV|FRA_PROV
  origen       text not null,        -- TPV|WEB|COMPRAS
  ejercicio    int  not null,        -- año fiscal
  siguiente_num bigint not null default 1,
  en_uso       boolean not null default false,
  unique (tenant_id, location_id, nombre, ejercicio)
);
```

> El **incremento del contador** debe ser atómico en el backend (`apps/api` / función Postgres), **nunca** desde el cliente. La huella VERIFACTU encadenada de `@gluuh/core` se ancla a `(serie, número)`. El cliente offline puede *pre‑reservar* su rango por terminal (ver serie por `device_id`).

## Mejoras sobre Ágora

- **Reinicio anual asistido**: al cambiar de ejercicio, sugerir nueva serie (`T2026`) en vez de un contador eterno (el `T` de Ágora va por 195.580).
- **Serie por terminal** para offline robusto (Ágora obliga a online para no romper la numeración).
- **Vista de salud de la cadena**: huecos detectados, último número emitido, pendientes de enviar a AEAT — integrado con el Visor VERIFACTU.
- Aviso/bloqueo al **eliminar** una serie `En Uso = Sí` (Ágora deja el botón Eliminar sin distinguir).
