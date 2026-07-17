# Plan 022: Endurecer provisionado, actualización y cola de impresión

> **Instrucciones para el ejecutor**: estos flujos deben fallar de forma visible y recuperable. No borres `.nodo` ni uses otra base. Los tests de impresora deben usar adaptador falso salvo smoke físico supervisado.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/nodo/provisionar.mjs apps/nodo/actualizar.mjs apps/nodo/version.json apps/desktop/src/impresion.ts apps/nodo/pruebas`.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: L
- **Riesgo**: HIGH
- **Depende de**: 021
- **Categoría**: reliability / operations
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El bootstrap limita cada tabla a 5.000 y continúa tras fallos, pudiendo anunciar un nodo útil incompleto. El actualizador aplica migraciones y registra versión en pasos separados, mientras su rollback restaura ficheros pero no el esquema. La cola de impresión sobrescribe JSON directamente; un fichero corrupto se interpreta como cola vacía y existe una ventana de duplicado entre imprimir y persistir el dequeue.

## Evidencia actual

- `apps/nodo/provisionar.mjs:84`: `limit=5000` por tabla.
- `apps/nodo/actualizar.mjs:195-217`: aplica migraciones y después escribe versión, sin estado durable por fase.
- `apps/desktop/src/impresion.ts:24-38`: carga JSON y persiste con `writeFileSync` directo.
- `:70-88`: imprime y después elimina/persiste, sin identidad/ack durable del trabajo.

## Alcance

**Dentro**: bootstrap paginado/verificado, estado de updater por fases, compatibilidad y rollback seguro, cola durable/idempotente, pruebas de corte de energía.

**Fuera**: cambiar hardware ESC/POS, autoactualización de Windows completa, restauración fiscal automática sin aprobación.

## Git

- Rama: `codex/022-nodo-durable`
- Separar commits provisionado, updater e impresión para facilitar rollback.

## Pasos

### 1. Convertir provisionado en máquina de estados

Fases: preflight, esquema, datos paginados, verificación, listo. Descargar en páginas con orden estable, registrar progreso/checksum y reanudar. Un fallo deja estado `INCOMPLETO`, nunca éxito.

**Verifica**: >5.000 filas convergen; kill/reinicio continúa; conteo/hash final coincide con cloud.

### 2. Validar antes de publicar el nodo

Ejecutar constraints, RLS, RPC mínimas, tenant único y smoke de login/catálogo. El gateway no sirve TPV como listo hasta superar readiness.

**Verifica**: una tabla omitida, migration faltante o tenant incorrecto bloquean readiness con causa accionable.

### 3. Hacer el updater compatible y reanudable

Manifest firmado con versión mínima/máxima, hashes y migraciones. Registrar fase antes/después de cada acción. Back up de binarios/config y backup lógico compatible antes de DDL irreversible; preferir migraciones expand/contract.

**Verifica**: corte en descarga, extracción, migración y cambio de versión reanuda o vuelve a versión compatible sin mentir.

### 4. Definir límites reales del rollback

No prometer rollback de esquema si no existe down migration segura. Si DDL ya fue aplicado, restaurar binario solo si es backward-compatible; de lo contrario mantener nueva versión o restaurar backup mediante procedimiento explícito.

**Verifica**: matriz versión app↔schema impide arrancar combinaciones incompatibles.

### 5. Rehacer cola de impresión como journal

Asignar `job_id`, escritura atómica temporal+rename, backup del journal, validación de esquema y estados `ENCOLADO/ENVIANDO/IMPRESO/ERROR/INCIERTO`. No vaciar ante JSON corrupto; aislar y alertar. Dedupe por job en el dispatcher/impresora cuando sea posible.

**Verifica**: corte antes/durante/después del envío no pierde trabajos; estado incierto exige reconciliación y evita reimpresión silenciosa.

### 6. Añadir operación y retención

UI/estado muestra versión, fase, última copia, cola y errores redactados. Retener logs/journal con límite y exportación de soporte.

**Verifica**: soporte puede distinguir no enviado, posiblemente enviado e impreso.

## Pruebas

- Bootstrap grande, página repetida, respuesta truncada, 429 y reanudación.
- Updater con artefacto corrupto, firma inválida, disco lleno y migración fallida.
- Cola corrupta, dos procesos, disco lleno y kill en cada transición.
- Smoke físico opcional con una impresora, job marcado para no duplicar.

## Hecho cuando

- [ ] Provisionado no usa topes silenciosos y verifica completitud.
- [ ] Updater conoce su fase y compatibilidad app/schema.
- [ ] Rollback no promete deshacer DDL que no puede deshacer.
- [ ] Cola corrupta nunca equivale a cola vacía.
- [ ] Fallos de energía tienen tests reproducibles.

## STOP

- No hay espacio/backup verificado antes de migración irreversible.
- Una actualización rompe compatibilidad sin estrategia expand/contract.
- Se detecta cola corrupta con trabajos reales: preservar y pedir reconciliación.
- El test apunta a PostgreSQL 5432 o a otro proyecto Supabase.

## Mantenimiento

Cada release declara compatibilidad de esquema, recuperación y prueba de interrupción; cada trabajo físico lleva identidad durable.
