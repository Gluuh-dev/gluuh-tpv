-- =============================================================================
--  0109_cliente_tarifa_descuento_saldo.sql — "Cómo se le vende" en la ficha de cliente
--  (mockup gluuh-cliente.html): tarifa aplicada, descuento fijo y saldo/deuda.
--   · tarifa_id     → tabla `tarifa` (lista de precios del cliente); NULL = General.
--   · descuento_pct → descuento fijo % que se le aplica.
--   · saldo         → deuda pendiente (para el filtro "Con deuda"); lo moverán los cobros.
-- =============================================================================

alter table public.customer
  add column if not exists tarifa_id     uuid references public.tarifa(id) on delete set null,
  add column if not exists descuento_pct numeric(5,2)  not null default 0,
  add column if not exists saldo         numeric(12,2) not null default 0;

create index if not exists customer_tarifa_idx on public.customer (tarifa_id);
-- Índice parcial para listar deudores rápido (filtro "Con deuda").
create index if not exists customer_deuda_idx on public.customer (saldo) where saldo <> 0;
