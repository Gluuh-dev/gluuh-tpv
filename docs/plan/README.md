# Auditoría 02-07-2026 — App de escritorio, módulos y TPV estilo Glop

**Fecha:** 2 de julio de 2026
**Alcance:** respuesta a tres preguntas concretas:

1. ¿Cómo hacemos una **app para PC** que dé acceso al TPV web con todas las opciones actuales?
2. ¿Cómo hacemos que **todo sea configurable desde el propio TPV**, con módulos activables (pantallas, conexiones API, venta desde pantalla…)?
3. ¿Cómo nos ponemos al nivel de **Glop TPV** en la pantalla de venta… y lo superamos?

> Esta auditoría **actualiza y complementa** la de junio (`docs/referencia/`, 19-06-2026).
> Aquella cubre el "qué construir" completo (referencia Ágora, modelo de datos objetivo,
> plan F0–F8). Esta se centra en el estado real del código a 02-07-2026 y en las tres
> preguntas de arriba. No se duplica contenido: donde aplica, se enlaza.

## Veredicto en 5 líneas

- **La web ya ES el producto**: `apps/web` tiene TPV completo, comandera, kiosko, KDS, pantalla cliente, cartelería, backoffice con ~25 páginas reales e informes. El README del repo dice "esqueleto" y miente: hay ~9.500 líneas funcionales.
- **La app de PC no se reescribe: se envuelve.** Electron cargando la web + puente de hardware (impresora ESC/POS, cajón, visor). El esqueleto ya existe en `apps/desktop`; faltan ~5 piezas concretas (doc 02).
- **Los dos huecos que nos impiden vender**: VERIFACTU está desactivado (`VERIFACTU_ACTIVO = false`) y **no hay offline** (Glop funciona 100% sin internet; nosotros hoy, no).
- **El sistema de módulos no existe todavía**, pero su base sí: tabla `setting` con ámbitos GLOBAL/LOCAL/DEVICE (sin cablear) y tabla `device`. Con una tabla más y un registro estático de módulos, sale (doc 03).
- **Contra Glop ganamos en** cloud, multi-local, fiscalidad nativa, tiempo real y diseño; **perdemos en** offline, hardware, aparcar/pasar a mesa, tarifas y cliente en ticket. Todo lo segundo es alcanzable en semanas (docs 04 y 05).

## Índice

| Doc | Contenido |
|---|---|
| [01-estado-actual.md](01-estado-actual.md) | Qué hay hecho de verdad, qué es esqueleto, riesgos técnicos detectados |
| [02-app-escritorio-windows.md](02-app-escritorio-windows.md) | La app de PC: arquitectura Electron, hardware, offline, empaquetado, cómo funcionaría |
| [03-sistema-de-modulos.md](03-sistema-de-modulos.md) | Módulos activables desde el TPV: modelo de datos, emparejado de pantallas, venta desde pantalla, API |
| [04-tpv-estilo-glop.md](04-tpv-estilo-glop.md) | Análisis de Glop, mapeo función a función contra lo nuestro, y cómo superarlo |
| [05-plan-de-accion.md](05-plan-de-accion.md) | Prioridades P0/P1/P2, quick wins y orden de ejecución recomendado |
| [06-decision-local-vs-cloud.md](06-decision-local-vs-cloud.md) | Por qué nube + offline-first (y no PC-servidor ni modo dual); qué cobrar como extra mensual |
| [07-catalogo-modulos-y-roadmap.md](07-catalogo-modulos-y-roadmap.md) | Módulos e integraciones de todo el mercado (ES + internacional) cruzados con Gluuh, y roadmap priorizado P0/P1/P2 |
| [08-checklist-maestro-100.md](08-checklist-maestro-100.md) | ★ Lista maestra de TODO (módulos, funciones, mejoras) con estado ✅/🟡/❌ — la "definición de completo al 100%" |
| [09-orden-de-implementacion.md](09-orden-de-implementacion.md) | ★★ PLAN OPERATIVO (07-07): bloques A-F en orden — remates de identidad, publicar en Cloudflare, impresión multi-barra, acabados, NODO LOCAL y VERIFACTU al final. Abrir por la mañana y trabajar de arriba abajo |

## Documentos relacionados

- `docs/referencia/` — auditoría exhaustiva de junio (referencia Ágora, modelo de datos objetivo ~1.400 líneas, plan F0–F8).
- `docs/dossier/05-stack-tecnologico.md` — decisión de stack (Electron ya elegido sobre Tauri).
- `docs/especificaciones/mapa-agora-completo.md` — checklist funcional contra Ágora.
- `docs/especificaciones/guia-de-diseno.md` — sistema de diseño (backoffice estilo Supabase).
