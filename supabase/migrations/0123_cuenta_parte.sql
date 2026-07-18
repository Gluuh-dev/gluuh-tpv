-- 0123 — cuenta_parte: persistir la división de una cuenta (cobro por partes).
-- Una cuenta (sales_order) se puede dividir para cobrarla en varias partes:
--   · PRODUCTOS: líneas concretas que se cobran y SALEN de la mesa (pedido COBRADA propio).
--   · IGUAL / IMPORTE: porciones del PENDIENTE (pago parcial + justificante); el remanente
--     de la mesa cierra con una factura al saldar.
-- Se persiste para que al volver a la mesa reaparezcan las partes y su estado de cobro.
-- Diseño y decisiones: docs/plan/dividir-cuenta-y-ciclo.md. Aditiva e idempotente.

create table if not exists public.cuenta_parte (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant(id) on delete cascade,
  order_id          uuid not null references public.sales_order(id) on delete cascade,
  indice            int  not null,
  tipo              text not null check (tipo in ('IGUAL','IMPORTE','PRODUCTOS')),
  importe           numeric(12,2) not null default 0,
  lineas            jsonb,                              -- solo PRODUCTOS: [{key,product_id,nombre,uds,precio}]
  cobrada           boolean not null default false,
  cobrada_at        timestamptz,
  payment_id        uuid references public.payment(id) on delete set null,
  cobrada_order_id  uuid references public.sales_order(id) on delete set null,  -- PRODUCTOS: pedido COBRADA que salió de la mesa
  client_id         uuid not null default gen_random_uuid(),  -- idempotencia + sync nodo↔nube
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists cuenta_parte_tenant_order_idx on public.cuenta_parte (tenant_id, order_id);
create unique index if not exists cuenta_parte_client_uq on public.cuenta_parte (tenant_id, client_id);

alter table public.cuenta_parte enable row level security;

drop policy if exists tenant_isolation on public.cuenta_parte;
create policy tenant_isolation on public.cuenta_parte
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop trigger if exists trg_set_tenant on public.cuenta_parte;
create trigger trg_set_tenant before insert on public.cuenta_parte
  for each row execute function public.set_tenant_id();

drop trigger if exists trg_cuenta_parte_updated on public.cuenta_parte;
create trigger trg_cuenta_parte_updated before update on public.cuenta_parte
  for each row execute function public.set_updated_at();

-- Realtime: el TPV escucha cambios para reflejar el estado de las partes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cuenta_parte') then
    alter publication supabase_realtime add table public.cuenta_parte;
  end if;
end $$;
