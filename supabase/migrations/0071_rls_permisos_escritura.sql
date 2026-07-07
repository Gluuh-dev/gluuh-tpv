-- 0071 · Respaldo RLS del sistema de permisos (defensa en profundidad).
-- Vector crítico: la AUTOESCALADA (reescribir un perfil/usuario para darse
-- permisos). Se protegen las ESCRITURAS de perfil y app_user; las lecturas siguen
-- abiertas (las necesitan el layout, el TPV y /empleados). PROPIETARIO siempre
-- puede. Fail-open en el permiso (si hay duda, permite), fail-closed en tenant
-- (la política permisiva existente aísla por tenant).
--
-- NOTA: los permisos viven SOLO en perfil.permisos (0048); el usuario los hereda
-- por app_user.perfil_id (0070). No existe app_user.permisos (0041 nunca se aplicó).

-- Resuelve el permiso EFECTIVO del usuario actual desde su perfil (perfil_id).
-- SECURITY DEFINER: lee app_user/perfil saltándose RLS → sin recursión.
-- Sin perfil = permitido; clave ausente/true = permitido; 'false' = bloqueado.
create or replace function operario_permite(p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select true
       from app_user u
       where u.auth_user_id = auth.uid()
         and u.rol in ('PROPIETARIO','ADMIN_PLATAFORMA')
       limit 1),
    (select (pf.permisos ->> p_permiso) is distinct from 'false'
       from app_user u
       join perfil pf on pf.id = u.perfil_id
       where u.auth_user_id = auth.uid()
       limit 1),
    true);
$$;
revoke all on function operario_permite(text) from public;
grant execute on function operario_permite(text) to authenticated;

-- perfil: crear/editar/borrar perfiles solo con 'admin.usuarios'.
create policy perfil_ins_admin on perfil as restrictive for insert
  with check (operario_permite('admin.usuarios'));
create policy perfil_upd_admin on perfil as restrictive for update
  using (operario_permite('admin.usuarios')) with check (operario_permite('admin.usuarios'));
create policy perfil_del_admin on perfil as restrictive for delete
  using (operario_permite('admin.usuarios'));

-- app_user: cambiar/borrar usuarios (rol, perfil…) solo con 'admin.usuarios'.
-- INSERT no se toca (provisión por trigger y crear_empleado por RPC, que saltan RLS).
create policy app_user_upd_admin on app_user as restrictive for update
  using (operario_permite('admin.usuarios')) with check (operario_permite('admin.usuarios'));
create policy app_user_del_admin on app_user as restrictive for delete
  using (operario_permite('admin.usuarios'));
