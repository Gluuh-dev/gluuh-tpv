# Herramientas › Mantenimiento (Auditoría · Eliminar · Generar QRs)

> Tres utilidades de sistema: **Auditoría** (registro de eventos), **Eliminar Tickets y Movimientos de Caja** (purga — ⚠️ ojo fiscal) y **Generar QRs de Pago y Pedidos** (QRs de mesa para Scan&Pay).

Capturas: `Auditoría`, `Eliminar Tickets y Movimientos de Caja`, `Generar QRs de Pago y Pedidos`.

---

## 1. Auditoría ★

Filtro **Fecha inicio/fin · Usuarios · TPVs · Consulta** (consultas guardables: *Administrar Consultas*) → tabla **Fecha · Usuario · Tipo · Acción · TPV · Aplicación · Equipo** + **Mostrar Informe**.

> Registro de **quién hizo qué y dónde** (anulaciones, descuentos, aperturas de cajón, cambios de config…). Es el `audit_log` ya previsto en [07 — Configuración](../../07-configuracion-y-administracion/) y clave para seguridad/RGPD ([12](../../../12-seguridad-y-rgpd.md)).

```sql
create table audit_log (
  id bigserial primary key, tenant_id uuid,
  fecha timestamptz, user_id uuid, tipo text, accion text,
  device_id uuid, aplicacion text, equipo text, detalle jsonb
);
```
🔴 falta. **Mejora**: consultas guardadas + alertas (p. ej. aviso si un usuario supera N anulaciones/día).

## 2. Eliminar Tickets y Movimientos de Caja ⚠️

Borra tickets y movimientos de caja con **fecha de negocio anterior** a la indicada. Botón rojo **Eliminar**.

> ⚠️ **Cuidado fiscal:** con **VERIFACTU** los registros de facturación tienen **obligación de conservación** (años) y forman una **cadena de huellas**: **no se pueden borrar libremente**. En Gluuh, esta herramienta **NO** debe permitir eliminar registros fiscales; como mucho, **archivar/purgar datos operativos no fiscales** (borradores, logs) respetando la retención legal. Decisión a validar con [07-facturación](../../../07-facturacion-y-cumplimiento-legal.md). 🔴 no replicar tal cual.

## 3. Generar QRs de Pago y Pedidos

Selección **Carta Digital · Tarifa · Modo** (`Scan & Pay`…) · **Centro de Venta** → **Descargar** (lote de QRs para pegar en las mesas).

> Genera los **QR por mesa/centro** que enlazan al modo de pedido ([config-pago-pedidos.md](config-pago-pedidos.md)) sobre la carta digital ([carta-digital.md](carta-digital.md)). En Gluuh, QR generado por `@gluuh/core` con la `location_table` codificada (mesa → comanda correcta).

```sql
-- QR por (digital_menu, price_list, modo, sales_center[, location_table]) → url firmada
```
🔴 falta. **Mejora**: QR por **mesa individual** (no solo por centro) para que el pedido caiga en la mesa correcta; PDF imprimible con plantilla de mesa.
