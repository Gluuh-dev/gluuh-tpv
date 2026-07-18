# 24 — PLAN MAESTRO: TPV app propia + nodo como electrodoméstico

> **El punto de entrada para el desarrollo.** Consolida en un solo orden ejecutable
> todo lo decidido: TPV perfecto (guía 21), TPV como SPA propia (plan 15 + guía 22)
> y nodo como servicio Windows (guía 23). Cada etapa dice QUÉ, DÓNDE, QUIÉN, y su
> puerta de salida. Las guías citadas llevan el detalle — aquí no se duplica.
>
> Reglas de siempre: typecheck verde tras cada tanda · humo `PRUEBAS-TPV.md` ·
> push al terminar (dos sesiones) · migraciones = reservar número en `AHORA.md`.

## Estado de partida (18-07-2026, sesión chat)

**Hecho y verificado**: dividir cuenta v2 completa (partes persistidas 0123,
`separar_cuenta` 0124, cobro parcial, anti-doble-cobro, bloqueo de líneas con
partes cobradas) · vistas Aparcados/Llevar/Reservas fieles a mockups (0125) ·
navbar unificado · CobrarModal mockup como tarjeta · cobro in situ desde
Aparcados · F1 latencia completa · F2 núcleo (apertura optimista + estados
optimistas) · config dentro del TPV (hub + empleados/artículos/menús/terminales/
ajustes) · artículo rápido v2 · extras ± · docs 15/21/22/23.

**⚠ Pendiente inmediato**: COMMIT + PUSH de todo (la sesión de escritorio espera
un `page.tsx` consistente; su HEAD `1736e1e` no compila).

---

## ETAPA 0 — Estabilizar y publicar (½ día) — SIN ESTO NO HAY NADA

| # | Tarea | Dónde | Puerta |
|---|---|---|---|
| 0.1 | Commit + push de todo el trabajo TPV (migraciones 0123–0125, tpv/**, docs) en `nodo-local` | repo | `pnpm typecheck` verde en HEAD; la sesión escritorio compila |
| 0.2 | Humo manual completo (`docs/estado/PRUEBAS-TPV.md` + dividir/cobrar/config) | TPV dev | checklist pasado |
| 0.3 | Actualizar `AHORA.md` (quitarse de En marcha lo entregado) | docs | — |

## ETAPA 1 — Cerrar F2/F3 del TPV (1–2 días) · guía 21

| # | Tarea | Dónde | Puerta |
|---|---|---|---|
| 1.1 | F2 resto: optimista en alias/aparcar, sentar desde plano; velo `busy` nunca a pantalla completa | `page.tsx`, vistas | acciones pintan <100 ms con red lenta |
| 1.2 | F3: **terminar migración a `useTpvStore`** (comanda/precios/notas/invitadas con selectores) — ⚠ coordinar con escritorio (la empezó) | `hooks/useTpvStore.ts`, `page.tsx` | teclear no repinta plano ni rails (Profiler) |
| 1.3 | F3: partir `page.tsx` en módulos (venta / cobro / división / handlers llevar-reservas) — mismo mount, ficheros separados | `app/tpv/` | `page.tsx` < 1.000 líneas; typecheck verde |
| 1.4 | F7: marcas `performance.now` en abrir-modal/cobrar/cambio de vista con presupuesto (100/350/50 ms) | `page.tsx` | consola avisa si se supera |

**Por qué antes de migrar**: los módulos limpios son LO QUE SE MUEVE a la SPA.

## ETAPA 2 — Fiscal al gateway del nodo (1 día) · guía 22 Fase A

| # | Tarea | Dónde | Puerta |
|---|---|---|---|
| 2.1 | `POST /api/ticket` y `POST /api/factura` en el gateway (misma firma; `@gluuh/core`; factura → RPC atómica/outbox) | `apps/nodo/gateway.mjs` | `prueba-facturas-a-la-vez.mjs` contra gateway |
| 2.2 | Rutas Next → proxy al gateway (convivencia) | `apps/web/app/api/...` | cobrar desde `/tpv` con huella/QR idénticos |
| 2.3 | Prueba adversarial: gateway caído → el TPV NO cobra (mensaje claro, nada a medias) | pruebas | sin venta COBRADA sin ticket |

## ETAPA 3 — Desacoplar el TPV de Next (1 día) · guía 22 Fase B

| # | Tarea | Puerta |
|---|---|---|
| 3.1 | `next/navigation` → navegación propia (6 vistas + config) | — |
| 3.2 | `next-themes` → hook propio (localStorage + clase en html) | tema claro/oscuro igual |
| 3.3 | `next/font` → fuentes locales en public/ | sin CDN (nodo offline) |
| 3.4 | `next/dynamic` → `import()` | modales cargan igual |
| 3.5 | Guardia CI: cero `next/` bajo `app/tpv/**` | grep en CI |

## ETAPA 4 — `apps/tpv` (Vite SPA) (2–3 días) · guía 22 Fase C + estructura

| # | Tarea | Puerta |
|---|---|---|
| 4.1 | Scaffold Vite react-ts + Tailwind 4 con los tokens (preset en `packages/ui`) | pantalla en blanco con tema OK |
| 4.2 | Extraer compartidos según inventario de la guía 22 (`packages/operativa`, `packages/ui`, cliente en `packages/supabase`) | panel sigue compilando |
| 4.3 | Mover módulos del TPV a `apps/tpv/src` | SPA = paridad visual y funcional |
| 4.4 | Assets propios (plano, logos, fuentes) en `apps/tpv/public` | offline total |
| 4.5 | Turbo: build cacheable; `dist/` empaquetado por el instalador del nodo | build < 30 s |
| 4.6 | **Humo completo sobre la SPA servida por el nodo** (incl. impresión/cajón vía Electron) | `PRUEBAS-TPV.md` entero |

## ETAPA 5 — Nodo electrodoméstico (2–3 días, CON sesión escritorio) · guía 23

| # | Tarea | Puerta |
|---|---|---|
| 5.1 | Supervisor único (`apps/nodo/supervisor.mjs`): orden + health-checks + backoff + `/salud` | mata cualquier hijo → revive < 10 s |
| 5.2 | Servicio SCM `GluuhNodo` (`sc create` + `sc failure`); apagado limpio (`pg_ctl stop -m fast`) | reinicio de Windows → todo arriba; stop → sin recovery sucio |
| 5.3 | Puertos FIJOS (SPA 3100, gateway) — nunca "elegir otro" | Electron apunta a URL fija |
| 5.4 | Rotación de secretos reinicia consumidores | cero procesos con secreto viejo |
| 5.5 | Logs rotados + Registro de eventos | `C:\Gluuh\logs` acotado |
| 5.6 | Update con swap + parches SQL + rollback automático | `prueba-supervisor.ps1`, `prueba-apagado.ps1` verdes |
| 5.7 | Electron kiosco: fullscreen, autoarranque, reconexión, carga SPA del nodo | terminal enciende → TPV en < 3 s |

## ETAPA 6 — Recorte y nube (½ día) · guía 22 Fase D

| # | Tarea | Puerta |
|---|---|---|
| 6.1 | Nube bloquea `/tpv|kds|kiosko|cocina|pantalla` (patrón host del admin; ⚠ gotcha del middleware: probar en preview) | operativa inaccesible online |
| 6.2 | Tras ≥1 semana de SPA en bar real sin incidencias: borrar `app/tpv/**` de apps/web | panel Next limpio |

## ETAPA 7 — Completar la venta (paralelo a 2–6, por valor) · guía 21 F5/F6

| # | Tarea | Nota |
|---|---|---|
| 7.1 | **Combinar copas** | ⚠ REQUIERE DECISIÓN de datos: qué marca "combinable" y de qué categoría salen los "con qué" (propuesta: flag en familia + categoría refrescos configurable en setting) |
| 7.2 | Utilidades restantes por valor (guía 21 F5): buscar documento/último ticket ampliado, apunte/resumen de caja, cobros pendientes, re. cocina, tarifa, presencia, agenda… | ninguno muerto: o funciona o dice qué módulo falta |
| 7.3 | Config fino: subida de fotos en artículos, horarios de menú, alta de terminales cuando se arregle el hook de claims (AHORA.md) | |
| 7.4 | Llevar: hora/dirección/canal en el alta rápida (extender `llevar` state + crearOrden) | |
| 7.5 | Divisiones: "Juntar con otra" (fusión de aparcadas) | diseño pequeño previo |

## ETAPA 8 — Producto vendible (continuo)

- Latido nodo→nube + serie A/B de facturación (AHORA «Lo siguiente» — no duplicar aquí).
- Prueba en MÁQUINA LIMPIA con el `.exe` + cobrar una mesa (bloqueada esperando al usuario).
- Firma del `.exe` (SmartScreen) — usuario.
- Presupuesto de rendimiento en CI/humo; sesión de estrés (6 cobros a la vez ya existe).

---

## Dependencias y quién

```
E0 ──► E1 ──► E3 ──► E4 ──► E6
        │              ▲
E2 ─────┴──────────────┘      (E2 independiente de E1; antes de E4)
E5 (escritorio+chat) ─────────► E4.6/E5.7 se cruzan en el humo final
E7 en paralelo desde E0 (features sobre el TPV actual; se mueven con él en E4)
```

- **Sesión chat**: E0–E4, E6, E7.
- **Sesión escritorio**: E5 (instalador/nodo ya en su máquina), revisa E2.
- **Usuario**: decisión 7.1 (combinado), prueba máquina limpia, firma exe, canary 0122.

## Decisiones del usuario — RESUELTAS (18-07-2026)

1. **Combinar copas (7.1)**: flag `combinable` a nivel **familia** (default), **desactivable/
   activable por producto** (`product.combinable` NULL = hereda). Categoría de "con qué" en
   setting `tpv.combinados.categoria_id`. Migración **0126** (reservada). ← en marcha.
2. **KDS/cocina/pantalla/kiosko**: **Fase 2 a la SPA** del nodo, mismo criterio que el TPV
   (la operativa fuera de Next). Se aborda tras la SPA del TPV (post-E4).
3. **Servicio del nodo**: **`GluuhNodo`**, gateway **54321** (fijo), SPA en **3100**
   (confirma la propuesta de la guía 23). Definitivo.
4. **E2 (fiscal al gateway)** y **aplicar 0125 al nodo**: se **coordinan con la sesión de
   escritorio** (packaging `@gluuh/core` + reinicio del nodo vivo; y la migración del nodo por
   su ledger). No se tocan en solitario.
