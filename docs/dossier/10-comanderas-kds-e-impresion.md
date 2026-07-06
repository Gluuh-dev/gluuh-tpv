# 10 — Comanderas, KDS e impresión

> Diseño de la app de comandera (camarero), del KDS (cocina) y —lo más complejo técnicamente— **cómo imprimir desde una web o una app móvil a una impresora térmica local**. Complementa el hardware ([09](09-hardware.md)) y el stack ([05](05-stack-tecnologico.md)).

---

## 1. App de comandera (camarero)

### 1.1 Objetivo de diseño
Tomar una comanda debe ser **más rápido que con papel**. La app (React Native + Expo, Android/iOS) prioriza velocidad, robustez en hora punta y **funcionamiento offline total**.

### 1.2 Flujo de uso
```
Login PIN → Plano de mesas → Selecciona mesa → (comensales)
→ Carta (categorías/favoritos/búsqueda) → Producto → Modificadores/notas
→ Añadir a comanda → Enviar a cocina (por pase) → [Cobro en mesa opcional]
```

### 1.3 Funciones clave
- **Plano de sala** con estados de mesa en tiempo real (sincronizado vía PowerSync).
- Comanda por **comensal/asiento** y por **pase** (entrantes/principales/postres).
- **Modificadores** (sin cebolla, punto de carne, extras) y notas libres.
- **86 / agotado** en tiempo real (lo ve toda la sala y la cocina).
- **Offline‑first:** la comanda se guarda en SQLite local y se propaga al reconectar/instantáneamente en LAN.
- **Cobro en mesa** (datáfono Bluetooth, Tap to Pay, o QR) — ver [08](08-pasarelas-de-pago.md).
- **Impresión opcional** en cabezal Bluetooth del propio dispositivo (Sunmi) o impresora de red.
- **Avisos** (campana de cocina, mesa lista) vía Socket.IO.

### 1.4 Hardware objetivo
Sunmi V2s (con impresora/NFC/escáner) o móvil/tablet estándar. Ver [09](09-hardware.md) §4.

---

## 2. KDS (Kitchen Display System)

### 2.1 Objetivo
Sustituir (o complementar) el papel de cocina con pantallas en tiempo real, reduciendo errores y tiempos.

### 2.2 Funciones
- Comandas en **tiempo real** con **cronómetro** y colores por tiempo de espera.
- Vista **por estación** (parrilla, fríos, postres) y vista de **pase** (línea caliente).
- Marcar plato/comanda «en preparación» y «listo» (toque o **bump bar**).
- **Aviso sonoro** de nueva comanda; recuperar comanda; histórico.
- Estadísticas de tiempos de preparación (fase Escala).

### 2.3 Tecnología
- Pantalla web (Next.js) o Tauri sobre monitor + Android box / mini‑PC, o pantalla KDS dedicada.
- **Datos:** la comanda llega por **PowerSync** (ya persiste en la SQLite del KDS); el **evento/campana** por **Socket.IO**.
- **Funciona en LAN** aunque caiga internet (servidor local en kits medio/grande).

### 2.4 Enrutado de comandas (clave)
```
Producto → asociado a una ESTACIÓN (config en backoffice)
Comanda enviada → el sistema divide por estación:
   • Bebidas → impresora/pantalla de BARRA
   • Carnes → pantalla de PARRILLA
   • Postres → estación de POSTRES
```
Cada estación tiene un **destino** configurable: impresora de comandas, pantalla KDS, o ambas (con respaldo).

---

## 3. Impresión (la parte más compleja)

### 3.1 ESC/POS — el lenguaje común
**ESC/POS** (Epson Standard Code for POS) es el conjunto de **comandos de control** que entienden casi todas las térmicas/impacto (Epson lo creó; Star, Bixolon, Xprinter… lo emulan). Secuencias de bytes que empiezan por `ESC` (0x1B) o `GS` (0x1D):

| Comando | Función |
|---------|---------|
| `ESC @` | Inicializar |
| `ESC a n` | Alineación (izq/centro/der) |
| `ESC E n` / `GS ! n` | Negrita / tamaño |
| `GS V` | **Corte de papel** (autocutter) |
| `ESC p` | **Pulso de apertura del cajón** (kick‑out RJ11) |
| `GS k` | Código de barras / **QR** (p. ej. el QR Verifactu) |

**Librerías** (no programar a pelo): `python-escpos`, **`escpos-php`** (`f/escpos-php`), **`node-escpos`** / `node-thermal-printer`, o el SDK del fabricante.

### 3.2 El reto central
Por seguridad, **una web (JS en el navegador) o una app móvil NO pueden abrir directamente el puerto USB/serie** de una impresora (sandbox). Hay varias soluciones según el escenario:

### 3.3 Soluciones de impresión

**A) Impresoras «inteligentes» con servidor web embebido (la vía limpia):**
- **Epson ePOS‑Print / ePOS SDK for JavaScript:** las Epson con red (TM‑m30III, T88VII, TM‑i…) llevan un mini‑servidor. Desde JS te conectas a la **IP:puerto** de la impresora (`ePOSDevice`) y mandas `addText`, `addCut`, etc. **Sin drivers** en cada equipo. Ideal **web POS en red local**.
- **Star CloudPRNT / CloudPRNT Next:** protocolo **REST** donde **la impresora hace polling** a tu servidor preguntando «¿hay algo que imprimir?». No requiere PC/tablet en el local ni abrir puertos en el router. **Perfecto para pedidos online/delivery** (web/app → la impresora de cocina imprime sola). Modelos: TSP143IV, mC‑Print3, TSP654 CloudPRNT.

**B) Print server / agente local (cuando la impresora no es inteligente):**
- **PrintNode:** servicio nube + cliente en un PC/Raspberry del local; la web/SaaS envía el trabajo por API REST y el cliente lo imprime. De pago, depende de internet.
- **QZ Tray:** alternativa **gratuita y open source**; cliente local que expone la impresora al navegador por WebSocket firmado; permite **ESC/POS crudo** desde JS. Autoalojable.

**C) APIs del navegador (uso limitado):**
- **WebUSB / Web Bluetooth / Web Serial:** la web habla con la impresora directamente desde **Chrome/Edge** (no Safari/iOS). Útil para mPOS sencillos; soporte irregular, suele limitarse a Android/desktop Chrome.

**D) Apps nativas (móvil) y escritorio:**
- **Móvil (RN):** SDK del fabricante (Epson ePOS SDK, Star SDK) o ESC/POS por **Bluetooth/red**. Las comanderas Sunmi imprimen en su cabezal con la API Sunmi (basada en ESC/POS).
- **Escritorio (Tauri):** la **capa Rust** envía bytes ESC/POS por USB/serie/red (`tauri-plugin-serialport`, `tauri-plugin-esc-pos`); el **cajón se abre** con `ESC p` a la impresora.

### 3.4 Matriz de decisión

| Escenario | Solución recomendada |
|-----------|----------------------|
| **TPV escritorio (Tauri)** → impresora/cajón | **Capa Rust ESC/POS** (USB/serie/red) |
| **Comandera móvil** → impresora | **SDK fabricante BT/red** o cabezal Sunmi |
| **Web POS en red local** | Impresora Epson Ethernet + **ePOS‑Print JS** |
| **Pedidos online/delivery** a cocina | Impresora Star + **CloudPRNT** |
| **SaaS multi‑local con impresoras variadas** | **PrintNode** (cómodo) o **QZ Tray** (gratis) |

### 3.5 Nuestra estrategia de impresión
- **TPV de escritorio (caso principal):** impresión nativa por la **capa Rust** (máxima fiabilidad, offline, control del cajón). Es el camino crítico para barra/caja.
- **Cocina/barra fijas:** impresoras **Ethernet** en LAN, accionadas desde el TPV de escritorio o el servidor local → **funcionan sin internet**.
- **Comandera móvil:** impresión opcional por **Bluetooth** (Sunmi) o a impresora de red.
- **Pedidos online/delivery:** **Star CloudPRNT** (la impresora hace polling a la nube; ideal cuando no hay PC dedicado).
- **Web POS de respaldo:** **Epson ePOS‑Print JS** en red local; **QZ Tray** como comodín para hardware heterogéneo.

> **Principio offline:** la impresión del camino crítico (comandas a cocina, ticket de cobro) **no debe depender de internet**. Se acciona en **LAN local**; la nube es para pedidos remotos (delivery), no para imprimir la comanda de la mesa 5.

---

## 4. Formato de los documentos impresos

### 4.1 Comanda de cocina (impacto/KDS)
```
======== MESA 5 ========
Cam: Ana   12:34   Pase 1
------------------------
2x Croquetas jamón
1x Ensalada César
   - sin anchoas
1x Entrecot
   - al punto  (ROJO)
========================
```

### 4.2 Ticket de cobro (térmica, con Verifactu)
```
        BAR LA PALMA
    NIF: B12345678
  C/ Real 1, S/C La Palma
------------------------
2 Caña            5,00
1 Ración pulpo   14,00
------------------------
Base IGIC 7%     17,76
Cuota IGIC        1,24
TOTAL            19,00 €
------------------------
   [ CÓDIGO QR ]
   VERI*FACTU
Nº F2-2026-000123
12/06/2026 21:05
```
> Campos y QR según [07](07-facturacion-y-cumplimiento-legal.md). En Canarias, **IGIC**; en península, **IVA**.

---

## 5. Resumen de decisiones técnicas

| Aspecto | Decisión |
|---------|----------|
| Lenguaje de impresión | **ESC/POS** (librerías, no a pelo) |
| TPV escritorio | Impresión nativa **Rust** (Tauri) + cajón `ESC p` |
| Cocina/barra | Impresoras **Ethernet** en LAN (offline) |
| Comandera móvil | **BT/red** (SDK fabricante / Sunmi) |
| Delivery/online | **Star CloudPRNT** |
| Web POS | **Epson ePOS‑Print JS** / **QZ Tray** |
| KDS | Datos por **PowerSync** + campana por **Socket.IO** |
| Enrutado | Por **estación**, configurable en backoffice |

---

## 6. Fuentes

download4.epson.biz (ePOS‑Print JS) · files.support.epson.com (ePOS UM) · github f/escpos‑php · starmicronics.com / star‑emea.com (CloudPRNT) · saashub.com (PrintNode vs QZ Tray) · blog.fu.do (KDS) · revo.works (RevoKDS) · qamarero.com (KDS) · github (tauri‑plugin serial/esc‑pos) · socket.dev (react‑native‑thermal‑pos‑printer).
