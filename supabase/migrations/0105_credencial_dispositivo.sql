-- 0105_credencial_dispositivo.sql
--
-- CREDENCIAL PROPIA POR TERMINAL (capa 1 del modelo de acceso).
--
-- Hasta ahora el "emparejado" era solo una ETIQUETA: un código de un solo uso marcaba el
-- terminal como vinculado, pero el "token de dispositivo" que se firmaba NO autenticaba nada
-- (se guardaba y nunca se leía). Quien entraba de verdad era el camarero por PIN.
--
-- Con esto el terminal tiene una credencial REUTILIZABLE (usuario + contraseña), creada desde
-- el panel. El TPV se identifica con ella ante el nodo la primera vez y guarda un token largo
-- ("recordar"). Ventaja sobre el código de un solo uso: si se reinstala el terminal, se vuelve
-- a meter el mismo usuario+contraseña, sin tener que generar un código nuevo desde el panel.
--
-- Sigue por encima el PIN del camarero (capa 2): esto identifica el EQUIPO, no a la persona.

alter table public.device
  add column if not exists usuario    text,
  add column if not exists clave_hash text;

-- Un terminal no puede llamarse igual que otro DENTRO del mismo bar. (Entre bares distintos
-- sí puede repetirse: cada nodo tiene un solo tenant, así que no colisiona en la práctica.)
create unique index if not exists device_usuario_uq
  on public.device (tenant_id, lower(usuario)) where usuario is not null;

-- Fijar/cambiar la credencial de un terminal. El bcrypt lo hace Postgres (pgcrypto), igual
-- que la contraseña del titular (fijar_password_local): la clave en claro no se guarda nunca.
create or replace function public.fijar_clave_dispositivo(p_device uuid, p_usuario text, p_clave text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.device
     set usuario    = p_usuario,
         clave_hash = crypt(p_clave, gen_salt('bf'))
   where id = p_device;
$$;

-- Verificar la credencial de un terminal. Lo llama el NODO al hacer login del dispositivo:
-- devuelve la fila si usuario+clave cuadran, nada si no. Como un nodo tiene un solo tenant,
-- el usuario identifica un único terminal.
create or replace function public.verificar_clave_dispositivo(p_usuario text, p_clave text)
returns table (device_id uuid, tenant_id uuid, nombre text, modulo text, tipo text, estacion text)
language sql
security definer
set search_path to 'public'
as $$
  select id, tenant_id, nombre, modulo, tipo, estacion
    from public.device
   where lower(usuario) = lower(p_usuario)
     and clave_hash is not null
     and clave_hash = crypt(p_clave, clave_hash)
   limit 1;
$$;

-- Ambas son SECURITY DEFINER y solo para service_role: la API (crear credencial) y el nodo
-- (verificarla) llaman con esa clave. Un anónimo NO puede ni fijar ni sondear credenciales.
revoke all on function public.fijar_clave_dispositivo(uuid, text, text) from public;
revoke all on function public.verificar_clave_dispositivo(text, text)   from public;
grant execute on function public.fijar_clave_dispositivo(uuid, text, text) to service_role;
grant execute on function public.verificar_clave_dispositivo(text, text)   to service_role;
