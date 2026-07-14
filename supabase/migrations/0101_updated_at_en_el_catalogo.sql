-- 0101 — `updated_at` EN TODO EL CATÁLOGO. Sin esto, un bar con nodo nunca se entera de
-- que le has cambiado un precio.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  EL AGUJERO
--
--  El nodo se baja el bar al instalarse y **no vuelve a mirar nunca**. El dueño cambia
--  un precio desde casa (o desde el panel, con internet) y el TPV del bar sigue cobrando
--  el viejo — para siempre, hasta que alguien reinstale.
--
--  Al ir a arreglarlo apareció la causa de fondo: **la mayoría de las tablas de catálogo
--  no tienen `updated_at`**. `family`, `modifier`, `modifier_group`, `payment_method`,
--  `printer`, `product_price`, `product_format`, `product_category`, `room`, `tarifa`,
--  `menu`, `plano_elemento`… ninguna. Sólo la tenían `product`, `category`, `app_user`,
--  `restaurant_table`, `setting` y `tenant_branding`.
--
--  Sin una marca de tiempo **no hay forma de saber qué ha cambiado**, así que la
--  sincronización del catálogo era literalmente imposible de construir.
--
--  Y hace falta en las DOS direcciones: el dueño puede cambiar un precio en la nube
--  (desde casa) **o en el propio bar sin internet**. Gana el más reciente — y para saber
--  cuál es el más reciente, hay que saber cuándo se tocó cada uno.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se hace por descubrimiento, no con una lista a mano: cualquier tabla de negocio con
-- `tenant_id` que aún no tenga `updated_at` la recibe, con su trigger. Así una tabla
-- nueva de mañana no se queda fuera por olvido.

-- ── 1. El trigger deja de provocar un PING-PONG INFINITO ─────────────────────
--
-- `set_updated_at()` ponía `now()` en CADA update, sin mirar. Con la sincronización del
-- catálogo eso es una bomba:
--
--   1. El nodo se baja de la nube el producto P (tocado a las 10:00).
--   2. Al meterlo, el trigger le pone `now()` → 10:05. Ahora el nodo cree que SU copia
--      es más nueva que la de la nube.
--   3. En el pase siguiente se la sube. La nube le pone `now()` → 10:10.
--   4. Y el nodo se la vuelve a bajar. Para siempre, con la fecha corriéndose sola y el
--      TPV recargando la carta cada cinco minutos.
--
-- Se arregla con dos comprobaciones:
--
--   · Si la fila no cambia en NADA, no se toca la fecha. Reescribir lo mismo no es un
--     cambio, y es exactamente lo que hace un espejo al reenviar un lote.
--
--   · Una fecha explícita **sólo se respeta si va HACIA ADELANTE**. Y ese "hacia adelante"
--     no es un detalle de estilo: el panel tiene formularios que hacen `select *` y luego
--     `upsert({...fila})`, con lo que **arrastran sin querer el `updated_at` viejo**. Si
--     se respetara tal cual, la fecha se quedaría CONGELADA en el pasado y el bar no se
--     enteraría jamás del cambio — el dueño cambiaría el logo y el TPV seguiría con el de
--     antes, sin un solo error por ningún lado.
--
--     Hacia adelante sólo va el espejo, que trae el momento real en que se tocó la fila en
--     el otro lado. Cualquier otra cosa se ignora y se pone la de ahora.
--
-- Una edición normal desde el panel sigue recibiendo `now()` como siempre. Nada cambia
-- para quien ya existía.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Reescribir la misma fila no es un cambio: no se le mueve la fecha.
  if new is not distinct from old then
    return new;
  end if;

  -- Sólo el espejo puede traer fecha, y sólo si es más nueva.
  if new.updated_at is null or new.updated_at <= old.updated_at then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

-- ── 2. `updated_at` en todo el catálogo ──────────────────────────────────────
do $$
declare
  t record;
  n int := 0;
begin
  for t in
    select c.relname as tabla
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       -- Es una tabla de un bar (tiene dueño).
       and exists (
         select 1 from information_schema.columns col
          where col.table_schema = 'public' and col.table_name = c.relname
            and col.column_name = 'tenant_id')
       -- Y todavía no sabe cuándo se tocó.
       and not exists (
         select 1 from information_schema.columns col
          where col.table_schema = 'public' and col.table_name = c.relname
            and col.column_name = 'updated_at')
       -- Lo OPERATIVO y lo FISCAL no lo necesita: nace en el bar, sube en una sola
       -- dirección y no se edita nunca. Añadirle un trigger sería coste por nada en el
       -- camino del dinero, que es justo donde no se pone nada que no haga falta.
       and c.relname not in (
         'order_line', 'payment', 'invoice', 'invoice_tax_line', 'tax_line',
         'verifactu_record', 'ticketbai_record', 'cash_move', 'cash_session',
         'print_job', 'shift', 'stock_move', 'online_order',
         'nodo_migracion', 'nodo_sync_estado', 'nodo_media_pendiente', 'nodo_sesion')
  loop
    execute format(
      'alter table public.%I add column updated_at timestamptz not null default now()',
      t.tabla);

    execute format('drop trigger if exists trg_updated_at on public.%I', t.tabla);
    execute format(
      'create trigger trg_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t.tabla);

    -- Por esta columna se pregunta "¿qué ha cambiado desde la última vez?" en cada pase
    -- de sincronización. Sin índice, eso es un recorrido completo de la tabla.
    execute format(
      'create index if not exists idx_%s_updated on public.%I (tenant_id, updated_at)',
      t.tabla, t.tabla);

    n := n + 1;
    raise notice 'updated_at -> %', t.tabla;
  end loop;

  raise notice '% tabla(s) de catálogo ya saben cuándo se tocaron', n;
end $$;
