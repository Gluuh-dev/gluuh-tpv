# 06 — Plan de migración y roadmap incremental

## Reglas de ejecución

- Una fase no autoriza la siguiente. Cada lote debe ser pequeño, aditivo, observable y reversible.
- Reservar el siguiente número de migración en `docs/estado/AHORA.md` antes de escribir SQL.
- Cloud primero y nodo después solo cuando la migración sea compatible; nunca activar writer nuevo antes del reader/schema.
- Preflight de datos antes de `NOT NULL`, `UNIQUE`, FK compuesta o revocar grants.
- No activar VERIFACTU/AEAT ni PowerSync como atajo.

```mermaid
flowchart LR
  F0["F0 Medición"] --> F1["F1 Seguridad"] --> F2["F2 Integridad"] --> F3["F3 Modularidad"] --> F4["F4 Rendimiento"] --> F5["F5 Offline"] --> F6["F6 Calidad"] --> F7["F7 Observabilidad/escala"]
```

## Fase 0 — Diagnóstico y medición

- **Objetivo/alcance:** cerrar NV críticos sin mutar producción: metadatos Supabase, grants/RLS, drift `0105`, cardinalidades/EXPLAIN seguros, Web Vitals/bundle y restore actual.
- **Cambios/orden:** 1) cargar MCP read-only; 2) consultas de catálogo/advisors; 3) regenerar tipos UTF-8; 4) baseline de navegador/nodo; 5) inventario de datos incoherentes agregado.
- **Dependencias/riesgos/impacto/complejidad:** acceso read-only / bajo / reduce incertidumbre / S–M.
- **Aceptación/pruebas:** checklist de 07 resuelto; tipos deterministas; métricas con fecha/hardware/dataset; ninguna lectura PII.
- **Despliegue/rollback:** solo docs/tooling local; eliminar instrumentación temporal si altera resultados.

## Fase 1 — Seguridad y aislamiento

- **Objetivo/alcance:** cerrar AUD-001, 002, 008, 009 y heartbeat antes de nuevas funciones.
- **Cambios/orden:** 1) revocar/validar RPC jornada y heartbeat; 2) backfill perfiles + fail-closed; 3) unicidad `auth_user_id`; 4) endurecer media/estado/acciones; 5) identidad de dispositivo transicional; 6) audit log de cambios críticos.
- **Dependencias/riesgos/impacto/complejidad:** preflight de perfiles/duplicados y auth nodo / bloqueo legítimo si se hace de golpe / crítico / L.
- **Aceptación/pruebas:** matriz dos tenants y roles; SSRF/path/body/CSRF; canje/heartbeat; servicio offline del propietario/camarero según política explícita.
- **Despliegue/rollback:** migraciones aditivas y funciones versionadas; compatibilidad dual de token; feature flag. Rollback de callers, no de protecciones públicas.

## Fase 2 — Integridad de datos

- **Objetivo/alcance:** una frontera durable para venta, pago, jornada y factura; resolver drift/tipos/FK.
- **Cambios/orden:** 1) tipos `Database`; 2) RPC crear/guardar/cobrar idempotente; 3) emisión fiscal transaccional F1/F2; 4) constraints únicos/FK compuestas por agregado; 5) numeración atómica; 6) reconciliador de parciales.
- **Dependencias/riesgos/impacto/complejidad:** F1, datos históricos, fiscal core / alto por dinero y constraints / crítico / L–XL.
- **Aceptación/pruebas:** inyección de fallo y concurrencia; doble click/replay; precios server-side; cero parcial; F1/F2 verificables; preflight limpio.
- **Despliegue/rollback:** shadow/dual-read, writer nuevo por flag, comparar resultados; constraints `NOT VALID`/validación progresiva cuando aplique; volver al writer anterior solo con fiscal desactivada.

## Fase 3 — Modularización

- **Objetivo/alcance:** extraer casos de uso del TPV/Plano sin cambiar UX ni comportamiento.
- **Cambios/orden:** contratos → servicio de cuentas → cobro → jornada → salas/reservas; route handlers delgados; archivar/etiquetar PowerSync y `schema.sql` no canónico.
- **Dependencias/riesgos/impacto/complejidad:** tests de caracterización de F2 / regresión de memoria muscular y closures / medio-alto / L.
- **Aceptación/pruebas:** snapshots no son suficientes: journey teclado/mesa/aparcar/cobrar; límites de imports; componentes con responsabilidad y API acotadas.
- **Despliegue/rollback:** extracción commit a commit, mismo DOM/contrato; flags de hook/servicio y revert limpio sin migración destructiva.

## Fase 4 — Rendimiento

- **Objetivo/alcance:** reducir waterfall/peticiones/carga DB con medición, no microoptimización.
- **Cambios/orden:** bootstrap identidad/contexto; agregados SQL; batch modificadores; invalidación/coalescing Realtime; límites de listados; presupuesto bundle/Web Vitals.
- **Dependencias/riesgos/impacto/complejidad:** F3 y baseline / RSC puede romper configuración nodo / alto UX / M–L.
- **Aceptación/pruebas:** objetivos de 04; EXPLAIN antes/después; mismo resultado funcional; prueba en hardware objetivo y cloud 4G simulado.
- **Despliegue/rollback:** endpoint/bootstrap nuevo paralelo; canary por ruta/tenant de prueba; volver a queries antiguas sin cambiar datos.

## Fase 5 — Offline-first

- **Objetivo/alcance:** cursores estables, outbox de ventas/fiscal, reconciliación, provisionamiento/update/impresión recuperables.
- **Cambios/orden:** 1) cursor compuesto; 2) outbox/idempotencia; 3) service account; 4) conflicto por clase de dato; 5) provisionamiento completo; 6) updater expand-contract; 7) cola impresión “al menos una vez” visible.
- **Dependencias/riesgos/impacto/complejidad:** F2, backups, nodo de laboratorio / pérdida silenciosa si cursor migra mal / crítico / XL.
- **Aceptación/pruebas:** >lote mismo timestamp, corte/replay, dos nodos/terminales, 24 h offline, reinstalación, restore y trabajos inciertos.
- **Despliegue/rollback:** cursor nuevo en paralelo y comparación; conservar marca anterior para rescan; rollout a un nodo de laboratorio, luego un bar piloto; forward-fix de esquema.

## Fase 6 — Calidad

- **Objetivo/alcance:** convertir las garantías anteriores en gates automáticos.
- **Cambios/orden:** lint verde; typecheck real de paquetes; DB efímera autorizada 55432; matriz RLS; contratos routes/RPC; Windows/PS5.1; E2E críticos; migración+tipos diff.
- **Dependencias/riesgos/impacto/complejidad:** fixtures deterministas / CI lento o mocks falsos / alto / M–L.
- **Aceptación/pruebas:** CI Ubuntu+Windows obligatorio; 0001–última aplica desde cero; suites adversariales y recuperación; cobertura enfocada en riesgos, no porcentaje vacío.
- **Despliegue/rollback:** una semana informativo con tickets, luego obligatorio; cuarentena solo con owner/fecha, nunca tests fiscales.

## Fase 7 — Observabilidad y escalabilidad

- **Objetivo/alcance:** operar flota, fiscalidad y sync con SLO, alertas y recuperación.
- **Cambios/orden:** esquema de eventos/redacción; correlation/context; métricas y dashboards; alertas; outbox AEAT; releases firmadas; restore por tenant; capacity plan/particionado cuando métricas lo justifiquen.
- **Dependencias/riesgos/impacto/complejidad:** fases previas y proveedor telemetry / PII y coste / alto / L.
- **Aceptación/pruebas:** SLO medidos; incidente simulado trazable; alerta de cola/heartbeat; restore trimestral; secreto/certificado por tenant; AEAT replay sin duplicado.
- **Despliegue/rollback:** sampling/canary y redacción antes de exportar; buffer local; apagar exporter sin afectar cobro.

## Primeros cambios recomendados tras autorización

1. **Lote S1:** migración correctiva de RPC jornada + heartbeat y tests adversariales.
2. **Lote S2:** perfiles fail-closed con preflight/backfill y panel que no cae a propietario.
3. **Lote S3:** endurecer medios y separar health/diagnóstico/acciones.
4. **Lote D1:** convertir/regenerar tipos UTF-8 y tipar las factorías, sin migrar aún toda la UI.
5. **Lote D2:** caracterizar cobro/factura y diseñar RPC transaccional/idempotente.

No empezar por dividir `page.tsx`: primero hay que capturar y cerrar los invariantes que hoy contiene.

## Puerta de salida global

La refactorización puede considerarse completada cuando:

- ningún rol/tenant ajeno puede leer o mutar por tabla, RPC, Realtime, Storage o diagnóstico;
- venta/pago/factura son atómicos, idempotentes y reconciliables;
- una caída en cada frontera no pierde datos confirmados;
- tipos/migraciones/DB convergen y CI lo demuestra;
- nodo instala, actualiza, revierte/forward-fix y restaura en máquina limpia;
- observabilidad detecta pendientes antes que el bar;
- VERIFACTU solo se activa tras validar F1/F2, outbox, certificados y endpoints vigentes.
