# Plan 025: Instalar gates CI y pruebas adversariales de los invariantes críticos

> **Instrucciones para el ejecutor**: no “poner verde” ocultando errores o excluyendo rutas críticas. Introducir gates por etapas con baseline explícito. El PostgreSQL de integración usa siempre puerto 55432 y base `gluuh`.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- .github package.json pnpm-workspace.yaml turbo.json apps/*/package.json packages/*/package.json apps/nodo/pruebas`.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: M–L
- **Riesgo**: MED
- **Depende de**: 017, 018, 019, 021, 023
- **Categoría**: testing / CI / observability
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

La suite actual cubre core y algunos flujos web, pero no prueba de forma obligatoria aislamiento multi-tenant, RPC definer, atomicidad monetaria, cursores, updater, media o IPC. CI corre principalmente en Ubuntu; varios paquetes mantienen lint/typecheck placeholder. El lint actual no está limpio, así que los hallazgos nuevos pueden mezclarse con deuda conocida.

## Estado actual

- Workflow: install, lint/typecheck/test/build en Linux.
- Resultado auditado: typecheck 12/12 y 91 tests verdes; lint falla con 4 errores y 43 warnings.
- `packages/ui` y `packages/api-client` no aportan comprobación real.
- `apps/nodo/pruebas/` contiene scripts valiosos, pero no todos son herméticos ni gates CI.
- No hay suite obligatoria para dos tenants, concurrencia fiscal/sync, Electron Windows o migraciones completas.

## Alcance

**Dentro**: ESLint baseline/gate, checks reales por paquete, DB integration 55432, tests auth/dinero/sync/nodo/desktop, Windows CI, migración/type drift, artefactos y observabilidad mínima.

**Fuera**: perseguir 100% coverage, tests contra AEAT producción, comprar hardware para CI.

## Git

- Rama: `codex/025-ci-invariantes`
- Commits pequeños: baseline, DB harness, matrices, Windows/artefactos.

## Pasos

### 1. Fijar baseline honesto

Clasificar los 4 errores/43 warnings; corregir errores reales y registrar warnings con presupuesto decreciente por ruta. Sustituir scripts `echo` por checks reales o excluir paquete con motivo/fecha, nunca éxito ficticio.

**Verifica**: un error nuevo en archivo tocado falla CI; baseline no puede crecer.

### 2. Crear harness DB autorizado

Arrancar/restaurar exclusivamente Postgres del nodo en 55432 con DB `gluuh`, aplicar todas las migraciones desde cero y seeds mínimos de dos tenants. Aserción previa aborta si host/port/db no coinciden.

**Verifica**: esquema limpio aplica todas migraciones; apuntar a 5432 falla antes de conectar.

### 3. Convertir invariantes P0 en gates

Automatizar matrices de 017/018, atomicidad/idempotencia 019, fiscal 020 cuando esté listo, cursores 021 y LAN/media 023. Cada plan añade su test antes de marcarse DONE; 025 los agrupa y paraleliza con aislamiento.

**Verifica**: mutaciones deliberadas (regrant PUBLIC, fallback true, cursor timestamp-only) hacen fallar el test correcto.

### 4. Cubrir plataformas reales

Añadir Windows runner para Electron/nodo/paths/encoding y Linux para web/core/API. Cache pnpm/Turbo sin cachear secretos/estado DB. Tests hardware usan adapters falsos; smoke físico queda checklist release.

**Verifica**: traversal Windows, BOM UTF-16 y rename de journal se ejercitan en Windows.

### 5. Gates de esquema y artefacto

Comprobar orden/nombres de migración, tipos Supabase regenerados, ausencia de secretos, build empaquetable y compatibilidad version/schema. Guardar logs de fallo redactados y reportes de tests.

**Verifica**: migración duplicada, tipo drift y secreto fixture marcado fallan con mensaje útil.

### 6. Observabilidad comprobable

Estandarizar eventos con `request_id`, tenant/device pseudonimizados, estado y duración; nunca tokens/NIF/XML completo. Tests de redacción y alertas para sync atascado, factura sin enviar, updater incompleto y cola incierta.

**Verifica**: fixtures con secretos no aparecen en artefactos/logs.

## Pruebas

- CI desde clone limpio y dos ejecuciones para detectar dependencia de orden.
- Test mutation/manual de cada gate crítico.
- Jobs cancelados/reintentados no dejan DB compartida contaminada.
- Matriz Windows/Linux y Node/pnpm fijados por repo.

## Hecho cuando

- [ ] Ningún paquete crítico finge lint/typecheck/test.
- [ ] Migraciones completas y dos tenants son gate obligatorio.
- [ ] Seguridad, dinero, sync y nodo tienen regresiones adversariales.
- [ ] Windows cubre Electron/paths/encoding.
- [ ] Logs y artefactos no filtran secretos.

## STOP

- El harness intenta conectarse fuera de cloud autorizada o 55432/gluuh.
- Un test requiere credencial/certificado real no segregado.
- Para poner verde hay que desactivar una regla sin baseline/owner.

## Mantenimiento

Un plan P0 no se cierra sin prueba que falle antes del arreglo y quede en CI; el presupuesto de warnings solo baja.
