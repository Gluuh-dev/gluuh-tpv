# 05 — Stack tecnológico

> La decisión de «con qué construimos esto» y, sobre todo, **por qué**. Cada capa incluye la elección principal, las alternativas evaluadas y el razonamiento (trade‑offs). La arquitectura que conecta estas piezas está en **[04](04-arquitectura-tecnica.md)**.

---

> **🟢 Decisión del proyecto (junio 2026):** tras valorar las alternativas de abajo, el stack elegido es **Next.js + Supabase + Electron + Expo** (+ PowerSync para offline). Cambios respecto al análisis original: **Electron** en lugar de Tauri para el escritorio (ecosistema de hardware más maduro) y **Supabase** como **base de datos completa** (PostgreSQL gestionado + Auth + Realtime + Storage), manteniendo un mini‑servicio de confianza para el motor fiscal. El resto del análisis se conserva como contexto de la decisión.

## 1. Recomendación en una tabla

| Capa | Elección principal | Alternativa | Razón corta |
|------|--------------------|-------------|-------------|
| **Web (backoffice + TPV navegador)** | **React + Next.js** | SvelteKit | Ecosistema admin maduro y comparte base con Tauri y RN |
| **Escritorio Windows (TPV)** | **Electron** ✅ *(elegido)* | Tauri 2.0 | Ecosistema de hardware más maduro y probado (ESC/POS, serialport, node‑hid) |
| **Móvil (comanderas)** | **React Native + Expo** | Flutter | Reutiliza lógica/tipos del resto del stack TS |
| **Backend** | **NestJS** (Node/TS) | Go · .NET | Mismo lenguaje, I/O suficiente, ecosistema |
| **Base de datos** | **Supabase** (PostgreSQL: shared schema + `tenant_id` + RLS) | — | Postgres gestionado + Auth + Realtime + Storage; el esquema corre tal cual |
| **Offline / Sync** | **PowerSync** | ElectricSQL + TanStack DB | Hecho para «POS sin internet», bidireccional |
| **Tiempo real** | **Socket.IO** (eventos) + PowerSync (datos) | Supabase Realtime · Ably | Integrado en NestJS, rooms por tenant |
| **Hosting** | **Supabase + Fly.io/Render** → AWS | Railway | Coste bajo al arrancar, camino a escala |
| **Auth** | **Supabase Auth** → Keycloak | Auth0 · Clerk | Encaja con Postgres+RLS; control de coste |
| **Monorepo** | **Turborepo + pnpm** | Nx | Caché de builds, comparte paquetes |

> **Filosofía:** «TypeScript en casi todo». Un mismo desarrollador puede tocar web, escritorio, móvil y backend, y la **lógica de negocio crítica (precios, IVA/IGIC, estados de comanda, fiscalidad) vive en un único paquete testeado**. Para un equipo pequeño que tiene que **entregar**, esto es la mayor ventaja posible.

---

## 2. Frontend web

**Elección: Next.js (React, App Router).**

| Framework | Pros | Cons | Veredicto |
|-----------|------|------|-----------|
| **React + Next.js** | Ecosistema enorme, contratación fácil, librerías admin maduras (TanStack Table, shadcn/ui, Recharts), **misma base que Tauri y RN** | RSC añade complejidad | ✅ **Elegido** |
| SvelteKit | Bundles mínimos, DX excelente | Ecosistema menor, no comparte con RN | Solo si fuera web pura |
| Vue/Nuxt | Buena DX | No comparte con RN | Solo si el equipo ya es Vue |
| Angular | Estructurado, enterprise | Verboso, pesado, aislado | Equipos .NET/Java |

**Por qué:** la estrategia de código compartido manda. React es el único frontend que reutilizamos en escritorio (Tauri) y móvil (React Native). El backoffice se beneficia del ecosistema admin de React; el TPV‑navegador comparte componentes con el de escritorio.

---

## 3. Escritorio Windows (TPV principal)

**Elección del proyecto: Electron** (carga la UI web + núcleo Node para hardware). *El análisis original recomendaba Tauri por footprint; se ha optado por Electron por la madurez de su ecosistema de hardware — `node-thermal-printer`, `serialport`, `node-hid` — que reduce el riesgo de integración del datáfono y la impresora ESC/POS. Tauri queda como alternativa válida.* Implementación en `apps/desktop` (proceso `main` + `preload` + puente `window.gluppo`).

Requisitos duros: **offline real**, acceso a **impresora ESC/POS**, **cajón** (pulso por la impresora), **datáfono** (SDK por TCP/serie), **puerto serie/USB**.

| Framework | Tamaño / RAM | Hardware local | Veredicto |
|-----------|-------------|----------------|-----------|
| **Tauri 2.0** | Instalador <10 MB, ~30‑80 MB RAM | Plugins reales `tauri-plugin-serialport`, `tauri-plugin-esc-pos`, thermal‑printer; Rust enlaza cualquier DLL/SDK del datáfono | ✅ **Elegido** |
| Electron | 80‑150 MB, 150‑400+ MB RAM | Ecosistema más maduro (`serialport`, `node-thermal-printer`, `node-hid`) | Alternativa segura si nadie domina Rust |
| .NET MAUI | Medio | `System.IO.Ports` solo Windows; SDKs nativos vía .NET | Solo en casa .NET |
| Flutter Desktop | Medio | Plugins serie/USB menos maduros en desktop | Solo en estrategia «todo Flutter» |

**Por qué Tauri:** (1) comparte la UI React con web; (2) footprint mínimo (importa en hardware de bar barato/antiguo); (3) la capa **Rust** es ideal para hardware y reduce superficie de ataque (relevante con pagos).

**Trade‑off honesto:** Electron tiene el ecosistema de hardware **más probado y documentado** (años de apps POS reales). Si el equipo no tiene a nadie cómodo con Rust y hay prisa con el datáfono, **Electron es defendible** (se paga en RAM/disco). El módulo de hardware se aísla para poder cambiar de motor sin reescribir la lógica.

---

## 4. Móvil — comanderas (Android + iOS)

**Elección: React Native + Expo.**

| Framework | Reutilización | Hardware (BT/impresora) | Rendimiento | Veredicto |
|-----------|---------------|-------------------------|-------------|-----------|
| **React Native + Expo** | **Alta** (comparte TS con web/Tauri/backend) | Librerías maduras BT/USB; Hermes + new architecture por defecto | Muy bueno (de sobra para una comandera) | ✅ **Elegido (stack TS)** |
| Flutter | Alta solo si **todo** es Flutter | Plugins BT/ESC/POS sólidos; AOT | **El mejor** | ✅ Elegido si stack Flutter |
| Kotlin/Swift nativo | **Nula** (2 bases de código) | Acceso total | El mejor | Solo con equipo doble |
| .NET MAUI | Alta si backend/desktop .NET | Serie no en Android *out‑of‑the‑box* | Bueno | Solo en casa .NET |

**Por qué:** una comandera no es un juego 3D; el rendimiento de RN moderno es más que suficiente y, a cambio, **reutilizamos la lógica de negocio, tipos y cliente de sync** ya escritos. Expo simplifica builds, OTA updates y detección de monorepo.

---

## 5. Estrategia de código compartido (la decisión estructurante)

**Elección: «Todo TypeScript» en monorepo Turborepo + pnpm.**

```
gluppo/  (monorepo Turborepo + pnpm)
├── packages/
│   ├── core/          # Dominio: tipos, validación (Zod), cálculo de cuenta,
│   │                  # IVA/IGIC, máquina de estados de comanda, fiscalidad
│   ├── api-client/    # Cliente tipado (tRPC u OpenAPI) — tipos extremo a extremo
│   ├── ui/            # Componentes React (web + Tauri); hooks compartidos con RN
│   └── hardware/      # Abstracción de impresora/cajón/datáfono
├── apps/
│   ├── web/           # Next.js (backoffice + TPV navegador)
│   ├── desktop/       # Tauri (embebe UI React) — TPV de barra
│   ├── mobile/        # Expo / React Native — comandera
│   └── api/           # NestJS — backend
└── turbo.json
```

- Se comparte **~70‑90 % de la lógica**; la vista de móvil se reescribe en RN pero el «cerebro» (precios, IVA, estados) es común y testeado una sola vez.
- Existen *starters* probados con exactamente este patrón (p. ej. **Create T3 Turbo**: Next.js + Expo + tipos compartidos).

**Alternativas coherentes:**
- **«Todo Flutter»** (móvil+desktop+web Dart + PowerSync SDK Dart + backend Go): máxima consistencia y rendimiento nativo, pero backoffice web en Flutter es peor (SEO, tablas densas) y rompe el «un solo lenguaje».
- **Híbrido por capas** (backend .NET/Go + frontends por mérito): más libertad, **menos reutilización**, más mantenimiento. Solo si el equipo ya está repartido por especialidad.

---

## 6. Backend

**Elección: NestJS (Node/TypeScript).**

| Opción | Pros | Cons | Veredicto |
|--------|------|------|-----------|
| **NestJS** | Mismo lenguaje, estructura sólida (DI, módulos), excelente I/O, tRPC/Prisma | No iguala a Go en CPU puro | ✅ **Elegido** |
| Go | Concurrencia y rendimiento excelentes | Otro lenguaje, más verboso | Si el equipo ya domina Go |
| .NET (ASP.NET Core) | Muy rápido, **SignalR** de primera | Lenguaje distinto del frontend | Excelente en casa .NET |
| Java/Spring | Maduro, enterprise | Pesado, sobredimensionado al empezar | Solo si la empresa es Java |
| Python (FastAPI) | Rápido de prototipar, bueno para ML | Menos throughput | Bueno para analítica/IA, no para el core transaccional |

**Por qué:** el cuello de botella de un TPV es **I/O y sincronización, no CPU**. NestJS da coherencia TS + productividad. Si el realtime crece mucho, se externaliza a un servicio dedicado (Go o PaaS de realtime) sin reescribir el core.

---

## 7. Base de datos

**Elección: PostgreSQL.** RLS nativo, JSONB, *logical replication* (base de los motores de sync), ecosistema. MySQL es válido pero pierde RLS y la integración con los sync engines modernos.

**Multi‑tenant: shared schema + `tenant_id` + RLS.** Modelos y trade‑offs detallados en **[06 — Base de datos y sincronización](06-base-de-datos-y-sincronizacion.md)**.

**BD local en cliente: SQLite** (vía PowerSync), tanto en escritorio como en móvil.

---

## 8. Offline‑first / sincronización

**Elección: PowerSync.**

| Solución | Modelo | Plataformas | Veredicto |
|----------|--------|-------------|-----------|
| **PowerSync** | Postgres ↔ SQLite **bidireccional**, buckets por tenant, escrituras por tu backend | Web, RN, Flutter, Swift, Kotlin | ✅ **Elegido** — es literalmente el caso «POS durante caída de internet» |
| ElectricSQL + TanStack DB | Postgres → SQLite, escritura por tu API | Web, móvil | Alternativa OSS sólida (más DIY en el *write path*) |
| WatermelonDB | BD reactiva + sync propio | RN (web flojo) | Mucho trabajo, no ideal multiplataforma |
| RxDB | Local + replicación | Web y móvil | Adaptador SQLite de pago |
| CRDTs (Yjs/Automerge) | Merge automático | Todas | Para edición colaborativa, no datos transaccionales POS |
| Couchbase/PouchDB | Replicación HTTP | Todas | Resolución de conflictos manual, te aleja de Postgres |

**Por qué PowerSync:** construido para este escenario, **bidireccional con cola de escritura persistente**, escrituras por el backend (validación + fiscalidad), **SDKs para todas nuestras plataformas**, integra con Supabase/Postgres.

**Trade‑off:** PowerSync es de pago a partir de pocos usuarios (~49 $/mes inicio). La alternativa **ElectricSQL** evita coste/lock‑in a cambio de implementar más del *write path*. **No construir el sync a mano** salvo que sea el producto: es donde mueren los proyectos de TPV.

---

## 9. Tiempo real

**Elección: PowerSync (datos) + Socket.IO (eventos).**

| Opción | Pros | Cons | Uso aquí |
|--------|------|------|----------|
| **Socket.IO** | Reconexión, rooms por tenant, fácil en NestJS | Escalado necesita adapter Redis | ✅ Eventos KDS/notificaciones |
| SignalR | Excelente | Atado a .NET | Si backend fuera .NET |
| Supabase Realtime | Listo si usas Supabase | Límites a escala alta | Cómodo al arrancar |
| Ably / Pusher | Escala masiva, gestionado | Coste, dependencia | Cuando el realtime sea masivo |

La **comanda** la propaga PowerSync (ya persiste en SQLite del KDS/otra comandera); Socket.IO añade la **campana** y eventos efímeros. Migrar a Ably más adelante es un cambio acotado.

---

## 10. Infraestructura / hosting

| Fase | Stack | Coste aprox. |
|------|-------|--------------|
| **Arranque** | Supabase (Postgres+Auth) + Fly.io/Render (API) + PowerSync Cloud + Redis | ~60‑120 €/mes |
| **Escala** | AWS (ECS/Fargate + RDS Multi‑AZ + ElastiCache) | Variable |

**CI/CD:** GitHub Actions + caché Turborepo. **Cuidado con Railway** para producción de cara a cliente (historial de caídas).

---

## 11. Autenticación y roles

**Elección: Supabase Auth (arranque) → Keycloak (escala).**

- El **JWT porta `tenant_id` + rol** → activa la **RLS** en Postgres, define los **buckets de PowerSync** y gobierna los **guards** del API.
- **PIN de camarero**: capa de UX local sobre una sesión de dispositivo ya autenticada (el dispositivo se registra una vez con credenciales del local).
- Roles: admin plataforma, propietario, encargado, camarero, cocina/KDS.
- Auth0/Clerk reservados para cuando se venda a cadenas con **SSO/SAML/SCIM**.

---

## 12. Lenguajes, librerías y herramientas (resumen)

| Área | Tecnología |
|------|-----------|
| Lenguaje principal | **TypeScript** (cliente y servidor) + **Rust** (capa hardware de Tauri) |
| Validación / tipos | Zod, tRPC (o OpenAPI) |
| ORM / acceso a datos | Prisma (backend) · SQLite vía PowerSync (cliente) |
| UI | React, shadcn/ui, Tailwind CSS, TanStack (Table/Query), Recharts |
| Móvil | React Native, Expo, librerías ESC/POS BT |
| Colas/jobs | BullMQ + Redis |
| Testing | Vitest/Jest, Playwright (e2e web), Detox (e2e móvil) |
| Calidad | ESLint, Prettier, TypeScript estricto, Husky |
| Contenedores | Docker, GitHub Actions, Turborepo |
| Observabilidad | Sentry, Grafana/Datadog (según fase) |

---

## 13. Síntesis (opinión de arquitecto)

> **Monorepo Turborepo, todo TypeScript: Next.js (web) + Tauri (TPV escritorio) + React Native/Expo (comanderas) + NestJS (backend) + PostgreSQL (shared‑schema + RLS) + PowerSync (offline) + Socket.IO (eventos) + Supabase/Fly.io (hosting) + Supabase Auth→Keycloak**, con la **fiscalidad Verifactu/TicketBAI integrada en el backend desde el día uno.**

Es el equilibrio óptimo entre **reutilización de código, time‑to‑market, coste de arranque y resolución del problema más difícil (offline)** para un equipo que tiene que entregar.

**Alternativa coherente si el equipo fuera .NET:** ASP.NET Core + SignalR + .NET MAUI (desktop+móvil) + PowerSync + Postgres. **Alternativa si se prioriza rendimiento nativo uniforme:** todo Flutter + PowerSync (SDK Dart) + Go/NestJS.

**Lo que NO recomendamos:** stacks fragmentados sin reutilización y **construir el motor de sync a mano**.

---

## 14. Fuentes

Tauri vs Electron (tech‑insider.org, dolthub.com, gethopp.app) · plugins Tauri serial/ESC‑POS (github eleroy, s00d, luis3132, lnxdxtf; lib.rs) · .NET MAUI ports (learn.microsoft.com) · Flutter vs RN (nomtek.com, dev.to) · frameworks web (leapcell.io, index.dev) · backend (medium, dev.to, quartzdevs.com) · multi‑tenant RLS (propelius.tech, dev.to, medium) · offline/sync (cssauthor.com, powersync.com, docs.powersync.com, findalternatives.net) · realtime (ably.com) · hosting (uxcontinuum.com, getdeploying.com, flexprice.io) · monorepo (medium, nx.dev, starterpick.com) · auth (justaftermidnight247.com, cloudthrill.ca, nexaitech.com).
