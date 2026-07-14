# Pruebas del nodo

La evidencia de que el nodo funciona. Vivían en `.nodo/tmp/` (temporal, ignorada por
git) y se rescataron aquí el 14-07-2026: son la suite de humo de cada release y el
criterio de aceptación de los cambios de `docs/implementacion/18`.

**Todas se ejecutan contra el NODO LOCAL (`127.0.0.1:54321`), nunca contra la nube**
(REGLA Nº1 de `CLAUDE.md`). Requisitos: nodo arrancado (`arrancar-nodo.ps1`) y, las que
usan `supabase-js`, ejecutarse desde una carpeta que lo resuelva (p. ej. copiándolas a
`apps/web/` al vuelo, como hace el runner de cada una en su cabecera).

| prueba | demuestra |
|---|---|
| `prueba-e2e.ps1` | alta de dos bares → JWT con `tenant_id` → **la RLS aísla** (Bar Dos no ve a Bar Uno) |
| `prueba-supabasejs.mjs` | la librería del TPV funciona contra el nodo: signUp, inserts, joins, RPC fiscal (IGIC 7 %) |
| `prueba-realtime.mjs` | el comandero pica una mesa y **otro TPV lo ve** sin preguntar (LISTEN/NOTIFY → SSE) |
| `prueba-media.mjs` | subir foto **sin internet** → verla al instante → queda en cola para la nube → `../../` **bloqueado** |
| `prueba-sync.mjs` | **dos pases de sincronización = UNA venta** en la nube (idempotencia por `client_id`) |
| `prueba-login.mjs` | login de operario contra el auth del nodo; sin bar asignado, la RLS no enseña **nada** |
| `prueba-identidad.mjs` | un nodo con **solo el `refresh_token`** ve SU bar (1 categoría); con la clave maestra vería TODOS (14). Y el token **rota** |

Deuda anotada (plan/12 · C7): un `probar-nodo.ps1` que las encadene contra una
instalación limpia, y algún día un runner Windows en CI.

Usan el secreto JWT **de desarrollo** a propósito: en un bar real cada nodo tendrá el
suyo (plan/12 · A5) y estas pruebas se ejecutan solo en la máquina de desarrollo.
