-- 0122 — Identidad global: CONTRACT (F1 entrega 1.5).
--
-- ⛔ NO APLICAR TODAVÍA. Esta migración retira el modelo antiguo y solo puede
-- entrar cuando el canary de F1 esté verde. CONDICIONES (todas):
--   1. 0111–0113 llevan días en producción y las sesiones activas se renovaron
--      (el contexto por sesión funciona en el panel real);
--   2. `pnpm contrato:check` y la matriz de identidad del nodo pasan;
--   3. ningún caller depende ya de la unicidad global de email/auth
--      (rg "auth_user_id" y "eq.email" revisados);
--   4. puerta 8 de la guía 19 (limpieza de legado) aprobada por el usuario.
-- Hasta entonces vive en el repo como el plan ejecutable de la contracción.
--
-- Qué hace: elimina las DOS unicidades globales que impiden que una cuenta
-- pertenezca a varias empresas, y las sustituye por la unicidad correcta
-- (una membresía por cuenta y empresa). No borra columnas ni datos.

-- La unicidad global de auth_user_id: fuera (una persona, varias empresas).
drop index if exists public.app_user_auth_user_id_unico;

-- La unicidad GLOBAL de email: fuera. La unicidad que sí tiene sentido es por
-- empresa (dos empleados de la MISMA empresa no comparten email).
drop index if exists public.idx_user_email;
create unique index if not exists idx_app_user_email_por_tenant
  on public.app_user (tenant_id, lower(email)) where email is not null and email <> '';

-- La unicidad nueva: una cuenta = una membresía por empresa.
create unique index if not exists idx_app_user_cuenta_tenant_unico
  on public.app_user (tenant_id, cuenta_id) where cuenta_id is not null;

-- Nota deliberada: la rama transicional del claim `tenant_id` en
-- current_tenant_id() (0113, prioridad 3) NO se retira aquí — el auth del nodo
-- la usa. Se retirará cuando el nodo emita `session_id` (F4.2/actualización de
-- nodos), con su propia migración.
