# Plan 020: Blindar la emisión fiscal, la huella y el envío AEAT

> **Instrucciones para el ejecutor**: fiscalidad crítica. Conserva los vectores oficiales y no envíes a AEAT producción durante desarrollo. Reserva migración y documenta el entorno usado.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/web/app/api/factura apps/api/src/fiscal packages/core/src/fiscal supabase/migrations` y `git status --short` en esas rutas.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: L
- **Riesgo**: HIGH
- **Depende de**: 019
- **Categoría**: fiscal / correctness / security
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

La ruta deriva correctamente F1/F2 para persistir, pero construye la huella siempre con `tipoFactura: "F2"`. Reserva número leyendo la última factura y después inserta; factura y desglose fiscal no están en una transacción. El envío fiscal necesita autenticación, idempotencia y una outbox durable para no perder ni duplicar remesas.

## Evidencia actual

- `apps/web/app/api/factura/route.ts:91-101`: deriva destinatario y F1/F2.
- `:103-115,245-255`: calcula `max + 1` fuera de transacción y reintenta colisiones.
- `:158-168`: encadena siempre como F2; `:184-208` persiste `dest.tipoFactura`.
- `:264-286`: inserta `invoice_tax_line` después y solo registra el error.
- `apps/api/src/fiscal/*`: servicio de envío separado, con superficie HTTP que debe quedar autenticada y validada.

## Alcance

**Dentro**: comando fiscal transaccional, F1/F2, serie/número/huella, desglose, outbox AEAT, estado de envío, auth/validación API, tests oficiales y concurrencia.

**Fuera**: activar VERIFACTU globalmente, usar certificado real en tests, TicketBAI, rectificativas si el dominio aún no está decidido.

## Git

- Rama: `codex/020-emision-fiscal`
- Commits: core/vector, migración, API/outbox, pruebas.

## Pasos

### 1. Congelar invariantes fiscales

Especificar cuándo se emite F1/F2, zona horaria del local, serie por local/ejercicio, datos inmutables del destinatario y relación única pedido↔factura. Definir estados `PENDIENTE/ENVIANDO/ACEPTADA/RECHAZADA/REINTENTABLE` sin reutilizar ambiguamente `NO_ENVIADA`.

**Verifica**: tabla de estados y transiciones aprobada; una factura emitida nunca se edita en sitio.

### 2. Mover numeración y huella a transacción serializada

Crear función/RPC que bloquee el contador de serie, lea la huella anterior correcta, calcule número, snapshot fiscal, cabecera, desglose y evento outbox en una sola transacción. Usar `dest.tipoFactura` en la cadena y el huso IANA del local.

**Verifica**: 20 emisiones concurrentes producen secuencia única, ordenada y cadena verificable; fallo en tax line revierte todo.

### 3. Hacer la emisión idempotente

Clave única por tenant/order/tipo de operación o `client_id` documentado. Un reintento devuelve la factura existente; un payload incompatible se rechaza y audita.

**Verifica**: timeout/reintento no consume otro número ni crea otra huella.

### 4. Implementar worker outbox

El worker toma eventos con lock/lease, genera XML desde snapshot, envía con mTLS, persiste respuesta y reintenta solo errores clasificados. Nunca marca enviado antes del acuse. Redacta certificado, NIF y XML en logs según política.

**Verifica**: caída antes/después del HTTP converge sin perder evento; rechazo funcional no entra en bucle.

### 5. Cerrar y validar la API

Aplicar guard de autenticación/tenant/rol, DTO con límites y `ValidationPipe`; CORS por allowlist. `/fiscal/enviar` no acepta seleccionar tenant/certificado arbitrario.

**Verifica**: anónimo y tenant ajeno denegados; payload extra/malformado 400; rol autorizado puede consultar estado.

### 6. Migrar caller y desplegar apagado

La venta 019 solicita emisión tras commit mediante comando idempotente; mantener feature flag apagado hasta pasar smoke en entorno AEAT de pruebas y reconciliar facturas históricas de ensayo.

**Verifica**: flag off no crea outbox; flag on pruebas produce factura, XML, QR y estado coherentes.

## Pruebas

- Vector oficial AEAT innegociable y nuevos vectores F1/F2.
- Concurrencia de numeración, cambio de año/serie/huso y destinatario incompleto.
- Fallos de DB y worker en cada frontera; reintentos y leases expirados.
- Autorización tenant A/B y validación HTTP.
- Recalcular cadena completa desde snapshots devuelve todas las huellas.

## Hecho cuando

- [ ] Tipo persistido, XML y huella usan el mismo F1/F2.
- [ ] Número, factura, tax lines y outbox son atómicos.
- [ ] Emisión y envío son idempotentes y reconciliables.
- [ ] API fiscal está autenticada, autorizada y validada.
- [ ] Suite oficial y de concurrencia pasa.

## STOP

- Falta decisión legal/funcional sobre serie, rectificativa o destinatario.
- El vector oficial cambia.
- No hay entorno AEAT de pruebas/certificado segregado.
- La reparación requeriría reescribir facturas ya emitidas: abrir procedimiento fiscal separado.

## Mantenimiento

Cambios en XML, huella o impuestos requieren vector de regresión, revisión fiscal y migración compatible; nunca parche manual de una factura.
