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
