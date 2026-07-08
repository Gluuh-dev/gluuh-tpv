# 09 — Orden de implementación (plan operativo)

**Fecha:** 07-07-2026 · **Para qué:** abrir este documento por la mañana y
trabajar de arriba abajo. Consolida las decisiones y el GAP de la
[guía 15](../implementacion/15-instalacion-despliegue-y-licencia.md) (§11-12),
los pendientes de las guías [13](../implementacion/13-rediseno-config-y-estilos.md)
y [14](../implementacion/14-identidad-acceso-y-seguridad.md) y el checklist
maestro ([08](08-checklist-maestro-100.md)). Se marca con ✅ al terminar cada
tarea (y se registra la sesión en `docs/sesiones/`).

## Hecho a 07-07 (contexto para mañana)

- **Identidad**: empresa SOLO la crea Gluuh en `/admin` (trigger arreglado, 0078);
  alta en un paso con datos+módulos+duración → **pack de entrega** (usuario
  generado `barpepe` + password inicial de un solo uso + **código de instalación**
  4-4-5-4-4 + clave técnica); siembra (tecnico/1212, admin/1111, camareros,
  catálogo demo). `/instalar` fija el equipo a la empresa; `/login` por
  usuario+clave acotado al tenant; **cambio de password obligatorio** al primer
  acceso (`/cambiar-password`); índice único auth↔usuario; tenant fantasma borrado.
- **Plataforma**: `/admin` y `/api/admin` solo existen en `PLATAFORMA_HOSTS`
  (`apps/web/proxy.ts`); en cualquier otro host → 404.
- **Licencia**: página `/acerca-de` (licenciado a, suscripción activa/caduca
  pronto/caducada, código, módulos, este equipo) + chip de aviso en la barra de
  estado.
- **Decisiones**: nodo local ANTES del primer cliente; hosting **Cloudflare**
  (Next 16 soportado por OpenNext, verificado); dominios `www/app/admin.gluuh.com`
  (subdominios gratis); Vercel tiene la plantilla "Growix" a eliminar.

---

## Avance sesión noche 07-07 (revisar por la mañana)

- ✅ **Bloque A completo** (A1-A6): rate-limit en entrar-operario; gestión de
  empresa en /admin (reset password, renovar licencia, regenerar código, email
  de contacto); guard del TPV a /cambiar-password; empleados con perfil en el
  alta. `cambiar_pin` ya existía; A4/A6 ya estaban.
- ✅ **B1**: config Cloudflare/OpenNext lista (`wrangler.jsonc`,
  `open-next.config.ts`, scripts `deploy:cf`, deps, `DEPLOY.md`). Falta
  desplegar (necesita tu cuenta Cloudflare) — bloque B2-B5.
- ✅ **Bloque C impresión** (C1-C5): migración 0079 (printer/print_job/
  print_route); página /impresoras (CRUD + probar + enrutado por barra);
  despachador en Desktop (PrintDispatcher, realtime, reclamo atómico); enrutado
  de comandas (elegirImpresora verificado; móvil encola a la cola compartida).
- ⏳ **Pendiente probar en vivo** con Desktop + impresoras reales; el móvil→cocina
  ya está cableado por la cola.

- ✅ **D1** (parcial): migración 0080 (heartbeat) + "● En línea/○ hace N" en
  Módulos + el Desktop late cada 60 s. **Reconectar** queda pendiente (endpoint
  a probar en vivo).
- ✅ **D3**: el TPV se refresca solo al cambiar catálogo (realtime, debounce).
- ✅ **0081**: publicadas en realtime product/category/family/print_job — sin
  esto, C3 (impresión al instante) y D3 no dispararían. **Clave**: al crear
  tablas nuevas que el cliente escuche, añadirlas a la publicación.

- ✅ **B2-B5 DESPLEGADO (08-07)**: web en producción en **Cloudflare Workers**
  (OpenNext), Worker `gluuh`, dominios **app.gluuh.com** (cliente) y
  **admin.gluuh.com** (plataforma). Deploy automático al hacer push a `main`
  (Workers Builds ↔ GitHub). Detalles y gotchas en `apps/web/DEPLOY.md` y la
  memoria `despliegue-cloudflare`. Pendiente menor: mover los 2 secretos a
  runtime si fallara el login de operario; limpiar registros viejos de Vercel;
  landing en `www`.

Siguiente: **D2** (backup visible), **D4/D5** (auto-update, multi-impresora) y
luego **Bloque E** (nodo local). Probar en vivo el flujo de impresión con
Desktop + impresora real.

## BLOQUE A — Remates de identidad y plataforma (~1 día) ← HECHO ✅

| # | Tarea | Dónde | Listo cuando |
|---|---|---|---|
| A1 | **Rate-limit en `/api/entrar-operario`** (hoy sin límite = fuerza bruta de claves; reusar `excedeLimite`/`ipDe` de `api/dispositivos/limite.ts`) | `apps/web/app/api/entrar-operario/route.ts` | 11 intentos seguidos → 429 |
| A2 | **Gestión de empresa en `/admin`**: fila con acciones — **Resetear password** del cliente (nueva inicial + `debe_cambiar_password`, mostrada una vez; sin email el reset ERES tú), **Renovar licencia** (meses+módulos → `licencia_hasta/licencia_modulos`), **ver/regenerar código de instalación** (si se filtra), editar datos | `apps/web/app/admin/page.tsx` + `api/admin/empresa/route.ts` nuevo | Puedes rescatar a un cliente sin tocar la BD |
| A3 | **Email de contacto opcional** en el alta (aviso de caducidad; NO es login — `tenant.email_admin` ya existe, hoy guarda el sintético: pasar a guardar el de contacto) | `crear-empresa/route.ts` + form `/admin` | Alta con y sin email de contacto |
| A4 | **Guard de sesión en el TPV**: `/tpv` sin sesión → redirige a `/login` (hoy hay que saberlo); verificar que la sesión del equipo sobrevive reinicio en Desktop | `apps/web/app/tpv/page.tsx` | Reinicio del PC → TPV pide login una sola vez en la vida del equipo |
| A5 | **Empleados: campos que faltan** — editar **PIN de TPV** (además de la clave), ver/desbloquear bloqueo (`pin_intentos`, `pin_bloqueado_hasta`), perfil por defecto al crear | `apps/web/app/(panel)/empleados/page.tsx` (+ RPC si falta `cambiar_pin_operario`) | Un camarero nuevo queda operativo (PIN+clave+perfil) sin tocar la BD |
| A6 | **Login en `/admin` propio** (hoy usa `/login` general): opcional — al menos que `/admin` sin sesión redirija a `/login` y vuelva | `apps/web/app/admin/page.tsx` | Entrar a /admin en 1 salto |

## BLOQUE B — Publicar en Cloudflare (0,5-1 día)

| # | Tarea | Listo cuando |
|---|---|---|
| B1 | Adaptador **OpenNext**: `@opennextjs/cloudflare` + `wrangler.jsonc` en `apps/web`; build y deploy manual | `wrangler deploy` sirve la app |
| B2 | **Variables**: `NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DEVICE_JWT_SECRET`, `PLATAFORMA_HOSTS=admin.gluuh.com` | /admin solo responde en admin. |
| B3 | **DNS y dominios**: `www` (comercial), `app`, `admin` → proyecto CF; **eliminar la plantilla "Growix" de Vercel**; redirecciones `www/app`→`app.` y `www/admin`→`admin.` | Las 3 URLs viven; la plantilla muerta |
| B4 | **Supabase Auth**: Site URL + Redirect URLs con los dominios nuevos | Login funciona en app.gluuh.com |
| B5 | CI simple (deploy al hacer push a main) — opcional | push → producción |

## BLOQUE C — Impresión compartida + enrutado multi-barra (2-4 días)

| # | Tarea | Listo cuando |
|---|---|---|
| C1 | **Migración 0079**: `printer` (nombre, rol TICKETS/COCINA/BARRA/ETIQUETAS, transporte RED ip:puerto / USB device_id, activa) · `print_job` (printer_id, payload declarativo, estado ENCOLADO/IMPRESO/ERROR, origen, intentos, idempotencia) · `print_route` (estación × zona → printer_id) + RLS + espejo schema.sql | Migración aplicada por MCP + espejos |
| C2 | **Backoffice Impresoras**: CRUD + botón "probar" (job de test) + ver cola/errores | Alta de las 4 impresoras del caso 3 barras |
| C3 | **Despachador en Desktop**: suscripción realtime a `print_job` de SUS impresoras → reusar `ColaImpresion` (persistencia+reintentos); marca IMPRESO/ERROR | Job insertado desde otro equipo sale en papel |
| C4 | **Enrutado al enviar comanda** (TPV y comandera): líneas → estación (producto/categoría) × zona (mesa) → `print_route` → insert `print_job`; cabecera SIEMPRE con Mesa · Zona · Camarero · Hora · notas | Bebidas de Terraza → barra 1; comida → cocina |
| C5 | **Zona → barra** en el editor de planos (selector por zona) | Regla configurable sin tocar BD |
| C6 | Móviles/pantallas NUNCA imprimen directo (solo `print_job`); TPV ataja a su impresora local y usa cola para el resto | Comanda desde móvil imprime |

## BLOQUE D — Acabados operativos P1 (2-3 días)

| # | Tarea | Listo cuando |
|---|---|---|
| D1 | **Dispositivos**: autonombre `tpv_N`/`cocina_N`, botón **«Reconectar»** (nuevo código, misma identidad), **heartbeat** (`device.ultima_conexion`, `version` — migración 0080) + columna En línea | Ves el parque vivo desde el sofá |
| D2 | **Backup visible**: guardar última copia OK en `setting` (`backup.ultima`) + estado en barra/Copias + "copiar ahora" | "Copia de anoche ✓" visible |
| D3 | **Refresco automático del catálogo del TPV** (realtime a product/category o refetch al foco) | Agotado desde casa → TPV en segundos |
| D4 | **Auto-update de Gluuh Desktop** (electron-updater) | Parque se actualiza solo |
| D5 | **Multi-impresora por equipo** en Desktop (config lista, no una) | Tickets + etiquetas en el mismo PC |

## BLOQUE E — NODO LOCAL (la pieza grande, 3-6 semanas) — antes del primer cliente

| # | Fase | Listo cuando |
|---|---|---|
| E1 | **Spike técnico (2-3 d)**: PowerSync self-hosted en el nodo vs réplica propia (SQLite + cola idempotente); decidir con prueba real | Decisión escrita en guía 06 |
| E2 | **Numeración offline**: `number_range` + `reservar_rango()` (migración) — tickets/facturas sin internet sin colisiones | Dos TPV offline no repiten número |
| E3 | **Nodo v1 dentro de Gluuh Desktop** (equipo principal): sirve la web en LAN + espejo de datos del tenant + realtime local + cola de subida (`/sync/upload` NestJS revalida) | Router apagado 30 min: se vende, se comanda (móvil→KDS), se imprime; al volver, todo sube |
| E4 | **Conmutación de URL + mDNS**: terminales descubren el nodo (`_gluuh._tcp`) y caen a nube si no está | Cero IPs tecleadas |
| E5 | **Servicio Windows** (instalador MSI, arranque al reiniciar sin sesión, mini-PC dedicado §10.1, auto-update firmado) | El servidor del local aguanta un corte de luz y vuelve solo |

## BLOQUE F — Después (no bloquea vender, salvo F1 que va JUSTO antes)

- **F1 · VERIFACTU real** (guía 01): consolidar `invoice`, activar encadenado y
  envío AEAT con certificado — **la última cosa antes de vender** (decisión).
- F2 · Límites por módulo (`tenant.licencia_limites`: nº dispositivos, como el "8" de Ágora).
- F3 · Páginas Empresa y Local completas (guía 13) + Seguridad/auditoría fina (guía 14).
- F4 · Offline por dispositivo móvil (comandera sin LAN ni internet).
- F5 · Landing comercial real en `www.` (hoy: página mínima/redirect).
- F6 · 2FA/passkey obligatorio en plataforma; rotación de códigos.

---

## Referencia rápida — DDL pendiente (todo lo que falta en BD)

| Migración | Campos/tablas | Bloque |
|---|---|---|
| 0079 | `printer` · `print_job` · `print_route` | C |
| 0080 | `device.ultima_conexion timestamptz` · `device.version text` | D1 |
| — (sin DDL) | `setting` clave `backup.ultima` (mecanismo 0023 ya existe) | D2 |
| 0081 | `number_range` + RPC `reservar_rango()` | E2 |
| P2 | `tenant.licencia_limites jsonb` | F2 |
| (A5 si falta) | RPC `cambiar_pin_operario` | A5 |

Login: **no falta ningún campo** — `app_user.usr_app/codigo/clave_hash/pin_hash/perfil_id`
y `tenant.codigo_instalacion` ya existen (0073-0078).

## Referencia rápida — el login en cada superficie (estado real)

| Superficie | Cómo entra | Estado | Pendiente |
|---|---|---|---|
| Plataforma (`admin.`) | Tu email (+passkey) | ✅ | 2FA obligatorio (F6) |
| Backoffice nube (`app.`) | Usuario+password del alta; cambio obligatorio 1er login | ✅ | Reset por técnico (A2) |
| Equipo instalado | Código instalación (1 vez) → dispositivo `tpv_N` (código 6 díg., 1 vez) → operario usr+clave acotado al tenant | ✅ | Guard `/tpv` (A4) · rate-limit (A1) · Reconectar (D1) |
| Cambio de camarero en TPV | PIN rápido sin desloguear el equipo (bloqueo por intentos en BD) | ✅ | UI de desbloqueo (A5) |
| KDS/pantalla/kiosko | Token de dispositivo (sin sesión de usuario) | ✅ | Heartbeat (D1) |
