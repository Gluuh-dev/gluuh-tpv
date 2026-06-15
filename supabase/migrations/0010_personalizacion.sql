-- =============================================================================
--  0010_personalizacion.sql — Personalización por cliente (multi-tenant)
--  · tenant_branding: marca/colores/textos del kiosko por empresa
--  · offer: ofertas (cartelería) con imagen/vídeo/emoji por empresa
--  · Storage: bucket "media" con RLS por carpeta de tenant
-- =============================================================================

-- ---------- Marca por empresa --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_branding (
  tenant_id        uuid PRIMARY KEY REFERENCES public.tenant(id) ON DELETE CASCADE,
  nombre_comercial text,
  logo_url         text,
  color_primario   text DEFAULT '#e11d48',
  color_secundario text DEFAULT '#0f172a',
  kiosko_titulo    text,
  kiosko_subtitulo text,
  updated_at       timestamptz DEFAULT now()
);
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS branding_rw ON public.tenant_branding;
CREATE POLICY branding_rw ON public.tenant_branding FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.tenant_branding TO authenticated;

-- ---------- Ofertas / cartelería ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenant(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  descripcion text,
  precio      text,
  media_tipo  text NOT NULL DEFAULT 'EMOJI',   -- EMOJI | IMAGEN | VIDEO
  media_url   text,
  emoji       text DEFAULT '🍔',
  color       text DEFAULT '#e11d48',
  orden       int  DEFAULT 0,
  activa      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_tenant_idx ON public.offer(tenant_id, orden);
ALTER TABLE public.offer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offer_rw ON public.offer;
CREATE POLICY offer_rw ON public.offer FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.offer TO authenticated;

-- ---------- Storage: bucket "media" -------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (logos, ofertas en pantallas)
DROP POLICY IF EXISTS media_read ON storage.objects;
CREATE POLICY media_read ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Escritura: cada empresa solo en su carpeta  <tenant_id>/...
DROP POLICY IF EXISTS media_insert ON storage.objects;
CREATE POLICY media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

DROP POLICY IF EXISTS media_update ON storage.objects;
CREATE POLICY media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

DROP POLICY IF EXISTS media_delete ON storage.objects;
CREATE POLICY media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
