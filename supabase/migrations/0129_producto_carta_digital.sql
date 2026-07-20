-- 0129 — Separar «carta digital» de «e-commerce».
--
-- En Glop son dos casillas distintas de la lista de artículos (ECOM y
-- C_DIGITAL) y hacen cosas distintas: uno es la tienda para pedir por internet,
-- el otro es la carta por QR que el cliente abre sentado en la mesa. Un bar
-- quiere media carta en el QR y nada en la tienda, así que fundirlas obligaba a
-- elegir mal.
--
-- Arranca COPIANDO `ecommerce`: si se dejara en `false`, al desplegar
-- desaparecerían de la carta QR todos los artículos que hoy salen en ella — y
-- nadie lo vería hasta que un cliente escaneara el código.
-- La copia va DENTRO del "si no existe": si estuviera suelta, cada pasada de la
-- migración volvería a igualar las dos casillas y le desharía al bar el trabajo
-- de haberlas separado — sin dar ningún error.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product' and column_name = 'carta_digital'
  ) then
    alter table public.product add column carta_digital boolean not null default false;
    update public.product set carta_digital = ecommerce;
  end if;
end $$;

comment on column public.product.ecommerce     is 'Se puede pedir por internet (tienda).';
comment on column public.product.carta_digital is 'Sale en la carta por QR de la mesa.';
