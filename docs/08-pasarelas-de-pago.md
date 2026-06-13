# 08 — Pasarelas de pago

> Cómo cobra el TPV: qué pasarelas integramos, en qué orden, con qué comisiones, y cómo montamos el modelo «plataforma» (cobrar a través de nosotros) sin convertirnos en entidad de pago. Datos España 2025‑2026.

---

## 1. Resumen y recomendación

Para un TPV nuevo que quiere **escalar** en España, el escenario realista es **multi‑pasarela**:

- **Stripe** = núcleo del producto (mejor API/SDK, Terminal, Tap to Pay, QR, **Connect** para el modelo plataforma). **Integrar primero.**
- **Redsys** = estándar bancario español, comisión mínima cuando el bar usa el datáfono de su banco, vía nativa de **Bizum**. **Integrar en paralelo** para el cliente que ya tiene banco.
- **Adyen** = destino a gran escala (Interchange++ imbatible con volumen). **Fase posterior.**
- **SumUp/Zettle/Square** = puerta barata para micro‑bares; integración limitada. **Opcional/nicho.**

> **Recomendación corta:** **Stripe (Terminal + Tap to Pay + Connect + QR)** como columna vertebral + **Redsys (TPV virtual + Bizum + datáfono TPV‑PC)** para comisión mínima y confianza local. Adyen cuando haya volumen.

---

## 2. Tabla comparativa de comisiones y costes

> Presencial = *card‑present* (CP); online = *card‑not‑present* (CNP). EEE = Espacio Económico Europeo. Cifras orientativas 2025‑2026.

| Plataforma | Comisión presencial | Comisión online | Hardware | Cuota | Modelo |
|-----------|---------------------|-----------------|----------|-------|--------|
| **Redsys (vía banco)** | **0,30–0,90 %** (a veces +0,03‑0,06 €) | Mismo rango | Alquiler del banco | 10–60 €/mes | Tasa de descuento negociable |
| **Bizum (vía Redsys)** | **0,37 %** (pequeño) – ~0,92 % (hostelería) | Igual | Usa datáfono/QR | Incluido | Por operación |
| **Stripe (online)** | — | **1,5 % + 0,25 €** (EEE) | — | 0 € | Tarifa plana |
| **Stripe Terminal** | **1,4 % + 0,10 €** (EEE) | — | S700 259 € · WisePOS E 199 € · WisePad 3 59 € | 0 € | Tarifa plana |
| **Stripe Tap to Pay** | **1,4 % + 0,10 € + 0,10 €**/autoriz. | — | **0 €** (móvil) | 0 € | Tarifa plana |
| **Stripe Connect** | (se suma) | — | — | **2 €/mes por cuenta activa** + 0,25 %+0,10 € por transferencia + 1 % Instant Payout | Coste plataforma |
| **Adyen (Interchange++)** | Interchange + esquema + **~0,60 % markup + 0,13 €** (≈0,9‑1,2 % débito EU) | Igual | Terminales propios | Sin alta, **factura mínima** | Interchange++ |
| **SumUp** | **1,49 %** (gratis) · **0,75 %** (Plus 19 €/mes) | 1,95 % | Solo Lite 34 € · Air 39 € · Solo 79 € · Terminal 169 € | 0 / 19 €/mes | Tarifa plana |
| **Zettle (PayPal)** | **1,49 %** (baja con volumen) | Variable | Reader desde 29 € · Terminal 199 € | 0 € | Tarifa plana |
| **Square** | **1,25 % + 0,05 €** (muy bajo) | 1,4 %+0,25 € (EU) | Reader 19 € · Terminal 165 € | 0 € | Tarifa plana |
| **Apple/Google Pay** | **Sin comisión propia** (se cobra como tarjeta de la pasarela subyacente) | Igual | NFC del datáfono o Tap to Pay | 0 € | — |

**Lecturas clave:**
- **Redsys vía banco** = lo más barato por operación (puede bajar de 0,5 %), pero alta lenta y cuota fija.
- **Stripe Terminal (1,4 %+0,10 €)** = más barato que Stripe online y mucho más fácil de integrar que Redsys.
- **Square presencial (1,25 %+0,05 €)** = el más barato de los «plug & play».
- **Adyen** solo gana cuando el volumen hace que su markup ~0,60 % supere al *blended* de Stripe (~1,4‑1,5 %).

---

## 3. Detalle por plataforma

### 3.1 Redsys (estándar bancario español)
Procesa >70 % de los pagos con tarjeta online en España. No es la «entidad» que cobra: el bar contrata el TPV con **su banco**; Redsys es el conmutador técnico.

**Integraciones:**
- **TPV Virtual** (e‑commerce/cobros a distancia): Redirección, **inSite** (formulario embebido, sin tocar el PAN), **InApp/SDK**, **módulos de pago** (incluyen Bizum). Soporta 3D Secure (SCA), Bizum, Apple/Google Pay.
- **Datáfono físico (TPV‑PC):** modo **semiintegrado** — nuestro software envía el importe al pin‑pad mediante una **librería .dll certificada de Redsys**; el datáfono cobra y devuelve el resultado. **Esta es la integración a usar** (el camarero no reteclea importes; conciliación exacta). El datáfono lo provee el banco.

**Comisiones por banco (orientativas, negociables):** Bankinter desde 0,30 % · Santander desde 0,35 % · BBVA desde 0,40 % · Sabadell 0,40 %+0,06 € · CaixaBank desde 0,45 %; cuotas 10‑15 €/mes.

**Pros:** comisión mínima a volumen, confianza total del hostelero, vía nativa de Bizum. **Cons:** alta lenta/burocrática, DX anticuada (DLLs, no API REST), un contrato por banco, difícil como plataforma.

### 3.2 Stripe
- **Terminal (datáfonos):** WisePOS E (199 €), Reader S700 (259 €), WisePad 3 (59 €). **1,4 %+0,10 €** EEE. SDK JS/RN/iOS/Android.
- **Tap to Pay (sin hardware):** **disponible en España desde junio 2025**. iPhone XS+; Android NFC certificado. Coste = Terminal +0,10 €. Ideal terrazas/food trucks.
- **QR / Payment Links / Checkout:** para pago en mesa con división y propina.
- **Connect:** modelo plataforma (ver §5).
- Apple/Google Pay nativos, **Bizum** como método local, **SCA/3DS dinámico** y PCI muy resueltos.

**Pros:** mejor DX del mercado (API REST, SDKs, webhooks, sandbox); todo en un proveedor; SCA/PCI resueltos. **Cons:** más caro por transacción que el banco; online sube para tarjetas no‑EEE (turistas).

### 3.3 Adyen
- **Interchange++**: coste real + **~0,60 % markup + 0,13 €** (≈0,9‑1,2 % débito EU). **Terminal API** (REST) con **propinas** nativas, NFC, QR. **Adyen for Platforms** para marketplace.
- **Pros:** el más barato a escala, transparente, global, ideal cadenas. **Cons:** no es para empezar (mínimos, proceso comercial), integración pesada.

### 3.4 SumUp / Zettle / Square (micro‑bares)
Alta inmediata sin banco, hardware barato, sin cuota, liquidación al día siguiente. **SumUp** ya incluye **Verifactu/TicketBAI**. **Square** tiene la mejor API de los tres para integrar en software de terceros. **Cons:** comisión plana más alta a volumen, **integración limitada** (pensados para su propia app).

### 3.5 Bizum
- 25 M de usuarios, límite ~1.000 €/operación. Se cobra (a) **presencial vía TPV Android del banco** (cliente da móvil o escanea QR) o (b) **TPV Virtual (Redsys)** a distancia.
- Comisiones: **0,37 %** (pequeño comercio) a ~0,92 % (hostelería); algunos bancos +0,10‑0,15 €.
- No se integra «directo»: se habilita **a través de Redsys** o del TPV Android del banco. **Imprescindible** para clientela local española.

### 3.6 Apple Pay / Google Pay
Sin comisión propia (se liquidan como tarjeta de la pasarela subyacente). Soporte: NFC en datáfono, **Tap to Pay** (sin hardware), o checkout web/app. En web requieren **registrar dominio** (Apple Pay) y SCA; con Stripe casi automático.

---

## 4. PSD2 / SCA — qué implica

**SCA (Autenticación Reforzada):** los pagos exigen **2 de 3 factores** (saber/tener/ser).
- **Presencial:** chip+PIN o contactless ya cumplen; el contactless pide PIN al superar límites acumulados.
- **Online/CNP:** **3D Secure 2** (la app del banco puede pedir confirmación). La pasarela (Redsys/Stripe) lo gestiona.
- **Exenciones** que reducen fricción: importes bajos (<30 €), recurrentes/MIT, TRA. Stripe/Redsys las aplican automáticamente.

**Quién es «entidad de pago»:** PSD2 distingue **mover dinero ajeno** (actividad regulada, exige licencia) de **facilitar tecnología**. Es el punto crítico del modelo plataforma (§5).

**PSD3 (≈2027):** endurece la «exención de agente comercial»: las plataformas que actúan por cuenta de comprador y vendedor a la vez tendrán casi imposible evitar la licencia, **salvo operar sobre un proveedor licenciado** (Stripe/Adyen). → Refuerza usar Connect/Adyen for Platforms.

**Conclusión:** si usamos Stripe/Adyen/Redsys como procesador, **ellos asumen SCA y licencia**. Nuestro trabajo: (a) 3DS en cobros online, (b) **no almacenar PAN** (tokenización/SDK → alcance PCI reducido a SAQ‑A), (c) **no custodiar el dinero de los bares** si no queremos ser entidad de pago.

---

## 5. Modelo plataforma / marketplace (cobrar a través de nosotros)

| Opción | Cómo funciona | Quién asume la licencia | Coste |
|--------|---------------|-------------------------|-------|
| **Stripe Connect** ✅ (empezar) | Cada bar = *connected account*; Stripe hace el KYC/onboarding; cobramos **application fees** por transacción. Modos: Standard / **Express** (onboarding ligero) / Custom | **Stripe** (NO somos entidad de pago) | 2 €/mes por cuenta activa + 0,25 %+0,10 € por transferencia |
| **Adyen for Platforms** | Equivalente a escala: sub‑comercios, split payments, Interchange++ | Adyen | Por contrato |
| **Agregador propio** ❌ | Comercio «paraguas» que reparte | **Nosotros** (probable licencia de **entidad de pago** ante Banco de España) | Alto coste regulatorio/capital |
| **Referido** | Cada bar contrata su Redsys con su banco | El banco | 0 €, pero no monetizamos el flujo |

**Implicaciones:**
- Con **Connect / Adyen for Platforms**, el procesador es la entidad regulada y asume SCA, AML/KYC y custodia → **no necesitamos ser entidad de pago**. **Vía recomendada.**
- Si **tocamos el dinero** (entra en nuestra cuenta y lo repartimos), entramos en terreno de **entidad de pago** (licencia, capital, auditorías). **Evitar.**
- Cobrar nuestra comisión: **`application_fee_amount`** (Stripe) o **split payments** (Adyen). Limpio y legal.
- **Alta exprés:** Stripe Connect **Express** da onboarding hosteado (el bar mete sus datos, KYC incluido) en minutos, frente a semanas del alta bancaria tradicional. **Gran argumento de venta frente a Redsys.**

---

## 6. Flujos técnicos

### 6.1 Datáfono integrado — Redsys TPV‑PC (semiintegrado)
```
1. Camarero pulsa "Cobrar con tarjeta" (importe del ticket).
2. El software llama a la DLL certificada Redsys (TPV-PC) con importe + id operación.
3. La DLL envía el importe al pin-pad (USB/IP).
4. Cliente inserta/acerca tarjeta o móvil → PIN/contactless (SCA).
5. Datáfono → Redsys → banco emisor → autorización.
6. Respuesta (aprobado/denegado) vuelve por la DLL.
7. El TPV marca cobrado, imprime recibo y concilia automáticamente.
```

### 6.2 Datáfono integrado — Stripe Terminal (API)
```
1. Backend pide connection_token → SDK (nunca hardcodear).
2. SDK descubre/conecta el lector (WisePOS E / Tap to Pay).
3. Backend crea PaymentIntent (importe, moneda, capture_method).
4. SDK lo entrega al lector (process_payment_intent).
5. Cliente acerca tarjeta/móvil → SCA en el lector.
6. Captura (manual si hay propina/ajuste).
7. Webhook payment_intent.succeeded → mesa pagada.
```

### 6.3 Pago QR en mesa (pay‑at‑table)
```
1. El TPV genera, por mesa/ticket, enlace + QR (Stripe Payment Link / Redsys TPV Virtual).
2. El QR se imprime en el ticket o se muestra en la mesa.
3. El cliente lo escanea (sin app) → ve la cuenta detallada.
4. Divide la cuenta (importe/comensal/productos) y elige propina.
5. Paga con tarjeta / Apple Pay / Google Pay / Bizum (SCA por 3DS/biometría).
6. Webhook de la pasarela → el TPV marca la mesa cobrada en tiempo real.
```

**Proveedores de referencia en España (competencia/partnership):** TheFork (pago en mesa QR), Honei, CoverManager (CoverAtTable), Loomis Pay, Sipay. Comisión típica en estos flujos: 0,9‑1,5 %.

**Beneficios medidos del pay‑at‑table:** cobro de 8‑12 min → 1‑3 min; **+8‑15 % en propinas**; **+10‑20 % de rotación** en horas punta.

---

## 7. Plan de integración por fases

| Fase | Integrar | Por qué |
|------|----------|---------|
| **1 — MVP** | **Stripe**: Terminal + Tap to Pay + Payment Links/QR + **Connect (Express)** | Una sola API cubre datáfono, móvil, QR, online, wallets, SCA y modelo plataforma sin ser entidad de pago. *Time‑to‑market.* |
| **2 — Mercado ES** | **Redsys**: TPV Virtual + **Bizum** + datáfono TPV‑PC | Estándar de confianza, comisión mínima, Bizum imprescindible |
| **3 — Escala** | **Adyen** (Terminal API + for Platforms) | Interchange++ reduce coste *blended* con volumen |
| **Opcional** | SumUp/Square | Solo si hay muchos micro‑bares que ya los usan |

**Por qué Stripe primero y no Redsys:** Redsys da la comisión más baja pero su integración (DLLs, contratos banco a banco, onboarding lento) frena el *time‑to‑market* y **no resuelve el modelo plataforma**. Stripe permite lanzar en semanas, monetizar el pago con Connect y dar de alta bares en minutos; Redsys se añade después como «modo ahorro».

---

## 8. Fuentes

Redsys: pagosonline.redsys.es (TPV Virtual, inApp, módulos, Bizum) · pagosrecurrentes.com (comisiones por banco) · rankiabusiness.com · sysme.net / qfgest.net (TPV‑PC). Stripe: stripe.com/es/pricing · docs.stripe.com (Terminal, Tap to Pay, Connect, collect‑card‑payment) · adslzone.net. Adyen: adyen.com/pricing · docs.adyen.com (Terminal API, tipping) · expertsure.com · finexer.com. SumUp/Zettle/Square: sincomisiones.org · mobiletransaction.org · zettle.com · paypal.com. Bizum: autonomosyemprendedor.es · dinaweb.net. Pago en mesa: thefork (revistahosteleria.com) · etersystem.es · honei.app · covermanager.com · sipos.ai · loomispay.com. PSD2/PSD3: stripe.com/guides · ryftpay.com. Tap to Pay España: applesfera.com · xataka.com · globalpayments.es.

> Comisiones bancarias Redsys **negociables** según volumen/ticket/sector. Reconfirmar antes de decisiones contractuales.
