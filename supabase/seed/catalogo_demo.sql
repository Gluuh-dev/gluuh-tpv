-- Enriquece el catálogo del tenant demo: familias, clase fiscal + IVA automático,
-- y categorías/productos de ejemplo. Idempotente.
DO $$
DECLARE
  t uuid := '11111111-1111-1111-1111-111111111111';
  terr text;
  fam_beb uuid; fam_com uuid; fam_pos uuid;
  cat_vinos uuid; cat_post uuid;
BEGIN
  SELECT COALESCE(territorio_fiscal,'PENINSULA_BALEARES') INTO terr
  FROM location WHERE tenant_id = t ORDER BY created_at LIMIT 1;
  terr := COALESCE(terr, 'PENINSULA_BALEARES');

  -- Familias (borrar y recrear → idempotente)
  DELETE FROM family WHERE tenant_id = t;
  INSERT INTO family (tenant_id, nombre, orden, color) VALUES (t, 'Bebidas', 1, '#0ea5e9') RETURNING id INTO fam_beb;
  INSERT INTO family (tenant_id, nombre, orden, color) VALUES (t, 'Comidas', 2, '#e11d48') RETURNING id INTO fam_com;
  INSERT INTO family (tenant_id, nombre, orden, color) VALUES (t, 'Postres', 3, '#7c3aed') RETURNING id INTO fam_pos;

  -- Enlazar categorías existentes a familia (heurística por nombre)
  UPDATE category SET family_id = fam_beb WHERE tenant_id = t AND (
    nombre ILIKE '%bebid%' OR nombre ILIKE '%refresc%' OR nombre ILIKE '%cerve%' OR
    nombre ILIKE '%vino%' OR nombre ILIKE '%caf%' OR nombre ILIKE '%copa%' OR nombre ILIKE '%bar%');
  UPDATE category SET family_id = fam_pos WHERE tenant_id = t AND (
    nombre ILIKE '%postre%' OR nombre ILIKE '%dulce%' OR nombre ILIKE '%helad%');
  UPDATE category SET family_id = fam_com WHERE tenant_id = t AND family_id IS NULL;

  -- Clase fiscal + IVA automático en TODOS los productos del demo
  UPDATE product SET clase_fiscal = CASE WHEN es_alcohol THEN 'GENERAL' ELSE 'REDUCIDO' END WHERE tenant_id = t;
  UPDATE product p SET tipo_impositivo = (
    SELECT porcentaje FROM tax_rate WHERE territorio = terr AND clase_fiscal = p.clase_fiscal
  ) WHERE tenant_id = t;

  -- Ejemplos extra (idempotente por nombre)
  DELETE FROM category WHERE tenant_id = t AND nombre IN ('Vinos', 'Postres caseros');

  INSERT INTO category (tenant_id, nombre, orden, family_id) VALUES (t, 'Vinos', 50, fam_beb) RETURNING id INTO cat_vinos;
  INSERT INTO product (tenant_id, category_id, nombre, precio, clase_fiscal, tipo_impositivo, es_alcohol, disponible) VALUES
    (t, cat_vinos, 'Copa de vino tinto', 2.80, 'GENERAL', (SELECT porcentaje FROM tax_rate WHERE territorio = terr AND clase_fiscal = 'GENERAL'), true, true),
    (t, cat_vinos, 'Botella Rioja crianza', 16.00, 'GENERAL', (SELECT porcentaje FROM tax_rate WHERE territorio = terr AND clase_fiscal = 'GENERAL'), true, true);

  INSERT INTO category (tenant_id, nombre, orden, family_id) VALUES (t, 'Postres caseros', 60, fam_pos) RETURNING id INTO cat_post;
  INSERT INTO product (tenant_id, category_id, nombre, precio, clase_fiscal, tipo_impositivo, es_alcohol, disponible) VALUES
    (t, cat_post, 'Tarta de queso', 4.50, 'REDUCIDO', (SELECT porcentaje FROM tax_rate WHERE territorio = terr AND clase_fiscal = 'REDUCIDO'), false, true),
    (t, cat_post, 'Flan casero', 3.20, 'REDUCIDO', (SELECT porcentaje FROM tax_rate WHERE territorio = terr AND clase_fiscal = 'REDUCIDO'), false, true);
END $$;
