# 04 — Módulos activables y emparejado de pantallas

**Objetivo:** interruptores de módulos por empresa (kiosko, KDS, pantalla, cartelería,
comandera…) gestionados desde el backoffice y desde el TPV, y vinculación de cualquier
pantalla/dispositivo con un código de 6 dígitos — sin email/contraseña en la tele de
la cocina. Diseño completo en `docs/auditoria_02_07_26/03-sistema-de-modulos.md`.

## Paso 1 — Registro de módulos y activación

1. `apps/web/app/lib/modulos.ts` (nuevo): constante `MODULOS` con clave, nombre,
   descripción, ruta y flag `siempre` (TPV no se puede desactivar). La lista inicial:
   `TPV, COMANDERA, COCINA, PANTALLA, VISOR, KIOSKO, CARTELERIA, RESERVAS` (los que ya
   funcionan) + `PAGOS, QR_MESA, DELIVERY, API, STOCK` como `proximamente: true`.
2. Migración `00xx_modulos.sql`:
   ```sql
   create table tenant_module (
     tenant_id uuid not null references tenant(id) on delete cascade,
     modulo    text not null,
     activo    boolean not null default true,
     config    jsonb  not null default '{}',
     primary key (tenant_id, modulo)
   );
   -- RLS por current_tenant_id(), como el resto de tablas
   ```
   Sin fila = módulo activo si es de los básicos (`RESERVAS`, `CARTELERIA`…): decidir
   el default por módulo en `MODULOS` para no tener que sembrar filas al crear tenant.
3. Helper `moduloActivo(modulo): Promise<boolean>` en `lib/modulos.ts` (lee
   `tenant_module` una vez y cachea en memoria de la sesión).
4. **Gating** en dos puntos:
   - `app/lib/nav.ts`: cada entrada de menú declara `modulo?: Modulo`; el filtro por
     rol existente añade el filtro por módulo.
   - Cada ruta de pantalla (`/kiosko`, `/cocina`, `/pantalla`, `/ofertas`,
     `/comandera`): guard al cargar → si inactivo, pantalla "Módulo no activado.
     Actívalo en Configuración → Módulos" con enlace.
5. Plan de suscripción: `PLANES: Record<Plan, Modulo[]>` en el mismo fichero. Activar
   un módulo fuera del plan del tenant → tarjeta de upgrade (solo UI; el cobro de
   planes queda fuera de esta guía).

## Paso 2 — Página Módulos

- `(panel)/modulos/page.tsx`: tarjeta por módulo (nombre, descripción, dispositivos
  vinculados, interruptor, botón Configurar → slide-over con el `config` JSONB en
  campos concretos por módulo, no un editor JSON).
- En el TPV: entrada "Módulos y pantallas" dentro del menú **Utilidades** (guía 05),
  visible para ENCARGADO/PROPIETARIO, con la misma lista en versión táctil y el botón
  "Añadir pantalla" (paso 3).

## Paso 3 — Emparejado por código

1. Migración: columnas en `device` (existe en `0001_init.sql`):
   ```sql
   alter table device
     add column if not exists modulo text,
     add column if not exists codigo_vinculacion text,
     add column if not exists codigo_expira timestamptz,
     add column if not exists vinculado_at timestamptz;
   create unique index if not exists device_codigo_uq
     on device (codigo_vinculacion) where codigo_vinculacion is not null;
   ```
2. **Generar código** (backoffice o TPV): inserta `device` con `modulo`, código
   aleatorio de 6 dígitos y `codigo_expira = now() + interval '10 minutes'`.
3. **Canjear** — route handler `apps/web/app/api/dispositivos/canjear/route.ts`
   (runtime nodejs, patrón de `api/admin/crear-empresa`):
   - Body `{ codigo }`. Busca el device con código vigente (cliente con
     `SUPABASE_SECRET_KEY`), lo marca vinculado y borra el código.
   - Devuelve `{ device_id, modulo, token }` donde `token` es un JWT firmado con
     `DEVICE_JWT_SECRET` (lib `jose`), claims `tenant_id`, `device_id`, `modulo`,
     caducidad larga (1 año) + endpoint de renovación.
4. **Página `/conectar`**: input grande de 6 dígitos (teclado táctil), llama a canjear,
   guarda la credencial en `localStorage` (el desktop la guarda en `userData`,
   guía 03) y redirige a la ruta del módulo.
5. **Consumo de datos de las pantallas vinculadas**: las vistas de solo-lectura
   (cocina, pantalla, cartelería, visor) dejan de exigir sesión Supabase y llaman a
   RPCs `security definer` que validan el token de dispositivo (pasado como header a
   route handlers propios que hacen de proxy, o RPC con el JWT verificado en Postgres
   vía `pgjwt`/clave compartida — elegir la primera: proxy en route handlers, más
   simple de razonar y sin extensiones nuevas).
6. **Gestión**: en la página Módulos, lista de dispositivos con "Desvincular" (borra
   la fila → el token deja de pasar la comprobación `device.vinculado_at not null`).

## Paso 4 — El TPV de escritorio usa el mismo flujo

Sin trabajo extra: el desktop sin `device.json` carga `/conectar` (guía 03). Un único
mecanismo de identidad para TPV, pantallas y comanderas.

## Criterios de aceptación

- [ ] Desactivar "Kiosko" en Módulos → `/kiosko` muestra "Módulo no activado" y su
      entrada desaparece del menú.
- [ ] Desde el TPV (Utilidades → Añadir pantalla) genero un código, lo tecleo en una
      tele con `/conectar` y la pantalla de cocina queda funcionando sin login.
- [ ] El código caduca a los 10 min y es de un solo uso.
- [ ] Desvincular el dispositivo desde Módulos lo expulsa (deja de recibir datos).
- [ ] Un camarero (rol CAMARERO) no ve "Módulos y pantallas" en Utilidades.
