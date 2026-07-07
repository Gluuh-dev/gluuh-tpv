# Sesión 07-07-2026 (noche) — Bloques A–D del plan de despliegue

Trabajo autónomo sobre `docs/plan/09-orden-de-implementacion.md`. Todo con
typecheck en verde y commiteado. Resumen para retomar por la mañana.

## Hecho

### Bloque A — identidad y plataforma ✅
- **A1** rate-limit en `/api/entrar-operario` (10/min por IP, anti fuerza bruta).
- **A2** `/api/admin/empresa` + botones en `/admin`: **reset password** del
  cliente (nueva inicial + cambio obligatorio), **renovar licencia** al momento,
  **regenerar código de instalación**. Soporte remoto sin tocar la BD.
- **A3** email de **contacto** opcional en el alta (avisos, no login).
- **A4** el TPV manda a `/cambiar-password` si la cuenta debe cambiarla.
- **A5** empleados: perfil por defecto en el alta (PIN/desbloqueo/clave ya estaban).
- **A6** `/admin` sin sesión → `/login` (ya estaba).

### Bloque B (parcial) — publicar ✅ config / ⏳ desplegar
- **B1** Cloudflare/OpenNext: `wrangler.jsonc`, `open-next.config.ts`, scripts
  `deploy:cf`/`preview:cf`, deps, y **`apps/web/DEPLOY.md`** con todos los pasos.
- **Pendiente B2-B5**: desplegar (necesita tu cuenta Cloudflare) + matar la
  plantilla "Growix" de Vercel + DNS `www/app/admin` + variables + Supabase Auth.

### Bloque C — impresión compartida ✅
- **0079** `printer` · `print_job` · `print_route` (RLS por tenant + trigger).
- **/impresoras** (Admin › Tickets y entradas): CRUD, **Probar**, y **Enrutado
  por barra** (estación × zona → impresora).
- **PrintDispatcher** (en `providers`, no-op fuera de Desktop): realtime a los
  `print_job` de sus impresoras, **reclamo atómico** (anti doble impresión),
  imprime con `window.gluuh.imprimir`, marca IMPRESO/ERROR, drena pendientes.
- **print-routing** `elegirImpresora` (verificado con node) + `encolarComandas`:
  el TPV en móvil/navegador **encola a la cola compartida** (comandera → cocina).

### Bloque D (parcial) ✅
- **D1** 0080 `device.ultima_conexion/version` + RPC `device_heartbeat`; el
  Desktop late cada 60 s; Módulos muestra **● En línea / ○ hace N**.
  (**Reconectar** pendiente — endpoint a probar en vivo.)
- **D3** el TPV **se refresca solo** al cambiar catálogo (realtime, debounce).
- **0081** publica en realtime `product/category/family/print_job` — sin esto,
  C3 y D3 no dispararían.

## Pendiente de PROBAR EN VIVO (no verificable sin hardware/Desktop)
- Impresión: crear impresoras en `/impresoras`, una regla de zona, y probar que
  una comanda de móvil sale por la barra correcta con la mesa; y que el
  PrintDispatcher del Desktop imprime los `print_job`.
- Heartbeat: ver "En línea" en Módulos con un Desktop conectado.

## Siguiente (orden sugerido)
1. **B2-B5** desplegar en Cloudflare (contigo, con la cuenta).
2. **D2** backup visible · **D4** auto-update Desktop · **D5** multi-impresora.
3. **Bloque E** nodo local (la pieza grande).
4. **F1** VERIFACTU real — lo último antes de vender.

## Notas técnicas
- Migraciones nuevas: **0079, 0080, 0081** (aplicadas por MCP + espejo en
  `supabase/migrations/` y `apps/api/db/schema.sql`).
- ⚠️ Al crear una tabla que el cliente escuche por realtime, **añadirla a la
  publicación** `supabase_realtime` (como hizo 0081), o las suscripciones no
  disparan.
- El antivirus de Windows sigue bloqueando escrituras en `.git/objects`; si un
  commit falla por "Permission denied", reintentar tras unos segundos o cambiar
  1 carácter del fichero para variar el hash del blob.
