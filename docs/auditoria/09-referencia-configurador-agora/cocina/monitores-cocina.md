# Cocina › Monitores de Cocina (KDS) ★

> Configuración de cada **pantalla de cocina (KDS)**: qué centros, estaciones y pases muestra, su impresora de respaldo, los botones de la partida y el modo de visualización. Es el configurador directo de nuestra app `cocina`/`kds` ([05 — Cocina/KDS](../../05-cocina-kds-y-comanderas/)).

Capturas: `Monitores de Cocina` (listado) + `Editar Monitor de Cocina` (2 capturas).

---

## A. Listado
**Id · Nombre · Tipo**: `MONITOR` / `Restaurante (por ubicación)`. (Tipo también puede ser fast‑food/por pedido.)

## B. Editar Monitor — secciones

### 1. Monitor de Cocina
- **Nombre** (`MONITOR`) · **Tipo** (`Restaurante (por ubicación)` — agrupa por mesa/ubicación; otros tipos agrupan por pedido).

### 2. Centros de Venta
- Lista de **centros** que atiende este monitor (General, Reservado, Auxiliar, C‑09:40…). Liga con [centros-de-venta.md](../administracion/centros-de-venta.md).

### 3. Opciones de Impresión (respaldo)
- **Impresora** (`PR_COCINA`) · **Imprimir** (`Al completar comanda`) · ☑ **Consolidar líneas al imprimir**.

### 4. Tipos de Preparación (estaciones que muestra)
- Lista de **estaciones** (`Cocina`, `Tostadas`) — el monitor solo enseña líneas de esas estaciones ([estaciones-y-pases.md](estaciones-y-pases.md)).

### 5. Órdenes de Preparación (pases que muestra)
- Lista de **pases** (`Primeros`…`Quintos`).

### 6. Opciones de Visualización
| Opción | Demo |
|--------|------|
| ☐ Mostrar líneas consolidadas | |
| ☑ Mostrar botón de **iniciar** preparación | |
| ☑ Mostrar botón de **finalizar** preparación | |
| ☐ Mostrar botón de **servir** preparación | |
| ☑ Mostrar botón de **imprimir orden** de preparación | |
| **Modo de Visualización** | `Clásico` (vs columnas/tarjetas) |
| **Incluir Comandas** | `Por la derecha` (dirección de entrada de comandas nuevas) |
| **Estados Principales** | `Enviada a cocina`, `En preparación` (qué estados se ven arriba) |
| **Estados Secundarios** | *(vacío)* |
| ☑ **Marcar automáticamente como servido al finalizar preparación** | |

### 7. Estilos Personalizados (reglas condicionales)
- Tabla **Condición · Afecta · Estilo**: p. ej. "si espera > 10 min → fondo rojo". Colores/alertas por tiempo, exactamente el **cronómetro por colores** de [05].

---

## Mapeo a nuestro modelo

```sql
create table kitchen_monitor (           -- "Monitor de Cocina" (KDS)
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  tipo text default 'RESTAURANTE_UBICACION',   -- vs FASTFOOD_PEDIDO
  printer_id uuid, imprimir text default 'AL_COMPLETAR',
  consolidar_impresion boolean default true,
  -- visualización
  btn_iniciar boolean default true, btn_finalizar boolean default true,
  btn_servir boolean default false, btn_imprimir boolean default true,
  modo_visualizacion text default 'CLASICO',
  incluir_comandas text default 'DERECHA',
  estados_principales text[], estados_secundarios text[],
  marcar_servido_auto boolean default true
);
create table kitchen_monitor_scope (     -- centros/estaciones/pases que muestra
  monitor_id uuid references kitchen_monitor(id),
  sales_center_id uuid, prep_station_id uuid, prep_course_id uuid
);
create table kitchen_monitor_style (     -- "Estilos Personalizados"
  monitor_id uuid references kitchen_monitor(id),
  condicion jsonb,                       -- p.ej. {espera_min: {gt: 10}}
  afecta text, estilo jsonb              -- {bg:'red'}
);
```

- Datos en tiempo real vía **Supabase Realtime / Socket.IO** (eventos) + persistencia (PowerSync), como [05] §arquitectura. Funciona en **LAN** aunque caiga internet. 🟡 existe `app/cocina`+`app/kds`; este configurador (alcance por centro/estación/pase, estilos condicionales) 🔴 falta.

## Mejoras sobre Ágora

- **Impresora + KDS unificados**: el mismo "monitor" puede tener respaldo en papel si la pantalla cae (Ágora ya lo apunta con la impresora; reforzarlo como failover automático).
- **Cronómetros y alertas** por color de serie (no solo "estilos personalizados" manuales): SLA por estación.
- **Bump bar / atajos de teclado** y modo táctil grande; vista de **pase/línea caliente** además de por ubicación.
- Métricas de tiempos de preparación por estación para el roadmap ([08](../../08-roadmap-de-implementacion/)).
