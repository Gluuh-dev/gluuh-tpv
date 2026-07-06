-- =============================================================================
--  Datos de ejemplo: carta completa de un bar/restaurante español.
--  Tenant destino: 328063c3-1a7b-4389-9e41-cc72d6b6ab87 (cámbialo si hace falta).
--  Incluye: familias con color, categorías con estación (cocina/barra),
--  productos, VARIACIONES (product_format: cañas, medias/enteras),
--  MODIFICADORES (punto de la carne, extras con precio) y NOTAS de preparación.
--
--  Idempotente: si el tenant ya tiene familias, NO siembra (para no duplicar).
--  Aplicar:  psql "$DATABASE_URL" -f supabase/seed-ejemplo-carta.sql
--            o pegarlo en el SQL Editor de Supabase.
--
--  Nota fiscal: tipo_impositivo son valores de PENÍNSULA (IVA 10% hostelería,
--  21% alcohol). En Canarias (IGIC) al reeditar el producto el % se recalcula
--  por territorio (ivaAuto/clase_fiscal). clase_fiscal queda bien puesta.
-- =============================================================================

DO $$
DECLARE
  t uuid := '328063c3-1a7b-4389-9e41-cc72d6b6ab87';
  -- familias
  f_beb uuid; f_ent uuid; f_car uuid; f_pes uuid; f_pos uuid;
  -- categorías
  c_refr uuid; c_cerv uuid; c_vino uuid; c_cafe uuid;
  c_pica uuid; c_brasa uuid; c_pescado uuid; c_postre uuid;
  -- productos con variaciones/modificadores
  p_alhambra uuid; p_especial uuid; p_pulpo uuid; p_entrecot uuid; p_solomillo uuid;
  -- grupos de modificadores
  g_punto uuid; g_extras uuid; g_punto2 uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.family WHERE tenant_id = t) THEN
    RAISE NOTICE 'El tenant % ya tiene carta; no se siembra nada.', t;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant WHERE id = t) THEN
    RAISE EXCEPTION 'El tenant % no existe. Créalo antes de sembrar la carta.', t;
  END IF;

  -- ── Familias (color = acento del botón en el TPV) ──────────────────────────
  INSERT INTO public.family (tenant_id, nombre, color, orden) VALUES
    (t, 'Bebidas',   '#3b82f6', 1) RETURNING id INTO f_beb;
  INSERT INTO public.family (tenant_id, nombre, color, orden) VALUES
    (t, 'Entrantes', '#f59e0b', 2) RETURNING id INTO f_ent;
  INSERT INTO public.family (tenant_id, nombre, color, orden) VALUES
    (t, 'Carnes',    '#dc2626', 3) RETURNING id INTO f_car;
  INSERT INTO public.family (tenant_id, nombre, color, orden) VALUES
    (t, 'Pescados',  '#0891b2', 4) RETURNING id INTO f_pes;
  INSERT INTO public.family (tenant_id, nombre, color, orden) VALUES
    (t, 'Postres',   '#ec4899', 5) RETURNING id INTO f_pos;

  -- ── Categorías (estacion define a qué impresora/pantalla van al marchar) ───
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Refrescos', f_beb, 1, 'BARRA')  RETURNING id INTO c_refr;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Cervezas',  f_beb, 2, 'BARRA')  RETURNING id INTO c_cerv;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Vinos',     f_beb, 3, 'BARRA')  RETURNING id INTO c_vino;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Cafés',     f_beb, 4, 'BARRA')  RETURNING id INTO c_cafe;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Para picar', f_ent, 1, 'COCINA') RETURNING id INTO c_pica;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'A la brasa', f_car, 1, 'COCINA') RETURNING id INTO c_brasa;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Pescados',   f_pes, 1, 'COCINA') RETURNING id INTO c_pescado;
  INSERT INTO public.category (tenant_id, nombre, family_id, orden, estacion) VALUES
    (t, 'Postres',    f_pos, 1, 'COCINA') RETURNING id INTO c_postre;

  -- ── Productos ─────────────────────────────────────────────────────────────
  -- helper mental: (nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion)
  -- Refrescos (IVA 10 REDUCIDO)
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_refr, 'Coca-Cola',        2.00, 10, 'REDUCIDO', false, 'BARRA', true, 1),
    (t, c_refr, 'Fanta Naranja',    2.00, 10, 'REDUCIDO', false, 'BARRA', true, 2),
    (t, c_refr, 'Agua mineral',     1.50, 10, 'REDUCIDO', false, 'BARRA', true, 3),
    (t, c_refr, 'Tónica',           2.20, 10, 'REDUCIDO', false, 'BARRA', true, 4);

  -- Cervezas (alcohol IVA 21 GENERAL) — con VARIACIONES (formatos)
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_cerv, 'Cerveza Alhambra', 1.80, 21, 'GENERAL', true, 'BARRA', true, 1) RETURNING id INTO p_alhambra;
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_cerv, 'Alhambra Especial', 1.50, 21, 'GENERAL', true, 'BARRA', true, 2) RETURNING id INTO p_especial;

  INSERT INTO public.product_format (tenant_id, product_id, nombre, precio, orden) VALUES
    (t, p_alhambra, 'Caña',   1.80, 1),
    (t, p_alhambra, 'Tubo',   2.50, 2),
    (t, p_alhambra, 'Tercio', 3.00, 3),
    (t, p_especial, '1/5',    1.50, 1),
    (t, p_especial, '1/3',    2.20, 2);

  -- Vinos
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_vino, 'Rioja Crianza (copa)', 2.80, 21, 'GENERAL', true, 'BARRA', true, 1),
    (t, c_vino, 'Ribera (copa)',        3.20, 21, 'GENERAL', true, 'BARRA', true, 2);

  -- Cafés
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_cafe, 'Café solo',       1.30, 10, 'REDUCIDO', false, 'BARRA', true, 1),
    (t, c_cafe, 'Cortado',         1.40, 10, 'REDUCIDO', false, 'BARRA', true, 2),
    (t, c_cafe, 'Café con leche',  1.60, 10, 'REDUCIDO', false, 'BARRA', true, 3);

  -- Para picar (cocina)
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_pica, 'Croquetas caseras (6 ud)', 8.00, 10, 'REDUCIDO', false, 'COCINA', true, 1),
    (t, c_pica, 'Patatas bravas',           6.50, 10, 'REDUCIDO', false, 'COCINA', true, 2),
    (t, c_pica, 'Calamares a la romana',   12.00, 10, 'REDUCIDO', false, 'COCINA', true, 3),
    (t, c_pica, 'Jamón ibérico',           18.00, 10, 'REDUCIDO', false, 'COCINA', true, 4);

  -- Carnes a la brasa — con MODIFICADORES (punto + extras)
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_brasa, 'Entrecot de vaca', 18.00, 10, 'REDUCIDO', false, 'COCINA', true, 1) RETURNING id INTO p_entrecot;
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_brasa, 'Solomillo de ternera', 22.00, 10, 'REDUCIDO', false, 'COCINA', true, 2) RETURNING id INTO p_solomillo;

  -- Grupo "Punto de la carne" (elegir 1) — sin precio (comentario)
  INSERT INTO public.modifier_group (tenant_id, product_id, nombre, min_sel, max_sel) VALUES
    (t, p_entrecot, 'Punto de la carne', 1, 1) RETURNING id INTO g_punto;
  INSERT INTO public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) VALUES
    (t, g_punto, 'Poco hecho', 0),
    (t, g_punto, 'Al punto',   0),
    (t, g_punto, 'Muy hecho',  0);
  -- Grupo "Extras" (hasta 3) — con precio
  INSERT INTO public.modifier_group (tenant_id, product_id, nombre, min_sel, max_sel) VALUES
    (t, p_entrecot, 'Extras', 0, 3) RETURNING id INTO g_extras;
  INSERT INTO public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) VALUES
    (t, g_extras, 'Pimienta',        0.50),
    (t, g_extras, 'Roquefort',       1.50),
    (t, g_extras, 'Salsa barbacoa',  0.50);
  -- El solomillo comparte el mismo tipo de punto
  INSERT INTO public.modifier_group (tenant_id, product_id, nombre, min_sel, max_sel) VALUES
    (t, p_solomillo, 'Punto de la carne', 1, 1) RETURNING id INTO g_punto2;
  INSERT INTO public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) VALUES
    (t, g_punto2, 'Poco hecho', 0),
    (t, g_punto2, 'Al punto',   0),
    (t, g_punto2, 'Muy hecho',  0);

  -- Pescados — con VARIACIÓN media/entera
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_pescado, 'Pulpo a la gallega', 12.00, 10, 'REDUCIDO', false, 'COCINA', true, 1) RETURNING id INTO p_pulpo;
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_pescado, 'Lubina a la espalda', 16.00, 10, 'REDUCIDO', false, 'COCINA', true, 2);
  INSERT INTO public.product_format (tenant_id, product_id, nombre, precio, orden) VALUES
    (t, p_pulpo, 'Media ración', 12.00, 1),
    (t, p_pulpo, 'Ración entera', 20.00, 2);

  -- Postres
  INSERT INTO public.product (tenant_id, category_id, nombre, precio, tipo_impositivo, clase_fiscal, es_alcohol, estacion, disponible, orden) VALUES
    (t, c_postre, 'Tarta de queso', 5.50, 10, 'REDUCIDO', false, 'COCINA', true, 1),
    (t, c_postre, 'Flan casero',    4.00, 10, 'REDUCIDO', false, 'COCINA', true, 2),
    (t, c_postre, 'Helado (2 bolas)', 4.50, 10, 'REDUCIDO', false, 'COCINA', true, 3);

  -- ── Notas de preparación (chips de anotación rápida en el TPV) ─────────────
  INSERT INTO public.nota_preparacion (tenant_id, nombre, descripcion) VALUES
    (t, 'Poco hecho', 'Punto de la carne'),
    (t, 'Al punto',   'Punto de la carne'),
    (t, 'Muy hecho',  'Punto de la carne'),
    (t, 'Sin sal',    'Preparación'),
    (t, 'Sin gluten', 'Alergias'),
    (t, 'Alergia a frutos secos', 'Alergias'),
    (t, 'Para compartir', 'Servicio');

  RAISE NOTICE 'Carta de ejemplo sembrada en el tenant %.', t;
END $$;
