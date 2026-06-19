# Infraestructura › Modelo de cuentas y acceso

> Cómo entran las personas y las máquinas en Gluuh. Define la **jerarquía de identidad**
> (cuenta de empresa → usuarios personales → locales y dispositivos), el **alta del servicio
> del PC del local** como nodo del negocio, y la **autenticación técnica** (Supabase Auth +
> tokens de servicio + tokens de dispositivo) que aterriza en **RLS por `tenant_id`**.
> Es la capa que sostiene todo lo demás: sin ella no hay multi‑tenant, ni offline‑first, ni
> cumplimiento RGPD.
>
> Lee junto a [usuarios y perfiles (RBAC)](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md),
> [empresa](../09-referencia-configurador-agora/administracion/empresa.md),
> [locales](../09-referencia-configurador-agora/administracion/locales.md),
> [licencia y módulos](../09-referencia-configurador-agora/licencia-y-modulos.md) y
> [conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md).

---

## 0. El modelo en una frase

Una **cuenta de EMPRESA** (el *tenant* en la nube = el negocio) a la que se conectan
**usuarios personales** (cada persona su login, con su rol/perfil). En cada local se instala
un **SERVICIO en el PC** que se **da de alta con usuario y contraseña** de esa empresa y, a
partir de ahí, **es el nodo local** del negocio (edge offline‑first). Las superficies táctiles
(TPV, comandera, KDS, kiosko) son **dispositivos** que cuelgan de ese nodo o directamente de la
nube.

```
                    ┌──────────────────────────────────────────────┐
                    │        CUENTA DE EMPRESA  (tenant)            │
                    │   tenant_id · razón social · NIF · territorio │
                    │   suscripción/plan · certificado VERIFACTU    │
                    └───────────────┬──────────────────────────────┘
                                    │ 1..N
        ┌───────────────────────────┼───────────────────────────────┐
        │                           │                               │
  USUARIOS PERSONALES          LOCALES (location)            FACTURACIÓN / FISCAL
  (login propio + rol)         p.ej. "Bar Puerto",           series, VERIFACTU,
        │                      "Terraza Centro"              IGIC/IVA  (→ @gluuh/core)
        │ N..N (rol)                 │ 1..N
        │                           ▼
        │                    NODO LOCAL (servicio del PC)
        │                    = edge del negocio en ese local
        │                           │ 1..N
        ▼                           ▼
  ┌───────────────┐         DISPOSITIVOS / TERMINALES
  │ Ana (Admin)   │         (TPV · comandera · KDS · pantalla · kiosko)
  │ Luis (Camar.) │         emparejados por QR → token de dispositivo
  │ Eva (Inform.) │
  └───────────────┘
```

> **Diferencia tenant vs usuario** (clave): el **tenant** es la *organización* — la fila de
> negocio que se factura, que tiene NIF, territorio fiscal y suscripción. El **usuario** es una
> *persona* con credenciales propias que pertenece a uno (o varios) tenants con un **rol**. Borrar
> un usuario **no** borra el negocio; dar de baja el tenant suspende a todos sus usuarios. Nunca
> se comparte un login entre personas (a diferencia del clásico `admin/35621` de Ágora).

---

## 1. Jerarquía: empresa (tenant) → usuarios → locales/dispositivos

**Para qué sirve.** Es el árbol de identidad y de datos. Todo registro (ticket, factura,
producto, informe) cuelga de un `tenant_id`; toda persona y toda máquina se autentican *dentro*
de ese árbol. Sin una jerarquía clara no hay aislamiento multi‑tenant ni permisos coherentes.

**Cómo lo resolvemos.** Cuatro niveles, cada uno con su tabla y su rol en la autenticación:

| Nivel | Tabla | Qué es | Identidad |
|-------|-------|--------|-----------|
| **Empresa** | `tenant` | La organización que factura (= [empresa.md](../09-referencia-configurador-agora/administracion/empresa.md)) | `tenant_id` en todo JWT |
| **Usuario personal** | `app_user` + `membership` | Una persona con login propio y un **rol** en el tenant | Supabase Auth (`auth_user_id`) |
| **Local** | `location` | Sede de venta física del negocio (puede haber varios) | `location_id` |
| **Nodo local** | `service_node` | El **servicio del PC** instalado en un local | **token de servicio** |
| **Dispositivo** | `device` | Terminal táctil (TPV, KDS…) bajo un nodo/local | **token de dispositivo** |

```sql
create table tenant (
  id            uuid primary key default gen_random_uuid(),
  razon_social  text not null,
  nif           text not null,
  territorio    text not null,        -- PENINSULA_BALEARES | CANARIAS | CEUTA_MELILLA | FORAL_*
  plan          text not null default 'pro',
  created_at    timestamptz default now()
);

create table app_user (               -- "Usuario"/empleado (ver usuarios-y-perfiles.md)
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,          -- FK a auth.users de Supabase (backoffice)
  nombre        text not null,
  email         text,
  pin_tpv       text, pin_comandera text, pin_admin text   -- hash, PIN por superficie
);

create table membership (             -- relación N..N persona ↔ empresa, con rol
  tenant_id   uuid references tenant(id),
  user_id     uuid references app_user(id),
  role_id     uuid references role(id),         -- perfil RBAC (usuarios-y-perfiles.md §B)
  estado      text default 'activo',            -- activo | invitado | suspendido
  primary key (tenant_id, user_id)
);

create table location (               -- "Local" físico (locales.md)
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id),
  nombre      text not null,
  direccion   text, poblacion text, provincia text, cp text
);
```

> Un `app_user` puede tener **varias `membership`** (una gestoría que lleva tres bares = tres
> tenants), pero su identidad (email, PIN) es única. El rol es **por tenant**, no global.

**Qué necesitamos.** Tablas `tenant`, `app_user`, `membership`, `location` con RLS por
`tenant_id`; un *resolver* de "tenant activo" en la sesión (cuando un usuario tiene varios).
Reutilizar `role`/`permission`/`role_permission` de [usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md).

**Prioridad.** 🔴 **Alta** — es el cimiento; sin esto nada de lo demás se sostiene.

---

## 2. Alta de empresa, invitación de usuarios y roles

**Para qué sirve.** Cómo nace una cuenta y cómo entran las personas a ella. Es el *onboarding*:
el dueño se registra (crea el tenant) y luego invita a su equipo, dando a cada uno su login y su
perfil. Sustituye al modelo "todos comparten el PIN del equipo".

**Cómo lo resolvemos.**

1. **Signup de empresa.** El fundador se registra en `app/(auth)/signup` con email + contraseña
   (Supabase Auth). En el primer login se crea el `tenant` (razón social, NIF, **territorio
   fiscal** — clave para IGIC/IVA, ver [empresa.md](../09-referencia-configurador-agora/administracion/empresa.md))
   y una `membership` con rol **Administrador**. Un `app_user` ↔ un `auth.users`.
2. **Invitar usuarios por email.** Desde el backoffice, el admin invita por email. Supabase Auth
   genera un *magic link* / invitación; al aceptar, el invitado fija su contraseña y queda con una
   `membership` (`estado='invitado' → 'activo'`) y el **rol asignado** en la invitación.
3. **Asignar rol/perfil.** Se reutiliza el RBAC de
   [usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md):
   `role` (Administrador / Encargado / Camarero / Informes…) + matriz `role_permission`
   (`aplicacion`,`accion`). Perfiles **predefinidos clonables** para no empezar de cero.
4. **Doble credencial por superficie.**
   - **Backoffice web** (configurar, informes): **sesión Supabase Auth** (email+contraseña, con
     2FA para admins — §6). Es la "Clave Administración" de Ágora, pero como sesión real.
   - **Operativa táctil** (TPV, comandera): **PIN rápido por superficie** (`pin_tpv`,
     `pin_comandera`), hash en `app_user`, validable **offline** en el dispositivo. Un camarero
     puede tener PIN de TPV y **no** de Administración.

```
SIGNUP                         INVITACIÓN
 dueño → email+pass            admin → "Invitar"  →  email del empleado
   → crea tenant                          │  magic link
   → membership ADMIN                     ▼
   → configura empresa          empleado fija contraseña
     (NIF, territorio)           → membership(rol) activo
                                 → PIN por superficie (se asigna en backoffice)
```

**Qué necesitamos.** Flujo de signup que cree `tenant`+`membership`; invitaciones por email
(Supabase Auth `inviteUserByEmail` o tabla `invitation` con token); UI de gestión de usuarios y
asignación de rol/perfil; *seed* de roles predefinidos; almacenamiento **hasheado** de PINs y
verificación offline en cliente.

**Prioridad.** 🔴 **Alta** — sin onboarding no hay clientes; el RBAC ya está diseñado, falta el
configurador.

---

## 3. El servicio del PC del local (nodo local)

**Para qué sirve.** Es el corazón de lo que pide el usuario: en el local se **instala un servicio
en el PC** que se **da de alta con usuario y contraseña de la empresa** y pasa a ser el **nodo
local** del negocio (servidor edge offline‑first en la LAN, *fallback* a la nube). Equivale al
"equipo maestro" de Ágora ([conexión y roles](../implementacion/conexion-y-roles-dispositivo.md))
pero **sin teclear IP/puerto** y atado al tenant de forma segura.

**Cómo lo resolvemos.** Alta con usuario/contraseña, pero **sin guardar la contraseña**:

1. **Instalación.** Se instala el servicio (Tauri sidecar / servicio Windows / contenedor). Al
   primer arranque muestra "Dar de alta este equipo como nodo del local".
2. **Login de instalación.** El instalador escribe **usuario y contraseña** de la empresa. Ese
   login debe ser de un usuario **con permiso `nodo.instalar`** (típicamente Administrador o
   Encargado). Se valida contra Supabase Auth → devuelve un JWT de sesión **de corta vida**.
3. **Canje por token de servicio.** Con esa sesión, el servicio llama a
   `POST /nodes/provision` (en `apps/api`) pasando `location_id` y un *fingerprint* del equipo.
   El backend, **comprobando el permiso** y el tenant del usuario, **crea el `service_node`** y
   devuelve un **token de servicio de larga vida, revocable** (no un JWT de usuario).
4. **Lo que se guarda en el PC.** **Solo el token de servicio** (en *secure storage* del SO /
   keychain), nunca la contraseña ni el login del operador. A partir de ahí el nodo se autentica
   **como nodo**, no como persona.
5. **El nodo ya es el local.** Queda asociado a `tenant_id` + `location_id`; levanta el edge
   (BD local, sync, descubrimiento mDNS para los terminales) y aparece en el backoffice como
   "Nodo de \<local\>" con su estado (online/última sync) y botón **Revocar**.

> **Recomendación firme:** el "usuario y contraseña" es solo el **gesto de autorización** del alta;
> la **credencial operativa real es el token de servicio**. Así, si el empleado que instaló se va o
> cambia su contraseña, el nodo **sigue funcionando**; y si el equipo se pierde o se da de baja un
> local, se **revoca el token** sin tocar a las personas. Separar "quién autorizó" de "con qué se
> conecta la máquina" es el patrón correcto (igual que un *bot/service account*).

```sql
create table service_node (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id),
  location_id   uuid not null references location(id),
  nombre        text,                       -- "PC barra", "Servidor cocina"
  fingerprint   text,                       -- huella del equipo (anti-clonado)
  token_hash    text not null,              -- hash del token de servicio (nunca en claro)
  provisioned_by uuid references app_user(id),  -- quién hizo el alta (auditoría)
  estado        text default 'activo',      -- activo | revocado
  last_seen_at  timestamptz,
  created_at    timestamptz default now()
);
```

```
ALTA DEL SERVICIO DEL PC  (provisioning del nodo)
  instalar servicio en el PC del local
        │
        ▼  introduce USUARIO + CONTRASEÑA de la empresa
  Supabase Auth ──valida──► JWT de usuario (corta vida)
        │  (requiere permiso 'nodo.instalar')
        ▼
  POST /nodes/provision  { location_id, fingerprint }   →  apps/api
        │  comprueba permiso + tenant
        ▼
  crea service_node  +  emite TOKEN DE SERVICIO (larga vida, revocable)
        │
        ▼
  el PC guarda SOLO el token (secure storage) — descarta la contraseña
        │
        ▼
  el nodo arranca como edge del local (BD local + sync + mDNS)
```

**Qué necesitamos.** Permiso `nodo.instalar` en el catálogo RBAC; endpoint
`POST /nodes/provision` y `DELETE /nodes/:id` (revocar) en `apps/api`; emisión/validación de
**tokens de servicio** (JWT firmado de larga vida con `node_id`,`tenant_id`,`location_id` o token
opaco + tabla); *secure storage* en el instalador; panel de nodos en backoffice. 🔴 **falta**
(`apps/api` es esqueleto en el write‑path).

**Prioridad.** 🔴 **Alta** — es el modelo de despliegue que pide el usuario y la base del
offline‑first.

---

## 4. Autenticación técnica (tres tipos de credencial → RLS)

**Para qué sirve.** Que cada actor (persona, nodo, terminal) tenga **su propia credencial**,
todas portando `tenant_id` (+ rol cuando aplica) para que **Postgres/RLS** sea la última línea de
defensa. Distintos sujetos = distintos tokens, todos revocables por separado.

**Cómo lo resolvemos.** Tres caminos que convergen en un JWT con `tenant_id`:

| Sujeto | Mecanismo | Lleva en el claim | Caduca | Revocación |
|--------|-----------|-------------------|:------:|-----------|
| **Usuario** (persona) | **Supabase Auth** (email+pass, +2FA) | `sub`, `tenant_id`, `role` | corta (refresh) | desactivar `membership` |
| **Nodo PC** (servicio) | **Token de servicio** (canjeado en alta, §3) | `node_id`, `tenant_id`, `location_id` | larga | `service_node.estado='revocado'` |
| **Dispositivo** (terminal) | **Token de dispositivo** por emparejamiento **QR** | `device_id`, `tenant_id`, `location_id`, `rol` | larga | `device.estado='revocado'` |

- **Usuarios → Supabase Auth.** Sesión real para el backoffice; el `tenant_id` y el `role` se
  inyectan vía *custom claims* (hook de Auth / función `current_tenant_id()`), de modo que **toda
  policy RLS** filtre por el tenant del JWT. Los **PINs** de operativa **no** son Auth: son hashes
  validados en el dispositivo para sesiones rápidas/offline; las escrituras siguen viajando con la
  credencial del dispositivo/nodo.
- **Nodo PC → token de servicio.** Larga vida, sin interacción humana; identifica a la máquina del
  local. Se valida en `apps/api` y/o como JWT que RLS entiende.
- **Dispositivo → token de dispositivo (QR).** Como ya describe
  [conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md): el terminal
  escanea un **QR de un solo uso** generado en backoffice que lleva tenant, servidor (nube/LAN),
  rol/grupo/centro y un token de emparejamiento; se canjea por un **token de dispositivo** que se
  guarda en el equipo (revocable). Cero IPs, cero firewall.

```
   PERSONA            NODO PC                TERMINAL
  email+pass        token servicio        QR → token dispositivo
      │                  │                       │
      ▼                  ▼                       ▼
   Supabase Auth     apps/api / JWT         apps/api / JWT
      │                  │                       │
      └──────────────────┴───────────────────────┘
                         ▼
            JWT con  tenant_id  (+ role / location / device)
                         ▼
        ┌──────────────────────────────────────────┐
        │   Postgres  ·  RLS por current_tenant_id() │  ← red de seguridad final
        └──────────────────────────────────────────┘
```

**Qué necesitamos.** *Custom claims* `tenant_id`/`role` en Supabase Auth; emisión y validación de
tokens de servicio y de dispositivo en `apps/api`; `current_tenant_id()` y **policies RLS en todas
las tablas**; endpoint de emparejamiento QR (`POST /devices/pair`). 🟡 RLS por tenant es premisa del
proyecto; la emisión de tokens de servicio/dispositivo **falta**.

**Prioridad.** 🔴 **Alta** — es el contrato de seguridad de toda la plataforma.

---

## 5. Multi‑local: una empresa, varios nodos

**Para qué sirve.** Una misma empresa (tenant) puede tener **varios locales**, cada uno con su
**nodo PC** y sus terminales. Hay que decidir **qué usuario ve qué** y cómo se reparten datos,
series y configuración entre locales.

**Cómo lo resolvemos.**

- **Un tenant, N `location`, N `service_node`** (uno o más por local). Cada `device` cuelga de un
  `location_id` (y, si hay edge, de un `service_node`).
- **Visibilidad por usuario.** El rol vive en `membership` (a nivel tenant). Para limitar a un
  encargado a "su" local añadimos `membership.location_scope` (NULL = todos los locales; lista =
  solo esos). Encaja con los **Grupos de Puntos de Venta** de
  [usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md)
  (`user_device_group`): el admin ve todo, el encargado de local solo el suyo.
- **Configuración heredada.** Como decide [locales.md](../09-referencia-configurador-agora/administracion/locales.md):
  `setting` con **herencia `DEVICE > LOCAL > GLOBAL > default`**. Lo global lo fija la empresa; un
  local concreto **sobrescribe** lo que necesite (series, pasarela).
- **Series por local/terminal.** Numeración VERIFACTU **independiente por origen** para que varios
  nodos/terminales coboren offline sin pelear el número (ver `document_series` en locales.md §5).

```
        TENANT  "Sabores de La Palma"
        ├── location "Bar Puerto"   → service_node(PC barra)   → device(TPV,KDS)
        ├── location "Terraza"      → service_node(PC terraza) → device(TPV,comandera)
        └── location "Food‑truck"   → (sin nodo: directo a nube)→ device(TPV móvil)

   Ana (Admin, location_scope=NULL)      → ve los 3 locales
   Luis (Encargado, scope=[Bar Puerto])  → solo Bar Puerto
   Eva (Informes, scope=NULL)            → informes de los 3 (solo lectura)
```

**Qué necesitamos.** `membership.location_scope` (o tabla `membership_location`); filtros de
visibilidad en backoffice y en RLS (no solo en UI); herencia de `setting` por local; series por
local/terminal.

**Prioridad.** 🟡 **Media** — imprescindible para cadenas; un negocio de un solo local funciona sin
ello (scope = todo).

---

## 6. Seguridad y RGPD

**Para qué sirve.** Proteger las cuentas y los **datos personales** (empleados y clientes) y
cumplir RGPD/AEAT. El sistema maneja NIF/NSS de empleados ([usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md))
y datos de clientes — datos personales sujetos a protección.

**Cómo lo resolvemos.**

- **2FA para admins en remoto.** Cualquier `membership` con rol **Administrador/Admon** que entre
  al **backoffice desde fuera del local** exige segundo factor (TOTP). La operativa táctil sigue con
  PIN local (es presencial). Soportado por Supabase Auth MFA.
- **Revocación granular e independiente.** Tres botones en backoffice: **suspender usuario**
  (desactiva `membership`), **revocar nodo** (`service_node.estado='revocado'` → el PC deja de
  conectarse), **revocar dispositivo** (`device.estado='revocado'`). Revocar uno **no** afecta a
  los demás (la separación de §3/§4 lo permite).
- **RLS como red de seguridad, no como adorno.** Los permisos RBAC se aplican en la UI **y** se
  **respaldan en policies RLS** por `tenant_id` (y por `location` cuando hay scope). **Nunca fiar
  solo del cliente**: aunque el frontend oculte un botón, la base de datos rechaza la escritura si
  el JWT no autoriza. Premisa del proyecto (CLAUDE.md) y de
  [usuarios-y-perfiles.md](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md).
- **Secretos fuera del cliente.** Certificado VERIFACTU (mTLS), claves de pasarela y tokens de
  servicio **nunca** en claro en BD del cliente: los gestiona `apps/api` / *secure storage*
  (CLAUDE.md, locales.md §1).
- **RGPD.** Datos personales de empleados (NIF, NSS, contacto) y clientes con **base legal**,
  minimización, **derecho de acceso/borrado** (export + *soft delete* respetando la retención
  fiscal de facturas), y **auditoría** (`audit_log`: quién hizo qué — alta de nodo, anulación,
  cambio de rol). Ver [12 — Seguridad y RGPD](../../12-seguridad-y-rgpd.md).
- **PINs.** Hash (no reversible); rotación posible; el PIN de Administración débil **no** sustituye
  a la sesión Auth con 2FA para acciones sensibles en remoto.

**Qué necesitamos.** MFA/TOTP en Auth para roles admin; flujo de "acceso remoto" que distinga
dentro/fuera del local; endpoints de revocación; policies RLS completas (con tests negativos);
`audit_log`; flujos RGPD (export/borrado) compatibles con retención fiscal; gestión de secretos en
`apps/api`.

**Prioridad.** 🔴 **Alta** (RLS, secretos, revocación) · 🟡 **Media** (2FA, flujos RGPD completos).

---

## 7. Diagrama integrado (cuentas + flujo de alta del servicio)

```
┌──────────────────────────────── LA NUBE (Supabase) ──────────────────────────────────┐
│                                                                                       │
│   auth.users ───┐                                                                     │
│                 │ 1:1                                                                  │
│   app_user ─────┘        membership (rol, location_scope)                             │
│      │  (PINs hash)            │                                                       │
│      │                        ▼                                                        │
│      │                    ┌────────┐   1..N    ┌──────────┐   1..N   ┌──────────────┐  │
│      └───────────────────►│ tenant │──────────►│ location │─────────►│ service_node │  │
│                           └────────┘           └──────────┘          └──────┬───────┘  │
│        RLS: current_tenant_id()  filtra TODO por tenant_id                  │ 1..N     │
│                                                          ┌─────────────────▼────────┐  │
│                                                          │        device            │  │
│                                                          │ (TPV/comandera/KDS…)     │  │
│                                                          └──────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────┘
        ▲ Auth (persona)        ▲ token servicio (nodo)        ▲ token dispositivo (QR)

FLUJO DE ALTA DEL SERVICIO DEL PC
  1) usuario con permiso 'nodo.instalar' teclea  usuario+contraseña  en el instalador
  2) Supabase Auth valida  → JWT corto
  3) POST /nodes/provision {location_id, fingerprint}  (apps/api comprueba permiso+tenant)
  4) crea service_node + emite TOKEN DE SERVICIO (larga vida, revocable)
  5) el PC guarda SOLO el token (secure storage); descarta la contraseña
  6) el nodo arranca como EDGE del local (BD local + sync + mDNS para terminales)
  7) terminales se emparejan por QR → token de dispositivo → operan en su superficie
```

---

## Resumen accionable

| # | Tema | Decisión / recomendación | Estado | Prioridad |
|---|------|--------------------------|:------:|:---------:|
| 1 | Jerarquía tenant→usuario→local→nodo→device | `tenant`/`app_user`/`membership`/`location`/`service_node`/`device`, RLS por `tenant_id` | 🔴 falta | Alta |
| 2 | Alta empresa + invitar usuarios + roles | Signup crea tenant+admin; invitación por email (Supabase Auth); RBAC reutilizado; **PIN por superficie + Auth backoffice** | 🟡 RBAC diseñado, configurador falta | Alta |
| 3 | Servicio del PC = nodo local | Alta con usuario/contraseña → **canjea por token de servicio** (larga vida, revocable); **no guardar la contraseña** | 🔴 falta (`apps/api` esqueleto) | Alta |
| 4 | Auth técnica (3 credenciales) | Supabase Auth (persona) · token servicio (nodo) · token dispositivo QR (terminal) → JWT con `tenant_id` → RLS | 🟡 RLS premisa; emisión tokens falta | Alta |
| 5 | Multi‑local | 1 tenant, N locales/nodos; `membership.location_scope` decide qué ve quién; `setting` heredado | 🟡 parcial | Media |
| 6 | Seguridad / RGPD | 2FA admins remotos; revocación independiente de nodo/dispositivo/usuario; **RLS como red final**; secretos en `apps/api`; auditoría + RGPD | 🟡 parcial | Alta/Media |

> **Recomendación global.** Construir esta capa **antes** que cualquier configurador: define
> `tenant`/`app_user`/`membership` con RLS, el flujo de signup+invitación con Supabase Auth, y el
> endpoint `POST /nodes/provision` que canjea usuario/contraseña por **token de servicio**. Mantra
> innegociable: **el "usuario y contraseña" del alta del PC es solo el gesto de autorización; la
> credencial que vive en la máquina es un token de servicio revocable, nunca la contraseña**; y
> **RLS por `tenant_id` es la última línea de defensa, no se confía solo en el cliente**.

---

**Enlaces.**
[usuarios y perfiles (RBAC)](../09-referencia-configurador-agora/administracion/usuarios-y-perfiles.md) ·
[empresa](../09-referencia-configurador-agora/administracion/empresa.md) ·
[locales](../09-referencia-configurador-agora/administracion/locales.md) ·
[licencia y módulos](../09-referencia-configurador-agora/licencia-y-modulos.md) ·
[conexión y roles de dispositivo](../implementacion/conexion-y-roles-dispositivo.md) ·
[implementación (README)](../implementacion/README.md)
