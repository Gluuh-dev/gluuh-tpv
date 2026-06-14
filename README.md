# Gluuh TPV — Plataforma de hostelería

Monorepo de la plataforma TPV (Terminal Punto de Venta) para bares y restaurantes:
**web** (backoffice + TPV navegador), **escritorio Windows** (TPV de barra), **Android/iOS** (comanderas) y **backend SaaS** multi‑tenant.

> 📚 **Toda la documentación del proyecto está en [`docs/`](docs/README.md)** — investigación de mercado, arquitectura, fiscalidad (Verifactu/IGIC), pagos, hardware, modelo de negocio y roadmap.

> **Gluuh** es la marca paraguas (ya registrada); este producto es **Gluuh TPV**, de la familia de **Gluuh Campo**. Ver [docs/README.md §3](docs/README.md).

---

## Estructura del monorepo

```
gluuh-tpv/
├── apps/
│   ├── api/         # Backend NestJS (API, motor fiscal, write path de sync)
│   │   └── db/schema.sql   # ← Esquema PostgreSQL completo (multi-tenant + RLS)
│   ├── web/         # Next.js (backoffice + TPV navegador)
│   ├── desktop/     # Electron (TPV de barra Windows; carga la web + hardware)
│   └── mobile/      # Expo / React Native (comandera Android/iOS)
├── packages/
│   ├── core/        # ★ Lógica de negocio compartida: dominio, IVA/IGIC, VERIFACTU
│   ├── ui/          # Componentes React compartidos (web + desktop)
│   ├── api-client/  # Cliente tipado del API
│   └── hardware/    # Abstracción impresora/cajón/datáfono
├── docs/            # Documentación completa del proyecto
├── turbo.json       # Orquestación de tareas
└── pnpm-workspace.yaml
```

El paquete **[`packages/core`](packages/core)** es el "cerebro" compartido por las 4 plataformas: tipos de dominio, cálculo de impuestos (IVA peninsular e **IGIC canario**) y el **motor VERIFACTU** (hash encadenado SHA‑256 + QR de cotejo AEAT). Ver [docs/05](docs/05-stack-tecnologico.md) y [docs/07](docs/07-facturacion-y-cumplimiento-legal.md).

---

## Requisitos

- **Node.js ≥ 20** y **pnpm 9** (`npm i -g pnpm`)
- Para escritorio: **Electron** (Node; ver [apps/desktop/README](apps/desktop/README.md))
- Para móvil: **Expo** (`npx expo`)

## Puesta en marcha rápida

```bash
pnpm install            # instala todo el workspace

# Probar el motor fiscal (sin necesidad de nada más):
pnpm core:test          # ejecuta los tests de VERIFACTU (incluye el vector oficial de la AEAT)
pnpm core:demo          # demo: genera factura, hash encadenado y URL del QR

# Desarrollo por app:
pnpm --filter @gluuh/api dev
pnpm --filter @gluuh/web dev
pnpm --filter @gluuh/mobile start
pnpm --filter @gluuh/desktop dev
```

> Las apps (`web`, `mobile`, `desktop`) son **esqueletos mínimos** listos para construir encima. El núcleo de valor implementado hoy es **`packages/core`** (fiscalidad + dominio) y el **esquema de base de datos** (`apps/api/db/schema.sql`). Ver el [roadmap](docs/13-roadmap-mvp-y-equipo.md).

## Estado

| Pieza | Estado |
|-------|--------|
| Documentación (`docs/`) | ✅ Completa |
| `packages/core` — impuestos IVA/IGIC + VERIFACTU (huella, QR imagen, XML/SOAP) | ✅ Funcional, 12 tests (incluye vector AEAT) |
| `apps/api` — endpoints fiscales (`/fiscal/preview`, `/fiscal/xml`, `/fiscal/enviar`) + write‑path `/sync/upload` | ✅ Compila y responde |
| `apps/web` — TPV de demo (`/tpv`) con venta + ticket con QR | ✅ Funcional (verificado vía HTTP) |
| `apps/web` — pantallas fast-food (`/kiosko`, `/kds`, `/pantalla`, `/ofertas`) | ✅ Funcional (flujo kiosko→cocina→display verificado) |
| `packages/supabase` — cliente Supabase + `supabase/migrations/` | ✅ Esquema + cliente listos |
| `apps/api/db/schema.sql` — esquema BD | ✅ DDL completo (multi‑tenant + RLS) |
| `packages/sync` — esquema + conector PowerSync | ✅ Tipado (requiere infra para correr) |
| Cliente envío AEAT (mTLS) | ✅ Implementado (requiere certificado) |
| `apps/desktop` / `apps/mobile` | 🟡 Esqueletos iniciales |
| Pagos (Stripe/Redsys) / hardware ESC‑POS real | ⏳ Roadmap |

### Probar las funcionalidades

```bash
pnpm --filter @gluuh/core test          # 12 tests (impuestos, VERIFACTU, QR, XML)
pnpm --filter @gluuh/core build         # build dual ESM/CJS

# Web: TPV + pantallas estilo fast-food:
pnpm --filter @gluuh/web build && pnpm --filter @gluuh/web start
#   /tpv  /kiosko  /kds  /pantalla  /ofertas   (en http://localhost:3000)

# Backend fiscal:
pnpm --filter @gluuh/core build && pnpm --filter @gluuh/api build
pnpm --filter @gluuh/api start          # POST http://localhost:3001/fiscal/xml
```
