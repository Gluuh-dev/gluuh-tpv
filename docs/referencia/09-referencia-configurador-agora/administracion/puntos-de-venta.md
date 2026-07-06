# Administración › Puntos de Venta (terminales) y Grupos

> **La pantalla de configuración por DISPOSITIVO.** Un "Punto de Venta" en Ágora = un terminal físico (TPV de mostrador, comandera, datáfono AgoraPay). Aquí se define, **por terminal**: opciones de cobro (control de efectivo, pasarela), operativa, **Informe Z propio**, balanza/visor, **impresión por tipo de documento**, y el **enrutado de impresoras de cocina por estación**. Es la prueba viva del ámbito `DEVICE` del modelo de configuración ([07](../../07-configuracion-y-administracion/), [01](../../01-arquitectura-y-plataforma/)).

Capturas: `Grupos de Puntos de Venta`, `Puntos de Venta` (listado), `Editar Punto de Venta` (4 capturas).

---

## A. Grupos de Puntos de Venta

CRUD simple (Id · Nombre). Un grupo agrupa terminales del mismo rol para asignarles config/visibilidad en común.

| Id | Nombre |
|----|--------|
| 1 | TPVS |
| 2 | COMANDERAS |
| 3 | DATAFONOS |
| 4 | TPVS COFEE |
| 5 | COMANDERAS COFFEE |
| 6 | DATAFONOS COFEE |

> Patrón: un grupo por **tipo de terminal × zona/centro** (la zona "COFFEE" replica TPVS/COMANDERAS/DATAFONOS). Encaja con multi‑local/multi‑zona.

**Mapeo:** `device_group` (id, tenant_id, nombre). 🔴 falta.

---

## B. Listado de Puntos de Venta

Columnas: ☐ · Id · **Nombre** · **Tipo** · **Grupo**. CRUD + atajo "abrir".

| Id | Nombre | Tipo | Grupo |
|----|--------|------|-------|
| 1 | TPV | TPV | TPVS |
| 5 | COMANDERO | COMANDERA | COMANDERAS |
| 7 | AGORAPAY 1 | COMANDERA | DATAFONOS |
| 8 | AGORAPAY 2 | COMANDERA | DATAFONOS |
| 10 | TPV_COFEE | TPV | TPVS COFEE |
| 11 | COMANDERO COFEE | COMANDERA | COMANDERAS COFFEE |
| 12 | AGORAPAY 2 COFFEE | COMANDERA | DATAFONOS COFFEE |
| 13 | AGORAPAY 3 | COMANDERA | DATAFONOS COFEE |

**Tipos de terminal:** `TPV` (mostrador con cajón/impresora) y `COMANDERA` (camarero / datáfono AgoraPay). Mapea a nuestros roles de dispositivo de [01 §3](../../01-arquitectura-y-plataforma/) (Tauri para TPV, PWA/Expo para comandera).

---

## C. Editar Punto de Venta — secciones

### 1. Punto de Venta (identidad)
| Campo | Valor demo | Nota |
|-------|-----------|------|
| Nombre | `TPV` | |
| **Tipo** | `TPV` | TPV / COMANDERA |
| **Almacén** | `Usar el del Centro de Venta` | de qué almacén descuenta stock |
| **Grupo** | `TPVS` | FK a grupo (§A) |
| **Maestro** | (vacío) | terminal **maestro/servidor LAN** del que depende (clave offline, ver [01 §4]) |

### 2. Opciones de Cobro
- ☑ **Permitir cobrar tickets y movimientos de caja** → ☑ Realizar **arqueo de caja** al cerrar jornada.
- ☑ **Usar módulo de control de efectivo** → ☑ Ocultar saldo inicial al abrir jornada · **Configuración: `CASHLOGY`** (cajón inteligente de efectivo).
- ☑ **Usar pasarela de pago** → Configuración: `AGORAPAY 1 TPV`.

> Importante: el **control de efectivo (CASHLOGY)** y la **pasarela** se asignan **por terminal**, no global. Nuestro modelo debe permitirlo (override `DEVICE`).

### 3. Operativa de Venta (comportamiento del terminal)
| Ajuste | Valor demo |
|--------|-----------|
| Cerrar ticket | `Cambiar de usuario` |
| Imprimir ticket | `Mantener ubicación actual` |
| Preparar ticket | `Cambiar de ubicación` |
| Abrir cajón | `Mantener ubicación actual` |
| Mover ticket | `Actualizar al precio del centro de venta de destino` |
| Elegir usuario | `Seleccionar ubicación` |
| **Modo de búsqueda** | `Por familias y categorías` |
| ☐ Avisar al seleccionar un ticket creado por otro usuario | |
| ☐ Avisar al seleccionar un ticket en uso por otro usuario | |
| ☑ **Activar preparación automática** | (envía a cocina sin paso manual) |
| ☑ Mostrar última venta en la pantalla de inicio | |
| ☐ Mostrar última venta en la pantalla de selección de mesa | |
| ☐ Habilitar selección de usuarios con **lector de huellas** | |
| ☑ **Cerrar sesión tras inactividad** → `60` s | seguridad por terminal |
| ☐ Permitir imprimir **ticket regalo** | |
| ☐ Mostrar vista previa de la proforma antes de imprimir el ticket | |

### 4. Configuración de Informe Z (¡por terminal!)
Cada TPV tiene **su propio Z configurable** (qué bloques incluye + si lo imprime al cerrar jornada):

- ☑ Imprimir informe Z al cerrar jornada
- ☑ Ventas por usuario · ☑ Invitaciones por usuario · ☑ Cancelaciones por usuario · ☑ Cobros por usuario · ☐ Propinas por forma de pago · ☑ Cuadre de caja
- ☑ Devoluciones por producto · ☑ Ventas por centro de venta · ☑ Comensales por centro de venta · ☐ Operaciones pendientes de cobro · ☐ Ventas por familia · ☐ Datos de repartidores · ☐ Código de seguridad

> Coincide con el "Cierre de Sistema" global de [`locales.md` §11](locales.md): hay **Z global** + **Z por terminal**. Nuestro modelo: flags Z en `setting` con `scope` GLOBAL **y** DEVICE.

### 5. Configuración de la Balanza / Visor
- ☐ **Habilitar balanza** (peso para productos a granel).
- **Tipo de Visor**: `Ninguno` (visor de cliente / display de 2ª pantalla).

### 6. Impresión de Documentos (por tipo de documento)
Para **cada tipo** de documento: **Impresora · cuándo Imprimir (`Nunca`/`Siempre`/`Preguntar`) · Copias · Plantilla**:

| Documento | Impresora | Imprimir | Copias | Plantilla |
|-----------|-----------|----------|:------:|-----------|
| Proformas | PR_TICKETS | — | 1 | Por Defecto |
| **Facturas Simplificadas** | PR_TICKETS | `Nunca` | 1 | Por Defecto |
| **Facturas** | PR_TICKETS | `Siempre` | 1 | Por Defecto |
| **Albaranes/Pedidos** | PR_TICKETS | `Preguntar` | 2 | Por Defecto |
| Entradas | PR_TICKETS | — | — | Por Defecto |
| Cajón | PR_TICKETS | — | — | — |

> Liga con [Plantillas de Ticket](plantillas-ticket.md): aquí se **asigna** la plantilla a cada documento y terminal.

### 7. Impresoras de Cocina (enrutado por estación) ★
Tabla que **enruta cada estación a una impresora física** — exactamente el "enrutado por estación" del doc [04](../../04-impresion-y-tickets/) y [05](../../05-cocina-kds-y-comanderas/):

| Descripción | Impresora Física | Tipo de Preparación | Tipos Adicionales | Centros de Venta |
|-------------|------------------|---------------------|-------------------|------------------|
| PR-COCINA | `PR_COCINA` | **Cocina** | | Todos |
| BEBIDA | `PR_TICKETS` | **Barra** | | Todos |
| PR-TOSTADOR | `PR_TOSTADOR` | **Tostadas** | | Todos |

> Esto confirma nuestro modelo: producto → **estación/tipo de preparación** → **impresora física** (o KDS), filtrable por **Centro de Venta**. El "Tipo de Preparación" de Ágora = nuestra `estacion`. Ver [03](../../03-catalogo-productos-y-modificadores/) (producto.estacion) y [05].

### 8. Opciones de Pantalla
- **Configuración**: `Básica - TPV WEB` (perfil/layout de la interfaz del terminal).

---

## Mapeo a nuestro modelo

```sql
create table device (                       -- "Punto de Venta"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,                -- centro de venta / local
  nombre text not null,
  tipo text not null,                       -- TPV | COMANDERA
  group_id uuid references device_group(id),
  almacen_id uuid,                          -- null ⇒ usar el del centro
  master_device_id uuid,                    -- "Maestro" (servidor LAN)
  -- cobro
  permite_cobro boolean default true,
  control_efectivo text,                    -- null|CASHLOGY...
  pasarela_config_id uuid,
  -- balanza/visor
  balanza boolean default false,
  visor text default 'NINGUNO'
);
-- operativa, Z, e impresión por documento → setting scope=DEVICE (jsonb)
create table device_doc_print (             -- §6 impresión por tipo de doc
  device_id uuid not null references device(id),
  doc_tipo text not null,                   -- FRA_SIMP|FACTURA|ALBARAN|PROFORMA|ENTRADA|CAJON
  printer_id uuid, cuando text,             -- NUNCA|SIEMPRE|PREGUNTAR
  copias int default 1, template_id uuid
);
create table device_kitchen_route (         -- §7 enrutado por estación
  device_id uuid not null references device(id),
  descripcion text,
  printer_fisica text,                      -- o kds_id
  estacion text not null,                   -- Cocina|Barra|Tostadas...
  estaciones_adicionales text[],
  centro_venta text default 'TODOS'
);
```

- Todo lo de comportamiento (operativa §3, Z §4) → `setting` con `scope='DEVICE'` por `device_id`, heredando de LOCAL/GLOBAL ([07](../../07-configuracion-y-administracion/)).
- `printer` como entidad propia (PR_TICKETS, PR_COCINA, PR_TOSTADOR) — ver impresoras en [04](../../04-impresion-y-tickets/). 🔴 todo este bloque falta como configurador.

## Mejoras sobre Ágora

- **Auto‑registro de terminal**: que un dispositivo nuevo se dé de alta solo (QR de emparejamiento) y herede la config de su grupo, sin teclear nada.
- **Serie de numeración por terminal** (ver [`series.md`](series.md)) ligada aquí → cobro offline sin colisión.
- Enrutado de cocina a **impresora física O pantalla KDS** indistintamente (Ágora aquí solo lista impresoras; nuestro [05] unifica impresora+KDS).
- Visor de cliente = nuestra **pantalla de cliente PWA** ([01 §3], [05]), no solo display físico.
- Config de terminal **versionada y auditada** (quién cambió qué), apoyada en RLS.
