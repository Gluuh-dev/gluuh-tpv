-- 0118 — Emisión fiscal atómica y outbox AEAT (F6 entregas 6.3–6.4; plans/020).
--
-- Males que cierra:
--  · factura y desglose (`invoice_tax_line`) iban en DOS inserts: un fallo del
--    segundo dejaba una factura SIN impuestos, y solo se logueaba;
--  · nada impedía emitir DOS facturas del mismo pedido (reintento tras timeout);
--  · no había cola durable para el envío a la AEAT.
-- La numeración sigue siendo CAS sobre el UNIQUE(tenant,serie,numero): la RPC
-- devuelve COLISION y el caller re-lee la última huella y reintenta — la cadena
-- no se bifurca. El cálculo de la huella se queda en @gluuh/core (vector AEAT).

-- ── idempotencia pedido ↔ factura (0 facturas en la nube: índice directo) ─────
create unique index if not exists idx_invoice_order_unica
  on public.invoice (tenant_id, order_id) where order_id is not null;

-- ── outbox de envío AEAT (durable; el worker llega con 6.4 completo) ─────────
create table if not exists public.fiscal_outbox (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  invoice_id   uuid not null unique references public.invoice(id) on delete cascade,
  estado       text not null default 'PENDIENTE'
               constraint outbox_estado_valido check (estado in ('PENDIENTE','ENVIANDO','ACEPTADA','RECHAZADA','REINTENTABLE')),
  intentos     int not null default 0,
  lease_hasta  timestamptz,           -- el worker toma el evento con un lease
  ultimo_error text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_fiscal_outbox_pendientes
  on public.fiscal_outbox (estado, lease_hasta) where estado in ('PENDIENTE','REINTENTABLE');

alter table public.fiscal_outbox enable row level security;
alter table public.fiscal_outbox force row level security;
drop policy if exists fiscal_outbox_ver on public.fiscal_outbox;
create policy fiscal_outbox_ver on public.fiscal_outbox
  for select using (tenant_id = public.current_tenant_id() and public.operario_permite('admin.fiscal'));
revoke all on public.fiscal_outbox from public, anon;
grant select on public.fiscal_outbox to authenticated;
grant all on public.fiscal_outbox to service_role;

-- ── emisión ATÓMICA ──────────────────────────────────────────────────────────
-- Una transacción: factura + desglose + (si procede) evento outbox. Resultados:
--   OK        → emitida; invoice_id nuevo
--   EXISTE    → ese pedido YA tiene factura (reintento tras timeout): se devuelve
--               la existente — un reintento no consume otro número ni otra huella
--   COLISION  → número pisado por una emisión concurrente: re-lee y reintenta
--   NO_AUTORIZADO → el tenant del payload no es el del llamante
create or replace function public.emitir_factura_fiscal(
  p_factura jsonb,
  p_lineas  jsonb default '[]'::jsonb,
  p_encolar boolean default false
)
returns table (resultado text, invoice_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := nullif(p_factura->>'tenant_id','')::uuid;
  v_order  uuid := nullif(p_factura->>'order_id','')::uuid;
  v_id     uuid;
  v_constraint text;
begin
  if v_tenant is null or v_tenant is distinct from public.current_tenant_id() then
    return query select 'NO_AUTORIZADO'::text, null::uuid;
    return;
  end if;

  -- Idempotencia: si el pedido ya tiene factura, se devuelve ESA.
  if v_order is not null then
    select i.id into v_id from public.invoice i
     where i.tenant_id = v_tenant and i.order_id = v_order;
    if v_id is not null then
      return query select 'EXISTE'::text, v_id;
      return;
    end if;
  end if;

  begin
    insert into public.invoice (
      tenant_id, location_id, order_id, serie, numero, num_serie_factura,
      fecha_expedicion, nif_emisor, nombre_emisor, tipo, tipo_factura,
      dest_nif, dest_nombre, dest_domicilio,
      base_total, cuota_total, importe_total,
      huella, huella_anterior, qr_url, fecha_hora_huso, estado_aeat
    ) values (
      v_tenant,
      nullif(p_factura->>'location_id','')::uuid,
      v_order,
      p_factura->>'serie',
      (p_factura->>'numero')::bigint,
      p_factura->>'num_serie_factura',
      p_factura->>'fecha_expedicion',
      p_factura->>'nif_emisor',
      p_factura->>'nombre_emisor',
      coalesce(p_factura->>'tipo_factura','F2'),   -- `tipo` histórico = el mismo F1/F2
      coalesce(p_factura->>'tipo_factura','F2'),
      p_factura->>'dest_nif',
      p_factura->>'dest_nombre',
      p_factura->>'dest_domicilio',
      (p_factura->>'base_total')::numeric,
      (p_factura->>'cuota_total')::numeric,
      (p_factura->>'importe_total')::numeric,
      p_factura->>'huella',
      nullif(p_factura->>'huella_anterior',''),
      p_factura->>'qr_url',
      p_factura->>'fecha_hora_huso',
      'NO_ENVIADA'
    ) returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'idx_invoice_order_unica' then
      -- Carrera de DOS emisiones del mismo pedido: devolver la que ganó.
      select i.id into v_id from public.invoice i
       where i.tenant_id = v_tenant and i.order_id = v_order;
      return query select 'EXISTE'::text, v_id;
      return;
    end if;
    return query select 'COLISION'::text, null::uuid;  -- número pisado: reintentar
    return;
  end;

  insert into public.invoice_tax_line (tenant_id, invoice_id, tipo, base, cuota)
  select v_tenant, v_id, (l->>'tipo')::numeric, (l->>'base')::numeric, (l->>'cuota')::numeric
  from jsonb_array_elements(p_lineas) l;

  if p_encolar then
    insert into public.fiscal_outbox (tenant_id, invoice_id) values (v_tenant, v_id);
  end if;

  return query select 'OK'::text, v_id;
end $$;
revoke all on function public.emitir_factura_fiscal(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.emitir_factura_fiscal(jsonb, jsonb, boolean) to authenticated, service_role;
