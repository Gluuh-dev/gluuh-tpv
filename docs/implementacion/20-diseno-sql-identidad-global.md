# 20 — Diseño SQL de la identidad global (F1) — PARA REVISIÓN

> **Estado:** borrador para aprobación humana (puerta 1 de la guía 19 §16).
> **Nada de este documento está aplicado.** No hay número de migración reservado:
> se reservará en `AHORA.md` solo tras la aprobación.
>
> **Preflight ejecutado el 17-07-2026** (MCP solo lectura sobre la nube):
> 4 `app_user` (2 con `auth_user_id`), **0 duplicados** de `auth_user_id` y de email,
> 2 tenants (uno es la plantilla), 1 local, **los 4 usuarios sin `perfil_id`**.
> La condición STOP «duplicados históricos sin decisión» **no se dispara**: el
> backfill es trivial con los datos actuales.

## 1. Qué arregla (diagnóstico vivo, verificado)

```sql
-- current_tenant_id() HOY (nube, 17-07): el tenant puede venir del JWT sin validar
-- y, si no, un LIMIT 1 arbitrario. Una cuenta en dos empresas es imposible/ambigua.
SELECT COALESCE(
  NULLIF(current_setting('app.tenant_id', true), '')::uuid,
  NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
  (SELECT au.tenant_id FROM public.app_user au WHERE au.auth_user_id = auth.uid() LIMIT 1)
)

-- operario_permite() HOY: termina en `true` → fail-open. Los 4 usuarios reales
-- están sin perfil: hoy TODO se les permite por ese último `true`.
select coalesce( ...propietario..., ...perfil..., true);
```

Unicidades actuales que impiden multi-empresa (se retiran en contract):
`app_user_auth_user_id_unico` (global) e `idx_user_email` (global).

## 2. Modelo objetivo (mínimo que exige el plan 14 §5)

```
auth.users ──1:1── cuenta ──1:N── app_user (membresía por tenant)
                     │                 │
                     │                 └──1:N── app_user_local (asignación por local:
                     │                            perfil + estado + vigencia)
                     │                            └── 0:N overrides PERMITIR/DENEGAR
                     └──1:N── sesion_contexto (tenant/local activos POR SESIÓN)
```

`HEREDAR` no se almacena: la ausencia de fila de override ES heredar del perfil.

## 3. DDL propuesto (migración `identidad_global_expand`)

```sql
-- ── cuenta global (1:1 con auth.users) ──────────────────────────────────────
create table public.cuenta (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  nombre        text,
  estado        text not null default 'ACTIVA'
                constraint cuenta_estado_valido check (estado in ('ACTIVA','SUSPENDIDA')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── enlace de la membresía a la cuenta (nullable durante la transición) ─────
alter table public.app_user add column cuenta_id uuid references public.cuenta(id);
create index idx_app_user_cuenta on public.app_user (cuenta_id) where cuenta_id is not null;

-- ── contexto de sesión: tenant/local activos de CADA sesión ─────────────────
-- La clave es el session_id del JWT de Supabase (claim estándar). Dos sesiones
-- de la misma cuenta pueden apuntar a tenants distintos sin pisarse.
create table public.sesion_contexto (
  session_id   uuid primary key,
  cuenta_id    uuid not null references public.cuenta(id) on delete cascade,
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid references public.location(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index idx_sesion_contexto_cuenta on public.sesion_contexto (cuenta_id);

-- ── asignación por local ────────────────────────────────────────────────────
create table public.app_user_local (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid not null references public.location(id) on delete cascade,
  perfil_id    uuid references public.perfil(id) on delete set null,
  estado       text not null default 'ACTIVA'
               constraint asignacion_estado_valido check (estado in ('ACTIVA','SUSPENDIDA','BAJA')),
  desde        date,
  hasta        date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (app_user_id, location_id)
);
create index idx_app_user_local_tenant on public.app_user_local (tenant_id, location_id);

-- ── override individual (solo PERMITIR/DENEGAR; sin fila = HEREDAR) ─────────
create table public.app_user_permiso (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  app_user_id  uuid not null references public.app_user(id) on delete cascade,
  location_id  uuid references public.location(id) on delete cascade, -- null = toda la empresa
  permiso      text not null,
  efecto       text not null constraint efecto_valido check (efecto in ('PERMITIR','DENEGAR')),
  unique (app_user_id, location_id, permiso)
);

-- ── registro de sesiones y eventos de seguridad ─────────────────────────────
create table public.sesion_registro (
  session_id   uuid primary key,
  cuenta_id    uuid not null references public.cuenta(id) on delete cascade,
  creada_at    timestamptz not null default now(),
  ultima_vista timestamptz not null default now(),
  revocada_at  timestamptz,
  user_agent   text
);
create index idx_sesion_registro_cuenta on public.sesion_registro (cuenta_id);

create table public.evento_seguridad (
  id          bigint generated always as identity primary key,
  cuenta_id   uuid references public.cuenta(id) on delete set null,
  tenant_id   uuid references public.tenant(id) on delete set null,
  tipo        text not null,          -- LOGIN_OK, LOGIN_FALLIDO, CONTEXTO_CAMBIADO, SESION_REVOCADA…
  detalle     jsonb not null default '{}'::jsonb, -- sin contraseñas/PIN/tokens
  creado_at   timestamptz not null default now()
);
create index idx_evento_seguridad_cuenta on public.evento_seguridad (cuenta_id, creado_at);
```

Notas: todas las tablas multiempresa llevan `tenant_id` + FK + índice con
`tenant_id` primero (regla guía 19 §2). `cuenta`, `sesion_contexto`,
`sesion_registro` y `evento_seguridad` son globales por diseño (pertenecen a la
persona, no al tenant) — su aislamiento es por `cuenta_id`, ver RLS §7.

## 4. Preflight y backfill (migración `identidad_global_backfill` o bloque aparte)

```sql
-- Preflight (ya ejecutado 17-07: 0 y 0; repetir el día de la aplicación):
select count(*) from (select auth_user_id from public.app_user
  where auth_user_id is not null group by auth_user_id having count(*) > 1) d;
select count(*) from (select lower(email) from public.app_user
  where email is not null and email <> '' group by lower(email) having count(*) > 1) d;
-- STOP si cualquiera > 0: decisión humana de identidad antes de continuar.

-- Backfill idempotente, por lotes (hoy: 2 filas):
insert into public.cuenta (auth_user_id, nombre)
select distinct au.auth_user_id, min(au.nombre)
from public.app_user au
where au.auth_user_id is not null
group by au.auth_user_id
on conflict (auth_user_id) do nothing;

update public.app_user au
set cuenta_id = c.id
from public.cuenta c
where c.auth_user_id = au.auth_user_id and au.cuenta_id is null;

-- Asignación por local: cada membresía activa se asigna a TODOS los locales de
-- su tenant con su perfil actual (hoy: 4 usuarios × 1 local).
insert into public.app_user_local (tenant_id, app_user_id, location_id, perfil_id)
select au.tenant_id, au.id, l.id, au.perfil_id
from public.app_user au join public.location l on l.tenant_id = au.tenant_id
where au.activo
on conflict (app_user_id, location_id) do nothing;

-- Conteos verificables (ledger): app_user con auth == cuenta enlazadas;
-- app_user activos × locales == asignaciones.
```

**Dependencia con el plan 018:** los 4 usuarios están sin `perfil_id`. Antes del
switch fail-closed hay que aprobar el mapping rol→perfil mínimo (018 paso 1) y
sembrar perfiles; si no, el switch les denegaría todo. Es EL mismo backfill, no
dos: se ejecutan juntos.

## 5. Funciones nuevas (migración `endurecer_identidad_grants_rls`)

Las firmas públicas **no cambian** (`current_tenant_id()`, `operario_permite(text)`):
los ~669 usos existentes no se tocan en F1.

```sql
-- Contexto: el servidor registra la elección de tenant/local de ESTA sesión.
create or replace function public.establecer_contexto_sesion(p_tenant uuid, p_location uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_session uuid := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id','')::uuid;
  v_cuenta  uuid;
  v_membresia uuid;
begin
  if v_session is null or auth.uid() is null then
    raise exception 'sin sesión' using errcode = '28000';
  end if;
  select id into v_cuenta from public.cuenta where auth_user_id = auth.uid() and estado = 'ACTIVA';
  select au.id into v_membresia from public.app_user au
    where au.cuenta_id = v_cuenta and au.tenant_id = p_tenant and au.activo;
  if v_cuenta is null or v_membresia is null then
    raise exception 'membresía inválida' using errcode = '42501'; -- denegar, sin detalles
  end if;
  if p_location is not null and not exists (
    select 1 from public.location l where l.id = p_location and l.tenant_id = p_tenant) then
    raise exception 'local inválido' using errcode = '42501';
  end if;
  insert into public.sesion_contexto (session_id, cuenta_id, tenant_id, app_user_id, location_id)
  values (v_session, v_cuenta, p_tenant, v_membresia, p_location)
  on conflict (session_id) do update
    set tenant_id = excluded.tenant_id, app_user_id = excluded.app_user_id,
        location_id = excluded.location_id, updated_at = now();
end $$;

-- current_tenant_id() v2 — determinista y fail-closed:
--   1. `app.tenant_id` (GUC): SOLO el nodo/servicio local lo fija; se conserva.
--   2. contexto de la sesión (session_id del JWT verificado).
--   3. transición: si la cuenta tiene EXACTAMENTE UNA membresía activa, esa.
--   4. ambigüedad o ausencia → NULL (la RLS deniega sola).
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.tenant_id', true), '')::uuid,
    (select sc.tenant_id from public.sesion_contexto sc
      where sc.session_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id','')::uuid
        and sc.cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid())),
    (select min(au.tenant_id) from public.app_user au
      join public.cuenta c on c.id = au.cuenta_id
      where c.auth_user_id = auth.uid() and au.activo
      having count(distinct au.tenant_id) = 1)
  )
$$;
-- Cambio deliberado: el claim `tenant_id` del JWT DEJA de ser autoridad
-- (el navegador nunca decide tenant — regla guía 19 §2).

-- operario_permite(p_permiso) v2 — fail-closed:
--   propietario/admin explícitos → true;
--   si no: asignación ACTIVA al local del contexto (o perfil de la membresía
--   mientras dura la transición) + override DENEGAR gana + clave ausente → false.
create or replace function public.operario_permite(p_permiso text)
returns boolean language sql stable security definer set search_path = ''
as $$
  with yo as (
    select au.id, au.rol, au.perfil_id, au.tenant_id,
           (select sc.location_id from public.sesion_contexto sc
             where sc.session_id = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'session_id','')::uuid) as loc
    from public.app_user au
    where au.tenant_id = public.current_tenant_id()
      and au.activo
      and (au.auth_user_id = auth.uid()
           or au.cuenta_id = (select c.id from public.cuenta c where c.auth_user_id = auth.uid()))
  )
  select coalesce(
    (select true from yo where rol in ('PROPIETARIO','ADMIN_PLATAFORMA') limit 1),
    (select case
       when ov.efecto = 'DENEGAR' then false
       when ov.efecto = 'PERMITIR' then true
       else coalesce((pf.permisos ->> p_permiso)::boolean, false)  -- ausente = NO
     end
     from yo
     left join public.app_user_local al
       on al.app_user_id = yo.id and (yo.loc is null or al.location_id = yo.loc) and al.estado = 'ACTIVA'
     left join public.perfil pf on pf.id = coalesce(al.perfil_id, yo.perfil_id)
     left join public.app_user_permiso ov
       on ov.app_user_id = yo.id and ov.permiso = p_permiso
      and (ov.location_id is null or ov.location_id = yo.loc)
     order by ov.location_id nulls last
     limit 1),
    false)  -- sin membresía, sin perfil o sin clave → DENEGAR
$$;
```

## 6. Grants exactos

```sql
-- Patrón de las migraciones 0083+ (el patrón seguro ya existente en el repo):
revoke all on function public.establecer_contexto_sesion(uuid, uuid) from public, anon;
grant execute on function public.establecer_contexto_sesion(uuid, uuid) to authenticated;

revoke all on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated, service_role;

revoke all on function public.operario_permite(text) from public, anon;
grant execute on function public.operario_permite(text) to authenticated, service_role;

-- Tablas nuevas: sin grants a anon; authenticated solo a través de RLS (§7).
revoke all on public.cuenta, public.sesion_contexto, public.app_user_local,
              public.app_user_permiso, public.sesion_registro, public.evento_seguridad
  from public, anon;
grant select on public.cuenta, public.sesion_contexto, public.sesion_registro to authenticated;
grant select on public.app_user_local, public.app_user_permiso to authenticated;
-- Escrituras: SOLO vía funciones definer o service_role (ninguna escritura directa
-- de cliente sobre identidad).
```

## 7. Políticas RLS por tabla

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `cuenta` | `auth_user_id = auth.uid()` (mi propia cuenta) | nadie (solo definer/service) |
| `sesion_contexto` | `cuenta_id = (select id from cuenta where auth_user_id = auth.uid())` | nadie (solo `establecer_contexto_sesion`) |
| `app_user_local` | `tenant_id = current_tenant_id()` | `tenant_id = current_tenant_id() and operario_permite('empleados_gestionar')` (WITH CHECK igual) |
| `app_user_permiso` | `tenant_id = current_tenant_id()` | igual que `app_user_local` |
| `sesion_registro` | mi cuenta | UPDATE de `revocada_at` vía función definer `revocar_sesion(uuid)` |
| `evento_seguridad` | `tenant_id = current_tenant_id() and operario_permite('seguridad_ver')` | nadie (escribe el servidor) |

Todas con `alter table … enable row level security` y `force row level security`.

## 8. Matriz actor × tenant × local × rol (pruebas obligatorias)

| # | Actor | Contexto | Acción | Esperado |
|---|---|---|---|---|
| 1 | anon | — | `current_tenant_id()` / cualquier tabla | NULL / 0 filas / EXECUTE denegado |
| 2 | cuenta con 1 membresía (A) | sin contexto | leer catálogo A | OK (transición: membresía única) |
| 3 | cuenta con 2 membresías (A y B) | sin contexto | leer catálogo | **0 filas** (ambigua → NULL) |
| 4 | la misma, contexto→A | sesión 1 | leer/escribir A | OK; B invisible |
| 5 | la misma, contexto→B | sesión 2 (simultánea) | leer/escribir B | OK; A invisible; la sesión 1 sigue en A |
| 6 | camarero sin perfil ni asignación | contexto A | `operario_permite('descuentos')` | **false** (hoy: true) |
| 7 | camarero con perfil, clave ausente | contexto A | permiso no declarado | **false** (hoy: true) |
| 8 | override DENEGAR sobre perfil que permite | contexto A local 1 | esa acción | false |
| 9 | asignación SUSPENDIDA / fuera de vigencia | contexto A | cualquier permiso | false |
| 10 | propietario A | contexto A | todo lo de A / algo de B | OK / 0 filas |
| 11 | `establecer_contexto_sesion(B)` sin membresía en B | cuenta solo-A | — | excepción 42501 |
| 12 | service_role / nodo (GUC `app.tenant_id`) | — | flujo actual del nodo | sin cambios |
| 13 | sesión revocada (`sesion_registro.revocada_at`) | contexto A | mutación sensible | denegado (comprobación en contexto) |

## 9. Orden de despliegue

1. **expand** — DDL §3. Nada cambia para los callers (funciones intactas).
2. **backfill** — §4 + perfiles mínimos del plan 018 (mapping aprobado). Conteos.
3. **switch** — funciones v2 (§5) + grants (§6) + RLS nueva (§7); UI de selector
   de empresa/local (entrega 1.2) y estado «identidad incompleta» en el panel.
   Renovación de sesiones activas. Canary con los dos tenants reales.
4. **contract** (migración separada, tras canary) — retirar
   `app_user_auth_user_id_unico` e `idx_user_email`; crear
   `unique (tenant_id, cuenta_id)`; dejar de leer `app_user.auth_user_id` como
   identidad principal (queda como columna legacy hasta F2).

## 10. Rollback lógico y STOP

- expand/backfill: reversibles con `drop table`/`update … set cuenta_id = null`
  (no tocan datos existentes).
- switch: las funciones v1 quedan guardadas en la migración anterior; revertir =
  `create or replace` con el cuerpo v1 (documentado en la propia migración).
  **Excepción**: no se revierte a `coalesce(..., true)` — si el fail-closed
  bloquea un journey legítimo, se repara el backfill de perfiles, no se reabre
  el fail-open.
- contract: solo tras canary; si un caller legacy aparece, se restaura el índice
  (los datos no se han borrado).
- **STOP**: duplicados > 0 el día de la aplicación; el mapping rol→perfil de 018
  no está aprobado; una ruta del alcance está sucia por otra sesión; el esquema
  vivo difiere del contrato (`pnpm tipos:check` rojo).

## 11. Pruebas que deben FALLAR antes del arreglo (escribir primero)

Contra el nodo desechable 55432 (harness de 0.2):

1. `prueba-identidad-multiempresa.mjs` — una cuenta en A y B con dos sesiones:
   hoy falla (unicidad global impide la segunda membresía).
2. `prueba-fail-closed.mjs` — usuario sin perfil intenta acción sensible:
   hoy falla (se le permite; debe denegarse).
3. `prueba-tenant-ambiguo.mjs` — JWT con claim `tenant_id` falso: hoy falla
   (el claim manda; debe ignorarse).
4. Matriz §8 completa como suite (plan 025 la convierte en gate).
