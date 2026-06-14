# 15 — Cuentas y servicios a crear (marca Gluppo)

> Checklist de todas las cuentas/servicios que hay que dar de alta para construir y lanzar **Gluppo** (TPV de hostelería), de la familia de **Gluuh**. Ordenado por fases para no pagar de más antes de tiempo. Costes orientativos (junio 2026) — verificar al darte de alta.

---

## 0. Decisiones de marca (handles y correo)

| Elemento | Recomendación | Estado comprobado |
|----------|---------------|-------------------|
| **Dominio principal** | **`gluppo.com`** | ✅ **LIBRE** — regístralo ya |
| Dominios defensivos (opcional) | `gluppo.es`, `gluppo.app` | Verificar en registrador |
| **Handle de marca** | `gluppo` está **ocupado en GitHub** → usa **`gluppohq`** (o `gluppoapp`) y el **mismo en todas las redes** | `gluppohq`, `gluppoapp`, `gluppopos` ✅ libres en GitHub |
| **Correo "dueño"** (clave) | Un Gmail único que sea **propietario de TODAS las altas**, p. ej. `gluppohq@gmail.com` | A crear (paso 1) |
| Correos de marca (luego) | `hola@gluppo.com`, `soporte@gluppo.com`, `facturacion@gluppo.com`, `no-reply@gluppo.com` (con Google Workspace) | Tras registrar dominio |

> **Regla de oro:** crea primero el **Gmail "dueño"** y usa **ese mismo correo** para registrar todo lo demás. Activa **2FA** en cada servicio y guarda todo en un **gestor de contraseñas** (Bitwarden gratis / 1Password). Así nunca pierdes el control de una cuenta.

---

## 1. Fase 0 — Identidad (hazlo primero, casi gratis)

| # | Servicio | Para qué | Cómo / cuenta sugerida | Coste |
|---|----------|----------|------------------------|-------|
| 1 | **Gmail "dueño"** | Correo raíz que registra todo | `gluppohq@gmail.com` | Gratis |
| 2 | **Registrador de dominio** | Comprar `gluppo.com` | Cloudflare Registrar (al coste), Namecheap o Dondominio (.es) | ~10-12 €/año |
| 3 | **Gestor de contraseñas** | Guardar credenciales + 2FA | Bitwarden (gratis) | Gratis |
| 4 | **Figma** | Logo, wordmark, branding | Cuenta con el Gmail dueño | Gratis (Starter) |
| 5 | **GitHub (organización)** | Alojar el código | Org **`gluppohq`** → mover este repo | Gratis |

---

## 2. Fase 1 — Desarrollo e infraestructura (para el MVP)

| # | Servicio | Para qué | Plan al empezar | Coste aprox. |
|---|----------|----------|-----------------|--------------|
| 6 | **Supabase** | **Base de datos completa**: PostgreSQL + Auth + Realtime + Storage | Free → Pro | 0 → ~25 $/mes |
| 7 | **PowerSync** | Sincronización offline‑first (SQLite local ↔ Supabase) | Free (dev) → de pago | 0 → ~49 $/mes |
| 8 | **Vercel** | Desplegar la web Next.js (TPV, kiosko, pantallas) | Hobby → Pro | 0 → 20 $/mes |
| 9 | **Fly.io** o **Render** | Mini‑servicio fiscal (VERIFACTU + envío AEAT) en Node | Básico | ~5-10 $/mes |
| 10 | **Sentry** | Monitorización de errores (web/app/api) | Developer (free) | 0 → ~26 $/mes |
| 11 | **npm** (organización) | Publicar/instalar paquetes `@gluppo/*` (opcional) | Free (públicos) | Gratis |

> Alternativa: el mini‑servicio fiscal puede ser una **Edge Function de Supabase** en vez de Fly.io/Render (un proveedor menos). Ver [supabase/README](../supabase/README.md).

---

## 3. Fase 2 — Cobros, empresa y fiscalidad (antes de facturar de verdad)

| # | Servicio | Para qué | Notas | Coste |
|---|----------|----------|-------|-------|
| 12 | **Empresa (SL) o alta de autónomo** | Tener **CIF/NIF**: imprescindible para facturar y **firmar la declaración responsable** como fabricante del software | Vía gestoría | Constitución SL ~300-600 € + notaría |
| 13 | **Certificado electrónico (FNMT)** | Enviar registros **VERIFACTU a la AEAT** (mTLS) y trámites | Certificado de **representante de persona jurídica** | ~14 € + emisión |
| 14 | **AEAT — declaración responsable del software** | Cumplir como **fabricante** (obligatorio desde 29‑jul‑2025) | Ver [docs/07 §3.5](07-facturacion-y-cumplimiento-legal.md) | Gratis (trámite) |
| 15 | **Asesoría / gestoría fiscal** | Validar VERIFACTU/IGIC, llevar la empresa | Local (Canarias/Andalucía) | ~50-150 €/mes |
| 16 | **Stripe** | Cobros con tarjeta + **Stripe Connect** (modelo plataforma) | Necesita datos de empresa + cuenta bancaria | Sin cuota; comisión por transacción (ver [docs/08](08-pasarelas-de-pago.md)) |
| 17 | **Cuenta bancaria de empresa** | Recibir ingresos del SaaS y de Stripe | Banco o neobanco (Qonto, Rev. Business) | 0-15 €/mes |
| 18 | **Redsys (vía banco)** | TPV virtual + **Bizum** (para clientes que usen su banco) | Se contrata con el banco | Por contrato |
| 19 | **Marca "Gluppo" (OEPM)** | Registrar la marca en España (clases 9 y 42) | Recomendable antes de lanzar | ~150 € (1 clase) |

---

## 4. Fase 3 — Lanzamiento (apps, soporte y marketing)

| # | Servicio | Para qué | Coste |
|---|----------|----------|-------|
| 20 | **Apple Developer Program** | Publicar la **comandera iOS** | **99 $/año** (org requiere D‑U‑N‑S) |
| 21 | **Google Play Console** | Publicar la **comandera Android** | **25 $** (pago único) |
| 22 | **WhatsApp Business** | Soporte directo al hostelero | Gratis (API tiene coste) |
| 23 | **Instagram / TikTok / LinkedIn / X / YouTube** | Marca y captación | Handle `gluppohq` en todas | Gratis |
| 24 | **Google Business Profile** | Aparecer en Google/Maps | Gratis |
| 25 | **Brevo** o **Mailchimp** | Email marketing / newsletter | Free → de pago |
| 26 | **Plausible** o **GA4** | Analítica web | GA4 gratis / Plausible ~9 €/mes |
| 27 | **Crisp / Tawk.to** (opcional) | Chat de soporte en la web | Free → de pago |

---

## 5. Resumen de prioridad y coste de arranque

| Fase | Qué montar | Coste inicial aprox. |
|------|-----------|----------------------|
| **0 — Identidad** | Gmail, dominio, GitHub, Figma, gestor de contraseñas | **~12 €** (solo el dominio) |
| **1 — Desarrollo** | Supabase, PowerSync, Vercel, Fly/Render, Sentry | **~0-60 €/mes** (free tiers al principio) |
| **2 — Cobros/legal** | Empresa+CIF, FNMT, Stripe, banco, asesoría, marca | **~500-1.000 € inicial** + ~50-150 €/mes |
| **3 — Lanzamiento** | Apple 99 $/año, Google 25 $, redes, soporte | **~150 €** + redes gratis |

> **Para empezar a programar mañana** solo necesitas la **Fase 0** + **Supabase** (gratis). El resto se va activando según el [roadmap](13-roadmap-mvp-y-equipo.md).

---

## 6. Checklist rápida (marca según vayas creando)

**Fase 0**
- [ ] Gmail `gluppohq@gmail.com` (correo dueño) + 2FA
- [ ] Registrar `gluppo.com` (+ `gluppo.es` opcional)
- [ ] Bitwarden (gestor de contraseñas)
- [ ] Figma
- [ ] GitHub org `gluppohq` + mover el repo

**Fase 1**
- [ ] Supabase (proyecto `gluppo`)
- [ ] PowerSync
- [ ] Vercel (deploy web)
- [ ] Fly.io/Render o Edge Function (servicio fiscal)
- [ ] Sentry

**Fase 2**
- [ ] Empresa (SL) / autónomo → CIF
- [ ] Certificado FNMT
- [ ] Declaración responsable AEAT
- [ ] Asesoría fiscal
- [ ] Stripe + cuenta bancaria
- [ ] Registro de marca OEPM

**Fase 3**
- [ ] Apple Developer + Google Play Console
- [ ] WhatsApp Business
- [ ] Redes sociales `gluppohq`
- [ ] Google Business + analítica

---

### Notas de seguridad
- **Un solo correo dueño** (`gluppohq@gmail.com`) registra todo; los demás (soporte, facturación) se añaden después con Workspace.
- **2FA en todo** y copias de seguridad del **certificado FNMT** (es la llave de la AEAT — no lo pierdas).
- Nunca subir credenciales al repo: usar `.env` (ya en `.gitignore`) y los *secrets* de Vercel/Supabase/GitHub Actions.

> Disponibilidad comprobada a junio 2026: `gluppo.com` libre; `gluppo` ocupado en GitHub (usar `gluppohq`/`gluppoapp`). Reconfirmar antes de registrar.
