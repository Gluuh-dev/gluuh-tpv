# Plan 023: Cerrar la superficie LAN, diagnósticos y media del nodo

> **Instrucciones para el ejecutor**: asumir que la LAN no es confiable. Conservar instalación y soporte local mediante credenciales/acciones explícitas, no por endpoints anónimos. No descargar URLs reales durante tests SSRF.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- apps/nodo/gateway.mjs apps/nodo/estado.mjs apps/nodo/media.mjs apps/nodo/descargar-imagenes.mjs apps/nodo/pruebas`.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: M–L
- **Riesgo**: HIGH
- **Depende de**: 017
- **Categoría**: security / node
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El gateway publica `/nodo/estado` sin autenticación y con información operativa. Las acciones se protegen solo comprobando loopback y no exigen método/CSRF. Media acepta POST sin autenticación ni límite; el descargador busca cadenas URL en datos, hace `fetch` arbitrario y construye destinos desde la URL. En una LAN comprometida esto permite reconocimiento, DoS, SSRF y escritura fuera del ámbito si falla el saneado.

## Evidencia actual

- `apps/nodo/gateway.mjs:105-138`: estado anónimo y acciones por ruta; la barrera es dirección loopback.
- `apps/nodo/media.mjs:18,40,46-89`: ruta resuelta y body acumulado/escrito sin auth ni límite explícito.
- `apps/nodo/descargar-imagenes.mjs:7,51-60`: descubre URLs en texto, `fetch(url)` y escribe el buffer completo.
- El gateway escucha para terminales de la LAN, por lo que “local” no equivale a proceso confiable.

## Alcance

**Dentro**: auth de nodo, autorización y CSRF/métodos, redacción de estado, límites media, validación de rutas/formatos, SSRF, timeouts, cuotas y tests.

**Fuera**: acceso remoto de soporte por Internet, CDN, edición de imágenes, sustituir Supabase Storage.

## Git

- Rama: `codex/023-seguridad-nodo-lan`
- Commits separados gateway/auth y media/SSRF.

## Pasos

### 1. Definir actores y credenciales

Separar health mínimo público, terminal emparejado, administrador local y proceso interno. Emitir token corto y rotatorio ligado a dispositivo/tenant/audiencia; secretos solo en almacén del proceso, nunca en HTML/config pública.

**Verifica**: matriz endpoint×actor; por defecto 401/403.

### 2. Reducir diagnósticos y acciones

`/nodo/health` solo devuelve vivo/versión compatible. Estado detallado requiere admin. Acciones solo POST, token admin, `Content-Type`, Origin/Host allowlist y nonce CSRF; validar nombre contra allowlist y esperar/registrar resultado real.

**Verifica**: GET, navegador ajeno, DNS rebinding, token terminal y acción desconocida son denegados.

### 3. Blindar subida media

Autenticar tenant/dispositivo, limitar tamaño antes y durante streaming, MIME y magic bytes, extensiones permitidas, cuota, timeout y nombre generado por servidor. Comprobar con `path.relative` que destino queda dentro de `RAIZ`; escritura temporal+rename y limpieza en error.

**Verifica**: `..`, separadores codificados, symlink, body sin longitud, zip bomb/archivo gigante y MIME falso no escriben fuera ni agotan memoria.

### 4. Eliminar SSRF del descargador

Dejar de rastrear cualquier texto. Leer solo columnas media conocidas y aceptar orígenes/buckets configurados. Parsear URL, exigir HTTPS salvo nodo local explícito, resolver DNS y bloquear loopback/link-local/redes privadas/metadata y redirects que salgan de allowlist. Limitar bytes/tiempo/concurrencia.

**Verifica**: `127.0.0.1`, `::1`, `169.254.169.254`, decimal/hex, DNS rebinding y redirect se bloquean; origen Supabase permitido funciona con fixture.

### 5. Endurecer cabeceras y despliegue

CORS por orígenes conocidos, CSP para shell del nodo, `nosniff`, sin secretos en errores. Firewall/instalador abre solo el puerto requerido y documenta rotación/recuperación.

**Verifica**: escaneo desde otra máquina solo ve superficie prevista; TPV emparejado sigue operativo.

## Pruebas

- Tabla de autorización por endpoint y método.
- Path traversal Windows/POSIX, symlink y nombres Unicode.
- Fuzz de tamaño/cabeceras y 20 subidas concurrentes.
- Corpus SSRF con redirects y cambios DNS mediante servidor falso local.
- Logs no contienen token, clave anon completa, rutas sensibles ni PII.

## Hecho cuando

- [ ] Estado detallado y acciones no son anónimos.
- [ ] Media tiene auth, streaming limitado, cuotas y containment probado.
- [ ] Descargas solo usan orígenes/campos permitidos y resisten SSRF.
- [ ] CORS/CSP/errores aplican mínimos seguros.
- [ ] Tests LAN adversariales pasan.

## STOP

- No hay forma de distribuir/rotar credencial sin 024; mantener endpoint cerrado hasta coordinar.
- Un flujo de instalación depende de estado sensible anónimo y no tiene reemplazo.
- Se detecta media fuera de raíz: preservar evidencia, no borrar automáticamente.

## Mantenimiento

Todo endpoint nuevo del nodo declara actor, método, auth, límites, datos expuestos y test desde un host LAN no confiable.
