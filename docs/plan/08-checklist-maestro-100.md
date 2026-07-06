# 08 — Checklist maestro: Gluuh TPV al 100%

**Fecha:** 03-07-2026. Documento único que consolida **todos** los módulos,
funciones y mejoras identificados en la auditoría, el estudio de mercado
(doc 07), el modelo de verticales y las specs de implementación. Es la
**definición de "producto completo"** y la lista de verificación para no dejarse
nada.

Estado: ✅ hecho · 🟡 parcial/stub · ❌ falta. La columna "Ref." apunta al
documento con el detalle.

> Recuento aproximado a fecha de hoy: **~35% ✅ · ~15% 🟡 · ~50% ❌.** Base
> operativa sólida; falta la capa de monetización, ecosistema y verticales.

---

## 1. TPV / Pantalla de venta

| Función | Estado | Ref. |
|---|---|---|
| Venta en barra / directa · en mesa · para llevar | ✅ | |
| Plano de sala interactivo en el TPV | ✅ | |
| Grid de productos con color e imagen | ✅ | |
| Ticket, editor de línea, nota de cocina | ✅ | |
| Teclado (Und/Precio, DTO%, DTO€, precio manual) | ✅ | |
| Descuentos por línea / global | ✅ | |
| Columna de funciones (Aparcar, Pasar a mesa, Cliente, Invitación, Cons. propio, Dividir, Último doc, Utilidades) | ✅ | impl.05 |
| Cliente + comensales + tipo de operación en cabecera | ✅ | impl.05 |
| Barra de estado inferior | ✅ | |
| Dividir cuenta por líneas (cobrar cada parte) | 🟡 | impl.05 |
| Cambio de camarero en un ticket abierto | ❌ | impl.05 |
| Imprimir cuenta (proforma, sin cobrar) | ❌ | impl.05 |
| Tipo de documento (ticket / factura con NIF) en el cobro | ❌ | impl.05 |
| Atajos de teclado F10/F11/F12 en cobro | ❌ | impl.05 |
| Creación rápida de producto desde el TPV | ❌ | impl.07 |
| Agotado / "86" desde el TPV | ❌ | impl.07 |

## 2. Comandera / KDS / Pantallas

| Función | Estado | Ref. |
|---|---|---|
| Comandera móvil (PIN + pulsera) | ✅ | |
| Comandera que cobra (datáfono integrado) | ❌ | |
| KDS cocina en tiempo real (1 vista + estados) | ✅ | impl.10 |
| KDS: 4 vistas (mesas / grupos / cascada / agrupadas) | ❌ | impl.10 |
| KDS: estado RECLAMADO + config por pantalla + fast food | ❌ | impl.10 |
| Grupo de cocina granular + filtro por pantalla | ❌ | impl.10 |
| Kiosko de autopedido | ✅ | |
| Pantalla de recogida (display) | ✅ | |
| Visor de cliente (2ª pantalla) | ✅ | impl.03 |
| Cartelería / publicidad (PIC) | ✅ | |
| Gestor de colas / aviso "pedido listo" | ❌ | |

## 3. Catálogo y verticales (las "piezas")

| Función | Estado | Ref. |
|---|---|---|
| Familias / categorías / productos + IVA auto por territorio | ✅ | |
| Imagen de producto (subida + render) | ✅ | |
| Alérgenos · estación de preparación | ✅ | |
| Modificadores / personalización de ingredientes (min/max, suplemento) | 🟡 | verticales |
| Menús combo | 🟡 | |
| **Formatos de venta** (caña/copa/botella, ración/media/porción) | ❌ | verticales |
| **Variantes/atributos** (talla×color, sabor) | ❌ | verticales |
| **Precio flexible** (por peso, por composición, mitad y mitad) | ❌ | verticales |
| Marca / fabricante · temporada / campaña | ❌ | verticales |
| Códigos de barras · impresión de etiquetas | 🟡 / ❌ | verticales |
| Botonera / paneles configurables por negocio | ❌ | verticales |
| Selector "tipo de negocio" (preset de verticales) | ❌ | roadmap 07 §8 |
| **Servicios + agenda de citas** (barbería/peluquería) | ❌ | verticales |
| Ficha de cliente enriquecida (historial/preferencias) | ❌ | verticales |

## 4. Precios / tarifas / promociones

| Función | Estado | Ref. |
|---|---|---|
| Descuentos (CRUD) | ✅ | |
| Tarifas reales por producto | ❌ | plan P1 |
| Multi-tarifa automática (hora / sala / cliente) | ❌ | plan P1 |
| Promociones (2x1, happy hour, Mix&Match, upselling) | ❌ | plan P1 |

## 5. Cobro / pagos

| Función | Estado | Ref. |
|---|---|---|
| Efectivo + cambio · pago mixto · propina | ✅ | |
| Cajón portamonedas (ESC/POS, en Desktop) | ✅ | impl.03 |
| **Datáfono / pasarela** (Redsys / Stripe) | ❌ | roadmap P0 |
| **Pago QR / Bizum / wallets** | ❌ | roadmap P0 |
| Pago en el comandero | ❌ | |
| Cobro automático de efectivo (Cashlogy/Cashkeeper/Glory) | ❌ | roadmap P1 |

## 6. Caja / fiscal

| Función | Estado | Ref. |
|---|---|---|
| Caja: apertura, movimientos, cierre Z | ✅ | |
| Turnos | 🟡 | |
| Motor VERIFACTU (probado vs vector AEAT) | ✅ | |
| **VERIFACTU activo en el TPV** (cobro→factura encadenada) | ❌ | impl.01 |
| Envío real a la AEAT (mTLS, parseo respuesta) | 🟡 | impl.01 |
| TicketBAI (foral) | ❌ | roadmap P2 |
| IVA / IGIC / IPSI por territorio · series · tipos F1-R5 | ✅ | |
| Visor VERIFACTU (verificar cadena) | ✅ | |

## 7. Clientes / fidelización / marketing

| Función | Estado | Ref. |
|---|---|---|
| Ficha de cliente + alta rápida desde TPV | ✅ | impl.05 |
| **Fidelización** (puntos / monedero) | ❌ | roadmap P1 |
| Tarjetas regalo | ❌ | roadmap P1 |
| **Marketing** (email / SMS) + CRM | ❌ | roadmap P1 |

## 8. Empleados / permisos

| Función | Estado | Ref. |
|---|---|---|
| Empleados con PIN | ✅ | |
| Login por pulsera RFID/NFC | ✅ | |
| Ventas por empleado (informe) | ✅ | |
| Roles (enum) | ✅ | |
| Permisos finos por botón/función | ❌ | plan P2 |
| Fichaje / control horario | ❌ | |

## 9. Compras / stock / inventario

| Función | Estado | Ref. |
|---|---|---|
| Proveedores · almacenes (CRUD) | 🟡 | |
| Pedidos a proveedor · albaranes · facturas de proveedor | ❌ | roadmap P1 |
| Regularización de inventario · variaciones de stock | ❌ | roadmap P1 |
| **Escandallos, costes y beneficios** | 🟡 | roadmap P1 |
| Stock multi-almacén | ❌ | verticales |
| Inventario por escáner de código de barras | ❌ | verticales |

## 10. Reservas / canales online / delivery

| Función | Estado | Ref. |
|---|---|---|
| Reservas de mesa (en el TPV) | 🟡 | |
| Integración reservas (CoverManager / TheFork) | ❌ | roadmap P2 (API) |
| **Carta digital QR** | ❌ | roadmap P0 |
| **Pide y paga en mesa** | ❌ | roadmap P0 |
| **Delivery vía agregador** (Deliverect / Sinqro) | ❌ | roadmap P0 |
| Delivery propio (app repartidores) | ❌ | roadmap P1 |
| Pedidos online propios / web de pedidos | ❌ | roadmap P1 |
| Tienda online / e-commerce | ❌ | roadmap P2 |

## 11. Informes / configuración / dispositivos

| Función | Estado | Ref. |
|---|---|---|
| Dashboard KPIs + 13 informes reales | ✅ | |
| BI / analítica avanzada · precios dinámicos | ❌ | roadmap P2 |
| Exportaciones (Excel / contabilidad) | ❌ | roadmap P2 |
| Sistema de módulos (activar/desactivar) | ✅ | impl.04 |
| Emparejado de pantallas por código | ✅ | impl.04 |
| Configuración por ámbito (`setting` GLOBAL/LOCAL/DEVICE) | 🟡 | |
| Multi-local: modelo de datos | ✅ | |
| Multi-local: selector de local en la UI | ❌ | plan |
| Central de compras / franquicia | ❌ | roadmap P2 |

## 12. Impresión / tickets / hardware

| Función | Estado | Ref. |
|---|---|---|
| Ticket de cliente (recibo/factura + QR) | ✅ | impl.10 |
| Ticket del pedido · para camarero · para cocinero | ❌ | impl.10 |
| Enrutado por grupo de cocina a su impresora | ❌ | impl.10 |
| Enviar ticket por email | ❌ | |
| Impresora ESC/POS + cola local (Desktop) | ✅ | impl.03 |
| Cola de impresión compartida (`print_job`) | ❌ | impl.03 |
| Balanza / venta por peso · lector de códigos | ❌ / 🟡 | verticales |

## 13. App escritorio / offline

| Función | Estado | Ref. |
|---|---|---|
| App Electron (kiosk, auto-update, instalador) | ✅ | impl.03 |
| Lanzador (Configuración / TPV / Monitor) | ✅ | |
| Identidad de terminal (device.json) | ✅ | impl.03/04 |
| Copia de seguridad local a USB (+ imágenes) | 🟡 | impl.03 |
| **Offline-first (PowerSync)** en el TPV | ❌ | impl.06 |
| Caché de imágenes offline | ❌ | impl.06 |
| Numeración fiscal offline (rangos por dispositivo) | ❌ | impl.06 |

## 14. Integraciones / API / ecosistema

| Función | Estado | Ref. |
|---|---|---|
| **API pública + webhooks** | ❌ | roadmap P2 |
| Contabilidad (A3 / Sage / Holded) | ❌ | roadmap P2 (API) |
| PMS de hotel (cargo a habitación) | ❌ | roadmap P2 (API) |
| Nóminas / RR.HH. (partners) | ❌ | roadmap P2 (API) |
| Asistente IA con backend | ❌ | roadmap P2 |

## 15. Seguridad / RGPD

| Función | Estado | Ref. |
|---|---|---|
| Multi-tenant con RLS por `tenant_id` | ✅ | |
| JWT con claims (tenant / rol) | ✅ | |
| Consentimiento RGPD del cliente | ✅ (campo) | |
| Copia de seguridad (nube + local) | 🟡 | impl.03 |
| Rate-limit en el emparejado de dispositivos | ❌ | code-review |

---

## Camino crítico hacia el 100% (resumen de prioridades)

- **P0 — para competir (mínimo de mercado):** VERIFACTU activo en el TPV ·
  pagos integrados (datáfono/QR) · carta QR + pide y paga · delivery vía
  Deliverect/Sinqro. + rematar backup con imágenes.
- **P1 — monetización y retención:** compras/stock/escandallos · fidelización +
  promociones + tarifas · marketing · cajón automático · multi-local en UI ·
  **fase 1 de verticales** (formatos + precio flexible + modificadores).
- **P2 — ecosistema y expansión:** API pública + webhooks · contabilidad/PMS/
  nóminas vía API · KDS avanzada (4 vistas + multi-ticket) · TicketBAI ·
  offline-first (PowerSync) · verticales de comercio y servicios · BI · tienda
  online · asistente IA.

> Este documento es la lista de verificación viva. Al completar cualquier
> función, cambiar su estado aquí. Cuando todo esté ✅, el producto está al 100%.
