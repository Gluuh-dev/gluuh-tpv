# Ayuda › Acerca de — Licencia y catálogo de módulos

> La pantalla "Acerca de" revela el **modelo de licencia** de Ágora y su **catálogo de módulos/add‑ons** — útil como mapa de funcionalidades y referencia para **nuestro modelo de negocio** ([11 — Modelo de negocio y precios](../11-modelo-de-negocio-y-precios.md)).

Captura: `Acerca de… / Información de Licencia`.

---

## Ágora — qué muestra

**Licencia:** plan **Professional** (clave `CCF4A-…`), **Suscripción activa**. **ID de Máquina** (huella del equipo para licenciar). Enlaces a *Condiciones del servicio* y **Declaración responsable Verifactu**.

**Resumen Global** (módulos habilitados / límite):

| Módulo | Límite | Qué es |
|--------|--------|--------|
| Pasarela de Pago | Ilimitado | datáfono/AgoraPay |
| Control de Efectivo | Ilimitado | cajón inteligente |
| **CoverManager** / **Eveve** | Ilimitado | **reservas** (integraciones externas) |
| **Delivery/Take Away** | Ilimitado | pedidos a domicilio/recogida |
| **Dispositivos** | **8** | nº de terminales licenciados (el único con tope) |
| **G‑Stock** | Ilimitado | app de stock/inventario |
| Servicios de Integración | Ilimitado | API/integraciones |
| Monitores de Cocina | Ilimitado | KDS |
| **My Ágora Premium** | Ilimitado | **backoffice en la nube / acceso remoto** |
| Balanzas Autónomas | Ilimitado | balanzas independientes |
| Carta Digital | Ilimitado | SmartMenu/QR |

---

## Qué significa para nosotros (modelo de negocio)

Ágora **monetiza por módulos + nº de dispositivos**, con licencia atada a la **máquina** (instalación local). Lecturas para Gluuh (SaaS multi‑tenant):

- **Licencia ≠ máquina, sino suscripción por tenant/local + dispositivos**: en la nube no licenciamos por huella de equipo; cobramos **suscripción** y, si acaso, por nº de terminales o volumen. Más simple y sin "ID de máquina".
- **Lo que Ágora cobra como add‑on, nosotros podemos incluirlo en base o por planes**:
  - **My Ágora Premium (acceso remoto)** es para nosotros **núcleo, no extra** — es el "gestionar desde casa" de [01 §1.1](01-arquitectura-y-plataforma/). Diferenciador: el acceso web remoto va **de serie**.
  - **Carta Digital, KDS, Delivery, Reservas** → candidatos a **planes/tiers** (Básico / Pro / Premium) o add‑ons.
- **Reservas**: Ágora lo resuelve **integrando terceros** (CoverManager, Eveve) en vez de módulo propio → decisión para nosotros: integrar vs construir (probablemente integrar al principio).
- **Declaración responsable VERIFACTU**: documento legal que el fabricante del software debe ofrecer (cumplimiento). **Nosotros también** debemos generar esa declaración — anotar en [07 — Facturación](../07-facturacion-y-cumplimiento-legal.md).
- **Servicios de Integración / API**: tener una **API pública** (tRPC/OpenAPI, ver `@gluuh/api-client`) es vendible y habilita integraciones (contabilidad, reservas, delivery aggregators).

## Mejoras / decisiones

- Modelo **SaaS por suscripción** (mensual/anual) con **planes por funcionalidad** + posible cargo por terminal/local; sin licencia por máquina.
- **Acceso remoto incluido** como gancho frente a Ágora (que lo cobra como *My Ágora Premium*).
- Página "Acerca de" propia: plan activo, módulos, **estado de cumplimiento VERIFACTU** y enlace a la declaración responsable.
