-- 0059 — Atribución de camarero por LÍNEA (varios camareros en la misma cuenta).
-- Hoy solo se guarda el operario que ABRIÓ la cuenta (sales_order.user_id).
-- Con esto, cada order_line puede sellar quién la añadió (el operario activo en
-- ese momento; útil tras el velo de re-login por inactividad). Null = heredado
-- del pedido. Lo consume el TPV al insertar líneas.
alter table public.order_line
  add column if not exists user_id uuid references public.app_user(id) on delete set null;
