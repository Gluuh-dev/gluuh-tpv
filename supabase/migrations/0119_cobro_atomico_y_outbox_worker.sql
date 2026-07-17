-- 0119 — Cobro atómico y lease del worker AEAT (F6 entregas 6.1 núcleo y 6.4; plans/019-020).
--
-- El cobro del TPV hoy: UPDATE estado='COBRADA' y DESPUÉS insert de pagos, con
-- rollback best-effort. Un fallo intermedio deja una venta COBRADA sin pago, y
-- dos terminales pueden cobrar la misma cuenta a la vez. `cobrar_cuenta` mete
-- candado, validación, pagos y estado en UNA transacción.
--
-- Política codificada = la ACTUAL del producto (pendiente puerta 6 de la guía 19
-- §16: propina/redondeo/pago parcial): propina por pago (columna `propina`),
-- sin redondeo (importes de 2 decimales tal cual), VENTA exige suma de pagos ==
-- total, INVITACION/AUTOCONSUMO cierran sin pagos.
--
-- TECHO CONOCIDO (ponytail): `sales_order.total` sigue escrito por el TPV
-- autenticado; la autoridad de PRECIOS pasa al servidor con el comando de venta
-- completo (plan 019 paso 1), que requiere la puerta 6 y migrar el caller.

create or replace function public.cobrar_cuenta(
  p_order    uuid,
  p_pagos    jsonb default '[]'::jsonb,   -- [{metodo, importe, propina?, client_id?, ref_pasarela?}]
  p_operario uuid default null,
  p_client_id uuid default null           -- idempotencia del COBRO completo (reintento tras timeout)
)
returns table (resultado text, order_id uuid, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ord    public.sales_order%rowtype;
  v_tenant uuid := public.current_tenant_id();
  v_claims text := coalesce(current_setting('request.jwt.claims', true), '');
  v_suma   numeric;
  v_pago   jsonb;
begin
  if v_tenant is null then
    return query select 'NO_AUTORIZADO'::text, null::uuid, null::numeric; return;
  end if;
  -- El permiso 'cobrar' se exige a las SESIONES DE USUARIO. Un proceso de
  -- confianza (nodo local sin JWT, o service_role de un route del servidor)
  -- actúa deliberadamente y ya fijó el tenant — el fail-closed de
  -- operario_permite lo denegaría siempre (no tiene app_user).
  if v_claims <> '' and (v_claims::jsonb->>'role') is distinct from 'service_role'
     and not public.operario_permite('cobrar') then
    return query select 'SIN_PERMISO'::text, null::uuid, null::numeric; return;
  end if;

  -- Candado de la cuenta: el segundo terminal ESPERA aquí y se encuentra el
  -- estado ya cambiado — conflicto recuperable, no doble cobro.
  select * into v_ord from public.sales_order
   where id = p_order and tenant_id = v_tenant
   for update;
  if not found then
    return query select 'NO_EXISTE'::text, null::uuid, null::numeric; return;
  end if;

  if v_ord.estado = 'COBRADA' then
    -- Reintento idempotente: si ESTE mismo cobro (client_id) ya entró, el
    -- resultado es el mismo. Si fue OTRO (otro terminal), es un conflicto.
    if p_client_id is not null and exists (
        select 1 from public.payment pg
         where pg.order_id = v_ord.id and pg.client_id = p_client_id) then
      return query select 'OK'::text, v_ord.id, v_ord.total; return;
    end if;
    return query select 'YA_COBRADA'::text, v_ord.id, v_ord.total; return;
  end if;
  if v_ord.estado = 'ANULADA' then
    return query select 'ANULADA'::text, v_ord.id, null::numeric; return;
  end if;

  -- El autor declarado tiene que ser del tenant (o null).
  if p_operario is not null and not exists (
      select 1 from public.app_user u where u.id = p_operario and u.tenant_id = v_tenant) then
    return query select 'NO_AUTORIZADO'::text, null::uuid, null::numeric; return;
  end if;

  if v_ord.tipo_operacion = 'VENTA' then
    v_suma := 0;
    for v_pago in select * from jsonb_array_elements(p_pagos) loop
      if coalesce((v_pago->>'importe')::numeric, -1) < 0 or coalesce((v_pago->>'propina')::numeric, 0) < 0 then
        return query select 'IMPORTE_INVALIDO'::text, v_ord.id, v_ord.total; return;
      end if;
      v_suma := v_suma + (v_pago->>'importe')::numeric;
    end loop;
    -- La suma la comprueba el SERVIDOR contra el total de la BD, al céntimo.
    if v_suma is distinct from v_ord.total then
      return query select 'SUMA_NO_CUADRA'::text, v_ord.id, v_ord.total; return;
    end if;
  end if;

  -- El client_id del COBRO se ancla al primer pago sin id propio: es lo que
  -- permite que un reintento tras timeout se reconozca (mismo p_client_id →
  -- mismo resultado, cero pagos duplicados).
  insert into public.payment (tenant_id, order_id, metodo, importe, propina, ref_pasarela, client_id)
  select v_tenant, v_ord.id,
         p->>'metodo',
         (p->>'importe')::numeric,
         coalesce((p->>'propina')::numeric, 0),
         p->>'ref_pasarela',
         coalesce(nullif(p->>'client_id','')::uuid,
                  case when row_number() over () = 1 then p_client_id end,
                  gen_random_uuid())
  from jsonb_array_elements(p_pagos) p;

  update public.sales_order
     set estado = 'COBRADA',
         user_id = coalesce(p_operario, user_id),
         updated_at = now()
   where id = v_ord.id;

  return query select 'OK'::text, v_ord.id, v_ord.total;
end $$;
revoke all on function public.cobrar_cuenta(uuid, jsonb, uuid, uuid) from public, anon;
grant execute on function public.cobrar_cuenta(uuid, jsonb, uuid, uuid) to authenticated, service_role;

-- ── Lease del worker de la outbox AEAT (6.4; la tabla es de 0118) ────────────
-- `for update skip locked`: dos workers no se pisan; un lease caducado se
-- puede volver a tomar (el worker murió a mitad).
create or replace function public.outbox_tomar(p_max int default 5, p_lease_min int default 2)
returns setof public.fiscal_outbox
language sql
security definer
set search_path = ''
as $$
  update public.fiscal_outbox fo
     set estado = 'ENVIANDO',
         intentos = fo.intentos + 1,
         lease_hasta = now() + make_interval(mins => greatest(p_lease_min, 1)),
         updated_at = now()
   where fo.id in (
     select o.id from public.fiscal_outbox o
      where (o.estado in ('PENDIENTE','REINTENTABLE'))
         or (o.estado = 'ENVIANDO' and o.lease_hasta < now())
      order by o.id
      for update skip locked
      limit greatest(p_max, 1)
   )
  returning fo.*;
$$;
revoke all on function public.outbox_tomar(int, int) from public, anon, authenticated;
grant execute on function public.outbox_tomar(int, int) to service_role;

-- Resolver: el worker SOLO marca ACEPTADA con el acuse en la mano; un fallo se
-- clasifica (REINTENTABLE = red/5xx; RECHAZADA = rechazo funcional de la AEAT).
create or replace function public.outbox_resolver(p_id bigint, p_estado text, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fiscal_outbox
     set estado = p_estado,
         ultimo_error = left(p_error, 2000),
         lease_hasta = null,
         updated_at = now()
   where id = p_id
     and p_estado in ('ACEPTADA','RECHAZADA','REINTENTABLE','PENDIENTE');
$$;
revoke all on function public.outbox_resolver(bigint, text, text) from public, anon, authenticated;
grant execute on function public.outbox_resolver(bigint, text, text) to service_role;
