-- 03 — COLA DE IMÁGENES PENDIENTES DE SUBIR A LA NUBE.
--
-- Sólo existe en el NODO: es su libreta de "esto todavía no está a salvo".
--
-- El dueño cambia la foto de un producto un martes que se ha caído la línea. La foto se
-- guarda en el disco del nodo y el TPV la ve al instante — pero el disco de un mini-PC
-- debajo de la barra NO es sitio para el único ejemplar de nada. Cuando vuelva internet,
-- el nodo la sube a Supabase, que es el archivo de verdad (y lo que ve el dueño desde
-- casa, y lo que se descarga un TPV nuevo el día que lo instalen).
--
-- Mientras `subida_at` sea NULL, esa foto sólo existe aquí.

create table if not exists public.nodo_media_pendiente (
  ruta       text primary key,          -- <tenant>/<carpeta>/<uuid>.<ext>
  creada_at  timestamptz not null default now(),
  subida_at  timestamptz,               -- NULL = todavía no está en la nube
  intentos   int not null default 0,
  ultimo_error text
);

comment on table public.nodo_media_pendiente is
  'Imágenes guardadas en el nodo que aún no han llegado a Supabase. Cola del sincronizador.';

create index if not exists idx_media_pendiente
  on public.nodo_media_pendiente (creada_at)
  where subida_at is null;
