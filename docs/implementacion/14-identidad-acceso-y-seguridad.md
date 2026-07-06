# 14 · Modelo de identidad, acceso y seguridad (análisis + plan por sesiones)

**Fecha:** 06-07-2026. Recoge el rediseño del acceso que pidió el cliente. Es un
**análisis + plan**; NO se implementa todavía (decisión: «solo documentar»).
Cierra cada sesión con criterios de aceptación y anota en `docs/sesiones/`.

## Decisiones tomadas (con el cliente, 06-07-2026)
1. El **ID de activación** de la instalación = **código de LICENCIA del tenant**
   (liga la instalación a la empresa y carga módulos + tiempo activo). Mismo
   código en todos los terminales del local.
2. **Email + contraseña** se mantiene **solo para dueño/técnico** y para el
   **acceso remoto** al backoffice (desde casa). En el terminal del local, todos
   entran con **código de operario + clave**.
3. La **superficie** (TPV / Configuración / Móvil) la decide **qué “puerta” abres**
   (qué app/acceso), no un menú; dentro, el **perfil** del operario filtra qué ve
   y hace. Cada perfil decide sus accesos (todo o varias cosas).
4. Alcance de hoy: **solo documentar**.

---

## Estado actual (lo que ya existe)
- **Login**: email+contraseña (Supabase Auth) o passkey → panel (`app/login`).
- **`app_user`**: `nombre`, `email`, `pin_hash`, `pulsera_hash`, `rol`
  (PROPIETARIO/ENCARGADO/CAMARERO/COCINA), bloqueo de PIN, `auth_user_id`. El PIN
  ya identifica al camarero dentro del TPV (`validar_pin`).
- **`perfil`** (`permisos jsonb`): tabla creada pero **vacía** — permisos finos
  son esqueleto.
- **Emparejado por código**: `/conectar` → credencial de dispositivo
  (`gluuh_device` en localStorage, JWT) para KDS/pantalla/kiosko.
- **Licencia**: `activar_licencia` + `tenant.licencia_hasta`/`licencia_modulos`.
- **Zona técnica**: `clave_tecnica` (RPC `validar_clave_tecnica`, desbloqueo 8 h en
  sessionStorage) protege la configuración, aparte de los roles.

Casi todo está; el trabajo es **recomponer**, no construir de cero.

---

## Modelo objetivo — dos capas

### Capa 1 · Activación de la instalación (una sola vez)
- Se introduce el **código de licencia del tenant** → la instalación queda
  **ligada al tenant**, con sus **módulos** y su **tiempo activo**. Se persiste
  localmente (setting ámbito DEVICE o `gluuh_device`) y la app queda **abierta**
  sin volver a pedirlo.
- Reutiliza `activar_licencia` + `tenant.licencia_*`. Al caducar, re-pide código.

### Capa 2 · Operarios (para cada acción / cambio)
- **Operarios** asociados al tenant, identificados con **código legible tipo
  «admin 45689»** (nombre + número) **+ clave/PIN**. **Sin email.**
  - `app_user` ya tiene `pin_hash`/`rol`; falta un **código de operario** legible
    (columna nueva o derivado) y que el login local sea **código+clave**, no email.
- **Perfiles** (`perfil.permisos`): cada perfil decide **a qué tiene acceso**
  (todo o varias superficies/permisos). Se **asigna un perfil a cada operario**
  (`app_user.perfil_id`). El menú (`lib/nav.ts`) y las páginas pasan a mirar el
  **perfil** (permisos finos), no solo el `rol` grueso.
- **Técnico**: perfil especial que lo ve **todo** y tiene la **zona técnica
  desbloqueada**.
- **Autoría**: cada cambio queda ligado al operario que lo hizo (→ audit_log).

### Usuarios por defecto (se crean SIEMPRE al instalar)
- Al instalar se crean **siempre** dos operarios:
  - **técnico** — clave **1212**. Lo ve **todo** + zona técnica desbloqueada.
  - **admin** — clave **1111**. Propietario/administrador.
- Son claves **por defecto, cambiables una vez dentro** de la app (y el asistente
  fuerza a cambiar la de admin en el primer arranque, ver abajo).

---

## Instalación y primer arranque (asistente de escritorio)
Al instalar la app (Electron, guía 03), antes de poder usarla:
1. **Aceptar** (condiciones / continuar) — obligatorio.
2. **Directorio de copia de seguridad** — dónde guarda los backups locales (el
   backup local ya existe: `exportarBackupLocal` / `gluuh.guardarBackup`).
3. **Código tenant** (código de licencia, Capa 1) — **obligatorio: sin meterlo
   NO se puede continuar**. Liga la instalación al tenant + módulos + tiempo activo.
4. Resumen de **qué se va a instalar**.
5. Paso final: **crear el primer usuario** o **cambiar la clave de admin**
   (no dejar 1111 por defecto).

El código tenant se puede **actualizar una vez dentro** (renovación/cambio de
licencia). Hasta aceptar y meter el código tenant, el asistente no avanza.

> Depende de la app Electron (guía 03) para el asistente real. En navegador, el
> equivalente es el flujo de alta + `activar_licencia`. La siembra de los
> operarios por defecto (técnico/admin) va en el alta de empresa
> (`api/admin/crear-empresa`) o en el primer arranque.

---

## Superficies “por puerta” (a qué entra cada uno)
- La superficie **la fija qué app/acceso abres**, no un menú interno:
  - **Escritorio (Electron)** genera ~**dos instalaciones/accesos**: **TPV** y
    **Configuración + Informes**. Abrir TPV → entra al TPV; abrir Configuración →
    entra a la configuración.
  - **App móvil** → superficie **móvil** (comandera).
- Dentro de cada superficie, el **perfil** del operario filtra qué ve/hace (un
  camarero en el TPV con sus límites; un encargado con más).
- El **due­ño/técnico** entra en remoto con **email+contraseña** al backoffice;
  en el local, con **código+clave** como el resto.

## Configuración rápida dentro del TPV (futuro — necesario)
- Un panel de **configuración rápida** EN la pantalla del TPV para cambios ágiles
  (precio, agotado “86”, texto/orden de botón, alta rápida) **sin salir** a la
  configuración detallada; y/o **cambio rápido TPV↔Configuración** en la misma app.
- **Idea de diseño:** un slide-over/cajón en el TPV con las acciones frecuentes,
  protegido por perfil (se pide operario con permiso para tocar catálogo). Los
  cambios pesados siguen en el backoffice detallado. Encaja con la guía 07
  (creación rápida desde el TPV) — ampliarla con “editar/configurar rápido”.

---

## Zona técnica → sección **Seguridad**
Mover lo disperso a una página **Seguridad** (Administración):
- **Desbloquear/bloquear la zona técnica** (hoy `clave_tecnica`): “desbloquear
  todo” o “bloquear zona técnica”, activable por nosotros.
- **Bloqueo del TPV**: cuándo se velan las pantallas y cuándo se pide clave
  (hoy en `/ajustes`, setting `tpv.bloqueo`).
- **Quién puede entrar en configuración** (y en otras zonas): por perfil.
Enlaza con la S2 de la guía 13.

## Cerrar día (TPV) — falta
- **Cierre de día** en el TPV: cerrar cuentas abiertas + **cierre de caja Z**
  (totales por forma de pago, nº tickets, hora). Hoy no existe el “cerrar día”.

## Log de auditoría (apuntado por el cliente)
- Tabla **`audit_log`** (quién, qué, cuándo, dónde) — ya prevista en
  `docs/referencia/07-configuracion-y-administracion/`. Registrar: cambios de
  configuración, cobros, anulaciones, aperturas de cajón, accesos. Con la Capa 2,
  el “quién” es el **operario** (no solo el usuario Supabase).

---

## Sesiones (orden propuesto)
| # | Sesión | Depende de | Notas |
|---|--------|-----------|-------|
| SA1 | **Seguridad** (zona técnica + bloqueo TPV + quién entra en config) | — | Aislado y seguro; empezar por aquí |
| SA2 | **Operarios**: login local código+clave + **perfiles** (accesos) + autoría | — | Reusa `app_user`/`perfil`/`validar_pin` |
| SA3 | **Activación por licencia** (instalación una vez) + **superficies por puerta** | SA2, app Electron (guía 03) | Reusa `activar_licencia` |
| SA4 | **Cerrar día** en el TPV (cuentas + caja Z) | — | |
| SA5 | **Config rápida** dentro del TPV | SA2 | Slide-over por perfil |
| — | **`audit_log`** transversal | SA2 | El “quién” = operario |

## Preguntas abiertas (para cuando toque implementar)
- Formato exacto del **código de operario** (¿lo genera el sistema, editable?).
- Cómo se materializan las **“dos instalaciones”** en escritorio (dos accesos
  directos al mismo binario con un flag `--modo=tpv|config`, o dos ventanas).
- Migración de los usuarios actuales (con email) al modelo código+clave sin
  perder el acceso remoto del dueño.
