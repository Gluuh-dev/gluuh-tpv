---
name: gluuh-base-datos
description: >-
  Cómo cambiar el esquema de base de datos de Gluuh TPV (Supabase multi-tenant
  con RLS) sin romper nada, y el CATÁLOGO COMPLETO de cambios de esquema
  pendientes para el plan Glop (módulos, emparejado, print_job, aparcar,
  imágenes, agotados, numeración offline, tarifas). Úsala SIEMPRE que vayas a
  crear una migración, tocar una tabla, añadir una columna o escribir una RPC
  en supabase/migrations/. Contiene las trampas conocidas (doble definición de
  invoice, customer vs client, stubs en español) y las convenciones del repo.
---

# Base de datos Gluuh — convenciones y cambios pendientes

## Reglas del repo (no negociables)

1. **Lo que se aplica son las migraciones** de `supabase/migrations/*.sql`,
   numeradas secuencialmente (`0001`…; a 08-07-2026 la última es `0082`
   —**plantilla base**: `tenant.es_plantilla` (único parcial); el tenant
   `ca44a7c7` pasa a "Plantilla base"; `admin_sembrar_ejemplo` solo crea usuarios
   base (el catálogo se clona de la plantilla, TS `clonar-plantilla.ts`).
   `0081` realtime: publica product/category/family/print_job para las
   suscripciones del TPV/Desktop. `0080` `device.ultima_conexion/version` + RPC
   `device_heartbeat` (parque "en línea"). `0079`
   —**impresión compartida**: `printer` (rol/transporte/destino/device_id),
   `print_job` (cola por la nube, estado, idempotencia por client_id),
   `print_route` (estación × zona → impresora); RLS por tenant + `set_tenant_id()`.
   `0078` **instalación por código**: `tenant.codigo_instalacion` único (4-4-5-4-4),
   `handle_new_user` SOLO provisiona con `empresa_nombre` en metadata,
   `verificar_clave_operario(p_tenant)` acotado a la empresa de la instalación,
   `admin_sembrar_ejemplo()` (usuarios admin/camareros + catálogo demo);
   `0077` login por `usr_app`; `0073`/`0074` `codigo`/`clave_hash`;
   `0071`/`0072` RLS con `operario_permite()`—, aplicadas).
   ⚠️ Pendiente 0078: el índice único `app_user_auth_user_id_unico` NO pudo
   crearse (duplicado histórico del auth de Técnico); se crea al borrar el
   tenant fantasma "Mi empresa" (limpieza pendiente de OK del usuario).
   Nueva migración = siguiente número libre + nombre descriptivo en snake_case.
   ⚠️ **`app_user.permisos` (0041) NUNCA se aplicó**: no existe en la BD. Los
   permisos viven SOLO en `perfil.permisos` (0048); el usuario los hereda por
   `app_user.perfil_id` (0070). No la uses.
2. **Toda tabla nueva lleva `tenant_id uuid not null references tenant(id) on
   delete cascade` + RLS** con `current_tenant_id()` (patrón de cualquier tabla
   de `0001_init.sql`). El trigger `set_tenant_id()` (`0004`) autorrellena el
   tenant en inserts de cliente — añadirlo a tablas que escriba el navegador.
3. **Espejo**: tras cambiar el esquema, actualizar `apps/api/db/schema.sql`
   (DDL de referencia, ver `supabase/README.md`).
4. Migraciones **aditivas e idempotentes**: `ADD COLUMN IF NOT EXISTS`,
   `CREATE TABLE IF NOT EXISTS`, nunca editar una migración ya aplicada, nunca
   `DROP` de datos sin decisión explícita del usuario.
5. Si el `%` de IVA/IGIC entra en juego: la verdad es doble — `@gluuh/core`
   (`ivaAuto`) y la tabla `tax_rate` + `resolver_iva()` **deben coincidir**
   (hay test de sincronía: `tax-rates-sql-sync.test.ts`).
6. Índices: `tenant_id` siempre como primera columna.

## Trampas conocidas (leer antes de tocar)

- **`invoice` está definida DOS veces** — ⚠️ **CONFIRMADO contra la BD real el
  02-07-2026**: la tabla tiene la forma de `0001_init.sql` (`serie`, `numero`
  existen) y las columnas de `0022_facturacion.sql` **NO existen**
  (`num_serie_factura`, `huella`, `huella_anterior`, `estado_aeat` → "column
  does not exist"). `0022` fue un no-op (`CREATE TABLE IF NOT EXISTS`) y
  `/api/factura` escribe contra columnas inexistentes. **La migración
  correctiva ALTER es obligatoria antes de cualquier trabajo fiscal**
  (guía `docs/implementacion/01-activar-verifactu.md`, paso 0).
- **`customer` (0001) vs `client` (0018)**: dos tablas de clientes. Decisión:
  quedarse con **`customer`** (tiene RGPD); no construir nada nuevo sobre `client`.
- **Stubs en español** (0018-0021: `tarifa`, `promocion`, `perfil`,
  `grupo_mayor`, `alergeno`, `etiqueta_producto`, `warehouse`, `sales_center`…):
  son cáscaras del CRUD genérico. El esquema objetivo que los reconcilia está en
  `docs/referencia/diseno/modelo-de-datos.md` — consultarlo antes de
  ampliar cualquiera de ellos.
- El mecanismo **`setting`** (0023) con precedencia DEVICE > LOCAL > GLOBAL y
  RPCs `setting_get`/`setting_set` ya existe: usar eso para configuración,
  no crear tablas de config nuevas. Helper cliente: `apps/web/app/lib/settings.ts`.

## Catálogo de cambios pendientes (por guía de docs/implementacion/)

| Cambio | DDL resumido | Guía |
|---|---|---|
| Consolidar `invoice` | `ALTER TABLE invoice ADD COLUMN IF NOT EXISTS` (todas las de 0022) + unique por serie+número | 01 |
| Módulos | `tenant_module (tenant_id, modulo, activo, config jsonb, pk(tenant_id,modulo))` | 04 |
| Emparejado | `device` + `modulo text, codigo_vinculacion text, codigo_expira timestamptz, vinculado_at timestamptz` + unique parcial sobre código | 04 |
| Impresión compartida | `print_job (id, tenant_id, device_destino, payload jsonb, estado, error, created_at)` | 03 |
| Aparcar cuenta | `sales_order ADD aparcado_como text` (aparcado = ABIERTA sin mesa con etiqueta; no tocar el enum de estados) | 05 |
| Cliente/comensales en ticket | verificar/añadir `sales_order.customer_id`, `sales_order.comensales` | 05 |
| Imagen de producto | `product ADD imagen_url text` (Storage: reutilizar bucket de branding) | 05 |
| Agotado ("86") | `product ADD agotado_hasta timestamptz` — cuelga del PRODUCTO, nunca del botón | 07 |
| Precio variable | permitir precio NULL en `product` (al vender pide precio) — revisar constraints/UI | 07 |
| Numeración offline | `number_range (tenant_id, device_id, serie, desde, hasta, siguiente)` + RPC `reservar_rango(serie, n)` | 06 |
| Backup local | RPC `export_tenant_csv(tabla)` security definer acotada al tenant del token de dispositivo | 03 |
| Tarifas reales (P1-3) | `product_price` (producto × tarifa) + programación horaria — diseño en `modelo-de-datos.md` | plan |
| Permisos finos (P2) | `role`/`permission`/`role_permission` — diseño en `modelo-de-datos.md` | plan |

Notas de diseño ya decididas:
- **Ficha Glop/Ágora (0065, Fase 3a)**: `product.family_id` = familia DIRECTA
  del producto (modelo Glop; el resolver de herencia la prefiere sobre la
  derivada de la categoría principal). `familia_padre_id`/`categoria_padre_id`
  (jerarquía), `plu` (único por tenant), `es_principal`/`es_anadido`,
  `texto_boton` y `carta_nombre`/`carta_descripcion` (carta digital).
  `category_sales_center`: SIN filas = la categoría sale en todos los centros.
- **Biblioteca de modificadores (0064, Fase 2 Glop)**: `modifier_group.product_id`
  NULL = grupo de biblioteca del tenant, con `tipo` EXTRA/COMENTARIO; la asignación
  vive en `modifier_group_asignacion` (destino XOR familia/categoría/producto,
  `modo` INCLUIR/EXCLUIR). La herencia NO se resuelve en SQL: función pura
  `gruposDeProducto()` en `apps/web/app/lib/catalogo-store.ts` (familia → categorías
  m2m → producto; en cada nivel EXCLUIR primero, INCLUIR gana). Semilla base en
  `supabase/seed-biblioteca-modificadores.sql` (TODO: cablearla al alta de empresa).
- El 4º estado de mesa ("cuenta solicitada", estilo Glop) **no necesita columna**:
  se deriva de `sales_order.estado = 'POR_COBRAR'` en el plano.
- Las pantallas vinculadas (KDS, pantalla, cartelería) no usan sesión Supabase:
  token JWT de dispositivo verificado en route handlers que hacen de proxy
  (patrón `api/admin/crear-empresa` con `SUPABASE_SECRET_KEY`).

## RPCs y funciones existentes (no reinventar)

`current_tenant_id()`, `set_tenant_id()`, `validar_pin`, `listar_operarios`,
`crear_empleado`, `crear_pedido` (kiosko; reutilizable para QR en mesa),
`crear_pedido_srv`, `resolver_iva`, `setting_get`/`setting_set`,
`es_admin_plataforma`, `custom_access_token_hook` (mete `tenant_id` y rol en el JWT).
