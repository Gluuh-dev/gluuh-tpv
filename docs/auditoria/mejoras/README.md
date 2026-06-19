# Mejoras — cómo superamos a Ágora con nuestro estilo

> Destilación de todas las **"Mejoras sobre Ágora"** dispersas en las ~56 fichas de [`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/), unificadas por área y reescritas con **nuestra dirección de diseño**: más intuitivo, más configurable, y explicando **para qué sirve cada cosa**. No es una lista de quejas a Ágora; es **qué construimos mejor y por qué**.

---

## Nuestra filosofía (lo que nos diferencia)

1. **Dos niveles de interfaz, una sola base de código.**
   - **Backoffice (gestión, "desde casa")** — estilo **Supabase/Notion**: limpio, oscuro, verde de marca `#34B27B`, denso pero legible, basado en componentes shadcn. Para configurar y analizar.
   - **Operativa (en el local, "a pantalla completa")** — **colorida y con la marca del cliente**: botones grandes, táctil, rápida, sin distracciones. Para vender.
   - Ver [GUIA_DISENO_COMPLETA](../../GUIA_DISENO_COMPLETA.md) y [01 §1.1 — el binomio](../01-arquitectura-y-plataforma/).

2. **Más intuitivo que Ágora.** Ágora es potente pero **denso y técnico** (formularios eternos, conceptos solapados como "familia oculta = añadido"). Nosotros: asistentes, valores por defecto sensatos, **drag‑and‑drop**, vista previa en vivo, y **explicar para qué sirve** cada opción en la propia UI.

3. **Todo configurable sin migraciones.** Casi todo ajuste es una fila en **`setting` (clave/valor por ámbito GLOBAL/LOCAL/DEVICE)**, no una columna nueva por cada casilla → añadir una opción es insertar una clave. Ver [07 — Configuración](../07-configuracion-y-administracion/).

4. **Offline‑first y acceso remoto de serie.** Lo que Ágora cobra como extra (*My Ágora Premium* = acceso remoto), nosotros lo damos en base. El local nunca se cae; se cobra y emite VERIFACTU sin internet ([01 §4](../01-arquitectura-y-plataforma/)).

5. **Cumplimiento fiscal integrado, no añadido.** VERIFACTU + IGIC en el flujo de cobro, con verificación de cadena y serie por terminal para offline.

6. **Rentabilidad, no solo registro.** Informes que dicen **qué hacer** (Menú Engineering, márgenes), no solo "cuánto vendí".

---

## Índice por área

| # | Área | Documento |
|---|------|-----------|
| 01 | Diseño y experiencia (estilo, navegación, configurabilidad) | [`01-diseno-y-experiencia.md`](01-diseno-y-experiencia.md) |
| 02 | Catálogo, carta y precios (productos, modificadores, menús, alérgenos, carta digital, tarifas) | [`02-catalogo-carta-y-precios.md`](02-catalogo-carta-y-precios.md) |
| 03 | Operativa TPV, mesas y cobro (sala, formas de pago, modos de pedido, clientes) | [`03-operativa-tpv-mesas-y-cobro.md`](03-operativa-tpv-mesas-y-cobro.md) |
| 04 | Cocina, KDS y comanderas (estaciones, pases, notas, monitores) | [`04-cocina-kds-y-comanderas.md`](04-cocina-kds-y-comanderas.md) |
| 05 | Compras e inventario (proveedores, almacenes, documentos, escandallo) | [`05-compras-e-inventario.md`](05-compras-e-inventario.md) |
| 06 | Fiscalidad, plataforma, informes y negocio (VERIFACTU, offline, multi‑dispositivo, informes, licencia) | [`06-fiscalidad-plataforma-informes-y-negocio.md`](06-fiscalidad-plataforma-informes-y-negocio.md) |

> Cada documento sigue el patrón: **Para qué sirve · Cómo lo hace Ágora · Cómo lo mejoramos (nuestro estilo + más intuitivo) · Prioridad**. El **cómo construirlo** va en [`../implementacion/`](../implementacion/).
