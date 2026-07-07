# 15 — Instalación, despliegue y licencia (análisis exhaustivo)

**Fecha:** 07-07-2026 · **Estado:** análisis + plan de cambios.
**Referencia visual:** pantalla "Acerca de…" de Ágora 8.2.5 (licencia Professional
con código, "Suscripción activa", resumen de módulos con Ilimitado/nº, ID de
máquina, herramientas de impresión/diagnóstico, My Ágora enviando a la nube).
Este documento define **qué se instala en cada sitio, cómo se conecta todo,
dónde viven las copias, cómo se activa la licencia y si hace falta un servicio
central** — y cierra con la lista ordenada de cambios para conseguirlo.

Relacionados: [14-identidad-acceso-y-seguridad.md](14-identidad-acceso-y-seguridad.md)
(cuentas y permisos), [03-app-escritorio-electron.md](03-app-escritorio-electron.md)
(app PC), [04-modulos-y-emparejado.md](04-modulos-y-emparejado.md) (dispositivos),
[06-offline-powersync.md](06-offline-powersync.md) (sin internet),
`docs/referencia/infraestructura/servicio-local-pc.md` (servicio Windows, fase 2),
`docs/plan/06-decision-local-vs-cloud.md` (por qué la verdad vive en la nube).

---

## 1. Mapa de conjunto — quién habla con quién

```
                            ☁ NUBE (Supabase + web publicada)
                            BD canónica · auth · realtime · backoffice
                                 ▲                ▲
                 (internet)      │                │      (internet)
        ┌────────────────────────┤                ├──────────────────────┐
        │                        │                │                      │
  🏠 CASA DEL DUEÑO        🍽 EL LOCAL (LAN)      🏢 GLUUH (nosotros)
  app.gluuh.com            todos los equipos      admin.gluuh.com
  usuario + password       del restaurante        SOLO tu email
  (ver §8)                 (ver §4-5)             alta de empresas,
                                                  licencias, estado
```

**Principio (decisión doc 06):** la base de datos canónica vive en la NUBE.
Los equipos del local son clientes; el "equipo principal" del local añade
servicios (impresión compartida, backup, y en fase 2 cache LAN) pero **su caída
no impide vender** desde los demás. Diferencia deliberada con Ágora, donde el
equipo maestro es la verdad y si muere, el local para.

### 1.1 ¿Quién se conecta a qué IP? (la pregunta clave)

**Ningún aparato se conecta a la IP de un TPV.** No existe "la IP del TPV 1" a
la que apuntar el monitor de cocina. Todos los aparatos abren la **misma
dirección** (la web de la aplicación) y es la nube quien los une en tiempo real:

| Aparato | Se conecta a | Ejemplo |
|---|---|---|
| TPV (Gluuh Desktop) | URL del servidor (`config.json → servidor`) | `https://app.gluuh.com` |
| **Monitor de cocina** | **la MISMA URL**, ruta `/cocina` | `https://app.gluuh.com/cocina` |
| Comandera móvil | ídem, `/comandera` | — |
| Kiosko / pantalla / cartelería | ídem, su ruta | — |
| **Impresoras** | ← a ellas se conectan los equipos, por **IP fija de LAN, puerto 9100** | `192.168.1.201:9100` |

Las únicas IPs que hay que apuntar en el local son las de las **impresoras**
(Ethernet con IP fija o reserva DHCP). El monitor de cocina recibe las comandas
por realtime desde la nube, no "desde un TPV": puedes apagar los 3 TPV y el KDS
sigue recibiendo lo que manden las comanderas.

**Fase 2 (servidor local / offline):** cuando exista el nodo del local, la URL
para los aparatos de la LAN pasa a ser `http://IP-del-principal:3100`
(autodescubierta por mDNS para no teclearla) y la nube queda detrás. El esquema
no cambia — sigue sin haber conexiones TPV↔TPV; solo cambia **qué servidor
sirve la web**.

---

## 2. Alta del cliente (lo hace Gluuh, nunca el cliente)

Desde la **plataforma** (`/admin`, separada de la app del cliente — decisión
pendiente §11.2):

1. **Nueva empresa**: nombre, CIF, dirección, teléfono + **módulos contratados**
   + **duración de la licencia** (12/24/36 meses).
2. El sistema genera el **pack de entrega**:

| Credencial | Formato | Para qué | Quién la usa |
|---|---|---|---|
| **Código de instalación** | `0000-0000-00000-0000-0000` (único) | Fijar cada equipo del local a la empresa (`/instalar`) | Instalador |
| **Usuario + password del backoffice** | `barpepe` + password inicial | Entrar en `app.gluuh.com`; se cambia en el primer login | Dueño |
| **Clave técnica** | 8 caracteres | Candado de la Zona técnica del panel | Instalador |

3. La empresa nace **sembrada**: usuarios (`tecnico/1212`, `admin/1111`,
   `camarero/2222`, `camarera/3333`), perfiles recomendados, y catálogo de
   ejemplo (Bebidas/Cocina/Postres, 10 productos) para que nada arranque vacío.

> Estado: hecho (migración 0078 + `/admin` + `/instalar`). Pendiente: alta con
> usuario+password en vez de email (decisión §11.2) y separar `/admin` a su
> dominio (§11.1).

### 2.1 La instalación en el local, paso a paso (guion del instalador)

Con el pack de entrega en la mano, en **cada equipo** del local:

```
PASO 1 — Poner la app
  PC de barra    → instalar Gluuh Desktop (.exe); arranca a la URL de serie
  Cocina/kiosko  → navegador a la URL en pantalla completa (modo kiosk)
  Móvil camarero → abrir la URL → "Añadir a pantalla de inicio" (PWA)

PASO 2 — CÓDIGO DE INSTALACIÓN (una vez por equipo; lo teclea el instalador)
  /instalar → 0000-0000-00000-0000-0000 → el equipo queda FIJADO a la empresa
  ✔ Recordado PARA SIEMPRE (sobrevive reinicios y cierres)
  ✘ Solo se cambia metiendo OTRO código válido — es decir, solo el técnico

PASO 3 — IDENTIDAD DEL DISPOSITIVO (una vez por pantalla)
  Backoffice → Dispositivos → Nuevo: nombre tpv_1 / tpv_2 / tpv_3 /
  cocina_1 / kiosko_1…, módulo (TPV·KDS·COMANDERA·PANTALLA…) y su
  estación/barra → sale un CÓDIGO DE 6 DÍGITOS (un solo uso, 10 min):
  el "password de arranque" del dispositivo.
  En el aparato: /conectar → teclearlo → guarda su credencial y salta
  a su pantalla.
  ✔ SIEMPRE conectado desde entonces (credencial de dispositivo persistente;
    no caduca en uso, no se vuelve a pedir)
  ✔ Robo/pérdida → se revoca desde el panel, sin tocar el aparato
  ↻ ¿Formateo o borraron datos del navegador? Botón «Reconectar» en
    Dispositivos → nuevo código para EL MISMO tpv_1 (conserva nombre,
    estación e impresoras)

PASO 4 — LOGIN DE OPERARIO (lo único del día a día)
  Primera vez: tecnico / 1212 (probar todo) → luego cada camarero su clave.
  La sesión del EQUIPO queda recordada; el cambio de camarero dentro del
  TPV es por PIN rápido, sin cerrar la sesión del aparato. El TPV nunca
  amanece deslogueado.
```

**Por qué el dispositivo NO lleva "usuario `tpv_1` + password fija"**: una
password fija por aparato acaba en un post-it pegado al monitor y no se puede
revocar sin cambiarla en todos. El **código de un solo uso** hace exactamente lo
mismo (arrancar el aparato una vez) y deja el control en el panel: revocar y
reconectar sin tocar contraseñas. El **nombre** sí es `tpv_1`, `tpv_2`,
`cocina_1`… — autonumerado por tipo (GAP #14).

---

## 3. Qué se instala en cada sitio

| Sitio | Qué se instala | Cómo se activa | Qué hace |
|---|---|---|---|
| **PC principal** (barra 1 / mostrador) | **Gluuh Desktop** (Electron) | Código de instalación → emparejado como dispositivo TPV | TPV + **cola de impresión local** (persistente, reintenta cada 15 s) + cajón + **copia de seguridad diaria** a carpeta/USB + visor cliente opcional |
| **PC/tablet de cada barra extra** | Gluuh Desktop (o navegador en modo kiosk) | Ídem (cada equipo se empareja con su nombre: "Barra 2"…) | TPV con su impresora |
| **Cocina** | Nada que instalar: **pantalla KDS** = navegador/mini-PC/tablet apuntando a `/cocina` | Código de vinculación de 6 dígitos (Dispositivos → genera código → la pantalla lo canjea en `/conectar`) | Monitor de comandas en tiempo real |
| **Móviles de camareros** | Nada: PWA `/comandera` (Expo nativo, fase posterior) | Código de 6 dígitos por dispositivo | Tomar comandas en mesa; imprime SIEMPRE vía cola compartida (§6), nunca en local |
| **Pantalla de recogida / cartelería / kiosko** | Navegador en la tele/kiosko | Código de 6 dígitos (módulo PANTALLA/CARTELERIA/KIOSKO) | Según módulo |
| **Impresoras** | Ninguna app: ESC/POS por **red (IP fija, puerto 9100)** recomendado; USB solo en el equipo que la tiene enchufada | Se declaran en el backoffice (§6) | Tickets, comandas, etiquetas |
| **Casa del dueño** | Nada: `app.gluuh.com` | Su usuario+password | Backoffice completo (§8) |
| **Gluuh** | Nada: `admin.gluuh.com` | Tu email (+passkey) | Altas, licencias, estado |

**Requisitos de red del local**: todos los equipos e impresoras en la misma LAN;
impresoras Ethernet con **IP fija** (o reserva DHCP); internet para la nube
(4G de respaldo recomendado hasta que llegue el offline real, guía 06).

---

## 4. Caso completo: restaurante con 3 barras + cocina

```
                         ☁ NUBE (BD + realtime)
                          ▲       ▲       ▲
                          │       │       │            (todo por internet)
   ┌──────────────────────┼───────┼───────┼──────────────────────────┐
   │ LAN del restaurante  │       │       │                          │
   │                      │       │       │                          │
   │  BARRA 1 (principal) │  BARRA 2      │  BARRA 3                 │
   │  🖥 Gluuh Desktop ────┘  🖥 Desktop ───┘  🖥 Desktop ─────────────┘
   │   ├─ 🖨 Impresora B1      ├─ 🖨 Impresora B2  ├─ 🖨 Impresora B3  │
   │   ├─ 💶 cajón             └─ (cada TPV       └─ (ídem)           │
   │   ├─ 💾 backup diario         imprime su                        │
   │   │    a USB/carpeta          ticket en SU                      │
   │   └─ (futuro §6) despacha     impresora)                        │
   │        print_job de red                                         │
   │                                                                 │
   │  COCINA                                                         │
   │   📺 KDS (/cocina, navegador) ── ve TODAS las comandas          │
   │   🖨 Impresora cocina (Ethernet :9100) ← comandas de LOS 3 TPV  │
   │      y de las comanderas móviles (vía cola compartida §6)       │
   │                                                                 │
   │  📱 Comanderas (móvil camarero × N) — PWA emparejada            │
   └─────────────────────────────────────────────────────────────────┘
```

Flujos clave:

- **Cobro en barra 2** → ticket en la impresora de barra 2 (config local del
  equipo). El cajón que se abre es el de barra 2.
- **Comanda con platos** (desde cualquier TPV o móvil) → aparece en el KDS al
  instante (realtime, ya funciona) **y** se imprime en la impresora de cocina
  (hoy solo si el equipo que la envía tiene esa impresora configurada; con la
  cola compartida §6, desde cualquier terminal).
- **Se apaga el PC de barra 1** → barras 2 y 3 siguen vendiendo (hablan con la
  nube); se pierde su impresora y el backup hasta que vuelva. Nada más.

---

## 5. Emparejado de dispositivos (cómo se conecta cada pantalla)

Ya implementado (guía 04): en el backoffice, **Dispositivos → Nuevo** (nombre,
módulo: TPV/KDS/COMANDERA/PANTALLA…, estación si aplica) → genera **código de
6 dígitos (10 min, un solo uso)** → en el aparato se abre `/conectar` y se
teclea → el dispositivo recibe su credencial (token de dispositivo, 365 días,
revocable borrando el device) y salta a su pantalla.

- El código de instalación (§2) fija el equipo a la EMPRESA (login usuario+clave);
  el código de 6 dígitos identifica CADA PANTALLA (nombre, módulo, estación).
- Revocar un aparato robado/perdido: borrar el dispositivo en el backoffice.

**Mejora pendiente (§11.6):** columna "en línea/última vez" (heartbeat) y
versión de la app, para ver la salud del parque desde el backoffice — como la
lista de dispositivos (8) de la pantalla de Ágora.

---

## 6. Impresión distribuida (el cambio técnico más importante)

**Hoy**: cada Gluuh Desktop tiene UNA impresora en su `config.json` y una cola
local persistente con reintentos (un ticket nunca se pierde; si la impresora
está apagada reintenta cada 15 s y avisa con toast). Los navegadores puros caen
a `window.print()`.

**Limitación**: un móvil no imprime; barra 2 no puede mandar a la impresora de
cocina si no la tiene configurada ella; no hay visión central de "qué impresoras
hay y cómo están".

**Objetivo (modelo Ágora mejorado)** — cola de impresión COMPARTIDA por la nube:

1. Tabla **`printer`** (tenant, nombre, rol: TICKETS/COCINA/BARRA/ETIQUETAS,
   transporte: RED ip:puerto | USB device_id, activa) — se declaran en el
   backoffice una vez.
2. Tabla **`print_job`** (tenant, printer_id, payload ESC/POS declarativo,
   estado ENCOLADO/IMPRESO/ERROR, origen device_id, idempotencia por id) — ya
   prevista en el catálogo de la skill de BD.
3. **Despacho**: cada Gluuh Desktop se suscribe (realtime) a los jobs de SUS
   impresoras (las USB enchufadas a él y las de RED que tenga asignadas — por
   defecto, el equipo principal despacha todas las de red). Reutiliza la cola
   local existente (persistencia + reintentos) tal cual.
4. **Regla de oro**: móviles y pantallas NUNCA imprimen directo; siempre
   insertan `print_job`. Los TPV pueden atajar a su impresora local (latencia
   cero) y usar `print_job` para el resto.

Con esto: cualquier terminal imprime en cualquier impresora, con cola, estado
y reintentos visibles. (Las "Herramientas de impresión" de Ágora — test de
tickets/etiquetas, cambiar impresora — se convierten en una sección de la Zona
técnica: probar impresora, ver cola, reimprimir último.)

### 6.1 Enrutado multi-barra: qué destino recibe cada línea (y con su mesa)

La comandera **no elige impresora**: el camarero marca la **mesa** y envía.
Cada **línea** de la comanda lleva su **estación** (heredada del producto o su
categoría: COCINA/BARRA/…) y la comanda entera lleva **mesa + zona del plano +
camarero + hora + notas**. El enrutado decide el destino con una regla
configurable **estación × zona → impresora** (tabla `print_route`, GAP #13):

| Estación de la línea | Zona de la mesa | Sale por |
|---|---|---|
| COCINA | (cualquiera) | **KDS cocina** (pantalla) + impresora cocina |
| BARRA | Terraza → asignada a barra 1 | Impresora **barra 1** |
| BARRA | Salón → asignada a barra 2 | Impresora **barra 2** |
| BARRA | Reservado → asignada a barra 3 | Impresora **barra 3** |
| (sin regla de zona) | — | Impresora por defecto de la estación |

- La relación **zona → barra** se configura una vez en el backoffice (al crear
  las zonas del plano se elige qué barra las sirve). Una mesa de la Terraza
  pide 2 cañas y una hamburguesa → las cañas salen impresas en barra 1, la
  hamburguesa en el KDS + impresora de cocina, y **ambas comandas llevan
  "Mesa T4 · Terraza · Marta · 21:32"**.
- ¿Forzar destino puntual (una ronda que prepara otra barra)? Selector
  "enviar a…" opcional en el TPV — la excepción, no la norma.
- **Varias pantallas**: puede haber un KDS por estación (cocina_1, barra_1…);
  cada monitor se empareja con su estación y filtra solo lo suyo (ya soportado
  por `device.estacion`, guía 10).
- Los 4 tipos de ticket (cliente/pedido/camarero/cocinero) y su contenido
  exacto están en la guía 10.

---

## 7. Copias de seguridad (dónde, cuándo, qué)

| Copia | Dónde | Cuándo | Qué | Estado |
|---|---|---|---|---|
| **Nube (canónica)** | Supabase (backups automáticos del proveedor + PITR según plan) | Continua | Toda la BD | ✅ de serie |
| **Local del negocio** | Carpeta o USB del **PC principal** (`config.json → backup.destino`) | **Diaria a la hora configurada** (`backup.hora`, p. ej. 04:00) | CSV de todas las tablas del tenant + imágenes; **retención: últimas 30 copias** | ✅ implementado en Gluuh Desktop |

Decisiones:
- La copia local es **argumento de venta** (se incluye, no se cobra — doc 06):
  "aunque nos dejes, tus datos están en tu USB cada noche".
- El backup local corre en **un** equipo (el principal), no en los tres.
- **Mejoras (§11.5)**: registrar en BD la última copia OK (fecha, tamaño,
  destino) y mostrarla en el backoffice (Copias de seguridad) y en la barra de
  estado del panel; avisar si lleva >48 h sin copia; botón "copiar ahora".

---

## 8. Personal y gestión remota (desde el local o desde casa)

**Crear un camarero** — dos caminos, mismos datos (todo va a la nube):
- **En el local**: backoffice → Empleados → Nuevo (nombre, usuario, clave,
  perfil) — o alta rápida desde el propio TPV.
- **Desde casa**: el dueño entra en `app.gluuh.com` con su usuario y hace lo
  mismo. No hay "sincronizar": es la misma base de datos.

**El dueño desde el sofá** puede: ver ventas del día en vivo, cambiar precios
y carta, poner un producto agotado, crear empleados y perfiles, ver la caja.
**Cómo se refleja en el local**: el KDS y las ventas son realtime ya; el
catálogo del TPV se refresca al recargar o reabrir la pantalla.
**Mejora (§11.7)**: refresco automático del catálogo del TPV (suscripción
realtime a product/category o refetch al recuperar foco) para que el "agotado"
puesto desde casa aparezca en segundos sin tocar nada.

---

## 9. Licencia y pantalla "Acerca de" (lo que copiamos de Ágora)

La pantalla de Ágora que usamos de referencia muestra: *"Licenciado a X"*,
versión, licencia con código y **"Suscripción activa"**, **resumen de módulos**
(Ilimitado / nº), **ID de máquina**, herramientas de impresión y diagnóstico,
y el módulo de nube. Nuestro equivalente, página **"Acerca de / Licencia"**
(en el panel: Ayuda → Acerca de; accesible también desde el TPV):

```
┌──────────────────────────────────────────────────────────┐
│                        Gluuh TPV                          │
│        Licenciado a {tenant.nombre} — CIF {cif}           │
│                 Versión {app} · {canal}                   │
│                                                           │
│  LICENCIA                        MÓDULOS                  │
│  Código: 0000-0000-00000-0000-…  TPV          incluido    │
│  ● Suscripción activa            Cocina (KDS) ✓           │
│    caduca el 07-07-2027          Kiosko       ✓ (licencia)│
│    (aviso ámbar <30 días,        Pagos        ✗ no        │
│     rojo caducada)               …            contratado  │
│                                                           │
│  ESTE EQUIPO                                              │
│  Dispositivo: Barra 1 (TPV) · ID {device_id}              │
│  Impresora: EPSON TM-T20 (RED 192.168.1.201:9100) · OK    │
│  Última copia local: hoy 04:00 → E:\backups (✓)           │
│                                                           │
│  [Probar impresora] [Ver registro] [Condiciones]          │
│  [Declaración responsable VERIFACTU]                      │
└──────────────────────────────────────────────────────────┘
```

Ya existe en BD todo lo necesario: `tenant.codigo_instalacion`,
`licencia_hasta`, `licencia_modulos`, catálogo `MODULOS`, `device`. Falta SOLO
la página (§11.3) y los avisos de caducidad (banner en el panel cuando falten
<30 días; el TPV avisa pero **no se bloquea en caliente** — el corte por
impago es una decisión comercial manual desde la plataforma).

**Renovación**: desde la plataforma (tu `/admin`) se amplía `licencia_hasta` y
módulos; el cliente lo ve reflejado en Acerca de. (El canje de códigos
`GLUH-XXXX` en `/modulos` queda como vía alternativa.)

---

## 10. ¿Hace falta levantar un servicio central en el local?

**Respuesta corta: hoy NO — y es una ventaja, no una carencia.**

| | Ágora (equipo maestro) | Gluuh (hoy) | Gluuh (fase 2) |
|---|---|---|---|
| ¿Dónde está la BD del negocio? | En el PC maestro del local | En la nube | En la nube + réplica local (PowerSync) |
| ¿Los TPV dependen de un equipo central? | **Sí** — si muere, el local para | **No** — cada uno habla con la nube | No — el nodo es mejora, no requisito |
| ¿Qué hace el "equipo principal"? | Todo (BD, licencia, servidores :8983/:8984) | Impresión local + cajón + backup diario | + despachador `print_job` + cache LAN + puente hardware, como **Servicio Windows** con arranque automático |
| ¿Sin internet? | Vende en LAN | ❌ no vende (limitación honesta actual) | ✅ vende offline y vuelca al volver (guía 06) |

El papel de "servicio central" lo cumple gradualmente el **PC principal con
Gluuh Desktop**: ya hace cola de impresión y backup; con §6 despachará la
impresión de todo el local. El **Servicio Windows dedicado** (instalador MSI,
arranque con el sistema sin sesión, auto-update firmado, mDNS) está diseñado en
`docs/referencia/infraestructura/servicio-local-pc.md` y se aborda cuando haya
clientes reales instalados — no antes, porque la app desktop cubre el papel.

**La dependencia crítica real es internet** → la respuesta correcta no es una
BD central en el PC (modelo con fecha de caducidad por VERIFACTU 2027), sino
el **offline-first de la guía 06** (réplica SQLite por dispositivo). Esa es la
pieza gorda que decide "funciona sin fibra", y conviene calendarizarla.

---

## 11. GAP — cambios a ejecutar, en orden

| # | Cambio | Qué resuelve | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | **Separar la plataforma** — `admin.gluuh.com` (middleware por Host; la app del cliente responde 404 a /admin) | El cliente no ve NI la ruta de tu zona | 0,5 d | P0 |
| 2 | **Alta con usuario+password** (sin email del cliente) + cambio obligatorio en primer login | Modelo de cuentas acordado: solo Gluuh tiene email | 1 d | P0 |
| 3 | **Página "Acerca de / Licencia"** (§9) + aviso de caducidad | Paridad con Ágora; el cliente ve qué tiene contratado y cuándo caduca | 0,5-1 d | P0 |
| 4 | **`printer` + `print_job` + despacho desde Desktop** (§6) | Imprimir desde cualquier terminal (móviles incluidos) en cualquier impresora | 2-4 d | P0 |
| 5 | **Multi-impresora por equipo** en Desktop (hoy 1 por config) | Barra con impresora de tickets + etiquetas | 1 d | P1 |
| 6 | **Heartbeat de dispositivos** (en línea/última vez, versión) + panel | Ver la salud del parque desde backoffice/plataforma | 1-2 d | P1 |
| 7 | **Backup visible**: última copia en BD + estado en panel + "copiar ahora" | Confianza: "la copia de anoche está hecha" | 0,5 d | P1 |
| 8 | **Refresco automático del catálogo del TPV** (realtime/focus) | Cambios desde casa aparecen sin recargar | 0,5-1 d | P1 |
| 9 | **Auto-update de Gluuh Desktop** (electron-updater) | Parque actualizado sin visitas | 1-2 d | P1 |
| 10 | **Límites por módulo** (`licencia_limites` jsonb: nº dispositivos, como el "8" de Ágora) | Vender por tamaño de local | 1 d | P2 |
| 11 | **Offline real (PowerSync, guía 06)** | Vender sin internet | 2-3 sem | P1★ decidir fecha |
| 12 | **Servicio Windows dedicado** (doc infraestructura) | Nodo del local robusto (arranque automático sin sesión) | 1-2 sem | P2 (con clientes reales) |
| 13 | **Enrutado por zona** (`print_route`: estación × zona → impresora + zona→barra en el plano) | Multi-barra: cada sala imprime en SU barra, con la mesa en la comanda | 1-2 d | P0 (junto al 4) |
| 14 | **Dispositivos: autonombre `tpv_N`/`cocina_N` + botón «Reconectar»** (nuevo código, misma identidad) | Instalar y reinstalar sin fricción, sin passwords fijas por aparato | 0,5 d | P1 |
| 15 | **Sesión de equipo persistente** (instalación+dispositivo+sesión recordadas; cambio de camarero por PIN sin desloguear el aparato) | El TPV nunca amanece desconectado | 0,5 d | P1 |

## 12. Decisiones pendientes (bloquean los cambios 1-2)

1. **Separación de plataforma**: ¿opción A (mismo código, dominio + middleware)
   o B (app aparte en el monorepo)? → Recomendación: **A ya**, B cuando la
   plataforma crezca.
2. **Usuario del cliente**: ¿lo eliges tú en el alta (campo libre) o se genera
   del nombre (`Bar Pepe` → `barpepe`)? → Recomendación: **se genera + editable**.
3. **Backoffice del cliente**: ¿solo en la nube (`app.gluuh.com`) y la app
   instalada solo operativa (TPV/cocina/comandera)? → Es lo que dice CLAUDE.md
   y el modelo de este doc; **confirmar** porque condiciona el instalador.

---

*Criterios de aceptación del bloque P0: (a) `/admin` inaccesible desde la app
del cliente aunque conozca la ruta; (b) alta de empresa entrega el pack completo
y el cliente entra con usuario+password que cambia; (c) "Acerca de" muestra
empresa, código, módulos y caducidad reales; (d) una comanda enviada desde un
móvil emparejado sale por la impresora de cocina con la cola compartida;
(e) una mesa de una zona asignada a barra 2 imprime sus bebidas en la impresora
de barra 2 con "Mesa · Zona · Camarero · Hora"; (f) tras reiniciar cualquier
equipo, arranca en su pantalla sin pedir nada (instalación, dispositivo y
sesión recordados).*
