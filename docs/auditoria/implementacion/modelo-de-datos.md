# Modelo de Datos Unificado — Gluuh TPV

> **Propósito.** Consolidar en un único esquema coherente todos los DDL dispersos por las
> fichas de referencia del configurador (Ágora) y reconciliarlos con las **migraciones ya
> aplicadas** en `supabase/migrations/*.sql`. Este documento **extiende y reconcilia** lo
> existente; **no lo rompe**. Es el esquema objetivo (target) hacia el que deben converger
> las próximas migraciones.
>
> Multi-tenant (shared schema + `tenant_id` + RLS), PostgreSQL/Supabase. Precios con
> impuesto **incluido**; el tipo se resuelve por **clase fiscal × territorio**
> (`@gluuh/core` `ivaAuto` ⇆ tabla `tax_rate` + función `resolver_iva()`).

## Cómo leer este documento

Cada bloque `sql` lleva en su cabecera una etiqueta:

- `-- [EXISTE]` — la tabla ya está creada por una migración (se indica cuál). Aquí se
  muestra su forma actual; las columnas marcadas `-- +nuevo` son ampliaciones propuestas
  (un `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, nunca un `DROP`).
- `-- [NUEVO]` — tabla aún inexistente en migraciones; proviene de las fichas Ágora.
- `-- [RECONCILIA]` — existe con otro nombre/forma en migraciones y aquí se propone el
  nombre canónico (se anota el alias previo para no perderlo).

---

## 0. Convenciones

- **PK**: `uuid` con `DEFAULT gen_random_uuid()` (extensión `pgcrypto`). Las tablas de
  catálogo global (alérgenos oficiales, permisos) pueden usar PK `int`/`text` estable.
- **Aislamiento**: toda tabla de negocio lleva `tenant_id uuid NOT NULL REFERENCES tenant(id)`
  y RLS por `tenant_id = current_tenant_id()`. Las **tablas hija** (líneas de documento,
  scopes, conversiones) pueden heredar el tenant vía su FK padre, pero por rendimiento de
  RLS se recomienda **denormalizar `tenant_id`** y ponerlo como primera columna del índice.
- **Timestamps**: `created_at timestamptz NOT NULL DEFAULT now()`; `updated_at` con trigger
  `set_updated_at()` en las tablas mutables; borrado lógico con `deleted_at timestamptz`
  donde aplica (documentos de venta, por trazabilidad/sync).
- **Importes**: `numeric(12,2)` (importes), `numeric(14,3)` (cantidades de stock),
  `numeric(12,4)` (costes unitarios), `numeric(5,2)`/`numeric(6,3)` (porcentajes de impuesto).
- **Enums**: se modelan como `text` con `CHECK (… IN (…))` (flexibilidad de migración y
  compatibilidad con PowerSync), no como tipos `ENUM` nativos.
- **Configuración por ámbito** (`setting`): clave/valor con `scope ∈ {GLOBAL, LOCAL, DEVICE}`.
  La resolución es **DEVICE → LOCAL → GLOBAL** (lo más específico gana). Evita multiplicar
  columnas de flags por terminal; ver §11.
- **Funciones canónicas** (de `0001_init.sql` / `0012_catalogo_fiscal.sql`):
  - `current_tenant_id() → uuid` — lee `current_setting('app.tenant_id')`. Eje de toda RLS.
  - `set_updated_at()` — trigger `BEFORE UPDATE`.
  - `resolver_iva(clase, territorio) → numeric` — % automático por clase × territorio.
- **Patrón RLS canónico** (idéntico al de las migraciones; aplicar a cada tabla con `tenant_id`):

```sql
ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<tabla> FORCE  ROW LEVEL SECURITY;   -- la app NO usa BYPASSRLS
DROP POLICY IF EXISTS <tabla>_rw ON public.<tabla>;
CREATE POLICY <tabla>_rw ON public.<tabla> FOR ALL
  USING      (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
GRANT ALL ON public.<tabla> TO authenticated;
```

> En cada petición la app fija `SET LOCAL app.tenant_id = '<uuid-del-JWT>'`. El rol de la
> aplicación **no** tiene `BYPASSRLS`. En los bloques siguientes se omite el RLS repetitivo
> salvo en casos especiales (catálogo global sin tenant, tabla `tenant`, etc.).

---

## 1. Organización · locales · dispositivos · usuarios · permisos

```sql
-- [EXISTE] 0001_init.sql — un tenant = un cliente del SaaS (bar o cadena)
CREATE TABLE tenant (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,                 -- razón social / nombre fiscal
  plan         text NOT NULL DEFAULT 'FREE'
                 CHECK (plan IN ('FREE','PRO','AVANZADO','CADENA')),
  cif          text,
  email_admin  text,
  -- +nuevo (empresa.md): identidad fiscal/comercial del emisor
  nombre_comercial text,
  direccion    text, poblacion text, provincia text, cp text, pais text DEFAULT 'ES',
  telefono     text, email text, web text, logo_url text,
  activo       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
-- RLS especial: la tabla tenant se filtra por id (no tiene tenant_id)
--   CREATE POLICY tenant_self ON tenant USING (id = current_tenant_id()) …

-- [EXISTE] 0001_init.sql — local/establecimiento; aquí vive el TERRITORIO FISCAL
CREATE TABLE location (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre              text NOT NULL,
  direccion           text,
  cif                 text NOT NULL,
  razon_social        text NOT NULL,
  territorio_fiscal   text NOT NULL DEFAULT 'PENINSULA_BALEARES'
    CHECK (territorio_fiscal IN
      ('PENINSULA_BALEARES','CANARIAS','CEUTA_MELILLA','FORAL_PV','FORAL_NAVARRA')),
  regimen_facturacion text NOT NULL DEFAULT 'VERIFACTU'
    CHECK (regimen_facturacion IN ('VERIFACTU','TICKETBAI','BATUZ','OTRO')),
  serie_factura       text NOT NULL DEFAULT 'F',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- [NUEVO] puntos-de-venta.md — agrupación de terminales
CREATE TABLE device_group (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL
);

-- [EXISTE] 0001_init.sql — dispositivo/terminal (TPV, comandera, KDS). Numeración offline.
--          EXTIENDE con campos de puntos-de-venta.md
CREATE TABLE device (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id       uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  tipo              text NOT NULL CHECK (tipo IN ('TPV','COMANDERA','KDS','WEB')),
  nombre            text NOT NULL,
  serie_dispositivo text,            -- numeración sin huecos offline
  ultima_huella     text,            -- encadenamiento VERIFACTU offline
  ultima_sync       timestamptz,
  -- +nuevo (puntos-de-venta.md)
  group_id          uuid REFERENCES device_group(id) ON DELETE SET NULL,
  stock_location_id uuid,            -- almacén; null ⇒ usar el del centro (FK §7)
  master_device_id  uuid REFERENCES device(id) ON DELETE SET NULL,  -- servidor LAN
  permite_cobro     boolean NOT NULL DEFAULT true,
  cash_control_id   uuid,            -- cajón inteligente (FK §9)
  gateway_config_id uuid,            -- pasarela datáfono (FK §9)
  button_layout_id  uuid,            -- diseño de botones (FK §11)
  balanza           boolean NOT NULL DEFAULT false,
  visor             text NOT NULL DEFAULT 'NINGUNO',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- [NUEVO] puntos-de-venta.md — impresión por tipo de documento en el terminal
CREATE TABLE device_doc_print (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  device_id  uuid NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  doc_tipo   text NOT NULL CHECK (doc_tipo IN
              ('FRA_SIMP','FACTURA','ALBARAN','PROFORMA','ENTRADA','CAJON')),
  printer_id uuid,                   -- FK a printer (§11)
  cuando     text NOT NULL DEFAULT 'SIEMPRE' CHECK (cuando IN ('NUNCA','SIEMPRE','PREGUNTAR')),
  copias     int  NOT NULL DEFAULT 1,
  template_id uuid                   -- plantilla de ticket/etiqueta
);

-- [NUEVO] puntos-de-venta.md — enrutado de cocina por estación desde el terminal
CREATE TABLE device_kitchen_route (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  device_id             uuid NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  descripcion           text,
  prep_station_id       uuid,        -- estación destino (§6)
  printer_id            uuid,        -- impresora física, o…
  kitchen_monitor_id    uuid,        -- …monitor KDS (§6)
  centro_venta          text NOT NULL DEFAULT 'TODOS'
);

-- [NUEVO] usuarios-y-perfiles.md — perfil de usuario
CREATE TABLE role (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL
);
--          (existe la tabla stub `perfil` en 0020_config_admin.sql → RECONCILIA a `role`)

-- [NUEVO] usuarios-y-perfiles.md — catálogo GLOBAL de permisos (sin tenant)
CREATE TABLE permission (
  id          text PRIMARY KEY,             -- 'pos.albaran.facturar'
  aplicacion  text NOT NULL CHECK (aplicacion IN ('Punto de Venta','Administración','Informes')),
  accion      text NOT NULL
);

-- [NUEVO] usuarios-y-perfiles.md — N:N perfil ⇆ permiso
CREATE TABLE role_permission (
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- [EXISTE] 0001_init.sql — usuario/empleado; EXTIENDE con usuarios-y-perfiles.md
CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  email           text,
  password_hash   text,            -- backoffice (Argon2/bcrypt)
  pin_hash        text,            -- compat. (PIN TPV)
  rol             text NOT NULL DEFAULT 'CAMARERO'
    CHECK (rol IN ('ADMIN_PLATAFORMA','PROPIETARIO','ENCARGADO','CAMARERO','COCINA')),
  -- +nuevo (usuarios-y-perfiles.md): perfil granular y doble auth
  role_id         uuid REFERENCES role(id) ON DELETE SET NULL,
  auth_user_id    uuid,            -- enlace a Supabase Auth (auth.users)
  pin_comandera   text,            -- PIN por superficie (hash)
  tarjeta         text, huella boolean NOT NULL DEFAULT false,
  color           text, avatar_url text,
  mostrar_en_venta boolean NOT NULL DEFAULT true, prioridad int NOT NULL DEFAULT 0,
  es_repartidor   boolean NOT NULL DEFAULT false,
  nss text, nif text, telefono text, direccion text, poblacion text, provincia text, cp text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- [NUEVO] usuarios-y-perfiles.md — en qué grupos de TPV opera el usuario
CREATE TABLE user_device_group (
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  device_group_id uuid NOT NULL REFERENCES device_group(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, device_group_id)
);

-- [EXISTE] 0001_init.sql — fichajes / control horario
CREATE TABLE shift (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  entrada   timestamptz NOT NULL,
  salida    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 2. Fiscal (tipos · series · VERIFACTU)

```sql
-- [EXISTE] 0012_catalogo_fiscal.sql — % por territorio × clase fiscal (★ núcleo).
--          Forma actual: PK (territorio, clase_fiscal) global, sembrada.
--          RECONCILIA con impuestos.md (que propone por-tenant + tipo + recargo).
CREATE TABLE tax_rate (
  territorio   text NOT NULL,        -- PENINSULA_BALEARES | CANARIAS | CEUTA_MELILLA | FORAL_*
  clase_fiscal text NOT NULL,        -- GENERAL | REDUCIDO | SUPERREDUCIDO | EXENTO
  porcentaje   numeric(5,2) NOT NULL,
  -- +nuevo (impuestos.md): familia de impuesto y recargo de equivalencia
  tipo               text NOT NULL DEFAULT 'IVA' CHECK (tipo IN ('IVA','IGIC','IPSI')),
  recargo_equivalencia numeric(6,3) NOT NULL DEFAULT 0,  -- 21→5,2 / 10→1,4 / 4→0,5
  habilitado         boolean NOT NULL DEFAULT true,
  PRIMARY KEY (territorio, clase_fiscal)
);
-- Valores deben coincidir con TIPOS_POR_TERRITORIO de @gluuh/core (innegociable).
-- Lectura pública: GRANT SELECT ON tax_rate TO authenticated, anon;

-- [NUEVO] series.md — series de numeración legal (canónica).
--          Coexiste con el stub `invoice_series` de 0019 (RECONCILIA → document_series).
CREATE TABLE document_series (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  device_id     uuid REFERENCES device(id) ON DELETE SET NULL,  -- null = compartida; set = por terminal offline
  nombre        text NOT NULL,       -- 'T','F','TW','PC'…
  tipo          text NOT NULL CHECK (tipo IN
                  ('FRA_SIMP','FACTURA','DEV_SIMP','DEVOLUCION','ALBARAN',
                   'PEDIDO','PED_PROV','ALB_PROV','FRA_PROV')),
  origen        text NOT NULL CHECK (origen IN ('TPV','WEB','COMPRAS')),
  ejercicio     int  NOT NULL,       -- año fiscal
  siguiente_num bigint NOT NULL DEFAULT 1,
  en_uso        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, location_id, nombre, ejercicio)
);
-- El incremento de siguiente_num es ATÓMICO en backend (función Postgres), nunca en cliente.

-- [NUEVO] herramientas/verifactu.md — configuración del emisor VERIFACTU (mTLS)
CREATE TABLE verifactu_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre_fiscal   text NOT NULL,
  nif             text NOT NULL,
  activado_en     date,
  entorno         text NOT NULL DEFAULT 'PRODUCCION' CHECK (entorno IN ('PRUEBAS','PRODUCCION')),
  certificado_ref text                -- referencia segura (NUNCA el .p12 en claro)
);
```

> Las tablas `invoice`, `invoice_tax_line` y el registro VERIFACTU encadenado se definen en
> §10 (operativa de venta), porque pertenecen al flujo de cobro. El **Visor Verifactu** opera
> sobre `invoice` ya persistida (huella, huella_anterior, estado_aeat, CSV).

---

## 3. Catálogo (clasificación · producto · modificadores · menús · alérgenos · etiquetas)

```sql
-- [EXISTE 0020 como stub `grupo_mayor`] clasificacion.md → canónico mayor_group
CREATE TABLE mayor_group (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL
);

-- [EXISTE] 0012_catalogo_fiscal.sql — familias; EXTIENDE con clasificacion.md
CREATE TABLE family (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre         text NOT NULL,
  orden          int  DEFAULT 0,
  color          text DEFAULT '#64748b',
  -- +nuevo (clasificacion.md)
  parent_id      uuid REFERENCES family(id) ON DELETE SET NULL,        -- familia padre
  mayor_group_id uuid REFERENCES mayor_group(id) ON DELETE SET NULL,
  orden_factura  int  DEFAULT 0,
  imagen_url     text, texto text,
  mostrar_tpv    boolean DEFAULT true, mostrar_menus boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- [EXISTE] 0001_init.sql (+family_id en 0012) — categorías; EXTIENDE con clasificacion.md
CREATE TABLE category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  orden       int NOT NULL DEFAULT 0,
  family_id   uuid REFERENCES family(id) ON DELETE SET NULL,
  -- +nuevo (clasificacion.md)
  parent_id   uuid REFERENCES category(id) ON DELETE SET NULL,         -- categoría padre
  color       text, imagen_url text, texto text,
  mostrar_tpv boolean DEFAULT true, mostrar_menus boolean DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- [EXISTE] 0001_init.sql (+clase_fiscal/family_id en 0012) — producto (★ ficha central).
--          EXTIENDE con producto.md (nombres múltiples, comportamiento, cocina, stock).
CREATE TABLE product (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES category(id) ON DELETE SET NULL,     -- categoría "principal" (compat)
  family_id       uuid REFERENCES family(id) ON DELETE SET NULL,
  nombre          text NOT NULL,                       -- = nombre_carta
  precio          numeric(12,2) NOT NULL DEFAULT 0,    -- PVP base (imp. incluido); detalle en product_price
  clase_fiscal    text NOT NULL DEFAULT 'REDUCIDO'
    CHECK (clase_fiscal IN ('GENERAL','REDUCIDO','SUPERREDUCIDO','EXENTO')),
  tipo_impositivo numeric(5,2),                        -- compat.; preferir resolver_iva()
  es_alcohol      boolean NOT NULL DEFAULT false,
  estacion        text,                                -- Tipo Prep. (Barra/Cocina/Tostadas)
  foto_url        text,
  disponible      boolean NOT NULL DEFAULT true,
  -- +nuevo (producto.md): textos por canal
  texto_boton     text, nombre_ticket text, nombre_cocina text, texto_etiqueta text[],
  -- +nuevo: cocina / preparación
  orden_prep      text, plu text, tiempo_prep_min int, tiempo_preaviso_min int,
  -- +nuevo: comportamiento de venta
  vende_principal boolean NOT NULL DEFAULT true, vende_anadido boolean NOT NULL DEFAULT false,
  limitar_disponibilidad boolean NOT NULL DEFAULT false, venta_por_peso boolean NOT NULL DEFAULT false,
  solicitar_anadidos boolean NOT NULL DEFAULT false, solicitar_notas boolean NOT NULL DEFAULT false,
  no_imprimir_si_cero boolean NOT NULL DEFAULT false, preguntar_cambio_cantidad boolean NOT NULL DEFAULT false,
  -- +nuevo: estilo / stock / compras
  color text, boton_directo boolean NOT NULL DEFAULT false,
  controlar_stock boolean NOT NULL DEFAULT false,
  origen          text NOT NULL DEFAULT 'COMPRA_PROVEEDOR'
    CHECK (origen IN ('SOLO_INVENTARIO','COMPRA_PROVEEDOR')),
  ud_medida text, ud_compra text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- [NUEVO] producto.md — N:N producto ⇆ categoría (un producto en varias categorías)
CREATE TABLE product_category (
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- [NUEVO] producto.md — códigos de barras del producto
CREATE TABLE product_barcode (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  code       text NOT NULL,
  principal  boolean NOT NULL DEFAULT false
);

-- [EXISTE] 0001_init.sql — grupos de modificadores; RECONCILIA con producto.md "Añadidos"
CREATE TABLE modifier_group (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  min_sel     int NOT NULL DEFAULT 0,
  max_sel     int NOT NULL DEFAULT 1,
  orden       int NOT NULL DEFAULT 0     -- +nuevo
);

-- [EXISTE] 0001_init.sql — opciones del modificador. Los "añadidos" de Ágora suelen ser
--          productos con vende_anadido=true; modifier mantiene el modelo simple/inline.
CREATE TABLE modifier (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  modifier_group_id uuid NOT NULL REFERENCES modifier_group(id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  precio_extra      numeric(12,2) NOT NULL DEFAULT 0,
  product_ref_id    uuid REFERENCES product(id) ON DELETE SET NULL  -- +nuevo: añadido que es producto
);

-- [EXISTE] 0013_menus.sql — menú/combo. EXTIENDE con menus.md (textos, plu, estilo).
CREATE TABLE menu (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  precio       numeric(12,2) NOT NULL DEFAULT 0,     -- precio fijo (imp. incluido)
  clase_fiscal text NOT NULL DEFAULT 'REDUCIDO',
  activo       boolean DEFAULT true,
  orden        int DEFAULT 0,
  -- +nuevo (menus.md)
  vendible     boolean DEFAULT true, limitar_disponibilidad boolean DEFAULT false,
  plu text, color text, imagen_url text,
  nombre_ticket text, nombre_cocina text, ind_platos_comanda text,
  created_at   timestamptz DEFAULT now()
);

-- [EXISTE 0013 como `menu_group`] menus.md → grupo/paso del menú (alias: menu_step)
CREATE TABLE menu_group (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  menu_id     uuid NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
  nombre      text NOT NULL,                          -- "Primero","Segundo","Postre"
  orden       int DEFAULT 0,
  -- +nuevo (menus.md)
  category_id uuid REFERENCES category(id) ON DELETE SET NULL,  -- de qué categoría se elige
  num_platos  int DEFAULT 1,
  orden_prep  text                                    -- pase
);

-- [EXISTE] 0013_menus.sql — platos elegibles por grupo (con suplemento opcional)
CREATE TABLE menu_choice (
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES menu_group(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, product_id)
);
-- El suplemento por plato se resuelve vía product_price.suplemento_menu (§4).

-- [EXISTE] 0001_init.sql — catálogo de alérgenos. RECONCILIA con alergenos.md (14 oficiales).
--          (También existe stub `alergeno` en 0020 → consolidar en allergen)
CREATE TABLE allergen (
  id        int PRIMARY KEY,          -- 1..14 oficiales UE Reg. 1169/2011 (+ personalizados)
  tenant_id uuid REFERENCES tenant(id) ON DELETE CASCADE,  -- null = catálogo común
  codigo    text,                     -- 'gluten','lacteos',…
  nombre    text NOT NULL,
  icono_url text                      -- +nuevo
);

-- [EXISTE] 0001_init.sql — N:N producto ⇆ alérgeno; +tipo CONTIENE/TRAZAS
CREATE TABLE product_allergen (
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  allergen_id int  NOT NULL REFERENCES allergen(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'CONTIENE' CHECK (tipo IN ('CONTIENE','TRAZAS')),
  PRIMARY KEY (product_id, allergen_id)
);

-- [EXISTE 0020 como `etiqueta_producto`] etiquetas.md → canónico tag
CREATE TABLE tag (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL,
  color     text
);

-- [NUEVO] etiquetas.md — N:N polimórfica (product | category | family)
CREATE TABLE entity_tag (
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('product','category','family')),
  entity_id   uuid NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

-- [EXISTE] 0001_init.sql — unidad de medida de catálogo (compat). Ver §7 unit_of_measure.
-- [NUEVO] entradas.md — plantilla/tipo/instancia de "Entradas" (vales/tickets canjeables)
CREATE TABLE voucher_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, columnas int DEFAULT 42, formato jsonb
);
CREATE TABLE voucher_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  template_id uuid REFERENCES voucher_template(id) ON DELETE SET NULL,
  validez_dias int,
  producto_imprime_id uuid REFERENCES product(id) ON DELETE SET NULL,
  producto_canjea_id  uuid REFERENCES product(id) ON DELETE SET NULL
);
CREATE TABLE voucher (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  voucher_type_id uuid NOT NULL REFERENCES voucher_type(id) ON DELETE CASCADE,
  codigo text NOT NULL,                          -- código/QR único
  emitida_en timestamptz NOT NULL DEFAULT now(), caduca_en timestamptz,
  canjeada boolean NOT NULL DEFAULT false, canjeada_en timestamptz,
  UNIQUE (tenant_id, codigo)                      -- canje idempotente
);
```

---

## 4. Tarifas y precios (tarifa · product_price · horarios · promociones · descuentos)

```sql
-- [EXISTE 0020 como stub `tarifa`] tarifas.md → canónico price_list
CREATE TABLE price_list (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre                   text NOT NULL,                -- LOCAL, COFFEE…
  precio_incluye_impuestos boolean NOT NULL DEFAULT true,
  created_at               timestamptz DEFAULT now()
);

-- [NUEVO] producto.md §8 — precio por TARIFA (clave: price_list_id)
CREATE TABLE product_price (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  price_list_id   uuid NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
  precio          numeric(12,2) NOT NULL,        -- principal (impuesto incluido)
  precio_anadido  numeric(12,2),                 -- como añadido
  suplemento_menu numeric(12,2),                 -- suplemento dentro de un menú
  impuesto_override text,                        -- null ⇒ usa product.clase_fiscal
  UNIQUE (product_id, price_list_id)
);

-- [NUEVO] tarifas.md / precios.md — vigencia horaria de tarifa (happy hour, turnos)
CREATE TABLE price_list_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  price_list_id uuid NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
  dias          int[],                           -- 1=Lun … 7=Dom
  hora_inicio   time, hora_fin time,
  desde         date, hasta date
);

-- [EXISTE 0020 como stub `promocion`] promociones.md → canónico promotion
CREATE TABLE promotion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre              text NOT NULL,
  codigo              text,
  desde               date, hasta date,
  programacion        jsonb,                      -- días/horas (null = siempre)
  tipo                text NOT NULL CHECK (tipo IN ('DESCUENTO_DIRECTO','NXM','REGALO')),
  aplicar_a           text NOT NULL DEFAULT 'TODOS_TICKETS',
  aplicaciones_ticket int,                        -- null = sin límite
  uds_requeridas      numeric(10,3) NOT NULL DEFAULT 0,
  tipo_descuento      text CHECK (tipo_descuento IN ('PORCENTAJE','IMPORTE')),
  descuento           numeric(10,2),
  aplicar             text NOT NULL DEFAULT 'POR_GRUPOS',
  descontar_sobre     text NOT NULL DEFAULT 'MAS_CAROS'
    CHECK (descontar_sobre IN ('MAS_CAROS','MAS_BARATOS')),
  activa              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);
CREATE TABLE promotion_product (             -- [NUEVO] N:N promoción ⇆ producto
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotion(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- [EXISTE] 0015_descuentos.sql — descuento manual. EXTIENDE con descuentos.md.
CREATE TABLE discount (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'TICKET'  CHECK (tipo IN ('LINEA','TICKET')),  -- +nuevo
  modo       text NOT NULL DEFAULT 'PORCENTAJE' CHECK (modo IN ('PORCENTAJE','IMPORTE')),
  valor      numeric(12,2) NOT NULL DEFAULT 0,
  codigo     text,                            -- +nuevo
  requiere_autorizacion boolean NOT NULL DEFAULT false,   -- +nuevo (cruza con permisos/PIN)
  color text, imagen_url text,                -- +nuevo
  activo     boolean DEFAULT true,
  orden      int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

> El **cálculo** de promociones/descuentos se delega en `@gluuh/core` para que el desglose
> base/cuota cuadre con VERIFACTU. La tabla solo guarda la **definición**.

---

## 5. Sala (centros de venta · mesas · planos)

```sql
-- [EXISTE 0019 como stub `sales_center`] centros-de-venta.md → forma canónica
CREATE TABLE sales_center (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  -- +nuevo (centros-de-venta.md)
  price_list_id     uuid REFERENCES price_list(id) ON DELETE SET NULL,   -- Tarifa
  stock_location_id uuid,                          -- almacén (FK §7)
  grupo_inicial_id  uuid,                          -- grupo de botones inicial
  pedir_comensales  text NOT NULL DEFAULT 'NUNCA' CHECK (pedir_comensales IN ('NUNCA','SIEMPRE','PREGUNTAR')),
  pedir_identificador text NOT NULL DEFAULT 'NUNCA',
  pedido_telefonico boolean NOT NULL DEFAULT false,
  tiempo_inactividad boolean NOT NULL DEFAULT false,
  color text, imagen_url text, prioridad int NOT NULL DEFAULT 0,
  botones_ubicacion text NOT NULL DEFAULT 'VER_CONSUMO',
  created_at        timestamptz DEFAULT now()
);

-- [NUEVO] centros-de-venta.md — impresoras por tipo de documento a nivel de centro
CREATE TABLE sales_center_printer (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sales_center_id uuid NOT NULL REFERENCES sales_center(id) ON DELETE CASCADE,
  doc_tipo        text NOT NULL CHECK (doc_tipo IN ('PROFORMA','FRA_SIMP','FACTURA','ALBARAN')),
  printer_id      uuid                              -- FK printer (§11)
);

-- [EXISTE 0001 como `restaurant_table`] centros-de-venta.md → canónico location_table
--          (mesa/ubicación; reconcilia room+restaurant_table bajo sales_center)
CREATE TABLE location_table (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sales_center_id uuid NOT NULL REFERENCES sales_center(id) ON DELETE CASCADE,
  nombre          text NOT NULL,                    -- "Mesa 5"
  pos_x int, pos_y int,                             -- compat. plano simple
  estado          text NOT NULL DEFAULT 'LIBRE'
    CHECK (estado IN ('LIBRE','OCUPADA','PIDIENDO','SERVIDA','POR_COBRAR')),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Nota: en 0001 existe `room` + `restaurant_table` (room_id). Se reconcilia mapeando
-- room→sales_center. Mantener vista de compatibilidad si hay datos en restaurant_table.

-- [NUEVO] planos-mesas.md — plano de sala (lienzo) y sus elementos (★★)
CREATE TABLE floor_plan (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sales_center_id uuid NOT NULL REFERENCES sales_center(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  prioridad       int NOT NULL DEFAULT 0,
  ancho int, alto int,                              -- tamaño del lienzo (px)
  al_redimensionar text NOT NULL DEFAULT 'REDUCIR',
  fondo           text                              -- tipo de suelo
);
CREATE TABLE floor_plan_element (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  floor_plan_id     uuid NOT NULL REFERENCES floor_plan(id) ON DELETE CASCADE,
  tipo              text NOT NULL,                  -- MESA_REDONDA_4|MESA_CUADRADA|BARRA|PARED|PLANTA|PUERTA…
  x int, y int, ancho int, alto int,
  rotacion int NOT NULL DEFAULT 0, z int NOT NULL DEFAULT 0,
  location_table_id uuid REFERENCES location_table(id) ON DELETE SET NULL  -- solo si es mesa
);
```

---

## 6. Cocina (estaciones · pases · notas · motivos · monitores)

```sql
-- [EXISTE 0021 como stub `tipo_preparacion`] estaciones-y-pases.md → canónico prep_station
CREATE TABLE prep_station (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL                     -- Barra, Cocina, Tostadas
);

-- [NUEVO] estaciones-y-pases.md — orden de preparación (pase/marcha)
CREATE TABLE prep_course (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre             text NOT NULL,
  prioridad          int NOT NULL DEFAULT 0,
  marchable          boolean NOT NULL DEFAULT false,
  iniciar_al_marchar boolean NOT NULL DEFAULT false,
  iniciar_al_enviar  boolean NOT NULL DEFAULT false
);

-- [EXISTE 0021 como stub `nota_preparacion`] notas-y-motivos.md → canónico prep_note
CREATE TABLE prep_note (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  texto         text NOT NULL,
  prioridad     int NOT NULL DEFAULT 0,
  mostrar_tpv   boolean NOT NULL DEFAULT true,
  mostrar_online boolean NOT NULL DEFAULT false,
  global        boolean NOT NULL DEFAULT false,     -- todas familias/categorías
  color text, imagen_url text
);
CREATE TABLE prep_note_scope (               -- [NUEVO] ámbito de la nota si no es global
  prep_note_id uuid NOT NULL REFERENCES prep_note(id) ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  family_id    uuid REFERENCES family(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES category(id) ON DELETE CASCADE
);

-- [EXISTE 0019 como stub `cancel_reason`] notas-y-motivos.md → forma canónica
CREATE TABLE cancel_reason (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  texto          text NOT NULL,                     -- (stub: columna `nombre`)
  prioridad      int NOT NULL DEFAULT 0,
  genera_merma   boolean NOT NULL DEFAULT false,    -- descuenta stock como pérdida
  imprime_cocina boolean NOT NULL DEFAULT true
);

-- [NUEVO] monitores-cocina.md — Monitor de Cocina / KDS (config)
CREATE TABLE kitchen_monitor (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre              text NOT NULL,
  tipo                text NOT NULL DEFAULT 'RESTAURANTE_UBICACION'
    CHECK (tipo IN ('RESTAURANTE_UBICACION','FASTFOOD_PEDIDO')),
  printer_id          uuid,                          -- impresora de respaldo
  imprimir            text NOT NULL DEFAULT 'AL_COMPLETAR',
  consolidar_impresion boolean NOT NULL DEFAULT true,
  btn_iniciar boolean DEFAULT true, btn_finalizar boolean DEFAULT true,
  btn_servir boolean DEFAULT false, btn_imprimir boolean DEFAULT true,
  modo_visualizacion text NOT NULL DEFAULT 'CLASICO',
  incluir_comandas   text NOT NULL DEFAULT 'DERECHA',
  estados_principales text[], estados_secundarios text[],
  marcar_servido_auto boolean NOT NULL DEFAULT true
);
CREATE TABLE kitchen_monitor_scope (         -- [NUEVO] qué centros/estaciones/pases muestra
  monitor_id      uuid NOT NULL REFERENCES kitchen_monitor(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  sales_center_id uuid REFERENCES sales_center(id) ON DELETE CASCADE,
  prep_station_id uuid REFERENCES prep_station(id) ON DELETE CASCADE,
  prep_course_id  uuid REFERENCES prep_course(id) ON DELETE CASCADE
);
CREATE TABLE kitchen_monitor_style (         -- [NUEVO] reglas condicionales de estilo
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES kitchen_monitor(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  condicion  jsonb,   -- {espera_min:{gt:10}}
  afecta     text,
  estilo     jsonb    -- {bg:'red'}
);
```

---

## 7. Compras y stock (proveedores · almacenes · compras · recepción · movimientos · fabricación)

```sql
-- [EXISTE 0018 como stub `supplier`] proveedores.md → forma canónica
CREATE TABLE supplier (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre_fiscal       text NOT NULL,                 -- (stub: `nombre`)
  nombre_comercial    text, nif text, cuenta_contable text,
  recargo_equivalencia boolean NOT NULL DEFAULT false,
  telefono text, web text, email text,
  direccion text, poblacion text, provincia text, cp text,
  mostrar_solo_sus_productos boolean NOT NULL DEFAULT false,
  avisar_doc_duplicado boolean NOT NULL DEFAULT false,
  notas text,
  created_at          timestamptz DEFAULT now()
);
CREATE TABLE supplier_contact (              -- [NUEVO] persona de contacto del proveedor
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  nombre text, telefono text, email text,
  stock_location_id uuid,                    -- almacén que atiende
  direccion text, poblacion text, provincia text
);
CREATE TABLE supplier_product (              -- [NUEVO] precios/condiciones proveedor × producto
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  ref_proveedor text, precio numeric(12,4), unidad text,
  PRIMARY KEY (supplier_id, product_id)
);

-- [EXISTE 0018 como stub `warehouse`] almacenes.md → canónico stock_location
CREATE TABLE stock_location (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  direccion text, poblacion text, provincia text, cp text,
  serie_pedido_id   uuid REFERENCES document_series(id) ON DELETE SET NULL,
  serie_albaran_id  uuid REFERENCES document_series(id) ON DELETE SET NULL,
  serie_factura_id  uuid REFERENCES document_series(id) ON DELETE SET NULL,
  usa_fiscal_propio boolean NOT NULL DEFAULT false, nif text, nombre_fiscal text,
  coste_al_comprar  text NOT NULL DEFAULT 'PRECIO_COMPRA',
  coste_al_traspasar text NOT NULL DEFAULT 'PMP',          -- Precio Medio Ponderado
  coste_al_fabricar text NOT NULL DEFAULT 'PRECIO_FABRICACION',
  proveedor_reposicion_id uuid REFERENCES supplier(id) ON DELETE SET NULL
);

-- [EXISTE 0019 como `unit_of_measure`] unidades-medida.md → EXTIENDE + conversiones
CREATE TABLE unit_of_measure (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  abreviatura  text,                          -- (stub)
  unidad_base  text NOT NULL DEFAULT 'unidad', -- +nuevo: 'cl'|'litro'|'unidad'
  created_at   timestamptz DEFAULT now()
);
CREATE TABLE unit_conversion (               -- [NUEVO] formatos: 'BOT 70 CL'→factor
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES unit_of_measure(id) ON DELETE CASCADE,
  unidad  text NOT NULL, factor numeric(14,4) NOT NULL
);

-- [NUEVO] inventario.md — existencias por almacén × producto (PMP)
CREATE TABLE stock_item (
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  stock_location_id uuid NOT NULL REFERENCES stock_location(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  cantidad     numeric(14,3) NOT NULL DEFAULT 0,
  coste_medio  numeric(12,4) NOT NULL DEFAULT 0,   -- PMP
  stock_minimo numeric(14,3),
  PRIMARY KEY (stock_location_id, product_id)
);

-- [NUEVO] documentos-compra.md — pedido a proveedor + líneas
CREATE TABLE purchase_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  numero text, serie_id uuid REFERENCES document_series(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES supplier(id) ON DELETE SET NULL,
  stock_location_id uuid REFERENCES stock_location(id) ON DELETE SET NULL,
  doc_proveedor text, fecha date, fecha_entrega date, estado text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE purchase_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE SET NULL,
  cantidad numeric(14,3), unidad text, servida numeric(14,3) DEFAULT 0,
  precio numeric(12,4), imp numeric(6,3), dto numeric(6,3), total numeric(12,2)
);

-- [NUEVO] documentos-compra.md — albarán de entrada + líneas (mueve stock al confirmar)
CREATE TABLE goods_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  numero text, serie_id uuid REFERENCES document_series(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES supplier(id) ON DELETE SET NULL,
  stock_location_id uuid REFERENCES stock_location(id) ON DELETE SET NULL,
  doc_proveedor text, fecha date, estado text,
  purchase_invoice_id uuid,                  -- agrupación N albaranes → 1 factura
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE goods_receipt_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES goods_receipt(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE SET NULL,
  cantidad numeric(14,3), unidad text, precio numeric(12,4),
  imp numeric(6,3), dto numeric(6,3), total numeric(12,2),
  purchase_order_id uuid REFERENCES purchase_order(id) ON DELETE SET NULL
);

-- [NUEVO] documentos-compra.md — factura de proveedor (agrupa N albaranes)
CREATE TABLE purchase_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  numero text, serie_id uuid REFERENCES document_series(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES supplier(id) ON DELETE SET NULL,
  doc_proveedor text, fecha_emision date, fecha_recepcion date,
  base numeric(12,2), total numeric(12,2), pendiente numeric(12,2), estado text
);

-- [NUEVO] inventario.md — histórico de movimientos (libro mayor de stock)
CREATE TABLE stock_movement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  stock_location_id uuid NOT NULL REFERENCES stock_location(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  fecha timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('COMPRA','VENTA','AJUSTE','TRASPASO','FABRICACION','MERMA')),
  referencia text,                           -- documento origen
  cantidad numeric(14,3) NOT NULL,
  stock_resultante numeric(14,3), coste_unit numeric(12,4)
);
-- (En 0001 existe `stock_move` por ingredient_id; convive para escandallos de @gluuh/core.)

-- [NUEVO] inventario.md — variaciones (ajuste/traspaso/recuento) + líneas
CREATE TABLE stock_variation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  fecha date, tipo text CHECK (tipo IN ('AJUSTE','TRASPASO','INVENTARIO')), motivo text,
  almacen_origen_id uuid REFERENCES stock_location(id) ON DELETE SET NULL,
  almacen_destino_id uuid REFERENCES stock_location(id) ON DELETE SET NULL,
  estado_traspaso text, fecha_recepcion date
);
CREATE TABLE stock_variation_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  variation_id uuid NOT NULL REFERENCES stock_variation(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE SET NULL,
  variacion numeric(14,3), unidad text, pr_coste numeric(12,4), total numeric(12,2)
);

-- [NUEVO] inventario.md — fabricaciones (escandallo de producción) + líneas
CREATE TABLE manufacturing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  fecha date, documento text,
  stock_location_id uuid REFERENCES stock_location(id) ON DELETE SET NULL,
  notas text, total_coste numeric(12,2)
);
CREATE TABLE manufacturing_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  manufacturing_id uuid NOT NULL REFERENCES manufacturing(id) ON DELETE CASCADE,
  product_id uuid REFERENCES product(id) ON DELETE SET NULL,
  cantidad numeric(14,3), coste_unit numeric(12,4), total numeric(12,2)
);
```

---

## 8. Clientes

```sql
-- [EXISTE 0019 como `customer_type`] tipos-clientes.md → canónico customer_group
CREATE TABLE customer_group (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  descripcion   text,
  price_list_id uuid REFERENCES price_list(id) ON DELETE SET NULL   -- +nuevo: tarifa por grupo
);

-- [EXISTE 0001 `customer` y 0018 `client`] clientes.md → consolidar en customer (canónico)
CREATE TABLE customer (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre_fiscal    text NOT NULL,                  -- (0001: `nombre`)
  nombre_comercial text, pais text DEFAULT 'ES',
  tipo_documento   text CHECK (tipo_documento IN ('NIF','CIF','NIE','PASAPORTE','VAT','OTRO')),
  nif text, cuenta_contable text,
  group_id  uuid REFERENCES customer_group(id) ON DELETE SET NULL,   -- "Tipo"
  parent_id uuid REFERENCES customer(id) ON DELETE SET NULL,         -- "Subcliente de"
  tarjeta text, requiere_tarjeta boolean NOT NULL DEFAULT false,
  direccion text, poblacion text, provincia text, cp text,
  contacto text, telefono text, email text,
  enviar_publicidad boolean NOT NULL DEFAULT false,   -- RGPD (= consentimiento_marketing)
  price_list_id uuid REFERENCES price_list(id) ON DELETE SET NULL,
  descuento numeric(5,2) NOT NULL DEFAULT 0,
  recargo_equivalencia boolean NOT NULL DEFAULT false,
  observaciones text, observaciones_aviso boolean NOT NULL DEFAULT false,
  puntos_fidelidad int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customer_address (              -- [NUEVO] direcciones de entrega (delivery)
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  direccion text, poblacion text, provincia text, cp text
);
```

---

## 9. Online (carta digital · modos de pedido · pasarela · control de efectivo)

```sql
-- [NUEVO] carta-digital.md — Carta Digital / SmartMenu
CREATE TABLE digital_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, descripcion text, pie text,
  color text, color_fondo text, css text, imagen_url text, terminos text,
  moneda text NOT NULL DEFAULT 'EUR',
  price_list_1 uuid REFERENCES price_list(id) ON DELETE SET NULL,
  price_list_2 uuid REFERENCES price_list(id) ON DELETE SET NULL,
  price_list_3 uuid REFERENCES price_list(id) ON DELETE SET NULL,
  mostrar_anadidos boolean NOT NULL DEFAULT true,
  mostrar_alergenos boolean NOT NULL DEFAULT true,
  slug text UNIQUE,                          -- enlace público
  texto_pago text,
  sugerencias_category_id uuid REFERENCES category(id) ON DELETE SET NULL,
  sugerencias_texto text
);
CREATE TABLE digital_menu_category (
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  digital_menu_id uuid NOT NULL REFERENCES digital_menu(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  orden int DEFAULT 0,
  PRIMARY KEY (digital_menu_id, category_id)
);

-- [NUEVO] config-pago-pedidos.md — modo de venta (scan&pay, mesa, delivery, takeaway)
CREATE TABLE order_mode_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('SCAN_PAY','MESA','DELIVERY','TAKEAWAY')),
  device_id uuid REFERENCES device(id) ON DELETE SET NULL,
  user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES payment_method(id) ON DELETE SET NULL,
  price_list_id uuid REFERENCES price_list(id) ON DELETE SET NULL,
  customer_default_id uuid REFERENCES customer(id) ON DELETE SET NULL,
  pedir_comensales boolean, dividir_cuenta boolean,
  pago_al_finalizar boolean, pago_mas_tarde boolean, pago_al_entregar boolean,
  emitir_factura boolean, enviar_preparar boolean,
  estado_inicial text, notificaciones jsonb
);
CREATE TABLE delivery_schedule (             -- [NUEVO] horarios de servicio delivery
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES order_mode_config(id) ON DELETE CASCADE,
  nombre text, max_ped_15min int, hora_inicio time, hora_fin time, dias int[]
);
CREATE TABLE delivery_area (                 -- [NUEVO] áreas de entrega
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES order_mode_config(id) ON DELETE CASCADE,
  nombre text, coste_envio numeric(10,2), tiempo_min int, pedido_minimo numeric(10,2)
);

-- [NUEVO] pasarela-cobro-mesa.md — pasarela/datáfono y mapeos
CREATE TABLE payment_gateway_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL, puerto int, forma_pago_tarjeta text
);
CREATE TABLE gateway_terminal_map (
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES payment_gateway_config(id) ON DELETE CASCADE,
  datafono_id text NOT NULL,
  device_id uuid REFERENCES device(id) ON DELETE CASCADE
);
CREATE TABLE gateway_method_map (
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES payment_gateway_config(id) ON DELETE CASCADE,
  metodo_pasarela text NOT NULL,
  payment_method_id uuid REFERENCES payment_method(id) ON DELETE SET NULL
);

-- [NUEVO] control-efectivo.md — cajón inteligente (CashLogy, CashDro, …)
CREATE TABLE cash_control_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN
    ('CASHLOGY','CASHDRO_WS','CASHKEEPER','CASHGUARD','CASHINFINITY','CASHDRO_FICHEROS','CASHPROTECT')),
  conexion jsonb                             -- host/puerto/ruta según protocolo
);
```

---

## 10. Operativa de venta (comanda · líneas · pagos · facturación VERIFACTU)

```sql
-- [EXISTE] 0014_formas_pago.sql — formas de pago. EXTIENDE con formas-de-pago.md.
CREATE TABLE payment_method (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  tipo       text NOT NULL DEFAULT 'OTRO'
    CHECK (tipo IN ('EFECTIVO','TARJETA','BIZUM','VALE','OTRO')),
  activo     boolean DEFAULT true, orden int DEFAULT 0, prioridad int DEFAULT 0,
  -- +nuevo (formas-de-pago.md): comportamiento
  color text, imagen_url text,
  uso_venta boolean DEFAULT true, uso_compra boolean DEFAULT false,
  devolver_cambio boolean DEFAULT false, permitir_sobrepago boolean DEFAULT false,
  abrir_cajon boolean DEFAULT false, incluir_arqueo boolean DEFAULT false,
  registrar_propina boolean DEFAULT false, uso_telefonico boolean DEFAULT false,
  recaudacion_repartidor boolean DEFAULT false, obliga_cliente boolean DEFAULT false,
  tipo_cliente_id uuid REFERENCES customer_group(id) ON DELETE SET NULL,
  maximo numeric(10,2),                      -- null = sin límite
  uso_devolucion boolean DEFAULT true, imprime_vale boolean DEFAULT false,
  usa_pasarela boolean DEFAULT false,
  gateway_config_id uuid REFERENCES payment_gateway_config(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- [EXISTE] 0001_init.sql — comanda/cuenta (sales_order; tabla viva, no se reemplaza)
CREATE TABLE sales_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  table_id      uuid REFERENCES location_table(id) ON DELETE SET NULL,  -- reconciliado a location_table
  user_id       uuid REFERENCES app_user(id) ON DELETE SET NULL,
  customer_id   uuid REFERENCES customer(id) ON DELETE SET NULL,        -- +nuevo
  estado        text NOT NULL DEFAULT 'ABIERTA'
    CHECK (estado IN ('ABIERTA','ENVIADA_COCINA','SERVIDA','POR_COBRAR','COBRADA','ANULADA')),
  tipo_operacion text NOT NULL DEFAULT 'VENTA'
    CHECK (tipo_operacion IN ('VENTA','INVITACION','AUTOCONSUMO','MERMA','FORMACION')),
  motivo_no_venta text,                      -- obligatorio si tipo_operacion <> 'VENTA'
  estado_preparacion text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado_preparacion IN ('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO')),
  numero_pedido int,                         -- visible en kiosko/display ("A-37")
  canal         text NOT NULL DEFAULT 'TPV'
    CHECK (canal IN ('TPV','COMANDERA','KIOSKO','ONLINE')),
  comensales    int,
  total         numeric(12,2) NOT NULL DEFAULT 0,
  client_id     uuid NOT NULL,               -- idempotencia offline (UNIQUE por tenant)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- [EXISTE] 0001_init.sql — línea de comanda
CREATE TABLE order_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  product_id    uuid REFERENCES product(id) ON DELETE SET NULL,
  nombre        text NOT NULL,               -- copia histórica estable
  cantidad      numeric(10,3) NOT NULL DEFAULT 1,
  precio_unitario numeric(12,2) NOT NULL,    -- PVP (impuesto incluido)
  tipo_impositivo numeric(5,2) NOT NULL,
  modificadores jsonb NOT NULL DEFAULT '[]'::jsonb,
  notas         text, pase int, estacion text,
  prep_course_id uuid REFERENCES prep_course(id) ON DELETE SET NULL,    -- +nuevo
  prep_station_id uuid REFERENCES prep_station(id) ON DELETE SET NULL,  -- +nuevo
  cancel_reason_id uuid REFERENCES cancel_reason(id) ON DELETE SET NULL,-- +nuevo
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- [EXISTE] 0001_init.sql — pagos de la comanda
CREATE TABLE payment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  metodo        text NOT NULL CHECK (metodo IN ('EFECTIVO','TARJETA','BIZUM','QR','WALLET','MIXTO')),
  payment_method_id uuid REFERENCES payment_method(id) ON DELETE SET NULL,  -- +nuevo
  importe       numeric(12,2) NOT NULL,
  propina       numeric(12,2) NOT NULL DEFAULT 0,
  ref_pasarela  text,
  client_id     uuid NOT NULL,               -- idempotencia
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- [EXISTE] 0022_facturacion.sql — factura VERIFACTU (huella SHA-256 encadenada).
--          Forma actual; coexiste con la `invoice` ampliada de 0001 (destinatario).
CREATE TABLE invoice (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id       uuid REFERENCES location(id) ON DELETE SET NULL,   -- 0001
  order_id          uuid REFERENCES sales_order(id) ON DELETE SET NULL,
  serie             text NOT NULL,
  numero            int  NOT NULL,
  num_serie_factura text NOT NULL,
  fecha_expedicion  text NOT NULL,           -- dd-mm-aaaa (formato AEAT)
  nif_emisor        text NOT NULL, nombre_emisor text,
  tipo_factura      text NOT NULL DEFAULT 'F2'
    CHECK (tipo_factura IN ('F1','F2','F3','R1','R2','R3','R4','R5')),
  dest_nif text, dest_nombre text, dest_domicilio text,  -- 0001 (factura completa)
  base_total    numeric(12,2) NOT NULL,
  cuota_total   numeric(12,2) NOT NULL,
  importe_total numeric(12,2) NOT NULL,
  huella            text NOT NULL,           -- SHA-256 encadenado
  huella_anterior   text,                    -- null en el primer registro
  qr_url            text, fecha_hora_huso text,
  estado_aeat       text NOT NULL DEFAULT 'NO_ENVIADA'
    CHECK (estado_aeat IN ('NO_ENVIADA','ENVIADA','ACEPTADA','RECHAZADA','ENCOLADA')),
  csv               text,                    -- +nuevo: Código Seguro de Verificación AEAT
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, serie, numero)
);

-- [EXISTE] 0022_facturacion.sql — desglose por tipo impositivo (IVA/IGIC/IPSI)
CREATE TABLE invoice_tax_line (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  tipo       numeric(5,2) NOT NULL,          -- % aplicado
  base       numeric(12,2) NOT NULL,
  cuota      numeric(12,2) NOT NULL
);

-- [EXISTE] 0001_init.sql — arqueo de caja y movimientos (control de efectivo)
CREATE TABLE cash_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  device_id uuid REFERENCES device(id) ON DELETE SET NULL,
  abierta_por uuid REFERENCES app_user(id) ON DELETE SET NULL,
  fondo_inicial numeric(12,2) NOT NULL DEFAULT 0,
  abierta_en timestamptz NOT NULL DEFAULT now(), cerrada_en timestamptz,
  total_efectivo numeric(12,2), total_tarjeta numeric(12,2), descuadre numeric(12,2)
);
CREATE TABLE cash_move (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  cash_session_id uuid NOT NULL REFERENCES cash_session(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
  importe numeric(12,2) NOT NULL, motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

> El registro VERIFACTU vive en `invoice` (huella encadenada + estado AEAT). En 0001 existe
> además `verifactu_record` como tabla separada de remisión; ambas reflejan la misma cadena
> y deben converger (decisión canónica: campos de huella **en la factura**, estado de envío
> en `verifactu_record` o en `invoice.estado_aeat`).

---

## 11. Configuración · auditoría · i18n

```sql
-- [NUEVO] puntos-de-venta.md / transversal — configuración clave/valor por ámbito
CREATE TABLE setting (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  scope      text NOT NULL CHECK (scope IN ('GLOBAL','LOCAL','DEVICE')),
  scope_id   uuid,                            -- null si GLOBAL; location_id o device_id
  clave      text NOT NULL,                   -- p.ej. 'informe_z.detalle', 'tpv.pedir_comensales'
  valor      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, scope, scope_id, clave)
);
-- Resolución: DEVICE → LOCAL → GLOBAL (lo más específico gana).

-- [NUEVO] puntos-de-venta.md / 04 — impresoras como entidad propia
CREATE TABLE printer (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  location_id uuid REFERENCES location(id) ON DELETE CASCADE,
  nombre    text NOT NULL,                    -- PR_TICKETS, PR_COCINA, PR_TOSTADOR
  tipo      text, conexion jsonb              -- USB/red/IP
);

-- [NUEVO] configuracion-botones.md — diseño de botones del TPV
CREATE TABLE button_layout (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  nombre    text NOT NULL,
  tipo_dispositivo text NOT NULL CHECK (tipo_dispositivo IN ('TPV','COMANDERA','TABLET')),
  tamano_boton text NOT NULL DEFAULT 'MEDIANOS' CHECK (tamano_boton IN ('GRANDES','MEDIANOS','PEQUENOS')),
  config    jsonb                             -- columnas, densidad, favoritos
);

-- [NUEVO] mantenimiento.md — auditoría (NO permite borrar tickets por retención fiscal)
CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  fecha     timestamptz NOT NULL DEFAULT now(),
  user_id   uuid REFERENCES app_user(id) ON DELETE SET NULL,
  tipo      text, accion text,
  device_id uuid REFERENCES device(id) ON DELETE SET NULL,
  aplicacion text, equipo text, detalle jsonb
);

-- [NUEVO] herramientas (recursos/idiomas) — idiomas soportados por tenant
CREATE TABLE locale (
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  codigo    text NOT NULL,                    -- es, en, de, fr…
  PRIMARY KEY (tenant_id, codigo)
);

-- [NUEVO] recursos.md — traducción de literales a nivel de dato (i18n)
CREATE TABLE translation (
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  entity_type text NOT NULL,                  -- 'product','category',…
  entity_id   uuid NOT NULL,
  campo       text NOT NULL,                  -- 'nombre_carta','descripcion'…
  locale      text NOT NULL,
  texto       text NOT NULL,
  PRIMARY KEY (entity_type, entity_id, campo, locale)
);
```

---

## Diagrama ASCII de relaciones principales

```
                              ┌──────────┐
                              │  tenant  │  (RLS: id = current_tenant_id())
                              └────┬─────┘
        ┌──────────────┬──────────┼───────────────┬──────────────┐
        ▼              ▼          ▼               ▼              ▼
   ┌─────────┐   ┌──────────┐ ┌────────┐    ┌──────────┐   ┌──────────┐
   │ location│   │ app_user │ │ family │    │price_list│   │ supplier │
   └────┬────┘   └────┬─────┘ └───┬────┘    └────┬─────┘   └────┬─────┘
        │             │role_id    │ category     │              │
        ▼             ▼           ▼   ▼           │              ▼
   ┌─────────┐   ┌────────┐  ┌─────────┐          │        ┌──────────────┐
   │ device  │   │  role  │  │ product │◄─────────┘        │stock_location│
   └────┬────┘   └───┬────┘  └────┬────┘  product_price     └──────┬───────┘
        │ device_*   │role_perm   │ ├─ product_allergen ─► allergen │
        │            ▼            │ ├─ product_modifier_group        │ stock_item
   document_series  permission   │ ├─ product_barcode               │ stock_movement
        │                        │ └─ menu_choice ◄── menu_group ◄ menu
        ▼                        │                                  ▼
   ┌──────────────┐              │                         purchase_order ─┐
   │ sales_center │◄─ price_list │                         goods_receipt ──┤► stock
   └──────┬───────┘              │                         manufacturing ──┘
          │ floor_plan           │
          ▼                      ▼
   ┌──────────────┐        ┌────────────┐    ┌───────────┐
   │location_table│◄───────│ sales_order│───►│ order_line│──► prep_course/station
   └──────────────┘ table  └─────┬──────┘    └───────────┘
                                 │
                    ┌────────────┼─────────────┐
                    ▼            ▼             ▼
               ┌─────────┐  ┌─────────┐  ┌──────────────┐
               │ payment │  │ invoice │─►│invoice_tax_line│
               └─────────┘  └────┬────┘  └──────────────┘
                                 ▼ huella encadenada
                          verifactu_config / VERIFACTU (CSV, estado_aeat)

   Cocina:   prep_station · prep_course · prep_note(+scope) · cancel_reason
             kitchen_monitor (+scope, +style)
   Online:   digital_menu · order_mode_config (delivery_*) · payment_gateway_config
             cash_control_config
   Config:   setting(GLOBAL/LOCAL/DEVICE) · printer · button_layout · audit_log
             locale · translation
```

---

## Notas de RLS y seguridad

1. **Aislamiento total por tenant.** Toda tabla con `tenant_id` lleva la policy `_rw`
   `USING/WITH CHECK (tenant_id = current_tenant_id())`, con `ENABLE` + `FORCE ROW LEVEL
   SECURITY`. El rol de la app (`authenticated`) **no** tiene `BYPASSRLS`.
2. **Catálogos globales sin tenant.** `permission` (catálogo de permisos) y, opcionalmente,
   `allergen` cuando `tenant_id IS NULL` (los 14 oficiales). Estas tablas son de **solo
   lectura** para `authenticated`/`anon`; sin policy de escritura.
3. **`tax_rate`** es lectura pública (`GRANT SELECT … TO authenticated, anon`) y semilla
   compartida; debe coincidir con `@gluuh/core` (innegociable). No se edita por tenant salvo
   que se decida hacerla per-tenant (ver §2 RECONCILIA).
4. **Tablas hija sin `tenant_id` propio** (p.ej. PKs compuestas como `menu_choice`,
   `role_permission`): se recomienda **denormalizar `tenant_id`** para que la policy sea
   directa y el índice arranque por `tenant_id`. Donde no se denormalice, la policy debe
   comprobar el tenant del padre vía subconsulta (más lento).
5. **Numeración fiscal atómica.** `document_series.siguiente_num` se incrementa en una
   función `SECURITY DEFINER` del backend dentro de la misma transacción que inserta el
   `invoice`; **nunca** desde el cliente. La huella VERIFACTU se ancla a `(serie, numero)`.
6. **Retención fiscal.** `audit_log` y las facturas son **inmutables**: la utilidad de
   "eliminar tickets/movimientos" del configurador Ágora **no** se replica (incompatible con
   la cadena VERIFACTU). Borrado lógico (`deleted_at`) solo donde la ley lo permite.
7. **Secretos fuera de la BD.** El certificado mTLS de VERIFACTU se guarda como
   `certificado_ref` (referencia a un secret manager), nunca el `.p12` en claro; el envío a
   la AEAT lo realiza `apps/api`.
8. **Sync/offline.** Las tablas del flujo de venta (`sales_order`, `payment`) llevan
   `client_id` con índice único por tenant para idempotencia (PowerSync/write-path).

---

## Reconciliaciones pendientes (decisiones para la próxima migración)

**Inconsistencias ya detectadas en las migraciones** (deben resolverse al consolidar):

- **`invoice` declarada dos veces** (0001 y 0022) con esquemas distintos. Como 0022 usa
  `CREATE TABLE IF NOT EXISTS`, en una BD donde 0001 creó la tabla **las columnas VERIFACTU
  (`huella`, `num_serie_factura`, `estado_aeat`, `qr_url`) no llegan a crearse**, aunque sí
  su UNIQUE y RLS. La §10 define la forma canónica (unión de ambas); migrar con
  `ADD COLUMN IF NOT EXISTS`.
- **Doble desglose fiscal**: `tax_line` (0001, con `impuesto IVA/IGIC/IPSI`) y
  `invoice_tax_line` (0022). Canónico: `invoice_tax_line` (+ columna `impuesto` opcional).
- **Triple mecanismo de alérgenos**: `allergen`+`product_allergen` (0001), `product.alergenos
  text[]` (0016) y `alergeno` por tenant (0020). Canónico: `allergen` + `product_allergen`
  (§3); el array y la tabla stub se descartan.
- Las migraciones 0018–0021 crean **tablas stub** de configuración (`nombre`/`descripcion`)
  que aquí se amplían a su forma Ágora completa.

| Existente (migración)              | Canónico (este modelo) | Acción                                            |
|------------------------------------|------------------------|---------------------------------------------------|
| `perfil` (0020)                    | `role`                 | renombrar + añadir `role_permission`/`permission` |
| `invoice_series` (0019)            | `document_series`      | migrar datos; ampliar columnas                    |
| `tarifa` (0020)                    | `price_list`           | renombrar + `product_price`                       |
| `grupo_mayor` (0020)               | `mayor_group`          | renombrar                                         |
| `etiqueta_producto` (0020)         | `tag` + `entity_tag`   | renombrar + tabla N:N                             |
| `alergeno` (0020) + `allergen`(0001)| `allergen`            | consolidar en una                                 |
| `customer_type` (0019)             | `customer_group`       | renombrar                                         |
| `client` (0018) + `customer`(0001) | `customer`             | consolidar en una                                 |
| `warehouse` (0018)                 | `stock_location`       | renombrar + ampliar                               |
| `room`+`restaurant_table` (0001)   | `sales_center`+`location_table` | mapear room→sales_center        |
| `tipo_preparacion`/`nota_preparacion`/`cancel_reason` (0019/0021) | `prep_station`/`prep_note`/`cancel_reason` | ampliar columnas |
| `plantilla_*`, `periodo_servicio`, `punto_venta` (0020/0021) | `setting`/`printer`/entidades dedicadas | reconciliar según uso |

> Estas reconciliaciones se aplican con migraciones aditivas (`ALTER … RENAME`,
> `ADD COLUMN IF NOT EXISTS`, tablas nuevas) preservando datos; nunca `DROP` de columnas
> con datos fiscales.
