# Productos › Entradas (vales / entradas canjeables)

> Sistema de **vales/entradas**: ítems que se **imprimen** al vender y se **canjean** después por un producto (consumición incluida, abono de evento, bono de catering…). Cada entrada tiene su **plantilla de impresión** y una **validez en días**. Nicho en hostelería clásica, útil en eventos/festivales/catering ("DELBON"). Liga con el flag *Imprimir entradas consumidas* del ticket ([plantillas-ticket.md §D#24](../administracion/plantillas-ticket.md)).

Capturas: `Plantillas de Entradas` + `Editar Plantilla de Entradas`; `Entradas` (listado) + `Editar Entrada`.

---

## A. Plantillas de Entradas

**Listado** — Id · Nombre · **Columnas** (`Plantilla de Entradas` / `42`).

**Editor:** **Nombre** · **Columnas** (`42`) · **Formato** (bloques +Texto/+Imagen, Mover/Eliminar) · **Vista Previa** + **Impresora** + **Imprimir** (prueba). Igual que las plantillas de ticket/comanda pero para el vale físico.

## B. Entradas

**Listado** — Id · Nombre · **Imprimir con** · **Canjear con** · **Duración en días** (0 registros aquí).

**Editar Entrada:**
- **Nombre** · **Plantilla** (de entradas) · **Validez en días**.
- **Impresión y Canje:** **Imprimir con** (qué producto/acción imprime la entrada) · **Canjear usando** (qué producto la canjea).
- **Grupos de Puntos de Venta** *(colapsada → `[propuesta]`: en qué terminales se vende/canjea)*.

---

## Qué necesitamos / Mapeo

```sql
create table voucher_template (          -- "Plantilla de Entradas"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid, nombre text, columnas int default 42, formato jsonb
);
create table voucher_type (              -- "Entrada"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid, nombre text,
  template_id uuid references voucher_template(id),
  validez_dias int,
  producto_imprime_id uuid,             -- "Imprimir con"
  producto_canjea_id uuid               -- "Canjear usando"
);
create table voucher (                   -- entrada emitida (instancia)
  id uuid primary key default gen_random_uuid(),
  voucher_type_id uuid, codigo text,    -- código/QR único
  emitida_en timestamptz, caduca_en timestamptz,
  canjeada boolean default false, canjeada_en timestamptz
);
```

> Prioridad **baja** para bar/restaurante estándar (lista vacía); media‑alta para **eventos/catering**. El canje debe ser **idempotente** (un vale no se canjea dos veces) — encaja con la idempotencia offline de [01 §4](../../01-arquitectura-y-plataforma/). 🔴 falta.

## Mejoras sobre Ágora

- **QR único** por entrada para canje rápido por escáner/móvil (no solo impresión térmica).
- Control de **caducidad y un solo uso** verificado en backend (anti‑fraude), no solo en cliente.
- Integración con **carta digital/online** para vender bonos a distancia.
