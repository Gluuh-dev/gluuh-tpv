-- 04 — LA LIBRETA DEL SINCRONIZADOR.
--
-- Sólo existe en el NODO. Guarda por dónde iba, para no volver a subir lo ya subido
-- cada vez que arranca (un bar con dos años de ventas no puede reenviarlas enteras
-- porque se reinició el mini-PC).
--
-- Se guarda una MARCA DE AGUA por tabla: la fecha del último registro que llegó bien a
-- la nube. En el siguiente pase sólo se manda lo que sea posterior.
--
-- La marca se avanza SÓLO cuando la nube ha confirmado. Si se va la luz a mitad, la
-- marca se queda donde estaba y el próximo pase reenvía ese trozo. Reenviar es
-- inofensivo: las tablas operativas llevan `client_id` (un UUID que pone el TPV) y la
-- subida va con `on_conflict=client_id`, así que la misma venta dos veces es una sola
-- venta. Nunca se duplica un cobro.
--
-- Dirección ÚNICA: nodo → nube. Lo operativo y lo fiscal nacen en el bar y el bar tiene
-- la razón. El catálogo va al revés y no se toca aquí.

create table if not exists public.nodo_sync_estado (
  tabla        text primary key,
  hasta        text,            -- todo lo anterior o igual a esto ya está en la nube
  ultimo_pase  timestamptz,
  filas_subidas bigint not null default 0,
  ultimo_error text
);

-- `hasta` era `timestamptz`, pero desde los CURSORES COMPUESTOS (0120) la marca ya
-- no es una fecha suelta: es `{"t":<fecha>,"k":[<pk>]}` — hace falta la pk para que
-- un lote con todas las filas al mismo microsegundo no se quede a medias.
--
-- Los nodos ya instalados se quedaron con la columna vieja, y CADA checkpoint del
-- catálogo moría con «la sintaxis de entrada no es válida para tipo timestamp with
-- time zone: {"t":…}». Sin poder guardar la marca, el catálogo no bajaba ni subía
-- NADA — y el pase terminaba diciendo «Listo». Por eso hace falta este alter.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'nodo_sync_estado'
       and column_name = 'hasta' and data_type <> 'text'
  ) then
    alter table public.nodo_sync_estado alter column hasta type text using hasta::text;
  end if;
end $$;

comment on table public.nodo_sync_estado is
  'Por dónde iba el sincronizador. La marca `hasta` sólo avanza cuando la nube confirma. '
  'Es TEXT: guarda el cursor compuesto {"t":fecha,"k":[pk]} (0120), o una fecha suelta si viene de antes.';
