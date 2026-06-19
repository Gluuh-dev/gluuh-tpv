# Herramientas › Control de Efectivo (cajones inteligentes)

> Configuración de **máquinas de gestión de efectivo** (cajones/recicladores inteligentes) que cuentan, validan y dispensan dinero automáticamente. Se asignan por terminal ([puntos-de-venta.md §2](../administracion/puntos-de-venta.md)).

Captura: `Configuraciones` (Control de Efectivo).

---

## Ágora — qué muestra

**Listado** — Id · Nombre (`CASHLOGY`). Al crear (**Nuevo ▾**), elige el **tipo de dispositivo**:
`CashKeeper`, `CashInfinity`, `Cashlogy`, `CashGuard`, `CashDro (Ficheros)`, `CashDro (Web Service)`, `CashProtect`.

> Cada uno es un **integrador de hardware** distinto (protocolo propio: web service, ficheros, socket). El cajón inteligente cuenta el efectivo, da el cambio exacto y reduce descuadres y robos.

## Mapeo a nuestro modelo

```sql
create table cash_control_config (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre text, tipo text,         -- CASHLOGY|CASHDRO_WS|CASHKEEPER|CASHGUARD|...
  conexion jsonb                  -- host/puerto/ruta según protocolo
);
-- device.control_efectivo → cash_control_config (ver puntos-de-venta.md §2)
```

- Integración desde un **agente local** (`@gluuh/hardware` / servicio LAN), no desde el navegador. 🔴 falta (hoy `packages/hardware` es esqueleto).

## Mejoras sobre Ágora

- Abstracción común `CashDevice` (como hicimos con `Printer`) con drivers por marca, para no acoplar la app a un fabricante.
- Arqueo automático contra el contador físico del cajón al cerrar jornada (cero descuadres).
- Modo degradado: si el cajón cae, seguir cobrando en efectivo manual (offline‑first).
