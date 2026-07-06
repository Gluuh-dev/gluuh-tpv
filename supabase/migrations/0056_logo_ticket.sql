-- 0056 — Logo de ticket separado del logo de marca.
--   tenant_branding.logo_url        = logo original (color) para kiosko/pantallas.
--   tenant_branding.logo_ticket_url = logo pensado para la térmica (blanco y negro,
--                                      simple, alto contraste). La impresión cae a
--                                      logo_url cuando este está vacío.
-- Nota de espejo: tenant_branding no está reflejada en apps/api/db/schema.sql,
-- así que no hay nada que actualizar allí.
alter table public.tenant_branding add column if not exists logo_ticket_url text;
