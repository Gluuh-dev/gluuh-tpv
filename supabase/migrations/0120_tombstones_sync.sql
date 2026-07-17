-- 0120 — Tombstones del catálogo (F7 entrega 7.3 núcleo; plans/021 paso 4).
--
-- El agujero: una BAJA solo vivía como "esta fila ya no está en la foto". Un
-- nodo restaurado de un backup antiguo (o editado offline) volvía a SUBIR la
-- fila borrada — resurrección silenciosa. Ahora cada DELETE del catálogo deja
-- lápida con fecha: el sincronizador la respeta antes de subir y la aplica al
-- bajar. La columna de fecha se llama `updated_at` A PROPÓSITO: así los
-- cursores compuestos del sync (cursores.mjs) sirven tal cual.

create table if not exists public.tombstone_sync (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,          -- sin FK: el tenant puede borrarse y sus lápidas quedan
  tabla      text not null,
  clave      jsonb not null,         -- {columna_pk: valor, …}
  updated_at timestamptz not null default now(),  -- cuándo se registró la baja
  origen     text not null default 'NUBE'
             constraint tombstone_origen_valido check (origen in ('NUBE','NODO'))
);
create index if not exists idx_tombstone_sync_cursor
  on public.tombstone_sync (tenant_id, tabla, updated_at, id);

alter table public.tombstone_sync enable row level security;
alter table public.tombstone_sync force row level security;
drop policy if exists tombstone_sync_ver on public.tombstone_sync;
-- El nodo (con el token del bar) LEE sus lápidas para aplicarlas; no son
-- sensibles (solo claves primarias de cosas que ya no existen).
create policy tombstone_sync_ver on public.tombstone_sync
  for select using (tenant_id = public.current_tenant_id());
revoke all on public.tombstone_sync from public, anon;
grant select on public.tombstone_sync to authenticated;
grant all on public.tombstone_sync to service_role;

-- ── El trigger: cada DELETE del catálogo deja su lápida ──────────────────────
create or replace function public.registrar_tombstone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clave jsonb;
begin
  select jsonb_object_agg(a.attname, to_jsonb(old) -> a.attname)
    into v_clave
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
   where i.indrelid = tg_relid and i.indisprimary;
  insert into public.tombstone_sync (tenant_id, tabla, clave)
  values (old.tenant_id, tg_table_name, coalesce(v_clave, to_jsonb(old) - 'tenant_id'));
  return old;
end $$;

-- Se cuelga de las tablas de CATÁLOGO (mismo criterio que 0101: tenant_id +
-- updated_at), excluyendo lo operativo/fiscal (nace en el bar, sube en una
-- dirección, no se borra por sync) y la fontanería de identidad/infra cuyo
-- borrado es churn normal, no una baja de catálogo.
do $$
declare
  t record;
  n int := 0;
begin
  for t in
    select c.relname as tabla
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and exists (select 1 from information_schema.columns col
                    where col.table_schema = 'public' and col.table_name = c.relname
                      and col.column_name = 'tenant_id')
       and exists (select 1 from information_schema.columns col
                    where col.table_schema = 'public' and col.table_name = c.relname
                      and col.column_name = 'updated_at')
       and c.relname not in (
         -- operativo/fiscal (una dirección, no se borra por sync)
         'sales_order', 'order_line', 'payment', 'invoice', 'invoice_tax_line', 'tax_line',
         'verifactu_record', 'ticketbai_record', 'cash_move', 'cash_session',
         'print_job', 'shift', 'stock_move', 'online_order', 'jornada', 'reservation',
         'fiscal_outbox',
         -- fontanería de identidad/dispositivos/instalación (churn, no catálogo)
         'sesion_contexto', 'sesion_registro', 'evento_seguridad', 'pin_intento',
         'sesion_operario', 'credencial_dispositivo', 'invitacion',
         'orden_instalacion', 'nodo_instancia', 'tombstone_sync',
         -- infra del nodo
         'nodo_migracion', 'nodo_sync_estado', 'nodo_media_pendiente', 'nodo_sesion', 'nodo_release')
  loop
    execute format('drop trigger if exists trg_tombstone on public.%I', t.tabla);
    execute format(
      'create trigger trg_tombstone after delete on public.%I
         for each row execute function public.registrar_tombstone()',
      t.tabla);
    n := n + 1;
  end loop;
  raise notice '% tabla(s) de catálogo dejan lápida al borrar', n;
end $$;
