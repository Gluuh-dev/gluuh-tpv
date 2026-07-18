# 15 — Decisión: el TPV como app propia (Vite + React SPA)

> **Decidido el 18-07-2026 con el usuario.** El TPV deja de vivir dentro de la app
> Next del panel y pasa a ser **su propio proyecto**: una SPA estática (Vite +
> React) **servida por el nodo** del bar y cargada por el **cascarón Electron**.
> La nube (Cloudflare) solo sirve panel/admin — **la operativa nunca se publica
> online**. Guía ejecutable: [`docs/implementacion/22-tpv-spa-vite.md`](../implementacion/22-tpv-spa-vite.md).

## Qué se decide (y qué NO)

| Decisión | Sí/No |
|---|---|
| `apps/tpv` como proyecto propio (Vite + React, bundle estático) | ✅ |
| Servido por el **nodo** (LAN); Electron lo carga desde ahí → actualizar el nodo actualiza todos los terminales | ✅ |
| La nube deja de servir `/tpv` (y kds/kiosko/cocina/pantalla) | ✅ |
| Mismo React + TypeScript + paquetes compartidos (`@gluuh/core`, catálogo, impresión, UI) | ✅ (no se duplica lógica) |
| Cambiar Electron por Tauri | ❌ hoy (hardware ya en TS/preload; revisable) |
| Nodo en Go/Rust | ❌ (el motor fiscal es TS compartido; bifurcarlo = riesgo fiscal) |
| Reescritura en otro framework (Flutter/.NET/Svelte…) | ❌ (la fiabilidad viene del nodo offline-first + RPC atómicas + pruebas, no del framework) |

## Por qué Vite SPA y no Next para el TPV

- El TPV es **100 % cliente** (todo `"use client"`): no usa SSR, ni server
  components, ni rutas de servidor — Next ahí solo añade peso y arranque.
- Bundle estático = **arranque instantáneo** en el terminal, builds en segundos,
  y **imposible** desplegarlo a la nube por accidente.
- Fuerza la modularización que ya estaba planificada (F3 de la guía 21).

## La dependencia técnica clave

El TPV llama hoy a **`/api/ticket` y `/api/factura`** (rutas Next servidas por el
standalone del nodo). En la SPA esos endpoints pasan al **gateway del nodo**
(`apps/nodo/gateway.mjs`) usando `@gluuh/core` — mejor incluso: el cálculo fiscal
queda pegado a la BD del bar. Es el prerequisito nº 1 de la migración.

## Orden (sin big-bang)

1. Terminar F1–F3 de la guía 21 (fluidez + partir `page.tsx` en módulos/stores).
2. Mover `/api/ticket|factura` al gateway del nodo (Next las conserva como proxy
   mientras convivan).
3. Crear `apps/tpv` (Vite) moviendo los módulos ya limpios; `/tpv` en Next sigue
   vivo hasta que la SPA pase el humo completo (`PRUEBAS-TPV.md`).
4. La nube bloquea la operativa; el nodo sirve la SPA; Electron apunta al nodo.

## Riesgos vigilados

- **Doble mantenimiento durante la convivencia** → ventana corta, módulos
  compartidos, y el humo manual como puerta.
- Dependencias Next a sustituir: `next/navigation` (apenas hay rutas), tema
  (`next-themes` → hook propio), `next/font` (fuentes locales — el nodo va
  offline), `next/dynamic` (→ `import()` de Vite).
- El middleware/hosts de Cloudflare tiene un gotcha conocido (memoria de
  despliegue): el bloqueo de `/tpv` en nube se prueba en preview antes de main.
