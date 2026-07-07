-- 0072 · RLS de escritura del catálogo por 'admin.catalogo' (defensa en profundidad).
-- Solo tablas que edita EXCLUSIVAMENTE el backoffice. Se EXCLUYEN a propósito
-- `product`/`product_price`: el TPV escribe `product` (agotado "86" y creación
-- rápida) — son operaciones de TPV, no gestión de catálogo, y pedirían un permiso
-- de acción de TPV aparte (pendiente). Lecturas abiertas; PROPIETARIO siempre puede;
-- reutiliza operario_permite() (0071). Composición: AND con la permisiva por tenant.
--
-- Nota: `tax_rate` (fiscal) ya está cerrado (RLS activo SIN políticas → solo por RPC
-- SECURITY DEFINER); `setting` es transversal (no se gatea por un solo permiso).

create policy family_ins_cat on family as restrictive for insert
  with check (operario_permite('admin.catalogo'));
create policy family_upd_cat on family as restrictive for update
  using (operario_permite('admin.catalogo')) with check (operario_permite('admin.catalogo'));
create policy family_del_cat on family as restrictive for delete
  using (operario_permite('admin.catalogo'));

create policy category_ins_cat on category as restrictive for insert
  with check (operario_permite('admin.catalogo'));
create policy category_upd_cat on category as restrictive for update
  using (operario_permite('admin.catalogo')) with check (operario_permite('admin.catalogo'));
create policy category_del_cat on category as restrictive for delete
  using (operario_permite('admin.catalogo'));

create policy modgrp_ins_cat on modifier_group as restrictive for insert
  with check (operario_permite('admin.catalogo'));
create policy modgrp_upd_cat on modifier_group as restrictive for update
  using (operario_permite('admin.catalogo')) with check (operario_permite('admin.catalogo'));
create policy modgrp_del_cat on modifier_group as restrictive for delete
  using (operario_permite('admin.catalogo'));
