-- 0107_semilla_terminal_defecto.sql
--
-- TERMINAL POR DEFECTO al crear una empresa: un TPV listo para conectar, sin tener que crear
-- la credencial a mano. Igual que ya se siembran operarios por defecto (1111/2222…), aquí se
-- siembra un dispositivo TPV con usuario `tpv1` y contraseña `121212`.
--
-- Es un DEFECTO de conveniencia (como los operarios de ejemplo): pensado para arrancar rápido
-- y CAMBIARSE. Cada empresa tiene su propio `tpv1` (usuario único por tenant, 0105).
--
-- OJO sync: para que un TERMINAL pueda conectar, este dispositivo (con su `clave_hash`) tiene
-- que estar también en el Postgres del NODO. Verificar que `device` (incl. clave_hash) baja al
-- nodo al provisionar/sincronizar. Si no, la credencial existe en la nube pero el nodo no la
-- puede comprobar.
create or replace function public.admin_sembrar_terminal_defecto(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_loc uuid;
  v_dev uuid;
begin
  -- Idempotente: si ya hay un terminal 'tpv1' en esta empresa, no se toca nada.
  if exists (select 1 from public.device where tenant_id = p_tenant and lower(usuario) = 'tpv1') then
    return;
  end if;

  select id into v_loc from public.location where tenant_id = p_tenant order by created_at limit 1;
  if v_loc is null then
    return; -- sin local no se puede crear el dispositivo; se sembrará cuando exista
  end if;

  insert into public.device (tenant_id, location_id, tipo, modulo, nombre, vinculado_at)
    values (p_tenant, v_loc, 'TPV', 'TPV', 'TPV 1', now())
    returning id into v_dev;

  -- La credencial (bcrypt en Postgres, 0105). tpv1 / 121212.
  perform public.fijar_clave_dispositivo(v_dev, 'tpv1', '121212');
end;
$$;

revoke all on function public.admin_sembrar_terminal_defecto(uuid) from public;
grant execute on function public.admin_sembrar_terminal_defecto(uuid) to service_role;
