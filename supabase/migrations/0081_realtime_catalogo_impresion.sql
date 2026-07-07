-- 0081 — Publicar en realtime las tablas que el TPV/Desktop escuchan (plan 09).
-- print_job (C3: el despachador de Desktop imprime al instante) y catálogo
-- (D3: el TPV se refresca solo al cambiar producto/categoría/familia).
-- (Aplicada por MCP el 07-07-2026.)
do $$
declare t text;
begin
  foreach t in array array['product','category','family','print_job'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
