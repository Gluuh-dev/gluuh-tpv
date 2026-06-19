# Administración › Usuarios y Perfiles (RBAC)

> **Empleados** (camareros, encargados, admin) y sus **perfiles** (roles con permisos granulares). Es la base de seguridad y de la separación "la app del local solo opera, la web configura": cada usuario tiene **claves distintas por superficie** (TPV / Comandera / Administración). Mapea de lleno a la **matriz de permisos** de [07 — Configuración](../../07-configuracion-y-administracion/) y a la RLS de Supabase.

Capturas: `Listado de Usuarios` + `Editar Usuario`; `Perfiles de Usuario` (listado) + `Editar Perfil de Usuario`.

---

## A. Usuarios (empleados)

### Listado
Columnas **Id · Nombre · Perfil · Prioridad** (32 registros). Ej.: `admin`/Administrador, `TERE`/Camarero pro, `JOSE`/Encargado+, `ajcabrera`/Informes, `JUANMA`/Camarero+…

### Editar Usuario — secciones
**Datos**
| Campo | Demo | Nota |
|-------|------|------|
| Nombre | `admin` | |
| **Clave TPV** | `35621` | PIN para la superficie TPV |
| **Clave Comandera** | `35621` | PIN para la comandera |
| **Clave Administración** | `35621` | PIN/clave para el backoffice web |
| Tarjeta / Tarjeta 2 | | Acceso por tarjeta (NFC/banda) |
| **Acceso con huella digital** | (botón) | Biometría |
| **Perfil** | `Administrador` | FK al rol (§B) |
| Idioma | `<Por defecto>` | |

> **Clave por superficie** (TPV / Comandera / Administración) confirma nuestra separación de [01 §1.1 — patrón Ágora](../../01-arquitectura-y-plataforma/): un camarero puede tener PIN de TPV pero **no** de Administración. En Gluuh: PIN rápido en operativa + sesión Supabase Auth en backoffice.

**Estilo** (botón del usuario en la pantalla de selección)
- Texto · **Color** (`#ffffff`) · **Imagen**/avatar · ☑ **Mostrar en la pantalla de venta** · **Prioridad** (orden, `0`).

**Delivery**
- ☐ Utilizar usuario como **repartidor** · ☐ Usar plataforma externa.

**Dirección · Contacto · Datos Fiscales**
- Dirección/Población/Provincia/CP · Teléfono/Email · **Nº Seguridad Social · NIF** (datos de empleado/laboral).

**Grupos de Puntos de Venta** (colapsable)
- En qué grupos de terminales puede operar el usuario (liga con [`puntos-de-venta.md`](puntos-de-venta.md)).

---

## B. Perfiles de Usuario (roles + permisos)

### Listado de perfiles (8)
| Id | Nombre |
|----|--------|
| 1 | Administrador |
| 2 | Encargado |
| 3 | Camarero |
| 4 | Encargado+ |
| 5 | Camarero+ |
| 6 | Admon |
| 7 | Informes |
| 9 | Camarero pro |

### Editar Perfil — matriz de permisos
Nombre del perfil + tabla **Aplicación · Permiso** (se añaden/quitan permisos al perfil; con filtro de búsqueda). Permisos vistos (perfil `Camarero`, aplicación **Punto de Venta**):

- **Acción personalizada: Ejecutar AgoraPay**
- **Acción personalizada: Ejecutar Cobrar en Efectivo**
- Albarán: Añadir pagos · Crear · Enviar por email · Facturar · Imprimir · Reabrir · Ver pendientes
- Cliente: Ver últimas ventas
- Factura: Buscar
- *(…lista larga, scrollable)*

> Estructura clave: **permiso = (Aplicación, Acción)**. La "Aplicación" agrupa por superficie (Punto de Venta, Administración, Informes…) y la "Acción" es granular (crear/imprimir/facturar/reabrir/anular…). Incluye **acciones personalizadas** (ejecutar una pasarela concreta). Esto es exactamente la granularidad que pide nuestra matriz de [07].

---

## Mapeo a nuestro modelo

```sql
create table role (                      -- "Perfil de Usuario"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null
);
create table permission (                -- catálogo de permisos
  id text primary key,                   -- p.ej. 'pos.albaran.facturar'
  aplicacion text not null,              -- 'Punto de Venta' | 'Administración' | 'Informes'
  accion text not null
);
create table role_permission (
  role_id uuid references role(id),
  permission_id text references permission(id),
  primary key (role_id, permission_id)
);
create table app_user (                  -- "Usuario"/empleado
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nombre text not null,
  role_id uuid references role(id),
  pin_tpv text, pin_comandera text,      -- PIN por superficie (hash)
  auth_user_id uuid,                     -- enlace a Supabase Auth (backoffice)
  tarjeta text, huella boolean default false,
  -- estilo botón
  color text, avatar_url text, mostrar_en_venta boolean default true, prioridad int default 0,
  -- delivery
  es_repartidor boolean default false,
  -- laboral
  nss text, nif text, telefono text, email text,
  direccion text, poblacion text, provincia text, cp text
);
create table user_device_group (         -- en qué grupos de TPV opera
  user_id uuid references app_user(id),
  device_group_id uuid
);
```

- **Doble autenticación por capa:** PIN rápido (hash) para operativa offline en el dispositivo + **Supabase Auth** para el backoffice web; los permisos (`role_permission`) se aplican en cliente (UI) **y** se respaldan en **RLS/policies** del backend (nunca confiar solo en el cliente). Ver [07] y [12 — Seguridad y RGPD](../../../12-seguridad-y-rgpd.md).
- 🔴 falta como configurador (tenemos empleados en operativa, no la matriz de permisos).

## Mejoras sobre Ágora

- **Perfiles predefinidos** listos (Administrador/Encargado/Camarero/Informes) que el cliente puede clonar y ajustar — no empezar de cero.
- Permisos sensibles (anular, descuento, abrir cajón, reabrir factura) **siempre** respaldados por RLS, no solo ocultos en la UI.
- **PIN por superficie** + opción de exigir Auth fuerte (2FA) para el perfil de Administración en remoto.
- Auditoría: registrar quién ejecutó acciones permisadas críticas (enlaza con `audit_log` de [07]).
