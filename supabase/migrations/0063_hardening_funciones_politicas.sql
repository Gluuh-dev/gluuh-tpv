-- 0063 — Seguridad/rendimiento (advisors): search_path fijo en funciones + dedup de políticas de caja.

-- 1) search_path inmutable (advisor function_search_path_mutable). Hardening seguro:
--    evita que un search_path mutable altere a qué objetos resuelve la función.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.setting_get(text, uuid, uuid) set search_path = public, pg_temp;
alter function public.setting_set(text, text, jsonb, uuid, uuid) set search_path = public, pg_temp;

-- 2) Políticas RLS duplicadas (advisor multiple_permissive_policies): cash_move y cash_session
--    tenían DOS políticas permisivas equivalentes; `cash_*_rw` ya aísla por tenant, así que
--    `tenant_isolation` era redundante (Postgres las evaluaba todas por consulta → 40 avisos).
drop policy if exists tenant_isolation on public.cash_move;
drop policy if exists tenant_isolation on public.cash_session;
