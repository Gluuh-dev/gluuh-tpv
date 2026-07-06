-- 0041 — Permisos por empleado (qué puede hacer cada camarero en el TPV).
-- jsonb de flags; ausente = permitido (no bloquea a los empleados existentes).
-- Claves: modificar, descuento, borrar, invitar, cobrar.

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS permisos jsonb NOT NULL DEFAULT '{}';
