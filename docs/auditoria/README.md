# Auditoría técnica integral de Gluuh TPV

**Fecha de corte:** 17-07-2026
**Alcance:** monorepo completo, migraciones `0001`–`0110`, tipos Supabase recién generados y documentación vigente.
**Modo:** diagnóstico en solo lectura. No se modificó código ni se ejecutó SQL.

## Resumen ejecutivo

Gluuh tiene una base valiosa: monorepo coherente, TypeScript estricto, motor fiscal compartido con el vector oficial de AEAT, RLS multiempresa extendida, un nodo local operativo y pruebas reales de concurrencia/sincronización documentadas. La arquitectura local-first ya no es una idea: el nodo integra PostgreSQL, PostgREST, autenticación, Realtime, medios, web y gateway.

El sistema todavía **no está preparado para activar VERIFACTU ni para una primera instalación comercial sin una fase de endurecimiento**. Los bloqueos principales son:

1. Dos RPC `SECURITY DEFINER` de jornada aceptan UUID de otro tenant y conservan `EXECUTE` implícito para `PUBLIC`; permiten abrir/cerrar jornadas y leer el Z cruzado.
2. Los permisos operativos son fail-open. Un usuario autenticado sin perfil recibe permisos y el panel cae incluso a `PROPIETARIO` si falla la consulta de identidad.
3. El write-path de venta/factura no es atómico ni idempotente: puede dejar ventas cobradas vacías, facturas duplicadas o facturas sin desglose; las F1 se huellan actualmente como F2.
4. La sincronización usa marcas de agua solo temporales; lotes con el mismo timestamp o de más de 1.000 filas pueden perder cambios para siempre.
5. El nodo expone en LAN subidas de medios sin autenticación/límite y diagnóstico con PII/economía; la descarga de imágenes admite SSRF y escape de ruta.
6. La migración `0105` está en el repositorio y el código la invoca, pero sus columnas/RPC no aparecen en los tipos generados mientras sí aparecen `0106`–`0110`. La hipótesis más fuerte es que se omitió en Supabase; debe confirmarse por metadatos antes de actuar.

La recomendación no es una reescritura. Es una migración incremental que primero cierre aislamiento, dinero y fiscalidad; después estabilice sync/offline; y solo entonces divida los grandes componentes y optimice rendimiento.

## Estado de verificación

| Etiqueta | Qué significa en estos documentos |
|---|---|
| **VC** | Verificado directamente en código o migraciones. |
| **VT** | Verificado ejecutando tests/herramientas locales. |
| **VG** | Verificado mediante configuración versionada. |
| **VS** | Verificado directamente en Supabase mediante MCP. |
| **INF** | Inferencia explícita basada en evidencias. |
| **NV** | No verificable con el acceso disponible. |

En esta sesión no hubo herramientas Supabase MCP cargadas. El fichero `.mcp.json` sí configura el proyecto `gxcqihslbicrszgzudjs`, pero **no se hizo ninguna consulta remota**. Por tanto no hay hallazgos etiquetados como VS. Los tipos generados el 17-07-2026 se usan como snapshot de la API PostgREST, no como sustituto de una consulta de catálogo.

## Línea base ejecutada

| Comprobación | Resultado |
|---|---|
| `corepack pnpm typecheck` | **Pasa:** 12/12 tareas. Dos paquetes (`ui`, `api-client`) solo imprimen “typecheck pendiente”. |
| `corepack pnpm test` | **Pasa:** 91 tests (core 44, API 10, web 37). |
| `corepack pnpm lint` | **Falla:** 4 errores y 43 avisos. Tres errores de no-usados y `database.types.ts` detectado como binario. |
| Tipos Supabase | 82 tablas, 43 funciones, 0 vistas, 0 enums en `public`; PostgREST 14.5. |
| Codificación de tipos | UTF-16 LE con BOM; 263.994 bytes y 131.996 bytes nulos. |
| Uso de tipos generados | Ningún `createClient` está parametrizado con `Database`. |

## Cobertura documental obligatoria

| Entregable | Documento |
|---|---|
| 1–5. Resumen, arquitectura, módulos, dependencias, tecnología | [01-arquitectura-actual.md](01-arquitectura-actual.md) |
| 6–13. Supabase, datos, entidades, auth, RBAC, aislamiento y RLS | [02-supabase-multitenancy.md](02-supabase-multitenancy.md) |
| 14–24. Consultas, rendimiento, offline, Realtime, seguridad, pruebas, observabilidad, deuda, riesgos y decisiones | [03-hallazgos.md](03-hallazgos.md) y [04-operacion-y-calidad.md](04-operacion-y-calidad.md) |
| 25–26. Arquitectura objetivo y estructura modular | [05-arquitectura-objetivo.md](05-arquitectura-objetivo.md) |
| 27–29. Migración, roadmap y criterios de aceptación | [06-roadmap.md](06-roadmap.md) |
| 30. Información pendiente | [07-pendiente-de-verificar.md](07-pendiente-de-verificar.md) |

## Orden de lectura y decisión

1. Leer los hallazgos `AUD-001`–`AUD-010`.
2. Confirmar en metadatos de Supabase el estado de `0105`, grants efectivos y objetos RLS.
3. Autorizar, si procede, únicamente la **Fase 1 — Seguridad y aislamiento** del roadmap.
4. No activar `VERIFACTU_ACTIVO`, `/fiscal/enviar` ni `@gluuh/sync` antes de cumplir sus puertas de aceptación.

## Límites de la auditoría

- No se inspeccionaron registros personales ni datos de negocio.
- No se ejecutaron `EXPLAIN`, advisors, tamaños, cardinalidades, bloat o índices no usados: requieren metadatos/estadísticas vivas.
- No se validaron XSD, certificados ni endpoints AEAT contra fuentes regulatorias externas actuales.
- No se hicieron pruebas de carga, navegador visual, Electron real, impresora, instalación limpia ni restauración.
- Los archivos ya modificados por el usuario se preservaron y no forman parte de esta auditoría.
