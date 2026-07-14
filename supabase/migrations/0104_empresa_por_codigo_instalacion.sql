-- 0104 — CANJEAR EL CÓDIGO DE INSTALACIÓN. Sin esto, el instalador no pasa de la primera
-- pregunta.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  EL INSTALADOR NO PODÍA INSTALAR
--
--  `Instalar-Gluuh.ps1` empieza pidiendo el CÓDIGO DE INSTALACIÓN (21 dígitos) y lo valida
--  contra la nube:
--
--      GET /rest/v1/tenant?select=id,nombre&codigo_instalacion=eq.XXXX-...
--
--  Con la clave pública. O sea, **como anónimo**. Y la única política de `tenant` es
--  `id = current_tenant_id()`: un anónimo no tiene empresa, así que la RLS devuelve **cero
--  filas**. Con un 200 tan tranquila.
--
--  Resultado: el instalador respondía **«Ese código no es válido»** — siempre, con
--  cualquier código, para siempre. **No se podía instalar ni un bar.**
--
--  Nadie lo sabía porque ese script nunca se había ejecutado: nosotros instalábamos a mano,
--  con otros comandos. Probábamos un camino distinto del que recorre el cliente.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- No se arregla abriendo `tenant` al anónimo: eso enseñaría **la lista de todos nuestros
-- clientes** a cualquiera que tenga la clave pública… que va dentro de cualquier navegador
-- que abra app.gluuh.com. O sea, a cualquiera.
--
-- Se arregla con una función que CANJEA el código. El código de 21 dígitos **es la
-- credencial** (10^21 combinaciones: no se adivina), y a cambio se devuelve **una sola
-- empresa** y sólo lo justo para que el técnico confirme que no se ha equivocado de bar.
-- Sin código no hay fila; con un código, esa fila y ninguna más. No se puede enumerar.

create or replace function public.empresa_por_codigo(p_codigo text)
returns table (id uuid, nombre text, activo boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.nombre, t.activo
    from public.tenant t
   where t.codigo_instalacion = trim(p_codigo)
   limit 1;
$$;

comment on function public.empresa_por_codigo(text) is
  'Canjea el código de instalación (21 dígitos) por la empresa. Lo usa el instalador del '
  'nodo, que en ese momento todavía no tiene sesión. Devuelve UNA empresa o ninguna: el '
  'código es la credencial, y no se puede enumerar.';

-- Lo llama el instalador ANTES de tener sesión: por eso `anon`. Y `service_role` para
-- nosotros.
revoke all on function public.empresa_por_codigo(text) from public;
grant execute on function public.empresa_por_codigo(text) to anon, authenticated, service_role;
