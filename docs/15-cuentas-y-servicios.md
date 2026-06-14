# 15 — Cuentas y servicios (Gluuh TPV)

> **Gluuh** es la marca paraguas y **ya la tienes** (dominio, correo, redes). Este documento separa lo que **reutilizas de Gluuh** de lo que hay que **crear nuevo para Gluuh TPV**, por fases y con coste. Junio 2026.

---

## 0. Marca: reutilizamos Gluuh

- **Gluuh** = marca paraguas (ya registrada). Productos de la familia:
  - **Gluuh Campo** — análisis de facturas del campo (existente).
  - **Gluuh TPV** — este proyecto (TPV de hostelería).
- **Dominio del TPV:** subdominio **`tpv.gluuh.com`** (o `app.gluuh.com`). **No hace falta comprar dominio nuevo** — usas el que ya tienes.
- **Correo:** reutiliza los de Gluuh (`hola@gluuh.com`); crea `soporte@gluuh.com` si aún no existe.
- **Código:** scope `@gluuh/*`, identificadores `com.gluuh.tpv` / `com.gluuh.comandera`.

---

## 1. Lo que YA tienes (reutilizar, no crear) ✅

| Elemento | Estado |
|----------|--------|
| Dominio `gluuh.com` | ✅ Tuyo (añadir subdominio `tpv.gluuh.com`) |
| Correo de marca (`@gluuh.com`) | ✅ Tienes |
| Redes sociales de Gluuh | ✅ Tienes (añadir contenido de la línea TPV) |
| **Supabase (proyecto)** | ✅ **Creado** (`cvbihijgrpxtswhgovld`) — solo falta aplicar el esquema |
| Empresa / CIF (si Gluuh ya factura) | ♻️ Reutilizar el mismo CIF y cuenta bancaria |
| Gestor de contraseñas | ♻️ Si no lo usas, Bitwarden (gratis) |

---

## 2. A crear/activar para Gluuh TPV

### Fase 0 — repo y dominio (casi inmediato)
| Servicio | Acción | Coste |
|----------|--------|-------|
| **GitHub** | Repo **`gluuh-tpv`** en tu cuenta/organización de Gluuh; subir el código | Gratis |
| **DNS** | Crear subdominio **`tpv.gluuh.com`** (apuntará a Vercel) | Incluido en el dominio |

### Fase 1 — desarrollo e infraestructura (MVP)
| Servicio | Para qué | Coste |
|----------|----------|-------|
| **Supabase** | BD + Auth + Realtime + Storage | ✅ creado · Free → ~25 $/mes |
| **PowerSync** | Sincronización offline‑first | Free (dev) → ~49 $/mes |
| **Vercel** | Desplegar la web (TPV, kiosko, pantallas) en `tpv.gluuh.com` | Hobby → 20 $/mes |
| **Fly.io / Render** o **Edge Function** | Mini‑servicio fiscal (VERIFACTU + AEAT) | ~0-10 $/mes |
| **Sentry** | Errores en web/app/api | Free → ~26 $/mes |

### Fase 2 — cobros y fiscalidad
| Servicio | Para qué | Coste |
|----------|----------|-------|
| **Empresa / CIF** | Facturar y firmar la declaración responsable. **Si Gluuh ya es tu empresa, reutiliza el CIF**; si no, alta de SL/autónomo | 0 (reutilizar) o ~300-600 € |
| **Certificado FNMT** | Enviar VERIFACTU a la AEAT (mTLS). Reutiliza el de tu empresa si lo tienes | ~14 € |
| **AEAT — declaración responsable** | Como fabricante del SIF «Gluuh TPV» (ver [docs/07 §3.5](07-facturacion-y-cumplimiento-legal.md)) | Gratis |
| **Stripe** | Cobros + Stripe Connect (plataforma). A nombre de la empresa Gluuh | Comisión por transacción ([docs/08](08-pasarelas-de-pago.md)) |
| **Cuenta bancaria** | Recibir ingresos. Reutiliza la de Gluuh | 0 (reutilizar) |
| **Redsys (vía banco)** | TPV virtual + Bizum (para clientes con su banco) | Por contrato |
| **Marca «Gluuh» (OEPM)** | Si la marca no está registrada en OEPM, hacerlo en clases **9 y 42** (cubre Campo y TPV) | ~150 € |

### Fase 3 — lanzamiento (apps y soporte)
| Servicio | Para qué | Coste |
|----------|----------|-------|
| **Apple Developer** | Comandera iOS (cuenta de empresa Gluuh, requiere D‑U‑N‑S) | 99 $/año |
| **Google Play Console** | Comandera Android | 25 $ (único) |
| **WhatsApp Business** | Soporte al hostelero | Gratis |
| **Google Business + analítica** | Visibilidad + métricas (GA4/Plausible) | Gratis / ~9 €/mes |

---

## 3. Resumen de coste de arranque

| Fase | Qué | Coste extra (ya tienes Gluuh) |
|------|-----|-------------------------------|
| 0 — repo/dominio | GitHub + subdominio | **0 €** |
| 1 — desarrollo | Supabase/PowerSync/Vercel/Sentry | **0-60 €/mes** (free tiers) |
| 2 — cobros/legal | FNMT, Stripe, (CIF/marca si faltan) | **~14-150 €** (mucho reutilizable) |
| 3 — lanzamiento | Apple 99 $/año + Google 25 $ | **~150 €** |

> **Ventaja de usar Gluuh:** te ahorras dominio, correo, redes y (si Gluuh ya es empresa) CIF, banco y certificado. Para arrancar el MVP basta con **GitHub + subdominio + Supabase** (ya creado).

---

## 4. Checklist

**Fase 0**
- [ ] Repo `gluuh-tpv` en GitHub (cuenta/org Gluuh)
- [ ] Subdominio `tpv.gluuh.com`

**Fase 1**
- [x] Supabase (proyecto creado) — falta aplicar `supabase/migrations/0001_init.sql`
- [ ] PowerSync
- [ ] Vercel (deploy en `tpv.gluuh.com`)
- [ ] Servicio fiscal (Fly/Render o Edge Function)
- [ ] Sentry

**Fase 2**
- [ ] CIF (reutilizar Gluuh o alta)
- [ ] Certificado FNMT
- [ ] Declaración responsable AEAT
- [ ] Stripe + banco
- [ ] Marca OEPM (clases 9 y 42) si falta

**Fase 3**
- [ ] Apple Developer + Google Play
- [ ] WhatsApp Business + Google Business + analítica

---

### Notas de seguridad
- **2FA** en todas las cuentas; **certificado FNMT** guardado a buen recaudo (es la llave de la AEAT).
- Credenciales reales en `.env` / `.env.local` (ya en `.gitignore`) y en los *secrets* de Vercel/Supabase/GitHub Actions. **Nunca en el repo.**
- Contraseñas de cuentas (Gmail, GitHub, banco) → **gestor de contraseñas**, nunca en archivos del proyecto.

> Como **Gluuh ya es tuyo**, lo más urgente es crear el **repo en GitHub** y el **subdominio `tpv.gluuh.com`**; Supabase ya está. El resto se activa según el [roadmap](13-roadmap-mvp-y-equipo.md).
