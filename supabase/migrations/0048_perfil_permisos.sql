-- =============================================================================
--  0048_perfil_permisos.sql — Permisos por perfil (plantillas de permisos).
--  Mismo formato jsonb que app_user.permisos (0041): flags con ausente =
--  permitido. Claves: modificar, descuento, borrar, invitar, cobrar.
-- =============================================================================

ALTER TABLE public.perfil
  ADD COLUMN IF NOT EXISTS permisos jsonb NOT NULL DEFAULT '{}'::jsonb;
