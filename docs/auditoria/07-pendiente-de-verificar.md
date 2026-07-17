# 07 — Información pendiente de verificar

## Supabase cloud (`gxcqihslbicrszgzudjs`)

Estas comprobaciones deben ser **solo lectura** hasta aprobar un lote de implementación:

1. Columnas `device.usuario`/`clave_hash` y firmas/grants de `fijar_clave_dispositivo`/`verificar_clave_dispositivo` (drift `0105`).
2. Grants efectivos y owner de todas las funciones `SECURITY DEFINER`, especialmente jornada, heartbeat, auth, admin y fiscal.
3. RLS habilitada, políticas y roles por las 82 tablas; comparar contra migraciones.
4. Duplicados agregados de `app_user.auth_user_id` y usuarios sin perfil, sin mostrar PII.
5. Relaciones cross-tenant existentes antes de FK compuestas.
6. Índices finales, FK sin índice líder, `pg_stat_user_indexes`, bloat y slow queries.
7. Cardinalidad/tamaño por tabla y crecimiento de `sales_order`, `order_line`, `print_job`, auditoría/outbox.
8. Publicaciones y autorización Realtime con dos usuarios de tenants distintos.
9. Historial real de migraciones y por qué `0105` puede faltar entre `0104` y `0106`.
10. Configuración activa del custom access token hook.
11. Policies/objetos de Storage, límites y buckets reales.
12. Estado de Edge Functions: los tipos/migraciones no prueban su ausencia total en el proyecto remoto.

## Datos y operación

- Si existen facturas reales o solo datos de prueba; no recalcular huellas ni borrar duplicados sin decisión fiscal.
- Filas parciales: order sin líneas, COBRADA sin payment, invoice sin tax lines, múltiples invoices por order.
- Distribución de tenants/locales/dispositivos y tablas que superan los límites 200/1.000/5.000 del nodo.
- RPO/RTO contratado y restauración real más reciente.
- Puertos/firewall/ACL que expone el instalador en Windows.
- Consumidores reales de `/nodo/estado`, `/nodo/accion`, media local y API Nest.
- Política de rotación/revocación de tokens, certificados y cuenta de servicio.

## Rendimiento

- LCP/INP/CLS y bundle por ruta en hardware de bar objetivo.
- Número de requests y bytes en panel/TPV cloud y nodo.
- EXPLAIN con datos representativos para dashboard, `admin_uso_empresas`, ventas por jornada, sync e impresión.
- Límites de conexión/pool de Supabase y PostgreSQL local bajo terminales concurrentes.
- Lag, desconexiones y volumen de Realtime/SSE.

## Seguridad externa y normativa

- Auditoría de CVE/dependencias con una fuente actual y lockfile, no realizada en modo offline.
- XSD, endpoints, identidad de sistema y plazos AEAT vigentes antes de habilitar envío.
- Revisión legal RGPD: retención, exportación, derecho de acceso/supresión y datos locales.
- Firma de releases, custodia de clave offline y validación del actualizador.
- Threat model de red LAN, Electron, soporte remoto y pérdida física del mini-PC.

## Pruebas no ejecutadas

- `pnpm build` completo y build/empaquetado Windows.
- Instalación desde cero en máquina limpia.
- Suite manual de nodo contra el PostgreSQL permitido en 55432.
- Navegador/E2E, accesibilidad y terminal de baja gama.
- Impresión ESC/POS, cajón, visor, backup USB y restore.
- Caos/reconexión: corte durante cobro, sync, migración, update e impresión.

## Consultas read-only sugeridas al disponer de MCP

Usar preferentemente herramientas de metadatos (`list_tables`, advisors, funciones/policies) y SQL de catálogo no destructivo. No seleccionar filas de cliente salvo hipótesis imprescindible; utilizar `count`, `exists`, agrupaciones y IDs pseudonimizados. Guardar en la auditoría fecha, proyecto, consulta y resultado resumido; etiquetar entonces como **VS**.

## Criterio para cambiar una inferencia a hecho

- `0105 omitida`: solo tras comprobar columnas y firmas en cloud.
- “Índice ausente/lento”: solo tras catálogo final y, para lento, EXPLAIN/estadística.
- “Fuga Realtime”: solo con prueba de dos tenants y tokens reales de test.
- “Datos corruptos existentes”: solo con consulta agregada/preflight; el código demuestra posibilidad, no ocurrencia.
- “Endpoint explotable desde Internet”: la lectura demuestra exposición LAN/loopback; Internet requiere topología/firewall.
