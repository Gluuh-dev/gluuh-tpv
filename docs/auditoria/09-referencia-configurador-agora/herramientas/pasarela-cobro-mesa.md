# Herramientas › Pasarela de Pago — Cobro en Mesa (datáfono)

> Integración técnica con el **datáfono/pasarela** para cobrar en mesa: puerto de escucha, mapeo de **datáfonos físicos ↔ TPVs** y de **formas de pago de la pasarela ↔ formas de pago de Ágora**. Liga con [formas-de-pago.md](../administracion/formas-de-pago.md) y [locales.md §3](../administracion/locales.md). Ver [08 — Pasarelas de pago](../../../08-pasarelas-de-pago.md).

Capturas: `Configuraciones (Cobro en Mesa)` (listado: `PAGO EN MESA`) + `Editar Configuración de Pasarela de Pago`.

---

## Ágora — qué muestra

- **Nombre** · **Puerto de Escucha** (`2244`).
- **Asignación de datáfonos a TPVs**: tabla **Id Datáfono ↔ TPV Ágora** (qué datáfono físico atiende a qué terminal).
- **Forma Pago con Tarjeta** (`TARJETA`) + **Asignación formas de pago pasarela ↔ Ágora**: mapea el medio que devuelve el datáfono al medio interno.

> Es la **capa de integración** con el TPV‑PIN/datáfono (AgoraPay): el TPV manda el importe al datáfono asignado por su puerto, y al confirmar, el medio de la pasarela se traduce a la forma de pago interna (para arqueo/Z).

## Mapeo a nuestro modelo

```sql
create table payment_gateway_config (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre text, puerto int,
  forma_pago_tarjeta text
);
create table gateway_terminal_map (config_id uuid, datafono_id text, device_id uuid);
create table gateway_method_map (config_id uuid, metodo_pasarela text, payment_method_id uuid);
```

- Integración desde `apps/api`/agente local (no navegador); secretos de pasarela fuera del cliente. El cobro confirmado se concilia con el arqueo ([formas-de-pago.md](../administracion/formas-de-pago.md)). 🔴 falta.

## Mejoras sobre Ágora

- **Conciliación automática** datáfono↔liquidación bancaria.
- Soporte de **Tap to Pay** (móvil como datáfono) y QR de pago, además de TPV físico.
- Reintentos/idempotencia en cobro (no cobrar dos veces tras corte de red).
