-- 0080 — Salud del parque de dispositivos (plan 09, D1). Cada equipo reporta su
-- última conexión y versión; el backoffice muestra "en línea / última vez".
-- (Aplicada por MCP el 07-07-2026.)
alter table public.device add column if not exists ultima_conexion timestamptz;
alter table public.device add column if not exists version text;

-- Heartbeat: el dispositivo (con su token) marca que sigue vivo. SECURITY DEFINER
-- acotada a su propia fila por device_id (el token del dispositivo lo aporta la app).
create or replace function public.device_heartbeat(p_device uuid, p_version text default null)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.device
     set ultima_conexion = now(),
         version = coalesce(nullif(p_version, ''), version)
   where id = p_device;
$$;
grant execute on function public.device_heartbeat(uuid, text) to anon, authenticated, service_role;
