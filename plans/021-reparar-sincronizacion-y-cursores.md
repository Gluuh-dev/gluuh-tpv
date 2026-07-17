# Plan 021: Reparar sincronización, cursores y write-path engañoso

> **Instrucciones para el ejecutor**: no mezcles los dos motores. Decide explícitamente si `packages/sync`/PowerSync se activa o queda deshabilitado. Prueba solo cloud autorizada y nodo `127.0.0.1:55432/gluuh`.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/nodo/sincronizar.mjs apps/api/src/sync packages/sync supabase/migrations apps/nodo/pruebas/prueba-sync*`.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: L
- **Riesgo**: HIGH
- **Depende de**: 016, 019
- **Categoría**: data-integrity / offline
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El sincronizador pagina por `updated_at` con límites fijos y avanza la marca hasta el último registro leído. Filas con la misma marca, lotes mayores que el límite o una fila omitida pueden quedar atrás para siempre. En paralelo, `/sync/upload` responde `estado: ok` sin persistir una sola operación, por lo que un conector puede vaciar su cola perdiendo escrituras.

## Evidencia actual

- `apps/nodo/sincronizar.mjs:455-459`: bajada `updated_at=gt...&limit=1000`, sin orden total.
- `:479-515`: subida ordenada solo por fecha y la marca avanza con todo lo leído.
- Consultas de foto/provisionado usan topes, por lo que borrados y catálogos grandes no tienen garantía de completitud.
- `apps/api/src/sync/sync.controller.ts:27-31`: acusa recibo y devuelve ok; el comentario admite que es esqueleto.
- `packages/sync/src/connector.ts`: revisar su criterio de ACK antes de habilitarlo.

## Alcance

**Dentro**: protocolo de cursor compuesto, paginación, checkpoints, conflictos, tombstones/borrados, idempotencia, deshabilitar o implementar `/sync/upload`, métricas y tests de caos.

**Fuera**: sustituir el motor por otro proveedor, sincronizar secretos/certificados, resolver automáticamente conflictos fiscales.

## Git

- Rama: `codex/021-sync-durable`
- Entregas: primero impedir falso ACK; después cursores; finalmente rollout.

## Pasos

### 1. Elegir un único write-path activo

Inventariar callers reales. Si PowerSync no está desplegado, `/sync/upload` debe responder 501/feature disabled y el conector no debe borrar cola. Si sí lo está, implementar auth, validación, idempotencia y aplicación transaccional antes de devolver 2xx.

**Verifica**: ningún endpoint devuelve éxito por operaciones no persistidas.

### 2. Versionar cursor estable

Usar cursor `(updated_at, primary_key)` y orden equivalente, con comparación lexicográfica y páginas hasta agotamiento. Para tablas con PK compuesta, serialización canónica. No usar solo `gt timestamp`.

**Verifica**: 2.501 filas con timestamp idéntico se sincronizan exactamente una vez en varias páginas.

### 3. Hacer atómico lote y checkpoint

Aplicar cada lote local y su checkpoint en la misma transacción; en nube, guardar ledger/idempotency key por lote. Una fila no resuelta bloquea/manda a cuarentena explícita y la marca no la salta.

**Verifica**: kill entre última fila y checkpoint reejecuta sin duplicar; fallo parcial no avanza.

### 4. Formalizar conflictos y borrados

Mantener LWW solo en catálogo no fiscal y con desempate determinista. Ventas/pagos/facturas usan comandos idempotentes de 019/020, no upsert genérico. Modelar tombstones con retención y ack por nodo.

**Verifica**: edición simultánea tiene ganador estable; una baja no resucita por un nodo atrasado.

### 5. Eliminar límites silenciosos

Paginar provisionado, foto remota, delta y snapshot. Comparar conteos/hashes por tabla después de bootstrap; si difieren, el nodo queda NO LISTO.

**Verifica**: dataset >5.000 por tabla converge y el segundo pase es no-op.

### 6. Observabilidad y despliegue canary

Exponer atraso, última marca, tamaño de cola, cuarentena y último error sin datos sensibles. Canary en un nodo, pausa segura y rollback que conserva cola/checkpoints.

**Verifica**: dashboard/estado detecta una cola atascada y nunca la presenta como sincronizada.

## Pruebas

- Timestamp repetido, PK compuesta, 1001/5001 filas y páginas vacías/intermedias.
- Red caída antes/después de ACK, proceso terminado, respuesta 429/500/timeout.
- Conflictos A/B, borrado offline, nodo restaurado desde backup antiguo.
- Operaciones monetarias duplicadas/manipuladas se rechazan por 019/020.

## Hecho cuando

- [ ] No existe ACK falso.
- [ ] Todos los listados usan paginación y orden total.
- [ ] Checkpoint no puede adelantar trabajo pendiente.
- [ ] Ventas/fiscal no pasan por upsert genérico.
- [ ] Bootstrap y sync prueban convergencia > topes históricos.

## STOP

- No se sabe qué motor está activo en producción.
- Una tabla carece de PK/updated_at fiable; crear migración específica primero.
- Hay conflictos fiscales históricos; no aplicar LWW.
- El nodo de prueba no es `.nodo/pgdata` puerto 55432.

## Mantenimiento

Toda tabla sincronizada declara PK, cursor, política de conflicto, borrado, autoridad y prueba por encima del tamaño de página.
