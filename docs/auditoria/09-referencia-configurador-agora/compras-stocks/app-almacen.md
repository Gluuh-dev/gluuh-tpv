# Compras y Stocks › App de Almacén (PWA táctil)

> **App operativa de almacén** independiente del backoffice: una pantalla táctil con botones grandes para que el personal haga **recepciones, recuentos, mermas y traspasos** sobre tablet/lector, sin entrar al configurador. Ruta `…/#/warehouse/app` (servidor **LAN** `172.16.2.83:8984`). Es la versión "operativa" de [06 — Inventario](../../06-compras-proveedores-e-inventario/), análoga a cómo el TPV es la operativa de ventas.

Capturas: `warehouse/app` (home de la app de almacén).

---

## Ágora — qué muestra

Home con **5 acciones** (botones táctiles grandes), usuario `admin` arriba:

| Botón | Operación |
|-------|-----------|
| 🛒 **PEDIDOS** | crear/recibir pedidos a proveedor |
| 📦 **ALBARANES** | recepción de mercancía (albarán de entrada) |
| ♻ **MERMAS** | registrar pérdidas/desperdicio |
| 🧊 **INVENTARIOS** | recuento de existencias |
| 🚚 **TRASPASOS** | mover stock entre almacenes |

> Mismas entidades que el módulo de compras/stock del backoffice ([documentos-compra.md](documentos-compra.md), [inventario.md](inventario.md)), pero con **UI táctil de operación** pensada para el almacén (igual que el TPV vs el configurador).

---

## Qué significa para nosotros

Esto **valida el patrón de [01 §1.1](../../01-arquitectura-y-plataforma/)** también para el almacén: una **app de operación** táctil, instalable y **offline‑first**, separada de la configuración web. En Gluuh sería una superficie más (`app/almacen`) que comparte modelo (`@gluuh/core`/Supabase) y sincroniza por PowerSync.

- **Pantalla completa / kiosco** en tablet con lector de códigos.
- **Offline‑first**: contar y recibir sin depender de internet; sincroniza al reconectar ([01 §4](../../01-arquitectura-y-plataforma/)).
- Reusa `stock_movement` / `goods_receipt` / `stock_variation` ([inventario.md](inventario.md)). 🔴 falta (no existe app de almacén aún).

## Mejoras sobre Ágora

- **Escaneo de código de barras** con la cámara (PWA) para recibir/contar más rápido.
- **Recuento ciego** (sin ver el teórico) y por ubicaciones, con conciliación al cerrar.
- Una sola base de código con el resto de apps táctiles (TPV/comandera/KDS), envuelta en kiosco.
