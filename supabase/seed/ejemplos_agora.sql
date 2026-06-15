-- =============================================================================
--  ejemplos_agora.sql — Catálogo de EJEMPLO estilo Ágora para tu(s) tenant(s) REAL(es).
--  · Familias a color, categorías y productos con IVA/IGIC automático por territorio.
--  · SEGURO: solo siembra tenants que NO tienen familias todavía (no pisa tus datos).
--  · Idempotente: ejecútalo las veces que quieras; salta los tenants ya poblados.
--
--  Cómo ejecutarlo (los datos NO aparecen hasta que lo corras contra tu Supabase):
--    Supabase Studio → SQL Editor → pega este archivo → Run.
--    (o: psql "$DIRECT_URL" -f supabase/seed/ejemplos_agora.sql)
-- =============================================================================
DO $$
DECLARE
  t    record;
  terr text;
  loc  uuid;
  fBeb uuid; fCom uuid; fPos uuid;
  cCer uuid; cCaf uuid; cRef uuid; cVin uuid;
  cHam uuid; cBoc uuid; cPiz uuid; cRac uuid;
  cPos uuid; cBol uuid;
  rBarra uuid;
  -- % por clase fiscal en el territorio del tenant
  pGen numeric; pRed numeric;
BEGIN
  FOR t IN SELECT id FROM public.tenant LOOP
    -- No pisar tenants que ya tienen catálogo de familias
    IF EXISTS (SELECT 1 FROM public.family WHERE tenant_id = t.id) THEN CONTINUE; END IF;

    SELECT COALESCE(l.territorio_fiscal,'PENINSULA_BALEARES'), l.id
      INTO terr, loc
      FROM public.location l WHERE l.tenant_id = t.id ORDER BY l.created_at LIMIT 1;
    IF loc IS NULL THEN CONTINUE; END IF;  -- necesita al menos una location

    SELECT porcentaje INTO pGen FROM public.tax_rate WHERE territorio = terr AND clase_fiscal = 'GENERAL';
    SELECT porcentaje INTO pRed FROM public.tax_rate WHERE territorio = terr AND clase_fiscal = 'REDUCIDO';
    pGen := COALESCE(pGen, 21); pRed := COALESCE(pRed, 10);

    -- ---------- Familias (a color, estilo Ágora) ----------
    INSERT INTO public.family (tenant_id,nombre,orden,color) VALUES (t.id,'Bebidas',1,'#0ea5e9') RETURNING id INTO fBeb;
    INSERT INTO public.family (tenant_id,nombre,orden,color) VALUES (t.id,'Comidas',2,'#e11d48') RETURNING id INTO fCom;
    INSERT INTO public.family (tenant_id,nombre,orden,color) VALUES (t.id,'Postres',3,'#7c3aed') RETURNING id INTO fPos;

    -- ---------- Categorías ----------
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Cervezas',1,fBeb) RETURNING id INTO cCer;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Cafés',2,fBeb)    RETURNING id INTO cCaf;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Refrescos',3,fBeb) RETURNING id INTO cRef;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Vinos',4,fBeb)     RETURNING id INTO cVin;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Hamburguesas',5,fCom) RETURNING id INTO cHam;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Bocadillos',6,fCom)   RETURNING id INTO cBoc;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Pizzas',7,fCom)       RETURNING id INTO cPiz;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Raciones',8,fCom)     RETURNING id INTO cRac;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Bollería',9,fPos)     RETURNING id INTO cBol;
    INSERT INTO public.category (tenant_id,nombre,orden,family_id) VALUES (t.id,'Postres',10,fPos)     RETURNING id INTO cPos;

    -- ---------- Productos (precio PVP impuesto incluido) ----------
    -- Bebidas con alcohol → GENERAL; resto → REDUCIDO
    INSERT INTO public.product (tenant_id,category_id,nombre,precio,clase_fiscal,tipo_impositivo,es_alcohol,disponible) VALUES
      (t.id,cCer,'Caña',1.60,'GENERAL',pGen,true,true),
      (t.id,cCer,'Doble',2.40,'GENERAL',pGen,true,true),
      (t.id,cCer,'Tercio',2.20,'GENERAL',pGen,true,true),
      (t.id,cCer,'Cerveza sin alcohol',2.20,'GENERAL',pGen,false,true),
      (t.id,cCaf,'Café solo',1.30,'REDUCIDO',pRed,false,true),
      (t.id,cCaf,'Café con leche',1.50,'REDUCIDO',pRed,false,true),
      (t.id,cCaf,'Cortado',1.40,'REDUCIDO',pRed,false,true),
      (t.id,cCaf,'Carajillo',1.90,'GENERAL',pGen,true,true),
      (t.id,cRef,'Refresco cola',2.20,'REDUCIDO',pRed,false,true),
      (t.id,cRef,'Refresco naranja',2.20,'REDUCIDO',pRed,false,true),
      (t.id,cRef,'Agua mineral',1.40,'REDUCIDO',pRed,false,true),
      (t.id,cRef,'Tónica',2.30,'REDUCIDO',pRed,false,true),
      (t.id,cVin,'Copa de vino tinto',2.80,'GENERAL',pGen,true,true),
      (t.id,cVin,'Copa de vino blanco',2.80,'GENERAL',pGen,true,true),
      (t.id,cVin,'Botella Rioja crianza',16.00,'GENERAL',pGen,true,true),
      (t.id,cHam,'Hamburguesa clásica',8.50,'REDUCIDO',pRed,false,true),
      (t.id,cHam,'Hamburguesa doble',10.50,'REDUCIDO',pRed,false,true),
      (t.id,cHam,'Hamburguesa vegana',9.00,'REDUCIDO',pRed,false,true),
      (t.id,cBoc,'Bocadillo de jamón',4.50,'REDUCIDO',pRed,false,true),
      (t.id,cBoc,'Bocadillo de tortilla',4.00,'REDUCIDO',pRed,false,true),
      (t.id,cBoc,'Bocadillo de calamares',5.50,'REDUCIDO',pRed,false,true),
      (t.id,cPiz,'Pizza margarita',9.00,'REDUCIDO',pRed,false,true),
      (t.id,cPiz,'Pizza cuatro quesos',11.00,'REDUCIDO',pRed,false,true),
      (t.id,cPiz,'Pizza barbacoa',11.50,'REDUCIDO',pRed,false,true),
      (t.id,cRac,'Patatas bravas',5.50,'REDUCIDO',pRed,false,true),
      (t.id,cRac,'Croquetas caseras (6 u.)',6.50,'REDUCIDO',pRed,false,true),
      (t.id,cRac,'Calamares a la romana',9.50,'REDUCIDO',pRed,false,true),
      (t.id,cRac,'Tabla de ibéricos',12.00,'REDUCIDO',pRed,false,true),
      (t.id,cBol,'Croissant',1.80,'REDUCIDO',pRed,false,true),
      (t.id,cBol,'Napolitana de chocolate',1.90,'REDUCIDO',pRed,false,true),
      (t.id,cPos,'Tarta de queso',4.50,'REDUCIDO',pRed,false,true),
      (t.id,cPos,'Flan casero',3.20,'REDUCIDO',pRed,false,true),
      (t.id,cPos,'Tiramisú',4.20,'REDUCIDO',pRed,false,true);

    -- ---------- Sala "Barra" + mesas de ejemplo (solo si el tenant no tiene mesas) ----------
    IF NOT EXISTS (SELECT 1 FROM public.restaurant_table WHERE tenant_id = t.id) THEN
      INSERT INTO public.room (tenant_id,location_id,nombre,orden) VALUES (t.id,loc,'Salón',1) RETURNING id INTO rBarra;
      INSERT INTO public.restaurant_table (tenant_id,room_id,nombre,estado)
      SELECT t.id, rBarra, 'Mesa ' || g, 'LIBRE' FROM generate_series(1,8) g;
    END IF;
  END LOOP;
END $$;
