# 18 · Mapa completo de Ágora → estado de Gluuh TPV

Transcripción de los menús reales de **Ágora 8.2.5** (capturas del cliente) y nuestro
estado: ✅ hecho · 🟡 parcial · ❌ falta. Sirve de checklist para "estar completos".

> **Actualización 04-07-2026**: gran tanda de configuración del backoffice completada
> (migraciones 0045-0055, todas aplicadas). Ver `docs/implementacion/11-configuracion-backoffice.md`.
> Cerrados desde este mapa: Productos (foto/alérgenos/formatos/modificadores/nombres de
> impresión/estación), Alérgenos, Tarifas (precio real por tarifa), Promociones (reglas),
> Descuentos, Perfiles con permisos, Config de Botones, Ordenar catálogo, VERIFACTU (UI),
> Control de Efectivo (UI), Auditoría, Plantillas de Ticket (diseñador real), Formas de
> Pago (tipo/cajón/arqueo), Series (multi-serie). Nuevo no-Ágora: **sistema de licencias
> por código**, **zona técnica con clave**, **4 diseños de kiosko**, **pantallas
> configurables** y **anti-fraude de precios server-side**.

## Administración

### General
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Empresa | ✅ Ajustes (tenant/location) | — |
| Series | 🟡 `location.serie_factura` (sin gestor multi-serie) | media |
| Configuración Global | 🟡 disperso en Ajustes | media |
| Plantillas de Ticket | ❌ | alta |
| Plantillas de Etiquetas | ❌ | baja |
| Grupos de Periodos de Servicio | ❌ (turnos: comida/cena) | media |
| Tipos de Clientes | ❌ | baja |
| Clientes | ❌ (tabla cliente + ficha) | media |
| Grupos de Puntos de Venta | ❌ | baja |
| Puntos de Venta | 🟡 (1 location; falta multi-TPV) | media |
| Administración Web | ✅ (esto es la web) | — |

### Usuarios
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Perfiles de Usuario (permisos) | 🟡 roles fijos, sin permisos finos | alta |
| Usuarios | ✅ Empleados (PIN) | — |

### Catálogo
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Grupos Mayores | ❌ (nivel por encima de familia) | baja |
| Familias | ✅ | — |
| Categorías | ✅ | — |
| Productos | 🟡 básico (falta foto, alérgenos, descripción, código barras, canal) | alta |
| Menús (1º/2º/postre) | ❌ (sin tabla) | alta |
| Alérgenos | ❌ (14 UE) | alta |
| Etiquetas Productos | ❌ | baja |

### Tarifas y Precios
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Impuestos | ✅ `tax_rate` + IVA automático | — |
| Formas de Pago | 🟡 (efectivo/tarjeta fijos, sin tabla) | alta |
| Centros de Venta | ❌ | media |
| Tarifas (precio por sala/horario) | ❌ | media |
| Promociones | 🟡 `offer` es cartelería, no precio | media |
| Descuentos | ❌ | alta |

### Comandas
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Plantillas de Comandas | ❌ | media |
| Notas de Preparación | 🟡 `order_line.notas` (sin catálogo) | baja |
| Motivos de Cancelación | ❌ | media |
| Tipos / Órdenes de Preparación (pases) | ❌ | media |
| Monitores de Cocina | ✅ KDS (`/cocina`) | — |

### Entradas (control de aforo/tickets de evento)
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Plantillas de Entradas / Entradas | ❌ | baja |

## Compras y Stocks  → ❌ TODO el módulo
Almacenes, Proveedores, Unidades de Medida, Pedidos a Proveedor, Albaranes, Facturas de
Proveedor, Regularización de Inventario, Variaciones de Stock, **Fabricaciones (escandallos)**,
Histórico de Movimientos, Cierres de Almacén. → **falta entero** (prioridad media; escandallos+stock alta si controlan mermas).

## Herramientas
| Ágora | Nuestro | Prioridad |
|---|---|---|
| Ordenar Familias/Categorías/Productos | 🟡 campo `orden`, sin UI drag | baja |
| Configuración de Botones (TPV) | ❌ (colores/orden botones) | media |
| Acciones Personalizadas | ❌ | baja |
| Planos de Mesas | ❌ (editor visual de sala) | media |
| Precios: import/export Excel, modif. global, márgenes | ❌ | baja |
| Programación de Tarifas | ❌ | baja |
| Formación | ❌ | baja |
| Copias de Seguridad | ✅ (lo hace Supabase) | — |
| **VERI*FACTU: Visor / Configuración** | 🟡 motor en core, sin UI ni persistencia | **alta** |
| Control de Efectivo (caja) | ❌ UI (tablas existen) | **alta** |
| Pasarela de Pago / Cobro en Mesa | ❌ (datáfono/Redsys) | media |
| Cartas Digitales + QR de Pago/Pedidos | 🟡 kiosko/ofertas (sin QR mesa) | media |
| Auditoría / Log | ❌ | baja |

## Informes  → 🟡 básico
Tenemos ventas básicas. Ágora trae decenas: Análisis (ventas/compras/stock), Ventas (evolución,
comparativa, **Resumen Fiscal**, invitaciones, reservas, **347**, estado TicketBAI), Catálogo
(márgenes, **Menú Engineering**, Top 50), Usuarios (rendimiento, propinas, cancelaciones,
asistencia), Caja (formas de pago, movimientos, cobros pendientes, propinas, transacciones tarjeta),
Clientes, Almacén, Cocina (tiempos), Diarios (facturas, pedidos, cierres de caja). → ampliar por fases (media).

## Resumen: bloques que más nos acercan a Ágora (alta prioridad)
1. ✅ **Catálogo completo**: producto (foto/alérgenos/desc/código/formatos/modificadores/
   nombres de impresión), **Descuentos**, **Formas de Pago**. 🟡 Queda **Menús 1º/2º/postre**
   (existe editor `/menus`, revisar cobertura).
2. 🟡→**pendiente clave**: **Cierre fiscal real** — persistir factura + `verifactu_record`
   (huella encadenada) + activar `VERIFACTU_ACTIVO`. UI de config y visor ✅; el motor
   está en `@gluuh/core`. **Requiere certificado AEAT (tarea del instalador).**
3. 🟡 **Caja**: UI de configuración ✅ (`/configuracion-de-caja`) y control de caja ✅;
   falta que el TPV/arqueo **consuman** los flags (`caja.*`, `abre_cajon`, `cuenta_arqueo`).
4. ✅ **Permisos por perfil** (UI + `perfil.permisos`, 0048). 🟡 Falta aplicarlos en
   **RLS/RPC server-side** (hoy es gating de UI; ver auditoría de seguridad A1).
5. ❌ **Compras/Stock + escandallos** (módulo entero) — fase posterior, sigue pendiente.

### Pendientes que dependen del rediseño del TPV (en curso por el usuario) o del instalador
- Cablear en el TPV: `tpv.botones`, `caja.*`, tarifas en Cons. propio, promociones al
  vender, chips de anotaciones (`nota_preparacion`), `nombre_ticket`/`nombre_cocina` y
  logo al imprimir, token en `/api/ticket`, y persistir descuento/`cancel_reason`.
- Escritorio (`apps/desktop`): leer `backup.*`/`impresora.*` de `setting`; modo kiosko
  que bloquee consola (seguridad C2); logo en ESC/POS (`packages/hardware`).
- Activación real de VERIFACTU con certificado (guía `01-activar-verifactu.md`).
