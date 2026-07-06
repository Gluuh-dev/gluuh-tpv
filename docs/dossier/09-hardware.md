# 09 — Hardware

> Qué equipos necesita un local y cuáles recomendar. Modelos y precios orientativos en euros (mercado España 2025‑2026, IVA incl. salvo indicación). Filosofía del proyecto: **hardware estándar y reutilizable** (no obligamos a comprarnos terminales propietarios). La parte de impresión y comanderas se amplía en **[10](10-comanderas-kds-e-impresion.md)**.

---

## 1. Terminales TPV táctiles (barra / caja)

Dos familias: **Windows** (más potencia, software clásico) y **Android** (más barato, ligero). Nuestro TPV de escritorio (Tauri) corre en **Windows**; la comandera (React Native) en **Android/iOS**.

| Modelo | SO | Pantalla / CPU | Precio aprox. |
|--------|----|----|---------------|
| **Sunmi T2s Lite** | Android | 15,6" FHD · Octa‑core · 4/64 GB | ~450 € (pack con cajón+impresora ~545 €) |
| **HioPOS SUN / GO** | Android | 15,6" FHD IPS | 600–900 € |
| **Partner Tech / 10POS (Android)** | Android | 15,6" | 400–700 € |
| **Aures Yuno II** | Win 10/11 IoT | 15,6" FHD · Celeron J6412 · 4/128 SSD | 700–950 € |
| **Aures Sango** | Win 10/11 IoT | 15" · i5 · 8/128 SSD · 2ª pantalla | 1.000–1.400 € |
| **Posiflex PS‑3615 G2** | Win 10/11 IoT | 15" · Celeron/i3/i5 | 900–1.500 € |
| **ELO I‑Series / EloPOS** | Android/Win | 15,6"–22" | 800–1.800 € |

**Claves:** pantalla **capacitiva (PCAP)** > resistiva (mejor respuesta, se limpia mejor en barra); puertos **serie (COM)** y **RJ11/RJ12** importan (cajones, datáfonos semiintegrados); **Android** gana en precio/sencillez para bar pequeño, **Windows** donde el software es pesado.

> **Verifactu es cuestión de software, no de hardware:** cualquier terminal vale; lo que debe cumplir es **nuestro software** (ver [07](07-facturacion-y-cumplimiento-legal.md)).

---

## 2. Impresoras de tickets térmicas

Papel térmico **80 mm** (estándar; 58 mm en handhelds), sin tinta. Lenguaje universal **ESC/POS** (ver [10](10-comanderas-kds-e-impresion.md) §técnica).

| Modelo | Conexión | Velocidad | Precio aprox. |
|--------|----------|-----------|---------------|
| **Epson TM‑T20III** | USB+Serie / USB+Ethernet | 250 mm/s | 150–180 € |
| **Epson TM‑m30III** | USB‑C, Ethernet, **WiFi+BT** | 250 mm/s | 295–330 € |
| **Epson TM‑T88VII** | USB+Ethernet+Serie | **500 mm/s** | ~364 € |
| **Star TSP143IV** | USB, LAN, WLAN, BT | ~250 mm/s | 180–260 € |
| **Star mC‑Print3** | Ethernet, USB‑C, BT | — | 230–300 € |
| Genéricas (Xprinter…) | USB/LAN/BT | — | 45–90 € |

**Conexión recomendada:** en local fijo, **Ethernet (LAN)** — la impresora tiene IP propia y cualquier terminal/tablet/nube le imprime. **USB** ata a un PC; **Bluetooth** para móvil concreto; **WiFi** cómodo pero menos estable.

---

## 3. Impresoras de cocina y KDS

En cocina hay calor/grasa → el papel térmico **se borra**. Se usan **impresoras de impacto** (cinta + papel normal); la barra puede seguir con térmica.

**Impacto (cocina):**
| Modelo | Notas | Precio aprox. |
|--------|-------|---------------|
| **Epson TM‑U220B** | Impacto 9 pin, **2 colores** (rojo para alérgenos/urgente), autocorte | 180–280 € |
| **Epson TM‑U220‑i** | Con servidor de impresión integrado (ePOS) | 300–400 € |
| **Bixolon SRP‑275 / Star SP700** | Alternativas | 180–320 € |

**KDS (pantallas, alternativa moderna):**
| Opción | Hardware | Precio |
|--------|----------|--------|
| Tablet Android/iPad + soporte | 10"–15" | 100–400 € |
| Monitor + Android box / mini‑PC | 21"–27" | 150–350 € |
| Pantalla KDS dedicada (anti‑grasa/calor) | con bump bar | 400–900 € |

> **Enrutado:** en el software se definen **estaciones** (barra, parrilla, fríos, postres) y se asocia cada producto a una; al enviar la comanda, el sistema la **divide automáticamente** a la impresora/pantalla de cada estación. Recomendable **KDS en pase + impresora de impacto de respaldo**.

---

## 4. Comanderas (terminales portátiles del camarero)

| Modelo | Impresora integr. | Conectividad | Precio aprox. |
|--------|-------------------|--------------|---------------|
| **Sunmi V2** | Sí (58 mm) | WiFi, 4G, BT, NFC | 250–330 € |
| **Sunmi V2s** | Sí (58 mm) + etiquetas | WiFi, 4G, BT, **NFC**, escáner 2D | 300–380 € |
| **Sunmi V2s Plus** | Sí (**80 mm**) | WiFi, 4G, BT, NFC | ~350 € |
| **Sunmi L2 / L2s Pro** | No (solo escáner) | WiFi, 4G, BT, NFC, IP65/67 | 235–466 € |
| **Sunmi P2/P3** | Sí | WiFi/4G, **pago EMV integrado** | 350–500 € |
| Móvil/tablet normal + app | No | WiFi/4G/BT | 100–600 € |

**Recomendación:** para **comandar + cobrar + imprimir en mesa** → **Sunmi V2s** (el más usado en hostelería ES). Si solo se comanda (la comanda va al KDS/impresora de cocina) → móvil/tablet barato o Sunmi L2. Valorar **batería extraíble** (V2s) y **4G** de respaldo en terrazas.

---

## 5. Cajón portamonedas

No tiene electrónica propia: se conecta a la **impresora** por **RJ11/RJ12**; al imprimir el ticket, la impresora envía un **pulso (kick‑out)** que abre el cajón (comando ESC/POS `ESC p`).

| Modelo | Conexión | Precio aprox. |
|--------|----------|---------------|
| HS 360 / 410 / 330C | RJ11 | 40–45 € |
| IT 46 / 46V (vertical) | RJ11 | 65–72 € |
| Cajón metálico grande 425×450 | RJ11 | 130–152 € |

> Si la impresora no tiene salida RJ11 (algunas mPOS/handheld), usar cajón con **disparo USB** o conversor.

---

## 6. Periféricos

| Periférico | Conexión | Precio aprox. | Relevancia hostelería |
|-----------|----------|---------------|------------------------|
| Lector 1D | USB | 25–80 € | Baja |
| **Lector 2D / QR** | USB/BT | 60–180 € | **Media** (QR de pago/cupones/carta) |
| Báscula conectable | RS232/USB | 150–600 € | Solo venta a peso (take‑away por kilo) |
| Visor de cliente | USB/serie | 60–250 € | Media (transparencia de precio en barra) |

---

## 7. Datáfonos integrables

Tres niveles de integración (detalle en [08](08-pasarelas-de-pago.md)):
1. **No integrado:** el camarero teclea el importe (riesgo de error).
2. **Semiintegrado:** el TPV envía el importe; el datáfono conserva su certificación (modelo **Redsys** en España).
3. **Totalmente integrado:** pago como módulo del software (**Stripe Terminal**, SumUp SDK, Adyen).

| Solución | Modelos | Coste hardware | Comisión |
|----------|---------|----------------|----------|
| **Redsys (vía banco)** | Ingenico/PAX, TPV‑PC | Alquiler ~15‑30 €/mes | Negociable 0,4‑1,5 % |
| **SumUp** | Solo / Terminal | 50–200 € | ~1,5 % |
| **Stripe Terminal** | WisePad 3 (~59 €), WisePOS E (199 €), S700 (259 €) | 60–350 € | ~1,4 %+fijo |
| **Adyen / Viva / myPOS** | Terminales Android | 50–300 € | Variable |

---

## 8. Redes y conectividad (crítico para offline)

| Componente | Recomendación |
|-----------|---------------|
| **Router** | De calidad, con **respaldo 4G/5G automático** (failover) si el negocio depende de pagos online |
| **Switch** gestionable | 8–24 puertos, para cablear por **Ethernet** terminales, impresoras y KDS (más fiable que WiFi) |
| **WiFi (puntos de acceso)** | Ubiquiti UniFi / Aruba / TP‑Link Omada; **separar red de personal y de clientes** (VLAN/SSID) |
| **SAI/UPS** | Para router, switch, servidor y TPV principal: un microcorte no debe tumbar el servicio |
| **IP fijas** | Reserva DHCP por impresora/KDS para que el software siempre las encuentre |
| **Servidor local** (medio/grande) | Mini‑PC/NAS que gestiona mesas/comandas/enrutado en LAN y sincroniza con la nube |

---

## 9. Tres kits recomendados

### Kit A — Bar pequeño económico (1 punto de venta) — **≈ 700‑1.000 €**
| Elemento | Modelo | Precio |
|----------|--------|--------|
| Terminal all‑in‑one | Sunmi T2s Lite (pack con cajón+impresora) | 545 € |
| Comandera | Móvil/tablet propio o 1× Sunmi V2 | 0–300 € |
| Datáfono | SumUp Solo / Stripe Tap to Pay | 0–70 € |
| Red | Router + 1 AP básico | 60 € |

### Kit B — Restaurante medio (barra+sala+cocina, 25‑50 cubiertos) — **≈ 3.250‑3.700 €**
| Elemento | Modelo | Precio |
|----------|--------|--------|
| Terminal barra | Aures Yuno II (Win) o HioPOS SUN (Android) | 800 € |
| Impresora barra | Epson TM‑m30III (Ethernet) | 320 € |
| Impresora cocina | Epson TM‑U220B (impacto) | 250 € |
| KDS pase | Monitor 24" + Android box + soporte | 250 € |
| Cajón | Metálico RJ11 | 60 € |
| Comanderas (2) | 2× Sunmi V2s | 720 € |
| Datáfono | Redsys semiintegrado / SumUp Terminal | ~150 € + cuota |
| Red | Switch 8p + 2 AP UniFi + SAI | 350 € |
| Servidor local | Mini‑PC | 350 € |

### Kit C — Restaurante grande / multi‑zona (terraza, varias salas, 2 cocinas) — **≈ 8.800‑9.500 €**
| Elemento | Modelo | Cant. | Precio |
|----------|--------|-------|--------|
| Terminales | Aures Sango i5 / Posiflex i5 | 2 | 2.600 € |
| Impresora barra | Epson TM‑T88VII | 1 | 364 € |
| Impresoras cocina | Epson TM‑U220B | 2 | 500 € |
| Pantallas KDS dedicadas | HioScreen / Revo KDS | 2 | 1.400 € |
| Cajones | Metálico RJ11 | 2 | 120 € |
| Comanderas | Sunmi V2s | 5 | 1.800 € |
| Lector 2D/QR | Honeywell 2D | 1 | 120 € |
| Datáfonos | Redsys semiintegrado / Stripe S700 | 2 | 300–700 € |
| Red | Switch 24p + 4 AP + router 4G backup + 2 SAI | 1 | 1.000 € |
| Servidor local | Mini‑PC/NAS + backup nube | 1 | 600 € |

> Los kits **excluyen la licencia de software** (nuestra suscripción — ver [11](11-modelo-de-negocio-y-precios.md)).

---

## 10. Funcionamiento offline (resumen)

1. **Software offline‑first:** comandar, imprimir y cobrar en efectivo deben funcionar sin internet; sync al volver (ver [06](06-base-de-datos-y-sincronizacion.md)).
2. **Red local independiente:** comanderas → servidor/TPV → impresoras por **LAN/WiFi del local**, sin pasar por internet. Si la impresión depende de la nube y cae internet, la cocina deja de imprimir → tener impresión también local o KDS local.
3. **Pagos con tarjeta:** el datáfono **necesita conexión** para autorizar → **datáfono con 4G propio** + router con **failover 4G/5G**.
4. **Verifactu offline:** generación local con hash encadenado y **envío diferido** a la AEAT al reconectar (ver [07](07-facturacion-y-cumplimiento-legal.md)).
5. **SAI/UPS** en router, switch, servidor y TPV principal.

> **Conclusión:** arquitectura **local‑first/híbrida**, impresión por **Ethernet en LAN**, datáfono con **datos móviles propios** y **SAI**. Así el local funciona aunque caiga la fibra.

---

## 11. Fuentes

tpvhiopos.es/.com · lacasadeltpv.com · sunmi.com · consumiblestpv.com · shopnfc.com · itgstore.es · comercialtpv.com · idealo.es · epson.es/epson.com · pccomponentes.com · pcexpansion.es · starmicronics.com · star‑emea.com · tpvcenter.com · cajasregistradoras.com · mundotpv.com · stripe.com/terminal · rankiabusiness.com · download4.epson.biz (ePOS) · github f/escpos‑php · saashub.com (PrintNode/QZ Tray) · blog.fu.do (KDS) · revo.works · qamarero.com · tpv‑top.com · hioposeuskadi.com · ecrequipamientos.com.

> Precios orientativos a junio 2026; verificar con distribuidor antes de comprar.
