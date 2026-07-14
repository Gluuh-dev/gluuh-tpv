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

-- ── Y QUE POSTGREST SE ENTERE DE LOS CAMBIOS ─────────────────────────────────
--
-- PostgREST guarda el esquema EN MEMORIA. Una tabla o una función nuevas no existen para
-- él hasta que se lo dicen: responde `PGRST202` («no encuentro esa función») aunque esté
-- ahí delante, en la base de datos.
--
-- En la nube esto no se nota porque Supabase trae estos dos disparadores de fábrica. En un
-- Postgres pelado no están, y el nodo se comporta distinto que la nube — que es justo lo
-- que no puede pasar. Lo pagas un día a las dos de la mañana, aplicando un arreglo urgente
-- en el bar de un cliente: la migración entra, y el TPV sigue diciendo que no existe.
--
-- (El camino normal de actualización reinicia PostgREST, así que ya se enteraba. Esto cubre
-- al de soporte que aplica un SQL a mano sobre un nodo en marcha.)
create or replace function public.pgrst_ddl_watch()
returns event_trigger language plpgsql as $$
begin
  notify pgrst, 'reload schema';
end;
$$;

create or replace function public.pgrst_drop_watch()
returns event_trigger language plpgsql as $$
begin
  notify pgrst, 'reload schema';
end;
$$;

drop event trigger if exists pgrst_ddl_watch;
create event trigger pgrst_ddl_watch on ddl_command_end
  execute function public.pgrst_ddl_watch();

drop event trigger if exists pgrst_drop_watch;
create event trigger pgrst_drop_watch on sql_drop
  execute function public.pgrst_drop_watch();
