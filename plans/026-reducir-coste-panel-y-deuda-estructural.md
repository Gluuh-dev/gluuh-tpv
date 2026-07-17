# Plan 026: Reducir coste del panel y deuda estructural sin reescribir el producto

> **Instrucciones para el ejecutor**: medir antes y después. Este plan va después de estabilizar dinero/fiscal/CI para no mover fronteras mientras cambian invariantes. Preservar cambios visuales del usuario en TPV.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/web/app/tpv apps/web/app/\(panel\) packages/ui packages/api-client docs README.md` y `git status --short` sobre esas rutas.

## Estado

- **Prioridad**: P2
- **Esfuerzo**: L
- **Riesgo**: MED
- **Depende de**: 019, 020, 025
- **Categoría**: performance / maintainability / docs
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El TPV concentra demasiadas responsabilidades en `page.tsx`; el panel carga y agrega ventas en cliente y algunas páginas repiten consultas por producto/modificador. Las fronteras `packages/ui`/`api-client` son placeholders. Documentación visible aún contradice decisiones vigentes (por ejemplo, esquema canónico o puerto), lo que induce reparaciones equivocadas.

## Evidencia actual

- `apps/web/app/tpv/page.tsx`: estado, catálogo, pedidos, cobro, plano, impresión y modales en un componente de miles de líneas.
- Dashboard del panel descarga datos de ventas para agregarlos en navegador en vez de pedir agregados acotados.
- Gestión de modificadores consulta relaciones repetidamente por producto (patrón N+1).
- `packages/ui` y `packages/api-client` tienen poco uso/checks reales.
- `README.md`/guías antiguas contienen referencias que no coinciden con `AGENTS.md` y `docs/estado` actuales; `apps/api/db/schema.sql` no es canónico.

## Alcance

**Dentro**: profiling, agregados del panel, eliminar N+1, extraer servicios/hooks puros del TPV, decidir packages placeholder y corregir documentación tocada.

**Fuera**: rediseño visual, migración masiva a Server Components, React Compiler sin medición, reescribir plano/kiosko/comandera.

## Git

- Rama: `codex/026-performance-estructura`
- PRs separados: consultas, extracción TPV, packages/docs.

## Pasos

### 1. Capturar presupuesto y trazas

Medir arranque TPV, interacción de cobro, requests/bytes del dashboard y modificadores, renders y bundle. Dataset representativo, dispositivo objetivo y umbrales P50/P95 documentados.

**Verifica**: perfiles reproducibles y baseline guardado como artefacto, no impresiones subjetivas.

### 2. Mover agregados al servidor/SQL

Crear vista/RPC tenant-scoped para métricas del dashboard con rango, zona horaria e índices verificados por `EXPLAIN (ANALYZE, BUFFERS)` en dataset sintético. Devolver solo agregados necesarios.

**Verifica**: mismos importes que fixture de ventas; filas/bytes y latencia disminuyen; RLS A/B pasa.

### 3. Eliminar N+1 de catálogo/modificadores

Traer relaciones en una consulta/batch y normalizar en memoria. Añadir índices solo con evidencia del plan de ejecución. Compartir loader donde TPV/kiosko/comandera tengan semántica idéntica, conservando diferencias intencionales de agotados.

**Verifica**: número de requests constante al crecer productos; comportamiento visual igual.

### 4. Extraer fronteras del TPV por dominio

Extraer primero funciones puras y hooks/servicios con tests: cuenta, comando de venta 019, impresión y sincronización de mesa. Mantener `page.tsx` como orquestador; no mover JSX de plano/modales que tenga cambios activos sin coordinación.

**Verifica**: characterization tests antes/después; no aumenta renders ni bundle; diff por extracción es behavior-preserving.

### 5. Resolver paquetes placeholder

Para `packages/ui`/`api-client`: o definir consumidores/contrato/checks reales, o retirar dependencia/configuración muerta. No crear abstracciones sin al menos dos consumidores reales.

**Verifica**: `rg` demuestra consumidores; Turbo ejecuta checks reales; build no cambia por alias huérfano.

### 6. Reconciliar documentación viva

Actualizar README/guías afectadas: migraciones canónicas, puertos reales, arranque nodo, proxy/rutas existentes y comandos verificados. Marcar documentos históricos como tales en vez de mantener dos verdades.

**Verifica**: todos los paths/comandos enlazados existen; búsqueda no presenta `schema.sql` como canónico ni 3100 como puerto desktop actual si ya no aplica.

## Pruebas

- Benchmarks before/after con tolerancia y dataset versionado.
- Fixtures de dashboard por territorio, zona horaria, descuentos y devoluciones.
- Request-count test para modificadores.
- Characterization de guardar/cobrar/mesa/impresión.
- Link/path/command check de documentación.

## Hecho cuando

- [ ] Dashboard no descarga ventas crudas para agregarlas.
- [ ] Modificadores no crecen en N+1.
- [ ] Las fronteras críticas del TPV tienen módulos puros y tests.
- [ ] Packages placeholder tienen propósito real o desaparecen.
- [ ] Documentación visible coincide con decisiones actuales.

## STOP

- No existe baseline o dataset representativo.
- La extracción coincide con cambios visuales no integrados del usuario.
- Un agregado cambia semántica fiscal/redondeo; usar core/019/020, no duplicar.
- La optimización exige migración amplia a RSC sin experimento aislado.

## Mantenimiento

Toda optimización conserva una métrica, un presupuesto y un test funcional; toda guía enlaza a una única fuente canónica.
