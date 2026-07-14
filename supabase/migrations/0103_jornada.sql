-- 0103 — LA JORNADA: el día del bar no es el día del calendario.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  LAS CAÑAS DE LA 1:30
--
--  Un bar cierra el viernes a las 2 de la mañana. Las últimas cañas se cobran a la 1:30.
--
--  Para el calendario, esa venta es del **sábado**. Para el bar, es del **viernes** — es la
--  noche del viernes, la caja del viernes, el turno del viernes, y el encargado del viernes
--  es quien responde de ella.
--
--  Hoy los informes cortan `created_at` a `YYYY-MM-DD` (`/ventas-diarias`). O sea que **el
--  cierre de todos los fines de semana está mal**: parte de la noche del viernes se cuenta
--  como sábado, y parte de la del sábado como domingo. El dueño cuadra la caja a mano y no
--  entiende por qué le bailan cien euros cada lunes.
--
--  No es un problema de informes. Es que **falta el concepto**: la JORNADA. Una venta
--  pertenece a la jornada en la que se cobra, y la jornada la abre y la cierra el bar — no
--  la medianoche.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.jornada (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenant(id) on delete cascade,
  location_id   uuid not null references public.location(id) on delete cascade,

  -- Correlativo POR LOCAL. Es lo que el encargado dice por teléfono («la jornada 412»), y
  -- lo que va impreso en el Z. Un uuid no vale para eso.
  numero        int  not null,

  abierta_en    timestamptz not null default now(),
  cerrada_en    timestamptz,
  cerrada_por   uuid references public.app_user(id),

  -- MANUAL    = el encargado le dio a "Cerrar día" y contó la caja.
  -- AUTOMATICO= nadie lo hizo y el nodo la cerró a la hora de respaldo. La caja se queda
  --             SIN CONTAR y hay que decirlo: por eso `arqueo_pendiente`.
  tipo_cierre   text check (tipo_cierre in ('MANUAL', 'AUTOMATICO')),
  arqueo_pendiente boolean not null default false,

  -- El Z, congelado al cerrar. Se guarda AUNQUE se pueda recalcular, y a propósito: un
  -- informe que cambia cuando alguien rectifica una venta vieja no es un cierre, es una
  -- consulta. Lo que se declaró, se declaró.
  z             jsonb,

  -- Cuántas mesas quedaron abiertas. NO se cobran ni se anulan solas (ver más abajo), pero
  -- el Z tiene que dejar constancia: «quedaron 2 mesas abiertas».
  mesas_abiertas int not null default 0,

  -- EL ARQUEO. Lo que el encargado contó de verdad en el cajón, y lo que falta o sobra
  -- respecto a lo que dice el sistema.
  --
  -- Vive AQUÍ y no en `cash_move` porque el arqueo del día es del día: `cash_move` cuelga de
  -- una `cash_session` (la sesión del cajón) que puede no estar abierta, y sólo admite
  -- ENTRADA/SALIDA. Meterlo ahí era escribir en un sitio que no lo acepta — y el recuento se
  -- habría perdido en silencio, que es justo lo que no puede pasar con el dinero.
  efectivo_contado numeric(12,2),
  descuadre        numeric(12,2),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (location_id, numero)
);

-- Y las mismas columnas, por si la tabla ya existía: `create table if not exists` NO añade
-- columnas a una tabla que ya está. Una migración que sólo funciona sobre una base virgen
-- es una migración que fallará exactamente en el sitio donde importa — un bar en marcha.
alter table public.jornada add column if not exists efectivo_contado numeric(12,2);
alter table public.jornada add column if not exists descuadre        numeric(12,2);

-- Una sola jornada abierta por local. Y esto no es una comprobación de más: dos jornadas
-- abiertas a la vez significa que la mitad de las ventas de la noche van a una y la mitad a
-- otra, y ningún informe cuadra jamás.
create unique index if not exists idx_jornada_una_abierta
  on public.jornada (location_id) where cerrada_en is null;

create index if not exists idx_jornada_tenant on public.jornada (tenant_id, abierta_en desc);

drop trigger if exists trg_updated_at on public.jornada;
create trigger trg_updated_at before update on public.jornada
  for each row execute function public.set_updated_at();

alter table public.jornada enable row level security;

drop policy if exists jornada_tenant on public.jornada;
create policy jornada_tenant on public.jornada
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

comment on table public.jornada is
  'El día del BAR (no el del calendario). Una venta pertenece a la jornada en que se cobra.';

-- ── Y cada venta sabe de qué jornada es ──────────────────────────────────────
alter table public.sales_order
  add column if not exists jornada_id uuid references public.jornada(id);

create index if not exists idx_sales_order_jornada on public.sales_order (jornada_id);

-- ── Abrir la jornada del local (o devolver la que ya está abierta) ───────────
--
-- `security definer`: puede tener que CREARLA, y el camarero que abre la primera mesa del
-- día no tiene por qué poder insertar en `jornada`. Se acota a mano al tenant del local.
create or replace function public.jornada_abierta(p_location uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_tenant uuid;
begin
  select id from public.jornada
   where location_id = p_location and cerrada_en is null
   into v_id;
  if found then return v_id; end if;

  select tenant_id from public.location where id = p_location into v_tenant;
  if v_tenant is null then
    raise exception 'Ese local no existe' using errcode = 'GLU03';
  end if;

  -- EL CANDADO. Sin él, dos camareros que abren la primera mesa del día en el mismo
  -- instante crearían DOS jornadas: las ventas de la noche se repartirían entre las dos y
  -- no cuadraría ni un informe. El índice único de arriba lo impediría con un error feo;
  -- esto hace que el segundo simplemente ESPERE y se encuentre la jornada ya hecha.
  perform pg_advisory_xact_lock(hashtext('jornada:' || p_location::text));

  select id from public.jornada
   where location_id = p_location and cerrada_en is null
   into v_id;
  if found then return v_id; end if;

  insert into public.jornada (tenant_id, location_id, numero)
  select v_tenant, p_location,
         coalesce(max(numero), 0) + 1 from public.jornada where location_id = p_location
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.jornada_abierta(uuid) to authenticated, service_role;

-- ── Cada venta cae en la jornada abierta. SOLA ───────────────────────────────
--
-- Con un trigger, y no llamándolo desde el TPV: por aquí pasan el TPV, el kiosko, el
-- comandero, los pedidos de la web y lo que venga mañana. Si dependiera de que cada uno se
-- acuerde de rellenar `jornada_id`, el primero que se olvide deja ventas huérfanas — y esas
-- ventas no aparecen en ningún cierre. Nadie las echa de menos hasta que falta el dinero.
create or replace function public.asignar_jornada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.jornada_id is null and new.location_id is not null then
    new.jornada_id := public.jornada_abierta(new.location_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_asignar_jornada on public.sales_order;
create trigger trg_asignar_jornada before insert on public.sales_order
  for each row execute function public.asignar_jornada();

-- ── El Z: qué se ha hecho en esta jornada ────────────────────────────────────
--
-- Se puede pedir en cualquier momento (el encargado quiere ver cómo va la noche) y es lo
-- que se congela al cerrar.
create or replace function public.z_de_jornada(p_jornada uuid)
returns jsonb
language sql
stable
as $$
  with ventas as (
    select o.id, o.total, o.estado, o.tipo_operacion
      from public.sales_order o
     where o.jornada_id = p_jornada
  ),
  cobradas as (select * from ventas where estado = 'COBRADA' and tipo_operacion = 'VENTA'),
  pagos as (
    select p.metodo, sum(p.importe) as importe, sum(coalesce(p.propina, 0)) as propina
      from public.payment p
      join cobradas c on c.id = p.order_id
     group by p.metodo
  ),
  impuestos as (
    select l.tipo, sum(l.base) as base, sum(l.cuota) as cuota
      from public.invoice_tax_line l
      join public.invoice i on i.id = l.invoice_id
      join cobradas c on c.id = i.order_id
     group by l.tipo
  )
  select jsonb_build_object(
    'tickets',        (select count(*) from cobradas),
    'total',          (select coalesce(sum(total), 0) from cobradas),
    'ticket_medio',   (select case when count(*) = 0 then 0
                                   else round(coalesce(sum(total), 0) / count(*), 2) end from cobradas),
    -- Invitaciones y autoconsumo NO son venta y no pueden sumar al total. Pero se enseñan:
    -- es exactamente lo que un dueño quiere vigilar.
    'invitaciones',   (select coalesce(sum(total), 0) from ventas where tipo_operacion = 'INVITACION'),
    'autoconsumo',    (select coalesce(sum(total), 0) from ventas where tipo_operacion = 'AUTOCONSUMO'),
    'anuladas',       (select count(*) from ventas where estado = 'ANULADA'),
    'por_metodo',     (select coalesce(jsonb_agg(jsonb_build_object(
                          'metodo', metodo, 'importe', importe, 'propina', propina)), '[]'::jsonb) from pagos),
    'impuestos',      (select coalesce(jsonb_agg(jsonb_build_object(
                          'tipo', tipo, 'base', base, 'cuota', cuota) order by tipo), '[]'::jsonb) from impuestos),
    'facturas',       (select count(*) from public.invoice i join cobradas c on c.id = i.order_id),
    'abiertas',       (select count(*) from ventas where estado not in ('COBRADA', 'ANULADA'))
  );
$$;

grant execute on function public.z_de_jornada(uuid) to authenticated, service_role;

-- ── Cerrar la jornada ────────────────────────────────────────────────────────
--
-- LAS MESAS ABIERTAS NO SE TOCAN. Es una decisión, y va contra la tentación de "cerrarlo
-- todo automáticamente":
--
--   Si a las 6 de la mañana quedan 2 mesas abiertas, el nodo NO las cobra ni las anula. Las
--   deja abiertas, y su venta contará en la jornada en la que se cobre de verdad. La
--   jornada se cierra con lo COBRADO; lo pendiente no se inventa.
--
--   Con VERIFACTU delante, fabricar cobros o anulaciones de ventas que nadie ha confirmado
--   es firmar ante Hacienda algo que no ha pasado. El Z deja constancia («quedaron 2 mesas
--   abiertas») y ya está.
create or replace function public.cerrar_jornada(
  p_jornada uuid,
  p_por     uuid default null,
  p_tipo    text default 'MANUAL',
  -- Lo que el encargado ha CONTADO en el cajón. `null` = no lo contó (o lo cerró el reloj).
  p_contado numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_z        jsonb;
  v_abiertas int;
  v_cerrada  timestamptz;
  v_efectivo numeric;
begin
  select cerrada_en from public.jornada where id = p_jornada for update into v_cerrada;
  if not found then
    raise exception 'Esa jornada no existe' using errcode = 'GLU03';
  end if;

  -- Cerrar dos veces no puede volver a congelar el Z: el segundo cierre lo haría con las
  -- ventas de la jornada SIGUIENTE ya dentro, y reescribiría un cierre que ya se declaró.
  if v_cerrada is not null then
    raise exception 'Esa jornada ya está cerrada'
      using errcode = 'GLU04', hint = 'Ya se cerró. Mira el Z de esa jornada en los informes.';
  end if;

  v_z := public.z_de_jornada(p_jornada);
  v_abiertas := coalesce((v_z->>'abiertas')::int, 0);

  -- El descuadre, calculado AQUÍ y no en el navegador: es un número que puede acabar en una
  -- conversación incómoda con un empleado, y tiene que salir del mismo sitio del que sale el
  -- Z. Lo que dice el sistema que hay en efectivo, contra lo que el encargado ha contado.
  select coalesce(sum((m->>'importe')::numeric), 0)
    from jsonb_array_elements(v_z->'por_metodo') m
   where m->>'metodo' = 'EFECTIVO'
    into v_efectivo;

  update public.jornada set
    cerrada_en       = now(),
    cerrada_por      = p_por,
    tipo_cierre      = p_tipo,
    -- Si la cerró el reloj, NADIE HA CONTADO LA CAJA. Hay que decirlo al abrir al día
    -- siguiente, no dejarlo pasar: una caja sin arquear es un descuadre que ya nadie podrá
    -- reconstruir. (Y un cierre manual en el que tampoco se contó, igual.)
    arqueo_pendiente = (p_tipo = 'AUTOMATICO' or p_contado is null),
    mesas_abiertas   = v_abiertas,
    efectivo_contado = p_contado,
    descuadre        = case when p_contado is null then null else p_contado - v_efectivo end,
    z                = v_z || jsonb_build_object(
                         'efectivo_esperado', v_efectivo,
                         'efectivo_contado',  p_contado,
                         'descuadre',         case when p_contado is null then null
                                                   else p_contado - v_efectivo end)
  where id = p_jornada;

  return v_z;
end;
$$;

-- La firma vieja (3 argumentos) se va: si se quedara, PostgREST tendría DOS funciones con el
-- mismo nombre y no sabría a cuál llamar («could not choose the best candidate function»).
drop function if exists public.cerrar_jornada(uuid, uuid, text);

grant execute on function public.cerrar_jornada(uuid, uuid, text, numeric) to authenticated, service_role;

-- ── Las ventas que ya existen ────────────────────────────────────────────────
--
-- Se les asigna una jornada por su fecha, para que los informes no empiecen con un agujero.
-- Es una aproximación (la jornada de verdad no la sabemos: no existía), pero es mucho mejor
-- que dejarlas huérfanas: sin `jornada_id`, no saldrían en NINGÚN informe.
do $$
declare
  l record;
  v_jornada uuid;
  n int := 0;
begin
  for l in select distinct location_id, tenant_id from public.sales_order
            where jornada_id is null and location_id is not null
  loop
    insert into public.jornada (tenant_id, location_id, numero, abierta_en, cerrada_en,
                                tipo_cierre, z, arqueo_pendiente)
    select l.tenant_id, l.location_id,
           coalesce((select max(numero) from public.jornada where location_id = l.location_id), 0) + 1,
           coalesce(min(o.created_at), now()), now(), 'AUTOMATICO',
           jsonb_build_object('historico', true), false
      from public.sales_order o
     where o.location_id = l.location_id and o.jornada_id is null
    returning id into v_jornada;

    update public.sales_order set jornada_id = v_jornada
     where location_id = l.location_id and jornada_id is null;

    n := n + 1;
  end loop;
  raise notice 'ventas anteriores agrupadas en % jornada(s) histórica(s)', n;
end $$;
