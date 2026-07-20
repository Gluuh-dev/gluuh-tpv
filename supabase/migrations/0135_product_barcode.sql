-- 0135 — Códigos de barras múltiples (ficha de Ágora §6).
--
-- Teníamos un solo `product.codigo_barras`. Un mismo producto llega con varios
-- EAN de verdad: la lata suelta y el pack de seis, o el mismo refresco de dos
-- proveedores con etiqueta distinta. Con un solo código, el escáner solo
-- reconoce uno y el resto se teclea a mano.
--
-- Ágora lo resuelve con una lista y «el primero será el principal». Igual aquí.
--
-- Aditivo. `product.codigo_barras` NO se retira: se queda como el PRINCIPAL, y
-- todo lo que hoy lo lee (venta por escáner, etiquetas) sigue igual. La tabla es
-- para poder tener MÁS de uno.

create table if not exists public.product_barcode (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id) on delete cascade,
  product_id uuid not null references public.product(id) on delete cascade,
  codigo     text not null,
  -- El principal es el que se imprime en la etiqueta y el que `codigo_barras`
  -- refleja. Solo uno por producto tiene sentido, pero no se fuerza con
  -- constraint: reordenar (cambiar cuál es el principal) sería un baile de dos
  -- escrituras que podría chocar; se controla en la app.
  principal  boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Un código no se repite DENTRO de un bar: si el escáner lee 8410... tiene que
-- resolver a UN producto, no a dos.
create unique index if not exists product_barcode_unico
  on public.product_barcode (tenant_id, codigo);
create index if not exists product_barcode_por_producto
  on public.product_barcode (product_id);

-- Los códigos que ya hay pasan a la tabla como principal. `on conflict do
-- nothing` por si dos productos comparten un código viejo (dato sucio): no se
-- cae la migración, simplemente el segundo no entra y se arregla a mano.
insert into public.product_barcode (tenant_id, product_id, codigo, principal)
select tenant_id, id, codigo_barras, true
from public.product
where codigo_barras is not null and codigo_barras <> ''
on conflict (tenant_id, codigo) do nothing;

alter table public.product_barcode enable row level security;
drop policy if exists product_barcode_tenant on public.product_barcode;
create policy product_barcode_tenant on public.product_barcode for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
