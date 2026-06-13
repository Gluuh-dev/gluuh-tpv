# Servio TPV — Plataforma de hostelería

Monorepo de la plataforma TPV (Terminal Punto de Venta) para bares y restaurantes:
**web** (backoffice + TPV navegador), **escritorio Windows** (TPV de barra), **Android/iOS** (comanderas) y **backend SaaS** multi‑tenant.

> 📚 **Toda la documentación del proyecto está en [`docs/`](docs/README.md)** — investigación de mercado, arquitectura, fiscalidad (Verifactu/IGIC), pagos, hardware, modelo de negocio y roadmap.

> `Servio` es un **nombre provisional** (ver [docs/README.md §3](docs/README.md)).

---

## Estructura del monorepo

```
servio-tpv/
├── apps/
│   ├── api/         # Backend NestJS (API, motor fiscal, write path de sync)
│   │   └── db/schema.sql   # ← Esquema PostgreSQL completo (multi-tenant + RLS)
│   ├── web/         # Next.js (backoffice + TPV navegador)
│   ├── desktop/     # Tauri (TPV de barra Windows; UI React + núcleo Rust)
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
- Para escritorio: **Rust** + toolchain de Tauri (ver [tauri.app](https://tauri.app))
- Para móvil: **Expo** (`npx expo`)

## Puesta en marcha rápida

```bash
pnpm install            # instala todo el workspace

# Probar el motor fiscal (sin necesidad de nada más):
pnpm core:test          # ejecuta los tests de VERIFACTU (incluye el vector oficial de la AEAT)
pnpm core:demo          # demo: genera factura, hash encadenado y URL del QR

# Desarrollo por app:
pnpm --filter @servio/api dev
pnpm --filter @servio/web dev
pnpm --filter @servio/mobile start
pnpm --filter @servio/desktop dev
```

> Las apps (`web`, `mobile`, `desktop`) son **esqueletos mínimos** listos para construir encima. El núcleo de valor implementado hoy es **`packages/core`** (fiscalidad + dominio) y el **esquema de base de datos** (`apps/api/db/schema.sql`). Ver el [roadmap](docs/13-roadmap-mvp-y-equipo.md).

## Estado

| Pieza | Estado |
|-------|--------|
| Documentación (`docs/`) | ✅ Completa |
| `packages/core` — VERIFACTU + impuestos | ✅ PoC funcional con tests |
| `apps/api/db/schema.sql` — esquema BD | ✅ DDL completo (multi‑tenant + RLS) |
| `apps/*` — apps cliente | 🟡 Esqueletos iniciales |
| Integración pagos / sync / hardware | ⏳ Roadmap |
