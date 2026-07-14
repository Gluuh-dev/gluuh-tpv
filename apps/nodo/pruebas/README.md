# Pruebas del nodo

La evidencia de que el nodo funciona. Son la suite de humo de cada release y el criterio
de aceptación de los cambios de `docs/implementacion/18`.

**Todas se ejecutan contra el NODO LOCAL (`127.0.0.1:54321`), nunca contra la nube**
(REGLA Nº1 de `CLAUDE.md`), salvo las de sincronización, que por definición tienen que
hablar con Supabase — y limpian lo que crean.

Requisitos: el nodo arrancado (`supabase\nodo\arrancar-nodo.ps1`) y provisionado
(`node apps/nodo/provisionar.mjs <tenant>`).

```powershell
node apps/nodo/pruebas/prueba-auth-sin-gotrue.mjs
node apps/nodo/pruebas/prueba-rls.mjs
node apps/nodo/pruebas/prueba-realtime.mjs
node apps/nodo/pruebas/prueba-media.mjs
node apps/nodo/pruebas/prueba-sync.mjs
node apps/nodo/pruebas/prueba-sync-fiscal.mjs
.\apps\nodo\pruebas\prueba-vigilante.ps1
.\apps\nodo\pruebas\prueba-secretos.ps1
```

| prueba | demuestra |
|---|---|
| `prueba-auth-sin-gotrue.mjs` | el nodo firma sus tokens: el camarero entra con su PIN (vale de un solo uso, rechazado al reutilizarlo) y **el DUEÑO entra al panel SIN INTERNET** — lo que antes era imposible. El refresco **rota** |
| `prueba-rls.mjs` | **la RLS aísla los bares**: Ana no ve a Berto ni pidiéndolo a propósito por su `tenant_id` |
| `prueba-realtime.mjs` | el comandero pica una mesa y **otro TPV lo ve** sin preguntar (LISTEN/NOTIFY → SSE) |
| `prueba-media.mjs` | subir foto **sin internet** → verla al instante → queda en cola para la nube → `../../` **bloqueado** |
| `prueba-sync.mjs` | **dos pases de sincronización = UNA venta** en la nube (idempotencia por `client_id`) |
| `prueba-sync-fiscal.mjs` | la nube recibe la factura, **su desglose de IVA y su registro de huella** — sin eso no podría declarar a la AEAT |
| `prueba-vigilante.ps1` | se mata PostgREST y **vuelve solo en ~35 s**, sirviendo datos |
| `prueba-secretos.ps1` | la clave del bar entra (200); **la del manual, 401 — firma inválida** |

`ayuda.mjs` es lo común: el secreto del nodo, las claves `anon`/`service_role`, y
`barDePrueba()` — que crea empresa + local + dueño con contraseña y su sesión.

## Por qué ya no hay `signUp` en las pruebas

Las viejas creaban su bar con `auth.signUp` — la vía de GoTrue. El nodo ya no la ofrece, y
es **correcto**: un bar se **provisiona desde la nube**, nadie se registra en el servidor
de un bar. Por eso `barDePrueba()` lo crea en la base de datos, que es justo lo que hace
el provisionador.

Retiradas por obsoletas: `prueba-login.mjs` (usaba la API de administración de GoTrue),
`prueba-e2e.ps1` (aislamiento con signUp → ahora `prueba-rls.mjs`), `prueba-identidad.mjs`
(idem), `prueba-supabasejs.mjs` (signUp).
