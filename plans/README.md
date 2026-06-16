# Planes de implementación

Generados por la skill `improve` el 2026-06-15, contra el commit `09857da`.
Cada ejecutor: lee el plan completo antes de empezar, respeta sus "STOP conditions" y
actualiza tu fila al terminar.

## Orden de ejecución y estado

| Plan | Título | Prioridad | Esfuerzo | Depende de | Estado |
|------|--------|-----------|----------|------------|--------|
| 001 | Tests de impuestos y máquina de estados | P1 | S | — | DONE (revisado; pendiente de merge — ver nota) |
| 002 | Unificar tipos fiscales (clase × territorio) en core | P1 | M | 001 | DONE (revisado; en rama de consolidación) |
| 003 | Quick wins: puerto del README + encoding del QR | P3 | S | — | DONE (puerto sí; QR no aplicado — ver nota) |
| 004 | CLAUDE.md + CI (build/typecheck/test) | P2 | M | — | DONE (revisado; en rama de consolidación) |
| 005 | Sistema de diseño: token de acento intercambiable + primitivos + DESIGN.md | P1 | M | — | DONE (revisado; en rama de consolidación) |
| 006 | Rediseño pantallas operativas + públicas (estilo Supabase) | P1 | L | 005 | DONE (revisado; en rama de consolidación) |
| 007 | Pulido backoffice contra el sistema | P2 | M | 005 | DONE (revisado; en rama de consolidación) |
| 008 | TPV estilo Ágora (layout + teclado DTO/CAN/PREC + barra de acciones) | P1 | L | 005 | DONE (mergeado en main `8b109f2`) |
| 009 | Navegación del panel con submenús expandibles | P1 | M | 005 | DONE (mergeado en main `79d60a2`) |

Valores de estado: TODO | IN PROGRESS | DONE | BLOCKED (con motivo) | REJECTED (con motivo).

## Notas de dependencia

- **002 requiere 001**: los tests de `calcularImpuestosIncluidos` (Plan 001) son la red de
  seguridad que demuestra que la unificación de tipos (Plan 002) es behavior-preserving. Sin
  ellos, una regresión de céntimos pasaría inadvertida.
- 003 y 004 son independientes y pueden ejecutarse en cualquier momento (no tocan el motor de
  impuestos salvo, en 003, una posible mejora acotada del QR que NO debe romper el vector AEAT).
- Recomendación de orden global: 001 → 002, y 003/004 en paralelo cuando convenga.

## Notas de ejecución

- **001 (DONE, 2026-06-15)**: ejecutado en worktree aislado; commit `f5d8a36`, rama
  `advisor/001-tests-impuestos-y-estados`. Añade `packages/core/src/fiscal/tax.test.ts`
  (9 tests) y `packages/core/src/domain/order-state.test.ts` (9 tests). Revisado y aprobado:
  32 tests pasan, typecheck OK, fuentes sin modificar, tests con aserciones reales.
  **Anomalía**: el worktree se creó sobre un ancestro antiguo (`46412d2`) en vez de `09857da`,
  pero `tax.ts`/`order-state.ts` son idénticos entre ambos, así que los tests son válidos. La
  verificación corrió bajo vitest 2.1.9 (lockfile de la base antigua), no 4.1.9 — matchers
  estándar, sin impacto. **Pendiente de merge** (decisión del usuario): aplicar los 2 ficheros
  sobre `09857da` o mergear la rama (conjuntos disjuntos → merge limpio, no revierte nada).

- **002/003/004 (DONE, 2026-06-15)**: ejecutados en worktrees aislados y revisados. Causa
  raíz de la anomalía del 001: el harness crea los worktrees desde `origin/main` (`46412d2`),
  16 commits por detrás del `main` local (`09857da`); se corrigió en cada ejecutor con
  `git reset --hard 09857da` (Step 0).
  - **002** (`refactor(core)`): `tax-rates.ts` + `tax-rates.test.ts` nuevos, `index.ts` exporta,
    huérfano `tipoHosteleria`/`TIPOS_IVA`/`TIPOS_IGIC` eliminado de `tax.ts`, `fiscal-clases.ts`
    convertido en reexport. Behavior-preserving (valores de runtime idénticos).
  - **003** (`docs`): puerto del README 3000→3100. QR **no modificado**: `docs/07 §3.4` no
    especifica reglas de percent-encoding y el código actual reproduce el vector oficial AEAT
    → decisión conservadora correcta (cambiarlo es decisión de cumplimiento del responsable).
  - **004** (`docs`+`ci`): `CLAUDE.md` + `.github/workflows/ci.yml`. El aviso del ejecutor sobre
    `radix-ui` rompiendo el build fue un FALSO POSITIVO (artefacto de symlinks del worktree):
    `pnpm --filter @gluuh/web build` pasa limpio en el repo real. Igual el fallo de vitest en
    worktrees (Windows + symlinks profundos) — no reproduce en el repo principal ni en CI Linux.
- **005 (DONE, 2026-06-15)** `feat(ui)`: en globals.css se añade el token de acento
  `--brand`/`--brand-foreground` (hoy NEUTRO = primary; **punto único de cambio para el color
  del logo** en `:root` y `.dark`), registrado en `@theme inline` como `--color-brand`; botón
  `default` → `bg-brand`; primitivos `page-header`/`stat-card`/`empty-state`; `apps/web/DESIGN.md`
  con las convenciones para 006/007. Escala índigo legada intacta. Sin cambio visual hoy.
- **006 (DONE)** `style(web)` (commit eee7af3): 10 pantallas no-panel migradas a tokens del tema y
  rediseñadas (cocina/pantalla/cocina forzadas en oscuro vía `.dark`, no slate literal; tpv/comandera
  con primitivos; públicas alineadas). Excepción tolerada: 2 `text-white` en cocina sobre fondos hex
  de dominio (`COLOR` de estados). Colores de marca del tenant conservados en `style={}` (datos, no paleta).
- **007 (DONE)** `style(panel)` (commit 9a5c234): 7 pantallas del backoffice homogeneizadas con
  `PageHeader`/`StatCard`/`EmptyState`; 0 literales de paleta gris en `(panel)/`. Solo presentación.
- **Consolidación verificada**: rama `advisor/all-001-004` (worktree `.claude/worktrees/consolidation-001-004`,
  HEAD `590b4a3`) reúne **001–007** (cherry-picks sin conflictos, ficheros disjuntos). Estado combinado
  verde, verificado en worktree limpio de path superficial: **core 38 tests + build OK**, **web typecheck
  OK**, **web build OK** (18 rutas). Revisión: typecheck/build pasan y los diffs de 006/007 son solo
  markup/clases (handlers y queries intactos). **Pendiente de merge a `main`.**
- **Hallazgo preexistente surgido al verificar (no de estos planes)**: `pnpm --filter @gluuh/web build`
  falla si no existe `apps/web/.env.local` con `NEXT_PUBLIC_SUPABASE_URL` — las pantallas cliente
  inicializan el cliente Supabase en build-time (`Error: supabaseUrl is required` al prerenderizar).
  Esto significa que el **CI del plan 004 fallará el build** en runners sin esas env vars. Es el
  mismo problema que CORRECTNESS-13 (env con `!` sin validación). Seguimiento recomendado: validar
  env o inyectar las `NEXT_PUBLIC_*` en el CI (GitHub Secrets).

## Hallazgos considerados y rechazados (para no re-auditar)

- **"Secretos commiteados en .env" (sub-auditoría de seguridad): FALSO.** `apps/api/.env` y
  `apps/web/.env.local` existen en disco con valores reales pero **no están en git** (`git ls-files`/
  `git log` solo muestran `.env.example`); están correctamente en `.gitignore`. Es el
  comportamiento esperado de `.env`. (No se reproduce ningún valor.)
- **"IDOR en bucket storage `media`": sobredimensionado.** La lectura pública es por diseño
  (logos/ofertas en pantallas de kiosko); escritura/borrado están acotados por carpeta
  `<tenant_id>/` (patrón estándar de Supabase). Único matiz menor opcional: `media_update`
  (`supabase/migrations/0010_personalizacion.sql:66-68`) tiene `USING` sin `WITH CHECK`.
- **"Memory leak / stale closure en Realtime de cocina/pantalla": rechazado.** El cleanup
  (`sb.removeChannel(ch)`) y las deps `[]` son correctos e intencionales
  (`apps/web/app/cocina/page.tsx:37-51`).
- **"Endpoint `/api/ticket` sin auth": atenuado, no se planifica ahora.** Es un endpoint DEMO
  documentado (NIF/fecha/serie fijos, no persiste nada). La ruta admin `crear-empresa` sí
  valida `es_admin_plataforma` antes de usar la service key. La validación de entrada (zod) en
  los límites de API es deuda real para producción, ligada al write-path de sync (dirección).
- **"TS 6 / Vitest 4 obsoletos": especulativo.** Versiones recientes y compilando; sin
  evidencia de problema. Investigar si surge, no planificar.
- **N+1 / refetch total tras cada mutación (PERF-01/02):** patrón real, pero a escala de TPV
  (decenas de ítems) el coste es despreciable hoy; optimizar sería prematuro. Revisar cuando
  se integre PowerSync.

## Hallazgos de dirección (no planificados — decisión del responsable)

No son bugs, sino bloqueantes de MVP/roadmap ya marcados como esqueleto. Si se priorizan,
conviene un plan de diseño/spike, no de "construir todo":

- **Write-path de sync (`/sync/upload`) es un stub** que no persiste (`apps/api/src/sync/sync.controller.ts:28-32`).
  Bloqueante #1 del modo offline-first.
- **TicketBAI (País Vasco)** prometido sin código (existe `FORAL_PV` en UI/tipos, cero lógica Batuz).
- **Impresión ESC/POS y pagos (Stripe/Redsys/Bizum)** son esqueletos (`packages/hardware`, sin SDK de pago).

## Qué no se auditó a fondo

`apps/desktop` y `apps/mobile` (esqueletos), `packages/{sync,hardware,api-client,ui}`
(esqueletos, solo inventariados), el contenido completo de `docs/`, y no se ejecutó la suite
de tests ni el build durante la auditoría.
