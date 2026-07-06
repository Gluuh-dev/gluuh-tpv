# 06 — Offline con PowerSync

**Objetivo:** el modelo confirmado en `docs/plan/06-decision-local-vs-cloud.md`:
sin internet el TPV sigue vendiendo con su copia local; al volver la red, todo se
vuelca a la nube; los cambios hechos online (backoffice desde casa) bajan solos al
TPV. "Online" es el canal de sincronización, no un requisito.

**Punto de partida real:** `packages/sync` ya tiene el `AppSchema` (6 tablas:
category, product, restaurant_table, sales_order, order_line, payment) y el
`GluuhConnector` (cola de escritura → `POST /sync/upload`). Lo que falta: la
instancia PowerSync, `@powersync/web` integrado en la web, el write-path real de la
API y la numeración offline. Regla nº1 de los docs del proyecto: **no construir el
sync a mano** — todo lo raro se resuelve dentro del patrón PowerSync.

## Fase 0 — Spike (2-3 d, decisión go/no-go)

Antes de comprometer fechas: cuenta en PowerSync Cloud conectada al Postgres de
Supabase (publicación lógica), sync rules mínimas por tenant, una página de prueba en
`apps/web` con `@powersync/web` que lea `product` offline y encole un insert. Si el
spike atasca > 3 días, replantear (la degradación aceptable está descrita en el plan
de la auditoría: desktop online-only con cola de impresión local).

## Fase 1 — Lectura offline en el TPV (1 sem)

1. Dependencia `@powersync/web` en `apps/web` (SQLite WASM + OPFS; requiere headers
   COOP/COEP en `next.config.mjs` para SharedArrayBuffer — verificar en el spike).
2. Sync rules (en PowerSync): bucket por `tenant_id` con las 6 tablas del schema +
   `room`, `plano_elemento`, `tenant_branding`, `setting` (ampliar `packages/sync`
   con estas tablas de lectura).
3. Endpoint de credenciales: route handler `api/powersync-token` que emite el JWT
   que PowerSync valida (claims `tenant_id`), usando la sesión Supabase o el token
   de dispositivo (guía 04). `GluuhConnector.fetchCredentials()` ya lo espera.
4. Provider en el layout del TPV (solo TPV y pantallas operativas; el backoffice
   sigue online-directo — no vale la pena sincronizar informes).
5. Sustituir las lecturas del TPV (carta, mesas, plano, branding) por queries a la
   BD local de PowerSync. El TPV pinta **siempre** desde local; la red solo alimenta
   la sincronización de fondo.

## Fase 2 — Escritura encolada (1 sem)

1. Escrituras del TPV (`sales_order`, `order_line`, `payment`, estado de mesa) pasan
   a la BD local; PowerSync las encola (`uploadData` del conector ya implementado).
2. **Write-path real** en `apps/api` `sync/sync.controller.ts` (hoy stub):
   - Validar JWT (tenant + device), aplicar ops con cliente `pg` en transacción.
   - Idempotencia por `client_id` (columna ya existente; `on conflict do nothing`).
   - Rechazo granular: una op inválida no tumba el lote (registrar y continuar);
     el conector solo hace `complete()` si la respuesta es ok — ya funciona así.
3. Indicador en la barra de estado (guía 05): "N operaciones pendientes de subir".

## Fase 3 — Numeración fiscal offline (3-4 d)

El único conflicto real de un TPV offline es el número de factura (diseño en
`docs/dossier/06-base-de-datos-y-sincronizacion.md`):

1. Tabla `number_range`: `tenant_id, device_id, serie, desde, hasta, siguiente`.
   Al conectar, cada dispositivo reserva un rango (RPC `reservar_rango(serie, n)`);
   cuando le quedan < 20%, reserva el siguiente.
2. Offline, `/api/factura` no es alcanzable → la factura se emite **localmente**:
   número del rango del dispositivo + huella encadenada local (la cadena por
   dispositivo se re-verifica al sincronizar). El cálculo (huella, QR) es
   `@gluuh/core` puro y corre en el cliente… **salvo `node:crypto`**: usar
   `crypto.subtle` (WebCrypto) — añadir a `@gluuh/core` una variante
   `calcularHuellaWeb` async o inyectar el hasher, con test contra el vector oficial.
3. Al volver la red: las facturas suben por la cola, la API las remite a AEAT
   (guía 01 paso 3). La normativa VERIFACTU contempla la remisión diferida.

## Riesgos y decisiones

- **Alcance contenido**: solo el TPV (y comandera en fase posterior). Kiosko/KDS/
  pantalla sin internet no tienen sentido (fase futura si acaso).
- **Conflictos**: inserciones inmutables (pedidos/pagos nunca se editan
  concurrentemente desde dos sitios) + LWW para catálogo — ya decidido en docs/06.
- **La pieza dura es la 3** (huella en cliente). Si se atasca: offline vende con
  "ticket pendiente de facturar" y la factura se emite al reconectar, numerada por el
  servidor — legalmente peor pero operativo; dejarlo como plan B explícito.

## Criterios de aceptación

- [ ] Con el wifi apagado: el TPV abre, muestra carta y mesas, toma comanda y cobra.
- [ ] Al volver la red, los pedidos/pagos aparecen en el backoffice sin duplicados
      (idempotencia verificada repitiendo el upload).
- [ ] Un cambio de precio hecho en el backoffice online aparece en el TPV < 30 s
      (online) y al reconectar (offline).
- [ ] Dos terminales del mismo local venden offline a la vez sin chocar numeración.
- [ ] La cadena VERIFACTU verifica en verde tras un día simulado con 2 cortes de red.
- [ ] `pnpm --filter @gluuh/core test` en verde con el hasher web añadido.
