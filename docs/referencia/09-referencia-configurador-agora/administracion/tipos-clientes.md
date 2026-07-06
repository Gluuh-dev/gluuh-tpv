# Administración › Tipos de Clientes

> Catálogo de **tipos/grupos de cliente** para clasificar la cartera (empresa, particular, mayorista, repartidor, «Pedidos»…). Sirve para filtrar, aplicar tarifas/descuentos por grupo y decidir visibilidad en el TPV.

Captura: `Tipos de Clientes` → *Listado*.

---

## Ágora — qué muestra

Tabla **Id · Nombre** + acciones **Nuevo · Copiar · Editar · Eliminar · Buscar**.

| Id | Nombre |
|----|--------|
| 1 | Pedidos |

(CRUD simple; un solo tipo dado de alta en este negocio.)

---

## Qué necesitamos

- CRUD de **grupos de cliente** reutilizables.
- Conecta con *Editar Local → Operativa de Venta → «Al crear clientes en el punto de venta: asociar a todos los grupos / solo a seleccionados»* (ver [`locales.md` §10](locales.md)).
- Base para **tarifas/precios por grupo** y descuentos (clientes mayoristas, personal, etc.).

## Mapeo a nuestro modelo

- Tabla `customer_group` (id, tenant_id, nombre) — multi‑tenant RLS.
- FK desde `customer.group_id`. Opcional: `price_list_id` por grupo para tarifas diferenciadas.
- 🔴 falta.

## Mejoras sobre Ágora

- Asociar **lista de precios/tarifa** y **descuento por defecto** al grupo (Ágora aquí solo guarda el nombre).
- Marcar grupos visibles/ocultos en TPV y en la carta online (SmartMenu).
