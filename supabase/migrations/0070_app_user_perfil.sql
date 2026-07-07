-- 0070 · Perfiles "de verdad": vincular operario ↔ perfil.
-- Hasta ahora "aplicar perfil" copiaba perfil.permisos dentro de app_user.permisos
-- (una vez, sin vínculo). Con este FK el perfil queda ENLAZADO al operario y el
-- panel resuelve las ZONAS del menú accesibles desde perfil.permisos.zonas.
-- ON DELETE SET NULL: al borrar un perfil, sus operarios quedan sin perfil (no se borran).

alter table app_user
  add column if not exists perfil_id uuid references perfil(id) on delete set null;

-- tenant_id como primera columna del índice (convención del repo).
create index if not exists idx_app_user_tenant_perfil on app_user(tenant_id, perfil_id);
