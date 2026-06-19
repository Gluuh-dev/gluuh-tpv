# Auditoría — Guía profesional para construir un TPV de hostelería completo

> Guía de construcción **autocontenida y accionable** para llevar Gluuh TPV a un punto de venta de hostelería *perfecto y fácil de usar*: plataforma, interfaz táctil, catálogo con modificadores/añadidos/alérgenos, impresión y diseño de tickets, cocina/KDS, compras e inventario, y configuración total.
>
> Complementa —no sustituye— la documentación de producto y arquitectura en [`../`](../). Donde un tema ya está cubierto, esta guía profundiza en el **cómo hacerlo** y enlaza al doc original.

---

## Cómo leer esta carpeta

Cada subcarpeta es un área de construcción independiente con su propio `README.md`
detallado (decisiones, esquema de datos, ejemplos, maquetas). Orden recomendado de
lectura para implementar de cero; orden libre como referencia.

| # | Carpeta | Qué resuelve |
|---|---------|--------------|
| 01 | [`01-arquitectura-y-plataforma/`](01-arquitectura-y-plataforma/) | ¿App web, PWA instalable o nativa/escritorio? Offline-first, kiosco, multi-dispositivo. **La decisión de plataforma.** |
| 02 | [`02-interfaz-tactil/`](02-interfaz-tactil/) | Diseño de UI táctil para que vaya rápido y sea fácil: tamaños, flujos, wireframes de TPV/comandera/KDS/cliente. |
| 03 | [`03-catalogo-productos-y-modificadores/`](03-catalogo-productos-y-modificadores/) | **El corazón.** Productos, variantes, modificadores y añadidos con extra de precio, ingredientes, alérgenos, menús y notas de cocina. |
| 04 | [`04-impresion-y-tickets/`](04-impresion-y-tickets/) | Impresoras ESC/POS, enrutado por estación, diseño de tickets y **los 3 nombres por producto** (carta / ticket cliente / cocina). |
| 05 | [`05-cocina-kds-y-comanderas/`](05-cocina-kds-y-comanderas/) | Pantallas de cocina (KDS), comandera de camarero, pantalla de cliente y tiempo real. |
| 06 | [`06-compras-proveedores-e-inventario/`](06-compras-proveedores-e-inventario/) | Proveedores, compras, recepción, escandallo/food-cost e inventario. |
| 07 | [`07-configuracion-y-administracion/`](07-configuracion-y-administracion/) | "Todo configurable": backoffice, multi-local, roles y permisos, salas/mesas, caja. |
| 08 | [`08-roadmap-de-implementacion/`](08-roadmap-de-implementacion/) | Plan por fases, dependencias entre módulos y checklist maestro de "TPV completo". |

---

## Principios que atraviesan toda la guía

1. **Más rápido que el papel.** Cada decisión de UI se mide en toques y segundos por comanda y por cobro.
2. **Offline-first innegociable.** En hora punta el TPV no puede caerse: SQLite local + sincronización + servidor LAN; la nube es la fuente de verdad, no la dependencia operativa.
3. **Todo es dato configurable, no código.** Carta, impuestos, modificadores, estaciones, impresoras, plantillas de ticket, salas, permisos: editables en backoffice por el cliente.
4. **Una sola fuente de lógica.** El "cerebro" (impuestos IVA/IGIC, VERIFACTU, estados de comanda) vive en [`@gluuh/core`](../../packages/core); las apps no duplican esa lógica.
5. **Cumplimiento fiscal de serie.** VERIFACTU (huella encadenada + QR AEAT) e IGIC canario integrados en el flujo de cobro, no como añadido. Ver [`../07-facturacion-y-cumplimiento-legal.md`](../07-facturacion-y-cumplimiento-legal.md).

---

## Relación con los documentos existentes

Esta auditoría se apoya en los docs de producto ya escritos. Referencias rápidas:

- Arquitectura y stack → [`../04-arquitectura-tecnica.md`](../04-arquitectura-tecnica.md), [`../05-stack-tecnologico.md`](../05-stack-tecnologico.md)
- Base de datos y sincronización → [`../06-base-de-datos-y-sincronizacion.md`](../06-base-de-datos-y-sincronizacion.md)
- Hardware → [`../09-hardware.md`](../09-hardware.md)
- Comanderas, KDS e impresión → [`../10-comanderas-kds-e-impresion.md`](../10-comanderas-kds-e-impresion.md)
- Pantallas cliente/kiosko/KDS → [`../14-pantallas-cliente-kiosko-y-kds.md`](../14-pantallas-cliente-kiosko-y-kds.md)
- Configuración de campos y páginas → [`../16-configuracion-campos.md`](../16-configuracion-campos.md), [`../17-paginas-creacion-configuracion.md`](../17-paginas-creacion-configuracion.md)
- Roadmap y plan de construcción → [`../13-roadmap-mvp-y-equipo.md`](../13-roadmap-mvp-y-equipo.md), [`../19-plan-construccion.md`](../19-plan-construccion.md)
