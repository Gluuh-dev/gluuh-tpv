-- 0049: reglas reales de promoción sobre la tabla `promocion` (creada en 0020
-- solo con nombre/descripcion/activa). Tipo de descuento, valor, vigencia por
-- fechas, franja horaria, días de la semana y ámbito (toda la carta cuando
-- category_id y product_id son NULL). Lo consume (panel)/promociones.
-- ponytail: el TPV aún no aplica estas promociones al vender — solo se configuran.
alter table public.promocion
  add column if not exists tipo         text not null default 'PCT' check (tipo in ('PCT','EUR')),
  add column if not exists valor        numeric(12,2) not null default 0,
  add column if not exists fecha_inicio date,
  add column if not exists fecha_fin    date,
  add column if not exists hora_inicio  time,
  add column if not exists hora_fin     time,
  add column if not exists dias_semana  int[] default null,  -- 1=lunes … 7=domingo; null = todos
  add column if not exists category_id  uuid references public.category(id) on delete set null,
  add column if not exists product_id   uuid references public.product(id) on delete set null,
  add column if not exists activa       boolean not null default true;

-- `activa` ya existía en 0020 como nullable: normalizar a NOT NULL DEFAULT true.
update public.promocion set activa = true where activa is null;
alter table public.promocion alter column activa set default true;
alter table public.promocion alter column activa set not null;
