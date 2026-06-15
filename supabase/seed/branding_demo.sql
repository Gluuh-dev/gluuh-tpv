-- Marca + ofertas de ejemplo para el tenant demo (Bar Demo Gluuh)
DO $$
DECLARE t uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  INSERT INTO public.tenant_branding (tenant_id, nombre_comercial, color_primario, color_secundario, kiosko_titulo, kiosko_subtitulo)
  VALUES (t, 'Bar Demo Gluuh', '#e11d48', '#0f172a', '¡Bienvenido a Bar Demo!', 'Pide y paga aquí en segundos')
  ON CONFLICT (tenant_id) DO UPDATE SET
    nombre_comercial = EXCLUDED.nombre_comercial,
    kiosko_titulo = EXCLUDED.kiosko_titulo,
    kiosko_subtitulo = EXCLUDED.kiosko_subtitulo;

  DELETE FROM public.offer WHERE tenant_id = t;
  INSERT INTO public.offer (tenant_id, titulo, descripcion, precio, media_tipo, emoji, color, orden, activa) VALUES
    (t, 'Menú Clásico', 'Hamburguesa + patatas + bebida', '9,90 €', 'EMOJI', '🍔', '#e11d48', 1, true),
    (t, 'Hora feliz',  '2ª cerveza al 50% · de 18 a 20 h', NULL, 'EMOJI', '🍺', '#f59e0b', 2, true),
    (t, 'Postre gratis','En menús dobles, solo hoy', '0 €', 'EMOJI', '🍦', '#7c3aed', 3, true);
END $$;
