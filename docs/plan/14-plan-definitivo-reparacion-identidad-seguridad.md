# 14 — Plan definitivo de reparación de Gluuh TPV

> **Estado:** aprobado para ejecución por fases
>
> **Fecha de decisión:** 17-07-2026
>
> **Proyecto Supabase autorizado:** `gxcqihslbicrszgzudjs`
>
> **Regla de ejecución:** no aplicar migraciones remotas sin revisión y aprobación expresa. Las migraciones históricas no se reescriben.

Este documento es la referencia canónica del plan de reparación nacido de la auditoría técnica integral y de las decisiones sobre cuentas, instalación, nodo, dispositivos y operarios. Sustituye cualquier orden anterior que proponga empezar por la interfaz, por VERIFACTU o por el backoffice offline antes de estabilizar identidad y autorización.

La ejecución detallada, dividida en 34 entregas con migraciones propuestas, dependencias,
pruebas, puertas de aprobación y condiciones de parada, está en
[`docs/implementacion/19-plan-maestro-reparacion-f0-f8.md`](../implementacion/19-plan-maestro-reparacion-f0-f8.md).

## 1. Decisión principal

La primera reparación es la identidad y la seguridad de la base de datos. No se empieza rediseñando el login: el sistema debe poder demostrar primero qué empresa, cuenta, sesión, nodo, dispositivo y operario está actuando, y debe denegar ante cualquier identidad incompleta.

Orden obligatorio:

`F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8`

Las pruebas de CI comienzan en F0 y crecen en cada fase.

## 2. Diagnóstico confirmado

| Problema | Riesgo |
|---|---|
| La nube tiene 82 tablas, existen 110 migraciones locales y el historial remoto solo registra 35. `0105–0107` no constan aunque aparecen objetos parciales posteriores. | Aplicar migraciones supuestamente pendientes a ciegas puede duplicar objetos, romper datos o reintroducir diseños rechazados. |
| `database.types.ts` representa la nube, pero fue generado en UTF-16 y los clientes principales no usaban `Database`. | El código podía compilar invocando columnas o RPC inexistentes. |
| El código invocaba las RPC de credenciales de dispositivo de `0105`, ausentes en la base viva. | El alta por usuario/contraseña de terminal fallaba en ejecución. |
| `current_tenant_id()` y el hook seleccionan empresa con `LIMIT 1`; `app_user.auth_user_id` y el email son únicos globalmente. | Una misma persona no puede pertenecer correctamente a varias empresas y el tenant puede elegirse de forma arbitraria. |
| `operario_permite()` termina en `true`; el panel cae a Propietario/permisos completos ante errores. | Una identidad incompleta o un error de carga puede elevar privilegios. |
| Existen funciones `SECURITY DEFINER` ejecutables por anónimos, incluidas jornadas, heartbeat y semillas. | Mutaciones sin autenticación, cruce de tenants y creación de cuentas conocidas. |
| Permanecen semillas como `Técnico/1212`, `admin/1111` y camareros de ejemplo. | Acceso predecible en instalaciones que las conserven. |
| El código largo vive en `tenant`, es reutilizable y no representa local, nodo, caducidad ni reserva. | Copia del nodo, reutilización del código y activaciones sin trazabilidad. |
| El token de dispositivo dura un año, usa secreto compartido y se guarda desde la web. | Clonación de TPV, suplantación y revocación/rotación difíciles. |
| El bloqueo de PIN afecta a toda la empresa. | Un atacante puede bloquear a toda la plantilla desde un terminal. |
| Alta/cobro no son totalmente transaccionales y el navegador aporta precios y totales. | Ventas cobradas sin pago, duplicados y manipulación de importes. |
| La emisión fiscal tiene carrera de numeración, F1/F2 incoherente y persistencia no atómica. | Facturas, huellas o cadenas incorrectas y riesgo VERIFACTU. |
| `/sync/upload` puede responder éxito sin persistir y los cursores usan solo fecha. | Pérdida silenciosa de operaciones y filas omitidas de forma permanente. |
| Gateway, media, IPC, impresión y actualizador no están endurecidos ante una LAN hostil o cortes eléctricos. | SSRF, acceso a hardware, impresiones perdidas/duplicadas y nodos incompletos. |

Línea base previa: el typecheck pasaba en 12 tareas y había 91 pruebas verdes, incluido el vector oficial VERIFACTU. Dos paquetes tenían comprobaciones ficticias y faltaban pruebas obligatorias de RLS, autenticación, instalación, dispositivos, sincronización y concurrencia.

## 3. Modelo de identidad definitivo

Se separan nueve identidades:

1. **Cuenta global:** email, contraseña, MFA y sesiones personales.
2. **Membresía `app_user`:** representación histórica de la persona en una empresa; autor de ventas, cajas y jornadas.
3. **Asignación por local:** perfil base, excepciones y estado en cada local.
4. **Sesión activa:** empresa y local elegidos para una sesión concreta.
5. **Nodo:** identidad criptográfica de una instalación y local.
6. **Dispositivo:** TPV, comandera, KDS, kiosco o pantalla emparejada.
7. **Operario activo:** trabajador que usa un dispositivo en ese momento.
8. **Integración:** identidad técnica limitada, preparada sin API pública inicial.
9. **Personal Gluuh y soporte:** cuentas personales separadas de cualquier cliente.

Una sesión cloud se vincula a un tenant mediante el `session_id` de Supabase y una tabla de contexto validada contra la membresía. La misma cuenta puede mantener sesiones simultáneas en empresas diferentes sin `LIMIT 1` ni mutar metadatos globales.

## 4. Fase 0 — Contrato real del esquema

**Prioridad:** P0.  
**Aporta:** una única verdad comprobable antes de escribir SQL.

### Trabajo

- Contrastar objetos, columnas, índices, funciones, grants, RLS y políticas entre nube, migraciones y tipos.
- Documentar una línea base de la nube hasta `0110`; no reescribir migraciones históricas.
- Marcar `0105` y la parte usuario/contraseña de `0107` como diseño rechazado.
- Convertir `database.types.ts` a UTF-8, generar tipos de forma reproducible y conectarlos a los clientes Supabase.
- Crear un gate que aplique migraciones desde cero únicamente en el Postgres autorizado `.nodo/pgdata`, puerto `55432`, base `gluuh`, y compare el resultado con el contrato esperado.
- Reservar en `docs/estado/AHORA.md` el número de cualquier migración reparadora justo antes de crearla. El candidato observado es `0111`, pero debe comprobarse entonces.

### Afecta

- `supabase/migrations/`
- `supabase/types/`
- `packages/supabase/`
- factorías Supabase de web y móvil
- scripts de verificación y CI

### Aceptación

- Ninguna tabla o RPC literal usada por código queda ausente del contrato sin una retirada explícita del flujo.
- Generación determinista y UTF-8.
- Esquema limpio y nube convergen funcionalmente o sus diferencias aceptadas están inventariadas.
- `apps/api/db/schema.sql` no se usa como fuente canónica.

### Pruebas

- Gate de codificación/hash de tipos.
- Inventario estático de tablas/RPC usadas por el código.
- Migraciones desde cero en destino autorizado y desechable.
- Comparación de esquema final y snapshot esperado.

## 5. Fase 1 — Identidad global, tenant activo y autorización cerrada

**Prioridad:** P0.  
**Depende de:** F0.  
**Aporta:** aislamiento real entre empresas y permisos explicables.

### Migraciones lógicas

- Cuenta global enlazada de forma única a `auth.users`.
- Enlace opcional de `app_user` a la cuenta global; los trabajadores locales pueden no tener email.
- Retirar unicidad global de `app_user.email/auth_user_id`; nueva unicidad por cuenta y empresa.
- Contexto de sesión por `session_id`, cuenta, tenant y local activo.
- Asignación `app_user`–local con perfil base y excepciones `HEREDAR/PERMITIR/DENEGAR`.
- Titular contractual, invitaciones, sesiones y eventos de seguridad.
- Roles del personal Gluuh y obligación de conservar dos Platform Owner.
- Reparación de `current_tenant_id()`, `operario_permite()`, grants y funciones privilegiadas.

### Interfaz

- Listar solo las membresías de la cuenta autenticada.
- Seleccionar empresa/local validando membresía y recordar el último destino.
- Revocar sesiones individuales.
- Toda autorización sensible se decide en servidor/RLS; la UI solo representa el resultado.

### Aceptación y pruebas

- Un email pertenece a dos empresas y mantiene dos sesiones simultáneas sin cruce.
- Usuario, perfil, permiso o sesión incompletos siempre deniegan.
- Propietario ve todos sus locales; los demás solo los asignados.
- Matriz `anónimo/autenticado/servicio × tenant A/B × rol`.
- Ninguna función privilegiada conserva `EXECUTE` implícito.

## 6. Fase 2 — Alta del propietario y cuentas administrativas

**Prioridad:** P0.  
**Depende de:** F1.  
**Aporta:** onboarding seguro y recuperable.

- `admin.gluuh.com` es exclusivo para personal Gluuh.
- `app.gluuh.com` siempre ofrece cuenta, seguridad, contrato, facturas, órdenes y soporte; el backoffice remoto depende del módulo contratado.
- Gluuh crea empresa y Titular con email personal.
- Contraseña temporal robusta, válida siete días y con cambio obligatorio.
- Verificación de email y contraseña temporal por canales separados.
- Contraseña temporal cifrada solo para entrega; PDF al vuelo y eliminación tras uso, caducidad o revocación.
- `debe_cambiar_password` pasa a estado controlado por servidor.
- Usuarios adicionales reciben invitación personal; una cuenta existente acepta una nueva membresía sin contraseña nueva.
- Cambiar contraseña revoca todas las sesiones salvo la actual.
- MFA opcional para clientes y obligatorio para Gluuh; TOTP offline y passkey/TOTP para Gluuh.
- Administradores locales usan email/contraseña; el PIN es para operativa.
- Primer acceso offline exige validación online previa por nodo.
- Cuenta administrativa provisional offline: máximo siete días, un local y sin autoridad sobre identidad, contrato o remoto.

### Aceptación

- Recorrido completo desde empresa pendiente hasta Titular activado.
- Enlaces/contraseñas caducados, reutilizados o revocados fallan.
- Gluuh nunca puede consultar la contraseña definitiva.
- No se genera código de nodo hasta activar cuenta, contraseña y PIN del Titular.

## 7. Fase 3 — Orden de instalación, nodo y licencia

**Prioridad:** P0.  
**Depende de:** F1–F2.  
**Aporta:** cada nodo representa una instalación controlada.

### Migraciones

- Orden de instalación por empresa y local.
- Código almacenado mediante hash, estado, caducidad de 30 días y reserva de 24 horas.
- Instancia de nodo con estado, versión, clave pública, revocación y último contacto.
- Derechos de licencia/módulo independientes, límites y vigencias.
- Códigos firmados de rescate y reactivación.
- Sesiones de soporte, consentimiento y emergencia.

### Flujo

- Solo Gluuh emite el código largo; el instalador pide únicamente ese código.
- El primer intento lo reserva para la misma instalación durante 24 horas.
- El nodo genera su par de claves y canjea el código por una credencial limitada a tenant/local.
- El nodo nunca recibe `service_role` de la plataforma.
- Primera versión certificada solo para Windows 11, BitLocker activo, almacén seguro y HTTPS local automático.
- Se crea `TPV 1` pendiente de emparejado, nunca un usuario `tpv1` con contraseña.
- Sustituir nodo requiere intervención Gluuh, revocación del anterior y conservación/restauración de datos.

### Licencia

- Derechos flexibles: suscripción, anual, financiación o permanente.
- Gestión remota contratada por empresa con límites.
- Sin Internet continúa toda la gestión del negocio; tras 30 días solo se protegen identidad, contrato, licencia y soporte.
- Impago: 15 días de gracia y suspensión confirmada por Gluuh; después, solo lectura, exportación y cierre de pendientes.
- Reactivación online o mediante código firmado.
- Baja definitiva: 90 días de exportación y después retención exclusivamente legal.

### Aceptación

- Código incorrecto, caducado, reservado por otro equipo o reutilizado falla.
- Un corte reanuda sin crear dos nodos.
- Un nodo robado se revoca sin afectar otros locales.
- Prueba en VM Windows 11 limpia, cifrada y sin credenciales preinstaladas.

## 8. Fase 4 — Dispositivos, PIN y operarios

**Prioridad:** P0.  
**Depende de:** F1 y F3.  
**Aporta:** separación real entre aparato y trabajador.

### Migraciones

- Intento de emparejado separado del dispositivo.
- Credencial renovable/revocable por dispositivo.
- Sesión de operario por terminal.
- Intentos y bloqueos por trabajador/dispositivo.
- PIN temporal con cambio obligatorio.
- Asignación por local, perfil y excepciones.

### Comportamiento

- Autodescubrimiento, última dirección e IP manual.
- Código de seis dígitos, diez minutos, un uso y solo LAN.
- Credencial Electron en `safeStorage`, nunca `localStorage`.
- Access tokens cortos y renovación con secreto rotatorio; eliminar JWT compartido de 365 días.
- Reinstalación recupera identidad, caja, impresoras y nombre mediante nuevo emparejado y revoca la credencial anterior.
- PIN de 4–6 dígitos único en la empresa.
- PIN temporal visible una sola vez y cambio obligatorio antes de operar.
- Bloqueo progresivo solo para trabajador/terminal.
- Un operario activo por TPV y cambio rápido con PIN.
- Cuentas abiertas conservan trazabilidad por acción.
- Perfiles seguros de referencia, biblioteca de empresa, un perfil por local y excepciones individuales.
- Kioscos/pantallas se desbloquean con gesto y PIN personal autorizado.
- No crear usuarios técnicos ni trabajadores de ejemplo.

### Aceptación

- Reiniciar no obliga a emparejar de nuevo, pero sí a identificar al humano.
- Revocar `TPV 2` no afecta a `TPV 1`.
- Manipular almacenamiento del navegador no cambia tenant, dispositivo ni módulo.
- PIN erróneo, tarjeta perdida, cambio de perfil y override de encargado quedan auditados.

## 9. Fase 5 — Superficie local, soporte y recuperación

**Prioridad:** P0 antes del primer cliente.  
**Depende de:** F3–F4.  
**Aporta:** el nodo deja de confiar en cualquier equipo de la LAN.

- HTTPS local y certificados instalados/renovados automáticamente.
- Health público mínimo; estado y acciones detalladas requieren identidad.
- Cerrar media, rutas, límites, SSRF, CORS, CSP y acciones administrativas.
- Reducir IPC de Electron a capacidades mínimas y validar origen, argumentos y rutas.
- Soporte separado de Gestión remota: lectura inicial, aprobación del cliente y duración normal de dos horas.
- Break-glass máximo dos horas, motivo, MFA, aviso inmediato y revisión; sin renovación automática.
- Auditar acciones y datos consultados; nunca contraseñas, PIN ni vídeo por defecto.
- Backups cifrados con kit del Titular y custodia Gluuh auditada.

### Pruebas

- Matriz endpoint × actor desde otra máquina de LAN.
- DNS rebinding, SSRF, traversal, bodies grandes e IPC hostil.
- Robo/restauración de nodo y backup sin exponer claves.

## 10. Fase 6 — Venta, caja y fiscalidad

**Prioridad:** P0.  
**Depende de:** autorización estable de F1 y F4.  
**Aporta:** dinero y fiscalidad controlados por servidor.

- Ejecutar los planes técnicos 019 y 020 sobre la identidad definitiva.
- Alta, líneas, pagos, estado y mesa en una transacción idempotente.
- Servidor resuelve producto, tarifa, impuestos, permiso y total.
- Revocar escrituras monetarias directas desde navegador.
- Numeración, F1/F2, huella, desglose y outbox AEAT en una transacción.
- API fiscal con autenticación, tenant, rol, validación y CORS limitado.
- No activar envíos reales durante desarrollo.

### Aceptación

- Dos terminales no cobran dos veces la misma cuenta.
- Un fallo intermedio no deja venta parcial.
- Un reintento devuelve el mismo resultado.
- Vectores oficiales VERIFACTU, concurrencia de numeración y cadena completa verdes.

## 11. Fase 7 — Backoffice local completo y sincronización remota

**Prioridad:** P0 para offline-first, después de la fundación segura.  
**Depende de:** F1–F6.  
**Aporta:** producto autónomo en el local y remoto fiable.

- Cada nodo administra completamente su local offline.
- Gestión central multi-local solo con Gestión remota.
- Desactivar cualquier endpoint que confirme operaciones no persistidas.
- Cursor compuesto `(updated_at, clave primaria)`, lotes y checkpoint atómicos.
- Dinero/fiscalidad viajan como comandos idempotentes, nunca upserts genéricos.
- Catálogo, empleados y configuración usan versiones y conflicto visible.
- En seguridad gana el estado más restrictivo; bajas/revocaciones no esperan resolución manual.
- Propietario o permiso `Resolver conflictos` decide cambios normales.
- Módulos desactivados conservan consulta, exportación y reactivación.

### Aceptación

- 2.501 filas con la misma fecha sincronizan sin omisiones.
- Corte antes/después del ACK no pierde ni duplica.
- Una baja offline no resucita al restaurar un backup antiguo.
- Ediciones simultáneas conservan ambas versiones hasta resolución.

## 12. Fase 8 — Actualización, impresión, CI y mejora estructural

**Prioridad:** P1–P2.  
**Depende de:** fases críticas anteriores.  
**Aporta:** operación mantenible y verificable.

- Provisionado paginado, reanudable y con conteos/hashes.
- Updater con manifiesto firmado, compatibilidad app/esquema y estados por fase.
- Cola de impresión durable con `job_id` y estados explícitos.
- CI Windows/Linux con migraciones desde cero, dos tenants, RLS, auth, IPC, sync, dinero y fiscal.
- Sustituir typechecks/tests ficticios.
- Después, reducir N+1, agregados en cliente y tamaño del TPV sin mezclarlo con seguridad.

## 13. Trabajo posible antes de migraciones

- Actualizar decisiones y threat model.
- Convertir y conectar tipos Supabase.
- Preparar harness de migraciones y matrices de pruebas.
- Eliminar fallbacks visuales a Propietario y mostrar `identidad incompleta`.
- Diseñar contratos de API, estados y errores.
- Preparar verificaciones Windows 11, BitLocker, HTTPS y almacenamiento seguro.
- Cerrar el falso éxito de `/sync/upload` devolviendo `no disponible` hasta implementarlo.

Identidad global, contexto de tenant, RLS, perfiles por local, códigos, nodo, dispositivos, auditoría, licencia, venta, fiscalidad y sync durable requieren migraciones revisadas.

## 14. Riesgos y mitigaciones

| Riesgo | Mitigación obligatoria |
|---|---|
| Bloqueo por RLS | Probar primero con dos tenants y conservar recuperación exclusiva de servicio, auditada. |
| Drift histórico | Migraciones nuevas reparadoras; nunca aplicar `0105–0107` a ciegas. |
| Verificadores offline/TOTP expuestos | Cifrado por nodo, alta una vez por nodo y revocación sincronizada. |
| Conflictos local/nube | Versionado explícito; nunca “último cambio gana” en identidad, dinero o fiscalidad. |
| Alcance excesivo | No empezar backoffice offline completo antes de estabilizar identidad, nodo y comandos monetarios. |
| Disponibilidad frente a licencia | Un nodo aislado sigue operando; solo una orden firmada recibida puede imponer suspensión. |

## 15. Primera entrega autorizada

La primera entrega se limita a:

1. **Fase 0 completa.**
2. **Diseño SQL revisable de Fase 1.**

No aplica migraciones remotas. Debe producir:

- contrato exacto del esquema;
- inventario de drift aceptado/no aceptado;
- migraciones propuestas, todavía sin aplicar;
- matriz RLS;
- pruebas que deben fallar antes del arreglo;
- evidencia de que `0105` y la semilla de credenciales de `0107` quedan rechazadas.

## 16. Estado de ejecución

| Entregable | Estado al 17-07-2026 |
|---|---|
| Plan canónico guardado en `docs/plan/` | Hecho |
| Plan maestro de implementación F0–F8 | Hecho: guía 19, 34 entregas ordenadas |
| `database.types.ts` en UTF-8 | En ejecución de F0 |
| Clientes conectados al contrato generado | En ejecución de F0 |
| Retirada del flujo terminal usuario/contraseña de `0105` | En ejecución de F0; no requiere migración remota |
| Gate reproducible de tipos/contrato | En ejecución de F0 |
| Baseline viva y drift hasta `0110` | Pendiente de consolidar en documento |
| Diseño SQL y matriz RLS de F1 | Pendiente |
| Migración `0111` | No creada ni reservada; requiere revisión previa |
| Cambios remotos de Supabase | Ninguno |
