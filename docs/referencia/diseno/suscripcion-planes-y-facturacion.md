# Suscripción, planes y facturación (cómo cobramos a las empresas)

> Cómo una **empresa cliente** (tenant) paga la suscripción de Gluuh, cómo se **mantiene** el cobro recurrente, y cómo **según el plan que paga se desbloquean unas u otras opciones** (feature gating). Aterriza el modelo de negocio SaaS de [licencia-y-modulos.md](../09-referencia-configurador-agora/licencia-y-modulos.md) y se apoya en las cuentas de [cuentas-y-acceso.md](../infraestructura/cuentas-y-acceso.md).

---

## 1. Principio: SaaS por suscripción, no licencia por máquina

Ágora licencia por **máquina** (huella del equipo) + módulos. Nosotros somos **SaaS multi‑tenant**:

- Se cobra una **suscripción a la empresa (tenant)**, no al PC.
- El **acceso remoto va de serie** (gancho frente a Ágora, que lo cobra como *My Ágora Premium*).
- El precio escala por **plan + nº de locales y/o terminales + add‑ons**.

---

## 2. Cómo paga el cliente (pasarela de suscripción)

Recomendación: **Stripe Billing** (estándar SaaS, soporta UE/SEPA/tarjeta, facturas, impuestos, reintentos). No reinventar cobros recurrentes.

```
  Cliente (empresa)                 Gluuh (apps/api / web)              Stripe
        │  "Suscribirse al plan Pro"        │                              │
        ├──────────────────────────────────►│  crea Checkout Session ─────►│
        │◄───────────────  redirige a Stripe Checkout ─────────────────────┤
        │  paga (tarjeta / SEPA) ───────────────────────────────────────► │
        │                                   │◄── webhook: subscription ────┤
        │                                   │   (created/updated/paid)      │
        │                                   ├─► actualiza tenant: plan,      │
        │                                   │   estado, entitlements         │
        │◄──── acceso desbloqueado ─────────┤                              │
```

- **Alta**: desde el backoffice, "Suscripción" → Stripe **Checkout** (hosted). Tras pagar, Stripe envía un **webhook** y activamos el plan.
- **Autoservicio**: Stripe **Customer Portal** para que el cliente cambie de plan, actualice la tarjeta, descargue facturas o cancele — sin que intervengamos.
- **Fuente de verdad del cobro**: Stripe. Nuestra BD guarda un **espejo** (plan, estado, periodo) sincronizado por webhooks (idempotentes, verificando la firma).

> Importante: la suscripción a **Gluuh** (lo que la empresa nos paga a nosotros) es **independiente** de la facturación **VERIFACTU** de la empresa a sus clientes. Son dos planos distintos.

---

## 3. Cómo se mantiene (ciclo de vida y morosidad)

Stripe gestiona el **cobro recurrente** (mensual/anual), **prorrateo** al cambiar de plan, y el **dunning** (reintentos ante impago). Estados que reflejamos en `subscription.estado`:

| Estado | Qué significa | Qué hacemos |
|--------|---------------|-------------|
| `trialing` | Periodo de prueba | Acceso completo del plan elegido |
| `active` | Al corriente | Acceso completo |
| `past_due` | Falló el cobro, en reintentos | **Periodo de gracia** (p. ej. 7–14 días): avisos in‑app + email; el TPV **sigue vendiendo** |
| `canceled` / `unpaid` | Cancelada o impago final | **Suspensión** de funciones de pago/configuración; ver §6 (no romper lo legal) |
| `paused` | Pausa voluntaria | Solo lectura |

> **Regla de oro (POS):** ante impago **no se corta de golpe la venta** — un TPV es misión crítica y hay obligaciones fiscales. Primero gracia + avisos; al suspender, se limita backoffice/online/altas, pero se preserva el **acceso a datos y a cerrar lo abierto** (ver §6).

---

## 4. Planes y precios (qué incluye cada uno)

Estructura propuesta (ajustable): **base por local** + **terminales** + **add‑ons**. Ejemplo de tiers:

| Capacidad | **Básico** | **Pro** | **Premium** |
|-----------|:--:|:--:|:--:|
| TPV táctil + cobro + VERIFACTU/IGIC | ✅ | ✅ | ✅ |
| **Acceso remoto / backoffice en la nube** | ✅ | ✅ | ✅ |
| Terminales incluidos | 1 | 3 | ilimitados |
| Locales | 1 | 1 | multi‑local |
| Informes básicos (ventas, caja, Z) | ✅ | ✅ | ✅ |
| **KDS / Monitores de cocina** | — | ✅ | ✅ |
| **Comandera** (móvil) | — | ✅ | ✅ |
| **Carta digital / Scan&Pay / pedido online** | — | opcional | ✅ |
| **Delivery / Take Away** | — | opcional | ✅ |
| **Compras / inventario / escandallo** | — | ✅ | ✅ |
| **Informes de rentabilidad** (menu engineering, márgenes) | — | — | ✅ |
| Multi‑local + consolidación | — | — | ✅ |
| Soporte | email | prioritario | dedicado |

**Add‑ons** (cobrables aparte, sumables a cualquier plan): Carta digital, Delivery, terminales extra, locales extra, integraciones (contabilidad, reservas).

> El precio real (cifras) es decisión de negocio; aquí fijamos **la estructura** (qué se mide y qué desbloquea).

---

## 5. Cómo el plan desbloquea opciones (feature gating)

El plan (+ add‑ons) se traduce en **entitlements** (derechos) del tenant. La app pregunta por un entitlement para habilitar cada función. **Se hace cumplir en 3 capas** (no solo ocultar en la UI):

1. **UI (backoffice/operativa):** oculta/deshabilita lo no incluido y muestra "Mejora tu plan" donde toque.
2. **Backend (NestJS / RLS):** la verdad. Aunque alguien fuerce la UI, el backend rechaza la acción si el entitlement falta (p. ej. crear una carta digital, dar de alta el 4º terminal en el plan Pro).
3. **Emparejamiento de dispositivos:** al añadir un terminal (QR, ver [conexion-y-roles-dispositivo.md](conexion-y-roles-dispositivo.md)), se comprueba el **límite de dispositivos** del plan; si se supera, se bloquea o se ofrece add‑on.

Ejemplos de entitlements: `kds`, `comandera`, `carta_digital`, `delivery`, `compras_inventario`, `informes_rentabilidad`, `multi_local`, `max_dispositivos`, `max_locales`.

> Encaja con el modelo `setting` (ámbito GLOBAL/tenant) y con la RLS: los entitlements son datos del tenant, legibles por la app y verificables por el backend.

---

## 6. Impago y cumplimiento fiscal (qué NO romper)

- Las obligaciones **VERIFACTU/IGIC** de la empresa con Hacienda **no dependen de que nos pague a nosotros**. No bloquear de forma que impida emitir/conservar registros legales.
- En `past_due` → **modo gracia**: todo sigue, con avisos.
- En suspensión (impago final) → restringir **altas y módulos de valor añadido** (carta online, nuevos terminales, informes avanzados) y el **backoffice de configuración**, pero permitir **exportar datos** y, idealmente, seguir cobrando lo mínimo legal durante un margen. Nunca "secuestrar" los datos fiscales del cliente (RGPD + buena praxis).
- Reactivación inmediata al regularizar (webhook `active` → entitlements restaurados).

---

## 7. Modelo de datos (espejo de Stripe)

```sql
-- Plan/catálogo (puede vivir en Stripe; espejo local opcional para mostrar)
create table plan (
  id text primary key,                 -- 'basico' | 'pro' | 'premium'
  nombre text not null,
  stripe_price_id text,                -- precio en Stripe
  entitlements jsonb not null          -- { kds:true, max_dispositivos:3, ... }
);

-- Suscripción del tenant (espejo de Stripe, sync por webhook)
create table subscription (
  tenant_id uuid primary key references tenant(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text references plan(id),
  estado text not null,                -- trialing|active|past_due|canceled|paused
  periodo_fin timestamptz,             -- fin del periodo pagado
  cancel_at_period_end boolean default false,
  updated_at timestamptz default now()
);

-- Entitlements efectivos del tenant = plan.entitlements + add-ons (materializado)
create table tenant_entitlement (
  tenant_id uuid references tenant(id) on delete cascade,
  clave text not null,                 -- 'kds','carta_digital','max_dispositivos'...
  valor jsonb not null,                -- true | 5 | "..."
  primary key (tenant_id, clave)
);
```

- RLS por `tenant_id` (cada empresa solo ve su suscripción). El **webhook de Stripe** (en `apps/api`, con clave de servicio) actualiza `subscription` y recalcula `tenant_entitlement`. Verificar **firma del webhook** e **idempotencia**.
- Un helper `tiene_entitlement(clave)` (o leer `tenant_entitlement`) que usan UI y backend.

---

## 8. Implementación recomendada (orden)

1. **Stripe Billing**: productos/planes/precios en Stripe (test mode primero).
2. **Checkout + Customer Portal** desde el backoffice (`/suscripcion`).
3. **Webhook** en `apps/api` (`/billing/webhook`): firma + idempotencia → actualiza `subscription` y `tenant_entitlement`.
4. **Gating**: `tenant_entitlement` leído por la UI (ocultar) y **forzado en backend/RLS** (la verdad) + límite de dispositivos en el emparejamiento.
5. **Estados/morosidad**: banner in‑app por estado; lógica de gracia/suspensión respetando §6.
6. **Impuestos de la suscripción**: Stripe Tax para el IVA que **nosotros** repercutimos a la empresa (otra cosa que el VERIFACTU de ella).

## Decisiones clave

| Aspecto | Decisión |
|---------|----------|
| Cobro recurrente | **Stripe Billing** (no construir) |
| Unidad de cobro | **Empresa (tenant)**; escala por plan + locales/terminales + add‑ons |
| Acceso remoto | **Incluido** en todos los planes (diferenciador) |
| Verdad del gating | **Backend/RLS + entitlements**, no solo UI |
| Impago | Gracia → suspensión **sin romper lo fiscal/legal** ni secuestrar datos |
| Suscripción ≠ VERIFACTU | Dos planos independientes; el impago a Gluuh no impide cumplir con Hacienda |
