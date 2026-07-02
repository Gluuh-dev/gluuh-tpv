# 01 — Estado actual del monorepo (02-07-2026)

Resultado de revisar a fondo `apps/*`, `packages/*`, `supabase/migrations/*` y `docs/*`.

## 1.1 Madurez por pieza

| Pieza | Estado | Detalle |
|---|---|---|
| `packages/core` | ★ **Real, con tests** | Motor fiscal completo: impuestos incluidos IVA/IGIC/IPSI, VERIFACTU (huella SHA-256 encadenada, QR, XML/SOAP) validado contra el **vector oficial de la AEAT**, dominio (estados de comanda, tipos de operación). La joya del repo. |
| `apps/web` | ★ **Muy avanzada** | TPV completo, comandera, kiosko, KDS, pantalla cliente, cartelería, backoffice (~25 páginas reales + 13 informes con datos), 2 editores de plano, multi-tenant RLS + JWT hook, admin de plataforma. Detalle abajo. |
| `supabase/migrations` | **Maduro con grietas** | 32 migraciones, ~45 tablas, RLS por `tenant_id`. Riesgos en §1.4. |
| `apps/api` (fiscal) | **Funcional** | `POST /fiscal/preview|xml|enviar` + cliente AEAT mTLS real (certificado `.p12`). Sin parseo de respuesta ni persistencia del resultado. |
| `apps/api` (sync) | Esqueleto | `/sync/upload` solo acusa recibo (`TODO: aplicar realmente`). Sin capa de datos (no hay driver PG ni cliente Supabase en la API). |
| `packages/sync` | Escrito, no ejecutable | Schema PowerSync (6 tablas) + `GluuhConnector` con cola de escritura correcta. Falta `@powersync/web`, la infraestructura PowerSync y el write-path real. |
| `apps/mobile` | Esqueleto funcional | Comandera Expo contra Supabase directo (PIN, mesas, comanda). No usa `@gluuh/supabase` ni sync. |
| `apps/desktop` | **Esqueleto mínimo** | 4 ficheros: ventana Electron que carga `http://localhost:3100/tpv`, preload con `window.gluuh.imprimirTicket()` **simulado**. Sin hardware, sin empaquetado. |
| `packages/hardware` | Placeholder | Solo interfaces `PrintJob`/`Printer`. Cero drivers. No existe ninguna dependencia de impresión en todo el repo. |
| `packages/ui`, `packages/api-client` | Placeholder | Solo exportan una constante. |
| `packages/supabase` | Funcional (fino) | Factory de cliente. La móvil no lo usa (duplicación). |

## 1.2 Lo que el TPV web ya hace (`apps/web/app/tpv/page.tsx`)

Gate de operario por PIN, salas/zonas con plano gráfico interactivo (estado y saldo por mesa), barra/venta directa, para llevar (nombre+teléfono), reservas por mesa (pulsación larga), grid de categorías/productos a color, ticket con edición de línea y nota de cocina, teclado con `DTO%`/`DTO€`/`PREC` (descuento y precio manual por línea o global), cobro en efectivo con cambio, **pago mixto** con propina (efectivo/tarjeta/Bizum), envío a cocina con estados (`Preparar/Marchar/Entregar`), ticket 80 mm con desglose fiscal y QR vía `window.print()`.

El backoffice cubre: dashboard con KPIs, carta (familias→categorías→productos con IVA automático por clase fiscal × territorio), menús combo, empleados con PIN, caja con cierre Z, impuestos, formas de pago, descuentos, branding/cartelería, visor VERIFACTU con verificación de cadena, y 13 informes reales.

## 1.3 Los 7 huecos que importan

1. **VERIFACTU desactivado en el TPV** — `VERIFACTU_ACTIVO = false` en `apps/web/app/tpv/page.tsx:35`. El endpoint `/api/factura` (numeración por serie + huella encadenada + persistencia en `invoice`) **ya existe y funciona**; el TPV simplemente no lo llama. Tickets marcados "sin validez fiscal".
2. **Cero offline** — sin service worker, sin PWA, sin PowerSync, sin IndexedDB. Si cae la red, el TPV muere. El landing lo anuncia como característica estrella: hoy es falso. Glop presume exactamente de esto.
3. **Cero hardware** — impresión por diálogo del navegador; sin ESC/POS, sin cajón, sin visor. Es la razón de ser de la app de escritorio (doc 02).
4. **Sin sistema de módulos ni feature-flags** — `tenant.plan` existe pero no gobierna nada; el mecanismo `setting` (GLOBAL/LOCAL/DEVICE, migración `0023`) está en BD y en `app/lib/settings.ts` pero **ninguna pantalla lo usa**.
5. **Compras/stock entero sin hacer** — la sección más grande de stubs del menú (ya inventariado en `docs/auditoria/`; no lo repetimos aquí).
6. **Pagos reales** — datáfono/Stripe/Redsys sin integrar; el kiosko cobra "simulado".
7. **Permisos finos** — solo enum de 4 roles + filtrado de menú en cliente; sin tabla `role`/`permission`.

## 1.4 Riesgos técnicos detectados (arreglar antes de que muerdan)

- **Doble definición de `invoice`**: `0001_init.sql` la crea con unas columnas; `0022_facturacion.sql` hace `CREATE TABLE IF NOT EXISTS` con **otras** (huella, estado AEAT). Si 0001 se aplicó primero, 0022 fue un no-op y la tabla real no tiene las columnas que `/api/factura` espera. **Verificar contra la BD real y consolidar en una migración correctiva.**
- **`customer` (0001) vs `client` (0018)**: dos tablas de clientes conviviendo. Decidir una.
- **Docs contradictorios Tauri/Electron**: la decisión es Electron (`docs/05`, `README`, `docs/14`) pero los docs 03, 04, 06, 09, 10, 12 y 13 siguen diciendo Tauri/Rust. Confunde a cualquiera que entre al proyecto.
- **Auth 100% en cliente** en la web: no hay `middleware.ts` ni `@supabase/ssr`; cada página comprueba sesión con JS. RLS protege los datos, pero conviene middleware para no servir el shell del panel a anónimos.
- **`apps/web/app/tpv/page.tsx` monolítico (1.298 líneas)**: cada mejora del doc 04 lo hará crecer. Trocear antes de ampliar.
- **Dos editores de plano** (`(panel)/sala` de 280 líneas vs `(panel)/planos-de-mesas` de 451): el avanzado hace todo lo del simple. Borrar el simple.
- **README raíz y `docs/README.md` desactualizados**: describen como "pendiente" cosas que llevan semanas hechas.
- **Puerto incoherente en desktop**: `main.js` usa 3100, su README dice 3000.
