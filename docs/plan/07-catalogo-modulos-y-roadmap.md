# 07 — Catálogo de módulos e integraciones del mercado + roadmap Gluuh

**Fecha:** 03-07-2026. Estudio de los módulos e integraciones que ofrecen las
principales apps de TPV de hostelería (España + internacional), cruzado con el
estado actual de Gluuh, para decidir el roadmap de módulos.

**Fuentes:** webs oficiales de Glop, Ágora/agorapos, Revo (Cegid), ICG/HioPOS,
Last.app, Camarero10, Numier, Cuiner, Miss Tipsi, Storyous; y marketplaces de
Square (~1.000 partners), Toast (200+), Lightspeed (250+), Clover (~200-280),
Oracle Simphony (200+), SumUp, TouchBistro, SpotOn.

Leyenda de estado en Gluuh: ✅ hecho · 🟡 parcial/stub · ❌ falta.

---

## 1. El "mínimo de mercado" (lo que ofrecen casi todos)

Estos son los módulos que aparecen en **todos** los competidores serios. Es el
listón de entrada:

| Módulo mínimo | Gluuh | Nota |
|---|---|---|
| TPV táctil | ✅ | |
| Comandero/comandera móvil | ✅ | con PIN y pulsera |
| KDS / monitor de cocina | ✅ | `/cocina` en tiempo real |
| Kiosko de autopedido | ✅ | `/kiosko` |
| Pantalla de cliente / recogida | ✅ | `/visor`, `/pantalla` |
| Cartelería / publicidad (PIC) | ✅ | `/ofertas` |
| Back office cloud + informes | ✅ | dashboard + 13 informes |
| Caja / arqueos / cierre Z | ✅ | |
| VERIFACTU (facturación legal) | 🟡 | motor probado, **desactivado en el TPV** |
| **Carta digital QR** | ❌ | |
| **Pide y paga en mesa (QR)** | ❌ | |
| **Delivery vía agregador** (Deliverect/Ordatic) | ❌ | hay tabla `online_order` |
| **Cajón de cobro automático** (Cashlogy/Glory…) | ❌ | |
| **Reservas con CoverManager/TheFork** | 🟡 | reservas de mesa propias sí |
| **Pagos con tarjeta integrados** (datáfono/pasarela) | ❌ | pago simulado |

**Lectura:** Gluuh cubre ~60% del mínimo de mercado y va **fuerte en lo
operativo** (KDS, kiosko, comandera, visor, informes). Lo que falta del mínimo:
carta QR + pide y paga, delivery por agregador, cajón de efectivo, reservas con
partner, y —el mayor— **pagos integrados de verdad**.

---

## 2. Catálogo completo por categorías (con estado Gluuh)

### 2.1 Módulos operativos
| Módulo | Quién lo tiene | Gluuh |
|---|---|---|
| TPV táctil | todos | ✅ |
| Comandero/comandera | todos | ✅ |
| KDS / monitor cocina (+ DDS sala) | todos | ✅ (DDS: ❌) |
| Kiosko autopedido / self-checkout | Glop, Ágora, Revo, ICG, C10, Numier, Storyous | ✅ |
| Carta digital QR | todos | ❌ |
| Pide y paga en mesa (QR) | Glop, Ágora, Revo, ICG (HioPay), C10, Last, Numier | ❌ |
| Pantalla de cliente / 2ª pantalla | Glop, Revo, ICG, Last | ✅ |
| Gestor de colas / aviso "pedido listo" | Glop, ICG | ❌ |
| Reservas + gestión mesas/aforo/turnos | todos | 🟡 (reservas mesa básicas) |
| Fidelización / puntos / monedero / CRM | todos | ❌ (campo `puntos_fidelidad`) |
| Tarjetas regalo | internacionales, Ágora (WooCommerce) | ❌ |
| Marketing / promociones (Mix&Match, upselling, precios dinámicos) | Glop, Revo, ICG, Last, C10 | ❌ (`promocion` stub) |
| Delivery/takeaway propio (con app repartidor) | Glop, ICG, Last, C10 | 🟡 (para llevar) |
| Control empleados / fichaje / horario (NFC/pulsera) | todos | 🟡 (empleados ✅, fichaje ❌) |
| Multi-local / franquicias / central de compras | Glop, Ágora, ICG, Last | 🟡 (datos ✅, UI ❌) |
| Dark kitchen / marketplace multimarca | Last.app | ❌ |
| Asistente IA (analítica / chatbot / voz) | Glop, Ágora, Last, C10 | 🟡 (panel sin backend) |
| BI / analítica avanzada | Revo (Genius), ICG (Analytics) | 🟡 (informes básicos) |

### 2.2 Pago
| Integración | Referencias del mercado | Gluuh |
|---|---|---|
| Datáfono / pasarela tarjeta | Redsys, Comercia GP, Dojo, Honei, Stripe, Adyen, propias (Ágora Payments, HioPay, Glop PAY, LastPayment) | ❌ |
| Pago QR / Bizum / wallets / Tap to Pay | todos | ❌ |
| Cobro automático efectivo (cajones) | Cashlogy, Cashkeeper, Glory/Cashinfinity, CashDro, Cashguard, Azkoyen | ❌ |
| Tax-free | Global Blue (ICG) | ❌ |

### 2.3 Delivery
| Integración | Referencias | Gluuh |
|---|---|---|
| Agregadores | Deliverect, Ordatic, Sinqro, Otter, Flipdish, Grubtech | ❌ |
| Plataformas directas | Glovo, Uber Eats, Just Eat, Deliveroo, PedidosYa | ❌ (`online_order` prevista) |
| Logística de reparto | Stuart, Shargo, Mox, Paack | ❌ |
| Web de pedidos propia sin comisiones | PortalRest, LastSHOP, Smartmenu, C10 | ❌ |

### 2.4 Gestión / fiscal
| Integración | Referencias | Gluuh |
|---|---|---|
| Contabilidad / ERP | A3 (Wolters Kluwer), Sage, Contasol, Holded, SAP, Dynamics 365 | ❌ |
| Compras/stock/escandallos/facturas IA | Gstock, tSpoonLab, Haddock, APICBase, Yurest, Prezo | ❌ (tablas `ingredient`/`recipe_item` sin UI) |
| RRHH / turnos | Skello, Mapal, Same Systems | 🟡 (`shift` sin UI) |
| Facturación electrónica | **VERIFACTU** (estatal), **TicketBAI** (foral) | 🟡 VERIFACTU / ❌ TicketBAI |
| API abierta / conectores a medida | todos los serios | ❌ (módulo API "próximamente") |

### 2.5 Reservas
| Integración | Referencias | Gluuh |
|---|---|---|
| Partners de reserva | TheFork/ElTenedor, CoverManager, Restoo, Bookline (IA), Reserve with Google | ❌ (reservas propias 🟡) |

### 2.6 Canales online / e-commerce
| Integración | Referencias | Gluuh |
|---|---|---|
| Tienda online propia + conectores | WooCommerce, PrestaShop, Shopify, Magento | ❌ |

### 2.7 Hardware
| Categoría | Referencias | Gluuh |
|---|---|---|
| Impresoras ticket/cocina | Epson, Star, Zebra, ESC/POS | ✅ (ESC/POS red) |
| Balanzas / venta por peso | Dibal, Epelsa, Bizerba | ❌ |
| Cajón portamonedas | genérico | ✅ (pulso ESC/POS) |
| Lector código de barras | Socket Mobile | 🟡 (pulsera RFID sí) |
| Robots de servicio | HioBot (ICG) | ❌ |

### 2.8 Hoteles / PMS (cargo a habitación)
| Integración | Referencias | Gluuh |
|---|---|---|
| PMS | FrontHotel (ICG), Mews, Cloudbeds, SIHOT, Tesipro, LEAN, dataHotel | ❌ |

---

## 3. Diferenciadores por gama (dónde destaca cada uno)

- **Revo**: la página de integraciones más amplia (BI/analítica, precios
  dinámicos DynamEat, muchísimo delivery y contabilidad/ERP).
- **Ágora / ICG**: ecosistema **PMS de hotel** más profundo y contabilidad
  nominada (A3, Sage, Contasol, Holded).
- **Last.app**: **integrador de delivery nativo** + web de pedidos propia +
  marketplace multimarca / dark kitchen. Delivery-first.
- **ICG/HioPOS**: **suite de hardware propia** más amplia (terminales, cajones
  CashDro, balanzas, robot).
- **Internacionales (Square/Toast)**: no compiten en módulos sino en
  **ecosistema** — API pública + marketplace con cientos de partners
  (nóminas, BI, gift cards, PMS) que ellos no construyen.

**Dos huecos del mercado ES (oportunidad):** integración contable nominada
fuera de Ágora/Revo, y **pasarelas modernas tipo Stripe/Adyen** (solo Last.app
y Revo las tocan bien).

---

## 4. Estrategia: first-party vs API/marketplace

El aprendizaje clave del estudio internacional: **un TPV maduro no es una lista
de módulos, es un ecosistema de integración.**

- **Modelo español** (Glop, Ágora): casi todo **módulo propio de pago**.
- **Modelo internacional** (Square, Toast): esenciales propios + **API/marketplace**
  → cientos de integraciones sin construirlas ellos.

**Recomendación para Gluuh (híbrido):**
1. Construir **first-party** los módulos que dan dinero y retención y que el
   cliente usa a diario: **pagos, fidelización, pedido online/QR, promociones,
   inventario**.
2. Abrir una **API pública + webhooks** (el módulo `API`, hoy "próximamente")
   para lo demás: contabilidad (A3/Sage/Holded), delivery (Deliverect/Ordatic),
   nóminas, reservas (CoverManager/TheFork), PMS. Construyes la puerta, entran ellos.

Así no compites en "número de módulos" contra ICG; compites en ser **cloud,
multi-local, con VERIFACTU/IGIC nativo y abierto por API**.

---

## 5. Roadmap de módulos para Gluuh (priorizado)

### P0 — Cierra el "mínimo de mercado" (sin esto no compites)
1. **VERIFACTU activo en el TPV** — ya tienes el motor; es cablearlo (guía impl. 01).
2. **Pagos integrados** — datáfono/pasarela (Redsys o Stripe) + QR/Bizum, y pago
   en el comandero. El hueco nº1. (módulo `PAGOS`)
3. **Carta digital QR + pide y paga** — reutiliza la RPC del kiosko; canal del cliente.
4. **Delivery vía Deliverect/Ordatic** — un solo conector agrega Glovo/Uber/Just Eat.

### P1 — Retención y monetización (first-party)
5. **Compras / stock / inventario / escandallos con costes y márgenes** — el
   módulo grande que falta entero.
6. **Fidelización** (puntos/monedero) + **promociones reales** (2x1, happy hour,
   Mix&Match) + **tarifas reales** por horario/zona.
7. **Marketing desde el TPV** (email/SMS básico) y **tarjetas regalo**.
8. **Cajón de cobro automático** (Cashlogy/Cashkeeper) y balanza (venta por peso).
9. **Multi-local en la UI** (el dato ya lo soporta) + fichaje de empleados.

### P2 — Ecosistema y verticales
10. **API pública + webhooks** (abre contabilidad, PMS, terceros).
11. **Contabilidad** (Holded/A3/Sage) y **reservas** (CoverManager/TheFork) vía API.
12. **Tienda online / e-commerce** y **web de pedidos propia**.
13. **TicketBAI** (foral) junto a VERIFACTU.
14. **Verticales**: media pizza / mitad y mitad, venta por peso (heladería),
    combos fast-food, agenda de servicios (retail/peluquería).
15. **Asistente IA con backend** (el panel ya existe vacío).
16. **BI/analítica avanzada** y **PMS de hotel** (gama alta, más adelante).

---

## 6. Lo que Gluuh ya tiene a favor (no perderlo de vista)

Cloud multi-tenant real, **VERIFACTU/IGIC canario nativo**, tiempo real
(KDS/pantalla/kiosko/cartelería), comandera con PIN **y pulsera**, visor de
cliente, editor de planos superior al de Glop, app de escritorio con impresión
ESC/POS y cajón, **emparejado de pantallas por código** (mejor que la IP+
contraseña del modelo local), e imágenes de producto. La base operativa está;
lo que falta es la capa de **monetización + ecosistema** de los puntos 2-5.
