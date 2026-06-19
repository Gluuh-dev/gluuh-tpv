# Administración › Editar Local (= Configuración global)

> La pantalla **más densa** del configurador. ⚠️ **Aunque se titule "Editar Local", su contenido es CONFIGURACIÓN GLOBAL del negocio (nivel empresa/tenant), no ajustes del punto de venta físico.** Define el comportamiento por defecto de todo el sistema: pasarelas de pago, modos de pedido, VERIFACTU, **series de numeración**, recargo por servicio, propinas, stock, e‑commerce (SmartMenu), operativa de venta y **cierre de sistema (informe Z)**. Reconstruida de 3 capturas.

Captura: `Editar Local`.

## Decisión de modelado: ámbito GLOBAL, no por local

El usuario lo confirma: estos bloques son **configuración global**, no propiedades de una `location`. Por tanto en Gluuh:

- Viven como filas en **`setting` con `scope = 'GLOBAL'`** (clave/valor por `tenant_id`), **no** como columnas de `location`.
- Un negocio con **varios locales** puede **heredar** el valor global y, donde haga falta, **sobrescribirlo** con un `setting` de `scope = 'LOCAL'` para ese `location_id`. Herencia: `DEVICE > LOCAL > GLOBAL > default`.
- Ventaja: añadir una opción nueva es **insertar una clave**, no migrar el esquema. Ver [07 §modelo de datos de configuración](../../07-configuracion-y-administracion/).

> Por eso, donde abajo cada sección dice «por local», léase **«global, con override opcional por local»**. Las **series** y la **pasarela** son los casos típicos que sí conviene poder afinar por local/terminal.

**Bloques que contiene esta configuración global** (los 10 que confirma el usuario): Control de Stock · Operativa de Venta · Propinas Sugeridas · Recargo por Servicio · Configuración ECommerce (SmartMenu) · Cierre de Sistema · Configuración de Pedidos · Pasarela de Pago (Cobro en Mesa) · Series Administración Web · Series Puntos de Venta. (Más Pasarela Ágora Payments y VERI*FACTU, también globales.)

---

## 1. Pasarela de Pago (Ágora Payments)

**Ágora — qué muestra:** Pasarela (`Ágora Payments`), Comercio (`M1031958`), Tienda (`M1031958_SABORES_DE_LA_PALMA`), Clave, Clave Cliente (`live_…`), Id. Comercio Google. Enlace *«Configuración adicional para cuentas externas»* y botón **Comprobar credenciales**.

**Qué necesitamos:** soporte de pasarela configurable por local (Redsys/Stripe/proveedor), credenciales (comercio, tienda, claves) **cifradas**, y un botón de **test de credenciales**. Ver [../08-pasarelas-de-pago.md](../../08-pasarelas-de-pago.md).

**Mapeo:** `payment_gateway_config` por `location_id`; secretos **nunca** en claro en BD cliente — gestionados por `apps/api`. 🔴 falta.

**Mejora:** prueba de credenciales con feedback claro (✓/✗ y motivo); ocultar/mostrar claves; aviso si la pasarela no soporta el territorio.

---

## 2. Configuración de Pedidos (modos de venta)

**Ágora:** asocia cada **modo** a una configuración de cobro/flujo:
- Scan & Pay → `PAGO EN MESA`
- Pedido en Mesa → `PEDIDO EN MESA`
- Take Away → `PARA LLEVAR`
- Delivery → `DELIVERY`
- **Plantilla** → `Plantilla A4 Simple`

**Qué necesitamos:** los modos de venta (en mesa, para llevar, delivery, scan&pay/QR) habilitables por local, cada uno con su **plantilla de ticket/documento** y su flujo de cobro. Encaja con la operativa coloreada del TPV.

**Mapeo:** `sales_channel`/`order_mode` por local; plantilla → `ticket_template` (ver [04](../../04-impresion-y-tickets/)). 🟡 modos existen en operativa, configuración por local falta.

**Mejora:** activar/desactivar modo con un switch; previsualizar la plantilla asignada; QR de Scan&Pay generado por el sistema.

---

## 3. Pasarela de Pago (Cobro en Mesa)

**Ágora:** *Habilitar Pasarela de Pago (Cobro en Mesa)* + Configuración (`PAGO EN MESA`).

**Qué necesitamos:** habilitar pago en mesa (QR/datáfono) ligado a la pasarela del §1. **Mapeo:** flag en `location` + ref a config de pasarela. 🔴 falta.

---

## 4. VERI*FACTU

**Ágora:** sección colapsable (sin detalle en la captura) — activación del modo VERI*FACTU del local.

**Qué necesitamos:** **es nuestro punto fuerte.** Activar VERIFACTU por local, entorno (pruebas/producción AEAT), certificado mTLS, y estado de envío. El motor ya existe en `@gluuh/core` (huella encadenada + QR, vector AEAT). Ver [../07-facturacion-y-cumplimiento-legal.md](../../07-facturacion-y-cumplimiento-legal.md) y el Visor VERIFACTU ya en `apps/web`. ✅ motor / 🟡 configurador.

**Mejora:** panel de estado (registros emitidos, encolados offline, enviados a AEAT, errores) — algo que Ágora no enseña aquí.

---

## 5. Series de numeración (¡clave fiscal!)

**Ágora — Series Puntos de Venta:** Fra. Simp (`T`), Facturas (`F`), Dev. Simp (`TD`), Devoluciones (`FD`), Pedidos (`P`), Albaranes (`A`).

**Ágora — Series Administración Web:** *Permitir facturar desde la administración web* + Fra. Simp (`TW`), Facturas (`FW`), Dev. Simp (`TDW`), Devoluciones (`FDW`), Albaranes (`AW`).

**Qué necesitamos:** **series independientes por origen** (TPV vs web) y por tipo de documento, cada una con su contador. Esto conecta con el detalle de **[`series.md`](series.md)** y con la **serie por dispositivo** para cobro offline (ver [01 §4 — ticaje sin internet](../../01-arquitectura-y-plataforma/)). Sin huecos en la cadena VERIFACTU.

**Mapeo:** tabla `document_series` (nombre, tipo, siguiente_nº, origen TPV/WEB, en_uso) por `location_id`. 🔴 falta como configurador (la numeración legal sí está en `@gluuh/core`).

**Mejora:** asignar serie por **terminal** (no solo por local) para que varios TPV cobren offline sin pelear el número; aviso si se intenta borrar una serie «en uso».

---

## 6. Recargo por Servicio

**Ágora:** Porcentaje (`0.00`), Calcular sobre (`Impuestos incluidos`), *Ignorar descuentos en ticket*, Impuesto aplicable (`Reducido`).

**Qué necesitamos:** recargo opcional (terraza/servicio) con base (con/sin impuestos), trato de descuentos y **clase fiscal** del recargo (que hereda del catálogo vía `@gluuh/core`). **Mapeo:** ajustes en `location`/`setting`. 🔴 falta.

---

## 7. Propinas Sugeridas

**Ágora:** Tipo (`Ninguna` | porcentajes | importes — desplegable).

**Qué necesitamos:** propina sugerida configurable (ninguna / % / importes fijos), mostrada en cobro y en pago en mesa. **Mapeo:** `setting` por local. 🔴 falta. **Mejora:** propinas por forma de pago (ya se reporta en el cierre, §10).

---

## 8. Control de Stock

**Ágora:** *Mostrar aviso en el TPV al bajar del nivel mínimo de stock.*

**Qué necesitamos:** aviso de stock mínimo en TPV (enlaza con inventario, [06](../../06-compras-proveedores-e-inventario/)). **Mapeo:** flag local + `stock_item.stock_minimo`. 🟡 inventario modelado, aviso TPV falta.

---

## 9. Configuración ECommerce (SmartMenu)

**Ágora:** Pasarela de Pago (`Ágora Payments`), Comercio, Tienda, Clave, Clave Cliente — equivalente al §1 pero para la carta online/QR.

**Qué necesitamos:** carta digital / pedido online con su pasarela. Nuestro equivalente: `app/kiosko`/Scan&Pay y carta pública. **Mapeo:** `ecommerce_config` por local. 🟡 kiosko existe, e‑commerce/pasarela falta.

---

## 10. Operativa de Venta

**Ágora:**
- *Consolidar líneas de ticket al vender.*
- *Solicitar motivo al cancelar líneas preparadas o impresas.*
- *Facturas simplificadas limitadas a importe máximo* — `Sin límite` (el límite legal de factura simplificada en ES es 400 € general / 3.000 € algunos sectores).
- *Al crear clientes en el punto de venta:* `Asociar a todos los grupos de PV` / `Mostrar sólo en los grupos seleccionados` (con buscador + tabla Id/Nombre).

**Qué necesitamos:** todos. El de **motivo al cancelar** es importante para auditoría/anulaciones (ya tenemos informe de cancelaciones por usuario). **Mapeo:** flags en `location`/`setting`; agrupación de clientes → `customer_group`. 🟡 cancelaciones reportadas, flags de operativa faltan.

**Mejora:** validar el importe máximo de factura simplificada contra el límite legal y avisar; pedir motivo de cancelación con lista predefinida + libre.

---

## 11. Cierre de Sistema (informe Z) — checklist

**Ágora — qué incluir en el cierre:**
- ☑ Ventas por centro de venta
- ☑ Datos de comensales
- ☑ Resumen de ventas por usuario
- ☑ Datos de invitaciones
- ☑ Cancelaciones por usuario
- ☑ Cobros por usuario
- ☑ Propinas por forma de pago
- ☑ Devoluciones por producto
- ☑ Ventas por familia (☑ Desglosar por producto · ☑ Utilizar datos de albarán)
- ☑ Operaciones pendientes de cobro
- ☐ Datos de repartidores
- ☑ Cuadre de caja
- ☑ **Activar cierre automático** → Hora de Cierre `05:00`
- ☑ Terminar preparaciones pendientes
- ☐ Imprimir diario de ventas

**Qué necesitamos:** un **cierre Z configurable** (qué bloques incluye) + cierre automático a una hora. **Buenas noticias:** ya tenemos como informes reales muchos de estos bloques (ventas por familia/producto, cancelaciones por usuario, propinas por forma de pago, cuadre de caja, invitaciones, rendimiento de usuarios). Falta **empaquetarlos como un único "Cierre Z" configurable** y el **cierre automático programado**.

**Mapeo:** `cash_session`/cierre + `setting` con los flags de bloques; job de cierre automático en `apps/api`. 🟡 informes existen, ensamblado Z + automático falta.

**Mejora:** un único documento Z con los bloques marcados; export PDF; envío automático por email al cierre.

---

## 12. Preparación programada de pedidos

**Ágora:** sección colapsable (sin detalle) — programar pedidos para una hora (delivery/recogida).

**Qué necesitamos:** pedidos con hora de preparación/recogida → al KDS en el momento correcto (enlaza [05](../../05-cocina-kds-y-comanderas/)). 🔴 falta.

---

## Resumen accionable de esta pantalla

| Bloque | Estado | Acción |
|--------|:--:|--------|
| Pasarela pago / cobro en mesa | 🔴 | Modelar `payment_gateway_config` + test credenciales |
| Modos de venta + plantilla | 🟡 | Config por local + asignar plantilla de ticket |
| VERIFACTU | ✅🟡 | Motor listo; falta panel de estado/config por local |
| **Series de numeración** | 🔴 | `document_series` por local **y por terminal** (offline) |
| Recargo servicio / propinas | 🔴 | Ajustes en `setting` |
| Aviso stock mínimo | 🟡 | Flag + enlazar inventario |
| Operativa de venta | 🟡 | Flags + motivo de cancelación + límite fra. simplificada |
| **Cierre Z** | 🟡 | Ensamblar informes existentes + cierre automático |
| Preparación programada | 🔴 | Pedidos con hora → KDS |

> Decisión de diseño (recordatorio): en Gluuh, **casi todo esto son filas en `setting` con `scope = 'GLOBAL'`** (clave/valor por `tenant_id`), no columnas nuevas en `location` por cada flag. Multi‑local hereda lo global y sobrescribe puntualmente con `scope = 'LOCAL'`. Así "todo configurable" no implica migración por cada opción nueva. Ver [07 §modelo de datos](../../07-configuracion-y-administracion/).
