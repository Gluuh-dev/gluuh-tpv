-- 0082 — Plantilla base para altas (consola de plataforma). Un tenant marcado
-- como plantilla es la fuente de lo que se clona en cada empresa nueva. El
-- sembrado pasa a crear SOLO los usuarios base; el catálogo vendrá del clonado.
-- (Aplicada por MCP el 08-07-2026.)

alter table public.tenant add column if not exists es_plantilla boolean not null default false;

-- "Gluuh (plataforma)" pasa a ser la PLANTILLA BASE (la editas como backoffice).
update public.tenant
   set es_plantilla = true, nombre = 'Plantilla base'
 where id = 'ca44a7c7-4234-49ea-ae01-75417fc15c35';

-- Solo puede haber una plantilla activa (índice único parcial).
create unique index if not exists tenant_una_plantilla on public.tenant (es_plantilla) where es_plantilla;

-- admin_sembrar_ejemplo: ahora SOLO usuarios base (admin/camarero/camarera).
-- El catálogo de ejemplo se retira: cada empresa clona la carta de la plantilla.
create or replace function public.admin_sembrar_ejemplo(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  perform set_config('app.tenant_id', p_tenant::text, true);
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'admin') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Admin', 'admin', 'PROPIETARIO', crypt('1111', gen_salt('bf')), crypt('1111', gen_salt('bf')), true);
  end if;
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'camarero') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Camarero', 'camarero', 'CAMARERO', crypt('2222', gen_salt('bf')), crypt('2222', gen_salt('bf')), true);
  end if;
  if not exists (select 1 from public.app_user where tenant_id = p_tenant and usr_app = 'camarera') then
    insert into public.app_user (tenant_id, nombre, usr_app, rol, pin_hash, clave_hash, activo)
    values (p_tenant, 'Camarera', 'camarera', 'CAMARERO', crypt('3333', gen_salt('bf')), crypt('3333', gen_salt('bf')), true);
  end if;
end;
$$;
