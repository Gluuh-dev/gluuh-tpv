# Implementación — guías ejecutables

**Actualizado:** 17-07-2026. Carpeta hermana de `docs/plan/` (el *qué* y el
*porqué*): aquí está el **cómo** — cada documento es una guía de implementación con
ficheros a tocar, migraciones SQL, contratos de código y criterios de aceptación,
pensada para ejecutarla tal cual (por una persona o por un agente).

> **Orden vigente:** el [plan maestro de reparación F0–F8](19-plan-maestro-reparacion-f0-f8.md)
> gobierna la ejecución completa y desarrolla el
> [plan definitivo](../plan/14-plan-definitivo-reparacion-identidad-seguridad.md).
> Las guías anteriores se usan como especificaciones de detalle solo dentro de la fase
> que les corresponda. Si contradicen esos dos documentos, mandan el plan 14 y la guía 19.

## Orden de ejecución recomendado

| # | Guía | Prioridad | Esfuerzo |
|---|---|---|---|
| [19-plan-maestro-reparacion-f0-f8.md](19-plan-maestro-reparacion-f0-f8.md) | **Canónica:** 34 entregas ordenadas para contrato, identidad, onboarding, nodo, dispositivos, seguridad LAN, dinero, fiscalidad, sync y operación | P0→P2 | 25-42 sem-persona |
| [01-activar-verifactu.md](01-activar-verifactu.md) | Cobro → factura real encadenada | P0 | 3-5 d |
| [02-refactor-tpv.md](02-refactor-tpv.md) | Trocear el monolito antes de ampliarlo | P0 | 3-4 d |
| [03-app-escritorio-electron.md](03-app-escritorio-electron.md) | App PC: impresión, cajón, kiosk, updater, backup USB | P0 | 2-3 sem |
| [04-modulos-y-emparejado.md](04-modulos-y-emparejado.md) | Módulos activables + pantallas por código | P0 | 1-1,5 sem |
| [05-paridad-glop.md](05-paridad-glop.md) | Aparcar, pasar a mesa, cliente, barra de estado, F10-F12… | P1 | 1,5-2 sem |
| [06-offline-powersync.md](06-offline-powersync.md) | Trabajar sin internet (PowerSync por dispositivo). **Re-encuadrada por la guía 16**: es el camino del caso futuro F4 (móvil offline), no el principal | P1→futuro | 2-3 sem |
| [07-creacion-rapida-desde-tpv.md](07-creacion-rapida-desde-tpv.md) | Crear/editar productos desde cualquier pantalla del TPV en segundos | P1 | 4-6 d |
| [08-analisis-glop.md](08-analisis-glop.md) | Glop a fondo: anatomía botón a botón, manuales y decisiones de imitación | — | consulta |
| [09-referencias-ux-competencia.md](09-referencias-ux-competencia.md) | Lecciones UX de Ágora, Revo, Square, Toast, SumUp, Lightspeed |
| [10-pantalla-cocina-kds-y-tickets.md](10-pantalla-cocina-kds-y-tickets.md) | Spec del KDS: 4 vistas, estados, config, filtrado por grupo, y los 4 tipos de ticket (cliente/pedido/camarero/cocinero) | — | consulta |
| [11-configuracion-backoffice.md](11-configuracion-backoffice.md) | Configuración del panel: zona técnica con clave, dónde persiste cada ajuste, migraciones 0045-0056 y cableado pendiente | hecho (04-07) | consulta |
| [12-conectar-tpv-modales-y-carta.md](12-conectar-tpv-modales-y-carta.md) | Cablear el TPV: variaciones, modificadores, anotaciones, dividir, cobrar; props de los 3 modales nuevos y tablas implicadas | pendiente cablear | ejecutable |
| [13-rediseno-config-y-estilos.md](13-rediseno-config-y-estilos.md) | ★ Backlog por sesiones: footer fijo + buscador global, Empresa y Local, Seguridad, Marca, orden de botones TPV, arreglar navegación | pendiente | por sesiones |
| [14-identidad-acceso-y-seguridad.md](14-identidad-acceso-y-seguridad.md) | **Histórica:** fotografía del 07-07; su propuesta de usuario/clave de terminal y semillas conocidas está rechazada | consulta | — |
| [15-instalacion-despliegue-y-licencia.md](15-instalacion-despliegue-y-licencia.md) | Contexto de instalación y GAP; identidad, activación y licencia se ejecutan según F2–F5 de la guía 19 | consulta | — |
| [16-nodo-local-y-sincronizacion.md](16-nodo-local-y-sincronizacion.md) | Detalle del nodo y sync; se ejecuta dentro de F3, F5 y F7, sin LWW para identidad, dinero o fiscalidad | P0 dentro de 19 | incluido |
| [17-manual-del-nodo.md](17-manual-del-nodo.md) | Manual operativo del nodo actual | consulta | — |
| [18-endurecer-el-nodo.md](18-endurecer-el-nodo.md) | Inventario de endurecimiento del nodo, absorbido por F5 y F8 | P0/P1 dentro de 19 | incluido |

El orden global ya no es independiente: `F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8`.
No se activa fiscalidad real, emparejado definitivo, remoto ni sync general antes de
cumplir las puertas previas de la guía 19. Los trabajos visuales o de catálogo pueden
prepararse en paralelo únicamente si no cambian identidad, autorización, dinero ni esquema.

## Convenciones de estas guías

- Rutas relativas a la raíz del repo. Migraciones nuevas: siguiente número libre en
  `docs/estado/AHORA.md`, que se reserva allí justo antes de crear el fichero. A
  17-07-2026 figura `0111`, pero debe volver a comprobarse al empezar.
- `supabase/migrations/*.sql`, la base viva autorizada y los tipos generados forman el
  contrato verificable. `apps/api/db/schema.sql` es documentación histórica y **no se
  actualiza ni se usa como esquema canónico**.
- Código y UI en español, TypeScript estricto, tests Vitest junto al fichero.
- Cada guía cierra con **criterios de aceptación**: si no se cumplen, no está hecha.
