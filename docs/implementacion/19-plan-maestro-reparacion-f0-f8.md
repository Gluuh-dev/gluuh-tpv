# 19 — Plan maestro de implementación de la reparación F0–F8

> **Documento canónico de ejecución:** desarrolla el [plan definitivo F0–F8](../plan/14-plan-definitivo-reparacion-identidad-seguridad.md).
>
> **Estado:** listo para ejecutar por entregas; la primera entrega autorizada sigue limitada a F0 + diseño SQL revisable de F1.
>
> **Planificado sobre:** commit `4d11ee5`, 17-07-2026, con cambios sin commit ya presentes en el árbol de trabajo.
>
> **Base viva autorizada:** Supabase `gxcqihslbicrszgzudjs`, solo lectura hasta aprobación explícita de cada migración.
>
> **Postgres local autorizado:** exclusivamente `.nodo/pgdata`, puerto `55432`, base `gluuh`.

## 1. Cómo usar este documento

Este no es un único cambio grande. Es un programa de entregas pequeñas y verificables. Cada bloque:

1. se ejecuta en orden;
2. empieza comprobando drift y el árbol sucio;
3. reserva el siguiente número en `docs/estado/AHORA.md` solo si realmente va a crear una migración;
4. incorpora primero una prueba que falle o una evidencia reproducible del problema;
5. usa despliegue `expandir → backfill → cambiar callers → endurecer → retirar legado`;
6. se revisa antes de tocar Supabase;
7. termina actualizando tipos, pruebas, documentación y traspaso de sesión.

No se avanza de fase por haber escrito código: se avanza cuando se cumplen todos sus criterios de salida.

## 2. Reglas que ningún ejecutor puede reinterpretar

- `supabase/migrations/*.sql` es el esquema canónico. `apps/api/db/schema.sql` es documentación histórica y no se sincroniza.
- Nunca editar una migración histórica aplicada. `0105` y la parte de credenciales de terminal de `0107` quedan rechazadas; su retirada se hará con migraciones nuevas e idempotentes.
- No aplicar `0105–0107` a ciegas por no aparecer en el historial remoto.
- Toda tabla multiempresa lleva `tenant_id`, FK, índices con `tenant_id` primero, RLS y pruebas tenant A/B.
- Toda `SECURITY DEFINER` fija `search_path`, deriva identidad internamente, revoca `PUBLIC/anon/authenticated` y concede solo el mínimo rol necesario.
- Ausencia de cuenta, sesión, membresía, local, perfil o permiso significa **denegar**.
- El navegador nunca es autoridad para tenant, dispositivo, precio, impuesto, total, rol o permiso.
- No enviar a AEAT real durante desarrollo.
- Nunca tocar PostgreSQL 5432 ni otro proyecto Supabase.
- No mezclar una entrega de seguridad con refactor visual del TPV.
- Ante cualquier condición de STOP de este documento o de `plans/016–026`, detenerse y documentar; no improvisar.

## 3. Línea base y drift inicial

Antes de cada entrega:

```powershell
git status --short
git rev-parse --short HEAD
Get-Content -Raw docs/estado/AHORA.md
Get-Content -Raw docs/estado/TRAMPAS.md
```

El plan se escribió sobre `4d11ee5`, pero el árbol contiene cambios posteriores sin commit. Para cada bloque se debe ejecutar:

```powershell
git diff --stat 4d11ee5..HEAD -- <rutas-del-bloque>
git status --short -- <rutas-del-bloque>
```

Si una ruta está modificada por otra sesión, no se toca hasta reconciliar propietario y propósito del cambio.

Comandos globales de verificación:

| Propósito | Comando | Resultado esperado |
|---|---|---|
| Lint | `pnpm lint` | exit 0 o baseline previamente documentado que no crece |
| Tipos | `pnpm typecheck` | todas las tareas reales verdes |
| Tests | `pnpm test` | suite completa verde; nunca menos tests sin explicación |
| Build | `pnpm build` | exit 0 en clone/entorno limpio |
| Fiscal | `pnpm --filter @gluuh/core test` | vector oficial AEAT y resto verdes |

Los tests DB deben abortar antes de conectar si el destino no es `127.0.0.1:55432/gluuh`.

## 4. Orden de entregas

| Orden | Entrega | Prioridad | Depende de | Salida principal |
|---:|---|---|---|---|
| 0.1 | Contrato vivo, tipos UTF-8 y gate | P0 | — | F0 verificable, sin SQL remoto |
| 0.2 | Harness de migraciones y matriz base | P0 | 0.1 | esquema limpio reproducible en destino autorizado |
| 0.3 | Diseño SQL y rollout de identidad | P0 | 0.1–0.2 | DDL revisable de F1, todavía no aplicado |
| 1.1 | Cuenta global y membresías, expansión | P0 | F0 aprobado | tablas/columnas nuevas sin cambiar callers |
| 1.2 | Contexto de sesión tenant/local | P0 | 1.1 | sesión inequívoca por `session_id` |
| 1.3 | Asignación por local y permisos | P0 | 1.1–1.2 | perfiles/overrides por local, fail-closed |
| 1.4 | Cambio de callers, RLS, RPC y grants | P0 | 1.2–1.3 | aplicación usa el nuevo contexto |
| 1.5 | Contracción del modelo antiguo | P0 | canary F1 | `LIMIT 1` y unicidades antiguas fuera del camino activo |
| 2.1 | Alta pendiente, Titular e invitaciones | P0 | F1 | onboarding personal y recuperable |
| 2.2 | Contraseña temporal y cambio obligatorio server-side | P0 | 2.1 | Gluuh no conoce la clave definitiva |
| 2.3 | MFA, sesiones y recuperación | P0 | 2.1–2.2 | política cliente/Gluuh y revocación |
| 2.4 | Cuenta provisional offline | P0 | 2.1–2.3 | acceso limitado, siete días, un local |
| 3.1 | Orden de instalación y reserva | P0 | F2 | código largo con hash/estado/caducidad |
| 3.2 | Identidad criptográfica del nodo | P0 | 3.1 | nodo ligado a tenant/local sin `service_role` |
| 3.3 | Derechos de licencia y suspensión firmada | P0 | 3.2 | licencia separada de identidad y operación |
| 3.4 | Instalador Windows 11 y recuperación | P0 | 3.1–3.3 | instalación reanudable, BitLocker/HTTPS |
| 4.1 | Emparejado y credencial de dispositivo v2 | P0 | F1, F3 | token corto + renovación rotatoria |
| 4.2 | `safeStorage`, revocación y reinstalación | P0 | 4.1 | secreto fuera del renderer/localStorage |
| 4.3 | Operario activo, PIN y bloqueo por terminal | P0 | 1.3, 4.1 | trazabilidad humana separada del aparato |
| 4.4 | Retirada completa de `0105/0107` | P0 | 4.1–4.3 | sin credenciales conocidas ni RPC legacy |
| 5.1 | HTTPS, gateway y matriz LAN | P0 | F3–F4 | nodo no confía en la LAN |
| 5.2 | Media, SSRF e IPC mínimo | P0 | 5.1 | superficie local limitada y validada |
| 5.3 | Soporte, break-glass y backups cifrados | P0 | 5.1–5.2 | recuperación y soporte auditables |
| 6.1 | Comando de venta server-authoritative | P0 | F1, F4 | venta transaccional e idempotente |
| 6.2 | Cierre de escrituras monetarias directas | P0 | 6.1 | navegador sin autoridad sobre dinero |
| 6.3 | Emisión fiscal atómica | P0 | 6.1–6.2 | F1/F2, número, huella y tax lines coherentes |
| 6.4 | Outbox AEAT y API fiscal cerrada | P0 | 6.3 | envío durable, autenticado y apagado por defecto |
| 7.1 | Falso ACK desactivado y protocolo de comandos | P0 | F6 | ninguna operación desaparece en sync |
| 7.2 | Cursor compuesto, checkpoint y tombstones | P0 | 7.1 | transporte sin omisiones/duplicados |
| 7.3 | Conflictos, backoffice local y Gestión remota | P0 | 7.1–7.2 | offline-first completo por local |
| 8.1 | Provisionado/updater reanudables | P1 | F7 | nodo completo y compatible tras cortes |
| 8.2 | Impresión durable | P1 | F7 | journal con estados y `job_id` |
| 8.3 | CI Linux/Windows y pruebas adversariales | P1 | incremental desde F0 | gates obligatorios de invariantes |
| 8.4 | Rendimiento y deuda estructural medidos | P2 | 8.3, F6 | mejoras sin alterar seguridad/dinero |

El orden entre fases es estricto. Dentro de una fase solo se paraleliza trabajo sin rutas ni contratos compartidos.

## 5. Estrategia de migraciones

Los nombres siguientes son sufijos propuestos, no números reservados. Antes de crear cada fichero se consulta y reserva el siguiente número en `AHORA.md`.

| Fase | Migraciones propuestas | Propósito |
|---|---|---|
| F1 | `identidad_global_expand` | cuenta global y enlace nullable desde `app_user` |
| F1 | `contexto_sesion_tenant_local` | contexto por `session_id`, tenant, local y membresía |
| F1 | `asignacion_usuario_local_y_permisos` | perfil/estado/overrides por local |
| F1 | `endurecer_identidad_grants_rls` | funciones fail-closed, grants y políticas |
| F1 | `identidad_global_contract` | retirar índices/funciones antiguas tras canary |
| F2 | `invitaciones_y_alta_titular` | alta pendiente, invitaciones, titular y estados |
| F2 | `seguridad_cuenta_y_eventos` | cambio obligatorio, sesiones/eventos y recuperación |
| F3 | `orden_instalacion_y_nodo` | orden, reserva, nodo, clave pública y revocación |
| F3 | `derechos_licencia` | entitlements, límites, vigencias y suspensión firmada |
| F3 | `recuperacion_soporte_y_emergencia` | rescate, soporte y break-glass |
| F4 | `emparejado_y_credencial_dispositivo_v2` | intento, secreto rotatorio, revocación y scopes |
| F4 | `sesion_operario_y_bloqueo_pin` | operario activo e intentos por usuario/dispositivo |
| F4 | `retirar_credencial_dispositivo_legacy` | revocar/eliminar camino `0105/0107` de forma idempotente |
| F6 | `comando_venta_idempotente` | venta/pago transaccional y claves idempotentes |
| F6 | `restringir_escritura_monetaria` | contract phase de grants/policies monetarias |
| F6 | `emision_fiscal_atomica` | contador, factura, desglose, huella y snapshot |
| F6 | `outbox_aeat` | eventos, leases, reintentos y estados |
| F7 | `sync_cursor_ledger_y_tombstones` | cursores compuestos, ledger, checkpoints y bajas |
| F7 | `versionado_y_conflictos_sync` | versiones y resolución visible de conflictos normales |
| F8 | `impresion_durable` | completar `print_job`/journal si el diseño requiere DDL |

### Reglas de rollout SQL

- Una migración `expand` no elimina columnas, constraints ni funciones usadas.
- El backfill es idempotente, paginable y deja conteos verificables.
- Los constraints nuevos se validan después del backfill; cuando sea útil se crean `NOT VALID` y se validan en un paso separado.
- Un índice grande se crea de forma compatible con el entorno y con una ventana explícita.
- Una migración `contract` solo se escribe tras probar que ningún caller usa el legado.
- Nunca se mezcla limpieza de datos desconocidos con DDL sin preflight y aprobación.

## 6. Fase 0 — Contrato real del esquema

### 6.1 Entrega 0.1: tipos y contrato

**Plan detallado existente:** `plans/016-verificar-esquema-y-activar-tipos-supabase.md`.

**Archivos principales:**

- `supabase/types/database.types.ts`
- `packages/supabase/src/index.ts`
- `apps/web/app/lib/supabaseBrowser.ts`
- `apps/web/app/lib/supabaseServidor.ts`
- `apps/mobile/src/supabase.ts`
- factorías directas en `apps/web/app/api/**`
- `package.json`, CI y script nuevo de generación/check
- `supabase/README.md`

**Pasos:**

1. Capturar snapshot read-only de tablas, columnas, FKs, índices, funciones, owners, grants, RLS, policies e historial de migraciones.
2. Generar tipos mediante CLI fijada, a temporal, UTF-8 sin BOM y reemplazo atómico solo con exit 0.
3. Exportar tipo estricto y contrato transitorio; registrar qué consumidores siguen abiertos y por qué.
4. Inventariar `.from("...")` y `.rpc("...")` literales y fallar si no existen en el snapshot.
5. Marcar drift aceptado/no aceptado; `0105` no puede reaparecer por regenerar tipos.

**Aceptación:**

- dos generaciones producen el mismo hash;
- cero bytes nulos/BOM UTF-16;
- tabla/RPC literal ausente hace fallar el gate;
- todos los clientes principales derivan de `Database` o tienen excepción documentada;
- ninguna base modificada.

### 6.2 Entrega 0.2: harness de migraciones

**Archivos a crear:**

- `scripts/verificar-contrato-supabase.mjs`
- `scripts/verificar-migraciones-nodo.ps1` o equivalente seguro
- `apps/nodo/pruebas/prueba-esquema-limpio.mjs`
- fixtures mínimos de dos tenants sin datos personales
- job CI inicialmente manual y después obligatorio

**Guardas obligatorias:**

- host `127.0.0.1`;
- puerto `55432`;
- base `gluuh`;
- confirmación de entorno desechable antes de limpiar;
- nunca usar el nodo con datos reales como destino de reset.

Si no existe un nodo local desechable autorizado, se implementa el harness pero no se ejecuta el reset. Se documenta el bloqueo; no se crea otra base.

**Aceptación:** aplicar `0001–0110` desde cero produce un esquema inventariado; cualquier diferencia con cloud queda clasificada como histórica, rechazada o pendiente de migración reparadora.

### 6.3 Entrega 0.3: diseño SQL revisable de F1

Crear `docs/implementacion/20-diseno-sql-identidad-global.md` antes de cualquier migración. Debe incluir:

- DDL completo propuesto;
- consultas de preflight y backfill;
- matriz actor × tenant × local × rol;
- funciones nuevas y firmas;
- grants exactos;
- políticas RLS por tabla;
- orden expand/backfill/switch/contract;
- rollback lógico y condiciones de STOP;
- pruebas que fallan antes del arreglo.

**Puerta para F1:** aprobación humana explícita del diseño SQL y del tratamiento de duplicados históricos.

## 7. Fase 1 — Cuenta global, sesión activa y autorización

### 7.1 Modelo lógico objetivo

Los nombres definitivos se cierran en 0.3. El diseño debe representar, como mínimo:

- cuenta global ligada uno-a-uno a `auth.users`;
- `app_user` como membresía histórica de esa cuenta en un tenant, opcional para trabajadores solo locales;
- contexto por `session_id` con tenant, local y membresía activos;
- asignación `app_user`–local, perfil base, estado y vigencia;
- overrides individuales triestado `HEREDAR/PERMITIR/DENEGAR`;
- registro/revocación de sesiones;
- eventos de seguridad;
- personal Gluuh separado de clientes y dos Platform Owner conservados.

### 7.2 Entrega 1.1: expansión y backfill

**Rutas:** nueva migración; `supabase/types/`; script de preflight; pruebas DB.

1. Crear tablas y columnas nullable sin cambiar `current_tenant_id()`.
2. Contar duplicados/ambigüedades de `auth_user_id` y email sin exponer PII.
3. Backfill de cuentas/membresías en lotes, con ledger y conteos.
4. Añadir unicidades nuevas solo cuando el preflight sea limpio.

**STOP:** un `auth_user_id` corresponde a personas/empresas que no pueden resolverse automáticamente.

### 7.3 Entrega 1.2: contexto de sesión

**Rutas de código:**

- `apps/web/app/login/page.tsx`
- nuevo selector de empresa/local en `apps/web/app/**`
- `apps/web/app/(panel)/layout.tsx`
- `apps/web/app/lib/supabaseServidor.ts`
- helper nuevo de contexto server-side
- middleware/route handlers que necesiten tenant activo

El servidor registra/activa contexto usando el `session_id` verificado del JWT. El cliente puede solicitar una membresía/local de su lista, pero no aportar autoridad. Dos sesiones de la misma cuenta pueden elegir tenants distintos.

**Aceptación:** dos navegadores/sesiones simultáneas para tenant A/B no se pisan; cambiar local no modifica metadata global.

### 7.4 Entrega 1.3: asignación local y permisos

**Rutas:**

- `apps/web/app/lib/permisos.ts`
- `apps/web/app/(panel)/perfiles/**`
- `apps/web/app/(panel)/empleados/**`
- nuevas pantallas/asignaciones por local
- migración y pruebas RLS

Regla de precedencia:

1. identidad válida y activa;
2. asignación activa al local;
3. perfil del local;
4. override individual: `DENEGAR` gana; `PERMITIR` solo donde la política lo permita; `HEREDAR` usa perfil;
5. ausencia/error = denegar.

No usar `{}` como “todo permitido”. Propietario es una decisión explícita, no un fallback.

### 7.5 Entrega 1.4: funciones, RLS y callers

Integra `plans/017` y `plans/018`:

- `current_tenant_id()` usa contexto de sesión inequívoco;
- `operario_permite()` es fail-closed;
- jornada, heartbeat y demás `SECURITY DEFINER` se acotan;
- grants implícitos se revocan;
- el panel muestra `identidad incompleta` y no monta contenido privilegiado;
- toda mutación sensible tiene enforcement server/RLS.

**Pruebas obligatorias:** anónimo/autenticado/servicio × tenant A/B × local 1/2 × propietario/encargado/camarero/sin perfil/sesión revocada.

### 7.6 Entrega 1.5: contract

Tras canary y renovación de sesiones:

- dejar de consultar `app_user.auth_user_id` como identidad principal;
- retirar `LIMIT 1` de hooks/funciones;
- cambiar unicidades globales por cuenta+tenant;
- retirar hooks/metadata que decidan tenant;
- conservar compatibilidad histórica solo si queda un caller probado.

**Salida F1:** misma cuenta en dos empresas y dos sesiones simultáneas, cero cruce; todos los estados incompletos deniegan.

## 8. Fase 2 — Alta del Titular y cuentas administrativas

### 8.1 Entrega 2.1: alta pendiente e invitación

**Rutas:**

- `apps/web/app/api/admin/crear-empresa/route.ts`
- `apps/web/app/admin/**`
- nuevas rutas de invitación/aceptación en `apps/web/app/api/**`
- `apps/web/app/login/page.tsx`
- `apps/web/app/cambiar-password/page.tsx`
- migraciones F2 y tipos

Estados mínimos: `EMPRESA_PENDIENTE`, `INVITACION_EMITIDA`, `EMAIL_VERIFICADO`, `PASSWORD_CAMBIADA`, `PIN_TITULAR_CREADO`, `ACTIVA`, además de caducada/revocada.

El alta crea empresa, contrato y Titular pendiente; no genera todavía orden/código de nodo.

### 8.2 Entrega 2.2: contraseña temporal

- calidad y caducidad de siete días;
- verificación de email y contraseña por canales separados;
- secreto temporal cifrado con clave server-side y eliminado tras uso/caducidad/revocación;
- PDF generado en memoria/al vuelo, sin persistencia en Storage ni logs;
- `debe_cambiar_password` controlado por servidor, nunca por metadata editable por el cliente;
- Gluuh nunca puede leer la contraseña definitiva.

Si no existe gestión segura de claves para cifrar la temporal, STOP: no guardar plaintext ni inventar cifrado propio.

### 8.3 Entrega 2.3: MFA, sesiones y recuperación

- MFA opcional para clientes y obligatorio para cuentas Gluuh;
- TOTP compatible offline; passkey/TOTP para Gluuh;
- inventario y revocación de sesiones;
- cambio de contraseña revoca todas salvo la actual;
- invitación a cuenta existente añade membresía, no crea otra contraseña.

### 8.4 Entrega 2.4: administrador provisional offline

Solo tras una validación online inicial del nodo:

- máximo siete días;
- un tenant/local;
- sin cambiar identidad global, contrato, licencia, soporte o remoto;
- revocación sincronizada y auditoría;
- mensaje visible de provisionalidad/caducidad.

**Salida F2:** recorrido empresa pendiente → Titular activado, email verificado, clave cambiada, PIN creado; enlaces caducados/reusados/revocados fallan; solo entonces puede crearse una orden de instalación.

## 9. Fase 3 — Orden de instalación, nodo y licencia

### 9.1 Entrega 3.1: orden y código

Sustituir `tenant.codigo_instalacion` como autoridad por una orden independiente:

- tenant y local objetivo;
- hash del código, nunca código en claro persistente;
- estado, emisión, expiración 30 días;
- reserva atómica de 24 horas ligada a un intento/instalación;
- uso único, revocación y auditoría;
- solo personal Gluuh autorizado puede emitir/reemitir.

**Rutas:** admin Gluuh, `apps/web/app/api/instalacion/**`, instalador del nodo y migración F3.

### 9.2 Entrega 3.2: identidad del nodo

El instalador genera localmente par de claves. El canje entrega una credencial limitada a tenant/local y registra:

- `node_instance`/equivalente;
- clave pública, fingerprint, versión y plataforma;
- estado, revocación, último contacto y nodo reemplazado;
- nunca `service_role` global.

El código largo basta para instalar; no se pide email/contraseña del Titular.

### 9.3 Entrega 3.3: entitlements/licencia

Separar identidad del nodo de derechos comerciales:

- módulo, alcance empresa/local/dispositivo;
- modalidad, límites, inicio/fin y estado;
- 15 días de gracia;
- suspensión solo mediante orden firmada válida recibida;
- nodo aislado continúa operativo;
- tras suspensión: lectura, exportación y cierre de pendientes;
- reactivación online o código firmado.

### 9.4 Entrega 3.4: Windows 11, BitLocker y HTTPS

**Rutas:**

- `supabase/nodo/Instalar-Gluuh.ps1`
- `supabase/nodo/instalar-nodo.ps1`
- `supabase/nodo/instalador/**`
- `apps/nodo/provisionar.mjs`, gateway/web/estado
- pruebas PowerShell/VM

El instalador verifica Windows 11, BitLocker, espacio, reloj, permisos, almacén seguro y capacidad HTTPS. Cada fase persiste estado y puede reanudarse sin crear dos nodos.

Se crea `TPV 1` pendiente de emparejado, sin usuario ni contraseña conocidos.

**Salida F3:** código erróneo/caducado/reservado/reutilizado falla; corte reanuda; nodo robado se revoca sin afectar otros locales; smoke en VM limpia.

## 10. Fase 4 — Dispositivos, PIN y operario activo

### 10.1 Entrega 4.1: emparejado v2

Integra `plans/024-establecer-identidad-dispositivo-y-minimo-ipc.md`:

- intento de emparejado separado de `device`;
- seis dígitos, diez minutos, un uso, LAN y rate limit;
- access token corto con issuer/audience/scopes/jti;
- secreto de renovación rotatorio, hash server-side y revocación;
- gateway deriva tenant/device del token.

### 10.2 Entrega 4.2: almacenamiento seguro/reinstalación

Electron canjea desde main y guarda el secreto en `safeStorage`. El renderer solo conoce estado y access token efímero cuando lo necesita. Reinstalar crea un nuevo intento, recupera configuración autorizada y revoca la credencial anterior.

Manipular `localStorage`, `device_id`, módulo o tenant nunca cambia autoridad.

### 10.3 Entrega 4.3: operario y PIN

Modelo mínimo:

- una sesión de operario activa por terminal;
- PIN de 4–6 dígitos único en la empresa;
- temporal visible una vez y cambio obligatorio;
- intentos/bloqueo progresivo por trabajador y dispositivo;
- cambio rápido de operario sin reemparejar;
- acción monetaria/configurable registra operario, dispositivo, tenant, local y request_id;
- cuentas abiertas conservan autor por acción, no solo por cabecera.

Los perfiles/locales proceden de F1. Kiosco/pantalla se desbloquean con gesto + PIN personal autorizado.

### 10.4 Entrega 4.4: retirar legado

Después de inventariar y migrar terminales:

- retirar RPC/columnas de `0105` solo con migración idempotente nueva;
- eliminar semillas `Técnico/1212`, `admin/1111`, camareros y terminal por defecto;
- revocar tokens de 365 días y `DEVICE_JWT_SECRET` compartido cuando ya no haya callers;
- limpiar UI/documentación de usuario+contraseña de terminal;
- conservar evidencia/auditoría de migración, no contraseñas ni hashes innecesarios.

**Salida F4:** reinicio conserva emparejado pero pide humano; revocar un terminal no afecta a otro; PIN/bloqueos/auditoría funcionan en dos locales.

## 11. Fase 5 — Superficie local, soporte y recuperación

### 11.1 Entregas 5.1–5.2: nodo y Electron

Ejecutar en este orden:

1. `plans/023-cerrar-superficie-lan-y-media-del-nodo.md`;
2. pasos IPC/navegación de `plans/024`;
3. completar HTTPS local/certificados automáticos.

**Rutas:** `apps/nodo/gateway.mjs`, `estado.mjs`, `media.mjs`, `descargar-imagenes.mjs`, web local, `apps/desktop/src/main.ts`, `preload.ts`, instalador/firewall.

Health público solo vivo/versión compatible. Diagnóstico, media, administración, impresión y hardware requieren actor/credencial/scope explícito.

### 11.2 Entrega 5.3: soporte y break-glass

- soporte normal: aprobación, lectura inicial, dos horas, alcance visible;
- break-glass: MFA, motivo, máximo dos horas, aviso inmediato y revisión;
- nunca autorrenovable;
- auditar acción y datos consultados sin contraseñas/PIN/vídeo;
- soporte separado de Gestión remota.

### 11.3 Backups

- cifrado local antes de salir del nodo;
- kit de recuperación del Titular;
- custodia Gluuh auditada y segregada;
- pruebas de restauración, no solo de creación;
- nodo robado/restaurado no expone claves reutilizables.

**Salida F5:** matriz endpoint × actor verde desde otro host LAN; SSRF, DNS rebinding, traversal, body grande e IPC hostil bloqueados; restauración probada.

## 12. Fase 6 — Venta, caja y fiscalidad

### 12.1 Entrega 6.1: venta

Ejecutar `plans/019-hacer-atomica-e-idempotente-la-venta.md` sobre la identidad de F1/F4.

El comando acepta intención: productos/cantidades/modificadores, local/mesa seleccionables solo si autorizados, pagos y `client_id`. El servidor resuelve tenant, operador, producto, tarifa, impuesto, permiso y total.

Alta, líneas, estado, pagos y mesa se confirman en una transacción. Un reintento devuelve el mismo resultado; una clave igual con payload distinto se rechaza.

### 12.2 Entrega 6.2: cierre de escrituras

Solo después de migrar todos los callers:

- revocar INSERT/UPDATE directos de cliente sobre `sales_order`, `order_line`, `payment` y estados monetarios;
- mantener RPC estrechas;
- inventariar kiosco, comandera, importaciones y nodo antes del contract.

### 12.3 Entregas 6.3–6.4: fiscal

Ejecutar `plans/020-blindar-emision-fiscal-y-outbox-aeat.md`:

- serie/número serializados;
- F1/F2 coherente en snapshot, huella, XML y QR;
- invoice, tax lines y outbox atómicos;
- worker con lease/idempotencia/clasificación de errores;
- API Nest autenticada, autorizada, validada y CORS allowlist;
- feature flag apagado y entorno AEAT de pruebas segregado.

**Salida F6:** concurrencia de cobro y numeración verde; cero venta parcial; vector oficial AEAT verde; ningún envío real activado.

## 13. Fase 7 — Backoffice local y sincronización remota

### 13.1 Entrega 7.1: impedir pérdida inmediata

Ejecutar primero el paso 1 de `plans/021-reparar-sincronizacion-y-cursores.md`: `/sync/upload` responde 501/no disponible mientras no persista. El conector no borra cola ante ese estado.

### 13.2 Entrega 7.2: protocolo durable

- cursor `(updated_at, PK)` y orden total;
- lote + checkpoint en la misma transacción;
- ledger/idempotency key de nube;
- cuarentena visible;
- tombstones con retención/ack;
- ventas/fiscal viajan como comandos de F6, nunca upserts.

### 13.3 Entrega 7.3: conflictos y producto

- catálogo/configuración con versión y conflicto visible;
- identidad/seguridad usa el estado más restrictivo;
- propietario o permiso `Resolver conflictos` decide cambios normales;
- baja/revocación nunca resucita por backup antiguo;
- backoffice local administra íntegramente su local offline;
- central multi-local solo con Gestión remota;
- módulos desactivados conservan lectura/exportación/reactivación.

**Salida F7:** 2.501 filas con timestamp idéntico, kill antes/después de ACK, backup antiguo y edición concurrente pasan sin pérdida/duplicado/resurrección.

## 14. Fase 8 — Operación, CI y mejora estructural

### 14.1 Provisionado/updater/impresión

Ejecutar `plans/022-endurecer-provisionado-actualizacion-e-impresion.md`:

- provisionado paginado y verificado;
- readiness real;
- updater firmado y compatible app/schema;
- estado reanudable por fases;
- rollback honesto;
- journal de impresión con `job_id` y estados `ENCOLADO/ENVIANDO/IMPRESO/ERROR/INCIERTO`.

### 14.2 CI

`plans/025-instalar-gates-ci-y-pruebas-adversariales.md` empieza en F0 y se completa aquí:

- Linux: web/core/API/migraciones;
- Windows: Electron, paths, encoding, instalador, `safeStorage` con adapter de test;
- dos tenants/locales;
- auth/RLS, instalación, dispositivos, dinero, fiscal, sync, LAN, IPC y cortes;
- sustituir checks ficticios;
- artefactos/logs sin secretos.

### 14.3 Rendimiento/deuda

Solo después de gates críticos, ejecutar `plans/026-reducir-coste-panel-y-deuda-estructural.md`: medir, mover agregados, eliminar N+1, extraer fronteras puras del TPV y resolver paquetes placeholder. No rediseñar UI dentro de esta reparación.

**Salida F8:** clone limpio compila/prueba en Linux/Windows; migraciones desde cero; updater/provisionado/impresión sobreviven a fallos; mejoras de rendimiento tienen baseline y regresión.

## 15. Matriz mínima de pruebas obligatorias

| Dominio | Casos mínimos |
|---|---|
| Identidad | una cuenta, dos tenants, dos sesiones simultáneas; membresía revocada; sesión sin contexto |
| RLS | anon/auth/service × A/B × local 1/2 × roles; UUID ajeno; perfil/permiso ausente |
| Onboarding | invitación usada/caducada/revocada; email no verificado; cambio obligatorio; cuenta existente |
| Nodo | código erróneo/caducado/reservado/reutilizado; kill en cada fase; revocación y reemplazo |
| Dispositivo | replay/caducidad/rotación; revocar TPV2 sin TPV1; localStorage manipulado; reinstalación |
| PIN | temporal, cambio, unicidad, bloqueo trabajador/terminal, tarjeta perdida y override |
| LAN/IPC | endpoint×actor, SSRF, rebinding, traversal, body grande, sender/origen hostil |
| Venta | manipular precio/tenant/rol; doble cobro; fallo inyectado; reintento y pago mixto |
| Fiscal | F1/F2, 20 emisiones concurrentes, fallo en tax line, vector AEAT, outbox antes/después de HTTP |
| Sync | 2.501 misma fecha, PK compuesta, 429/500/timeout, kill antes/después de ACK, tombstone/backup |
| Operación | >5.000 filas, artefacto/firma inválida, disco lleno, cola corrupta y corte eléctrico |

## 16. Puertas de aprobación

Requieren aprobación humana separada:

1. diseño SQL de F1;
2. resolución de duplicados históricos de identidad;
3. primera migración local de F1;
4. aplicación de cada tanda en Supabase;
5. reglas comerciales exactas de licencia/suspensión;
6. política de propina/redondeo/pago parcial;
7. series, rectificativas y entorno fiscal;
8. limpieza destructiva de columnas/filas legacy;
9. activación de envío AEAT;
10. despliegue en primer cliente.

## 17. Condiciones globales de STOP

Detenerse si:

- el proyecto Supabase no es `gxcqihslbicrszgzudjs`;
- el Postgres local no es `127.0.0.1:55432/gluuh`;
- nube, tipos y preflight contradicen un supuesto del bloque;
- hay datos ambiguos que exigen decidir identidad/propiedad;
- una ruta en alcance pertenece a otra sesión activa;
- una migración requiere reescribir historia o borrar datos sin aprobación;
- no existe una vía de rollback/compatibilidad para un contract;
- una prueba crítica falla dos veces tras una corrección razonable;
- cerrar seguridad bloquearía venta offline sin política aprobada;
- se necesita un secreto/certificado real no segregado;
- el cambio fiscal afectaría facturas ya emitidas.

## 18. Criterio de finalización del programa

F0–F8 solo se considera terminado cuando:

- esquema limpio, nube y tipos convergen o todo drift está formalmente aceptado;
- una cuenta puede pertenecer a varias empresas sin sesión ambigua;
- tenant/local/rol/permiso/dispositivo/operario se derivan server-side;
- no quedan cuentas o credenciales conocidas de semilla;
- nodo y dispositivos tienen claves individuales, rotación y revocación;
- LAN, IPC, soporte y backups pasan pruebas adversariales;
- venta, pago, factura, huella y outbox son atómicos/idempotentes;
- sync no pierde, duplica ni resucita operaciones;
- CI Linux/Windows prueba migraciones, dos tenants y dominios críticos;
- documentación viva, `AHORA.md`, checklist y sesiones reflejan exactamente lo desplegado;
- ninguna migración o envío real queda aplicado solo “porque el código está listo”.

## 19. Estimación orientativa

Estimación para una persona, incluyendo pruebas y revisión, no calendario contractual:

| Fase | Esfuerzo orientativo |
|---|---:|
| F0 | 3–6 días |
| F1 | 3–5 semanas |
| F2 | 2–3 semanas |
| F3 | 3–5 semanas |
| F4 | 3–5 semanas |
| F5 | 2–4 semanas |
| F6 | 4–6 semanas |
| F7 | 5–8 semanas |
| F8 | 3–6 semanas |

La ruta completa es aproximadamente 25–42 semanas-persona. Puede acortarse con trabajo paralelo solo después de estabilizar contratos y evitando rutas compartidas. La prioridad no es la velocidad nominal: es no introducir una segunda fuente de verdad en identidad, dinero o fiscalidad.

## 20. Próximo bloque ejecutable

Continuar exclusivamente con F0:

1. terminar script de generación/check de tipos;
2. crear inventario de baseline cloud/migraciones/tipos;
3. preparar harness seguro 55432 sin ejecutarlo sobre datos reales;
4. escribir `20-diseno-sql-identidad-global.md` y matriz RLS;
5. presentar diff/documentos y pruebas fallidas esperadas;
6. esperar aprobación antes de reservar o crear `0111`.

