# Infraestructura › Servicio local del PC (nodo del local)

> El **servicio que se instala en el PC del local** y se da de alta con **usuario y contraseña**
> de la cuenta de empresa. Una vez activo es el **nodo local** del negocio: hace de **servidor LAN**
> (los terminales trabajan entre sí y siguen funcionando sin internet), de **puente de hardware**
> (habla con impresoras ESC/POS, cajón, datáfono, balanza, cajón inteligente — cosas que el
> navegador NO puede tocar) y de **print server**. Complementa
> [`README.md`](README.md), [`cuentas-y-acceso.md`](cuentas-y-acceso.md),
> [`bases-de-datos.md`](bases-de-datos.md) y, en implementación,
> [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) §4 (hardware) y §2 (sync),
> y [`../implementacion/conexion-y-roles-dispositivo.md`](../implementacion/conexion-y-roles-dispositivo.md).

---

## 1. Qué es y por qué — necesitamos un proceso nativo en el PC

**Para qué sirve.** Un TPV de hostelería tiene dos exigencias que el navegador no cubre:

1. **Hablar con hardware físico** — impresora térmica ESC/POS (RAW :9100, USB, serie, Bluetooth),
   cajón portamonedas (pulso `ESC p` por la impresora), datáfono/pasarela (socket en puerto de
   escucha), balanza (HID/serie) y cajón inteligente (Cashlogy/CashDro por web service, ficheros o
   socket). El JavaScript de un navegador **no abre puertos USB/serie de forma fiable** (WebUSB/
   WebSerial solo en Chrome, sin red, frágil y con permisos por sesión) — ver
   [`../01-arquitectura-y-plataforma/README.md` §2](../01-arquitectura-y-plataforma/) (tabla de
   plataformas) y [`../implementacion/arquitectura.md` §4](../implementacion/arquitectura.md).
2. **Ser servidor LAN fiable y permanente** — para que los terminales (TPV, comandera, KDS,
   pantalla) **se hablen entre sí y sigan operando aunque caiga la fibra** (offline-first). El
   navegador no puede ser un servidor de fondo siempre encendido; necesitamos un proceso de sistema.

Ágora resuelve esto con su **"equipo maestro"**: levanta servidores web en LAN por módulo
(KDS :8983, administración/comandas :8984) y los demás equipos entran por navegador a
`http://ip-del-servidor:puerto` (ver
[`../implementacion/conexion-y-roles-dispositivo.md`](../implementacion/conexion-y-roles-dispositivo.md)).
Nuestro **servicio local** cumple el mismo papel —puente de hardware + servidor LAN— pero **sin que
el usuario teclee IP/puerto ni abra el firewall a mano**, con autodescubrimiento y *fallback* a la
nube.

> **Diferencia clave con Ágora.** En Ágora el equipo maestro es la **verdad operativa** y si se apaga
> el local se para. En Gluuh la **verdad canónica vive en la nube (Supabase)** y cada terminal es
> offline-first por sí mismo; el servicio local es un **edge/puente** que mejora la operación
> (hardware + LAN + cache), pero **su caída no detiene el negocio** (§5, modo degradado).

### 1.1 Decisión de tecnología — recomendación

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Sidecar Rust empaquetado con Tauri** del TPV de caja | Reutiliza el núcleo Rust que ya elegimos para `apps/desktop` ([01 §2](../01-arquitectura-y-plataforma/)); USB/serie/red nativos; binario diminuto | Acoplado al ciclo de vida del TPV (si ese PC se apaga, no hay puente) | ✅ **para el TPV de caja** |
| **Servicio Windows independiente (Rust)** | Arranca con el sistema, sobrevive a logout, ligero (~10 MB), Rust = mismos drivers que el sidecar | Empaquetado/firma propios; segundo artefacto a mantener | ✅ **recomendado como nodo del local** |
| Servicio Node.js (`node-windows`/`nssm`) | Reutiliza TS/`@gluuh/core` y `packages/hardware` directamente; rápido de prototipar | Runtime más pesado en RAM; acceso serie/USB vía addons nativos menos robusto | ⚠️ MVP / fallback |
| Electron de fondo | Reutiliza web | ~150 MB, ~2 GB RAM en mini-PC barato | ❌ descartado |

**Recomendación.** Un **servicio nativo ligero como Windows Service**, con **núcleo Rust**
(comparte drivers y abstracciones con el sidecar de Tauri) y los **contratos/dominio en TS de
`packages/hardware` y `@gluuh/core`** expuestos por FFI/IPC donde convenga. Dos modos de despliegue,
mismo binario:

- **Modo embebido** — corre como *sidecar* dentro del TPV Tauri (locales pequeños: el propio TPV de
  caja es el nodo).
- **Modo servicio** — instalado como **Windows Service** independiente en un mini-PC del local
  (locales grandes o con varios TPV): arranca con el sistema, sin sesión iniciada, siempre disponible.

**Empaquetado / instalación.** Instalador Windows firmado (`.msi` vía WiX, o el bundler de Tauri),
que: (1) registra el **servicio** con **arranque automático** y reinicio ante fallo; (2) abre el
puerto LAN en el firewall de Windows automáticamente (sin que el usuario lo haga); (3) lanza el
asistente de **alta/login** (§4). Auto-update firmado (§5).

---

## 2. Roles del servicio

```
┌──────────────────────── SERVICIO LOCAL (nodo del tenant) ────────────────────────┐
│                                                                                   │
│  (1) PUENTE DE HARDWARE      (2) PRINT SERVER        (3) SERVIDOR LAN/EDGE         │
│  Printer · CashDevice ·      cola por impresora ·    cache + coherencia ·         │
│  Datafono · Balanza ·        reintentos · estado     mDNS · Socket.IO efímero     │
│  CashControl  (Rust drivers) (idempotente)           (offline-first)              │
│                                                                                   │
│  (4) CLIENTE DE SYNC → PowerSync/NestJS → Supabase (verdad canónica)              │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Puente de hardware (drivers / transportes)

Extiende `packages/hardware` (hoy define `PrintJob`/`Printer`; el resto son contratos por construir,
ver [`../implementacion/arquitectura.md` §4.1](../implementacion/arquitectura.md)). **Abstracción
común por familia con drivers por marca**, para no acoplar la app a un fabricante:

| Abstracción | Drivers / protocolo | Transporte | Origen del requisito |
|---|---|---|---|
| **`Printer`** | ESC/POS (Epson/Star/Sunmi) | red **:9100** RAW · USB · serie · BT Sunmi · ePOS · CloudPRNT | [`arquitectura.md §4.2`](../implementacion/arquitectura.md) |
| **`CashDevice`** (cajón inteligente) | Cashlogy, CashDro (WS/ficheros), CashKeeper, CashGuard | web service · ficheros · socket | [`control-efectivo.md`](../09-referencia-configurador-agora/herramientas/control-efectivo.md) |
| **`Datafono`/`PaymentGateway`** | Redsys/AgoraPay/Stripe, Tap to Pay | socket en **puerto de escucha (2244)** | [`pasarela-cobro-mesa.md`](../09-referencia-configurador-agora/herramientas/pasarela-cobro-mesa.md) |
| **`Scale`** (balanza) | balanza HID/serie | HID · serie | [`arquitectura.md §4`](../implementacion/arquitectura.md) |
| Cajón portamonedas | pulso `ESC p 0 <on> <off>` | a través de la impresora | — |
| Lector de códigos | emulación teclado / HID / cámara | USB-HID · cámara | [`app-almacen.md`](../09-referencia-configurador-agora/compras-stocks/app-almacen.md) |

El **dominio nunca habla bytes**: la web/terminal construye un `PrintJob` o un `CobroRequest`
declarativo y el servicio lo traduce al protocolo del periférico. **Modo degradado siempre**: si el
cajón inteligente cae, se sigue cobrando efectivo manual; si la balanza falla, peso manual.

### 2.2 Print server (cola, reintentos, estado)

- **Cola persistente por impresora** (SQLite del servicio) con **idempotencia por `id` de trabajo**:
  un reenvío tras corte de red no imprime dos veces.
- **Reintentos con backoff** y **estado de impresora** (online / sin papel / offline) reportado a la
  UI. Si la cocina está offline, los tickets **se acumulan y se vacían al recuperar** — sin perder
  comandas (ver [`../implementacion/arquitectura.md` §4.2](../implementacion/arquitectura.md)).
- División por **estación** (`order_line.estacion`): barra :9100, parrilla→KDS, etc. **Code page
  PC858** (acentos ES + €); el QR VERIFACTU se codifica con `construirUrlQR()` de `@gluuh/core`.
- El servicio es el **destino de los trabajos de impresión** de todos los terminales del local
  (la comandera/TPV/web envían el job; el servicio lo encola y despacha).

### 2.3 Servidor LAN / edge (opcional, recomendado en locales grandes)

- **Cache + coherencia entre terminales sin internet**: hospeda una instancia local de
  PowerSync/Postgres (o cache equivalente) + namespace de tiempo real. Así **la comanda llega del
  móvil al KDS por Ethernet aunque caiga la fibra** ([`arquitectura.md §2.2`](../implementacion/arquitectura.md)).
- **Eventos efímeros** ("nueva comanda", "mesa lista", bump) por **Socket.IO en LAN**; los **datos
  durables** siguen yendo por la capa de sync (el KDS nunca depende de la campana —
  [`arquitectura.md §2.3`](../implementacion/arquitectura.md)).
- **Autodescubrimiento por mDNS/Bonjour** (§4): los terminales lo encuentran sin teclear IP.
- **La verdad canónica sigue en Supabase**; el nodo LAN es un *edge cache* coherente que sube al
  reconectar. Es **opcional**: si no existe, los terminales van directos a la nube.

### 2.4 Cliente de sync hacia la nube

El servicio es **cliente de PowerSync** y sube las mutaciones acumuladas (suyas y, si actúa de edge,
las de los terminales) por el **write-path de NestJS** (`/sync/upload`), que **revalida RBAC, fiscal
y numeración VERIFACTU** — nada "sucio" entra en Postgres. Cola **idempotente por `client_id`** para
no cobrar/numerar dos veces tras reconexión ([`arquitectura.md §2.1`](../implementacion/arquitectura.md)).

---

## 3. Diagrama del servicio y sus conexiones

```
                         ☁ NUBE (Supabase + PowerSync + API NestJS)
                         verdad canónica · auth · mTLS→AEAT · /sync/upload
                                       ▲
                                       │ (4) cliente de sync (cuando hay red)
                                       │     + canje de credenciales → token de nodo
   ┌───────────────────────────────────┴──────────────────────────────────────────┐
   │   🖥 PC DEL LOCAL — SERVICIO GLUUH (Windows Service, arranque automático)       │
   │   ┌──────────────┬──────────────┬───────────────┬──────────────────────────┐  │
   │   │ (1) PUENTE    │ (2) PRINT    │ (3) LAN/EDGE   │  ALTA/LOGIN              │  │
   │   │  HARDWARE     │  SERVER      │  cache+mDNS    │  user+pass → token nodo  │  │
   │   │  Rust drivers │  cola/estado │  Socket.IO     │  (revocable, no guarda   │  │
   │   └──────┬───────┴──────┬───────┴───────┬────────┘   la contraseña)         │  │
   │          │ TLS LAN      │               │ mDNS (_gluuh._tcp)                  │  │
   └──────────┼──────────────┼───────────────┼──────────────────────────────────────┘
              │              │               │
   ┌──────────┼──────────────┼───────────────┼─────────────┐     periféricos
   ▼          ▼              ▼               ▼              │     ─────────────
 🖨 :9100   📥 cajón      💳 :2244         📟 balanza        │  USB · serie · BT · red
 ESC/POS    ESC p       datáfono         HID/serie         │
            🏧 cajón inteligente (Cashlogy/CashDro, WS/socket)
   ─────────────────────────────────────────────────────────
   ▲          ▲              ▲
   │ LAN (TLS, autodescubierto por mDNS — sin teclear IP)
 🖥 TPV(Tauri)  📱 Comandera(PWA/Expo)  👨‍🍳 KDS(PWA)  🪧 Pantalla(PWA)
   └─ fallback: si el servicio no responde → contra la nube ─┘
```

---

## 4. Alta / login del servicio

El flujo que pide el negocio: **instalar → meter usuario y contraseña de la empresa → quedar
operativo**, sin guardar la contraseña en el equipo.

```
INSTALAR  →  el instalador registra el servicio (arranque automático) y abre el asistente
   │
LOGIN     →  el responsable introduce USUARIO + CONTRASEÑA de la cuenta de empresa
   │          (Supabase Auth; el usuario debe tener rol para registrar nodos)
   │
CANJE     →  el servicio canjea esas credenciales por un TOKEN DE NODO
   │          · revocable desde el backoffice
   │          · NO se guarda la contraseña; solo el token (en almacén seguro del SO:
   │            Windows DPAPI / Credential Manager)
   │
REGISTRO  →  se crea/asocia el registro `node` (tenant_id + location_id), con su rol "nodo local"
   │
OPERATIVO →  arranca puente de hardware + print server + (opcional) LAN/edge; anuncia por mDNS
```

- **Token de nodo, no la contraseña.** El servicio se autentica ante la nube con un token de larga
  vida **revocable**; la contraseña solo se usa una vez para el canje y **nunca se persiste**.
  Esto refleja el modelo de [`cuentas-y-acceso.md`](cuentas-y-acceso.md) (cuenta de empresa ←
  usuarios personales ← tokens de servicio/dispositivo) y el patrón "token por dispositivo,
  revocable desde backoffice" de
  [`conexion-y-roles-dispositivo.md §6`](../implementacion/conexion-y-roles-dispositivo.md).
- **Multi-local.** El alta fija `tenant_id` + `location_id`; un mismo tenant puede tener un nodo por
  local.
- **Re-emparejar / rotación de token.** Desde el backoffice se puede **revocar** el token (equipo
  perdido/robado) y **re-emparejar** el servicio (nuevo login → nuevo token) sin reinstalar.
  Rotación periódica recomendada; revocación deja al nodo inoperante de inmediato.

---

## 5. Cómo lo encuentran los terminales

**Objetivo: cero IPs, cero puertos a mano** (la gran mejora frente al `ip:puerto` + firewall de
Ágora — [`conexion-y-roles-dispositivo.md`](../implementacion/conexion-y-roles-dispositivo.md)).

- **mDNS / Bonjour en la LAN.** El servicio anuncia un servicio `_gluuh._tcp` con su `tenant_id`/
  `location_id` y puerto TLS. Los terminales del mismo local lo **descubren solos** y se conectan;
  no hay que teclear nada.
- **Fallback a la nube.** Si no aparece ningún nodo por mDNS (o no responde), el terminal trabaja
  **directamente contra Supabase/PowerSync** — sigue siendo offline-first por su propio SQLite. El
  nodo local es una **mejora**, no un requisito.
- **Emparejamiento inicial del terminal**: por **QR del backoffice** (tenant + rol + token), como ya
  define [`conexion-y-roles-dispositivo.md §2`](../implementacion/conexion-y-roles-dispositivo.md);
  tras eso, el descubrimiento del nodo es automático.

---

## 6. Operación

- **Salud / heartbeat.** El servicio reporta a la nube `online`, versión, estado de cada periférico
  (impresora sin papel, cajón offline, datáfono no responde) y profundidad de cola. Visible en el
  backoffice (panel de nodos) junto al panel de salud de la cadena VERIFACTU
  ([`arquitectura.md §3.2`](../implementacion/arquitectura.md)).
- **Logs.** Rotación local + nivel configurable (INFO/DEBUG), con envío opcional de diagnóstico a la
  nube (equivalente al "Log" de Ágora, pero en backoffice).
- **Actualización automática.** Auto-update **firmado** (como el TPV Tauri,
  [`arquitectura.md §8`](../implementacion/arquitectura.md)); descarga, verifica firma, reinicia el
  servicio en ventana de baja actividad.
- **Modo degradado (qué pasa si algo cae).**

  | Falla | Comportamiento |
  |---|---|
  | **Cae internet** | El nodo sigue sirviendo la LAN (comanda→KDS→impresora por Ethernet); las mutaciones se encolan y suben al reconectar. Operación normal. |
  | **Cae un periférico** (cajón inteligente, balanza) | Modo manual para ese periférico; el resto sigue. Nunca bloquea el cobro. |
  | **Cae el PC del servicio** | **Recomendación: los terminales se reconectan automáticamente a la nube** (fallback §5) y siguen operando offline-first contra su SQLite. Se pierde el puente de hardware compartido **mientras** el servicio esté caído (la impresión por :9100 directa desde el TPV Tauri sigue, si ese TPV es a su vez nodo). Por eso se recomienda **embeber el servicio en el TPV de caja** en locales pequeños y un **mini-PC dedicado con reinicio automático** en grandes. |

---

## 7. Seguridad

- **TLS en la LAN.** El tráfico terminal↔servicio va cifrado (certificado del nodo, emitido en el
  alta); nada en claro por la red del local.
- **Token de nodo revocable** (§4) en almacén seguro del SO (DPAPI/Credential Manager). La
  contraseña de empresa **no se guarda**.
- **Mínimo privilegio.** El servicio corre con la cuenta de servicio justa para abrir sus puertos y
  hablar con los periféricos; no monta el panel de ajustes ni necesita admin tras la instalación.
- **Secretos protegidos.** El **certificado mTLS VERIFACTU** y las **claves de pasarela** **nunca
  tocan el cliente ni el nodo**: viven solo en `apps/api` ([`arquitectura.md §3.1/§7`](../implementacion/arquitectura.md));
  en BD solo referencias (`verifactu_config.certificado_ref`). El servicio que **necesita** un secreto
  de periférico (p. ej. credencial de la pasarela en LAN) lo guarda cifrado en el almacén seguro del
  SO, nunca en el repo (`.env*` en `.gitignore`).
- **RBAC respaldado en RLS.** El nodo es un cliente más: todo lo que sube se revalida en NestJS y se
  filtra por RLS (`current_tenant_id()`); un nodo comprometido no puede leer datos de otro tenant.

---

## 8. Tabla resumen

| Rol / aspecto | Para qué sirve | Cómo lo resolvemos | Qué necesitamos | Prioridad |
|---|---|---|---|---|
| **Servicio nativo en PC** | El navegador no abre puertos ni es servidor LAN fiable | **Windows Service** ligero, núcleo **Rust** (sidecar Tauri o servicio dedicado); instalador `.msi` firmado, arranque automático | Arrancar `packages/hardware` (hoy esqueleto) + empaquetado/firma | 🔴 alta |
| **Puente de hardware** | Impresora, cajón, datáfono, balanza, cajón inteligente | Abstracciones `Printer`/`CashDevice`/`Datafono`/`Scale` con drivers por marca; modo degradado | Drivers por familia (ESC/POS, Cashlogy/CashDro, Redsys/AgoraPay, HID) | 🔴 alta |
| **Print server** | Recibir trabajos y despachar a impresoras físicas | Cola persistente por impresora, idempotencia por `id`, reintentos/backoff, estado a UI | Cola SQLite + transporte :9100/USB/BT + PC858/QR | 🔴 alta |
| **Servidor LAN / edge** | Terminales se hablan y operan sin internet | PowerSync/Postgres local + Socket.IO efímero + mDNS; verdad canónica en nube | Edge cache coherente + namespace realtime LAN | 🟠 media (locales grandes) |
| **Cliente de sync** | Subir lo acumulado a la nube validado | Cliente PowerSync → `/sync/upload` (NestJS revalida RBAC/fiscal/numeración) | Cola idempotente por `client_id` | 🔴 alta |
| **Alta / login** | Dar de alta el nodo con la cuenta de empresa | user+pass → **canje por token de nodo revocable**; registra `node` (tenant+local); no guarda la contraseña | Endpoint de canje + tabla `node` + almacén seguro SO | 🔴 alta |
| **Descubrimiento** | Que los terminales lo encuentren sin teclear IP | **mDNS/Bonjour** `_gluuh._tcp` + **fallback nube** | Anuncio mDNS + lógica de fallback en terminales | 🟠 media |
| **Operación** | Salud, logs, update, degradado | Heartbeat + panel de nodos, logs rotados, auto-update firmado, fallback a nube si cae el PC | Telemetría + canal de update firmado | 🟠 media |
| **Seguridad** | Proteger LAN, token y secretos | TLS LAN, token revocable, mínimo privilegio, mTLS/pasarela solo en `apps/api`, RLS | Certificado de nodo + DPAPI + revocación en backoffice | 🔴 alta |

---

*Documento de auditoría · Infraestructura — Servicio local del PC. Relacionados:*
*[`README.md`](README.md) · [`cuentas-y-acceso.md`](cuentas-y-acceso.md) · [`bases-de-datos.md`](bases-de-datos.md) ·*
*[`../implementacion/arquitectura.md`](../implementacion/arquitectura.md) ·*
*[`../implementacion/conexion-y-roles-dispositivo.md`](../implementacion/conexion-y-roles-dispositivo.md) ·*
*[`../01-arquitectura-y-plataforma/`](../01-arquitectura-y-plataforma/) ·*
*[`../09-referencia-configurador-agora/herramientas/control-efectivo.md`](../09-referencia-configurador-agora/herramientas/control-efectivo.md) ·*
*[`../09-referencia-configurador-agora/herramientas/pasarela-cobro-mesa.md`](../09-referencia-configurador-agora/herramientas/pasarela-cobro-mesa.md).*
