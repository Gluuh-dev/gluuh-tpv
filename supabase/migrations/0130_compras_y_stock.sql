-- 0130 — COMPRAS: el documento que faltaba, y stock por artículo.
--
-- Hasta ahora se podía anotar que entró algo (`stock_move`: ingrediente, tipo,
-- cantidad, motivo) pero no GESTIONAR una compra: no había albarán, ni
-- proveedor, ni precio, ni fecha de factura. Y el stock solo colgaba de
-- `ingredient`, así que para llevar el control de una caja de cerveza —que se
-- compra y se vende tal cual— había que inventarse un ingrediente por cada
-- referencia. Papeleo inútil.
--
-- La decisión de fondo: **una línea de compra apunta a un ARTÍCULO o a un
-- INGREDIENTE**, nunca a los dos. Un bar compra las dos cosas: botellas que
-- revende y kilos de tomate que transforma. El escandallo (`recipe_item`) solo
-- hace falta para lo segundo.
--
-- Todo ADITIVO e idempotente.

-- ── Almacén por defecto ─────────────────────────────────────────────────────
-- `warehouse` ya existía (vacía). Se le añade `es_principal` para no tener que
-- elegir almacén en un bar que solo tiene uno, que son casi todos.
alter table public.warehouse add column if not exists es_principal boolean not null default false;

-- ── Stock POR ARTÍCULO ──────────────────────────────────────────────────────
-- `product.controla_stock` (0128) ya decía "este artículo lleva cuenta"; hasta
-- ahora no tenía dónde llevarla.
alter table public.product add column if not exists stock         numeric(12,3) not null default 0;
alter table public.product add column if not exists stock_minimo  numeric(12,3);
comment on column public.product.stock is 'Existencias del artículo. Solo se mueve si controla_stock.';
comment on column public.product.stock_minimo is 'Aviso de reposición. null = sin aviso.';

-- ── Proveedores: lo que hacía falta para recibir un albarán ─────────────────
alter table public.supplier add column if not exists activo boolean not null default true;
alter table public.supplier add column if not exists direccion text;

-- Qué referencia usa el proveedor para lo que nosotros llamamos X. Sin esto,
-- cada albarán hay que casarlo a mano línea por línea.
create table if not exists public.supplier_ref (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  supplier_id   uuid not null references public.supplier(id) on delete cascade,
  product_id    uuid references public.product(id) on delete cascade,
  ingredient_id uuid references public.ingredient(id) on delete cascade,
  referencia    text not null,
  precio_compra numeric(12,4),
  updated_at    timestamptz not null default now(),
  -- O artículo o ingrediente, nunca los dos ni ninguno.
  constraint supplier_ref_uno_u_otro check (num_nonnulls(product_id, ingredient_id) = 1)
);
create unique index if not exists supplier_ref_unica
  on public.supplier_ref (tenant_id, supplier_id, referencia);

-- ── El documento de compra ──────────────────────────────────────────────────
create table if not exists public.purchase_doc (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  supplier_id  uuid references public.supplier(id) on delete set null,
  warehouse_id uuid references public.warehouse(id) on delete set null,
  -- ALBARAN entra mercancía; FACTURA es el documento que se paga. Un mismo
  -- pedido puede tener varios albaranes y una sola factura.
  tipo         text not null default 'ALBARAN' check (tipo in ('ALBARAN', 'FACTURA')),
  -- BORRADOR se puede tocar; RECIBIDO ya ha movido el stock y NO se edita: se
  -- corrige con otro documento, como en cualquier contabilidad seria.
  estado       text not null default 'BORRADOR' check (estado in ('BORRADOR', 'RECIBIDO', 'ANULADO')),
  numero       text,
  fecha        date not null default current_date,
  fecha_pago   date,
  base         numeric(12,2) not null default 0,
  impuestos    numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists purchase_doc_por_fecha on public.purchase_doc (tenant_id, fecha desc);
-- El número de un proveedor no se repite: es lo que evita meter dos veces el
-- mismo albarán, que es EL error clásico y descuadra el stock y el gasto.
create unique index if not exists purchase_doc_numero_unico
  on public.purchase_doc (tenant_id, supplier_id, numero) where numero is not null;

create table if not exists public.purchase_line (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  purchase_doc_id uuid not null references public.purchase_doc(id) on delete cascade,
  product_id      uuid references public.product(id) on delete set null,
  ingredient_id   uuid references public.ingredient(id) on delete set null,
  -- Se guarda el texto del albarán aunque esté casado: si mañana se borra el
  -- artículo, la compra tiene que seguir contando qué se compró.
  descripcion     text not null,
  cantidad        numeric(12,3) not null default 1,
  unidad          text,
  precio_unitario numeric(12,4) not null default 0,
  descuento_pct   numeric(5,2) not null default 0,
  tipo_impositivo numeric(5,2) not null default 0,
  orden           int not null default 0,
  updated_at      timestamptz not null default now()
);
create index if not exists purchase_line_por_doc on public.purchase_line (purchase_doc_id, orden);

-- ── Trazar de dónde salió cada movimiento ───────────────────────────────────
-- `stock_move` pasa a poder hablar de artículos, no solo de ingredientes.
alter table public.stock_move add column if not exists product_id       uuid references public.product(id) on delete set null;
alter table public.stock_move add column if not exists purchase_line_id uuid references public.purchase_line(id) on delete set null;
alter table public.stock_move add column if not exists warehouse_id     uuid references public.warehouse(id) on delete set null;
alter table public.stock_move alter column ingredient_id drop not null;
comment on table public.stock_move is
  'Movimientos de existencias. Apunta a product_id O a ingredient_id; purchase_line_id dice de qué compra vino.';

-- ── RLS: el mismo patrón que el resto del catálogo ──────────────────────────
alter table public.purchase_doc  enable row level security;
alter table public.purchase_line enable row level security;
alter table public.supplier_ref  enable row level security;

drop policy if exists purchase_doc_tenant  on public.purchase_doc;
drop policy if exists purchase_line_tenant on public.purchase_line;
drop policy if exists supplier_ref_tenant  on public.supplier_ref;

create policy purchase_doc_tenant  on public.purchase_doc  for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy purchase_line_tenant on public.purchase_line for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
create policy supplier_ref_tenant  on public.supplier_ref  for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
