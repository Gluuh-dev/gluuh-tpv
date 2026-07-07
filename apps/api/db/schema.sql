-- =============================================================================
--  Gluuh TPV — Esquema de base de datos (PostgreSQL)
--  Multi-tenant: shared schema + tenant_id + Row-Level Security (RLS)
--  Ver docs/dossier/06-base-de-datos-y-sincronizacion.md y docs/dossier/07 (fiscalidad)
--
--  Convenciones:
--   - PK uuid (gen_random_uuid).
--   - Toda tabla de negocio lleva tenant_id (aislamiento) y columnas de sync.
--   - tenant_id es la PRIMERA columna de los índices compuestos (rendimiento RLS).
--   - Se evita usar palabras reservadas (sales_order, restaurant_table).
--   - Importes en numeric(12,2); impuestos en numeric(5,2).
--
--  Aplicar:  psql "$DATABASE_URL" -f apps/api/db/schema.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
--  Contexto de tenant para RLS
--  La aplicación debe ejecutar, por transacción:  SET app.tenant_id = '<uuid>';
--  (idealmente SET LOCAL dentro de la transacción de cada petición).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Trigger genérico para mantener updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =============================================================================
--  1. TENANCY Y ORGANIZACIÓN
-- =============================================================================

-- Un tenant = un cliente del SaaS (un bar independiente o un grupo/cadena)
CREATE TABLE tenant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  plan          text NOT NULL DEFAULT 'FREE'
                  CHECK (plan IN ('FREE','PRO','AVANZADO','CADENA')),
  cif           text,
  email_admin   text,
  clave_tecnica_hash text,         -- candado "Zona técnica" del backoffice, bcrypt (0045)
  licencia_hasta   date,                          -- caducidad de la licencia; NULL = sin licencia (0052)
  licencia_modulos text[] NOT NULL DEFAULT '{}',  -- módulos premium comprados (0052)
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Local/establecimiento. Aquí vive el TERRITORIO FISCAL (IVA vs IGIC vs foral)
CREATE TABLE location (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  direccion       text,
  cif             text NOT NULL,
  razon_social    text NOT NULL,
  territorio_fiscal text NOT NULL DEFAULT 'PENINSULA_BALEARES'
                    CHECK (territorio_fiscal IN
                      ('PENINSULA_BALEARES','CANARIAS','CEUTA_MELILLA','FORAL_PV','FORAL_NAVARRA')),
  -- Régimen de facturación electrónica aplicable según territorio
  regimen_facturacion text NOT NULL DEFAULT 'VERIFACTU'
                    CHECK (regimen_facturacion IN ('VERIFACTU','TICKETBAI','BATUZ','OTRO')),
  serie_factura   text NOT NULL DEFAULT 'F',
  -- Ficha de empresa (0069): datos administrativos, ubicación y contacto
  nombre_comercial text,
  poblacion       text,
  provincia       text,
  codigo_postal   text,
  contacto        text,                    -- persona de contacto
  telefono        text,
  email           text,
  web             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_location_tenant ON location (tenant_id, id);

-- Dispositivo registrado (TPV, comandera, KDS, pantallas). Clave para numeración
-- offline y para el emparejado por código (migración 0033).
CREATE TABLE device (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('TPV','COMANDERA','KDS','WEB','PANTALLA','KIOSKO','CARTELERIA','VISOR')),
  nombre          text NOT NULL,
  -- Serie de facturación asignada a este dispositivo (numeración sin huecos offline)
  serie_dispositivo text,
  -- Última huella VERIFACTU emitida por el dispositivo (encadenamiento offline)
  ultima_huella   text,
  ultima_sync     timestamptz,
  -- Emparejado por código de 6 dígitos (docs/implementacion/04)
  modulo             text,
  codigo_vinculacion text,
  codigo_expira      timestamptz,
  vinculado_at       timestamptz,
  -- Grupo de puntos de venta al que pertenece (0067); null = sin grupo
  grupo_punto_venta_id uuid REFERENCES grupo_punto_venta(id) ON DELETE SET NULL,
  -- Estación del monitor KDS (0068); null = la global del módulo Cocina
  estacion        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_tenant_location ON device (tenant_id, location_id);
CREATE UNIQUE INDEX device_codigo_uq ON device (codigo_vinculacion) WHERE codigo_vinculacion IS NOT NULL;

-- Módulos activables por empresa (0035). Catálogo en apps/web/app/lib/modulos.ts;
-- sin fila = valor por defecto del módulo (los básicos, activos).
CREATE TABLE tenant_module (
  tenant_id  uuid    NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  modulo     text    NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  config     jsonb   NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, modulo)
);

-- Códigos de licencia emitidos (0052). El estado efectivo vive en
-- tenant.licencia_hasta/licencia_modulos; esta tabla es el histórico de códigos
-- (uno por venta/renovación), que se canjean una sola vez vía activar_licencia().
CREATE TABLE licencia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  codigo      text NOT NULL UNIQUE,
  meses       int  NOT NULL CHECK (meses > 0),
  modulos     text[] NOT NULL DEFAULT '{}',
  canjeado_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_licencia_tenant ON licencia (tenant_id);

-- Usuarios (empleados). Login backoffice (email+pass) y TPV (PIN).
CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  email           text,
  password_hash   text,            -- Argon2/bcrypt (backoffice)
  pin_hash        text,            -- PIN del camarero en TPV/comandera
  pulsera_hash    text,            -- código de pulsera RFID/NFC hasheado (0037)
  perfil_id       uuid,            -- perfil asignado (0070); el usuario hereda perfil.permisos
  codigo          text,            -- código legible del operario, único por tenant (0073)
  clave_hash      text,            -- clave de acceso al panel por código (bcrypt, 0074)
  pin_intentos        int NOT NULL DEFAULT 0,   -- backoff login por PIN (0054)
  pin_bloqueado_hasta timestamptz,              -- backoff login por PIN (0054)
  rol             text NOT NULL DEFAULT 'CAMARERO'
                    CHECK (rol IN ('ADMIN_PLATAFORMA','PROPIETARIO','ENCARGADO','CAMARERO','COCINA')),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_user_email ON app_user (email) WHERE email IS NOT NULL;
CREATE INDEX idx_user_tenant ON app_user (tenant_id, id);
CREATE UNIQUE INDEX idx_app_user_codigo ON app_user (tenant_id, codigo) WHERE codigo IS NOT NULL; -- 0073

-- Fichajes / control horario
CREATE TABLE shift (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  entrada     timestamptz NOT NULL,
  salida      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_tenant_user ON shift (tenant_id, user_id, entrada);

-- Perfiles: plantillas de permisos para empleados (0020 + 0048).
CREATE TABLE perfil (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  descripcion text,
  permisos    jsonb NOT NULL DEFAULT '{}',  -- mismo formato que app_user.permisos; ausente = permitido (0048)
  created_at  timestamptz DEFAULT now()
);
-- Vínculo operario ↔ perfil (0070). El FK va aquí porque perfil se define después
-- de app_user; el panel resuelve las zonas del menú desde app_user.permisos.
ALTER TABLE app_user
  ADD CONSTRAINT app_user_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES perfil(id) ON DELETE SET NULL;
CREATE INDEX idx_app_user_tenant_perfil ON app_user (tenant_id, perfil_id);

-- =============================================================================
--  2. CATÁLOGO (carta, productos, inventario)
-- =============================================================================

-- Grupo mayor: división por encima de las familias (0020 + 0058).
-- Jerarquía: grupo mayor → familia → categoría → producto.
CREATE TABLE grupo_mayor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz DEFAULT now()
);

-- Familias: agrupan categorías (0012); cuelgan opcionalmente de un grupo mayor (0058).
CREATE TABLE family (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre         text NOT NULL,
  orden          int  DEFAULT 0,
  color          text DEFAULT '#64748b',
  grupo_mayor_id uuid REFERENCES grupo_mayor(id) ON DELETE SET NULL,  -- null = sin grupo mayor (0058)
  mostrar_venta  boolean NOT NULL DEFAULT true,   -- sale en la pantalla de venta (0061)
  mostrar_menus  boolean NOT NULL DEFAULT true,   -- elegible dentro de menús (0061)
  familia_padre_id uuid REFERENCES family(id) ON DELETE SET NULL,  -- jerarquía (0065)
  orden_impresion int NOT NULL DEFAULT 0,          -- orden en factura/ticket (0065)
  texto_boton    text,                             -- texto del botón; null = nombre (0065)
  foto_url       text,                             -- imagen del botón (0065)
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_family_grupo_mayor ON family (tenant_id, grupo_mayor_id);
CREATE INDEX idx_family_padre ON family (familia_padre_id);

CREATE TABLE category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  family_id   uuid REFERENCES family(id) ON DELETE SET NULL,  -- familia a la que pertenece (0012)
  orden       int NOT NULL DEFAULT 0,
  foto_url    text,                       -- imagen para el botón del TPV (0044)
  icono       text,                       -- nombre de icono lucide para el botón del TPV (0060)
  estacion    text,                       -- estación por defecto de sus productos; null = sin definir (0050)
  mostrar_venta boolean NOT NULL DEFAULT true,  -- sale en la pantalla de venta (0061)
  mostrar_menus boolean NOT NULL DEFAULT true,  -- elegible dentro de menús (0061)
  categoria_padre_id uuid REFERENCES category(id) ON DELETE SET NULL,  -- jerarquía (0065)
  color       text,                       -- color propio; null = hereda el de la familia (0066)
  texto_boton text,                       -- texto del botón; null = nombre (0065)
  carta_nombre text,                      -- carta digital: null = nombre (0065)
  carta_descripcion text,                 -- carta digital: null = nombres de productos (0065)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_category_tenant ON category (tenant_id, orden);
CREATE INDEX idx_category_padre ON category (categoria_padre_id);

CREATE TABLE product (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES category(id) ON DELETE SET NULL,
  nombre          text NOT NULL,
  nombre_ticket   text,                       -- nombre en ticket/factura del cliente; null = nombre (0051)
  nombre_cocina   text,                       -- nombre en comandas cocina/barra y ticket camarero; null = nombre (0051)
  precio          numeric(12,2) NOT NULL,     -- PVP, impuesto incluido
  tipo_impositivo numeric(5,2) NOT NULL DEFAULT 10,  -- % (10 IVA host., 7 IGIC...)
  es_alcohol      boolean NOT NULL DEFAULT false,
  estacion        text,                       -- enrutado a cocina/barra (docs/10)
  foto_url        text,
  agotado_hasta   timestamptz,     -- "86": agotado hasta esta fecha (0038)
  vendido_por_peso boolean NOT NULL DEFAULT false,  -- precio = €/kg (0040)
  orden           int NOT NULL DEFAULT 0,     -- orden manual en la botonera (0046)
  disponible      boolean NOT NULL DEFAULT true,
  family_id       uuid REFERENCES family(id) ON DELETE SET NULL,  -- familia DIRECTA, modelo Glop (0065)
  plu             text,                       -- código PLU (0065); único por tenant
  es_principal    boolean NOT NULL DEFAULT true,   -- venta como producto principal (0065)
  es_anadido      boolean NOT NULL DEFAULT false,  -- venta como añadido de otro (0065)
  tiempo_preparacion_min int,                 -- (0065)
  texto_boton     text,                       -- texto del botón; null = nombre (0065)
  carta_nombre    text,                       -- carta digital: null = nombre (0065)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_tenant_cat ON product (tenant_id, category_id);
CREATE INDEX idx_product_family ON product (family_id);
CREATE UNIQUE INDEX uq_product_plu ON product (tenant_id, plu) WHERE plu IS NOT NULL;

-- Centros de venta por categoría (0065): sin filas = asociar a todos.
CREATE TABLE category_sales_center (
  category_id     uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  sales_center_id uuid NOT NULL REFERENCES sales_center(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, sales_center_id)
);
CREATE INDEX idx_csc_tenant ON category_sales_center (tenant_id, sales_center_id);

-- Horario de disponibilidad por categoría (0067): sin filas = siempre visible.
CREATE TABLE category_horario (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  hora_inicio time NOT NULL,
  hora_fin    time NOT NULL,
  dias        int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',  -- 1=lunes … 7=domingo
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cathorario_tenant ON category_horario (tenant_id, category_id);

-- Grupos de puntos de venta (0067): agrupan dispositivos TPV. La visibilidad
-- por grupo va en family_grupo_pv / category_grupo_pv (sin filas = en todos).
CREATE TABLE grupo_punto_venta (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family_grupo_pv (
  family_id uuid NOT NULL REFERENCES family(id) ON DELETE CASCADE,
  grupo_id  uuid NOT NULL REFERENCES grupo_punto_venta(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  PRIMARY KEY (family_id, grupo_id)
);
CREATE INDEX idx_fgpv_tenant ON family_grupo_pv (tenant_id, grupo_id);
CREATE TABLE category_grupo_pv (
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  grupo_id    uuid NOT NULL REFERENCES grupo_punto_venta(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, grupo_id)
);
CREATE INDEX idx_cgpv_tenant ON category_grupo_pv (tenant_id, grupo_id);

-- Etiquetas de producto (0067): m2m sobre el catálogo etiqueta_producto.
CREATE TABLE product_etiqueta (
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES etiqueta_producto(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, etiqueta_id)
);
CREATE INDEX idx_petiq_tenant ON product_etiqueta (tenant_id, etiqueta_id);

-- Producto ↔ categoría muchos-a-muchos (0061): un producto puede estar en N
-- categorías del TPV; product.category_id queda como "categoría principal".
CREATE TABLE product_category (
  product_id  uuid NOT NULL REFERENCES product(id)  ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenant(id)   ON DELETE CASCADE,
  orden       int  DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX idx_product_category_cat ON product_category (tenant_id, category_id);

-- Formatos de venta por artículo (0039): caña/copa/botella, ración/media…
CREATE TABLE product_format (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  precio      numeric(12,2) NOT NULL,
  orden       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_format ON product_format (tenant_id, product_id, orden);

-- Tarifas de precios (0020) y precio de producto por tarifa (0047).
-- Sin fila en product_price = el producto usa product.precio (impuesto incluido).
CREATE TABLE tarifa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE product_price (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  tarifa_id   uuid NOT NULL REFERENCES tarifa(id) ON DELETE CASCADE,
  precio      numeric(12,2) NOT NULL,       -- PVP, impuesto incluido
  UNIQUE (tenant_id, product_id, tarifa_id)
);
CREATE INDEX idx_product_price_tarifa ON product_price (tenant_id, tarifa_id);

-- Grupos de modificadores: de un producto (product_id) o de la BIBLIOTECA del
-- tenant (product_id NULL, 0064) — reutilizables vía modifier_group_asignacion.
CREATE TABLE modifier_group (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES product(id) ON DELETE CASCADE,  -- NULL = biblioteca (0064)
  nombre      text NOT NULL,               -- "Punto de la carne", "Extras"
  tipo        text NOT NULL DEFAULT 'EXTRA' CHECK (tipo IN ('EXTRA','COMENTARIO')),  -- 0064
  min_sel     int NOT NULL DEFAULT 0,
  max_sel     int NOT NULL DEFAULT 1
);
CREATE INDEX idx_modgroup_tenant_product ON modifier_group (tenant_id, product_id);

CREATE TABLE modifier (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_group(id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  precio_extra      numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_modifier_tenant_group ON modifier (tenant_id, modifier_group_id);

-- Asignación de grupos de biblioteca con herencia (0064): destino = exactamente
-- UNO de familia/categoría/producto. INCLUIR suma; EXCLUIR quita lo heredado de
-- niveles superiores (familia < categoría < producto; en el nivel, INCLUIR gana).
CREATE TABLE modifier_group_asignacion (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_group(id) ON DELETE CASCADE,
  family_id         uuid REFERENCES family(id)   ON DELETE CASCADE,
  category_id       uuid REFERENCES category(id) ON DELETE CASCADE,
  product_id        uuid REFERENCES product(id)  ON DELETE CASCADE,
  modo              text NOT NULL DEFAULT 'INCLUIR' CHECK (modo IN ('INCLUIR','EXCLUIR')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(family_id, category_id, product_id) = 1)
);
CREATE UNIQUE INDEX uq_mga_familia   ON modifier_group_asignacion (modifier_group_id, family_id)   WHERE family_id   IS NOT NULL;
CREATE UNIQUE INDEX uq_mga_categoria ON modifier_group_asignacion (modifier_group_id, category_id) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX uq_mga_producto  ON modifier_group_asignacion (modifier_group_id, product_id)  WHERE product_id  IS NOT NULL;
CREATE INDEX idx_mga_tenant    ON modifier_group_asignacion (tenant_id);
CREATE INDEX idx_mga_grupo     ON modifier_group_asignacion (modifier_group_id);
CREATE INDEX idx_mga_familia   ON modifier_group_asignacion (family_id);
CREATE INDEX idx_mga_categoria ON modifier_group_asignacion (category_id);
CREATE INDEX idx_mga_producto  ON modifier_group_asignacion (product_id);

-- Catálogo de los 14 alérgenos (global) y relación con productos
CREATE TABLE allergen (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo  text NOT NULL UNIQUE,            -- 'gluten','lacteos',...
  nombre  text NOT NULL
);

CREATE TABLE product_allergen (
  tenant_id   uuid NOT NULL,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  allergen_id uuid NOT NULL REFERENCES allergen(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, allergen_id)
);
CREATE INDEX idx_prodallergen_tenant ON product_allergen (tenant_id, product_id);

-- Inventario / escandallos
CREATE TABLE ingredient (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  unidad      text NOT NULL DEFAULT 'ud',  -- kg, l, ud...
  stock       numeric(14,3) NOT NULL DEFAULT 0,
  stock_minimo numeric(14,3),
  coste_unitario numeric(12,4),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingredient_tenant ON ingredient (tenant_id, id);

CREATE TABLE recipe_item (            -- escandallo: producto -> ingredientes
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  cantidad      numeric(14,3) NOT NULL
);
CREATE INDEX idx_recipe_tenant_product ON recipe_item (tenant_id, product_id);

CREATE TABLE stock_move (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredient(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA','MERMA','REGULARIZACION')),
  cantidad      numeric(14,3) NOT NULL,    -- relativo (decremento/incremento), ver docs/06 §4.3
  motivo        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stockmove_tenant_ing ON stock_move (tenant_id, ingredient_id, created_at);

-- Promociones (0020 + reglas de 0049). Ámbito: category_id/product_id, ambos
-- NULL = toda la carta. El TPV aún no las aplica al vender; se configuran en
-- el backoffice ((panel)/promociones).
CREATE TABLE promocion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  descripcion  text,
  tipo         text NOT NULL DEFAULT 'PCT' CHECK (tipo IN ('PCT','EUR')),  -- % o € de descuento
  valor        numeric(12,2) NOT NULL DEFAULT 0,
  fecha_inicio date,
  fecha_fin    date,
  hora_inicio  time,
  hora_fin     time,
  dias_semana  int[],                      -- 1=lunes … 7=domingo; null = todos
  category_id  uuid REFERENCES category(id) ON DELETE SET NULL,
  product_id   uuid REFERENCES product(id) ON DELETE SET NULL,
  activa       boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- =============================================================================
--  3. SALA Y VENTA
-- =============================================================================

CREATE TABLE room (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  nombre      text NOT NULL,               -- "Salón", "Terraza", "Barra"
  orden       int NOT NULL DEFAULT 0
);
CREATE INDEX idx_room_tenant_location ON room (tenant_id, location_id);

CREATE TABLE restaurant_table (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  room_id     uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  nombre      text NOT NULL,               -- "Mesa 5"
  pos_x       int,                         -- posición en el plano
  pos_y       int,
  estado      text NOT NULL DEFAULT 'LIBRE'
                CHECK (estado IN ('LIBRE','OCUPADA','PIDIENDO','SERVIDA','POR_COBRAR')),
  capacidad   int NOT NULL DEFAULT 4,         -- comensales (define la forma por defecto)
  rotacion    int NOT NULL DEFAULT 0,         -- giro en el plano (grados)
  sprite      text,                           -- forma explícita (0042); NULL = por capacidad
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_table_tenant_room ON restaurant_table (tenant_id, room_id);

-- Comanda / cuenta (sales_order para no usar la palabra reservada "order")
CREATE TABLE sales_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  table_id      uuid REFERENCES restaurant_table(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES app_user(id) ON DELETE SET NULL,
  estado        text NOT NULL DEFAULT 'ABIERTA'
                  CHECK (estado IN ('ABIERTA','ENVIADA_COCINA','SERVIDA','POR_COBRAR','COBRADA','ANULADA')),
  -- Tipo de operación: SOLO 'VENTA' genera factura/VERIFACTU. Las demás se
  -- registran (trazabilidad obligatoria) pero no facturan. Ver docs/07 y docs/14.
  tipo_operacion text NOT NULL DEFAULT 'VENTA'
                  CHECK (tipo_operacion IN ('VENTA','INVITACION','AUTOCONSUMO','MERMA','FORMACION')),
  motivo_no_venta text,   -- obligatorio si tipo_operacion <> 'VENTA'
  -- Estado de preparación (KDS y display de cliente, estilo fast-food)
  estado_preparacion text NOT NULL DEFAULT 'PENDIENTE'
                  CHECK (estado_preparacion IN ('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO')),
  numero_pedido int,      -- número visible en kiosko/display (p. ej. "A-37")
  canal         text NOT NULL DEFAULT 'TPV'
                  CHECK (canal IN ('TPV','COMANDERA','KIOSKO','ONLINE')),
  comensales    int,
  cliente_nombre   text,     -- pedido para llevar (0029)
  cliente_telefono text,     -- pedido para llevar (0029)
  tipo_consumo     text,     -- (0006)
  aparcado_como    text,     -- cuenta aparcada, etiqueta de recuperación (0036)
  notas            text,      -- nota libre de la mesa/cuenta (0043)
  customer_id   uuid REFERENCES customer(id) ON DELETE SET NULL,  -- cliente registrado (0036)
  total         numeric(12,2) NOT NULL DEFAULT 0,
  -- Sync / offline (docs/06 §4.5): UUID de cliente para idempotencia
  client_id     uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX idx_order_client ON sales_order (tenant_id, client_id);
CREATE INDEX idx_order_tenant_loc_estado ON sales_order (tenant_id, location_id, estado);

CREATE TABLE order_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES product(id) ON DELETE SET NULL,
  nombre        text NOT NULL,             -- copia del nombre (histórico estable)
  cantidad      numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL,  -- PVP, impuesto incluido
  tipo_impositivo numeric(5,2) NOT NULL,
  modificadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas         text,
  pase          int,                       -- curso/tiempo
  estacion      text,
  user_id       uuid REFERENCES app_user(id) ON DELETE SET NULL,  -- camarero que la añadió (0059)
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orderline_tenant_order ON order_line (tenant_id, order_id);
-- NOTA (0053): las RPC crear_pedido / crear_pedido_srv (no reflejadas en este
-- espejo, ver supabase/migrations/0053_precios_server_side.sql) valoran cada
-- línea SIEMPRE con product.precio y product.tipo_impositivo del tenant;
-- ignoran el precio/tipo que envíe el cliente (salvo precio variable NULL).

-- Log de eventos inmutables de la comanda (event sourcing ligero, docs/06 §4.2)
CREATE TABLE order_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  tipo        text NOT NULL,               -- CREADA, ENVIADA_COCINA, SERVIDA, ANULADA...
  payload     jsonb,
  user_id     uuid REFERENCES app_user(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orderevent_tenant_order ON order_event (tenant_id, order_id, created_at);

-- =============================================================================
--  4. COBRO Y FISCALIDAD
-- =============================================================================

CREATE TABLE payment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  metodo        text NOT NULL CHECK (metodo IN ('EFECTIVO','TARJETA','BIZUM','QR','WALLET','MIXTO')),
  importe       numeric(12,2) NOT NULL,
  propina       numeric(12,2) NOT NULL DEFAULT 0,
  ref_pasarela  text,                      -- id de Stripe/Redsys
  client_id     uuid NOT NULL,             -- idempotencia
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payment_client ON payment (tenant_id, client_id);
CREATE INDEX idx_payment_tenant_order ON payment (tenant_id, order_id);

-- Formas de pago configurables (0014 + flags de 0055). El TPV (cobro) y el
-- arqueo de caja consumen los flags abre_cajon / cuenta_arqueo.
CREATE TABLE payment_method (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  tipo          text NOT NULL DEFAULT 'OTRO'
                  CHECK (tipo IN ('EFECTIVO','TARJETA','BIZUM','VALE','OTRO')),
  activo        boolean DEFAULT true,
  abre_cajon    boolean NOT NULL DEFAULT false,   -- 0055
  cuenta_arqueo boolean NOT NULL DEFAULT true,     -- 0055
  orden         int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Factura / ticket. Numeración correlativa por (location, serie).
-- Forma consolidada tras 0034 (0001 + columnas VERIFACTU de 0022).
CREATE TABLE invoice (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id   uuid REFERENCES location(id) ON DELETE CASCADE,
  order_id      uuid REFERENCES sales_order(id) ON DELETE SET NULL,
  serie         text NOT NULL,
  numero        bigint NOT NULL,
  tipo          text NOT NULL DEFAULT 'F2'
                  CHECK (tipo IN ('F1','F2','F3','R1','R2','R3','R4','R5')),
  -- Datos del destinatario (solo en factura completa/cualificada)
  dest_nif      text,
  dest_nombre   text,
  dest_domicilio text,
  base_total    numeric(12,2) NOT NULL,
  cuota_total   numeric(12,2) NOT NULL,
  importe_total numeric(12,2) NOT NULL,
  fecha_expedicion text NOT NULL,           -- dd-mm-aaaa (formato AEAT, 0034)
  -- VERIFACTU (0022/0034): lo que escribe /api/factura
  num_serie_factura text,
  nif_emisor        text,
  nombre_emisor     text,
  tipo_factura      text NOT NULL DEFAULT 'F2',
  huella            text,
  huella_anterior   text,
  qr_url            text,
  fecha_hora_huso   text,
  estado_aeat       text NOT NULL DEFAULT 'NO_ENVIADA',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_invoice_serie_num ON invoice (tenant_id, location_id, serie, numero);
CREATE INDEX idx_invoice_tenant_loc ON invoice (tenant_id, location_id, fecha_expedicion);
ALTER TABLE invoice ADD CONSTRAINT invoice_tenant_serie_numero_key UNIQUE (tenant_id, serie, numero);

-- Series de documento (stub 0019 + gestor multi-serie de 0055). prefijo=código
-- de serie ("F","T"…), nombre=descripción. La facturación aún usa
-- location.serie_factura; migrará a elegir de aquí por tipo.
CREATE TABLE invoice_series (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre        text NOT NULL,                     -- descripción legible
  prefijo       text,                              -- código de serie
  tipo          text NOT NULL DEFAULT 'FACTURA'    -- 0055
                  CHECK (tipo IN ('FACTURA','TICKET','ABONO','PRESUPUESTO')),
  predeterminada boolean NOT NULL DEFAULT false,   -- 0055
  activa         boolean NOT NULL DEFAULT true,    -- 0055
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Desglose de impuestos por tipo (un ticket puede tener varios: 7% y 15%)
CREATE TABLE tax_line (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  impuesto    text NOT NULL CHECK (impuesto IN ('IVA','IGIC','IPSI')),
  tipo        numeric(5,2) NOT NULL,
  base        numeric(12,2) NOT NULL,
  cuota       numeric(12,2) NOT NULL
);
CREATE INDEX idx_taxline_tenant_invoice ON tax_line (tenant_id, invoice_id);

-- Registro VERIFACTU (hash encadenado + QR + estado de envío a AEAT)
CREATE TABLE verifactu_record (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  invoice_id      uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  device_id       uuid REFERENCES device(id) ON DELETE SET NULL,
  tipo_registro   text NOT NULL DEFAULT 'ALTA' CHECK (tipo_registro IN ('ALTA','ANULACION')),
  huella          text NOT NULL,           -- SHA-256 hex (64) mayúsculas
  huella_anterior text NOT NULL DEFAULT '',
  qr_url          text NOT NULL,
  fecha_hora_gen  timestamptz NOT NULL,    -- con huso horario
  -- Estado de remisión a la AEAT (modalidad VERIFACTU)
  estado_envio    text NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado_envio IN ('PENDIENTE','ENVIADO','ACEPTADO','RECHAZADO','OFFLINE')),
  respuesta_aeat  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_verifactu_invoice ON verifactu_record (tenant_id, invoice_id, tipo_registro);
CREATE INDEX idx_verifactu_estado ON verifactu_record (tenant_id, estado_envio);

-- (Módulo País Vasco — fase posterior) Registro TicketBAI
CREATE TABLE ticketbai_record (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  invoice_id  uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  territorio  text NOT NULL CHECK (territorio IN ('ARABA','GIPUZKOA','BIZKAIA')),
  firma       text,
  encadenamiento text,
  estado_envio text NOT NULL DEFAULT 'PENDIENTE',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticketbai_tenant_invoice ON ticketbai_record (tenant_id, invoice_id);

-- Arqueo de caja
CREATE TABLE cash_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  device_id   uuid REFERENCES device(id) ON DELETE SET NULL,
  abierta_por uuid REFERENCES app_user(id) ON DELETE SET NULL,
  fondo_inicial numeric(12,2) NOT NULL DEFAULT 0,
  abierta_en  timestamptz NOT NULL DEFAULT now(),
  cerrada_en  timestamptz,
  total_efectivo numeric(12,2),
  total_tarjeta  numeric(12,2),
  descuadre   numeric(12,2)
);
CREATE INDEX idx_cashsession_tenant_loc ON cash_session (tenant_id, location_id, abierta_en);

CREATE TABLE cash_move (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  cash_session_id uuid NOT NULL REFERENCES cash_session(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  importe         numeric(12,2) NOT NULL,
  motivo          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cashmove_tenant_session ON cash_move (tenant_id, cash_session_id);

-- =============================================================================
--  5. CLIENTES Y CANALES
-- =============================================================================

CREATE TABLE customer (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre        text,
  email         text,
  telefono      text,
  -- RGPD: consentimiento explícito para marketing (docs/12 §6)
  consentimiento_marketing boolean NOT NULL DEFAULT false,
  puntos_fidelidad int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_tenant ON customer (tenant_id, id);

CREATE TABLE reservation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customer(id) ON DELETE SET NULL,
  fecha_hora  timestamptz NOT NULL,
  comensales  int NOT NULL,
  estado      text NOT NULL DEFAULT 'CONFIRMADA'
                CHECK (estado IN ('PENDIENTE','CONFIRMADA','SENTADA','CANCELADA','NO_SHOW')),
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservation_tenant_loc ON reservation (tenant_id, location_id, fecha_hora);

CREATE TABLE online_order (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  order_id    uuid REFERENCES sales_order(id) ON DELETE SET NULL,
  origen      text NOT NULL CHECK (origen IN ('PROPIO','GLOVO','UBER_EATS','JUST_EAT','OTRO')),
  ref_externa text,
  estado      text NOT NULL DEFAULT 'RECIBIDO',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onlineorder_tenant_loc ON online_order (tenant_id, location_id, created_at);

-- =============================================================================
--  6. TRIGGERS updated_at
-- =============================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tenant','location','device','app_user','category','product','ingredient',
    'restaurant_table','sales_order','invoice','customer'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END$$;

-- =============================================================================
--  setting — configuración clave/valor por ámbito (GLOBAL/LOCAL/DEVICE).
--  Helpers setting_get()/setting_set() en supabase/migrations/0023_setting.sql
--  (setting_set valida pertenencia de location_id/device_id al tenant en 0054).
-- =============================================================================
CREATE TABLE setting (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope       text NOT NULL CHECK (scope IN ('GLOBAL','LOCAL','DEVICE')),
  location_id uuid REFERENCES location(id) ON DELETE CASCADE,
  device_id   uuid REFERENCES device(id)   ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setting_scope_target_chk CHECK (
    (scope = 'GLOBAL' AND location_id IS NULL AND device_id IS NULL) OR
    (scope = 'LOCAL'  AND location_id IS NOT NULL AND device_id IS NULL) OR
    (scope = 'DEVICE' AND device_id  IS NOT NULL)
  )
);
CREATE UNIQUE INDEX setting_global_uq ON setting (tenant_id, key) WHERE scope = 'GLOBAL';
CREATE UNIQUE INDEX setting_local_uq  ON setting (tenant_id, location_id, key) WHERE scope = 'LOCAL';
CREATE UNIQUE INDEX setting_device_uq ON setting (tenant_id, device_id, key) WHERE scope = 'DEVICE';
CREATE INDEX setting_tenant_key_idx ON setting (tenant_id, key);
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON setting
  FOR EACH ROW EXECUTE FUNCTION set_tenant_id();
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON setting
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
--  7. ROW-LEVEL SECURITY (aislamiento por tenant)
--     Se aplica a todas las tablas con tenant_id. La app conecta con un rol
--     SIN BYPASSRLS y fija  SET app.tenant_id  en cada transacción.
-- =============================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'location','device','app_user','shift','category','product','product_category',
    'modifier_group','modifier','modifier_group_asignacion',
    'product_allergen','ingredient','recipe_item','stock_move','room',
    'restaurant_table','sales_order','order_line','order_event','payment','invoice',
    'tax_line','verifactu_record','ticketbai_record','cash_session','cash_move',
    'customer','reservation','online_order','setting','tenant_module',
    'perfil','tarifa','product_price','promocion','licencia',
    'payment_method','invoice_series'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_tenant_id())
         WITH CHECK (tenant_id = current_tenant_id());', t);
  END LOOP;
END$$;

-- La tabla tenant se filtra por id (no tiene tenant_id)
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenant
  USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

-- 'allergen' es catálogo global (sin tenant): lectura para todos, sin RLS.

-- =============================================================================
--  8. ROL DE APLICACIÓN (ejecutar como superusuario en el setup)
-- =============================================================================
-- CREATE ROLE gluuh_app LOGIN PASSWORD '***';   -- NO superusuario, NO BYPASSRLS
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gluuh_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gluuh_app;
--
-- En cada petición/transacción la aplicación ejecuta:
--   SET LOCAL app.tenant_id = '<uuid-del-tenant-del-JWT>';
-- =============================================================================
