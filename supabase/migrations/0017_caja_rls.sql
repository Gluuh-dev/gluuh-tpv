-- 0017_caja_rls.sql — asegurar RLS por tenant en caja (idempotente)
ALTER TABLE public.cash_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_move ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_session_rw ON public.cash_session;
CREATE POLICY cash_session_rw ON public.cash_session FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS cash_move_rw ON public.cash_move;
CREATE POLICY cash_move_rw ON public.cash_move FOR ALL
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.cash_session, public.cash_move TO authenticated;
