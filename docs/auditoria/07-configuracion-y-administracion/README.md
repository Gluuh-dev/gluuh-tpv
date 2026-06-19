# 07 · Configuración y administración — backoffice y configurabilidad total

> **Tesis.** Un TPV de hostelería compite por su **backoffice**, no por su pantalla de venta.
> La operativa (TPV, comandera, KDS, kiosko) es el "tubo"; el backoffice es el "cerebro" donde
> el negocio se modela sin tocar código. El principio rector de Gluuh es **"todo configurable"**:
> carta, impuestos, salas, formas de pago, descuentos, marca, dispositivos y permisos son **dato
> editable** con RLS por `tenant_id`, nunca constantes en el binario. Un cambio de IVA, un local
> nuevo o un descuento de happy-hour no deben requerir un despliegue.
>
> Este documento **no duplica** `docs/16-configuracion-campos.md` (resumen de campos) ni
> `docs/17-paginas-creacion-configuracion.md` (especificación maestra de páginas y formularios):
> los **referencia** y profundiza en lo que ellos no cubren — la **arquitectura de
> configurabilidad**: ámbitos (organización → local → dispositivo), herencia, modelo de datos de
> configuración (`setting` clave/valor + tablas dedicadas), matriz de permisos y **auditoría de
> cambios**. Para fiscalidad ver la carpeta **`08-fiscalidad`** (no se reproduce el motor aquí).

---

## 1. Filosofía "todo configurable"

La pregunta de diseño ante cada comportamiento del producto es binaria:

> **¿Esto cambia entre dos clientes, dos locales del mismo cliente, o dos turnos?**
> Si la respuesta es "sí", es **configuración** (dato en BD, editable en backoffice).
> Si es "no jamás" (algoritmo de huella VERIFACTU, vector AEAT, estados de pedido), es **código**.

### 1.1 Qué debe ser dato (no código)

| Dominio | Debe ser dato editable | Tabla / ámbito | Estado |
|---|---|---|---|
| **Carta** | familias, categorías, productos, precios, modificadores, menús/combos | `family`/`category`/`product`/`modifier_*`/`menu_*` · local | ✅ / 🟡 |
| **Impuestos** | % por clase fiscal × territorio | `tax_rate` + `resolver_iva()` · global semilla / local por territorio | ✅ |
| **Modificadores** | extras/quitar, min/max selección, suplemento | `modifier_group`/`modifier` · local | 🟡 |
| **Estaciones / centros de producción** | barra/cocina/parrilla y su enrutado | `product.estacion` → `sales_center`/`printer` · local | 🟡 |
| **Impresoras** | IP, ancho, copias, abre cajón, qué imprime | `printer` (propuesta) · **dispositivo/local** | 🟡 |
| **Plantillas de ticket** | cabecera, pie, logo, textos legales, idioma | `ticket_template` (propuesta) · local | 🟡 |
| **Salas / mesas** | zonas, capacidad, plano (`pos_x/pos_y`) | `room`/`restaurant_table` · local | ✅ / 🟡 plano |
| **Formas de pago** | métodos activos, orden, abre cajón, referencia | `payment_method` · local | ✅ tabla / 🟡 flags |
| **Descuentos** | %/importe, autorización requerida | `discount` · local | ✅ tabla / 🟡 autorización |
| **Horarios** | periodos de servicio, disponibilidad por franja | `service_period` / tarifas · local | 🟡 |
| **Idiomas** | idioma de carta/kiosko/ticket, traducciones | `setting` + `*_translation` · local | 🟡 |
| **Marca / colores** | logo, colores, títulos kiosko | `tenant_branding` · tenant/local | ✅ |

### 1.2 Qué NO se configura (es código, innegociable)

- Algoritmo de **huella SHA-256 encadenada** y XML/QR de VERIFACTU (`@gluuh/core`; vector AEAT).
- Máquina de estados de pedido/preparación (`lib/estados`) y de mesa.
- El **redondeo** y desglose `calcularImpuestosIncluidos` (la base "hacia atrás").
- El % de IVA **no se teclea por producto**: se deriva de `clase_fiscal × territorio_fiscal`
  vía `ivaAuto()` (cliente) y `resolver_iva()` (SQL). Configurable es la **tabla** `tax_rate`,
  no el número en la ficha (ver `docs/17` §5.3 y carpeta `08-fiscalidad`).

> **Regla de oro.** Si un comercial pide "que el cliente X tenga otro comportamiento", la
> respuesta correcta casi nunca es un `if (tenant === 'X')`: es **una fila de `setting`** o una
> columna nueva con default sensato. Las ramas por tenant en código son deuda.

---

## 2. Estructura del backoffice (mapa de navegación)

El rail real (`apps/web/app/lib/nav.ts`) sigue la organización de **Ágora**: 7 entradas, cada una
con submenú contextual (estilo Supabase, `layout.tsx`: rail `w-60`/`w-12` + `aside w-56`).

```
Inicio · Operativa · Administración · Compras y Stocks · Herramientas · Informes · Ayuda
```

| Entrada (rail) | Qué agrupa | Páginas de configuración clave |
|---|---|---|
| **Inicio** | dashboard, KPIs del día | — (solo lectura) |
| **Operativa** | TPV, comandera, KDS, kiosko, display, ofertas, **caja** | control de caja |
| **Administración** | el grueso de la **configuración** | empresa/local, series, plantillas ticket/etiquetas, periodos de servicio, tipos de cliente, perfiles y permisos, usuarios, catálogo (familias/categorías/productos/menús/alérgenos), impuestos, formas de pago, centros de venta, tarifas, promociones, descuentos, plantillas de comandas, motivos de cancelación |
| **Compras y Stocks** | almacenes, proveedores, unidades, escandallos | almacenes, proveedores, unidades |
| **Herramientas** | utilidades transversales | config global, config VERIFACTU, config de caja, config de pago, plantillas/planos de mesa, traducciones, **auditoría**, copias de seguridad |
| **Informes** | analítica (ver carpeta de informes) | — |
| **Ayuda** | documentación | — |

### 2.1 Tabla "qué configura cada sección de ajustes"

| Sección | Ruta | Configura | Ámbito | Estado |
|---|---|---|---|---|
| Empresa y local | `/ajustes` | nombre, CIF, razón social, **territorio fiscal**, régimen, serie | local | ✅ |
| Series | `/series` | series de facturación y su correlativo | local/dispositivo | ✅ tabla |
| Configuración global | `/configuracion-global` | parámetros transversales (`setting`) | tenant/local | 🟡 |
| Plantillas de ticket | `/plantillas-ticket` | cabecera, pie, logo, textos legales | local | 🟡 |
| Periodos de servicio | `/periodos-servicio` | franjas (desayuno/comida/cena) | local | 🟡 |
| Perfiles y permisos | `/perfiles` | roles y permisos por acción | tenant | 🟡 |
| Usuarios y PIN | `/empleados` | empleados, rol, PIN | tenant | ✅ |
| Impuestos | `/impuestos` | tabla `tax_rate` (informativa/avanzado) | global/local | ✅ datos |
| Formas de pago | `/formas-pago` | métodos, orden, flags | local | ✅ / 🟡 |
| Centros de venta | `/centros-venta` | puntos/centros y su enrutado | local | ✅ tabla |
| Tarifas | `/tarifas` | precios por sala/horario | local | 🟡 |
| Descuentos / Promociones | `/descuentos` `/promociones` | %/importe, condiciones | local | ✅ / 🟡 |
| Motivos de cancelación | `/motivos-cancelacion` | catálogo de motivos de anulación | local | ✅ tabla |
| Marca y cartelería | `/personalizar` | logo, colores, kiosko, ofertas | tenant/local | ✅ |
| Configuración de caja | `/configuracion-de-caja` | fondo, arqueo ciego, descuadre máx | local/dispositivo | 🟡 |
| Configuración VERIFACTU | `/configuracion-verifactu` | certificado mTLS (backend), modo | local | 🟡 |
| Auditoría | `/auditoria` | registro de cambios (solo lectura) | tenant | 🟡 |

> El detalle campo-a-campo de cada formulario está en `docs/17`; aquí se mapean **ámbitos** y
> **prioridad arquitectónica**, no los inputs.

---

## 3. Multi-local / multi-tenant: organización → local → dispositivo

El modelo actual ya distingue tres niveles, aunque la UI hoy asume **1 local por tenant**. La
jerarquía objetivo:

```
┌─────────────────────────────────────────────────────────────┐
│ TENANT  (organización / empresa SaaS)                        │
│  · plan, marca global, catálogo maestro, roles y permisos    │
│  · setting de ámbito 'tenant'                                │
│                                                              │
│  ├── LOCATION  (local / establecimiento)        1..N         │
│  │    · territorio_fiscal → IVA/IGIC/IPSI                    │
│  │    · serie_factura, régimen, dirección, CIF              │
│  │    · salas, mesas, formas de pago, tarifas, horarios     │
│  │    · setting de ámbito 'location' (override del tenant)  │
│  │                                                          │
│  │    ├── DEVICE  (TPV / comandera / KDS / web)   1..N       │
│  │    │    · serie_dispositivo (numeración offline)         │
│  │    │    · ultima_huella (encadenamiento VERIFACTU)       │
│  │    │    · impresora por defecto, cajón                   │
│  │    │    · setting de ámbito 'device' (override del local)│
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Qué configuración vive en cada ámbito

| Configuración | Tenant (global) | Local | Dispositivo |
|---|:--:|:--:|:--:|
| Plan / facturación SaaS | ● | — | — |
| Catálogo maestro (productos, precios base) | ● | hereda / override tarifa | — |
| **Territorio fiscal → impuestos** | — | ● (decide IVA/IGIC/IPSI) | — |
| Serie de factura | — | ● (default) | ● (serie offline) |
| Marca / colores / logo | ● (default) | override opcional | — |
| Salas y mesas | — | ● | — |
| Formas de pago | — | ● | filtra activas |
| Descuentos / tarifas / horarios | — | ● | — |
| Impresoras / cajón / KDS | — | ● (catálogo) | ● (asignación) |
| Plantilla de ticket / idioma | hereda | ● | override |
| Roles y permisos | ● | — | — |
| Empleados / PIN | ● | (asignación a local 🟡) | — |

### 3.2 Herencia de configuración (regla de resolución)

La configuración se resuelve **de lo específico a lo general** (cascada tipo CSS):

```
valor_efectivo(clave, device) =
    setting[device]  ??  setting[location]  ??  setting[tenant]  ??  default_código
```

- **Override explícito**: un nivel inferior puede fijar la clave; si no la fija, **hereda**.
- **Borrar el override** restaura la herencia (no copiar el valor, **borrar la fila**).
- En la UI, cada campo configurable muestra de dónde viene su valor ("Heredado del local" /
  "Definido aquí") para que el usuario entienda qué está editando.

> **Recomendación.** Implementar `valor_efectivo()` como **función SQL** `setting_get(clave, scope,
> scope_id)` que recorre la cascada, para que cliente y servidor resuelvan igual (mismo patrón
> que `resolver_iva()` vs `ivaAuto()`).

---

## 4. Usuarios, roles y permisos

### 4.1 Roles del sistema (`app_user.rol`)

`CHECK (rol IN ('ADMIN_PLATAFORMA','PROPIETARIO','ENCARGADO','CAMARERO','COCINA'))`

- **ADMIN_PLATAFORMA** — equipo Gluuh; gestiona la plataforma (`/admin`), no pertenece a un tenant.
- **PROPIETARIO** — acceso total al backoffice del tenant; única que ve config sensible (fiscal, plan).
- **ENCARGADO** — gestión diaria; casi todo menos fiscal/plan/borrado.
- **CAMARERO** — solo operativa (TPV, comandera). No entra al backoffice de gestión.
- **COCINA** — solo KDS.
- **(cajero)** — no es un rol propio en BD; se modela como CAMARERO con permiso `caja.abrir_cerrar`.

### 4.2 Login por PIN en operativa (★ patrón clave)

La identificación en sala **no** usa la sesión Supabase de cada empleado:

```
1. La tablet entra UNA vez con la cuenta de empresa (sesión Supabase persistente).
2. Cada empleado se identifica con su PIN → validar_pin(pin) → {id, nombre, rol}.
3. La UI se adapta al rol y ATRIBUYE acciones: sales_order.user_id, order_event.user_id,
   cash_session.abierta_por.
4. Tras inactividad o "cambiar usuario" → vuelve al PIN (la sesión de empresa sigue abierta).
```

Implementado en comandera (`validar_pin`); pendiente en TPV (ver `docs/17` §9.4).

### 4.3 Matriz de permisos por rol

> Estado deseado (hoy el filtrado es por `rol` en nav + RLS por `tenant_id`; los permisos finos
> requieren `app_user.permisos jsonb` o tabla `role_permission`). **La autorización real debe
> estar en RLS/RPC, no solo en el filtrado de UI** — el cliente solo decide qué se *muestra*.

| Permiso (clave) | Descripción | PROPIETARIO | ENCARGADO | CAMARERO | COCINA |
|---|---|:--:|:--:|:--:|:--:|
| `venta.cobrar` | Cobrar tickets | ✔ | ✔ | ✔ | — |
| `venta.descuento` | Aplicar DTO %/€ | ✔ | ✔ | ⚙️ autorizable | — |
| `venta.precio_manual` | Cambiar precio (PREC) | ✔ | ✔ | — | — |
| `venta.anular_linea` | Anular líneas (CAN) | ✔ | ✔ | ⚙️ autorizable | — |
| `venta.invitacion` | Invitación / autoconsumo | ✔ | ✔ | — | — |
| `caja.abrir_cerrar` | Apertura / cierre Z | ✔ | ✔ | ⚙️ | — |
| `caja.retirada` | Retiradas de efectivo | ✔ | ✔ | — | — |
| `caja.abrir_cajon` | Abrir cajón sin venta ("no-sale") | ✔ | ✔ | ⚙️ | — |
| `catalogo.editar` | Editar carta | ✔ | ✔ | — | — |
| `empleados.gestionar` | Crear/editar empleados | ✔ | ✔ | — | — |
| `config.fiscal` | Datos fiscales / serie | ✔ | — | — | — |
| `config.dispositivos` | Impresoras / pasarela | ✔ | ✔ | — | — |
| `informes.ver` | Ver informes | ✔ | ✔ | — | — |
| `plataforma.admin` | Backoffice Gluuh (`/admin`) | — | — | — | — |

> ⚙️ = **configurable por el negocio** mediante override de permiso (matriz de switches en
> `/perfiles`) o **autorización puntual**: la acción la dispara un camarero pero exige el PIN de
> un encargado (patrón "autorización por superior", ver §5).

### 4.4 RLS de Supabase como capa de seguridad real

- **Aislamiento por tenant**: toda tabla lleva `tenant_id` y política
  `USING (tenant_id = current_tenant_id())` — un tenant no puede leer/escribir datos de otro
  aunque el cliente esté comprometido.
- **`current_tenant_id()`** se resuelve desde el JWT/sesión (auth hook, `0011_auth_hook.sql`).
- **Operaciones sensibles vía RPC** `SECURITY DEFINER` con check de rol dentro (p. ej.
  `crear_empleado` exige PROPIETARIO/ENCARGADO). El permiso fino se valida ahí, no en el `fetch`.
- **Regla**: nunca confiar en el filtrado de `nav.ts`; es UX. La autorización es RLS + RPC.

---

## 5. Salas y mesas

| Capacidad | Tabla / columna | Estado |
|---|---|---|
| Salas / zonas (Salón, Terraza, Barra) | `room (nombre, orden, location_id)` | ✅ |
| Mesas | `restaurant_table (nombre, room_id, estado, pos_x, pos_y)` | ✅ |
| Capacidad (comensales) | `restaurant_table.capacidad` | 🟡 falta columna |
| **Editor de plano** (arrastrar mesas) | `pos_x`, `pos_y` (columnas ✅; editor 🟡) | 🟡 diferenciador |
| Estados de mesa | `estado ∈ LIBRE/OCUPADA/PIDIENDO/SERVIDA/POR_COBRAR` | ✅ |
| Unir / separar mesas | (sin modelo) → propuesta `table_group` | 🟡 |

**Recomendación — unir/separar.** Modelar como agrupación temporal de mesas que comparten una
comanda: `table_group (id, tenant_id, location_id, abierta_en)` + `restaurant_table.group_id NULL`.
Unir = asignar `group_id` común; separar = `NULL`. La comanda apunta a la mesa "principal" del grupo.

---

## 6. Formas de pago, descuentos, propinas, invitaciones, anulaciones

Todo esto es **configuración con control de autorización**, no constantes del TPV.

| Concepto | Configuración | Control | Estado |
|---|---|---|---|
| **Formas de pago** | `payment_method (nombre, tipo, activo, orden)` | + flags `abre_cajon`, `requiere_referencia` (🟡) | ✅ / 🟡 |
| **Descuentos** | `discount (nombre, tipo PORCENTAJE/IMPORTE, valor, activo)` | `requiere_autorizacion` + `max_porcentaje` por rol (🟡) | ✅ / 🟡 |
| **Propinas** | `payment.propina` (columna ✅) | activar/desactivar por local (`setting`) | 🟡 |
| **Invitaciones / autoconsumo / merma** | `sales_order.tipo_operacion` + `motivo_no_venta` | permiso `venta.invitacion`; **no factura, sí traza** | 🟡 |
| **Anulaciones** | `motivos-cancelacion` (`sales_center`-style catálogo) | permiso `venta.anular_linea` + motivo obligatorio | ✅ catálogo / 🟡 control |

> **Autorización por superior.** Para descuentos/anulaciones por encima del límite del camarero,
> el flujo es: acción → diálogo "Requiere autorización" → PIN de encargado → registra
> `order_event(user_id_autoriza, accion, motivo)`. Esto deja **traza fiscal y de control** sin
> bloquear la operación. Hoy hardcoded; debe pasar a `discount.requiere_autorizacion` + permiso.

---

## 7. Turnos y caja

**Tablas reales:** `cash_session (fondo_inicial, abierta_por, abierta_en, cerrada_en,
total_efectivo, total_tarjeta, descuadre, device_id, location_id)` + `cash_move (tipo
ENTRADA/SALIDA, importe, motivo)`. RLS en `0017_caja_rls.sql`. **UI pendiente** (🟡).

| Operación | Origen | Configurable | Estado |
|---|---|---|---|
| **Apertura** | `fondo_inicial`, `abierta_por` (PIN), `device_id` | fondo por defecto (`setting`) | 🟡 |
| **Movimientos** | `cash_move` entrada/retirada + motivo | motivos predefinidos | 🟡 |
| **Arqueo** | contado vs teórico (`fondo + ventas efectivo + entradas − salidas`) | **arqueo ciego** sí/no (`setting`) | 🟡 |
| **Cierre Z** | sella `cerrada_en`, totales por método, nº tickets, correlativo Z | numeración Z por dispositivo | 🟡 |
| **Descuadres** | `descuadre = contado − teórico` | umbral de alerta (`setting`) | 🟡 |

> **Configurable recomendado:** fondo inicial por defecto, arqueo ciego (no mostrar el teórico al
> contar), descuadre máximo tolerado antes de exigir motivo, y si el cierre Z lo puede hacer un
> encargado o solo el propietario. Todo en `setting` ámbito local/dispositivo.

---

## 8. Personalización / marca

`tenant_branding (nombre_comercial, logo_url, color_primario, color_secundario, kiosko_titulo,
kiosko_subtitulo)` — ✅ con vista previa en vivo (`/personalizar`).

| Elemento | Ámbito recomendado | Estado |
|---|---|---|
| Logo / colores / título kiosko | tenant (default) → override por local | ✅ tenant / 🟡 override local |
| **Idioma** de carta/kiosko/ticket | local (override device) vía `setting` | 🟡 |
| **Textos de ticket** (cabecera, pie, legal, agradecimiento) | local vía `ticket_template` | 🟡 |
| Cartelería / ofertas | `offer` por tenant | ✅ |

> Recomendación: separar **marca corporativa** (tenant) de **textos operativos del ticket**
> (local). Un grupo con 5 bares quiere un logo común pero direcciones/CIF y pie de ticket distintos.

---

## 9. Impuestos configurables por territorio

El territorio se fija en `location.territorio_fiscal` y **decide el sistema impositivo**:

| Territorio | Sistema | GENERAL | REDUCIDO | SUPERREDUCIDO | EXENTO |
|---|---|:--:|:--:|:--:|:--:|
| PENINSULA_BALEARES / FORAL_* | IVA | 21 | 10 | 4 | 0 |
| CANARIAS | IGIC | 7 | 3 | 0 | 0 |
| CEUTA_MELILLA | IPSI | 10 | 4 | 1 | 0 |

La tabla `tax_rate (territorio, clase_fiscal, porcentaje)` y `resolver_iva()` son la fuente; el
producto solo guarda su `clase_fiscal` y el % se **deriva**. **No se profundiza aquí** — ver la
carpeta **`08-fiscalidad`** para el motor, el desglose "hacia atrás" y VERIFACTU. Lo relevante para
*administración*: cambiar de IVA a IGIC es **cambiar un selector**, sin tocar la carta.

---

## 10. Modelo de datos de configuración (propuesta)

Lo que **ya existe**: `tenant`, `location`, `device`, `app_user`, `payment_method`, `discount`,
`cash_session`/`cash_move`, `room`/`restaurant_table`, `tenant_branding`, `invoice_series`,
`sales_center`. Lo que **falta** y se propone: `setting` (clave/valor por ámbito), `role`/`permission`
finos, `audit_log`, y flags en tablas existentes.

### 10.1 `setting` — clave/valor por ámbito (pieza central de "todo configurable")

```sql
-- Configuración genérica por ámbito, con cascada device → location → tenant
CREATE TABLE setting (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope       text NOT NULL CHECK (scope IN ('TENANT','LOCATION','DEVICE')),
  scope_id    uuid NOT NULL,                 -- tenant_id | location_id | device_id según scope
  clave       text NOT NULL,                 -- p.ej. 'caja.arqueo_ciego', 'ticket.idioma'
  valor       jsonb NOT NULL,                -- valor tipado (bool/num/text/obj)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES app_user(id) ON DELETE SET NULL,
  UNIQUE (scope, scope_id, clave)
);
CREATE INDEX idx_setting_lookup ON setting (tenant_id, scope, scope_id, clave);
ALTER TABLE setting ENABLE ROW LEVEL SECURITY;
CREATE POLICY setting_rw ON setting FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- Resolución con herencia: device → location → tenant → NULL
CREATE OR REPLACE FUNCTION setting_get(p_clave text, p_device uuid, p_location uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT valor FROM setting
  WHERE tenant_id = current_tenant_id() AND clave = p_clave
    AND ( (scope='DEVICE'   AND scope_id = p_device)
       OR (scope='LOCATION' AND scope_id = p_location)
       OR (scope='TENANT'   AND scope_id = current_tenant_id()) )
  ORDER BY CASE scope WHEN 'DEVICE' THEN 1 WHEN 'LOCATION' THEN 2 ELSE 3 END
  LIMIT 1;
$$;
```

> Usar `setting` para parámetros de comportamiento (flags, umbrales, idioma). Las **entidades**
> (productos, mesas, formas de pago) siguen en tablas dedicadas; `setting` es para los "ajustes"
> sueltos que de otro modo acabarían como constantes o columnas dispersas.

### 10.2 Roles y permisos finos

```sql
-- Catálogo de permisos (semilla global, no por tenant)
CREATE TABLE permission (
  clave        text PRIMARY KEY,             -- 'venta.descuento', 'caja.abrir_cerrar', ...
  descripcion  text NOT NULL,
  categoria    text NOT NULL                 -- 'venta' | 'caja' | 'catalogo' | 'config' | 'informes'
);

-- Override de permiso por rol y tenant (default = matriz §4.3 en código)
CREATE TABLE role_permission (
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  rol         text NOT NULL CHECK (rol IN ('PROPIETARIO','ENCARGADO','CAMARERO','COCINA')),
  permiso     text NOT NULL REFERENCES permission(clave),
  permitido   boolean NOT NULL,
  requiere_autorizacion boolean NOT NULL DEFAULT false,   -- exige PIN de superior
  PRIMARY KEY (tenant_id, rol, permiso)
);
ALTER TABLE role_permission ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permission_rw ON role_permission FOR ALL
  USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());

-- Override por empleado concreto (opcional, gana sobre el rol)
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS permisos jsonb DEFAULT '{}'::jsonb;
```

Resolución: `permiso_efectivo = app_user.permisos[clave] ?? role_permission ?? default_código`.

### 10.3 Flags en tablas existentes (migraciones menores)

```sql
ALTER TABLE payment_method ADD COLUMN IF NOT EXISTS abre_cajon          boolean DEFAULT false;
ALTER TABLE payment_method ADD COLUMN IF NOT EXISTS requiere_referencia boolean DEFAULT false;
ALTER TABLE payment_method ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES location(id);
ALTER TABLE discount       ADD COLUMN IF NOT EXISTS requiere_autorizacion boolean DEFAULT false;
ALTER TABLE discount       ADD COLUMN IF NOT EXISTS max_porcentaje numeric(5,2);
ALTER TABLE restaurant_table ADD COLUMN IF NOT EXISTS capacidad int DEFAULT 4;
```

### 10.4 Impresoras y plantillas de ticket

```sql
CREATE TABLE printer (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  conexion    text NOT NULL DEFAULT 'RED' CHECK (conexion IN ('RED','USB','BT')),
  host        text, puerto int DEFAULT 9100,
  ancho       text DEFAULT '80' CHECK (ancho IN ('58','80')),
  centro      text DEFAULT 'CAJA',            -- CAJA | COCINA | BARRA | ...
  abre_cajon  boolean DEFAULT false, copias int DEFAULT 1, activa boolean DEFAULT true
);

CREATE TABLE ticket_template (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  cabecera    text, pie text, idioma text DEFAULT 'es',
  mostrar_qr_verifactu boolean DEFAULT true
);
```

(Ambas con RLS `tenant_id = current_tenant_id()`, como el resto.)

---

## 11. Auditoría de cambios de configuración

Cambiar el IVA, un precio o un permiso debe dejar **rastro**: quién, qué, cuándo, valor anterior y
nuevo. Hoy **no existe** `audit_log`; se propone:

```sql
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES app_user(id) ON DELETE SET NULL,
  entidad     text NOT NULL,                  -- 'product' | 'setting' | 'role_permission' | ...
  entidad_id  uuid,
  accion      text NOT NULL CHECK (accion IN ('CREAR','EDITAR','BORRAR')),
  antes       jsonb, despues jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_fecha ON audit_log (tenant_id, created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_ro ON audit_log FOR SELECT USING (tenant_id = current_tenant_id());
-- Solo escritura por trigger/RPC; nada de UPDATE/DELETE para autenticados (registro inmutable).
```

**Cómo poblarlo (recomendación):** trigger `AFTER INSERT/UPDATE/DELETE` genérico sobre las tablas
de configuración sensibles (`location`, `tax_rate`, `payment_method`, `discount`,
`role_permission`, `setting`, `app_user`) que vuelca `OLD`/`NEW` a `audit_log` con el `user_id` del
JWT. Página `/auditoria` (solo PROPIETARIO) = lista filtrable por entidad/usuario/fecha, **solo
lectura**. Distinto del registro fiscal VERIFACTU (`verifactu_record`, inmutable y encadenado), que
vive en la carpeta `08-fiscalidad`.

---

## 12. Recomendaciones priorizadas (accionables)

| # | Acción | Por qué | Prioridad |
|---|---|---|:--:|
| 1 | **`setting` + `setting_get()`** con cascada device→location→tenant | habilita "todo configurable" sin columnas dispersas | **Alta** |
| 2 | Mover autorización fina a **RLS/RPC** (no solo `nav.ts`) | hoy el filtrado es UX; hay agujero de seguridad | **Alta** |
| 3 | UI de **caja** (apertura, arqueo, cierre Z, descuadre) | tablas existen, falta operativa imprescindible | **Alta** |
| 4 | `role_permission` + `app_user.permisos` + página `/perfiles` | paridad con Ágora; descuentos/anulaciones controlados | **Alta** |
| 5 | **`audit_log`** + triggers sobre config sensible | trazabilidad y confianza (grupos, franquicias) | Media |
| 6 | Flags en `payment_method`/`discount`/`restaurant_table` | cerrar configurabilidad ya empezada | Media |
| 7 | `printer` + `ticket_template` por local/dispositivo | hardware y ticket dejan de ser código | Media |
| 8 | Habilitar **multi-local real** (selector de local en backoffice) | el modelo lo soporta; la UI asume 1 local | Media |
| 9 | `table_group` (unir/separar mesas) + editor de plano | diferenciador de sala | Baja |

> **Mantener espejo.** Cualquier tabla/columna nueva debe replicarse en `apps/api/db/schema.sql`
> (ver `supabase/README.md`) y, si toca fiscalidad, coordinarse con la carpeta `08-fiscalidad`.
