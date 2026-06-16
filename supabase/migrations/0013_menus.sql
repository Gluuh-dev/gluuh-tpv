-- =============================================================================
--  0013_menus.sql — Menús/combos (Ágora: Catálogo → Menús)
--  Un menú tiene grupos (Primero, Segundo, Postre); cada grupo ofrece productos
--  a elegir. ponytail: 1 elección por grupo; añadir min/max si hace falta.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.menu (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  precio       numeric(12,2) NOT NULL DEFAULT 0,   -- precio fijo del menú (imp. incluido)
  clase_fiscal text NOT NULL DEFAULT 'REDUCIDO',
  activo       boolean DEFAULT true,
  orden        int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_group (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  menu_id    uuid NOT NULL REFERENCES public.menu(id) ON DELETE CASCADE,
  nombre     text NOT NULL,                          -- "Primero", "Segundo", "Postre"
  orden      int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.menu_choice (
  tenant_id  uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES public.menu_group(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.product(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, product_id)
);

DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.menu_group ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.menu_choice ENABLE ROW LEVEL SECURITY';
END $$;

DROP POLICY IF EXISTS menu_rw ON public.menu;
CREATE POLICY menu_rw ON public.menu FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS menu_group_rw ON public.menu_group;
CREATE POLICY menu_group_rw ON public.menu_group FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS menu_choice_rw ON public.menu_choice;
CREATE POLICY menu_choice_rw ON public.menu_choice FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

GRANT ALL ON public.menu, public.menu_group, public.menu_choice TO authenticated;
