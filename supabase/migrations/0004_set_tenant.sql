-- =============================================================================
--  0004_set_tenant.sql — Auto-asigna tenant_id en inserciones desde el cliente.
--  Así la app (cliente autenticado) inserta sin pasar tenant_id: el trigger lo
--  rellena desde current_tenant_id() y la RLS (WITH CHECK) cuadra.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_tenant_id() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sin tenant (no autenticado)';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['category','product','room','restaurant_table','customer','reservation','sales_order','order_line','payment']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()', t);
  END LOOP;
END$$;
