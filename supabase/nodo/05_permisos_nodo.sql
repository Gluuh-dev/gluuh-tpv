-- 05 — PERMISOS. Se pasa al final: después de las migraciones, y después de cada
-- actualización que traiga tablas nuevas.
--
-- `ALTER DEFAULT PRIVILEGES` (en 00_bootstrap) cubre lo que se cree A PARTIR de ahí,
-- pero no lo que ya existía. Esta pasada iguala lo de antes con lo de después, y es
-- idempotente: se puede ejecutar mil veces.
--
-- Sin esto, `service_role` (con la que se conecta el sincronizador) se come un
-- «permission denied for table X» en cuanto aparece una tabla nueva — y las ventas se
-- quedarían encerradas en el bar sin que nadie entienda por qué.

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- `authenticated` es quien entra desde el TPV: la RLS sigue filtrando por tenant, el
-- GRANT sólo dice "puedes intentarlo".
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
