# 07 — Facturación y cumplimiento legal

> El núcleo legal del producto y nuestro mayor diferenciador. Qué normativa de facturación **debe** cumplir un TPV de hostelería en España (2025‑2027), con detalle técnico para implementarlo. Atención especial a **Canarias/IGIC** (origen del proyecto en La Palma).

> ⚠️ **Aviso:** este documento es una guía técnica basada en fuentes oficiales (AEAT/BOE) a junio de 2026. **No sustituye asesoría legal/fiscal.** Antes de cerrar el desarrollo, reconfirmar los **esquemas XSD vigentes** en el portal de desarrolladores de la AEAT y validar con un asesor fiscal.

---

## 1. Resumen ejecutivo (lo crítico)

1. **Verifactu es la obligación nuclear** que debe cumplir nuestro TPV (RD 1007/2023 + Orden HAC/1177/2024).
2. **Como FABRICANTES de software, ya estamos obligados desde el 29‑jul‑2025.** No se aplazó. Vender software no conforme expone a multas de **hasta 150.000 €** por ejercicio y producto.
3. Las fechas de obligación para el **USUARIO** se aplazaron a **2027** (RD‑ley 15/2025): **1‑ene‑2027 sociedades**, **1‑jul‑2027 autónomos**. Esto crea la **ola de renovación** comercial.
4. **Canarias SÍ entra en Verifactu**, pero con **IGIC** en lugar de IVA. Nuestro TPV en La Palma genera registros Verifactu con desglose **IGIC**.
5. **TicketBAI** (País Vasco) es un sistema foral **distinto y ya vigente**: módulo aparte si vendemos allí.
6. La **factura electrónica B2B** (Ley Crea y Crece + RD 238/2026) es una obligación **adicional** con su propio calendario (pendiente de Orden). Mayormente afecta a B2B, no al ticket B2C de hostelería.

---

## 2. Calendario de obligaciones

| Obligación | Sujeto | Fecha | Estado |
|-----------|--------|-------|--------|
| **Verifactu – Fabricantes de software** | Productores/comercializadores | **29‑jul‑2025** | ✅ **VIGENTE — no aplazado** |
| **Verifactu – Usuarios sociedades** | Impuesto sobre Sociedades | **1‑ene‑2027** | Aplazado (RD‑ley 15/2025) |
| **Verifactu – Resto (autónomos)** | IRPF, CB, etc. | **1‑jul‑2027** | Aplazado |
| **TicketBAI – Álava** | Todos | Desde 1‑12‑2022 | ✅ Vigente |
| **TicketBAI – Gipuzkoa** | Todos | Completado 6/2023 | ✅ Vigente |
| **TicketBAI – Bizkaia (Batuz)** | Progresivo | 2024‑2026 | ✅ Vigente |
| **SII (IVA)** | Facturación > 6 M€ / REDEME | Desde 1‑7‑2017 | ✅ Vigente (excluye de Verifactu) |
| **Factura electrónica B2B – grandes** | Facturación > 8 M€ | 12 meses tras la Orden (pendiente) | Reglamento publicado, falta Orden |
| **Factura electrónica B2B – resto** | Resto | 24 meses tras la Orden | Pendiente |

> **Incertidumbre:** el calendario B2B depende de la **Orden de la solución pública**, no publicada a junio 2026. Las ventanas de 12/24 meses se cuentan desde ahí.

---

## 3. Verifactu en detalle

### 3.1 Quién está obligado (regla de los «4 NO»)
Empresarios/profesionales en España que emiten factura **y** que:
1. **usan** un software de facturación (no manual),
2. **NO** están en **SII**,
3. **NO** tienen domicilio fiscal en **País Vasco** ni **Navarra** (→ regímenes forales),
4. **NO** tienen resolución de exención.

> **Canarias, Ceuta y Melilla → INCLUIDAS.** En los registros, el IVA se sustituye por **IGIC** (Canarias) e **IPSI** (Ceuta/Melilla). *Directamente relevante para La Palma.*

### 3.2 Dos modalidades

| Aspecto | **Verifactu** (recomendada) | **No Verifactu** (offline reforzado) |
|---------|------------------------------|---------------------------------------|
| Envío a AEAT | **Sí**, cada registro en tiempo real | No (conservación local) |
| Firma electrónica | **No exigida** (integridad por envío + hash) | **Obligatoria** (XAdES) |
| Registro de eventos | Más ligero | **Completo y reforzado** |
| Leyenda en factura | **«VERI*FACTU»** + QR | QR sin la marca |
| Carga de cumplimiento | Menor | Mayor |

> **Recomendación:** implementar **modalidad Verifactu** (envío en tiempo real). Evita la firma XAdES y el registro de eventos reforzado, y reduce riesgo de inspección.

### 3.3 Contenido del registro de facturación de alta
Campos obligatorios (resumen): NIF y nombre del emisor; identificación del destinatario (cuando proceda); número y serie; fecha de expedición (y de operación); **tipo de factura** (F1 completa, F2 simplificada/ticket, R1‑R5 rectificativas…); descripción; **desglose de base, tipos y cuotas (IVA o IGIC)**, exenciones, inversión del sujeto pasivo; importe total; **encadenamiento** (datos del registro anterior + parte de su hash); **hash del registro actual**; **código del SIF** y datos del productor; **fecha‑hora‑minuto‑segundo + huso horario**. También existe el **registro de anulación**.

### 3.4 Flujo técnico (hash → QR → envío)

**Paso 1 — Hash (huella) SHA‑256.** Se concatenan campos clave en `nombre=valor` separados por `&`, en **este orden exacto**:

```
IDEmisorFactura=...&NumSerieFactura=...&FechaExpedicionFactura=...&TipoFactura=...&CuotaTotal=...&ImporteTotal=...&Huella=...&FechaHoraHusoGenRegistro=...
```

- `Huella=` = hash del **registro anterior** (sus primeros 64 caracteres); **vacío** en el primero.
- Codificar en **UTF‑8**, aplicar **SHA‑256**, salida en **hexadecimal de 64 caracteres en mayúsculas**.
- **Encadenamiento:** el hash de *N* incluye el de *N‑1* → cualquier alteración rompe la cadena (inalterabilidad/trazabilidad).

```
Ejemplo de cadena (AEAT):
IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00
→ SHA-256 → 3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60
```

**Paso 2 — Código QR.**
- Norma **ISO/IEC 18004:2015**, **corrección de errores nivel M**, tamaño impreso **30×30 a 40×40 mm**, al inicio de la factura.
- Contenido = **URL HTTPS** al servicio de cotejo de la AEAT con 4 parámetros: `nif`, `numserie`, `fecha` (**dd‑mm‑aaaa**), `importe` (decimal con **punto**).
- URLs del servicio «ValidarQR»:
  - Producción: `https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR`
  - Pruebas: `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR`
- **Leyenda obligatoria:** en modalidad Verifactu, imprimir **«VERI*FACTU»** junto al QR.

**Paso 3 — Envío a la AEAT** (modalidad Verifactu): web service **máquina a máquina con XML** contra la sede AEAT, conforme a los **XSD** oficiales; requiere **certificado electrónico** del obligado/representante. La AEAT responde aceptación/errores y conserva copia.

**Paso 4 — Registro de eventos:** anotar sucesos relevantes (arranque/parada, exportaciones, anomalías de integridad…) con las mismas garantías de inalterabilidad.

### 3.5 Obligaciones del fabricante (nosotros)
- **Declaración responsable** (art. 13 RD 1007/2023) por cada producto, certificando que cumple todo el Reglamento y la Orden. **Sin ella no se puede comercializar.**
- Cada SIF debe llevar **código de identificación** y constar el productor en los registros.
- Plazo del fabricante: **29‑jul‑2025** (ya vigente).

---

## 4. TicketBAI (País Vasco)

- Sistema **foral propio**, **ya obligatorio** en Álava, Gipuzkoa y Bizkaia (Batuz).
- Diferencias con Verifactu: **firma electrónica obligatoria** de cada factura (no hay modo «sin firma»), **esquemas XML y entornos de envío propios y distintos en cada territorio**, y en Bizkaia el **LROE** (modelo Batuz).
- **Conviven** según domicilio fiscal: foral → TicketBAI; común → Verifactu. No se solapan sobre el mismo sujeto.
- **Implicación de producto:** si vendemos en País Vasco, necesitamos un **módulo TicketBAI** con las tres variantes. Si el mercado es Canarias/común, **TicketBAI no aplica** (lo dejamos para fase de expansión).

---

## 5. SII (Suministro Inmediato de Información)
- Obligatorio solo para **facturación > 6 M€**, **REDEME** y grupos de IVA. Voluntario el resto.
- Remisión de los libros de IVA en **4 días naturales** (excl. fines de semana/festivos), antes del día 16 del mes siguiente.
- Los acogidos al SII **quedan excluidos de Verifactu**. Un bar/restaurante estándar **no estará en SII** salvo gran volumen → la obligación relevante es **Verifactu**.

---

## 6. Factura electrónica B2B (Crea y Crece + RD 238/2026)
- **Ley 18/2022** + **RD 238/2026** (BOE 31‑3‑2026): extiende la factura electrónica a **todas las relaciones B2B**.
- Arquitectura mixta: **plataformas privadas** + **solución pública** (AEAT, gratuita); quien no use la pública debe enviarle **copia fiel**.
- Formatos sobre **EN 16931**: **Facturae** (XML español), **UBL**, **CII**, **EDIFACT**.
- **Estados obligatorios** de cada factura (aceptación, rechazo, pago) en **4 días naturales**.
- Calendario: **12 meses** (>8 M€) / **24 meses** (resto) tras la Orden de la solución pública (pendiente).
- **Diferencia clave con Verifactu:**
  - Verifactu = control **antifraude** del *software* y registro de **todas** las facturas (B2B y **B2C**), con envío/QR.
  - Factura B2B = obligación de **emitir e intercambiar en formato estructurado** facturas **solo entre empresas** (no el ticket a consumidor), con foco en morosidad/estados.
  - **Son acumulativas:** una factura B2B deberá cumplir **ambas**.
- **Para hostelería:** la mayoría es **B2C** (ticket) → solo Verifactu. La parte B2B aparece al facturar a empresas (catering, comidas de empresa, proveedores). **Roadmap, no MVP.**

---

## 7. IVA (península/Baleares) e IGIC (Canarias)

### 7.1 Tipos en hostelería

| Operación | **IVA** (común) | **IGIC** (Canarias) |
|-----------|-----------------|---------------------|
| Tipo general | 21 % | **7 %** |
| **Servicio de restauración** (consumo en local) | **10 %** | **7 %** |
| Bebidas alcohólicas **dentro del servicio** | 10 % | 7 % |
| Bebidas alcohólicas **para llevar** (venta suelta) | 21 % | **15 %** (incrementado) |
| Refrescos azucarados/edulcorados | 21 % / 10 % en servicio | **5 %** (reducido) |
| Alimentación básica (pan, leche, huevos) venta directa | 4 % (superreducido) | **0 %** (tipo cero) |

> **Cambio en Canarias (desde 2025):** deja de aplicarse el 3 % a comida/bebida preparada para consumo **fuera** del local → pasa al **7 %**. Verificar para *take away*/delivery.

> **Vigilancia:** existe presión de la UE para subir el IVA de hostelería al 21 %; a junio 2026 sigue en **10 %**. El motor de impuestos debe permitir **cambiar de tipo sin reprogramar**.

### 7.2 Implicaciones para el TPV
- **Motor de impuestos parametrizable por territorio** (el `location` define común/IGIC/foral).
- En Canarias se trabaja con **IGIC** y los registros Verifactu reflejan IGIC, no IVA.
- Distinguir **consumo en local vs. para llevar** (cambia el tipo).
- Soportar **varios tipos en un mismo ticket** (menú 7 % + vino para llevar 15 %) con desglose correcto.

---

## 8. Ticket / factura simplificada en hostelería (RD 1619/2012)

### 8.1 Cuándo se puede emitir simplificada («ticket»)
- General: importe **≤ 400 €** (IVA incl.).
- **Hostelería/restauración: ≤ 3.000 €** (IVA incl.) — límite ampliado.
- **Nunca** simplificada (debe ser **completa**) en entregas intracomunitarias, ventas a distancia, o cuando el destinatario sea empresario/profesional que exija factura completa para deducir.

### 8.2 Datos obligatorios del ticket (art. 7.1)
Número y serie (correlativo); fecha de expedición (y de operación si difiere); **NIF y nombre del expedidor**; descripción; **tipo impositivo** aplicado (y «IVA/IGIC incluido»); desglose por tipo si hay varios; **importe total**; referencia a rectificada si aplica. **+ Con Verifactu:** **QR** y leyenda **«VERI*FACTU»**.

### 8.3 Factura simplificada cualificada (para que el cliente deduzca)
Añadir: **NIF y domicilio del destinatario** y **cuota tributaria repercutida por separado**. El TPV debe permitir **convertir un ticket** en cualificada o emitir **factura completa** a petición.

---

## 9. Conservación y RGPD

| Documento | Plazo |
|-----------|-------|
| Facturas y registros Verifactu | **4 años** (prescripción fiscal, art. 66 LGT) |
| Libros y justificantes contables | **6 años** (art. 30 C. Comercio) |
| Casos especiales (BIN, deducciones pendientes) | hasta **10 años** |

> **Recomendación:** conservar **≥ 6 años** con **legibilidad y accesibilidad** durante todo el periodo (exigible por el propio reglamento Verifactu).

**RGPD** (detalle en [12](12-seguridad-y-rgpd.md)): los datos del cliente en facturas se tratan por **obligación legal** (art. 6.1.c RGPD); **minimización** (el ticket B2C no necesita datos personales); **limitación del plazo** (bloqueo/borrado tras 4‑6‑10 años); fidelización/reservas requieren **base legal propia** (consentimiento) y datos de tarjeta cumplen **PCI‑DSS**.

---

## 10. Checklist técnico de conformidad

**A. Núcleo Verifactu (prioridad máxima — exigible ya al fabricante):**
- [ ] Registro de **alta** con todos los campos, desglose **IVA o IGIC** según territorio.
- [ ] Registro de **anulación**.
- [ ] **Hash SHA‑256** con la cadena exacta (orden de campos), UTF‑8, salida hex 64 mayúsculas.
- [ ] **Encadenamiento** (primeros 64 car. del hash anterior; vacío en el primero).
- [ ] **Marca temporal** con segundos + huso horario.
- [ ] **Código del SIF** y datos del productor en cada registro.
- [ ] **QR** ISO/IEC 18004 nivel M, 30‑40 mm, URL `ValidarQR` + parámetros (`nif`, `numserie`, `fecha dd-mm-aaaa`, `importe` con punto).
- [ ] **Leyenda «VERI*FACTU»** junto al QR.
- [ ] **Cliente web service XML** (XSD AEAT) + **certificado electrónico** (modalidad Verifactu).
- [ ] **Registro de eventos** inalterable.
- [ ] **Inalterabilidad y trazabilidad** (sin borrados/ediciones no registradas).
- [ ] **Exportación** estándar de registros (inspección).
- [ ] **Declaración responsable** del producto emitida antes de comercializar.
- [ ] (Si se ofrece modo no Verifactu) **firma XAdES** + registro de eventos reforzado.

**B. Facturación (RD 1619/2012):**
- [ ] Tickets/facturas simplificadas con campos del art. 7.1.
- [ ] Conversión a **cualificada** (NIF+domicilio+cuota) y a **completa**.
- [ ] **Series correlativas** por establecimiento/tipo (compatibles con offline, ver [06](06-base-de-datos-y-sincronizacion.md)).
- [ ] Tipos **IGIC** parametrizables; multi‑tipo por ticket; distinción local/para llevar.

**C. Conservación y RGPD:**
- [ ] Conservación **≥ 6 años** con legibilidad.
- [ ] Políticas de retención/bloqueo/borrado de datos personales.

**D. Roadmap (no MVP):**
- [ ] Módulo **factura electrónica B2B** (Facturae/UBL/EN 16931 + estados).
- [ ] (Solo País Vasco) Módulo **TicketBAI** (Álava/Gipuzkoa/Bizkaia).

---

## 11. Sanciones (síntesis)

| Riesgo | Importe |
|--------|---------|
| Comercializar software no conforme / sin declaración responsable / que permita alterar registros | **Hasta 150.000 €** por ejercicio y tipo (**fabricante**) |
| Usar software no conforme | **Hasta 50.000 €**/ejercicio (usuario) |
| Defectos de facturación | Hasta 1 % del importe |
| Incumplir factura B2B / estados | Hasta 10.000 € |
| Incumplimiento RGPD | Tramos art. 83 RGPD |

> Como somos fabricantes **y** usuarios (en nuestro propio negocio), aplican **ambos** riesgos.

---

## 12. Conclusiones para el proyecto (La Palma)

1. **Prioridad 1:** Verifactu completo en **modalidad Verifactu** (hash encadenado, QR `ValidarQR`, leyenda, web service, registro de eventos) + **declaración responsable**. Es nuestro principal riesgo legal (hasta 150.000 €) y nuestro mayor diferenciador.
2. **Canarias = IGIC:** motor fiscal con **tipos IGIC** reflejados en los registros; atención al fin del 3 % en *take away* (→7 %) y al 15 % de alcohol para llevar.
3. **Hostelería:** factura simplificada hasta **3.000 €**, conversión a cualificada/completa, multi‑tipo, local/para llevar.
4. **Roadmap:** preparar **B2B** (RD 238/2026) y vigilar la Orden de la solución pública. **TicketBAI** solo si vendemos en País Vasco.
5. **Conservación + RGPD:** retención ≥ 6 años; políticas de datos conformes a RGPD/LOPDGDD.

---

## 13. Fuentes oficiales

**Verifactu — normativa:** BOE‑A‑2023‑24840 (RD 1007/2023) · BOE‑A‑2025‑6600 (RD 254/2025) · BOE‑A‑2024‑22138 (Orden HAC/1177/2024) · BOE‑A‑2025‑24446 (RD‑ley 15/2025, aplazamiento 2027).
**Verifactu — portal/técnica AEAT:** sede.agenciatributaria.gob.es (portal SIF/Verifactu, cuestiones generales, FAQ ámbito, contenido del registro de alta, información técnica/XSD, algoritmo hash, QR/servicio de cotejo, declaración responsable, registro de eventos, FAQs desarrolladores PDF).
**Factura B2B:** BOE‑A‑2022‑15818 (Ley 18/2022) · BOE‑A‑2026‑7295 (RD 238/2026) · nota AEAT factura electrónica.
**SII y facturación:** sede AEAT (SII) · BOE‑A‑2012‑14696 (RD 1619/2012).
**LGT (sanciones/conservación):** BOE‑A‑2003‑23186 (Ley 58/2003, arts. 29.2.j, 66, 201 bis).

> **Antes de cerrar desarrollo:** reconfirmar los **XSD vigentes** del web service Verifactu en el portal de desarrolladores AEAT (se actualizan periódicamente) y validar con asesor fiscal.
