# 11 — Modelo de negocio y precios

> Cómo ganamos dinero y cómo lo cobramos. Estrategia de precios **transparente y sin permanencia** (lo contrario al mercado), planes, *unit economics* y go‑to‑market. Se apoya en la investigación de mercado ([01](01-investigacion-mercado.md)) y el posicionamiento ([02](02-vision-y-posicionamiento.md)).

---

## 1. Cómo gana dinero el sector (lo que aprendimos)

> Del análisis de competidores ([01](01-investigacion-mercado.md)): **el negocio real no es la cuota de software, sino la comisión por pago** (1,25 %–3,69 %). Casi todos obligan a su pasarela y subvencionan el software «gratis» con comisiones más altas.

Tres modelos de ingreso en el mercado:
1. **Suscripción SaaS** (cuota mensual por local/terminal) — Glop, Revo, Last.app.
2. **Comisión por pago** (procesamiento) — Toast, Square, SpotOn (su mayor fuente).
3. **Licencia perpetua** (pago único) — Sysme, Glop (opción), Hosteltáctil.

**Nuestra decisión:** **modelo híbrido transparente** = suscripción modesta + **comisión de pago opcional** (solo si usan nuestra pasarela Stripe/Connect) + servicios de valor añadido. Sin permanencia, sin alta, precios públicos.

---

## 2. Principios de pricing

| Principio | Por qué (qué dolor del mercado ataca) |
|-----------|----------------------------------------|
| **Precios públicos** | Medio mercado oculta tarifas («consultar precio») → desconfianza |
| **Sin permanencia (mes a mes)** | Contratos de 2‑4 años y ETF de hasta 28.000 $ son la queja más grave |
| **Sin coste de alta** | Last.app cobra 500 € de alta; nosotros 0 € |
| **Freemium real** | Reduce fricción del micro‑bar (como Miss Tipsi/Square) |
| **Pasarela negociable** | No obligamos a nuestra pasarela; el bar puede usar su Redsys |
| **Hardware no incluido/obligatorio** | El cliente reutiliza su equipo (no vendemos jaulas) |

---

## 3. Planes (propuesta inicial)

> Precios orientativos a validar en el piloto. Por **local**, IVA/IGIC no incluido.

| Plan | Precio | Pasarela | Para quién | Incluye |
|------|--------|----------|-----------|---------|
| **Free / Básico** | **0 €/mes** | Solo nuestra pasarela (comisión) | Micro‑bar, food truck, autónomo | TPV básico, tickets Verifactu, 1 dispositivo, carta, cobro |
| **Pro** | **39–49 €/mes** | Propia o externa | Bar/restaurante independiente | + Mesas/salas, comandera, KDS, división de cuenta, informes, dispositivos ilimitados |
| **Avanzado** | **79–99 €/mes** | Propia o externa | Restaurante grande, multi‑zona, delivery | + Multi‑zona, delivery (Deliverect), escandallos/inventario, fidelización, API |
| **Cadena** | **a medida** | Negociable | Grupos / multi‑local | + Multi‑local consolidado, roles de grupo, soporte prioritario, SSO |

**Add‑ons opcionales** (transparentes, no obligatorios): módulo **TicketBAI** (País Vasco), **factura electrónica B2B**, **reservas avanzadas**, **analítica/IA**, soporte premium 24/7.

**Comisión de pago (si usan nuestra pasarela):** competitiva y pública (basada en Stripe + nuestro *application fee*). El bar que prefiera su banco usa **Redsys** sin penalización (a diferencia de Lightspeed/Toast).

---

## 4. Por qué este modelo gana

| Competidor | Su debilidad de pricing | Nuestra ventaja |
|-----------|--------------------------|------------------|
| Toast | Contrato 2‑3 años, ETF, lock‑in total | Sin permanencia, pasarela negociable |
| Square | Sube tarifas, retiene fondos | Liquidación predecible, transparencia |
| Clover/Revel | 36‑48 meses, ETF de miles | Mes a mes |
| Last.app | Alta de 500 € | Alta 0 € |
| ICG/Numier/Cuiner | «Consultar precio» | Precios públicos |
| Storyous | «Gratis» y luego cuota oculta | Freemium honesto, sin sorpresas |

---

## 5. Unit economics (modelo orientativo)

> Cifras de trabajo para validar; no son una proyección financiera cerrada.

**Ingresos por cliente (ARPU)** — restaurante Pro típico:
- Suscripción: ~45 €/mes.
- Comisión de pago (si usa nuestra pasarela): con ~30.000 €/mes de facturación y un *application fee* de ~0,3‑0,5 %, ~90‑150 €/mes adicionales.
- **ARPU potencial: ~45 € (solo SaaS) a ~135‑195 €/mes (SaaS + pagos).**

**Costes por cliente (orientativo):**
- Infraestructura (Supabase + Fly.io + PowerSync prorrateado): ~5‑15 €/mes por local activo a escala.
- Soporte: variable; clave mantenerlo eficiente con buen onboarding autoservicio.
- Coste de pago (lo asume Stripe; nuestro margen es el *application fee* sobre su comisión).

**Objetivos de salud:**
- **LTV/CAC > 3**, payback **< 12 meses**.
- **Churn < 5 %/mes** (el soporte y la fiabilidad offline son la palanca de retención).

---

## 6. Estrategia go‑to‑market

### 6.1 La ola Verifactu (timing)
**2026‑2027 todo el mercado cambia de TPV** (obligación Verifactu). Mensaje central:
> «Cambia tu TPV antes de que sea obligatorio. Sin permanencia, sin sorpresas, y funciona aunque se caiga internet.»

### 6.2 Fases
1. **Piloto (5‑10 locales)** en La Palma/Granada: validar offline, IGIC, soporte real, y conseguir casos de éxito/testimonios.
2. **Lanzamiento regional** (Canarias + Andalucía): freemium + boca a boca + soporte excelente.
3. **Expansión nacional** (territorio común) y luego **País Vasco** (módulo TicketBAI).
4. **UE** (Francia NF525, Alemania KassenSichV) en fase de escala.

### 6.3 Canales
- **Boca a boca entre hosteleros** (motor principal — se recomiendan entre dueños).
- **Partners locales** (instaladores, distribuidores de hardware, asesorías/gestorías que recomiendan software conforme).
- **Marketing de contenido** sobre Verifactu/IGIC (posicionarnos como los expertos honestos).
- **Freemium** como motor de adquisición (entra gratis, sube cuando crece).

### 6.4 Retención
- **Soporte humano en español** en horario de hostelería = el mayor diferenciador de retención.
- **Fiabilidad offline** = no perder al cliente por una caída en hora punta.
- **Onboarding autoservicio < 1 hora** = baja el coste de adquisición y la fricción.

---

## 7. Riesgos del modelo y mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Freemium canibaliza ingresos | Limitar funciones del Free (1 dispositivo, sin multi‑zona); monetizar vía pago |
| Dependencia de comisión de pago | Mantener SaaS rentable por sí solo; pago como *upside* |
| Guerra de precios con nacionales baratos (Glop 19,90 €) | Competir en **valor** (offline + multiplataforma + soporte + compliance), no solo en precio |
| Coste de soporte alto | Onboarding autoservicio, base de conocimiento, IA de soporte de primer nivel |
| CAC alto en mercado saturado | Aprovechar la ola Verifactu y el boca a boca del nicho inicial |

---

## 8. Resumen

- **Modelo:** SaaS transparente (suscripción) + comisión de pago opcional + add‑ons.
- **Diferencia:** **sin permanencia, sin alta, precios públicos, pasarela negociable, hardware libre.**
- **Planes:** Free / Pro (39‑49 €) / Avanzado (79‑99 €) / Cadena (a medida).
- **Timing:** aprovechar la **ola de renovación Verifactu 2026‑2027**.
- **Salud:** LTV/CAC > 3, churn < 5 %, retención por **soporte + offline**.

> Validar todos los números en el **piloto** antes de fijar el pricing definitivo. Ver **[13 — Roadmap](13-roadmap-mvp-y-equipo.md)**.
