-- 02 — REALTIME DEL NODO: que Postgres avise cuando algo cambia.
--
-- Se ejecuta DESPUÉS de las migraciones (paso 5 de instalar-nodo.ps1).
--
-- Sólo vive en el NODO, no en la nube: allí ya lo hace Supabase Realtime (Elixir, que
-- no corre nativo en Windows — por eso el nodo necesita lo suyo). Aquí lo hacemos con
-- lo que Postgres trae de casa: LISTEN/NOTIFY.
--
-- Se pone un trigger a cada tabla que esté en la publicación `supabase_realtime`, o sea
-- EXACTAMENTE las mismas que la nube emite. Una tabla nueva en la publicación (una
-- migración futura) sólo necesita volver a correr este fichero.
--
-- REGLA INNEGOCIABLE: esto NO PUEDE hacer fallar una escritura. Un TPV no puede perder
-- una comanda porque el aviso de realtime fuera demasiado grande. De ahí el recorte de
-- abajo: `pg_notify` revienta si el mensaje pasa de 8000 bytes, así que si la fila no
-- cabe, se manda sólo el id y que el cliente la pida. Mejor un viaje de más que una
-- venta perdida.

create or replace function public.notificar_cambio() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  fila    jsonb;
  aviso   text;
begin
  fila := to_jsonb(case when tg_op = 'DELETE' then old else new end);

  aviso := jsonb_build_object(
    'tabla',  tg_table_name,
    'evento', tg_op,
    'fila',   fila
  )::text;

  -- pg_notify falla si el mensaje pasa de 8000 bytes, y ese fallo ABORTARÍA la venta.
  -- Si no cabe, mandamos sólo el id: el cliente ya pedirá la fila entera.
  if octet_length(aviso) > 7500 then
    aviso := jsonb_build_object(
      'tabla',  tg_table_name,
      'evento', tg_op,
      'fila',   jsonb_build_object('id', fila ->> 'id'),
      'parcial', true
    )::text;
  end if;

  perform pg_notify('gluuh_cambios', aviso);
  return null;  -- AFTER trigger: da igual lo que devuelva
end;
$$;

-- Un trigger por cada tabla publicada para realtime — las mismas que emite la nube.
do $$
declare t record;
begin
  for t in
    select tablename from pg_publication_tables where pubname = 'supabase_realtime'
  loop
    execute format('drop trigger if exists zz_notificar_cambio on public.%I', t.tablename);
    execute format(
      'create trigger zz_notificar_cambio after insert or update or delete on public.%I
         for each row execute function public.notificar_cambio()',
      t.tablename);
    raise notice 'realtime: %', t.tablename;
  end loop;
end $$;
