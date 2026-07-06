# Implementación — guías ejecutables

**Fecha:** 02-07-2026. Carpeta hermana de `docs/plan/` (el *qué* y el
*porqué*): aquí está el **cómo** — cada documento es una guía de implementación con
ficheros a tocar, migraciones SQL, contratos de código y criterios de aceptación,
pensada para ejecutarla tal cual (por una persona o por un agente).

> Existe también `docs/referencia/diseno/` (junio), con el modelo de datos
> objetivo y el plan F0–F8 generales. Estas guías son más concretas y mandan cuando
> haya conflicto: reflejan las decisiones de julio (Electron, módulos, offline-first).

## Orden de ejecución recomendado

| # | Guía | Prioridad | Esfuerzo |
|---|---|---|---|
| [01-activar-verifactu.md](01-activar-verifactu.md) | Cobro → factura real encadenada | P0 | 3-5 d |
| [02-refactor-tpv.md](02-refactor-tpv.md) | Trocear el monolito antes de ampliarlo | P0 | 3-4 d |
| [03-app-escritorio-electron.md](03-app-escritorio-electron.md) | App PC: impresión, cajón, kiosk, updater, backup USB | P0 | 2-3 sem |
| [04-modulos-y-emparejado.md](04-modulos-y-emparejado.md) | Módulos activables + pantallas por código | P0 | 1-1,5 sem |
| [05-paridad-glop.md](05-paridad-glop.md) | Aparcar, pasar a mesa, cliente, barra de estado, F10-F12… | P1 | 1,5-2 sem |
| [06-offline-powersync.md](06-offline-powersync.md) | Trabajar sin internet y volcar al volver | P1 | 2-3 sem |
| [07-creacion-rapida-desde-tpv.md](07-creacion-rapida-desde-tpv.md) | Crear/editar productos desde cualquier pantalla del TPV en segundos | P1 | 4-6 d |
| [08-analisis-glop.md](08-analisis-glop.md) | Glop a fondo: anatomía botón a botón, manuales y decisiones de imitación | — | consulta |
| [09-referencias-ux-competencia.md](09-referencias-ux-competencia.md) | Lecciones UX de Ágora, Revo, Square, Toast, SumUp, Lightspeed |
| [10-pantalla-cocina-kds-y-tickets.md](10-pantalla-cocina-kds-y-tickets.md) | Spec del KDS: 4 vistas, estados, config, filtrado por grupo, y los 4 tipos de ticket (cliente/pedido/camarero/cocinero) | — | consulta |
| [11-configuracion-backoffice.md](11-configuracion-backoffice.md) | Configuración del panel: zona técnica con clave, dónde persiste cada ajuste, migraciones 0045-0056 y cableado pendiente | hecho (04-07) | consulta |
| [12-conectar-tpv-modales-y-carta.md](12-conectar-tpv-modales-y-carta.md) | Cablear el TPV: variaciones, modificadores, anotaciones, dividir, cobrar; props de los 3 modales nuevos y tablas implicadas | pendiente cablear | ejecutable |
| [13-rediseno-config-y-estilos.md](13-rediseno-config-y-estilos.md) | ★ Backlog por sesiones: footer fijo + buscador global, Empresa y Local, Seguridad, Marca, orden de botones TPV, arreglar navegación | pendiente | por sesiones |
| [14-identidad-acceso-y-seguridad.md](14-identidad-acceso-y-seguridad.md) | ★ Análisis + plan: activación por licencia, operarios con código+clave y perfiles, superficies por puerta, zona técnica→Seguridad, cerrar día, audit_log | análisis | por sesiones |

Las guías 01–04 son independientes entre sí salvo lo indicado en cada una (03 y 04
comparten la identidad de dispositivo). La 05 y la 07 requieren la 02 (el refactor)
para no seguir engordando `tpv/page.tsx`.

## Convenciones de estas guías

- Rutas relativas a la raíz del repo. Migraciones nuevas: siguiente número libre en
  `supabase/migrations/` (a 06-07-2026 la última es `0063`; los ejemplos usan `00xx`).
- Todo cambio de esquema se refleja también en `apps/api/db/schema.sql` (espejo, ver
  `supabase/README.md`).
- Código y UI en español, TypeScript estricto, tests Vitest junto al fichero.
- Cada guía cierra con **criterios de aceptación**: si no se cumplen, no está hecha.
