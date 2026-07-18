-- 0126_combinar_copas.sql — Combinar copas (plan 24, tarea 7.1)
--
-- Una copa "combinable" se vende eligiendo con qué refresco va (combinado). El flag
-- vive a nivel de FAMILIA (todas sus copas lo son por defecto) y se puede OVERRIDE por
-- producto: product.combinable NULL = hereda de la familia; true/false = fuerza.
--
-- La categoría de la que salen los "con qué" (refrescos) NO va en columna: se configura
-- por el mecanismo `setting` con la clave `tpv.combinados.categoria_id` (precedencia
-- DEVICE > LOCAL > GLOBAL, como el resto de config del TPV).
--
-- Aditiva e idempotente. No cambia RLS: family/product ya la tienen por tenant_id.

alter table family  add column if not exists combinable boolean not null default false;
alter table product add column if not exists combinable boolean;  -- NULL = hereda de la familia

comment on column family.combinable  is 'Las copas de esta familia se venden como combinado (elegir refresco). Plan 24 / 7.1';
comment on column product.combinable is 'Override del combinable de la familia: NULL hereda, true/false fuerza. Plan 24 / 7.1';
