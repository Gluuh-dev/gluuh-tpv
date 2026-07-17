# Plan 017: Cerrar las RPC privilegiadas y hacer inequívoco el tenant activo

> **Instrucciones para el ejecutor**: este plan toca RLS y caja. Reserva el siguiente número libre en `docs/estado/AHORA.md` antes de crear la migración con `supabase migration new`. Cloud y nodo autorizados son los únicos destinos. Nunca uses PostgreSQL 5432.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- supabase/migrations/0103_jornada.sql supabase/migrations/0080_device_heartbeat.sql supabase/migrations/0002_auth.sql supabase/migrations/0078_instalacion_por_codigo.sql apps/nodo apps/web/app/lib/print-dispatcher.tsx`.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: M
- **Riesgo**: HIGH
- **Depende de**: plan 016
- **Categoría**: security / migration
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

`jornada_abierta` y `cerrar_jornada` corren como `SECURITY DEFINER`, aceptan un UUID y no comprueban que pertenezca al tenant del llamante. Tampoco revocan el EXECUTE implícito de `PUBLIC`. `device_heartbeat` actualiza cualquier UUID y se concede a `anon`. Además, `current_tenant_id()` usa `LIMIT 1` sobre un `auth_user_id` cuya unicidad pudo quedar sin crear.

## Estado actual

```sql
-- supabase/migrations/0103_jornada.sql:115-120
select id from public.jornada where location_id = p_location ...;
select tenant_id from public.location where id = p_location into v_tenant;
```

No compara `v_tenant` con `current_tenant_id()`. El cierre (`:250-289`) selecciona/actualiza por `p_jornada` sin tenant. `0080_device_heartbeat.sql:15-18` hace `update device ... where id = p_device`, y `:20` concede a `anon`. `0078_instalacion_por_codigo.sql:58-61` absorbe cualquier error al crear el índice único.

Patrón seguro existente: RPC admin de migraciones 0083+ revocan `PUBLIC, anon, authenticated` y validan `es_admin_plataforma()` dentro.

## Comandos

| Propósito | Comando | Esperado |
|---|---|---|
| Crear migración | `supabase migration new endurecer_rpc_privilegiadas` | siguiente número reservado |
| DB test | scripts nuevos contra `127.0.0.1:55432/gluuh` | dos tenants aislados |
| Core/web | `corepack pnpm typecheck && corepack pnpm test` | exit 0 |
| Advisors | MCP `get_advisors` o CLI descubierta con `--help` | sin finding nuevo crítico |

## Alcance

**Dentro**: nueva migración aditiva; tests en `apps/nodo/pruebas/`; callers de jornada/heartbeat solo si cambia la firma; tipos regenerados.

**Fuera**: rediseñar la jornada, activar VERIFACTU, limpiar manualmente usuarios duplicados sin aprobación, tocar otras bases.

## Git

- Rama: `codex/017-rpc-tenant`
- Commit: `fix(db): acotar rpc privilegiadas por tenant`
- No push sin orden.

## Pasos

### 1. Preflight read-only

Confirmar grants/owners efectivos, duplicados de `auth_user_id` con conteo agregado, jornadas/locales cruzados y consumers de las firmas. No mostrar emails/IDs completos.

**Verifica**: preflight documenta 0/N duplicados y grants exactos. Si hay duplicados, STOP antes del constraint.

### 2. Versionar funciones con fail-closed

Recrear jornada/heartbeat con `SET search_path = ''` o lista mínima, `REVOKE ALL FROM PUBLIC, anon`, grants explícitos y comprobación interna de tenant/rol. Para el reloj automático, separar una firma service-role/local de la firma usuario. No confiar en un `device_id` aportado sin identidad verificable.

**Verifica**: anon recibe 401/403 equivalente; tenant A no puede abrir/leer/cerrar B; propietario/encargado A y servicio local mantienen su flujo.

### 3. Imponer identidad única

Tras preflight/limpieza aprobada, crear constraint/índice único sin `WHEN OTHERS`. Hacer que `current_tenant_id()` sea determinista y falle nulo ante identidad ambigua/inexistente.

**Verifica**: segundo vínculo del mismo auth a otro tenant falla; tokens existentes se renuevan según plan de despliegue.

### 4. Migrar heartbeat a identidad autenticada

Derivar `device_id` de claim validado/gateway o ejecutar como service role desde un endpoint que valide JWT de dispositivo. Retirar la llamada anónima directa de `print-dispatcher.tsx` solo cuando el reemplazo esté desplegado.

**Verifica**: manipular `p_device` no modifica otra fila; revocación/expiración impiden latido.

### 5. Despliegue compatible cloud → nodo

Aplicar primero esquema compatible en cloud, regenerar tipos, empaquetar nodo y hacer canary. No retirar firmas viejas hasta migrar callers; dejarlas revocadas/no expuestas durante transición.

**Verifica**: `prueba-jornada.mjs`, `prueba-rls.mjs`, prueba heartbeat y jornada automática pasan mediante roles reales, no conexión privilegiada solamente.

## Pruebas

- Matriz anon/auth/service × tenant A/B para abrir, Z, cerrar y heartbeat.
- Concurrencia: dos aperturas crean una jornada.
- Idempotencia: segundo cierre sigue fallando sin reescribir Z.
- Usuario sin `app_user` y duplicado simulado no obtiene tenant.

## Hecho cuando

- [ ] Ninguna RPC definer de alcance conserva EXECUTE PUBLIC.
- [ ] UUID ajeno nunca permite leer/mutar.
- [ ] `auth_user_id` es único o el plan se bloqueó con datos concretos.
- [ ] Jornada automática y heartbeat legítimo siguen operativos.
- [ ] Advisors y suite de dos tenants están verdes.

## STOP

- Hay duplicados históricos sin decisión de limpieza.
- El MCP muestra firmas/grants distintos a migraciones/tipos.
- La reparación exige cambiar semántica fiscal del Z.
- No existe forma de autenticar dispositivo sin el plan 024; en ese caso dejar heartbeat service-only y coordinar.

## Mantenimiento

Toda nueva `SECURITY DEFINER` debe incluir revoke explícito, identidad/tenant internos y prueba adversarial. No aceptar comentarios que afirmen “el token lo aporta” sin validación en SQL/servidor.

