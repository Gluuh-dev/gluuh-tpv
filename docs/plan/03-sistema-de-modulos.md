# 03 — Sistema de módulos: todo configurable desde el TPV

**Objetivo:** que el dueño del bar, desde el propio TPV/backoffice, pueda **activar
módulos** (kiosko, cocina, pantalla de cliente, cartelería, comandera, reservas,
delivery, conexiones API…), **emparejar pantallas** nuevas con un código, y configurar
cada una — sin tocar nada técnico. Es el "añadir módulos" de Glop, pero en cloud y
sin instalar nada por módulo.

**Ventaja de partida:** las "pantallas" ya existen como rutas funcionales en `apps/web`
(`/kiosko`, `/cocina`, `/pantalla`, `/ofertas`, `/comandera`, `/tpv`). Lo que falta no
son los módulos: es el **interruptor**, el **emparejado** y la **página que lo gobierna**.

## 3.1 Diseño: registro estático + activación en BD

Sin marketplace, sin plugins dinámicos, sin tabla-catálogo: los módulos son código
nuestro y se describen en una constante TypeScript. Lo único que vive en BD es *qué
tiene activado cada empresa* y *su configuración*.

```ts
// apps/web/app/lib/modulos.ts (nuevo)
export const MODULOS = {
  TPV:        { nombre: "TPV",                 ruta: "/tpv",       siempre: true },
  COMANDERA:  { nombre: "Comandera móvil",     ruta: "/comandera" },
  COCINA:     { nombre: "Cocina (KDS)",        ruta: "/cocina" },
  PANTALLA:   { nombre: "Pantalla de recogida",ruta: "/pantalla" },
  VISOR:      { nombre: "Visor de cliente",    ruta: "/visor" },      // doc 02
  KIOSKO:     { nombre: "Kiosko de autopedido",ruta: "/kiosko" },
  CARTELERIA: { nombre: "Cartelería digital",  ruta: "/ofertas" },
  RESERVAS:   { nombre: "Reservas",            ruta: null },
  QR_MESA:    { nombre: "Carta y pedido por QR", ruta: "/carta" },    // futuro
  PAGOS:      { nombre: "Pagos (datáfono/QR)", ruta: null },          // futuro
  DELIVERY:   { nombre: "Delivery (agregadores)", ruta: null },       // futuro
  API:        { nombre: "Conexiones API",      ruta: null },          // §3.5
  STOCK:      { nombre: "Compras y stock",     ruta: null },          // roadmap
} as const;
export type Modulo = keyof typeof MODULOS;
```

```sql
-- supabase/migrations/00xx_modulos.sql (nueva)
create table tenant_module (
  tenant_id  uuid not null references tenant(id) on delete cascade,
  modulo     text not null,                -- clave de MODULOS
  activo     boolean not null default true,
  config     jsonb  not null default '{}',
  primary key (tenant_id, modulo)
);
-- RLS idéntica al resto de tablas (current_tenant_id()).
```

La configuración fina **por local o por dispositivo** no necesita tabla nueva: usa la
tabla `setting` con ámbitos GLOBAL/LOCAL/DEVICE que ya existe (`0023_setting.sql`) y que
hoy nadie consume. Convención de claves: `modulo.<MODULO>.<clave>` (p. ej.
`modulo.COCINA.estaciones`, `modulo.KIOSKO.pago`). `tenant_module.config` guarda solo
los valores de empresa; `setting` los matices por local/terminal.

**Gating** (dos puntos, ambos triviales):
1. `nav.ts` / botones del TPV: ocultar entradas de módulos inactivos (ya se filtra por
   rol; se añade el filtro por módulo).
2. Layout de cada ruta de pantalla: si el módulo está inactivo → pantalla "Módulo no
   activado. Actívalo en Configuración → Módulos".

El **plan de suscripción** (`tenant.plan`, hoy decorativo) pasa a ser una lista de
módulos máximos por plan (constante TS también). Activar un módulo fuera de plan →
pantalla de upgrade. Así el sistema de módulos y el modelo de negocio (docs/11) son
la misma pieza.

## 3.2 La página "Módulos" (backoffice) y el acceso desde el TPV

- Nueva página `(panel)/modulos`: tarjeta por módulo con interruptor, descripción,
  estado de dispositivos vinculados y botón "Configurar" (slide-over con su `config`).
- En el TPV, botón **Utilidades** (doc 04) → "Módulos y pantallas": misma información
  en versión táctil, restringida a rol ENCARGADO/PROPIETARIO. Desde ahí se genera el
  código de vinculación de una pantalla nueva sin salir del TPV.

## 3.3 Emparejar pantallas (el flujo estrella)

Hoy cada pantalla exige login de Supabase con email/contraseña de la empresa: inviable
para una tele de cocina. El emparejado lo sustituye:

```
TPV/backoffice                          Dispositivo nuevo (tele, tablet, PC)
──────────────                          ────────────────────────────────────
"Añadir pantalla" → elige módulo        abre gluuh.app/conectar
  → genera código 6 dígitos             introduce el código
  (fila en device: PENDIENTE,           ──────────────► POST /api/dispositivos/canjear
   modulo, expira 10 min)               ◄────────────── credencial de dispositivo
                                        guarda credencial y salta a su ruta
                                        (p. ej. /cocina) ya autenticado
```

- **BD**: a `device` (existe en `0001_init.sql`) se añaden `modulo text`,
  `codigo_vinculacion text`, `codigo_expira timestamptz`, `estado`.
- **Credencial**: usuario técnico de Supabase por dispositivo es innecesario; basta un
  token firmado (JWT con `tenant_id` + `device_id` + `modulo`, emitido por una route
  handler con `SUPABASE_SECRET_KEY`, patrón ya usado en `api/admin/crear-empresa`).
  Las pantallas de solo-lectura (cocina, pantalla, cartelería) consumen vistas vía
  RPCs `security definer` acotadas al `device_id` del token.
- El mismo flujo vale para **el TPV de escritorio** (doc 02), la comandera en una
  tablet y el kiosko. Un solo mecanismo de identidad de dispositivo para todo.
- Beneficio operativo: "TERMINAL 1" en la barra de estado, settings por dispositivo,
  numeración por terminal, y poder desvincular una pantalla robada desde el backoffice.

## 3.4 Venta desde pantalla

- **Kiosko** (ya existe, `app/kiosko`): pasa a ser módulo activable; su hueco real es
  el **pago** (hoy simulado). La integración es Stripe Terminal / QR Bizum según
  `docs/dossier/08-pasarelas-de-pago.md`, y entra como módulo `PAGOS` — el kiosko lo consume.
- **QR en mesa** (módulo `QR_MESA`, futuro): generar QR por mesa (la página
  `generar-qrs` ya está en el menú como stub), el cliente abre la carta, pide, y el
  pedido entra en el TPV/KDS como un pedido más con `canal = QR`. Reutiliza la RPC
  `crear_pedido` del kiosko; no es un desarrollo nuevo, es el kiosko sin pantalla física.

## 3.5 Módulo "Conexiones API"

Para integraciones externas (agregadores de delivery, contabilidad, BI del cliente):

- Tabla `api_key` (`tenant_id`, nombre, hash de la clave, permisos, `ultima_vez`).
  Gestión desde la página Módulos. Las claves atacan la **API NestJS** (no Supabase
  directo), que valida y aplica el tenant — exactamente el papel que `apps/api` tiene
  reservado en la arquitectura (docs/04).
- **Webhooks salientes** (pedido creado, ticket emitido, cierre de caja): tabla
  `webhook` + disparo desde la API. Fase posterior; se documenta ya para que el módulo
  nazca con hueco en la UI.
- El delivery (Glovo/Uber/JustEat) llegará por aquí vía Deliverect (docs/01): la tabla
  `online_order` ya existe en el esquema.

## 3.6 Orden de construcción

1. Migración `tenant_module` + `lib/modulos.ts` + gating en `nav.ts` y layouts. (pequeño)
2. Página `(panel)/modulos` con interruptores y config básica. (pequeño)
3. Emparejado de dispositivos: columnas en `device`, `/conectar`, canje y token. (medio)
4. Botón Utilidades → Módulos en el TPV. (pequeño)
5. Pago real en kiosko (módulo PAGOS) y luego QR en mesa, API keys, webhooks. (grande, por fases)

Con 1–4 hechos, la frase de venta ya es real: *"activa la pantalla de cocina desde tu
TPV y conéctala a cualquier tele con un código"*. Eso Glop no lo hace: sus módulos son
software Windows instalado pantalla a pantalla, con licencia por puesto.
