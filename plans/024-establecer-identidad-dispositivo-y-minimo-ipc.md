# Plan 024: Establecer identidad de dispositivo y mínimo privilegio Electron

> **Instrucciones para el ejecutor**: tratar el renderer como contenido remoto potencialmente comprometido. Los secretos viven en el proceso principal/almacén del SO. Coordinar claims y revocación con 017/023.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/web/app/api/dispositivos apps/web/app/conectar apps/web/app/lib/print-dispatcher.tsx apps/desktop/src supabase/migrations/0105_credencial_dispositivo.sql`.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: L
- **Riesgo**: HIGH
- **Depende de**: 017, 018, 023
- **Categoría**: security / desktop
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El canje genera credenciales, pero la web guarda identidad editable en `localStorage` y algunos flujos siguen confiando en un UUID. Electron expone impresión, cajón, visor, configuración, backup e identidad a cualquier código del origen cargado; varios IPC aceptan objetos/rutas sin un contrato runtime estrecho. Una XSS o servidor cambiado amplía su impacto a hardware y disco.

## Evidencia actual

- `apps/web/app/conectar/page.tsx:29-47`: canje y `localStorage.setItem("gluuh_device", ...)`.
- `apps/web/app/lib/print-dispatcher.tsx`: heartbeat/dispatch usa identidad cliente.
- `apps/desktop/src/preload.ts:11-19`: puente `window.gluuh` con capacidades amplias.
- `apps/desktop/src/main.ts:147-150,191-239`: allowlist de origen parcial e IPC para hardware/config/conexión.
- `apps/desktop/src/main.ts:205-218`: renderer puede solicitar backup y cambiar servidor/configuración.

## Alcance

**Dentro**: lifecycle de credencial, almacenamiento seguro, claims/audiencia, revocación/rotación, rate limit de canje, validación IPC/sender/origen, reducción del preload, navegación y backup.

**Fuera**: MDM empresarial, firma del instalador si no existe infraestructura, rediseño UI de conexión.

## Git

- Rama: `codex/024-identidad-dispositivo`
- Despliegue dual: emitir tokens nuevos antes de retirar identidad antigua.

## Pasos

### 1. Definir modelo de identidad

Token con `device_id`, `tenant_id`, audiencia nodo/cloud, scopes, `jti`, expiración y versión. Código de 6 dígitos es de un solo uso, corto, rate-limited y no es credencial permanente. Tabla registra hash/estado/rotación/revocación.

**Verifica**: threat model cubre robo, replay, clonación, reloj incorrecto y baja del terminal.

### 2. Mover secretos fuera de localStorage

En Electron, canjear desde main y guardar refresh/secret en `safeStorage`/credencial del SO; renderer recibe solo estado y token de acceso efímero cuando sea imprescindible. En navegador puro, usar sesión segura compatible, no JSON editable como autoridad.

**Verifica**: editar `localStorage` no cambia device/tenant/scopes; reinicio mantiene emparejado sin exponer secreto al DOM.

### 3. Validar identidad extremo a extremo

Gateway/API verifica firma, issuer, audience, exp, jti y revocación; deriva device/tenant del token. Heartbeat, impresión compartida y media ignoran IDs aportados si contradicen claims.

**Verifica**: token de A no opera B; token expirado/revocado/audiencia errónea falla en todos los servicios.

### 4. Reducir preload e IPC

Exponer métodos de intención mínimos. Validar argumentos con esquemas runtime, tamaños y enums; verificar `event.senderFrame.url`/WebContents esperado en cada handler. Renderer no elige rutas de disco arbitrarias ni escribe config completa; main decide destino y campos permitidos.

**Verifica**: payload enorme, path traversal, objeto con claves extra y sender no esperado son rechazados sin efecto.

### 5. Endurecer BrowserWindow y navegación

Confirmar `contextIsolation`, sandbox, `nodeIntegration: false`, permisos denegados por defecto, CSP y allowlist estricta de navegación/ventanas. Cambiar servidor exige presencia/admin y validación TLS/origen; no cargar HTTP remoto arbitrario con privilegios.

**Verifica**: XSS de fixture no accede a fs/process ni invoca scopes no concedidos; enlaces externos abren sin heredar preload.

### 6. Rotación y rollout

Feature flag para credencial v2, inventario de dispositivos, rotación gradual y revocación v1. Runbook para pérdida/reemplazo y terminal offline con ventana limitada.

**Verifica**: dispositivo puede revocarse y deja de latir/imprimir/subir media dentro del SLA.

## Pruebas

- Canje concurrente/replay, fuerza bruta y código caducado.
- Claims manipulados, reloj, audience, revocación y dos tenants.
- Tests IPC por canal y sender; navegación/origen malicioso.
- Migración de terminal emparejado y recuperación offline.

## Hecho cuando

- [ ] UUID/localStorage no son autoridad.
- [ ] Secretos permanentes no llegan al renderer.
- [ ] Todos los servicios derivan identidad de claims verificados.
- [ ] Preload/IPC usan mínimo privilegio y validación runtime.
- [ ] Revocación y rotación están probadas.

## STOP

- La plataforma objetivo no ofrece almacén seguro; definir alternativa y riesgo antes de guardar secretos.
- Cambiar URL remota seguiría otorgando el mismo preload a origen no confiable.
- Existen terminales sin inventario que quedarían bloqueados sin rollback.

## Mantenimiento

Cada capacidad hardware necesita scope, canal IPC validado, owner en main y prueba de renderer hostil.
