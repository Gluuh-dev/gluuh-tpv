# Administración › Plantillas de Ticket

> Editor visual de **plantillas de documento** (ticket 80mm, factura A4, recibo datáfono 56mm…). Define formato base, idioma, cabecera (logo + textos), pie, y una **larga lista de parámetros de impresión** (qué se imprime y cómo), con **vista previa en vivo** y botón de prueba de impresión. Es el complemento de configuración de **[04 — Impresión y tickets](../../04-impresion-y-tickets/)**.

Capturas: `Plantillas de Ticket` (listado) + `Editar Plantilla de Ticket` (editor + vista previa).

---

## A. Listado de plantillas

**Ágora — qué muestra:** tabla **Id · Nombre · Tipo · Plantilla Base** + acciones **Nuevo · Copiar · Editar · Eliminar · Buscar**.

| Id | Nombre | Tipo | Plantilla Base |
|----|--------|------|----------------|
| 1 | Plantilla Por Defecto | Esc/Pos (Térmica/Matricial) | Rollo Papel **80mm, 48 columnas** |
| 2 | Plantilla A4 Simple | Inyección/Láser | Plantilla básica **A4** |
| 4 | Plantilla Datafonos | Esc/Pos (Térmica/Matricial) | Rollo Papel **56mm, 32 columnas** |

**Qué necesitamos:** varias plantillas reutilizables, cada una de un **tipo de impresora** (ESC/POS térmica vs A4 láser) y un **ancho base** (80mm/48col, 56mm/32col, A4). Se asignan luego a los modos de venta y a las impresoras (ver [`locales.md` §2](locales.md) y [04](../../04-impresion-y-tickets/)).

**Mapeo:** tabla `ticket_template` (id, nombre, tipo, base, idioma, cabecera jsonb, pie jsonb, params jsonb) por `tenant_id`. 🔴 falta como editor (la lógica de render de ticket está en `app/api/factura` y [04]).

**Mejora:** **Copiar** plantilla (Ágora ya lo tiene) + plantillas de sistema no borrables; al borrar una en uso, avisar.

---

## B. Editor — Información Básica

**Ágora:** Nombre (`Plantilla Por Defecto`), **Plantilla Base** (`Rollo Papel 80mm, 48 columnas` — desplegable con 56mm/80mm/A4), **Idioma** (`Español`).

**Qué necesitamos:** los tres. El **ancho base** fija las columnas de render (32/48) o el layout A4; el **idioma** traduce literales fijos del ticket (no los nombres de producto, que tienen su propio idioma de cocina, ver más abajo).

---

## C. Editor — Cabecera y Pie (bloques componibles)

**Ágora:** cabecera y pie se montan con **bloques** que se añaden, reordenan (**Mover**) y borran:
- **+Imagen** → logo (tamaño recomendado **512×192 px**).
- **+Texto** → líneas con formato por botones **B** (negrita), **U** (subrayado), **T/T!** (tamaño normal/grande).
- Cabecera de ejemplo: logo `lapalma` · `SABORES DE LA PALMA` · `B13637558 - 608 334 352` · `CTR. NACIONAL 340, KM 342 S/N`.
- Pie de ejemplo: `GRACIAS POR SU VISITA`.

**Qué necesitamos:** editor de cabecera/pie por bloques (imagen + textos con negrita/subrayado/tamaño), **reordenables**. Los datos del emisor pueden autocompletarse desde **[Empresa](empresa.md)** (no reescribir el NIF a mano).

**Mapeo:** `ticket_template.cabecera`/`.pie` = array de bloques `{tipo:'texto'|'imagen', valor, estilo:{bold,underline,size}}`. 🔴 falta.

**Mejora:** insertar **variables** en los textos (`{nombre_fiscal}`, `{nif}`, `{direccion}`, `{web}`) que se rellenan desde Empresa/Local — así cambiar el NIF en un sitio actualiza todas las plantillas.

---

## D. Editor — Parámetros de Impresión (la lista completa)

Casillas que controlan **qué se imprime**. Transcripción fiel (☑ = marcada en la captura de *Plantilla Por Defecto*):

| # | Parámetro | Demo | Nuestro equivalente / nota |
|---|-----------|:--:|------|
| 1 | Imprimir aviso en tickets **no cobrados** | ☐ | Marca "PENDIENTE DE COBRO" (precuenta) |
| 2 | Imprimir información de los **comensales** | ☐ | Nº de comensales |
| 3 | Imprimir como **invitación** los productos de **precio cero** + *Texto a mostrar* (`INVITADO`) | ☑ | Líneas a 0 € → "INVITADO" (ver preview) |
| 4 | Imprimir las **notas** asociadas a las líneas | ☐ | **Notas de cocina** en ticket cliente (normalmente solo en cocina, ver [03](../../03-catalogo-productos-y-modificadores/)) |
| 5 | Imprimir la **hora** en el documento | ☑ | |
| 6 | Imprimir **nombre de usuario** | ☑ | Camarero/cajero |
| 7 | Imprimir **desglose de impuestos** | ☑ | Base + cuota por tipo (IVA/IGIC) — **obligatorio fiscal** |
| 8 | Imprimir **líneas consolidadas** | ☑ | Agrupar iguales (coincide con "Consolidar líneas" de operativa) |
| 9 | Imprimir **código de barras** identificativo | ☐ | Barcode del nº de documento |
| 10 | Imprimir **desglose por Grupo Mayor** | ☐ | Agrupar por familia/grupo |
| 11 | Imprimir **Id del ticket** además del nº de documento | ☐ | Id interno |
| 12 | **Mostrar ubicación** del documento | ☑ | Salón/Mesa (ver preview `Salón/Mesa 1`) |
| 13 | Imprimir **número de pedido a cocina** | ☐ | Liga con KDS/comanda |
| 14 | Imprimir **desglose de líneas de menú** | ☐ | Despiece de combos/menús (ver [03 menús]) |
| 15 | Imprimir **referencia del artículo** | ☐ | SKU/referencia |
| 16 | Imprimir **tipo de impuesto por cada línea** | ☐ | Marca IVA/IGIC por línea |
| 17 | Imprimir **detalle de albaranes** en factura | ☑ | Para factura agrupada de albaranes |
| 18 | Imprimir **propina sugerida** | ☐ | (ver propinas en [`locales.md` §7]) |
| 19 | Imprimir **propina registrada** | ☐ | |
| 20 | Imprimir **información de pagos previos** | ☐ | Anticipos/pagos parciales |
| 21 | **Ocultar información de precios** | ☐ | Ticket sin precios (p. ej. regalo) |
| 22 | **Orden líneas** (desplegable) | `Por Defecto` | Por defecto / por estación / por orden de adición |
| 23 | Imprimir **QR de Scan&Pay** | ☐ | QR para pago/propina por móvil |
| 24 | Imprimir **entradas consumidas** en la línea | ☐ | Para entradas/abonos |
| 25 | Imprimir **QR de facturación** | ☐ | QR para que el cliente pida factura completa |

> **Nuestro modelo:** todo esto = `ticket_template.params` (jsonb de flags). 🔴 falta como configurador; el render fiscal (desglose de impuestos + **QR VERIFACTU**, que en Ágora se llama "VERI*FACTU" en el pie) ya está cubierto por `@gluuh/core` y [04]. **El QR VERIFACTU es obligatorio y va siempre**, no es opcional como el "QR de facturación" de Ágora.

---

## E. Vista previa + impresión de prueba

**Ágora:** panel **Vista Previa** que renderiza el ticket en vivo con datos de ejemplo (logo, `FACTURA SIMPLIFICADA`, `Nº Op. T-1`, `Salón/Mesa 1`, fecha/usuario, líneas con descuentos `Dto.`, lotes, menú del día, línea `INVITADO`, desglose `7%/16% Base/Cuota`, `Total (Impuestos Incl.)`, entregado/cambio, formas de pago, datos de cliente, pie, **VERI*FACTU + QR**). Selector **Impresora** (`Ágora Printer`) + botón **Imprimir** (prueba).

**Qué necesitamos:** **vista previa en vivo** (gran ventaja de UX) y **botón de impresión de prueba** a una impresora elegida. Ya recomendado en [04] y [02 — Interfaz].

**Mejora:** previsualizar a la vez en **80mm y A4**; datos de ejemplo realistas con IGIC para el mercado canario; resaltar en la preview qué activa cada casilla al marcarla.

---

## Resumen accionable

| Bloque | Estado | Acción |
|--------|:--:|--------|
| Listado + copiar plantillas | 🔴 | CRUD `ticket_template` + acción Copiar |
| Formato base (80/56mm/A4) + idioma | 🔴 | Enum de bases; idioma de literales |
| Cabecera/pie por bloques + logo + variables | 🔴 | Editor de bloques con `{variables}` desde Empresa |
| 25 parámetros de impresión | 🔴 | `params` jsonb + render en `app/api/factura` |
| Desglose impuestos + QR VERIFACTU | ✅ | Ya en `@gluuh/core`/[04]; QR VERIFACTU **siempre** |
| Vista previa en vivo + impresión de prueba | 🔴 | Preview render + test print |

> Conexión clave con [03] y [04]: aquí se decide **qué nombre del producto** se imprime (#4 notas, #13 nº a cocina, #15 referencia) — recuerda los **3 nombres por producto** (carta / ticket cliente / cocina). La plantilla de **cocina** activará notas y nº de pedido; la de **cliente**, desglose de impuestos y QR VERIFACTU.
