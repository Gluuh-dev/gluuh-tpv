-- 0090 — El slug de empresa pasa a ser un código ALEATORIO corto (12 hex de un
-- UUID generado), no derivado del nombre: dos bares con el mismo nombre no
-- pueden chocar en la URL. Sustituye el generador de 0089 y regenera los
-- existentes. (Aplicada por MCP el 08-07-2026.)

create or replace function public.tenant_slug_defecto()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.slug is null then
    loop
      new.slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      exit when not exists (select 1 from tenant where slug = new.slug and id <> new.id);
    end loop;
  end if;
  return new;
end;
$$;

-- Regenera los slugs existentes (eran derivados del nombre).
update public.tenant set slug = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

-- El normalizador de nombres ya no se usa.
drop function if exists public.a_slug(text);
