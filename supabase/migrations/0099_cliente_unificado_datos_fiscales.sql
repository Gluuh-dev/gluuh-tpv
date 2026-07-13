-- 0099 — UN solo cliente, y con datos fiscales: poder emitir FACTURA COMPLETA.
--
-- AGUJERO ENCONTRADO el 13-07-2026 auditando "qué falta por poder configurar".
-- Había DOS tablas de clientes, desconectadas entre sí:
--
--   · `client`   (nombre, nif, email, telefono, notas)
--        La usa SOLO el backoffice (página Clientes). Tiene NIF…
--        pero es HUÉRFANA: ninguna FK apunta a ella, así que un cliente creado
--        en el backoffice NO se puede enganchar jamás a una venta.
--
--   · `customer` (nombre, email, telefono, + fidelización)
--        La usa SOLO el TPV, y es a la que apuntan `sales_order.customer_id` y
--        `reservation.customer_id`. Es la de verdad… y NO TIENE NIF.
--
-- Consecuencias reales, hoy, en producción:
--   1. Los clientes del backoffice son invisibles para el TPV, y los del TPV
--      invisibles para el backoffice. Dos ficheros de clientes que nunca se ven.
--   2. La única tabla que se puede enganchar a una venta es justo la que no tiene
--      NIF → **la "Factura completa" del modal de cobro es imposible de emitir**.
--      (De hecho `invoice.dest_nif/dest_nombre/dest_domicilio` no las escribía nadie
--      y `tipo_factura` estaba fijo a "F2" = simplificada.)
--
-- En España un cliente empresa o autónomo puede EXIGIR factura completa con su NIF
-- (art. 6 del Reglamento de Facturación). Sin esto no se puede vender a empresas.
-- Y con VERIFACTU a punto de activarse, esto es bloqueante.
--
-- SOLUCIÓN: una sola tabla de clientes, `customer` (la que ya está enlazada a las
-- ventas), con los datos que exige una factura completa. `client` se vacía en ella
-- y desaparece.

-- ── 1. `customer` gana los datos fiscales ────────────────────────────────────
alter table public.customer
  add column if not exists nif           text,
  add column if not exists direccion     text,
  add column if not exists codigo_postal text,
  add column if not exists poblacion     text,
  add column if not exists provincia     text,
  add column if not exists notas         text;

comment on column public.customer.nif is
  'NIF/CIF. Con NIF la factura se emite COMPLETA (AEAT F1); sin NIF, simplificada (F2).';

-- Buscar por NIF al facturar (el camarero teclea el NIF que le dan en la barra).
create index if not exists idx_customer_nif on public.customer (tenant_id, nif)
  where nif is not null;

-- ── 2. Traspasar los clientes de `client` a `customer` y retirar la duplicada ──
-- Se hace solo si `client` existe (en instalaciones nuevas ya no estará).
do $$
begin
  if to_regclass('public.client') is not null then
    insert into public.customer (tenant_id, nombre, nif, email, telefono, notas)
    select c.tenant_id, c.nombre, c.nif, c.email, c.telefono, c.notas
      from public.client c
     where c.nombre is not null
       -- no duplicar si ya existe ese cliente en customer (mismo NIF, o mismo nombre)
       and not exists (
         select 1 from public.customer u
          where u.tenant_id = c.tenant_id
            and (
              (c.nif is not null and u.nif = c.nif)
              or lower(u.nombre) = lower(c.nombre)
            )
       );

    drop table public.client;
  end if;
end $$;
