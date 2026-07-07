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

### Refinamiento 07-07-2026 (con el cliente)
4. **Login del TPV en dos pasos**: el **dispositivo** entra una vez con
   usuario+contraseña (o passkey); si se marca **«recordar»** ya no la vuelve a
   pedir y arranca **directo al TPV**. Dentro, **cada camarero se identifica con
   su PIN** (o pulsera) desde una **lista de operarios**. La sesión del
   dispositivo ≠ el operario que opera cada cuenta.
5. **Bloqueo del TPV según el tipo de negocio** — configurable *cuándo* se pide
   re-identificación (ver «Bloqueo y re-identificación» abajo). Restaurante con
   plantilla fija → camarero activo, sin re-pedir; bar de copas con mucho relevo →
   **pulsera en cada acción** (entrar/salir de mesa). «Debe ser perfecto».
6. **Caja por TPV, centralizada**: cada terminal (p. ej. restaurante + 3 barras)
   abre su **caja** por la mañana con su **fondo**; todo consolida en uno solo.
7. Alcance de hoy: **solo documentar** («hay que definirlo bien» antes de tocar
   código).

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
2. **IP/URL del servidor** — el equipo donde corre la web (p. ej.
   `http://192.168.1.10:3100`). **Todas las IP (servidor, impresoras…) son
   configurables luego en Configuración.** Ya cableado: el desktop lee
   `config.json` → `servidor` en runtime (precedencia config > `GLUUH_URL` >
   localhost), sin re-empaquetar.
3. **Directorio de copia de seguridad** — dónde guarda los backups locales (el
   backup local ya existe: `exportarBackupLocal` / `gluuh.guardarBackup`).
4. **Código tenant** (código de licencia, Capa 1) — **obligatorio: sin meterlo
   NO se puede continuar**. Liga la instalación al tenant + módulos + tiempo activo.
5. Resumen de **qué se va a instalar**.
6. Paso final: **crear el primer usuario** o **cambiar la clave de admin**
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

## Página **Seguridad** (Administración → Usuarios) · ✅ v1 creada 07-07-2026
`app/(panel)/seguridad/page.tsx`. Reúne lo que estaba disperso; hoy incluye:
- **Bloqueo del TPV** — setting `tpv.bloqueo` (**movido desde `/ajustes`**). El
  modelo objetivo (triggers + modos) está en «Bloqueo y re-identificación» abajo.
- **Clave técnica** del instalador (cambiarla) — RPC `establecer_clave_tecnica`.
- **Acceso rápido** con passkey (huella / Face ID / Windows Hello).

Pendiente en la misma página, por **perfil**: **quién entra en Configuración** y en
cada zona, **política de PIN** (longitud/caducidad/bloqueo tras N intentos) y
enganchar el **audit_log**. Enlaza con la S2 de la guía 13.

## Bloqueo y re-identificación del TPV (a definir bien)
Dos conceptos separados:
- **Sesión del dispositivo**: usuario+contraseña (o passkey) una vez; con
  «recordar» arranca directo al TPV. Es «en qué local/terminal estoy».
- **Operario activo**: quién opera la cuenta ahora; se identifica con **PIN o
  pulsera** desde la **lista de camareros**. Es el que firma cada acción (audit).

El **bloqueo** decide *cuándo* hay que volver a identificar al operario. Debe ser
configurable por **evento** (combinable) y por **preset de negocio**:

| Evento que dispara re-identificación | Restaurante (plantilla fija) | Bar de copas (mucho relevo) |
|---|---|---|
| Inactividad (tras N segundos) | opcional, largo | opcional, corto |
| Al entrar al TPV | — | sí |
| Al **cambiar de mesa** | no | **sí (pulsera)** |
| Al **abrir/entrar en una mesa** | no | **sí (pulsera)** |
| Al **cobrar** | opcional | sí |
| Al **cerrar la cuenta** | opcional | sí |

- **Preset «restaurante»**: camarero queda **activo**; no re-pide en cada mesa
  (solo inactividad larga o bloqueo manual).
- **Preset «copas/pulsera»**: **cada** entrar/salir de mesa, cambiar de mesa y
  cobrar pide pulsera — porque cambian mucho de manos.
- Guardar como `tpv.bloqueo` ampliado: `{ modo: 'restaurante'|'copas'|'custom',
  eventos: {...booleans}, inactividadSeg }`. El botón **«Bloquear» manual** existe
  siempre. **Pendiente de cerrar la lista exacta de eventos antes de implementar.**

## Apertura y cierre de caja (multi-TPV, centralizado) — falta
- Un local puede tener **varias cajas/TPV** (p. ej. restaurante + 3 barras), pero
  **consolidan en uno**. La caja se ata al **terminal** (device / punto de venta).
- **Apertura (cada mañana)**: pantalla para meter el **fondo de caja** inicial de
  ESE terminal; sin apertura no se cobra en él.
- **Cierre de día / caja Z**: cerrar cuentas abiertas + **arqueo** (totales por
  forma de pago, nº tickets, hora) por terminal; consolidado del local.
- Quién puede abrir/cerrar → por **perfil**. Hoy no existe el abrir/cerrar día.

## Log de auditoría (apuntado por el cliente)
- Tabla **`audit_log`** (quién, qué, cuándo, dónde) — ya prevista en
  `docs/referencia/07-configuracion-y-administracion/`. Registrar: cambios de
  configuración, cobros, anulaciones, aperturas de cajón, accesos. Con la Capa 2,
  el “quién” es el **operario** (no solo el usuario Supabase).

---

## Sesiones (orden propuesto)
| # | Sesión | Depende de | Notas |
|---|--------|-----------|-------|
| SA1 | **Seguridad** (zona técnica + bloqueo TPV + quién entra en config) | — | 🟡 v1 página creada (07-07); falta bloqueo por eventos + quién-entra por perfil |
| SA2 | **Operarios**: login local código+clave + **lista de camareros con PIN** + sesión de dispositivo con «recordar» + **perfiles** (accesos) + autoría | — | Reusa `app_user`/`perfil`/`validar_pin` |
| SA3 | **Activación por licencia** (instalación una vez) + **superficies por puerta** | SA2, app Electron (guía 03) | Reusa `activar_licencia` |
| SA4 | **Abrir y cerrar día** (fondo + caja Z / arqueo) **por terminal**, consolidado en el local | — | Multi-TPV (restaurante + N barras) |
| SA5 | **Config rápida** dentro del TPV | SA2 | Slide-over por perfil |
| — | **`audit_log`** transversal | SA2 | El “quién” = operario |

## Preguntas abiertas (para cuando toque implementar)
- Formato exacto del **código de operario** (¿lo genera el sistema, editable?).
- Cómo se materializan las **“dos instalaciones”** en escritorio (dos accesos
  directos al mismo binario con un flag `--modo=tpv|config`, o dos ventanas).
- Migración de los usuarios actuales (con email) al modelo código+clave sin
  perder el acceso remoto del dueño.
