# 01 — Arquitectura y plataforma: ¿App web, PWA instalable o app nativa/escritorio?

> Decisión de plataforma para un TPV táctil multi‑dispositivo. **Veredicto: no hay una sola plataforma; hay un binomio.** PWA instalable (Next.js, `apps/web`) para todo lo que vive en navegador o tablet — backoffice, TPV de navegador, comandera ligera, KDS y pantalla de cliente — y **Tauri 2.0** para el TPV de mostrador con periféricos serios (impresora ESC/POS, cajón, datáfono). Expo (`apps/mobile`) para la comandera nativa cuando se exija Bluetooth/NFC robusto. Todo sobre una base **offline‑first** común con PowerSync (`packages/sync`) y SQLite local; PostgreSQL/Supabase como fuente de verdad canónica. Complementa **[04 — Arquitectura técnica](../../04-arquitectura-tecnica.md)**, **[05 — Stack tecnológico](../../05-stack-tecnologico.md)** y **[06 — Base de datos y sincronización](../../06-base-de-datos-y-sincronizacion.md)**; el hardware en detalle, en **[09 — Hardware](../../09-hardware.md)** y **[10 — Comanderas, KDS e impresión](../../10-comanderas-kds-e-impresion.md)**.

---

## 1. El problema, sin rodeos

Un TPV de hostelería **no es una web**. Es un dispositivo de misión crítica que tiene que:

1. **No caerse en hora punta** aunque se vaya la fibra, el router o el WiFi del local.
2. **Hablar con hardware físico**: impresora térmica ESC/POS, cajón portamonedas, datáfono, lector de códigos/balanzas.
3. **Funcionar en pantalla completa**, sin barras de navegador, sin que un camarero abra YouTube «sin querer».
4. **Instalarse y actualizarse** sin que un técnico vaya local por local con un pendrive.
5. **Cumplir VERIFACTU/IGIC** con numeración y huella encadenada — escritura controlada, nunca «sucia» (ver **[07 — Facturación y cumplimiento legal](../../07-facturacion-y-cumplimiento-legal.md)**).

La pregunta «¿web, PWA o nativo?» se responde **por rol de dispositivo**, no en abstracto. Pero antes hay que mirar los costes reales de cada opción.

### 1.1 Los dos modos de uso (el binomio que pide el negocio)

Antes de hablar de tecnología, el cliente lo ve así de simple — y la arquitectura lo respeta:

| | **A) Gestión remota — «desde casa»** | **B) Operativa en el local — «a pantalla completa»** |
|---|---|---|
| **Qué es** | El **backoffice web**: el dueño/encargado entra desde el navegador del móvil, portátil o el ordenador de casa | El **TPV/comandera/KDS**: la app que el personal usa en barra y cocina, a pantalla completa |
| **Para qué** | Ver ventas e informes, cambiar la carta y precios, alta de productos/modificadores, proveedores, empleados, ajustes | Tomar comandas, cobrar, imprimir, cocina — rápido y sin distracciones |
| **Dónde** | En cualquier sitio, por internet | En el local, en la tablet/mini‑PC del puesto |
| **Conexión** | Siempre online (es consulta/configuración) | **Offline‑first**: sigue funcionando sin internet (ver §4) |
| **Cómo se entrega** | URL web / PWA — nada que instalar | **Instalada en modo kiosco** a pantalla completa (ver §6) |
| **Misma base de código** | `apps/web` → `app/(panel)` | `apps/web` → `app/tpv`, `app/comandera`, `app/kds`… (+ Tauri donde haya hardware de caja) |

> **Clave:** lo que cambias «desde casa» (un precio, un alérgeno, un modificador) **aparece solo** en los TPV del local en cuanto haya red — misma base de datos (PostgreSQL/Supabase), misma lógica (`@gluuh/core`). No hay que tocar nada dispositivo a dispositivo. El detalle de **qué** se configura en remoto está en **[07 — Configuración y administración](../07-configuracion-y-administracion/)**.

#### El patrón Ágora: la app del local **solo opera**, no se configura

Como en Ágora, la app que se abre en el mostrador es una **app de operación pura**: enseña únicamente lo que el camarero/cajero necesita en hora punta —**carta, mesas, comanda, cobrar, abrir caja, imprimir**— y **nada más**. No tiene menús de ajustes, ni alta de productos, ni precios, ni proveedores. Todo eso se hace **desde la web** (modo A) y baja sincronizado.

Por qué esta separación es la correcta, no solo estética:

- **Velocidad y cero errores.** Menos botones en pantalla = comanda más rápida y un camarero no rompe la configuración «sin querer».
- **Seguridad por rol.** Cambiar un precio o anular requiere permisos que el camarero no tiene; la configuración ni siquiera aparece en su terminal (ver matriz de permisos en **[07](../07-configuracion-y-administracion/)**).
- **Un sitio para configurar, muchos para operar.** Defines la carta una vez en la web y la usan todos los TPV de todos los locales. No hay «configuración local» que se desincronice.

En términos de este repo: la **app de operación** son las rutas `app/tpv`, `app/comandera`, `app/kds`, `app/pantalla` de `apps/web` (envueltas en Tauri/kiosco en el local); la **web de configuración** es `app/(panel)`. Comparten código y base de datos, pero **son superficies separadas con permisos distintos** — el terminal del local no monta el panel de ajustes. Mapa de referencia de Ágora en **[../18-mapa-agora-completo.md](../../18-mapa-agora-completo.md)**.

Todo lo que sigue es el **cómo** de ese binomio: por qué el local va a pantalla completa y offline (§3–§6) y cómo encaja el acceso remoto multi‑local (§7).

---

## 2. Comparativa razonada de plataformas

Cinco candidatos reales: **Web pura**, **PWA instalable**, **Electron**, **Tauri 2.0** y **nativo (React Native/Expo)**.

| Criterio | Web pura | PWA instalable | Electron | **Tauri 2.0** | Nativo (Expo) |
|---|---|---|---|---|---|
| **Coste / reutilización código** | Mínimo (ya está) | Mínimo (es la web + manifest) | Medio (empaqueta Chromium) | Bajo‑medio (UI React + core Rust) | Alto (segunda base de UI) |
| **Offline real** | ❌ Limitado (Cache API + IndexedDB, frágil) | ⚠️ Bueno con SW + IndexedDB/OPFS | ✅ Total (SQLite nativo) | ✅ **Total (SQLite nativo)** | ✅ Total (SQLite nativo) |
| **Impresora ESC/POS** | ❌ No (sin acceso a puerto/USB fiable) | ⚠️ Solo WebUSB/WebSerial (Chrome, frágil, sin red) | ✅ Driver Node/raw socket | ✅ **Driver Rust (USB/serial/red)** | ⚠️ Bluetooth SDK nativo |
| **Cajón portamonedas** | ❌ | ⚠️ Vía impresora (ESC `p`) si hay acceso | ✅ | ✅ **(pulso por impresora)** | ⚠️ Vía impresora BT |
| **Datáfono integrado** | ❌ | ❌ (salvo cloud/QR) | ✅ SDK | ✅ **SDK vía sidecar/Rust** | ✅ SDK nativo / Bluetooth |
| **Lector códigos / balanza** | ⚠️ Solo emulación teclado | ⚠️ WebHID/WebSerial | ✅ | ✅ | ✅ (cámara/HID) |
| **Instalación** | URL | «Añadir a inicio» / `beforeinstallprompt` | Instalador `.exe`/`.msi` | Instalador `.msi`/`.dmg` (ligero) | Tienda / APK / TestFlight |
| **Actualización** | Instantánea (deploy) | Instantánea (SW + deploy) | Auto‑update (servidor propio) | **Auto‑update firmado** | Tienda (lenta) / EAS OTA |
| **Rendimiento táctil** | Bueno | Bueno | Bueno (pesado en RAM) | **Muy bueno (WebView nativo, ligero)** | **Excelente (nativo)** |
| **Tamaño binario** | 0 | 0 | ~120–200 MB | **~5–15 MB** | ~30–60 MB |
| **Kiosco / pantalla completa** | ⚠️ Depende del navegador | ✅ `display: standalone`/`fullscreen` | ✅ `kiosk: true` | ✅ **`fullscreen`/`decorations:false`** | ✅ (lock task / guided access) |
| **Tienda de apps** | N/A | Opcional (PWABuilder → stores) | N/A (distrib. directa) | N/A (distrib. directa) | ✅ App Store / Play |
| **Footprint en mini‑PC barato** | Ligero | Ligero | **Pesado (2 GB RAM mínimo)** | **Ligero (corre en 2–4 GB)** | N/A (no es Windows) |

### Lectura de la tabla

- **Web pura queda descartada como TPV de mostrador**: sin offline robusto ni hardware, no es un TPV, es un panel de consulta. Sirve para backoffice y poco más.
- **Electron funciona, pero es la opción cara en recursos**: empaqueta un Chromium completo (~150 MB, ~2 GB RAM), justo lo que sobra en un mini‑PC de TPV de gama baja. Si ya escribimos React, **Tauri da lo mismo con una fracción del peso**.
- **Tauri 2.0 es el ganador para escritorio**: reutiliza la UI de `apps/web` (React 19), pero el núcleo es **Rust**, con acceso directo a USB/serial/red para periféricos, binario de ~10 MB y auto‑update firmado. Es exactamente lo que ya anticipa **[04 — Arquitectura técnica](../../04-arquitectura-tecnica.md)** (`apps/desktop`).
- **Nativo (Expo) solo donde aporta**: la comandera de camarero en movimiento, con impresora Bluetooth, NFC o cámara como lector. Pagar una segunda base de UI solo se justifica ahí.

---

## 3. Recomendación por rol de dispositivo

Un TPV moderno de hostelería es **multi‑dispositivo**. La plataforma se elige por rol:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ROLES Y PLATAFORMA RECOMENDADA                     │
├────────────────────┬───────────────────────┬─────────────────────────┤
│ ROL                │ HARDWARE              │ PLATAFORMA               │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ 🖥️ TPV mostrador   │ Impresora ESC/POS,    │ ✅ TAURI 2.0 (Win/mini-PC)│
│   (caja)           │ cajón, datáfono       │   offline · SQLite local │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ 📱 Comandera       │ Impresora BT opcional,│ ✅ PWA tablet (estándar) │
│   (camarero)       │ ligera, en movimiento │   o Expo (BT/NFC serio)  │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ 👨‍🍳 KDS cocina      │ Solo pantalla         │ ✅ PWA kiosco (tablet/   │
│                    │ (sin periféricos)     │   mini-PC) · realtime    │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ 🪧 Pantalla cliente│ Solo pantalla         │ ✅ PWA kiosco (display)  │
│   (CDS)            │ (segundo monitor)     │   read-only realtime     │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ 🛒 Kiosko autoped. │ Impresora ticket,     │ ✅ PWA kiosco o Tauri si │
│                    │ a veces datáfono      │   imprime/cobra          │
├────────────────────┼───────────────────────┼─────────────────────────┤
│ ⚙️ Backoffice      │ Ninguno               │ ✅ Web / PWA (Next.js)   │
└────────────────────┴───────────────────────┴─────────────────────────┘
```

**Justificación:**

- **TPV de mostrador → Tauri.** Es el único rol donde el hardware local (impresora por USB/serie, cajón, datáfono) es innegociable y debe funcionar sin red. La PWA con WebUSB/WebSerial es demasiado frágil y dependiente de Chrome para confiarle la caja. Reutiliza el 95 % de la UI de `apps/web`.
- **Comandera → PWA por defecto, Expo si hace falta.** El 80 % de los locales imprimen en cocina por red (la comanda va a la impresora del KDS, no a una BT en el bolsillo). Para ese caso, una **PWA instalada en tablet Android en modo kiosco** es suficiente, más barata de mantener y comparte código con la web. Solo si el cliente exige impresora Bluetooth de mano, NFC para pagos o robustez nativa, se sube a **Expo** (`apps/mobile`, ver **[10](../../10-comanderas-kds-e-impresion.md)**).
- **KDS y pantalla de cliente → PWA en kiosco.** No tocan hardware; necesitan pantalla completa, realtime (Socket.IO / Supabase Realtime) y que nadie las saque del modo kiosco. Una PWA en una tablet o mini‑PC barato cumple sobrado.
- **Kiosko de autopedido → PWA o Tauri** según si imprime ticket/cobra: si solo manda el pedido al KDS, PWA; si imprime y cobra, Tauri.
- **Backoffice → Web/PWA pura.** Sin periféricos, multi‑dispositivo, siempre online: el caso natural de Next.js.

> **Regla de oro:** una sola base de código React (`apps/web`) sirve backoffice + TPV navegador + KDS + CDS + comandera PWA. **Tauri y Expo solo envuelven esa UI** y añaden la capa nativa donde el hardware lo exige. Cero duplicación de la lógica de negocio o fiscal (vive en `@gluuh/core`).

---

## 4. Arquitectura offline‑first (innegociable)

En hostelería, **caerse en hora punta = perder dinero y clientes**. Un servicio de 200 comandas un sábado no puede depender de que el WiFi aguante. Por eso la fuente de verdad **operativa** de cada dispositivo es su **SQLite local**, no la nube.

```
        ┌──────────────────── DISPOSITIVO (offline-first) ───────────────────┐
        │                                                                    │
        │   UI React  ──lee/escribe──►  SQLite local  ◄──sync──►  PowerSync  │
        │   (instantáneo, sin red)      (verdad operativa)         (cliente) │
        │                                     │                              │
        └─────────────────────────────────────┼──────────────────────────────┘
                                              │  (cuando hay red)
                  cola de escritura ──────────┤  reintentos con backoff
                                              ▼
        ┌──────────────────── NUBE (verdad canónica) ───────────────────────┐
        │   PowerSync Service ──► API NestJS (write path) ──► PostgreSQL/    │
        │   (buckets por tenant)   valida RBAC · fiscal · numeración legal   │
        │                                                       Supabase     │
        └────────────────────────────────────────────────────────────────────┘
```

### Por qué este diseño

1. **La UI nunca espera a la red.** Leer y escribir es local (SQLite); la latencia percibida es cero. Esto es lo que diferencia un TPV usable de una web lenta.
2. **PowerSync sincroniza en ambos sentidos** por *buckets* segmentados por `tenant_id` (y `location_id`), como detalla **[06](../../06-base-de-datos-y-sincronizacion.md)**. Cada dispositivo solo descarga sus datos.
3. **El camino de escritura pasa por el backend.** Toda mutación sincronizada se valida en NestJS (`apps/api`): autorización por tenant, lógica fiscal y **numeración legal VERIFACTU**. Nada «sucio» entra en Postgres — principio ya fijado en **[04](../../04-arquitectura-tecnica.md)**.
4. **Cola de escritura con reintentos.** Si no hay red, las mutaciones se acumulan en SQLite y se reenvían con *backoff* exponencial al recuperarse. El usuario sigue cobrando y emitiendo tickets.

### Servidor LAN local (opcional, recomendado en locales grandes)

Para un restaurante con muchos dispositivos y conexión inestable, un **mini‑servidor en la LAN** (un mini‑PC o el propio TPV de mostrador) puede hospedar una instancia de PowerSync/Postgres local que sincroniza con la nube cuando hay internet. Así, **aunque caiga la fibra del local, los dispositivos siguen sincronizando entre sí** por la red local (la comanda llega del móvil al KDS sin internet). La nube sigue siendo la verdad canónica; el servidor LAN es un *edge cache* coherente.

```ts
// Esquema conceptual de la cola de escritura local (packages/sync)
type MutacionPendiente = {
  id: string;            // uuid generado en cliente (idempotencia)
  tenantId: string;
  tabla: "orders" | "order_items" | "payments";
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  creadoEn: number;      // epoch ms
  intentos: number;
};

async function procesarCola(cola: MutacionPendiente[]): Promise<void> {
  for (const m of cola) {
    try {
      await api.sync.upload(m);   // valida RBAC + fiscal en NestJS
      await marcarConfirmada(m.id);
    } catch (e) {
      // backoff exponencial: 1s, 2s, 4s… hasta 5 min; nunca se pierde
      await reintentarMasTarde(m, Math.min(2 ** m.intentos * 1000, 300_000));
    }
  }
}
```

> La idempotencia por `id` de cliente es clave: si un ticket se reenvía dos veces tras una reconexión, el backend lo deduplica y **no se cobra ni numera dos veces**.

### Ticaje sin internet con VERIFACTU (el matiz que lo hace legal)

«Cobrar offline» en España no es solo guardar el cobro: hay que **emitir el ticket fiscal en el momento**, con su QR y su huella. La buena noticia es que **VERIFACTU está diseñado para esto** y el motor vive en `@gluuh/core`, que corre **en el propio dispositivo** (no necesita la nube):

1. **La huella se calcula en local.** El registro VERIFACTU encadena SHA‑256 con el registro anterior; es **determinista**, así que el TPV lo genera sin red con `@gluuh/core` (mismo algoritmo que valida el vector oficial AEAT). El ticket sale **impreso con su QR de cotejo al instante**.
2. **El envío a la AEAT se difiere.** VERIFACTU **no exige enviar en el segundo**: el registro se **encola** y la API NestJS lo remite a la AEAT **al recuperar la conexión**. El cliente ya tiene su ticket válido; Hacienda recibe el lote después. (Si el corte se alarga, el modo *VERI*FACTU lo contempla; el detalle legal, en **[07 — Facturación y cumplimiento legal](../../07-facturacion-y-cumplimiento-legal.md)**.)
3. **Cadena sin huecos = numeración por serie y dispositivo.** Para que las huellas encadenen sin conflicto cuando varios TPV cobran a la vez offline, cada terminal usa su **propia serie** (p. ej. `TPV1‑2026‑…`). Así dos dispositivos nunca pelean por el mismo número y la cadena de cada serie queda íntegra; el backend valida el orden al subir.

```
COBRO OFFLINE
  cobrar ─► @gluuh/core (en el dispositivo): nº de serie + huella encadenada + QR
        ─► imprime ticket YA (cliente servido)
        ─► encola registro VERIFACTU + cobro en SQLite
  ── (vuelve internet) ──►
        ─► API NestJS: valida orden de la cadena, persiste en Postgres
        ─► remite el lote a la AEAT
```

> Regla: **lo que el cliente necesita (ticket + QR) se resuelve en local y al instante; lo que necesita Hacienda (recepción del registro) se sincroniza después.** Nunca se bloquea un cobro por falta de red.

---

## 5. Cómo se hace «instalable»

### 5.1 PWA: manifest + service worker + standalone

La PWA de `apps/web` se instala en tablet/escritorio y arranca **sin barras de navegador**.

```json
// apps/web/public/manifest.json
{
  "name": "Gluuh TPV",
  "short_name": "Gluuh",
  "description": "TPV de hostelería — VERIFACTU · IGIC",
  "start_url": "/tpv?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["fullscreen", "standalone", "minimal-ui"],
  "orientation": "landscape",
  "background_color": "#0B0F0D",
  "theme_color": "#34B27B",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `display: "standalone"` (o `fullscreen` vía `display_override`) elimina la UI del navegador.
- El **service worker** (con `next-pwa` o Workbox) cachea el *app shell* y los assets para arranque offline; los **datos** offline los gestiona PowerSync sobre IndexedDB/OPFS, no el SW.
- El prompt de instalación se controla capturando `beforeinstallprompt`:

```ts
// app shell: ofrecer "Instalar" cuando el navegador lo permita
let prompt: Event | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  prompt = e;                 // mostrar botón propio "Instalar Gluuh TPV"
});
// al pulsar el botón: (prompt as any)?.prompt();
```

### 5.2 Escritorio: Tauri 2.0 (no Electron)

Para el TPV de mostrador, el escritorio se empaqueta con **Tauri 2.0**. El núcleo Rust expone comandos para imprimir y abrir cajón; la UI es la misma React. Ejemplo de *capabilities* (permisos) Tauri:

```json
// apps/desktop/src-tauri/capabilities/tpv.json
{
  "identifier": "tpv-perifericos",
  "description": "Acceso a impresora ESC/POS, cajón y datáfono en el TPV de caja",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-fullscreen",
    "shell:allow-execute",          // sidecar del SDK del datáfono
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$APPDATA/tickets/*" }] }
  ]
}
```

```rust
// apps/desktop/src-tauri/src/printing.rs — driver ESC/POS por red/USB
#[tauri::command]
fn imprimir_ticket(ip: String, datos: Vec<u8>) -> Result<(), String> {
    use std::io::Write;
    let mut sock = std::net::TcpStream::connect((ip.as_str(), 9100))
        .map_err(|e| e.to_string())?;        // impresora de red en :9100
    sock.write_all(&datos).map_err(|e| e.to_string())?;
    // pulso de apertura de cajón: ESC p 0 <on> <off>
    sock.write_all(&[0x1B, 0x70, 0x00, 0x19, 0xFA]).map_err(|e| e.to_string())?;
    Ok(())
}
```

```ts
// invocación desde React (misma UI que la web)
import { invoke } from "@tauri-apps/api/core";
await invoke("imprimir_ticket", { ip: "192.168.1.50", datos: escpos.encode(ticket) });
```

**Por qué Tauri y no Electron:** binario ~10 MB frente a ~150 MB, ~10× menos RAM (decisivo en mini‑PC de TPV), núcleo Rust seguro para hablar con periféricos, auto‑update firmado. La única ventaja de Electron —Node/Chromium uniforme— no compensa el coste de recursos en hardware de caja barato.

---

## 6. Modo kiosco real

«Kiosco» significa: **pantalla completa, sin salir de la app, sin gestos accidentales**. Tres entornos:

### 6.1 Tablet Android (comandera / KDS / pantalla cliente)

Dos rutas, según presupuesto:

- **PWA + app launcher kiosco** (recomendado, sin código nativo). Se instala la PWA y se usa **Android Screen Pinning** (Ajustes → Seguridad → *Fijar pantalla*) o un launcher kiosco gratuito (Fully Kiosk Browser) que arranca la URL de Gluuh en *fullscreen*, bloquea la barra de estado y reinicia la app si se cierra.

```
Ajustes Android → Seguridad → "Fijar pantalla" (Screen Pinning): ON
→ abrir la PWA Gluuh → Recientes → icono → "Fijar"
→ la tablet queda bloqueada en la app hasta PIN de administrador
```

- **Expo + Lock Task Mode** (si ya hay app nativa): `expo-screen-orientation` + *Lock Task* del sistema para kiosco gestionado por MDM.

### 6.2 Mini‑PC Windows (TPV de mostrador)

La app Tauri arranca en *fullscreen* sin decoraciones, y Windows se configura para que el TPV sea lo único accesible:

```json
// apps/desktop/src-tauri/tauri.conf.json (extracto de la ventana)
{
  "app": {
    "windows": [{
      "label": "main",
      "fullscreen": true,
      "decorations": false,
      "alwaysOnTop": false,
      "title": "Gluuh TPV"
    }]
  }
}
```

A nivel de sistema, **Windows Assigned Access (Modo Kiosco)** lanza la app al iniciar sesión y bloquea el resto del escritorio:

```powershell
# Configurar la cuenta "tpv" para arrancar solo la app Gluuh (Shell Launcher / Assigned Access)
Set-AssignedAccess -UserName "tpv" -AppName "Gluuh TPV"
# Alternativa kiosco-navegador para roles sin periféricos (KDS/CDS en mini-PC):
# msedge.exe --kiosk https://app.gluuh.com/kds --edge-kiosk-type=fullscreen --no-first-run
```

### 6.3 Kiosco‑navegador (KDS/CDS rápido, sin instalar nada)

Para pantallas que solo muestran (cocina, cliente), Chrome/Edge en modo kiosco es lo más rápido de desplegar:

```bash
# Linux/mini-PC: Chromium kiosco apuntando al KDS
chromium-browser --kiosk --app=https://app.gluuh.com/kds \
  --noerrdialogs --disable-pinch --overscroll-history-navigation=0
```

---

## 7. Multi‑tenant y multi‑local

La plataforma no cambia el modelo de datos: **shared schema + `tenant_id` + RLS**, exactamente como fija **[06](../../06-base-de-datos-y-sincronizacion.md)**. Lo que la arquitectura de plataforma añade es **cómo se proyecta ese aislamiento en cada dispositivo**:

```
TENANT (grupo / cadena)
  └── LOCATION (local físico)  ← location_id
        ├── 🖥️ TPV mostrador (Tauri)    ─┐
        ├── 📱 Comandera (PWA/Expo)       ├─ bucket PowerSync = tenant_id + location_id
        ├── 👨‍🍳 KDS (PWA kiosco)            │  → cada dispositivo sincroniza SOLO su local
        └── 🪧 Pantalla cliente (PWA)    ─┘
```

- **Aislamiento en la base, no en el cliente.** El `tenant_id` viaja en el JWT y se fija como variable de sesión (`SET app.tenant_id`); RLS filtra en Postgres. Sin contexto → cero filas (seguro por defecto).
- **Sincronización segmentada.** Los *buckets* de PowerSync se definen por `tenant_id` y `location_id`: una tablet de la sala de un local **nunca descarga** datos de otro local ni de otro tenant. Menos datos en el dispositivo, mejor rendimiento y aislamiento real.
- **Roles a nivel de grupo o de local.** Un dueño de cadena ve todos los locales desde el backoffice (PWA); un camarero solo su local. La misma base de código (`apps/web`) sirve a ambos; cambia el `scope` del bucket y el RBAC.
- **Despliegue uniforme.** Como el código cliente es uno (React) envuelto por PWA/Tauri/Expo, **dar de alta un local nuevo no requiere nada especial**: se instala la PWA o el instalador Tauri y se inicia sesión con un usuario cuyo JWT ya porta `tenant_id` + `location_id`.

---

## 8. Decisión final (resumen accionable)

| Rol | Plataforma | Estado en el repo |
|---|---|---|
| **TPV mostrador (caja)** | **Tauri 2.0** (Windows/mini‑PC) | `apps/desktop` (esqueleto → construir) |
| **Comandera camarero** | **PWA tablet** (kiosco) · Expo si BT/NFC | `apps/web` / `apps/mobile` |
| **KDS cocina** | **PWA kiosco** + realtime | `apps/web` (`app/kds`) |
| **Pantalla cliente (CDS)** | **PWA kiosco** read‑only | `apps/web` (`app/pantalla`) |
| **Kiosko autopedido** | **PWA o Tauri** (según imprime/cobra) | `apps/web` (`app/kiosko`) |
| **Backoffice** | **Web/PWA** | `apps/web` (`app/(panel)`) |

**Lo innegociable, en una frase:** una única UI React reutilizable + offline‑first con PowerSync y SQLite local + **Tauri donde haya hardware de caja** + **PWA kiosco para todo lo demás** + Expo solo cuando el móvil nativo aporte algo que la PWA no pueda. Cero duplicación de lógica fiscal (siempre en `@gluuh/core`), escritura siempre validada por NestJS, verdad canónica en PostgreSQL/Supabase.

### Próximos pasos sugeridos

1. Añadir `manifest.json` + service worker a `apps/web` y verificar instalación/kiosco en una tablet Android real.
2. Arrancar `apps/desktop` con Tauri 2.0 reutilizando la UI de `apps/web` y un comando Rust de impresión ESC/POS de red (`:9100`) + apertura de cajón.
3. Definir los *buckets* de PowerSync por `tenant_id` + `location_id` en `packages/sync` y la cola de escritura idempotente contra `/sync/upload`.
4. Documentar el procedimiento de kiosco (Android Screen Pinning / Windows Assigned Access) como guía de instalación para el cliente.

---

*Documento de auditoría · 01 — Arquitectura y plataforma. Relacionados: [04](../../04-arquitectura-tecnica.md) · [05](../../05-stack-tecnologico.md) · [06](../../06-base-de-datos-y-sincronizacion.md) · [09](../../09-hardware.md) · [10](../../10-comanderas-kds-e-impresion.md).*
