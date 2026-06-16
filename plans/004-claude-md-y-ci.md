# Plan 004: Añadir `CLAUDE.md` y un pipeline de CI que verifique build + typecheck + tests

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada verificación y
> confirma el resultado esperado antes de continuar. Si ocurre algo de "STOP conditions",
> detente e informa — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Drift check (ejecútalo primero)**:
> `git diff --stat 09857da..HEAD -- package.json turbo.json apps/web/package.json apps/api/package.json packages/core/package.json`
> Si algún fichero cambió, revisa que los scripts/versiones citados aquí siguen vigentes;
> si no coinciden, trátalo como STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `09857da`, 2026-06-15

## Why this matters

Hoy no hay forma automática de saber si un cambio rompe el monorepo: no existe
`.github/workflows`, y los scripts `lint` de `@gluuh/core` y `@gluuh/api` son
`echo "(lint pendiente)"` (no-ops). Tampoco hay `CLAUDE.md`/`AGENTS.md`, así que cualquier
agente (o desarrollador nuevo) que ejecute estos planes parte sin contexto de estructura,
comandos ni convenciones. Este plan añade (1) un `CLAUDE.md` con el mapa del repo y los
comandos verificados, y (2) un CI que corre los comandos que **ya funcionan** (build,
typecheck, test) en cada push/PR. No introduce tooling de lint nuevo (eso se deja como
seguimiento, para no hacer fallar CI con configuración a medio hacer).

## Current state

- Gestor: `pnpm@9.12.0`; `engines.node >=20` (`package.json:6-9`).
- Scripts raíz (`package.json:10-18`): `build`/`dev`/`lint`/`test`/`typecheck` → `turbo run <tarea>`; `core:test`/`core:demo`.
- `turbo.json`: `build` (outputs dist/.next), `typecheck` dependsOn `^build`, `test` dependsOn `^build`.
- Tests reales solo en `@gluuh/core` (Vitest). `apps/api`/`apps/web` no tienen script `test`.
- No existe `.github/` (verificado). No existe `CLAUDE.md` ni `AGENTS.md`.
- Estructura (de README + recon):
  - `apps/api` (NestJS — motor fiscal + write-path sync), `apps/web` (Next.js 16 — backoffice + TPV + kiosko/kds/pantalla), `apps/desktop` (Electron, esqueleto), `apps/mobile` (Expo, esqueleto).
  - `packages/core` (★ dominio + impuestos + VERIFACTU, con tests), `packages/ui` `packages/api-client` `packages/hardware` `packages/sync` `packages/supabase` (esqueletos/parciales).
  - BD: `supabase/migrations/*.sql` (lo que se aplica) y `apps/api/db/schema.sql` (DDL de referencia, espejo a sincronizar — ver `supabase/README.md:27`).

## Commands you will need

| Propósito | Comando | Esperado |
|-----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Build (todo) | `pnpm build` | exit 0 |
| Typecheck (todo) | `pnpm typecheck` | exit 0 |
| Test (todo) | `pnpm test` | exit 0 (core pasa; apps sin tests son no-op) |

> Nota: ejecuta `pnpm build` y `pnpm typecheck` una vez localmente ANTES de escribir el CI,
> para confirmar que pasan en este commit. Si alguno falla en limpio, ver STOP conditions.

## Scope

**In scope** (crear):
- `CLAUDE.md` (raíz)
- `.github/workflows/ci.yml`

**Out of scope** (NO tocar):
- Los scripts `lint` no-op de core/api — NO los conviertas a ESLint real en este plan (es
  un seguimiento aparte; introducir ESLint mal configurado haría fallar CI sin valor).
- `turbo.json`, `package.json` — no cambies la orquestación; el CI usa los scripts existentes.
- Cualquier código fuente — este plan no modifica lógica.

## Git workflow

- Rama: `advisor/004-claude-md-y-ci`
- Conventional commits, p. ej. `docs: añadir CLAUDE.md` y `ci: pipeline build/typecheck/test`.
- No push ni PR salvo indicación. (El workflow se activará en cuanto se suba a GitHub, pero
  subir queda a decisión del operador.)

## Steps

### Step 1: Crear `CLAUDE.md`

Crea `CLAUDE.md` en la raíz con este contenido (ajústalo solo si el drift check reveló
cambios). Es contexto verificado durante el recon:

```markdown
# CLAUDE.md — Gluuh TPV

Monorepo (pnpm + Turborepo, TypeScript) de una plataforma TPV de hostelería para España,
con foco en cumplimiento fiscal **VERIFACTU** e **IGIC** canario.

## Comandos

- `pnpm install` — instala todo el workspace (pnpm 9, Node ≥ 20).
- `pnpm build` / `pnpm typecheck` / `pnpm test` — vía Turbo, en todos los paquetes.
- `pnpm --filter @gluuh/core test` — tests del motor fiscal (Vitest; incluye el vector
  oficial de la AEAT). `pnpm core:demo` — demo de VERIFACTU.
- Dev por app: `pnpm --filter @gluuh/web dev` (http://localhost:3100),
  `pnpm --filter @gluuh/api dev` (PORT=3001), `pnpm --filter @gluuh/mobile start`.

## Estructura

- `packages/core` — ★ el "cerebro" compartido. Dominio (`domain/`), motor de impuestos
  IVA/IGIC/IPSI (`fiscal/tax.ts`), tipos por clase fiscal (`fiscal/tax-rates.ts`), motor
  VERIFACTU (huella SHA-256 encadenada, QR, XML/SOAP) en `fiscal/`. **No duplicar esta
  lógica en las apps; importar de `@gluuh/core`.**
- `apps/api` — NestJS: endpoints fiscales (`/fiscal/preview|xml|enviar`), cliente AEAT
  (mTLS, requiere certificado) y write-path de sync (`/sync/upload`, hoy esqueleto).
- `apps/web` — Next.js 16 (React 19, Tailwind 4, Supabase). Backoffice en `app/(panel)/*`,
  TPV en `app/tpv`, pantallas fast-food (`app/kiosko|kds|pantalla|cocina|ofertas`).
- `apps/desktop` (Electron) y `apps/mobile` (Expo) — esqueletos.
- `packages/{ui,api-client,hardware,sync,supabase}` — compartidos; varios son esqueletos.
- `docs/` — 16 documentos de producto/arquitectura/fiscalidad/roadmap.

## Base de datos

- Lo que se aplica son las migraciones de `supabase/migrations/*.sql` (Supabase, multi-tenant
  con RLS por `tenant_id` vía `current_tenant_id()`).
- `apps/api/db/schema.sql` es un DDL de **referencia** que debe mantenerse como espejo de las
  migraciones (ver `supabase/README.md`). Si tocas el esquema, actualiza ambos o decide cuál
  es canónico.

## Convenciones

- TypeScript estricto (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`).
- ESM: en `packages/core` los imports llevan extensión `.js` (p. ej. `from "./tax.js"`).
- Tests con Vitest, junto al fichero, sufijo `.test.ts`. Exemplar: `packages/core/src/domain/operations.test.ts`.
- Commits: conventional commits (`feat(...)`, `fix(...)`, `docs:`, `refactor(...)`).
- Idioma del proyecto: español (código, comentarios y docs).
- **Secretos**: nunca en el repo. `.env`/`.env.local` están en `.gitignore`; solo se versiona `.env.example`.

## Fiscalidad (crítico)

- Los precios de carta llevan impuesto INCLUIDO; `calcularImpuestosIncluidos` desglosa la
  base "hacia atrás". El % por producto se resuelve por clase fiscal × territorio
  (`@gluuh/core` `ivaAuto`, y la tabla SQL `tax_rate`/`resolver_iva()` — deben coincidir).
- El motor VERIFACTU (huella, QR, XML) reproduce el algoritmo de la AEAT; el test del
  **vector oficial** en `packages/core/src/fiscal/verifactu.test.ts` es innegociable.
```

**Verify**: el fichero existe y `grep -n "localhost:3100" CLAUDE.md` da resultado (coherente con el puerto real).

### Step 2: Confirmar en limpio que build/typecheck pasan

```
pnpm install
pnpm build
pnpm typecheck
pnpm test
```
**Esperado**: los cuatro exit 0. Si alguno falla en este commit limpio, **STOP** e informa
cuál y el error (el CI no debe nacer en rojo).

### Step 3: Crear el workflow de CI

Crea `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
```

**Verify**:
- `test -f .github/workflows/ci.yml` (existe).
- El YAML es válido: `grep -n "pnpm install --frozen-lockfile" .github/workflows/ci.yml` da resultado.
- (No se puede ejecutar GitHub Actions localmente; la verificación real ocurre al hacer push,
  que queda a decisión del operador.)

## Test plan

- No hay tests de código en este plan. Verificación = los cuatro comandos del Step 2 pasan en
  limpio, y el workflow existe y referencia esos mismos comandos.

## Done criteria

ALL deben cumplirse:

- [ ] `CLAUDE.md` existe en la raíz con la estructura y comandos correctos (puerto 3100).
- [ ] `.github/workflows/ci.yml` existe y ejecuta `install --frozen-lockfile`, `build`, `typecheck`, `test`.
- [ ] `pnpm build && pnpm typecheck && pnpm test` pasan en local en este commit.
- [ ] Solo `CLAUDE.md` y `.github/workflows/ci.yml` creados (`git status`).
- [ ] Fila de estado actualizada en `plans/README.md`.

## STOP conditions

Detente e informa si:

- `pnpm build`, `pnpm typecheck` o `pnpm test` fallan en el commit limpio (Step 2): el CI no
  debe crearse apuntando a comandos que ya fallan; reporta el error primero.
- El drift check reveló que los scripts raíz o las versiones de pnpm/node cambiaron respecto
  a lo documentado aquí — ajusta `ci.yml` a los valores reales y anótalo.

## Maintenance notes

- **Seguimiento deferido**: convertir los `lint` no-op de `@gluuh/core` y `@gluuh/api` en
  ESLint real y añadir `pnpm lint` al CI. Se deja fuera a propósito para no introducir
  configuración de lint a medias que haga fallar el pipeline sin aportar señal.
- Cuando `apps/api`/`apps/web` ganen tests, `pnpm test` los recogerá automáticamente (turbo)
  y el CI los correrá sin cambios en `ci.yml`.
- Para el revisor: confirmar que `pnpm-lock.yaml` está al día (CI usa `--frozen-lockfile`,
  que falla si el lockfile no concuerda con los manifiestos).
