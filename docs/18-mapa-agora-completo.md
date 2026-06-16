# 18 · Mapa completo de Ágora → estado de Gluuh TPV

Transcripción de los menús reales de **Ágora 8.2.5** (capturas del cliente) y nuestro
estado: ✅ hecho · 🟡 parcial · ❌ falta. Sirve de checklist para "estar completos".

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
1. **Catálogo completo**: producto (foto/alérgenos/desc/código), **Menús 1º/2º/postre**, **Descuentos**, **Formas de Pago**.
2. **Cierre fiscal real**: persistir factura + `verifactu_record` (huella encadenada) + **Visor Verifactu**.
3. **Caja**: apertura/arqueo/**cierre Z** + control de efectivo.
4. **Permisos por perfil** (no solo UX, en RLS/RPC).
5. **Compras/Stock + escandallos** (módulo entero) — fase posterior.
