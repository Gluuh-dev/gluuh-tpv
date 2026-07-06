-- Semilla de la BIBLIOTECA de modificadores (Fase 2 Glop) para UN tenant.
-- Crea los grupos base sin asignarlos: el cliente los asigna a sus familias.
-- Requiere la migración 0064. Idempotente (no duplica por nombre).
-- Por defecto siembra el tenant "Bar Demo"; cambiar el WHERE para otro.
-- TODO: cablear esta semilla al alta de empresa (api/admin/crear-empresa).

do $$
declare
  t uuid;
  g uuid;
begin
  select id into t from public.tenant where nombre ilike 'bar demo' limit 1;
  if t is null then
    raise notice 'Tenant no encontrado: ajusta el WHERE de la semilla.';
    return;
  end if;

  -- Punto de la carne (comentario a cocina; al asignarlo, el TPV lo pinta
  -- como elige-uno obligatorio por min_sel = 1)
  if not exists (select 1 from public.modifier_group
                 where tenant_id = t and product_id is null and nombre = 'Punto de la carne') then
    insert into public.modifier_group (tenant_id, nombre, tipo, min_sel, max_sel)
      values (t, 'Punto de la carne', 'COMENTARIO', 1, 1) returning id into g;
    insert into public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) values
      (t, g, 'Poco hecha', 0), (t, g, 'Al punto', 0), (t, g, 'Hecha', 0), (t, g, 'Muy hecha', 0);
  end if;

  -- Alergias e intolerancias (comentario, opcional, selección múltiple)
  if not exists (select 1 from public.modifier_group
                 where tenant_id = t and product_id is null and nombre = 'Alergias e intolerancias') then
    insert into public.modifier_group (tenant_id, nombre, tipo, min_sel, max_sel)
      values (t, 'Alergias e intolerancias', 'COMENTARIO', 0, 99) returning id into g;
    insert into public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) values
      (t, g, 'Sin gluten', 0), (t, g, 'Sin lactosa', 0), (t, g, 'Alergia frutos secos', 0), (t, g, 'Sin huevo', 0);
  end if;

  -- Extras típicos (con precio)
  if not exists (select 1 from public.modifier_group
                 where tenant_id = t and product_id is null and nombre = 'Extras') then
    insert into public.modifier_group (tenant_id, nombre, tipo, min_sel, max_sel)
      values (t, 'Extras', 'EXTRA', 0, 99) returning id into g;
    insert into public.modifier (tenant_id, modifier_group_id, nombre, precio_extra) values
      (t, g, 'Huevo frito', 1.00), (t, g, 'Queso', 1.00), (t, g, 'Bacon', 1.50),
      (t, g, 'Aguacate', 1.50), (t, g, 'Pan sin gluten', 0.50);
  end if;

  raise notice 'Biblioteca sembrada para el tenant %', t;
end $$;
