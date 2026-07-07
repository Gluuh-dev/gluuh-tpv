-- 0079 — Impresión compartida y enrutado multi-barra (guía 15 §6, plan 09 bloque C).
-- printer: impresoras del local declaradas una vez. print_job: cola por la nube
-- (cualquier terminal encola; el equipo con la impresora despacha). print_route:
-- estación × zona → impresora (una mesa de Terraza imprime en su barra).
-- (Aplicada por MCP el 07-07-2026.)

-- Impresoras del tenant --------------------------------------------------------
create table if not exists public.printer (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  location_id uuid references public.location(id) on delete set null,
  nombre      text not null,
  rol         text not null default 'TICKETS' check (rol in ('TICKETS','COCINA','BARRA','ETIQUETAS')),
  transporte  text not null default 'RED' check (transporte in ('RED','USB')),
  destino     text,                    -- "192.168.1.201:9100" (RED) o ruta/id USB
  ancho       int  not null default 48,-- caracteres (58mm≈32, 80mm≈48)
  tipo        text not null default 'EPSON' check (tipo in ('EPSON','STAR')),
  device_id   uuid references public.device(id) on delete set null, -- equipo que la despacha
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.printer enable row level security;
drop policy if exists printer_rw on public.printer;
create policy printer_rw on public.printer for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
drop trigger if exists trg_set_tenant on public.printer;
create trigger trg_set_tenant before insert on public.printer for each row execute function set_tenant_id();
create index if not exists printer_tenant_idx on public.printer(tenant_id);
create index if not exists printer_device_idx on public.printer(tenant_id, device_id);

-- Cola de trabajos de impresión -----------------------------------------------
create table if not exists public.print_job (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  printer_id    uuid not null references public.printer(id) on delete cascade,
  payload       jsonb not null,        -- { lineas[], cortar, abrirCajon, qr }
  estado        text not null default 'ENCOLADO' check (estado in ('ENCOLADO','IMPRESO','ERROR')),
  intentos      int  not null default 0,
  error         text,
  origen_device uuid,                  -- device que lo generó (traza)
  client_id     text,                  -- idempotencia (no imprimir dos veces)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.print_job enable row level security;
drop policy if exists print_job_rw on public.print_job;
create policy print_job_rw on public.print_job for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
drop trigger if exists trg_set_tenant on public.print_job;
create trigger trg_set_tenant before insert on public.print_job for each row execute function set_tenant_id();
create index if not exists print_job_despacho_idx on public.print_job(tenant_id, printer_id, estado);
create unique index if not exists print_job_idem_idx on public.print_job(tenant_id, client_id) where client_id is not null;

-- Reglas de enrutado: estación × zona → impresora ------------------------------
create table if not exists public.print_route (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id) on delete cascade,
  estacion   text not null,            -- COCINA/BARRA/... (order_line.estacion)
  room_id    uuid references public.room(id) on delete cascade, -- null = cualquier zona
  printer_id uuid not null references public.printer(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.print_route enable row level security;
drop policy if exists print_route_rw on public.print_route;
create policy print_route_rw on public.print_route for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
drop trigger if exists trg_set_tenant on public.print_route;
create trigger trg_set_tenant before insert on public.print_route for each row execute function set_tenant_id();
create index if not exists print_route_idx on public.print_route(tenant_id, estacion, room_id);
