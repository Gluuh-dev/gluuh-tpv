-- 0051 — Nombres de impresión por producto (null = usar product.nombre):
--   nombre_ticket: cómo sale en el ticket y la factura del cliente.
--   nombre_cocina: cómo sale en las comandas de cocina/barra y en el ticket de
--                  camarero (abreviado, p. ej. "BOC CALAMAR").
alter table public.product add column if not exists nombre_ticket text;
alter table public.product add column if not exists nombre_cocina text;
