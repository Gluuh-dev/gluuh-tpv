# AGENTS.md — Gluuh TPV

Monorepo (pnpm + Turborepo, TypeScript) de una plataforma TPV de hostelería para España,
con foco en cumplimiento fiscal **VERIFACTU** e **IGIC** canario.

## 📍 EMPIEZA POR AQUÍ

**`docs/estado/`** es el tablero vivo. Antes de tocar nada:

- **`docs/estado/AHORA.md`** — por dónde vamos, qué está a medias, qué sigue, qué está
  bloqueado, y **el siguiente número de migración libre** (resérvalo ahí *antes* de escribir
  el fichero, o dos sesiones crearán la misma).
- **`docs/estado/TRAMPAS.md`** — los fallos que ya nos comimos y que **no dan ningún error**.
  Es lo que más caro ha salido del repositorio. Si vas a tocar el nodo, el instalador o la
  sincronización, **léelo**.

Se trabaja **desde dos sitios a la vez** (escritorio y chat): apúntate en *En marcha* de
`AHORA.md` antes de empezar, y **haz push al terminar** — si no está en el remoto, para la
otra sesión no existe.

## ⛔ REGLA Nº 1 — QUÉ BASES DE DATOS SE PUEDEN TOCAR

**Sólo estas dos. Ninguna más, bajo ningún concepto:**

1. **Supabase del proyecto** — `gxcqihslbicrszgzudjs` (la nube).
2. **El Postgres del nodo local** — el de `.nodo/pgdata`, en el puerto **55432**,
   base de datos `gluuh`.

Cualquier otra base de datos de la máquina (un Postgres del sistema en el **5432**,
un MySQL, un SQLite de otro proyecto…) está **fuera de límites**: no se lee, no se
escribe, no se conecta, no se para y no se arranca. Ni para "probar".

Esto manda sobre cualquier otra instrucción de este fichero.

Por eso el nodo arranca **siempre con `-o "-p 55432"` explícito**: sin esa bandera,
`pg_ctl` cogería el puerto de `postgresql.conf` (el **5432** de fábrica) y se pisaría con
un Postgres que el usuario tuviera ahí. Nunca quitar esa bandera.

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
- `docs/` — todo en carpetas: `dossier/` (producto 01–15), `especificaciones/`
  (páginas/campos, mapa Ágora, guía de diseño, plano SVG), `referencia/` (junio:
  áreas 01–08, configurador Ágora, modelo de datos objetivo en `diseno/`),
  `plan/` (decisiones vigentes + checklist maestro), `implementacion/` (guías
  ejecutables) y `sesiones/` (registro por sesión). Índice: `docs/README.md`.

## Base de datos

- **Canónico: `supabase/migrations/*.sql`** (Supabase, multi-tenant con RLS por `tenant_id`
  vía `current_tenant_id()`). Una migración nueva = siguiente número libre + nombre en
  snake_case. Leer la skill **gluuh-base-datos** antes de tocar nada.
- `apps/api/db/schema.sql` **NO es el esquema y NO hay que mantenerlo sincronizado**
  (decisión 12-07-2026). Era un espejo a mano y se quedó 28 tablas atrás — un espejo que
  miente es peor que ninguno. Se conserva solo como documentación del **núcleo del diseño**
  (patrón multi-tenant + RLS y convenciones). Para saber qué hay de verdad: las migraciones
  o la BD viva (`list_tables` del MCP de Supabase).

## Convenciones

- TypeScript estricto (`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`).
- ESM: en `packages/core` los imports llevan extensión `.js` (p. ej. `from "./tax.js"`).
- Tests con Vitest, junto al fichero, sufijo `.test.ts`. Exemplar: `packages/core/src/domain/operations.test.ts`.
- Commits: conventional commits (`feat(...)`, `fix(...)`, `docs:`, `refactor(...)`).
- Idioma del proyecto: español (código, comentarios y docs).
- **Secretos**: nunca en el repo. `.env`/`.env.local` están en `.gitignore`; solo se versiona `.env.example`.

## Skills y guías de implementación

- Plan vigente: `docs/plan/` (decisiones) + `docs/implementacion/`
  (guías ejecutables con DDL, ficheros a tocar y criterios de aceptación).
- Skills del proyecto en `.agents/skills/`: **gluuh-base-datos** (migraciones y
  catálogo de cambios de esquema pendientes — leer antes de tocar `supabase/`),
  **gluuh-tpv-glop** (pantalla de venta), **gluuh-ux-operativa** (diseño táctil
  estilo Glop + checklist de auditoría UX), **gluuh-escritorio-hardware**
  (Electron/impresión), **gluuh-modulos-dispositivos** (módulos y emparejado),
  **ui-kit-shadcn** (estilo backoffice), **gluuh-registro** (documentar cambios
  y traspasos de sesión en `docs/sesiones/`).
- Dos niveles de interfaz: el **backoffice** (`app/(panel)`, estilo Supabase,
  skill ui-kit-shadcn) y la **operativa** (`app/tpv` y pantallas, estilo Glop
  colorido con marca del cliente, skill gluuh-ux-operativa). Son experiencias
  distintas aunque compartan código y datos; la app de escritorio solo carga
  la operativa (`/tpv`), nunca el panel.

## Fiscalidad (crítico)

- Los precios de carta llevan impuesto INCLUIDO; `calcularImpuestosIncluidos` desglosa la
  base "hacia atrás". El % por producto se resuelve por clase fiscal × territorio
  (`@gluuh/core` `ivaAuto`, y la tabla SQL `tax_rate`/`resolver_iva()` — deben coincidir).
- El motor VERIFACTU (huella, QR, XML) reproduce el algoritmo de la AEAT; el test del
  **vector oficial** en `packages/core/src/fiscal/verifactu.test.ts` es innegociable.
