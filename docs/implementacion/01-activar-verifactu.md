# 01 — Activar VERIFACTU en el cobro

**Objetivo:** que cada cobro del TPV genere una factura simplificada **real**:
numerada por serie, con huella SHA-256 encadenada, QR de cotejo AEAT y persistida en
`invoice` — visible en el Visor VERIFACTU. Hoy todo el motor existe y está probado
contra el vector oficial de la AEAT; el TPV simplemente no lo llama
(`VERIFACTU_ACTIVO = false` en `apps/web/app/tpv/page.tsx:35`).

## Paso 0 (bloqueante) — Sanear la tabla `invoice`

`0001_init.sql` y `0022_facturacion.sql` definen `invoice` con columnas distintas y
`0022` usa `CREATE TABLE IF NOT EXISTS` (no-op si 0001 ya la creó). `/api/factura`
asume la forma de 0022 (`num_serie_factura`, `huella`, `huella_anterior`,
`estado_aeat`, `fecha_expedicion`).

> ⚠️ **CONFIRMADO contra la BD real (proyecto "Gluuh - tpv") el 02-07-2026** con
> sondas de solo lectura vía PostgREST: `invoice.serie`/`invoice.numero` existen
> (forma 0001) y `num_serie_factura`/`huella`/`huella_anterior`/`estado_aeat`
> **no existen**. La migración correctiva de abajo es obligatoria, no hipotética.

1. Comprobar la forma real en la BD (SQL Editor de Supabase):
   ```sql
   select column_name, data_type from information_schema.columns
   where table_name = 'invoice' order by ordinal_position;
   ```
2. Si faltan las columnas de 0022 → migración correctiva `00xx_invoice_consolidada.sql`
   con `ALTER TABLE invoice ADD COLUMN IF NOT EXISTS ...` (todas las de 0022), índice
   único por `(tenant_id, serie, numero)` o el equivalente que use `/api/factura`, y
   comentario explicando la consolidación. **No** tocar 0001/0022 ya aplicadas.
3. Probar `/api/factura` en local contra la BD saneada antes de seguir.
4. Actualizar el espejo `apps/api/db/schema.sql`.

## Paso 1 — Serie por terminal

- La serie de facturación no puede ser un valor de demo: leerla de `setting`
  (`modulo.FISCAL.serie`, ámbito DEVICE con fallback LOCAL/GLOBAL) usando el helper
  existente `apps/web/app/lib/settings.ts` (primer consumidor real del mecanismo).
- Valor por defecto al crear el tenant: serie `T1`. La página `(panel)/series` (CRUD
  genérico ya existente) pasa a ser la gestión visible de series.

## Paso 2 — Cablear el TPV

En `apps/web/app/tpv/page.tsx` (o en los componentes resultantes de la guía 02):

1. Eliminar la constante `VERIFACTU_ACTIVO` y el camino "modo prueba".
2. En el flujo de cobro (tras persistir las filas de `payment`): llamar a
   `POST /api/factura` con líneas, territorio, serie y datos del emisor (los datos
   fiscales del local ya se editan en `(panel)/ajustes`).
3. Con la respuesta (número, huella, QR): componer el ticket 80 mm con el QR real y
   la leyenda `VERI*FACTU` (constante `LEYENDA_VERIFACTU` de `@gluuh/core`), y quitar
   el sello "TICKET DE PRUEBA".
4. Si `/api/factura` falla, **el cobro no se pierde**: mostrar error, dejar el pedido
   en `POR_COBRAR` y permitir reintentar. Nunca imprimir ticket sin factura.
   (El endpoint ya reintenta ante colisión de numeración UNIQUE.)

## Paso 3 — Envío a la AEAT (segunda mitad de la tarea)

Hoy `/api/factura` persiste y encadena pero no remite. El envío vive en `apps/api`
(NestJS), que ya tiene el cliente mTLS (`fiscal/aeat.service.ts`):

1. Completar `aeat.service.ts`: **parsear la respuesta SOAP** (aceptado / aceptado con
   errores / rechazado + CSV de presentación) en vez de devolver `{status, body}` crudo.
   Reconfirmar URLs de endpoint y `SOAPAction` contra el entorno de pruebas (el
   comentario del fichero ya lo advierte). Requiere certificado FNMT (docs/15).
2. Registrar el resultado en `verifactu_record` (columnas de estado AEAT ya previstas).
3. Remisión asíncrona con reintentos: un worker simple en la API (intervalo + backoff)
   que toma facturas con `estado_aeat = 'PENDIENTE'`. La normativa admite remisión
   diferida; el cobro nunca espera a la AEAT.
4. La API necesita su primera capa de datos para leer/escribir `invoice`/
   `verifactu_record`: cliente `pg` directo con `DATABASE_URL` (ya previsto en
   `.env.example`). Sin ORM.

## Criterios de aceptación

- [ ] Cobrar en el TPV crea fila en `invoice` con número correlativo por serie y
      huella encadenada a la anterior del tenant.
- [ ] El Visor VERIFACTU (`(panel)/visor-de-verifactu`) verifica la cadena en verde
      tras N cobros desde el TPV.
- [ ] El ticket impreso muestra QR de cotejo y leyenda VERI*FACTU, sin sello de prueba.
- [ ] Cobro con red caída hacia `/api/factura` → pedido queda `POR_COBRAR`,
      reintentable, sin ticket impreso.
- [ ] (Paso 3) Una factura del entorno de pruebas AEAT llega a estado `ACEPTADO` en
      `verifactu_record` con su CSV guardado.
- [ ] `pnpm --filter @gluuh/core test` sigue en verde (el vector oficial es innegociable).
