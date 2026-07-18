# 22 — Migración del TPV a SPA propia (Vite + React)

> Ejecuta la decisión [`docs/plan/15-tpv-app-propia-vite.md`](../plan/15-tpv-app-propia-vite.md).
> Regla de oro: **sin big-bang** — `/tpv` en Next sigue funcionando hasta que la
> SPA pase el humo completo. Cada fase deja el repo verde (`pnpm typecheck`) y
> probado. Prerequisito: F1–F3 de la guía 21 (fluidez + modularización).

## Fase A — Fiscal al gateway del nodo (prerequisito)

1. `apps/nodo/gateway.mjs`: endpoints `POST /api/ticket` y `POST /api/factura`
   con la MISMA firma que las rutas Next (importan `@gluuh/core`; la factura usa
   la RPC atómica `emitir_factura_fiscal`/outbox como hoy).
2. Auth: mismo Bearer que el resto del gateway (el TPV ya manda token).
3. Las rutas Next quedan como **proxy** al gateway (una línea) mientras convivan.
4. Prueba: `prueba-facturas-a-la-vez.mjs` contra el gateway.

**Criterio**: cobrar en `/tpv` (Next) pasando por el gateway, huella/QR idénticos.

## Fase B — Desacoplar el TPV de Next (dentro de apps/web)

1. `next/navigation` → el TPV solo navega a `/tpv/config/*`: sustituir por estado
   interno o rutas propias de la SPA (wouter/react-router, o hash-routes).
2. `next-themes` → hook propio (`localStorage` + clase en `<html>`); mismo
   comportamiento claro/oscuro.
3. `next/font` → fuentes **locales** en `public/` (el nodo va offline: nada de CDN).
4. `next/dynamic` → `import()` estándar (Vite hace el split igual).
5. `next/image`/`<img>`: ya se usa `<img>` — nada que hacer.

**Criterio**: `app/tpv/**` no importa nada de `next/*` (grep en CI).

## Fase C — Crear `apps/tpv` (Vite)

1. `pnpm create vite` (react-ts) + Tailwind 4 con los MISMOS tokens (compartir
   preset en `packages/ui` o copiar `globals.css` de la operativa).
2. Mover `app/tpv/**` + `app/lib/{impresion,money,toast,settings,catalogo-store,…}`
   a `apps/tpv/src/` (o extraer lo compartido con el panel a `packages/`).
3. Cliente Supabase: `packages/supabase` (ya existe) apuntando al nodo/nube según
   entorno (mismas env que hoy).
4. `window.gluuh` (cajón/impresión nativa): mismo contrato — el preload de
   Electron no cambia.
5. Build → estáticos en `dist/`; el nodo los sirve (mismo sitio que hoy sirve la
   web, ruta `/tpv` o puerto propio).

**Criterio**: humo completo de `docs/estado/PRUEBAS-TPV.md` sobre la SPA servida
por el nodo, incluida impresión y cajón desde Electron.

## Fase D — Recorte y bloqueo

1. Electron apunta a la SPA del nodo (kiosco, autoarranque, reconexión).
2. La nube **bloquea** `/tpv|/kds|/kiosko|/cocina|/pantalla` (filtro por host,
   patrón del admin; probar en preview: gotcha conocido del middleware).
3. Borrar `app/tpv/**` de apps/web cuando la SPA lleve ≥1 semana en un bar real
   sin incidencias. El panel Next queda solo con backoffice.

**Criterio final**: nube sin operativa; terminal arranca a TPV utilizable en
< 3 s desde Electron; actualizar el nodo actualiza todos los terminales.

## Estructura destino del monorepo

```
apps/
  web/        Next 16 → SOLO panel/backoffice (nube + panel local del nodo)
  tpv/        ★ NUEVA: Vite + React SPA (la operativa; la sirve el nodo)
  desktop/    Electron: cascarón kiosco que carga la SPA del nodo
  nodo/       servicios del nodo (gateway ampliado con /api/ticket|factura)
  mobile/     Expo (comandera) — sin cambios
packages/
  core/       ★ fiscal compartido — NO SE TOCA
  supabase/   cliente + tipos (ya existe) — lo usan web, tpv y mobile
  ui/         tokens Tailwind + componentes comunes panel/tpv (extraer preset)
  operativa/  ★ NUEVA (o dentro de apps/tpv): lo hoy en app/lib que usa el TPV
```

### Inventario de módulos a mover (verificar consumidores con grep en Fase B)

| Hoy (`apps/web/app/…`) | Destino | Nota |
|---|---|---|
| `app/tpv/**` (page, components, hooks, efectivo) | `apps/tpv/src/` | el grueso |
| `lib/impresion.ts`, `lib/print-routing.ts` | `packages/operativa` | el panel de impresoras también la usa → compartido |
| `lib/catalogo-store.ts`, `lib/money.ts`, `lib/toast.ts`, `lib/settings.ts`, `lib/fiscal-clases.ts`, `lib/plano-assets.ts`, `lib/cambios.ts` | `packages/operativa` (los que comparta el panel) o `apps/tpv/src/lib` (los exclusivos) | decidir por consumidor real |
| `lib/supabaseBrowser.ts` | `packages/supabase` | unificar creación de cliente |
| `components/plano-svg.tsx`, `dialogo-confirmar.tsx` | `packages/ui` | usados por ambos |
| `public/plano/*`, `logo-*`, fuentes | `apps/tpv/public` (copias propias; el nodo va offline) | |

### `apps/tpv` — dependencias (todas ya en el workspace, sin novedades)

`react`, `react-dom`, `@supabase/supabase-js` (vía `packages/supabase`), `zustand`,
`lucide-react`, `tailwindcss@4`, `@gluuh/core`, `sonner`/toast propio.
**Nuevas (solo build)**: `vite`, `@vitejs/plugin-react`. Router: ninguno o `wouter`
(las "rutas" del TPV son 6 vistas + config).

### Turbo/CI

- `turbo.json`: `apps/tpv#build` → `dist/` cacheable; `dev` en paralelo con web.
- CI: grep-guard "no `next/` en apps/tpv" + typecheck + build.
- El instalador del nodo empaqueta `apps/tpv/dist` junto al standalone del panel.

## Estado

| Fase | Estado |
|---|---|
| Prerequisito (F1–F3 guía 21) | F1 ✅ · F2 🟡 · F3 🟡 (store hecho; módulos puros extraídos: precio/nombres/reparto/pagos/ticket-impresion) |
| A (fiscal→gateway) | ⬜ bloqueada (coordinar escritorio: packaging @gluuh/core) |
| B (soltar de Next) | 🟡 en curso — tema propio (`tema.ts`) ya hecho en la SPA; queda navegación/dynamic en el `page.tsx` que se mueva |
| **C (crear `apps/tpv`)** | 🟢 **ARRANCADA (18-07)**: scaffold Vite+React+Tailwind4 con tokens Gluuh + tema claro/oscuro propio. **Compila** (`vite build`, 1743 módulos) y typecheck verde. Falta mover la operativa (page.tsx + componentes + libs) por fases. |
| D (recorte/bloqueo) | ⬜ |

**Estructura viva de `apps/tpv`**: `index.html` · `vite.config.ts` (base relativa, offline) ·
`src/main.tsx` · `src/App.tsx` (starter operativa: rejilla + ticket, para diseñar) ·
`src/index.css` (copia fiel del sistema de diseño de `apps/web/app/globals.css`) ·
`src/lib/tema.ts` (claro/oscuro sin next-themes). Dev: `pnpm --filter @gluuh/tpv dev` (:3120).

> El nodo como servicio Windows "de verdad" (arranque, recuperación, logs,
> apagado limpio) tiene guía propia: [`23-nodo-servicio-windows.md`](23-nodo-servicio-windows.md).
