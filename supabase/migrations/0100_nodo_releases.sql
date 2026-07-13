-- 0100 — VERSIONES DEL NODO: mandar una actualización a los bares desde la nube.
--
-- Vive en la NUBE (no en el nodo): es el tablón donde se publica "hay una versión nueva".
-- Cada nodo lo mira cada pocos minutos, y si hay algo más nuevo que lo que tiene, se lo
-- baja y se actualiza solo.
--
-- `sha256` NO es burocracia: es lo único que impide que un nodo instale un paquete
-- manipulado. Si el hash del zip descargado no cuadra, el nodo NO lo aplica. Un TPV que
-- acepta cualquier binario que le mandan es una puerta abierta a la caja del bar.

create table if not exists public.nodo_release (
  id           uuid primary key default gen_random_uuid(),
  version      text not null unique,        -- semver: 1.4.0
  url          text not null,               -- zip en Storage
  sha256       text not null,               -- huella del zip; si no cuadra, no se instala
  notas        text,                        -- qué trae (se enseña en /servidor)
  obligatoria  boolean not null default false,
  publicada_at timestamptz not null default now()
);

comment on table public.nodo_release is
  'Versiones del nodo publicadas. Cada nodo se actualiza solo a la más nueva.';

alter table public.nodo_release enable row level security;

-- Cualquier nodo autenticado puede LEER el tablón (necesita saber si hay versión nueva).
drop policy if exists nodo_release_lectura on public.nodo_release;
create policy nodo_release_lectura on public.nodo_release
  for select to authenticated using (true);

-- Publicar sólo lo hace la plataforma (nosotros). Si un cliente pudiera publicar una
-- versión, podría empujar código a los nodos de los demás.
drop policy if exists nodo_release_admin on public.nodo_release;
create policy nodo_release_admin on public.nodo_release
  for all to authenticated
  using (exists (select 1 from public.platform_admin p where p.auth_user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admin p where p.auth_user_id = auth.uid()));
