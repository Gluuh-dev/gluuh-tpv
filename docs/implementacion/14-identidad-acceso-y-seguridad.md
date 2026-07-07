# 14 · Seguridad, identidad y acceso del TPV

Documento **maestro** de seguridad: la **Parte A** describe **cómo funciona HOY**
(verificado contra el código el 07-07-2026); la **Parte B** son las **decisiones y
el plan de mejoras**. Decisión vigente: lo avanzado de identidad/acceso se
**documenta** antes de implementar; lo que ya está hecho se describe tal cual.

---

# Parte A · Cómo funciona hoy

## A.0 · Dos planos de acceso (no confundir)
1. **Backoffice (panel)** — **Supabase Auth**: email+contraseña o **passkey** →
   sesión del navegador. Es «en qué empresa/usuario estoy». El dueño entra así
   también **en remoto** desde casa.
2. **TPV (operativa)** — sobre esa sesión de dispositivo, cada **operario** se
   identifica con **PIN** o **pulsera**. Es «quién opera esta cuenta ahora».

Los dos conviven: el dispositivo abre el TPV una vez (y con «recordar» no vuelve a
pedir la contraseña); **dentro, el operario rota** por PIN/pulsera sin cerrar la app.

## A.1 · Usuarios / operarios — tabla `app_user`
Columnas relevantes (`0001_init` + ampliaciones):
- **`nombre`**, **`email`** — el email es para el login de backoffice (Supabase);
  el operario del TPV se identifica por **nombre + PIN**, no por email.
- **`rol`** — CHECK de 5 valores: `ADMIN_PLATAFORMA`, `PROPIETARIO`, `ENCARGADO`,
  `CAMARERO`, `COCINA`. En el alta la UI solo ofrece ENCARGADO/CAMARERO/COCINA;
  `PROPIETARIO` lo pone el trigger al crear la empresa.
- **`pin_hash`** (bcrypt) y **`pulsera_hash`** (bcrypt, RFID/NFC).
- **`permisos` jsonb** — 5 flags de acción (`0041`), ver A.2.
- **`pin_intentos` + `pin_bloqueado_hasta`** (`0054`) — anti-fuerza-bruta **por
  tenant** (5 fallos → bloqueo creciente). Es a nivel de tenant a propósito: un
  PIN erróneo no identifica a quién lo tecleó.
- `activo`, `auth_user_id`. (`password_hash` existe pero es **vestigial**.)
- **No existe** columna de código de operario legible ni **`perfil_id`**.

Gestión: página **`/empleados`** («Usuarios y PIN»): alta (`crear_empleado`),
editar nombre/email/rol/activo/permisos, cambiar PIN (`cambiar_pin`), asignar/quitar
pulsera (`asignar_pulsera`), y desbloquear intentos.

## A.2 · Permisos de operario — los 5 flags
`app_user.permisos` (jsonb, `0041`); mismas claves que `perfil.permisos` (`0048`):

| clave | qué permite |
|---|---|
| `modificar` | Modificar la cuenta (cantidades, precio, notas) |
| `descuento` | Aplicar descuentos |
| `borrar` | Borrar / anular cuenta |
| `invitar` | Invitaciones y consumo propio |
| `cobrar` | Cobrar |

Se aplican **solo en el TPV**: `puede(k)` gatea esos botones/acciones. Sin el flag,
el TPV bloquea esa acción a ese operario. (En el panel **no** intervienen.)

## A.3 · Perfiles — tabla `perfil`
- `perfil` (`0020`) + `permisos` jsonb (`0048`): CRUD real en **`/perfiles`**
  (nombre, descripción y los 5 flags de A.2).
- **Uso hoy = plantilla**: en `/empleados`, «Aplicar perfil…» **copia**
  `perfil.permisos` dentro de `app_user.permisos` (una sola vez).
- **Límite**: no hay `app_user.perfil_id`, así que el perfil **no queda vinculado**
  al empleado (si luego cambias el perfil, los empleados ya «aplicados» no se
  actualizan). `perfil.permisos` **no se lee en runtime**; el TPV solo mira
  `app_user.permisos`.

## A.4 · En el TPV: identificación, velo y atribución (implementado)
- **Identificación**: sin operario → **rejilla de operarios** (`listar_operarios`)
  → **teclado PIN** → `validar_pin`. **Pulsera**: listener de ráfaga de teclado →
  `validar_pulsera`. El operario se guarda en `localStorage` (sobrevive recargas
  hasta «Salir»).
- **Velo / bloqueo**: overlay sobre el TPV que **conserva la cuenta viva debajo**;
  se quita re-identificándose (PIN/pulsera) **sin resetear la comanda**. Botón
  «Bloquear» manual siempre disponible. Se dispara según el **setting
  `tpv.bloqueo`** `{alCobrar, inactividad, segundos}`: auto-velo por inactividad
  y/o al cerrar cada cuenta. **Se edita en `/seguridad` y el TPV lo lee y aplica**
  (cableado de punta a punta).
- **Atribución**: cada línea y el pedido se sellan con el operario (`user_id`,
  `0059`); marca visual de iniciales cuando hay más de un camarero en la cuenta.

## A.5 · En el panel: gating por rol
- El menú (`lib/nav.ts`) y el layout filtran por **rol** (4 valores) + on/off de
  **módulos** (licencia), con `puede(rol, roles)`.
- **Los perfiles/permisos NO afectan al panel** — solo a botones del TPV. «Quién
  entra en Configuración por perfil» está **pendiente** (B).

## A.6 · Zona técnica (candado del instalador)
- `tenant.clave_tecnica_hash` (`0045`) + RPCs `validar_clave_tecnica` /
  `establecer_clave_tecnica`. El componente `ZonaTecnica` pide la clave; el
  desbloqueo vive en `sessionStorage` **8 h**. Es un **candado blando** («no toques
  esto»), no seguridad dura. Si el hash es NULL, el candado está **abierto**.
- Envuelve: `configuracion-verifactu`, `configuracion-de-impresion`,
  `copias-de-seguridad`, `modulos`. La clave inicial la genera el instalador al
  crear la empresa (se muestra una vez); se cambia desde `/seguridad`.

## A.7 · Licencia / activación
- `activar_licencia` (`0052`) canjea un código → extiende `tenant.licencia_hasta` y
  une `licencia_modulos`. Gatea los **módulos premium** (`lib/modulos.ts`).
  `licencia_hasta = NULL` → sin gating (compatibilidad con empresas existentes).

## A.8 · Página `/seguridad` (creada 07-07-2026)
Reúne hoy: **bloqueo del TPV** (`tpv.bloqueo`), **clave técnica** (cambiarla) y
**passkey**. Marcado «Próximamente» (por perfil): quién entra en Configuración,
**política de PIN** y **registro de accesos** (audit_log).

---

# Parte B · Decisiones y plan de mejoras

## B.0 · Decisiones tomadas (con el cliente)
**06-07-2026**
1. El **ID de activación** de la instalación = **código de LICENCIA del tenant**
   (liga la instalación a la empresa y carga módulos + tiempo activo). Mismo código
   en todos los terminales del local.
2. **Email + contraseña** se mantiene **solo para dueño/técnico** y para el **acceso
   remoto** al backoffice. En el terminal del local, todos entran con **operario +
   clave**.
3. La **superficie** (TPV / Configuración / Móvil) la decide **qué «puerta» abres**,
   no un menú; dentro, el **perfil** del operario filtra qué ve y hace.

**Refinamiento 07-07-2026**
4. **Login del TPV en dos pasos**: el **dispositivo** entra una vez con
   usuario+contraseña (o passkey); con **«recordar»** arranca **directo al TPV**.
   Dentro, **cada camarero se identifica con su PIN** (o pulsera) desde la **lista
   de operarios**. Sesión del dispositivo ≠ operario activo.
5. **Bloqueo del TPV según el tipo de negocio** — configurable *cuándo* se
   re-identifica (ver B.3). Restaurante con plantilla fija → camarero activo, sin
   re-pedir; bar de copas con mucho relevo → **pulsera en cada acción**.
6. **Caja por TPV, centralizada**: cada terminal (restaurante + N barras) abre su
   **caja** por la mañana con su **fondo**; todo consolida en uno solo.
7. Alcance de hoy: **documentar** («hay que definirlo bien» antes de tocar código).

## B.1 · Modelo objetivo — dos capas
**Capa 1 · Activación (una vez)**: introducir el **código de licencia del tenant**
→ instalación ligada al tenant con módulos y tiempo activo; se persiste local
(setting DEVICE / `gluuh_device`) y no se vuelve a pedir. Reusa `activar_licencia`.

**Capa 2 · Operarios (cada acción)**:
- Operarios con **código legible tipo «admin 45689»** (nombre + número) **+ clave**,
  **sin email**. Falta añadir el **código de operario** legible y que el login local
  sea código+clave (hoy es nombre+PIN).
- **Perfiles vinculados**: añadir **`app_user.perfil_id`** y que el runtime lea el
  perfil (o resuelva `permisos` desde el perfil), en vez de copiar una vez. El menú
  del panel pasa a mirar el **perfil**, no solo el rol.
- **Técnico**: perfil que lo ve **todo** + zona técnica desbloqueada.
- **Autoría**: cada cambio ligado al operario (→ audit_log, B.5).

**Usuarios por defecto (se crean SIEMPRE al instalar)**: **técnico** (clave 1212, ve
todo + zona técnica) y **admin** (clave 1111, propietario). Claves por defecto,
cambiables una vez dentro; el asistente fuerza cambiar la de admin en el primer arranque.

## B.2 · Instalación y primer arranque (asistente de escritorio)
Antes de poder usar la app (Electron, guía 03): 1) **Aceptar**; 2) **IP/URL del
servidor** (ya cableado: el desktop lee `config.json`→`servidor`); 3) **directorio de
backup**; 4) **código tenant** (licencia) — **obligatorio, sin él no continúa**; 5)
resumen de instalación; 6) **crear primer usuario / cambiar clave de admin**. El
código tenant se puede actualizar una vez dentro.

## B.3 · Bloqueo y re-identificación del TPV (a definir bien)
Dos conceptos: **sesión de dispositivo** (usuario+contraseña/passkey con «recordar»)
vs **operario activo** (PIN/pulsera, firma cada acción). El **bloqueo** decide
*cuándo* re-identificar. Configurable por **evento** (combinable) y **preset**:

| Evento que dispara re-identificación | Restaurante (plantilla fija) | Bar de copas (mucho relevo) |
|---|---|---|
| Inactividad (tras N segundos) | opcional, largo | opcional, corto |
| Al entrar al TPV | — | sí |
| Al **cambiar de mesa** | no | **sí (pulsera)** |
| Al **abrir/entrar en una mesa** | no | **sí (pulsera)** |
| Al **cobrar** | opcional | sí |
| Al **cerrar la cuenta** | opcional | sí |

- **Preset «restaurante»**: camarero **activo**, no re-pide en cada mesa.
- **Preset «copas/pulsera»**: cada entrar/salir de mesa, cambiar de mesa y cobrar
  pide pulsera.
- Guardar `tpv.bloqueo` ampliado: `{ modo:'restaurante'|'copas'|'custom',
  eventos:{...}, inactividadSeg }`. Hoy `tpv.bloqueo` ya soporta `alCobrar` +
  `inactividad` + `segundos`; falta ampliar a los eventos de mesa. **Cerrar la
  lista exacta de eventos antes de implementar.**

## B.4 · Apertura y cierre de caja (multi-TPV, centralizado) — falta
- Un local puede tener **varias cajas/TPV** (restaurante + 3 barras) que
  **consolidan en uno**. La caja se ata al **terminal** (device / punto de venta).
- **Apertura (cada mañana)**: pantalla para el **fondo de caja** de ESE terminal;
  sin apertura no se cobra en él.
- **Cierre de día / caja Z**: cerrar cuentas + **arqueo** (totales por forma de
  pago, nº tickets, hora) por terminal; consolidado del local.
- Quién abre/cierra → por **perfil**. Hoy no existe el abrir/cerrar día.

## B.5 · Log de auditoría — falta
- **`audit_log` NO existe** como tabla; la página `/auditoria` es un **sucedáneo de
  solo lectura** sobre `sales_order` (operaciones no-VENTA o anuladas).
- Objetivo: tabla `audit_log` (quién, qué, cuándo, dónde) registrando cambios de
  config, cobros, anulaciones, aperturas de cajón y accesos. Con la Capa 2, el
  «quién» es el **operario**.

## B.6 · Sesiones (orden propuesto)
| # | Sesión | Depende de | Estado / notas |
|---|--------|-----------|-------|
| SA1 | **Seguridad** (zona técnica + bloqueo TPV + quién entra en config) | — | 🟡 página `/seguridad` v1 (07-07); falta bloqueo por eventos (B.3) y quién-entra por perfil |
| SA2 | **Operarios**: login local código+clave + lista de camareros con PIN + sesión de dispositivo «recordar» + **perfil_id** + gating de panel por perfil + autoría | — | Reusa `app_user`/`perfil`/`validar_pin`; falta `perfil_id` y código legible |
| SA3 | **Activación por licencia** + **superficies por puerta** | SA2, Electron (guía 03) | Reusa `activar_licencia` |
| SA4 | **Abrir y cerrar día** (fondo + caja Z) **por terminal**, consolidado | — | Multi-TPV (restaurante + N barras) |
| SA5 | **Config rápida** dentro del TPV (slide-over por perfil) | SA2 | Sin salir a la config detallada |
| — | **`audit_log`** transversal | SA2 | El «quién» = operario |

## B.7 · Huecos (planificado en docs, NO en código)
1. **`audit_log`** (tabla + escrituras). Hoy solo el sucedáneo `/auditoria`.
2. **Código de operario legible + login código+clave** (hoy nombre+PIN).
3. **`app_user.perfil_id` + gating de panel por perfil** (hoy perfil = copia puntual;
   panel solo por rol de 4 valores).
4. **Bloqueo por eventos de mesa** (hoy solo `alCobrar`/`inactividad`).
5. **Abrir/cerrar día y caja por terminal**.

## B.8 · Preguntas abiertas
- Formato exacto del **código de operario** (¿lo genera el sistema, editable?).
- Cómo se materializan las **«dos instalaciones»** en escritorio (¿un binario con
  `--modo=tpv|config`, o dos ventanas?).
- Migración de los usuarios actuales (con email) al modelo código+clave sin perder
  el acceso remoto del dueño.
- ¿`perfil_id` **reemplaza** a `app_user.permisos` o el perfil solo **rellena** unos
  permisos que luego se pueden ajustar por empleado?
