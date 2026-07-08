-- 0089 — Slug de empresa para URLs de la consola (/admin/empresas/bar-demo en
-- vez del UUID). Se autogenera del nombre en el insert (trigger, cubre el alta
-- por handle_new_user) con sufijo -2, -3… si colisiona. admin_resumen_empresas
-- lo devuelve para que la web enlace por slug. (Aplicada por MCP el 08-07-2026.)

alter table public.tenant add column if not exists slug text;

-- Normaliza un nombre a slug: minúsculas, sin acentos, [a-z0-9] y guiones.
create or replace function public.a_slug(p text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9]+', '-', 'g')), ''), 'empresa');
$$;

create or replace function public.tenant_slug_defecto()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  base text := a_slug(new.nombre);
  n int := 2;
begin
  if new.slug is null then
    new.slug := base;
    while exists (select 1 from tenant where slug = new.slug and id <> new.id) loop
      new.slug := base || '-' || n; n := n + 1;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_slug on public.tenant;
create trigger tenant_slug before insert on public.tenant
  for each row execute function public.tenant_slug_defecto();

-- Backfill de las empresas existentes (mismo criterio de desempate).
update public.tenant t set slug = s.slug
from (
  select id, base || case when rn = 1 then '' else '-' || rn end as slug
  from (
    select id, a_slug(nombre) as base,
           row_number() over (partition by a_slug(nombre) order by created_at) as rn
    from public.tenant
  ) x
) s
where t.id = s.id and t.slug is null;

create unique index if not exists tenant_slug_unico on public.tenant (slug);

-- admin_resumen_empresas: añade slug (misma definición de 0088 + columna).
drop function if exists public.admin_resumen_empresas();
create function public.admin_resumen_empresas()
returns table(
  id uuid, slug text, nombre text, cif text, email_admin text, plan text,
  codigo_instalacion text, es_plantilla boolean, activo boolean, licencia_limites jsonb,
  licencia_hasta date, licencia_modulos text[], created_at timestamptz,
  ciclo_pago text, forma_pago text, precio_periodo numeric, proximo_pago date,
  precio_calculado numeric,
  n_productos bigint, n_usuarios bigint, n_dispositivos bigint, n_dispositivos_online bigint
)
language sql
security definer
set search_path to 'public'
as $$
  select t.id, t.slug, t.nombre, t.cif, t.email_admin, t.plan,
         t.codigo_instalacion, t.es_plantilla, t.activo, t.licencia_limites,
         t.licencia_hasta, t.licencia_modulos, t.created_at,
         t.ciclo_pago, t.forma_pago, t.precio_periodo, t.proximo_pago,
         coalesce((select precio from tarifa_plataforma where clave = 'BASE'), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from device d
                       left join tarifa_plataforma tar on tar.clave = 'DISPOSITIVO_' || d.tipo
                       where d.tenant_id = t.id and d.vinculado_at is not null), 0)
           -- El primer TPV va incluido en la cuota base (plan Básica).
           - coalesce((select tar.precio from tarifa_plataforma tar
                       where tar.clave = 'DISPOSITIVO_TPV'
                         and exists (select 1 from device d
                                     where d.tenant_id = t.id and d.tipo = 'TPV'
                                       and d.vinculado_at is not null)), 0)
           + coalesce((select sum(coalesce(tar.precio, 0)) from unnest(t.licencia_modulos) mm
                       left join tarifa_plataforma tar on tar.clave = 'MODULO_' || mm), 0) as precio_calculado,
         (select count(*) from public.product  p where p.tenant_id = t.id),
         (select count(*) from public.app_user u where u.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id),
         (select count(*) from public.device   d where d.tenant_id = t.id and d.ultima_conexion > now() - interval '3 minutes')
  from public.tenant t
  where public.es_admin_plataforma()
  order by t.created_at desc;
$$;
revoke all on function public.admin_resumen_empresas() from public, anon;
grant execute on function public.admin_resumen_empresas() to authenticated, service_role;
