# 18 — Endurecer el nodo (guía ejecutable de plan/12)

Los arreglos de la auditoría `plan/12`, en orden, con ficheros y criterio de aceptación.
Cada bloque es una sesión de trabajo autocontenida.

---

## Bloque 1 · Corrección inmediata (A1 + A2 + A5) — una tarde

### 1a · Subir el desglose fiscal y los registros VERIFACTU (A1)

**Tocar**: `apps/nodo/sincronizar.mjs` → añadir a `TABLAS`, en este orden (después de
`invoice`, sus hijas):

```js
{ nombre: "invoice_tax_line", conflicto: "id", tiempo: "created_at" },
{ nombre: "verifactu_record", conflicto: "id", tiempo: "created_at" },
```

**Ojo**: comprobar antes en el nodo que ambas tienen `created_at` (si `verifactu_record`
usa otro nombre —`fecha_hora_gen`—, usar ese como `tiempo`).

**Aceptación**: cobrar una venta con factura en el nodo → `sincronizar` → en la nube
existen la factura, **sus líneas de impuesto** y **su registro de huella**. Dos pases →
sin duplicados.

### 1b · El vigilante (A2)

**Tocar**: `supabase/nodo/arrancar-nodo.ps1` (nuevo parámetro `-Vigilar`) y
`servicio-windows.ps1` (la tarea pasa a lanzar `-Vigilar`).

Esqueleto del bucle:

```powershell
if ($Vigilar) {
  while ($true) {
    # cada servicio: ¿responde? si no → relanzar SOLO ese (reusar la lógica de arranque)
    #   Postgres  → pg_isready
    #   PostgREST → GET :55433/   GoTrue/token → :55434/health
    #   realtime  → GET :55435/cambios (cabecera)   media → :55436   gateway → :54321/nodo/estado
    #   sync      → ¿existe el proceso con sincronizar.mjs --bucle?
    # rotar logs > 10 MB (truncar conservando las últimas ~200 líneas)
    Start-Sleep -Seconds 30
  }
}
```

**Aceptación**: con el nodo en marcha, matar `postgrest` a mano → en <60 s vuelve solo.
Matar el vigilante → la tarea programada lo reinicia (RestartCount ya está).

### 1c · Secretos por instalación (A5)

**Tocar**: `supabase/nodo/Instalar-Gluuh.ps1` — al principio de "Manos a la obra":

- generar `$jwt = base64(RandomBytes 48)` y `$pgpass = base64(RandomBytes 24)`
- escribirlos en: `postgrest.conf` (jwt-secret, db-uri), `sync.env`, y donde el token
  local firme (tras B1, el gateway; hasta entonces `gotrue.env`)
- `ALTER ROLE postgres/authenticator PASSWORD` tras el initdb
- derivar `anon`/`service` con `claves.mjs $jwt` y dejarlas en la config que servirá el
  nodo a los TPV (`/nodo/config`, ver bloque 3)

**Aceptación**: dos instalaciones en dos máquinas → secretos distintos; el manual deja de
mostrar un secreto que funcione en ningún bar real.

---

## Bloque 2 · Quitar GoTrue del nodo (B1, con B2 y B3.2 de paso) — 1-2 días

### 2a · El endpoint de tokens en el gateway

**Nuevo**: `apps/nodo/auth.mjs`, montado por `gateway.mjs` en `/auth/v1/*` (sustituye la
ruta al puerto 55434).

Contrato mínimo que `supabase-js` usa (verificado en las pruebas e2e):

| ruta | hace |
|---|---|
| `POST /token?grant_type=password` | valida contra `app_user` (email+clave del dueño **o** usuario+PIN de operario vía `verificar_clave_operario`); acuña `access_token` (claims: `sub`, `role=authenticated`, `tenant_id`, `user_rol`, `exp` 1 h) + `refresh_token` opaco en `nodo_sesion` |
| `POST /token?grant_type=refresh_token` | rota el refresh (borra el viejo, emite nuevo) |
| `GET /user` | devuelve el usuario del JWT (id, email) |
| `POST /logout` | borra la sesión |

**Nuevo SQL**: `supabase/nodo/06_auth_nodo.sql` — tabla `nodo_sesion(refresh_token pk,
app_user_id, creado_at, usado_at)` + índice. `/api/entrar-operario` en modo nodo deja de
llamar a `admin.createUser`: el grant password ya resuelve.

### 2b · Desmontar

- `instalar-nodo.ps1`: fuera pasos 2 y 3 (GoTrue + reparar `auth.uid()`); el bootstrap
  vuelve a crear `auth.users` mínima + `auth.uid()/role()/jwt()` — **y ya nadie las pisa**.
- fuera: `gotrue.env`, `bin/gotrue.exe` del paquete, `01_despues_de_gotrue.sql` (se
  conserva como histórico con nota), parches de `supabase/nodo/parches/` (histórico).
- `arrancar-nodo.ps1` y el vigilante: quitar el servicio GoTrue.
- B2: mover `media.mjs` y `estado.mjs` dentro de `gateway.mjs` (7 → 4 procesos:
  postgres, postgrest, gateway, realtime + el bucle de sync).
- B3.2: `actualizar.mjs` se copia a `.nodo/tmp/` y se re-ejecuta desde allí antes de
  descomprimir nada.

### 2c · Aceptación (las pruebas ya existen)

`apps/nodo/pruebas/` debe pasar entera contra el nodo sin GoTrue:

- `prueba-login.mjs` (operario entra, RLS viva)
- `prueba-e2e.ps1` (dos bares aislados)
- `prueba-supabasejs.mjs` (signUp se sustituye por grant password del dueño)
- **nueva**: el dueño entra al panel local por email (A4 resuelto)
- rotación del refresh: dos refresh seguidos con el mismo token → el segundo falla

---

## Bloque 3 · Servir la web + config en tiempo de ejecución — prepara el instalador TPV

(el "siguiente paso" ya decidido en plan/11 §10; aquí solo lo que toca al nodo)

- `next build` standalone de `apps/web` empaquetado en el release; el gateway proxya `/`
  al servidor Next local (o Next escucha y el gateway solo enruta `/rest|/auth|/realtime|/storage|/nodo`).
- **`GET /nodo/config`** (público, mismo origen): `{ url: origin, anonKey, urlNube }` —
  el cliente (`supabaseBrowser`) lo lee al arrancar en modo nodo. Así **ninguna**
  `NEXT_PUBLIC_*` por bar: una sola build para todos los nodos.
- El release del actualizador pasa a incluir la web (B3.1) — sha256 del conjunto.

**Aceptación**: un TPV virgen abre `http://<ip>:54321`, hace login de operario y cobra,
**sin ningún fichero de configuración en la terminal**.

---

## Bloque 4 · El paquete "módulo nube honesto" (A3 + C1 + C2)

- `bajarTabla` (espejo de `subirTabla`) para catálogo/config con LWW por `updated_at` y
  soft-deletes; lista de tablas = las de provisionar **por local** (plan/11 §9).
- `pg_dump` nocturno rotado (7 días) desde el vigilante; fecha visible en `/servidor`.
- Deriva de reloj: en cada pase de sync, `abs(now_nube - now_local) > 120 s` → aviso
  grande en `/servidor` + campo en el latido.

**Aceptación**: cambiar un precio en la nube → aparece en el nodo <5 min. Apagar
internet 2 días (simulado) → la copia nocturna existe igual.

---

## Bloque 5 · Dinero concurrente (C3 + C4)

- `reemplazar_lineas(p_updated_at_esperado)` → `raise` con código propio si la orden
  cambió; el TPV captura, recarga la mesa y avisa. Migración nueva + `page.tsx`.
- Numeración: RPC `siguiente_numero_factura(serie)` con
  `pg_advisory_xact_lock(hashtext(serie))`; `/api/factura` la usa.

**Aceptación**: dos clientes simulados guardando la misma mesa a la vez → uno recibe
conflicto y NO se pierden líneas. 20 cobros concurrentes → numeración correlativa sin
huecos ni choques.

---

## Recordatorios que no caducan

- **REGLA Nº1**: solo el Supabase del proyecto y el Postgres del nodo (55432).
- El nodo **nunca** lleva `SUPABASE_SECRET_KEY` de la nube (`nube.mjs` es la puerta).
- Las migraciones **no** son idempotentes: la cuenta la lleva `nodo_migracion`.
- `PGCLIENTENCODING=UTF8` siempre que un proceso lance `psql` (Windows español).
- Los timestamps de marcas de agua, **en texto** (microsegundos vs `Date` de JS).
