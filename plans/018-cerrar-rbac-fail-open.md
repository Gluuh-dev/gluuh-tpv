# Plan 018: Convertir RBAC y el panel a autorización fail-closed

> **Instrucciones para el ejecutor**: preserva una política offline explícita para vender, pero nunca uses “si falla, propietario”. Reserva migración si cambias SQL. No implementes un sistema RBAC nuevo; endurece el existente.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- supabase/migrations/0071_rls_permisos_escritura.sql supabase/migrations/0072_rls_catalogo_escritura.sql apps/web/app/\(panel\)/layout.tsx apps/web/app/lib/permisos.ts apps/web/app/\(panel\)/perfiles apps/web/app/\(panel\)/empleados` y `git status --short` sobre esas rutas.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: M–L
- **Riesgo**: HIGH
- **Depende de**: plan 016; coordinar con 017
- **Categoría**: security / bug
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

`operario_permite` termina en `coalesce(..., true)` y los perfiles son opcionales. El panel descarta errores y usa `PROPIETARIO` + `{}` cuando no puede resolver `app_user`; `{}` significa todos los permisos. La UI puede mostrar y ejecutar mutaciones que RLS solo restringe por tenant.

## Estado actual

```sql
-- 0071_rls_permisos_escritura.sql:21-32
select coalesce(..., (select ... from perfil ...), true);
```

```ts
// apps/web/app/(panel)/layout.tsx:42-48
const [{ data: t }, { data: u }] = await Promise.all([...]);
setInfo({ ..., rol: (u?.rol as Rol) ?? "PROPIETARIO", permisos: perfilRel?.permisos ?? {} });
```

`apps/web/app/lib/permisos.ts:72-74` devuelve permitido salvo `false` explícito. Las políticas finas de 0071/0072 usan esa semántica.

## Comandos

| Propósito | Comando | Esperado |
|---|---|---|
| Typecheck | `corepack pnpm --filter @gluuh/web typecheck` | exit 0 |
| Web tests | `corepack pnpm --filter @gluuh/web test` | todos pasan |
| DB auth tests | prueba nueva en `apps/nodo/pruebas` puerto 55432 | matriz verde |
| Suite | `corepack pnpm test` | 91+ verdes |

## Alcance

**Dentro**: nueva migración para `operario_permite`/backfill/default; layout/guards del panel; helpers de permisos; tests; rutas/RPC sensibles citadas por el catálogo.

**Fuera**: rediseñar navegación, sustituir perfiles por tablas role/permission, MFA, permisos de admin plataforma ya protegidos.

## Git

- Rama: `codex/018-rbac-fail-closed`
- Commits: `fix(auth): cerrar permisos ausentes` y `test(auth): cubrir matriz rbac`

## Pasos

### 1. Inventariar identidades y decisiones de default

Contar por rol usuarios sin perfil y claves ausentes en perfiles recomendados. Definir una tabla de permisos mínimos por rol, con decisión explícita: propietario completo; resto solo permisos declarados. No modificar datos hasta aprobar el backfill.

**Verifica**: documento/preflight agregado con número de afectados y mapping completo de `IDS_PERMISOS`.

### 2. Backfill y función fail-closed

Crear perfiles mínimos faltantes/asignaciones de forma idempotente y después recrear `operario_permite`: propietario/admin explícitos pueden; ausencia de usuario/perfil/clave devuelve `false` para acciones sensibles. Usar `auth.uid()` interno y tenant coherente.

**Verifica**: camarero sin perfil no puede UPDATE/DELETE `app_user`, perfil ni catálogo; propietario sí.

### 3. Corregir bootstrap del panel

Capturar `error` de sesión, tenant y usuario. Estados explícitos: cargando, no autenticado, identidad incompleta, error recuperable. Nunca montar hijos ni menú privilegiado sin `SessionInfo` válida. `finally` debe evitar spinner eterno y la reautenticación debe ser posible.

**Verifica**: tests de componente/hook con fallo en cada consulta; ningún caso produce rol propietario por defecto.

### 4. Mover autorización sensible al servidor

Catalogar mutaciones de usuario/perfil/catálogo/precio/cobro. Las que ya tienen política restrictiva se prueban; las monetarias se delegan a planes 019/020. No confiar en el menú o `puede()` como barrera.

**Verifica**: llamada manual con UI manipulada recibe denegación server/RLS.

### 5. Despliegue progresivo

Aplicar backfill antes de cambiar default, renovar sesiones y monitorizar denegaciones por permiso. Mantener un procedimiento de recuperación service-role auditado, no un fallback en cliente.

**Verifica**: propietario, encargado, camarero y cocina completan sus journeys permitidos en nodo y cloud.

## Pruebas

- Permiso true/false/ausente; perfil nulo; usuario nulo; propietario.
- Dos tenants: no editar perfiles/usuarios ajenos.
- Error de `getSession`, tenant y app_user; redirección/carga/error.
- DevTools/payload directo contra mutaciones sensibles.

## Hecho cuando

- [ ] Ningún fallback asigna `PROPIETARIO` o `{}` permisivo.
- [ ] `operario_permite` es fail-closed para ausencia/clave ausente.
- [ ] Todos los usuarios operativos tienen perfil/default explícito.
- [ ] Matriz RBAC está probada server-side en cloud y nodo.
- [ ] Denegaciones quedan observables sin datos sensibles.

## STOP

- El backfill cambiaría permisos de propietarios/encargados sin mapping aprobado.
- Se requiere bloquear venta offline para cerrar un permiso administrativo.
- Hay rutas sucias por otra sesión.
- Un permiso no tiene dueño funcional claro; registrar pregunta y detener esa mutación.

## Mantenimiento

Cada nueva acción debe declarar permiso, enforcement server/RLS y prueba. “Ausente = permitido” queda prohibido para acciones sensibles.
