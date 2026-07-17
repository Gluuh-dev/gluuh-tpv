# 03 — Hallazgos priorizados

Todos los hallazgos están **abiertos** y no se corrigieron durante la auditoría. “Rollback” describe la estrategia futura, no una acción ejecutada.

## AUD-001 — RPC de jornada permite acceso cruzado entre tenants

- **Categoría / severidad / prioridad:** Seguridad, RLS, multi-tenant / **Crítica** / **Inmediata**.
- **Evidencia:** `supabase/migrations/0103_jornada.sql:105-145,232-299` crea `jornada_abierta` y `cerrar_jornada` como `SECURITY DEFINER`, acepta UUID, no compara el tenant y no revoca `PUBLIC`; ambas aparecen en los tipos (`:4250`, `:4330`). **VC**.
- **Elemento afectado / descripción:** jornada, caja Z y locales. PostgreSQL concede EXECUTE a PUBLIC por defecto; añadir un GRANT no lo retira.
- **Impacto / escenario:** con un UUID ajeno, anon/auth puede abrir o cerrar la jornada de otro negocio y obtener totales Z. Altera caja y trazabilidad fiscal.
- **Riesgo seguridad / pérdida / multi-tenant:** crítico / alto / crítico.
- **Recomendación:** revocar `PUBLIC, anon`; validar `tenant_id = current_tenant_id()` y rol para usuarios; separar firma interna service-role para el reloj del nodo.
- **Alternativa:** route handler server con service role. **Ventaja:** autorización central. **Desventaja:** añade disponibilidad de red al cierre; la RPC endurecida conserva mejor el modo local.
- **Complejidad / dependencias:** M / perfiles, auth nodo, pruebas de jornada y siguiente migración libre.
- **Criterios de aceptación / pruebas:** matriz anon/camarero/encargado/propietario/service con dos tenants; UUID ajeno siempre denegado; cierre automático local sigue idempotente.
- **Rollback:** desplegar función versionada compatible, conservar firma anterior solo revocada; revertir caller, nunca reabrir permisos públicos.
- **Pendiente:** confirmar grants/owner efectivos en cloud y nodo por metadatos.

## AUD-002 — Permisos fail-open permiten autoescalada

- **Categoría / severidad / prioridad:** Autorización/RBAC/RLS / **Crítica** / **Inmediata**.
- **Evidencia:** `0071_rls_permisos_escritura.sql:21-32` termina en `coalesce(..., true)`; `app_user.perfil_id` es nullable y empleados pueden nacer sin perfil; `0002_auth.sql:48-51` concede CRUD a authenticated. El panel usa `{}` como todo permitido y cae a `PROPIETARIO` si no llega `app_user` (`(panel)/layout.tsx:42-59`). **VC**.
- **Elemento afectado / descripción:** perfiles, usuarios, catálogo y menú. Un camarero sin perfil puede superar la política restrictiva y cambiar roles/usuarios dentro del tenant.
- **Impacto / escenario:** autoasignarse propietario, alterar catálogo/precios o habilitar acciones desde DevTools; un fallo transitorio de consulta muestra UI privilegiada.
- **Riesgo seguridad / pérdida / multi-tenant:** crítico / alto / medio (aislado inicialmente al tenant).
- **Recomendación:** backfill de perfil mínimo, `operario_permite` fail-closed, identidad no resuelta como error, autorización server-side por caso de uso.
- **Alternativa:** roles fijos sin perfiles JSON. **Ventaja:** simple. **Desventaja:** pierde personalización; el modelo híbrido actual es válido si el default es denegar.
- **Complejidad / dependencias:** L / inventario de acciones sensibles, continuidad offline y UX de errores.
- **Criterios de aceptación / pruebas:** matriz RBAC exhaustiva; perfil nulo/clave ausente no concede; solo propietario puede asignar roles; TPV mínimo sigue operativo offline con política explícita.
- **Rollback:** feature flag por mutación y perfiles de compatibilidad explícitos; no volver a `true` global.
- **Pendiente:** contar usuarios/perfiles nulos en metadatos/datos agregados sin exponer PII.

## AUD-003 — Venta, cobro y factura no comparten una transacción idempotente

- **Categoría / severidad / prioridad:** Integridad de datos/fiscal / **Crítica** / **Inmediata**.
- **Evidencia:** cuenta nueva inserta `sales_order` y después `order_line` (`tpv/page.tsx:1141-1159`); cobro inserta pagos aparte (`:1470-1501`); factura inserta cabecera y desglose en llamadas separadas y responde éxito aunque falle el desglose (`api/factura/route.ts:184-211,266-298`); no hay unicidad por `order_id`. **VC**.
- **Elemento afectado / descripción:** ventas, líneas, pagos, mesa, factura, numeración y huella.
- **Impacto / escenario:** venta COBRADA vacía, pago sin venta coherente, doble factura por reintento o factura sin desglose fiscal.
- **Riesgo seguridad / pérdida / multi-tenant:** medio / crítico / bajo.
- **Recomendación:** caso de uso/RPC transaccional con idempotency key, validación del estado cobrable, precios server-side, outbox fiscal y respuesta tras commit.
- **Alternativa:** saga con compensaciones. **Ventaja:** desacopla servicios. **Desventaja:** más estados y recuperación; para un único PostgreSQL la transacción es preferible.
- **Complejidad / dependencias:** L / tipos, RBAC, series, jornada, impresión y sync.
- **Criterios de aceptación / pruebas:** fallos inyectados en cada escritura no dejan parciales; doble petición devuelve el mismo resultado; una venta tiene como máximo una factura ordinaria; mesa solo se libera tras estado durable.
- **Rollback:** RPC nueva coexistente detrás de flag; volver al flujo anterior solo con VERIFACTU desactivado y sin migraciones destructivas.
- **Pendiente:** reconciliar filas parciales/duplicadas existentes antes de constraints.

## AUD-004 — Las facturas F1 se huellan como F2

- **Categoría / severidad / prioridad:** Fiscal/corrección / **Crítica** / **Inmediata antes de activar VERIFACTU**.
- **Evidencia:** `resolverDestinatario` deriva F1/F2, pero `encadenarRegistros` recibe `tipoFactura: "F2"`; después se persiste `dest.tipoFactura` (`api/factura/route.ts:91-101,158-168,184-205`). **VC**.
- **Elemento afectado / descripción:** huella VERIFACTU de facturas completas.
- **Impacto / escenario:** la fila dice F1, la huella representa F2 y el verificador/XML no concuerdan; posible rechazo regulatorio.
- **Riesgo seguridad / pérdida / multi-tenant:** bajo / crítico fiscal / bajo.
- **Recomendación:** usar el tipo resuelto en una única entrada fiscal persistida y añadir vector integral F1.
- **Alternativa:** prohibir F1 temporalmente. **Ventaja:** reduce alcance. **Desventaja:** no sirve a facturas completas y no elimina la deuda.
- **Complejidad / dependencias:** S / motor core y política para datos de prueba existentes.
- **Criterios de aceptación / pruebas:** F1 y F2 recalculan la misma huella desde fila/XML; vector oficial sigue verde; verificador de ruta pasa.
- **Rollback:** flag mantiene emisión desactivada; no recalcular silenciosamente documentos emitidos.
- **Pendiente:** confirmar que no existen documentos reales emitidos con este camino.

## AUD-005 — Escrituras monetarias y fiscales confiadas al navegador

- **Categoría / severidad / prioridad:** Seguridad e integridad / **Alta** / **Corto plazo**.
- **Evidencia:** authenticated conserva CRUD general; `order_line.precio_unitario/tipo_impositivo` y `payment.importe` se escriben directamente; la factura reconoce que usa el precio materializado por TPV (`api/factura/route.ts:136-143`). **VC**.
- **Elemento afectado / descripción:** precio, impuesto, total, pago y stock asociado.
- **Impacto / escenario:** un usuario autenticado modifica payloads en DevTools y genera venta/cobro/factura inconsistente dentro de su empresa.
- **Riesgo seguridad / pérdida / multi-tenant:** alto / alto / bajo.
- **Recomendación:** RPC server-side resuelve producto, tarifa, descuentos, impuesto y totales; revocar DML directo a tablas críticas.
- **Alternativa:** validar con triggers. **Ventaja:** cubre todos los writers. **Desventaja:** peor contrato/error y lógica compleja; útil como defensa adicional, no como caso de uso principal.
- **Complejidad / dependencias:** L / AUD-003, offline, permisos, migración progresiva de clientes.
- **Criterios de aceptación / pruebas:** payload manipulado no cambia precio/impuesto; servidor reproduce total; no hay DML directo authenticated en agregados monetarios.
- **Rollback:** grants temporales por función/tabla y dual-read; nunca reabrir globalmente sin alerta.
- **Pendiente:** inventariar todos los writers móvil/kiosko/importaciones.

## AUD-006 — Cursores de sincronización pueden saltarse cambios permanentemente

- **Categoría / severidad / prioridad:** Offline/sincronización / **Crítica** / **Inmediata antes de escalar datos**.
- **Evidencia:** subida pagina por `timestamp > marca`, ordena solo por timestamp y toma la fila 200; bajada limita a 1.000 sin orden y avanza al máximo (`apps/nodo/sincronizar.mjs:275-318,455-515`). `0101` puede asignar el mismo `now()` a muchas filas. **VC**.
- **Elemento afectado / descripción:** ventas/fiscal y catálogo nodo↔cloud.
- **Impacto / escenario:** más de un lote con timestamp idéntico o más de 1.000 cambios deja filas nunca revisitadas, sin error visible.
- **Riesgo seguridad / pérdida / multi-tenant:** bajo / crítico / medio.
- **Recomendación:** keyset cursor `(timestamp, PK)`, orden total estable, paginación hasta agotar y commit del cursor tras lote confirmado.
- **Alternativa:** outbox monotónica. **Ventaja:** semántica más fuerte. **Desventaja:** requiere cambiar todos los writers; es objetivo para ventas, cursor compuesto sirve como transición.
- **Complejidad / dependencias:** M / esquema de estado, claves compuestas e idempotencia.
- **Criterios de aceptación / pruebas:** 201/1.001 filas con igual timestamp se sincronizan; corte a mitad reintenta; duplicados no duplican venta/pago.
- **Rollback:** conservar cursores anteriores, permitir rescan desde marca segura y reconciliación completa controlada.
- **Pendiente:** medir cardinalidades y frecuencia real; no cambia la validez del defecto.

## AUD-007 — Provisionamiento y actualizaciones admiten éxito/rollback parciales

- **Categoría / severidad / prioridad:** Operación/recuperación / **Alta** / **Corto plazo**.
- **Evidencia:** provisionamiento limita 5.000, omite tablas fallidas y anuncia éxito (`provisionar.mjs:82-98`); migración y registro son operaciones separadas y el rollback restaura ficheros, no esquema (`actualizar.mjs:194-234`). **VC**.
- **Elemento afectado / descripción:** instalación de bar y actualización del nodo.
- **Impacto / escenario:** nodo arranca sin usuarios/productos o código antiguo vuelve sobre esquema nuevo; una migración se reaplica tras corte.
- **Riesgo seguridad / pérdida / multi-tenant:** medio / crítico / bajo.
- **Recomendación:** paginación completa, manifest de tablas obligatorias, invariantes de readiness, lock/backup verificado y migraciones expand-contract compatibles.
- **Alternativa:** imagen/appliance inmutable. **Ventaja:** despliegue reproducible. **Desventaja:** mayor infraestructura; no evita migraciones de datos.
- **Complejidad / dependencias:** L / instalador, backups, firma de releases y smoke de máquina limpia.
- **Criterios de aceptación / pruebas:** instalación falla claramente ante tabla obligatoria; corte en cada etapa recupera; restore probado; versión solo cambia tras healthcheck.
- **Rollback:** backup previo verificable y forward-fix de esquema; no prometer rollback SQL imposible.
- **Pendiente:** prueba real en máquina limpia, hoy bloqueada.

## AUD-008 — Superficie de medios del nodo permite SSRF, escape y DoS en LAN

- **Categoría / severidad / prioridad:** Seguridad nodo / **Crítica** / **Inmediata**.
- **Evidencia:** downloader acepta cualquier texto que contenga la marca, hace `fetch(url)` y resuelve el sufijo sin comprobar origen/contención (`descargar-imagenes.mjs:24-60`); POST media no autentica, no limita cuerpo/tipo y se publica por gateway `0.0.0.0` (`media.mjs:65-90`, `gateway.mjs:60-68,221-224`). **VC**.
- **Elemento afectado / descripción:** red interna, RAM, disco, `.nodo/media` y cola cloud.
- **Impacto / escenario:** URL de catálogo fuerza petición a recurso interno/escritura fuera de media; cualquier equipo Wi-Fi llena memoria/disco o sobrescribe assets.
- **Riesgo seguridad / pérdida / multi-tenant:** crítico / alto / bajo por nodo dedicado.
- **Recomendación:** origen/prefijo allowlist, contención tras decode, timeout/tamaño/MIME, escritura temporal+rename; POST con JWT/tenant y límites de stream.
- **Alternativa:** servir/subir medios solo mediante BFF Next. **Ventaja:** reutiliza auth. **Desventaja:** más carga y dependencia web; un servicio mínimo endurecido es viable.
- **Complejidad / dependencias:** M / compatibilidad Storage y migración de URLs antiguas.
- **Criterios de aceptación / pruebas:** SSRF, `..`, doble encode, symlink/reparse, cuerpo enorme y MIME falso se rechazan; subida legítima offline sigue en cola.
- **Rollback:** flag de solo lectura para medios; conservar originales/temporales y reactivar upload anterior solo en loopback durante soporte.
- **Pendiente:** revisar ACL/firewall del instalador.

## AUD-009 — Diagnóstico y acciones del nodo carecen de autenticación adecuada

- **Categoría / severidad / prioridad:** Seguridad/privacidad/CSRF / **Alta** / **Corto plazo**.
- **Evidencia:** `/nodo/estado` anónimo con CORS `*` devuelve CIF, contacto, caja, red y dispositivos (`gateway.mjs:103-109`, `estado.mjs:198-285`); acciones aceptan cualquier método y solo comprueban loopback (`gateway.mjs:117-138`). **VC**.
- **Elemento afectado / descripción:** PII, facturación diaria, topología, reinicio/actualización.
- **Impacto / escenario:** cualquier cliente LAN lee diagnóstico; una web abierta en el servidor provoca GET a localhost y reinicia/actualiza.
- **Riesgo seguridad / pérdida / multi-tenant:** alto / medio / bajo.
- **Recomendación:** health mínimo anónimo, diagnóstico con sesión/secreto; acciones solo POST con Origin/Host y token CSRF.
- **Alternativa:** panel solo Electron/IPC. **Ventaja:** no expone LAN. **Desventaja:** peor soporte remoto; health HTTP mínimo sigue útil.
- **Complejidad / dependencias:** S–M / servidor page y soporte.
- **Criterios de aceptación / pruebas:** CORS externo no lee PII; GET no muta; LAN sin auth recibe 401/403; health de watchdog sigue funcionando.
- **Rollback:** mantener endpoint legacy solo en loopback y detrás de flag durante transición.
- **Pendiente:** confirmar consumidores externos del endpoint.

## AUD-010 — Identidad de dispositivo firmada no gobierna la autorización

- **Categoría / severidad / prioridad:** Autenticación de dispositivo / **Alta** / **Corto plazo**.
- **Evidencia:** canje firma JWT con tenant/device/módulo, pero navegador guarda JSON editable y pantallas/heartbeat usan `device_id` sin verificar token (`api/dispositivos/canjear/route.ts:55-62`, `conectar/page.tsx:39-47`, `print-dispatcher.tsx:67-70`). `device_heartbeat` acepta anon. **VC**.
- **Elemento afectado / descripción:** KDS, estación, impresión, heartbeat y emparejado.
- **Impacto / escenario:** se suplanta otro terminal del tenant cambiando localStorage; la firma no protege decisiones y una pantalla sin sesión tampoco obtiene capacidad real.
- **Riesgo seguridad / pérdida / multi-tenant:** alto / medio / medio.
- **Recomendación:** verificar JWT en gateway/BFF, derivar identidad server-side, rotación/revocación y claims usados por RLS/RPC.
- **Alternativa:** sesión Supabase por dispositivo. **Ventaja:** integración RLS. **Desventaja:** ciclo de cuentas y secretos; un JWT propio corto y verificable es suficiente.
- **Complejidad / dependencias:** L / gateway, auth local, cloud y provisioning `0105`.
- **Criterios de aceptación / pruebas:** manipular device_id no cambia identidad; token revocado/expirado falla; heartbeat solo modifica su fila; módulo/estación se derivan del servidor.
- **Rollback:** aceptar temporalmente ambos tokens con auditoría; retirar localStorage como fuente tras migrar todos los módulos.
- **Pendiente:** confirmar/aplicar `0105` donde falte.

## AUD-011 — Drift probable: `0105` ausente del snapshot cloud

- **Categoría / severidad / prioridad:** Migraciones/operación / **Alta** / **Inmediata para verificar**.
- **Evidencia:** SQL `0105` define dos columnas y dos RPC; web/nodo las llaman; tipos generados no las muestran, pero sí muestran objetos `0106`–`0110`. **VC + INF**.
- **Elemento afectado / descripción:** alta/login de terminal por usuario/clave.
- **Impacto / escenario:** la ruta crea device, falla RPC con función no encontrada, limpia la fila y devuelve 500; nodo no valida la credencial.
- **Riesgo seguridad / pérdida / multi-tenant:** medio / bajo / bajo.
- **Recomendación:** consulta read-only de columnas/RPC/historial; si se confirma, reservar migración correctiva nueva o aplicar `0105` según política del proyecto; regenerar tipos en UTF-8.
- **Alternativa:** reemitir contenido como `0111`. **Ventaja:** historial claro e idempotente. **Desventaja:** duplica intención; preferible si no puede probarse aplicación histórica.
- **Complejidad / dependencias:** S / acceso MCP y coordinación con nodos.
- **Criterios de aceptación / pruebas:** metadatos contienen columnas/firmas/grants exactos; generar y verificar terminal; tipos diff limpios.
- **Rollback:** columnas aditivas no se eliminan; desactivar ruta de credenciales si la RPC falla.
- **Pendiente:** **todo el estado vivo**; no presentar la inferencia como VS.

## AUD-012 — Tipos generados no protegen el código y rompen lint

- **Categoría / severidad / prioridad:** Arquitectura/tooling / **Alta** / **Corto plazo**.
- **Evidencia:** tipos UTF-16 LE; ESLint “file appears to be binary”; no hay `createClient<Database>` ni import del fichero; abundan casts y `any`. Typecheck pasa porque el contrato no está incluido. **VC/VT**.
- **Elemento afectado / descripción:** clientes browser/server/mobile/shared y CI.
- **Impacto / escenario:** columnas/RPC renombradas compilan y fallan en el bar; CI rojo al versionar tipos actuales.
- **Riesgo seguridad / pérdida / multi-tenant:** medio / alto / medio.
- **Recomendación:** generar UTF-8 mediante comando reproducible, exportar `Database` desde paquete compartido y migrar factorías por fronteras.
- **Alternativa:** tipos manuales por dominio. **Ventaja:** contratos pequeños. **Desventaja:** drift; usar vistas/RPC tipadas encima del generado ofrece ambos beneficios.
- **Complejidad / dependencias:** M / resolver errores reales gradualmente.
- **Criterios de aceptación / pruebas:** lint/typecheck incluyen tipos; una columna/RPC inexistente falla compilación; regeneración produce diff determinista.
- **Rollback:** parametrizar clientes de uno en uno; aliases compatibles, sin edición masiva.
- **Pendiente:** decidir ubicación versionada y comando oficial.

## AUD-013 — `/sync/upload` reconoce como persistido lo que descarta

- **Categoría / severidad / prioridad:** Corrección/arquitectura / **Crítica latente** / **Inmediata antes de usar PowerSync**.
- **Evidencia:** controller solo cuenta operaciones y devuelve `ok`; connector llama `tx.complete()` ante cualquier 2xx (`apps/api/src/sync/sync.controller.ts:27-31`, `packages/sync/src/connector.ts:51-65`). No hay consumidores actuales. **VC**.
- **Elemento afectado / descripción:** segunda arquitectura offline `@gluuh/sync`.
- **Impacto / escenario:** al conectarla, cada mutación desaparece de la cola sin persistirse.
- **Riesgo seguridad / pérdida / multi-tenant:** medio / crítico / alto si no deriva tenant.
- **Recomendación:** devolver 501/503 hasta implementar write-path transaccional, allowlist, auth tenant e idempotencia; decidir una sola arquitectura offline.
- **Alternativa:** archivar/eliminar paquete. **Ventaja:** reduce confusión. **Desventaja:** pierde spike; marcarlo experimental y no publicarlo es suficiente.
- **Complejidad / dependencias:** S para cerrar; L para implementar / decisión arquitectónica.
- **Criterios de aceptación / pruebas:** stub nunca completa transacción; implementación prueba replay, duplicado, tenant ajeno y operación rechazada.
- **Rollback:** mantener paquete desconectado; 501 es rollback seguro.
- **Pendiente:** decisión explícita nodo/Postgres frente a PowerSync.

## AUD-014 — Electron concede demasiada autoridad al renderer

- **Categoría / severidad / prioridad:** Seguridad cliente/hardware / **Alta** / **Medio plazo**.
- **Evidencia:** origen HTTP editable recibe preload; bridge expone impresión, cajón, configuración, identidad y backup; IPC acepta objetos sin esquema; nombre de carpeta de backup permite `..` (`desktop/main.ts:117-129,181-219`, `preload.ts:11-29`, `backup.ts:16-29`). **VC**.
- **Elemento afectado / descripción:** filesystem, hardware y proceso main.
- **Impacto / escenario:** nodo suplantado, XSS o renderer comprometido usa capacidades físicas/escritura; backup sale del destino.
- **Riesgo seguridad / pérdida / multi-tenant:** alto / alto / bajo.
- **Recomendación:** preload por ventana y mínimo, allowlist de origen, validación runtime de IPC, nombre de backup generado en main y contención de rutas.
- **Alternativa:** servidor hardware local autenticado. **Ventaja:** separa Electron. **Desventaja:** nueva superficie de red; IPC endurecido es menor cambio.
- **Complejidad / dependencias:** M–L / emparejado nodo, visor e impresión.
- **Criterios de aceptación / pruebas:** origen no permitido no carga/obtiene bridge; payload inválido falla; visor no abre cajón/backup; rutas con `..` rechazadas.
- **Rollback:** conservar handlers legacy detrás de flag/origen exacto durante transición.
- **Pendiente:** prueba de explotación en build empaquetada y políticas Windows.

## AUD-015 — Gates automáticos no cubren los límites críticos

- **Categoría / severidad / prioridad:** Calidad/CI / **Alta** / **Corto plazo**.
- **Evidencia:** 91 unit tests pasan, pero no invocan cobro/factura/auth/RLS; nodo no es paquete del workspace y sus pruebas son manuales; CI solo Ubuntu; lint falla 4/43; `ui` y `api-client` simulan typecheck. **VT/VC**.
- **Elemento afectado / descripción:** regresión fiscal, multi-tenant, Windows, sync e instalador.
- **Impacto / escenario:** suite verde no detecta los defectos AUD-001–006; cambios PowerShell/Electron fallan solo en un bar.
- **Riesgo seguridad / pérdida / multi-tenant:** alto / alto / alto.
- **Recomendación:** suite de dos tenants sobre BD aislada autorizada, contratos de route handlers, fallos inyectados, job Windows y gates reales en todos los paquetes.
- **Alternativa:** E2E completo primero. **Ventaja:** gran cobertura. **Desventaja:** lento/frágil; priorizar pruebas de límites y luego pocos journeys.
- **Complejidad / dependencias:** M–L / fixture de Postgres/nodo sin tocar 5432 ni cloud productiva.
- **Criterios de aceptación / pruebas:** CI bloquea lint; aplica 0001–última; matriz RLS/RPC; cobro idempotente; cursores multi-lote; parseo PS5.1; restore smoke.
- **Rollback:** tests nuevos inicialmente informativos por una ventana corta, después obligatorios; nunca relajar tests fiscales existentes.
- **Pendiente:** diseñar entorno efímero respetando exclusivamente puerto 55432.

## Observaciones de deuda no elevadas a hallazgo independiente

- `tpv/page.tsx` y `PlanoSalas.tsx` concentran demasiadas responsabilidades; dividir solo tras caracterización.
- El backoffice crea un waterfall cliente y el dashboard agrega ventas en navegador; mover bootstrap/agregados a fronteras server/RPC.
- La ficha de producto hace N+1 de opciones y la copia no es atómica.
- `admin_uso_empresas` usa subconsultas correlacionadas y requiere medición/índice por fecha.
- Falta repetir el advisor de FK tras `0062`.
- Cola de impresión Electron ofrece como máximo entrega “al menos una vez”; debe modelar trabajos inciertos.
- Numeración `max(numero_pedido)+1` no es atómica ni única por local.
- Falta unicidad obligatoria de `app_user.auth_user_id` y FK compuestas por tenant.
- No hay error/loading boundaries de App Router ni observabilidad estructurada/trazas.
- README/DEPLOY/desktop/PowerSync contienen arquitectura obsoleta.
