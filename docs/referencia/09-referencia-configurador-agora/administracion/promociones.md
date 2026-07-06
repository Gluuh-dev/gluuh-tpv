# Administración › Promociones (ofertas automáticas)

> Motor de **ofertas automáticas** con vigencia y reglas: descuento directo, **NxM** (3x2), descuento por volumen, etc. Se aplican solas al cumplir condiciones (fechas, días/horas, productos, unidades). Distinto de **Descuentos** ([descuentos.md](descuentos.md)), que son manuales. Liga con promociones del cliente ([clientes.md](clientes.md)).

Capturas: `Promociones` (listado, vacío) + `Editar Promoción`.

---

## Ágora — qué muestra

**Listado** — Id · Nombre · **Desde** · **Hasta** · **Programación** · **Tipo** · **Aplicar**. CRUD.

**Editar Promoción:**

### 1. Datos Básicos
- **Nombre** · **Código** · **Desde** (`19/06/2026`) · **Hasta** (`19/07/2026`) · **Programación** (`Todos los días` / días y horas concretas).

### 2. Configuración
- **Tipo**: `Descuento directo` (y otros: NxM, regalo…).
- **Aplicar a**: `Todos los tickets` (o segmentos).
- **Aplicaciones/Ticket**: `Sin límite` (cuántas veces puede aplicarse por ticket).

### 3. Configurar Descuento Directo
> "Se aplicará un porcentaje de descuento al precio de tarifa de los productos seleccionados."
- **Productos con descuento**: buscar (F3) y añadir (tabla Id · Nombre · Familia).
- **Uds. requeridas** (`0.000`): unidades necesarias para activar (3 → 3x2).
- **Tipo Descuento**: `Porcentaje` / Importe.
- **Descuento**: valor.
- **Aplicar**: `Por Grupos` (agrupa las unidades requeridas).
- **Descontar sobre**: `Más caros` / Más baratos (a qué unidades se aplica).
- *"Por cada N unidades compradas, se hará una aplicación que aplique el descuento a esas unidades."*
- **Grupos de Puntos de Venta** *(colapsada → `[propuesta]`: en qué terminales aplica la promo)*.

> **3x2 se modela así:** Uds. requeridas `3`, Descontar sobre `Más baratos`, Descuento `100%`, Aplicar `Por Grupos`.

---

## Qué necesitamos / Mapeo

```sql
create table promotion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text, codigo text,
  desde date, hasta date,
  programacion jsonb,                 -- días/horas (null = todos los días)
  tipo text not null,                -- DESCUENTO_DIRECTO|NXM|REGALO...
  aplicar_a text default 'TODOS_TICKETS',
  aplicaciones_ticket int,           -- null = sin límite
  -- reglas descuento directo / NxM
  uds_requeridas numeric(10,3) default 0,
  tipo_descuento text,               -- PORCENTAJE|IMPORTE
  descuento numeric(10,2),
  aplicar text default 'POR_GRUPOS',
  descontar_sobre text default 'MAS_CAROS'   -- MAS_CAROS|MAS_BARATOS
);
create table promotion_product (promotion_id uuid, product_id uuid);
```

- El cálculo (qué unidades, qué descuento, impuesto incluido) debe pasar por `@gluuh/core` para que el desglose fiscal y el **VERIFACTU** cuadren con el descuento aplicado. 🔴 falta (no hay motor de promociones aún).

## Mejoras sobre Ágora

- **Programación visual** (calendario + franjas horarias) reutilizando [periodos-servicio.md](periodos-servicio.md) (happy hour real).
- Promos por **canal** (solo delivery, solo carta online) y por **cliente/grupo**.
- **Prioridad y exclusión** entre promociones (qué gana si varias aplican) — Ágora no lo deja claro.
- Trazabilidad fiscal: registrar la promo aplicada en la línea para auditoría y abonos correctos.
