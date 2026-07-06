-- 0062 — Rendimiento: índice en toda clave foránea sin cubrir (advisor unindexed_foreign_keys, 73 casos).
-- Recorre las FK de `public` y crea un índice en su columna líder si no hay ninguno que empiece por ella.
-- Idempotente y seguro: solo añade índices; nada existente cambia. Deja las 73 FK sin índice en 0.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and k.ord = 1
  loop
    if not exists (
      select 1 from pg_index i
      join pg_attribute a2 on a2.attrelid = i.indrelid and a2.attnum = i.indkey[0]
      where i.indrelid = r.tbl::regclass and a2.attname = r.col
    ) then
      execute format(
        'create index if not exists %I on %s (%I)',
        'idx_fk_' || replace(r.tbl, 'public.', '') || '_' || r.col, r.tbl, r.col);
    end if;
  end loop;
end $$;
