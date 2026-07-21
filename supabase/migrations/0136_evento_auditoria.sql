-- 0136 — Trazabilidad / auditoría del catálogo.
--
-- «Todo lo que sea crear/eliminar/modificar tendremos guardado una trazabilidad
-- por si pasa algo.» Un registro APPEND-ONLY por bar de las acciones sobre el
-- catálogo (y lo que se enganche después). No sustituye a los tombstones de sync
-- (0120): aquellos son para no resucitar filas borradas; ESTO es para el DUEÑO
-- —quién tocó qué y cuándo—, con un resumen legible y un snapshot para poder
-- reconstruir si hace falta.
--
-- Aditivo. Lo escribe el TPV best-effort (`lib/trazabilidad.ts`): si el registro
-- falla, NO bloquea la operación que lo genera.

create table if not exists public.evento_auditoria (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant(id) on delete cascade,
  -- Qué se tocó: 'product', 'family', 'category'… (la tabla lógica, no la física).
  entidad        text not null,
  -- Id/uuid o código de la fila afectada (texto para no atarse al tipo de PK).
  entidad_id     text,
  accion         text not null check (accion in ('crear','modificar','eliminar','duplicar')),
  -- Legible de un vistazo en el panel: «Alhambra 1925», «Café con leche».
  resumen        text not null default '',
  -- Snapshot: el DESPUÉS al crear/modificar; el ANTES al eliminar. Para poder
  -- ver qué había o reconstruir a mano si hace falta.
  datos          jsonb,
  -- De la sesión del terminal (claim `device_id` + nombre del dispositivo).
  actor_device   text,
  actor_operario text,
  created_at     timestamptz not null default now()
);

-- Listado del panel (lo más nuevo primero) y el historial de una ficha concreta.
create index if not exists evento_auditoria_por_bar
  on public.evento_auditoria (tenant_id, created_at desc);
create index if not exists evento_auditoria_por_entidad
  on public.evento_auditoria (tenant_id, entidad, entidad_id);

alter table public.evento_auditoria enable row level security;

-- APPEND + lectura por bar. A propósito SIN update ni delete: una auditoría que
-- se puede editar no vale para «por si pasa algo». La retención/purga, si hace
-- falta, va por un proceso aparte —nunca desde el TPV—.
drop policy if exists evento_auditoria_lee on public.evento_auditoria;
create policy evento_auditoria_lee on public.evento_auditoria for select
  using (tenant_id = current_tenant_id());

drop policy if exists evento_auditoria_inserta on public.evento_auditoria;
create policy evento_auditoria_inserta on public.evento_auditoria for insert
  with check (tenant_id = current_tenant_id());
