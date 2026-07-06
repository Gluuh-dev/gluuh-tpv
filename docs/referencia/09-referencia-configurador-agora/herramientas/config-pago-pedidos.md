# Herramientas › Configuración de Pago y Pedidos (modos de venta) ★

> Define los **modos de pedido/pago**: **Scan & Pay**, **Pedido en Mesa**, **Delivery** y **Take Away**, cada uno con su flujo (TPV, usuario, forma de pago, tarifa, preparación, notificaciones, zonas de reparto). Es la "Configuración de Pedidos" referenciada en [locales.md §2](../administracion/locales.md) (Scan&Pay→PAGO EN MESA, etc.).

Capturas: `Configuración de Pago y Pedidos` (listado) + `Editar Configuración` (por tipo).

---

## A. Listado
**Id · Nombre · Tipo**: `PAGO EN MESA`/Scan & Pay · `PEDIDO EN MESA`/Pedido en Mesa · `DELIVERY`/Delivery · `PARA LLEVAR`/Take Away.

## B. Campos comunes
Todos: **Nombre · Tipo · Punto de Venta · Usuario · Forma de Pago** (`AgoraPay`). Según tipo se añaden bloques:

### Scan & Pay (`PAGO EN MESA`)
- ☑ **Permitir dividir cuenta**. (El cliente escanea el QR de la mesa y paga su parte.)

### Pedido en Mesa
- **Cliente por defecto** · ☑ **Pedir comensales**.
- **Opciones de pago**: ☑ Pagar al finalizar el pedido · ☑ Pagar más tarde.
- **Gestión de pedidos en mesa**: al recibir pedido **pagado** (☐ Emitir factura · ☑ Enviar a preparar) / **no pagado** (☑ Enviar a preparar).

### Delivery
- **Tarifa** (`Usar la de la carta digital`) · **Ubicación** · ☐ Pedir comensales.
- **Opciones de entrega**: ☐ Pago al entregar · ☑ Pago al realizar el pedido.
- **Notificaciones** (email): al recibir / aceptar / rechazar / iniciar prep. / finalizar prep. / enviar / entregar — con **Cabecera/Pie** editables, **color de realce** y previsualización.
- **Gestión de pedidos**: al recibir pedido pagado/sin pagar → **Pasar a** estado (`Nuevo`…) y ☐ Emitir factura.
- **Horarios de servicio**: tabla **Nombre · Máx. Ped./15 min · Hora inicio · Hora fin · Días** (ej. `MAÑANA 08:00‑15:00 L‑V`, `TARDE 15:00‑20:00 L‑V`). Limita el ritmo de pedidos.
- **Área de entrega**: tabla **Nombre · Coste Envío · T. Mín. Entrega (min) · Pedido Mínimo** (ej. `CARCHUNA · 1,50 € · 20 min · 10,00 €`).

### Take Away (`PARA LLEVAR`)
- Flujo de recogida (sin mesa ni reparto).

---

## Mapeo a nuestro modelo

```sql
create table order_mode_config (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre text, tipo text,            -- SCAN_PAY|MESA|DELIVERY|TAKEAWAY
  device_id uuid, user_id uuid, payment_method_id uuid,
  price_list_id uuid, customer_default_id uuid,
  pedir_comensales boolean, dividir_cuenta boolean,
  pago_al_finalizar boolean, pago_mas_tarde boolean, pago_al_entregar boolean,
  emitir_factura boolean, enviar_preparar boolean, estado_inicial text,
  notificaciones jsonb               -- eventos + email/cabecera/pie/color
);
create table delivery_schedule (config_id uuid, nombre text, max_ped_15min int,
  hora_inicio time, hora_fin time, dias int[]);
create table delivery_area (config_id uuid, nombre text, coste_envio numeric(10,2),
  tiempo_min int, pedido_minimo numeric(10,2));
```

- Cada modo dispara el flujo correcto: a cocina ([05](../../05-cocina-kds-y-comanderas/)), cobro ([formas-de-pago.md](../administracion/formas-de-pago.md)), y factura VERIFACTU si procede. 🔴 falta (operativa tiene modos, no este configurador).

## Mejoras sobre Ágora

- **Estados de pedido en tiempo real** para el cliente (recibido→en preparación→en camino→entregado) por web/push, no solo email.
- **Reparto**: asignación de repartidor, ruta y cobro en entrega; zonas por mapa/CP en vez de lista.
- Límite de pedidos por franja ligado a la capacidad real de cocina (KDS).
