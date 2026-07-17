# Plan 019: Hacer atómica, idempotente y server-authoritative la venta

> **Instrucciones para el ejecutor**: no cambies simultáneamente TPV y RPC sin una ventana compatible. Reserva migración en `docs/estado/AHORA.md`. Precios, permisos y tenant se resuelven en servidor; el navegador solo expresa intención.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/web/app/tpv/page.tsx supabase/migrations apps/web/app/api/ticket apps/web/app/lib/precio.ts` y `git status --short` sobre esas rutas. STOP si coinciden con cambios de otra sesión.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: L
- **Riesgo**: HIGH
- **Depende de**: 016, 018
- **Categoría**: correctness / security / migration
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

Una cuenta nueva se inserta primero en `sales_order` y después en `order_line`; el cobro marca la orden `COBRADA` y después inserta `payment`. Los fallos intermedios dejan cabeceras sin líneas o ventas cobradas sin pago. Además, precio, impuesto y total llegan calculados por el navegador.

## Evidencia actual

- `apps/web/app/tpv/page.tsx:1141-1159`: `sales_order` y líneas son llamadas independientes, con fallback que elimina `user_id`.
- `apps/web/app/tpv/page.tsx:1470-1501`: estado COBRADA antes de insertar pagos; el rollback es otra actualización best-effort.
- `supabase/migrations/0102_guardar_cuenta_atomica.sql`: protege cuentas existentes, no el alta ni el cobro.
- `apps/web/app/api/factura/route.ts:136-143`: reconoce que `precio_unitario` fue escrito por el cliente.

## Alcance

**Dentro**: migración aditiva; RPC de alta/guardado/cobro; caller TPV; idempotencia; validación de precios, impuesto, permiso, mesa y tenant; restricciones de escritura directa; tests DB/web.

**Fuera**: numeración/huella/AEAT (020), terminal bancario, rediseño visual, dividir/traspasar salvo que compartan el nuevo primitivo.

## Git

- Rama: `codex/019-venta-atomica`
- Commits separados para SQL, caller y pruebas.
- No retirar compatibilidad hasta verificar nodo y nube.

## Pasos

### 1. Definir el comando de dominio

Diseñar payload mínimo: `client_id` idempotente, local/mesa, operador, productos/cantidades/modificadores, operación y pagos. El servidor lee catálogo/tarifas/perfil y calcula líneas, impuestos y total con la misma regla de `@gluuh/core`/`resolver_iva()`.

**Verifica**: contrato documenta invariantes, errores estables y respuesta de reintento; no acepta `tenant_id`, total ni precio como autoridad.

### 2. Crear transacción SQL única

Implementar RPC que bloquee la cuenta/mesa necesaria, valide tenant/rol, inserte o actualice cabecera, sustituya líneas y registre pagos en una transacción. Añadir constraints para importes no negativos, suma de pagos coherente según política y unicidad idempotente por tenant/canal/client_id.

**Verifica**: una excepción después de cada fase deja cero cambios; dos llamadas iguales devuelven el mismo resultado; payload distinto con igual clave se rechaza.

### 3. Migrar el TPV con compatibilidad controlada

Sustituir `crearOrden` + insert de pagos por la RPC. Eliminar el fallback sin `user_id`. Mantener `guardar_cuenta` para borradores existentes solo hasta que el comando nuevo cubra todos los estados.

**Verifica**: guardar, aparcar, enviar comanda y cobrar funcionan; un timeout seguido de reintento no duplica orden ni pago.

### 4. Cerrar escrituras directas

Después de desplegar todos los callers, revocar/limitar INSERT/UPDATE directos de `sales_order`, `order_line` y `payment` para roles cliente; permitirlos únicamente mediante funciones estrechas o servicio autorizado.

**Verifica**: DevTools no puede alterar precio/total/estado; los journeys legítimos sí.

### 5. Operar y reconciliar

Registrar `request_id`, resultado y razón de rechazo sin datos de tarjeta. Añadir consulta de ventas en estado imposible y runbook de recuperación que no borre evidencia.

**Verifica**: cero COBRADA sin pago para VENTA; invitación/autoconsumo siguen sin pago por diseño.

## Pruebas

- Dos tenants y cuatro roles; manipulación de tenant, precio, impuesto, total y operador.
- Dos terminales cobran la misma cuenta a la vez: uno gana, otro obtiene conflicto recuperable.
- Fallos inyectados tras cabecera, líneas, pago y mesa: rollback total.
- Reintento tras respuesta perdida: mismo `order_id`/pagos.
- Redondeos, invitación, autoconsumo, pago mixto y propina.

## Hecho cuando

- [ ] Alta, líneas, estado, pagos y mesa cambian en una transacción.
- [ ] La clave idempotente cubre reintentos reales.
- [ ] Precios/impuestos/permisos se resuelven en servidor.
- [ ] El cliente no puede escribir tablas monetarias directamente.
- [ ] Tests adversariales pasan en nube y nodo 55432.

## STOP

- El esquema vivo difiere de los tipos confirmados en 016.
- No hay decisión funcional sobre suma de pagos/propina/redondeo.
- Existe un caller no inventariado que depende de INSERT directo.
- El cambio invade emisión fiscal; coordinar primero el contrato con 020.

## Mantenimiento

Toda operación monetaria nueva debe declarar transacción, idempotencia, autoridad del precio y prueba de concurrencia.
