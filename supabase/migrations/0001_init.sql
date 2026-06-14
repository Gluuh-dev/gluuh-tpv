-- Migración inicial de Supabase.
-- ESPEJO de apps/api/db/schema.sql — mantener ambos sincronizados.
-- Aplicar con: supabase db push   (o psql "$DATABASE_URL" -f este_archivo)

-- =============================================================================
--  Gluppo TPV — Esquema de base de datos (PostgreSQL)
--  Multi-tenant: shared schema + tenant_id + Row-Level Security (RLS)
--  Ver docs/06-base-de-datos-y-sincronizacion.md y docs/07 (fiscalidad)
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
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_location_tenant ON location (tenant_id, id);

-- Dispositivo registrado (TPV, comandera, KDS). Clave para numeración offline.
CREATE TABLE device (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('TPV','COMANDERA','KDS','WEB')),
  nombre          text NOT NULL,
  -- Serie de facturación asignada a este dispositivo (numeración sin huecos offline)
  serie_dispositivo text,
  -- Última huella VERIFACTU emitida por el dispositivo (encadenamiento offline)
  ultima_huella   text,
  ultima_sync     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_tenant_location ON device (tenant_id, location_id);

-- Usuarios (empleados). Login backoffice (email+pass) y TPV (PIN).
CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  email           text,
  password_hash   text,            -- Argon2/bcrypt (backoffice)
  pin_hash        text,            -- PIN del camarero en TPV/comandera
  rol             text NOT NULL DEFAULT 'CAMARERO'
                    CHECK (rol IN ('ADMIN_PLATAFORMA','PROPIETARIO','ENCARGADO','CAMARERO','COCINA')),
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_user_email ON app_user (email) WHERE email IS NOT NULL;
CREATE INDEX idx_user_tenant ON app_user (tenant_id, id);

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

-- =============================================================================
--  2. CATÁLOGO (carta, productos, inventario)
-- =============================================================================

CREATE TABLE category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  orden       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_category_tenant ON category (tenant_id, orden);

CREATE TABLE product (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES category(id) ON DELETE SET NULL,
  nombre          text NOT NULL,
  precio          numeric(12,2) NOT NULL,     -- PVP, impuesto incluido
  tipo_impositivo numeric(5,2) NOT NULL DEFAULT 10,  -- % (10 IVA host., 7 IGIC...)
  es_alcohol      boolean NOT NULL DEFAULT false,
  estacion        text,                       -- enrutado a cocina/barra (docs/10)
  foto_url        text,
  disponible      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_tenant_cat ON product (tenant_id, category_id);

CREATE TABLE modifier_group (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  nombre      text NOT NULL,               -- "Punto de la carne", "Extras"
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
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orderline_tenant_order ON order_line (tenant_id, order_id);

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

-- Factura / ticket. Numeración correlativa por (location, serie).
CREATE TABLE invoice (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
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
  fecha_expedicion date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_invoice_serie_num ON invoice (tenant_id, location_id, serie, numero);
CREATE INDEX idx_invoice_tenant_loc ON invoice (tenant_id, location_id, fecha_expedicion);

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
--  7. ROW-LEVEL SECURITY (aislamiento por tenant)
--     Se aplica a todas las tablas con tenant_id. La app conecta con un rol
--     SIN BYPASSRLS y fija  SET app.tenant_id  en cada transacción.
-- =============================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'location','device','app_user','shift','category','product','modifier_group',
    'modifier','product_allergen','ingredient','recipe_item','stock_move','room',
    'restaurant_table','sales_order','order_line','order_event','payment','invoice',
    'tax_line','verifactu_record','ticketbai_record','cash_session','cash_move',
    'customer','reservation','online_order'
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
-- CREATE ROLE gluppo_app LOGIN PASSWORD '***';   -- NO superusuario, NO BYPASSRLS
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gluppo_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gluppo_app;
--
-- En cada petición/transacción la aplicación ejecuta:
--   SET LOCAL app.tenant_id = '<uuid-del-tenant-del-JWT>';
-- =============================================================================
