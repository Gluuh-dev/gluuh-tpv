-- 0125 — Para llevar y Reservas (pantallas del TPV, mockups gluuh-para-llevar /
-- gluuh-reservas). Aditiva e idempotente.
--   reservation: teléfono, canal (TELEFONO/WEB/EN_PERSONA/TPV), alergias, y el
--     estado TERMINADA (el CHECK ya admitía PENDIENTE/CONFIRMADA/SENTADA/
--     CANCELADA/NO_SHOW). El turno se deriva de la hora y el aforo de las mesas.
--   sales_order: entrega_at (hora prometida), direccion (reparto; sin dirección =
--     recogida), canal_pedido (TELEFONO/WEB/MOSTRADOR), y el estado de preparación
--     EN_CAMINO (reparto en moto) en el CHECK.

alter table public.reservation add column if not exists telefono text;
alter table public.reservation add column if not exists canal    text;
alter table public.reservation add column if not exists alergias text;

alter table public.reservation drop constraint if exists reservation_estado_check;
alter table public.reservation add constraint reservation_estado_check
  check (estado = any (array['PENDIENTE','CONFIRMADA','SENTADA','CANCELADA','NO_SHOW','TERMINADA']));

alter table public.sales_order add column if not exists entrega_at   timestamptz;
alter table public.sales_order add column if not exists direccion    text;
alter table public.sales_order add column if not exists canal_pedido text;

alter table public.sales_order drop constraint if exists sales_order_estado_preparacion_check;
alter table public.sales_order add constraint sales_order_estado_preparacion_check
  check (estado_preparacion = any (array['PENDIENTE','EN_PREPARACION','LISTO','EN_CAMINO','ENTREGADO']));
