# Plan 016: Verificar el esquema vivo y convertir los tipos Supabase en contrato compilado

> **Instrucciones para el ejecutor**: sigue el plan en orden. No apliques SQL en este plan. Usa el MCP de Supabase únicamente en lectura sobre `gxcqihslbicrszgzudjs`. Si una condición de STOP aparece, informa y no improvises.
>
> **Drift check**: `git diff --stat 4d11ee5..HEAD -- supabase/types apps/web/app/lib/supabaseBrowser.ts apps/web/app/lib/supabaseServidor.ts apps/mobile/src/supabase.ts packages/supabase` y `git status --short --` sobre esas rutas. Hay cambios de usuario no relacionados en el árbol; no los mezcles.

## Estado

- **Prioridad**: P0
- **Esfuerzo**: M
- **Riesgo**: MED
- **Depende de**: ninguno
- **Categoría**: migration / tech-debt
- **Planificado en**: commit `4d11ee5`, 2026-07-17

## Por qué importa

El snapshot generado contiene 82 tablas y 43 RPC, pero está en UTF-16 LE, ESLint lo trata como binario y ningún `createClient` usa `Database`. Además, `0105_credencial_dispositivo.sql` existe y el código invoca sus RPC, pero sus columnas/funciones no aparecen en los tipos mientras sí aparecen `0106`–`0110`. Antes de reparar esquema o código hay que saber cuál es la verdad viva.

## Estado actual

- `supabase/types/database.types.ts:9-14` exporta `Database` y PostgREST 14.5, pero el archivo tiene BOM UTF-16 LE.
- `apps/web/app/lib/supabaseBrowser.ts:7-9,38` usa `SupabaseClient`/`createClient` sin genérico.
- `apps/web/app/lib/supabaseServidor.ts:58-93`, `apps/mobile/src/supabase.ts:7` y `packages/supabase/src/index.ts:16-22` repiten el cliente sin tipos.
- `apps/web/app/api/dispositivos/generar/route.ts:95` invoca `fijar_clave_dispositivo`; `apps/nodo/auth.mjs:191` invoca `verificar_clave_dispositivo`.
- `supabase/migrations/0105_credencial_dispositivo.sql` define ambas RPC y `device.usuario`/`clave_hash`.
- Regla del repo: `supabase/migrations` es canónico; `apps/api/db/schema.sql` no se sincroniza ni se usa como verdad.

## Herramientas y comandos

| Propósito | Comando | Esperado |
|---|---|---|
| Estado | `git status --short` | se identifican cambios ajenos |
| Tipos | comando documentado de generación Supabase redirigido explícitamente como UTF-8 | archivo UTF-8, sin bytes nulos |
| Lint | `corepack pnpm lint` | exit 0 al final de la tanda de lint; este plan no corrige errores ajenos |
| Tipos | `corepack pnpm typecheck` | 12 tareas correctas y errores reales resueltos en rutas en alcance |
| Tests | `corepack pnpm test` | 91+ tests verdes |

Usa las skills `supabase` y `gluuh-base-datos`. Descubre la sintaxis de CLI con `supabase --help`; no la adivines.

## Alcance

**Dentro**:

- `supabase/types/database.types.ts`
- factorías de cliente citadas arriba
- `packages/supabase/package.json` y exports si son necesarios
- un script reproducible de generación en `package.json` o paquete Supabase
- documentación mínima del comando en `supabase/README.md`

**Fuera**:

- cualquier migración o escritura DB
- corregir `0105` sin confirmación viva
- migrar todos los casts/`any` de la aplicación en un solo PR
- `apps/api/db/schema.sql`

## Git

- Rama: `codex/016-tipos-supabase`
- Commits conventional, por ejemplo `refactor(supabase): tipar clientes compartidos`
- No push/PR sin orden del operador.

## Pasos

### 1. Confirmar metadatos vivos en solo lectura

Consultar por MCP tablas/columnas/funciones/grants de `device`, las dos RPC de `0105`, objetos `0106`–`0110`, RLS y advisors. Registrar solo metadatos, nunca filas personales.

**Verifica**: una tabla de contraste migración ↔ cloud ↔ tipos con fecha y resultado. Si `0105` falta, STOP: abrir una reparación de esquema separada antes de regenerar tipos.

### 2. Hacer determinista la generación UTF-8

Añadir un único comando que genere a archivo temporal UTF-8 y reemplace el destino solo con exit 0. En PowerShell 5.1 no confiar en el encoding por defecto de `>`/`Out-File`; usar una vía explícita compatible con CI.

**Verifica**: `Format-Hex supabase/types/database.types.ts | Select-Object -First 1` no empieza por `FF FE`; conteo de bytes nulos = 0.

### 3. Exportar el contrato y tipar factorías

Exportar `Database` desde el paquete compartido o un módulo canónico y parametrizar browser, server caller/service, móvil y `createGluuhClient`. Conservar la selección runtime nube/nodo de `supabaseServidor`; no reemplazarla por `NEXT_PUBLIC_*`.

**Verifica**: `rg -n "createClient\(" apps packages` revisado; los clientes Supabase de producción llevan `Database` salvo excepciones justificadas.

### 4. Resolver solo los errores aflorados en las fronteras

Corregir tipos en factorías y contratos inmediatos; no convertir este plan en refactor del TPV. Si aparecen más de 25 errores fuera de esas fronteras, exportar aliases compatibles y dejar migración por dominio para planes posteriores.

**Verifica**: `corepack pnpm typecheck` → exit 0.

### 5. Añadir gate de drift

En CI, regenerar en temporal y comparar con el versionado sin contactar producción si la credencial no está disponible; alternativamente, gate manual documentado en cada PR de migración.

**Verifica**: modificar una firma de prueba provoca diff/fallo; restaurar deja el gate verde.

## Pruebas

- Test de compilación de una tabla, Insert/Update y una RPC representativa.
- Test/fixture que garantiza UTF-8 sin BOM UTF-16.
- Regeneración dos veces produce hash idéntico.
- `corepack pnpm typecheck && corepack pnpm test` pasa.

## Hecho cuando

- [ ] El estado de `0105` está confirmado por metadatos, no inferido.
- [ ] El archivo generado es UTF-8 y ESLint no lo trata como binario.
- [ ] Todas las factorías principales usan `Database`.
- [ ] La generación es reproducible y documentada.
- [ ] No se modificó ninguna base ni `apps/api/db/schema.sql`.

## STOP

- `0105` no existe o difiere en cloud.
- Los tipos se generaron desde otro project ref.
- Alguna ruta en alcance está sucia por otra sesión.
- Tipar exige cambiar comportamiento de negocio o más de 25 consumidores.

## Mantenimiento

Toda migración futura debe terminar con regeneración/diff de tipos. Los planes 017–021 dependen de este contrato para no codificar firmas SQL a ciegas.

