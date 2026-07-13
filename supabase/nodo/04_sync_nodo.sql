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
  hasta        timestamptz,     -- todo lo anterior o igual a esto ya está en la nube
  ultimo_pase  timestamptz,
  filas_subidas bigint not null default 0,
  ultimo_error text
);

comment on table public.nodo_sync_estado is
  'Por dónde iba el sincronizador. La marca `hasta` sólo avanza cuando la nube confirma.';
