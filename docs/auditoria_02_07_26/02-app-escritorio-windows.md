# 02 — App de escritorio (Windows): el TPV web dentro de Electron

**Objetivo:** una app instalable en el PC del bar que abre el TPV con **todas** las
opciones que ya existen en la web, y que además hace lo que un navegador no puede:
imprimir en térmica ESC/POS, abrir el cajón, controlar un visor de cliente, arrancar
sola con Windows y sobrevivir sin internet.

**Principio rector: no se reescribe nada.** La web ya es el producto (doc 01). La app
de PC es Electron cargando esa misma web más un puente de hardware. Electron ya está
decidido frente a Tauri (`docs/05-stack-tecnologico.md`) precisamente por el ecosistema
de hardware Node (`node-thermal-printer`, `serialport`, `node-hid`), y el esqueleto ya
existe en `apps/desktop` (ventana + preload + IPC de impresión simulado).

## 2.1 Arquitectura

```
┌────────────────────────── PC del bar ──────────────────────────┐
│  Gluuh Desktop (Electron)                                      │
│  ┌───────────────────────────────┐  ┌────────────────────────┐ │
│  │ BrowserWindow (kiosk)         │  │ Main process (Node)    │ │
│  │ carga GLUUH_URL               │  │ · cola de impresión    │ │
│  │ (la web de producción,        │◄─┤ · ESC/POS + cajón      │ │
│  │  o localhost:3100 en dev)     │IPC│ · identidad dispositivo│ │
│  │                               │  │ · 2ª pantalla (visor)  │ │
│  │ window.gluuh.* (preload)      │  │ · auto-update          │ │
│  └───────────────────────────────┘  └───────────┬────────────┘ │
└─────────────────────────────────────────────────┼──────────────┘
                                        USB / red / serie
                                   impresora · cajón · visor
```

- **La web no sabe si corre en navegador o en Electron** salvo por una comprobación:
  `if (window.gluuh) → impresión nativa; si no → window.print()`. Un solo código.
- El preload (`contextBridge`) es la **única** superficie entre web y Node:
  `window.gluuh = { device, imprimir(job), abrirCajon(), version }`. Nada de
  `nodeIntegration` (ya está bien configurado en el esqueleto actual).
- El contrato de impresión es la interfaz `PrintJob` que **ya está definida** en
  `packages/hardware/src/index.ts` (líneas, cortar, abrirCajon, qr). Ahí se implementa
  el driver, no en la app.

## 2.2 Las 6 piezas que faltan (por orden de construcción)

### 1. Impresión ESC/POS real + cajón — *la razón de existir de la app*
- Implementar en `packages/hardware` un `EscPosPrinter implements Printer` con
  `node-thermal-printer` (soporta Epson/Star por red, USB y serie vía `serialport`).
- El handler IPC `gluuh:imprimir-ticket` (hoy un `console.log`) pasa a: encolar el
  `PrintJob` → serializar a ESC/POS → imprimir → cortar → pulso de cajón (`ESC p`)
  si `abrirCajon: true`.
- **Cola local con reintentos** en el main process: si la impresora está apagada, el
  ticket no se pierde; se reintenta y se notifica a la web (evento IPC → toast).
- La web añade un mapeador ticket→`PrintJob` (hoy el ticket 80 mm ya se compone en
  `app/tpv/page.tsx` para `window.print()`; es reordenar esa misma información).
- Config de impresora (IP/puerto/USB, ancho 58/80 mm) en la tabla `setting` con ámbito
  `DEVICE` — el mecanismo ya existe (`0023_setting.sql`), esta es su primera consumidora.
- **El PC imprime para todo el local**: los dispositivos sin impresora (comandera,
  kiosko) insertan su trabajo en una tabla `print_job`; el desktop, suscrito por
  Realtime, imprime y marca el estado. Sin servidor local ni IPs que configurar.
  Limitación asumida: sin internet en el local solo imprime el propio PC; un hub LAN
  directo queda como mejora futura si el offline lo exige (ver doc 06).

### 2. Identidad de dispositivo (emparejado)
- Primer arranque: la app muestra `/conectar` y se vincula con un código generado desde
  el backoffice (flujo detallado en doc 03, sirve para TPV, KDS, pantalla y kiosko por
  igual). Guarda `device_id` + credencial en `app.getPath("userData")`.
- La tabla `device` ya existe en `0001_init.sql`; faltan columnas de vinculación (doc 03).
- Con identidad de dispositivo se habilitan: settings por terminal, numeración por
  terminal (offline), y la barra de estado estilo Glop ("TERMINAL 1").

### 3. Modo TPV (kiosk)
- Pantalla completa sin menú, `Alt+F4`/cierre protegido con PIN de encargado,
  `autoHideMenuBar`, deshabilitar zoom/navegación fuera del dominio propio.
- Arranque con Windows (`app.setLoginItemSettings`) y relanzado automático si el
  renderer muere (`webContents.on("render-process-gone") → reload`).
- Atajos de teclado globales de la ventana (F10/F11/F12 para cobro, doc 04).

### 4. Empaquetado + auto-update
- `electron-builder` con target NSIS (instalador Windows firmable más adelante).
- `electron-updater` apuntando a GitHub Releases (gratis, suficiente hasta tener
  decenas de locales). El bar nunca "actualiza el programa": la web se despliega en
  Vercel y el shell se actualiza solo.
- Esto es lo que convierte el esqueleto en producto instalable: hoy no hay build.

### 5. Segunda pantalla: visor de cliente
- Si Windows detecta un segundo monitor (`screen.getAllDisplays()`), abrir una segunda
  `BrowserWindow` a pantalla completa en él cargando `/pantalla` (ya existe) o una vista
  nueva `/visor` (total + líneas del ticket en curso + publicidad de `offer` cuando está
  en reposo). La comunicación ticket-en-curso→visor va por IPC (misma máquina, sin red).
- Los visores VFD serie de 2 líneas quedan como módulo posterior en `packages/hardware`.

### 6. Offline (compartido con la web, no exclusivo de Electron)
- La solución es **PowerSync en `apps/web`** (`@powersync/web`: SQLite WASM + OPFS), que
  funciona idéntica dentro de Electron. El conector y el schema **ya están escritos** en
  `packages/sync`; falta integrarlos en la web, montar la instancia PowerSync contra el
  Postgres de Supabase y completar el write-path `/sync/upload` de la API (hoy stub).
- Numeración fiscal offline por **rangos por dispositivo** (ya diseñado en
  `docs/06-base-de-datos-y-sincronizacion.md`) — requiere la pieza 2 (identidad).
- Interin (hasta que PowerSync esté): la app detecta pérdida de red y lo muestra en la
  barra de estado; la cola de impresión local ya evita perder tickets impresos.

### 7. Copia de seguridad local (USB/disco) — la feature de confianza
- Exportación **automática nocturna** de los datos del tenant (carta, pedidos, facturas,
  caja, clientes) a la carpeta, disco o USB que el dueño elija, más botón "Exportar
  ahora". Formato ZIP con CSV/JSON legibles (que se pueda abrir sin Gluuh).
- Destino y hora configurables en `setting` ámbito `DEVICE`. Incluida en el plan base,
  no de pago — el porqué comercial está en el doc 06.

## 2.3 Cómo funcionaría (un día de servicio)

1. **9:00** — El camarero enciende el PC. Gluuh Desktop arranca solo, a pantalla
   completa, ya vinculado como "TERMINAL 1" del local. Carga el TPV web con la sesión
   del dispositivo; pide PIN de operario (flujo actual).
2. **Servicio** — Venta idéntica a la web de hoy (mesas, plano, comandas, descuentos).
   Al cobrar: el ticket sale por la térmica en <2 s y el cajón se abre solo. En el
   segundo monitor, el cliente ve su cuenta y el QR VERIFACTU.
3. **13:30, se cae la fibra** — El TPV sigue: carta y mesas están en SQLite local,
   los cobros se encolan (PowerSync) y los tickets se numeran con el rango del terminal.
   Al volver la red, todo sube solo y las facturas se remiten a la AEAT.
4. **Cierre** — Cierre Z desde el mismo TPV (página de caja actual). Por la noche,
   la copia de seguridad se vuelca sola al USB del dueño y el shell descarga una
   actualización si la hay; mañana arranca la nueva versión.
5. **Desde casa** — El dueño cambia un precio en el backoffice web. Cuando el TPV del
   bar tiene internet, el cambio le llega solo (sync); si el bar está offline en ese
   momento, le llegará al reconectar. La conexión "online" no es un requisito: es el
   canal de sincronización entre el local y la nube.

## 2.4 Qué cambia en cada sitio (resumen de diffs)

| Dónde | Cambio |
|---|---|
| `apps/desktop` | main: kiosk, cola impresión (propia y de la red vía `print_job`), 2ª ventana, updater, identidad, backup local a USB/disco. preload: `window.gluuh` completo. `package.json`: `electron-builder`, `electron-updater`, `node-thermal-printer`, `serialport`. |
| `packages/hardware` | `EscPosPrinter` (primera implementación real de `Printer`). |
| `apps/web` | Detección `window.gluuh` en la impresión del TPV; página `/conectar`; (fase offline) integración `@powersync/web` + `packages/sync`. |
| `apps/api` | (fase offline) write-path real de `/sync/upload` con validación y numeración. |
| `supabase` | Columnas de vinculación en `device` (doc 03); tabla `print_job`. |

## 2.5 Decisiones tomadas en este doc

- **Cargar la web remota, no empotrar el build de Next en el instalador.** Menos
  complejidad, actualizaciones instantáneas; el offline lo resuelve PowerSync (datos),
  no el empaquetado (código). Si algún día hace falta arrancar sin haber cargado nunca
  la web, se añade una caché del shell — no antes de necesitarlo.
- **Un solo canal de hardware: el preload.** Nada de servicios Windows aparte ni
  procesos locales con API HTTP (la carpeta `docs/auditoria/infraestructura/` menciona
  un "servicio local PC": queda descartado mientras Electron cubra el hardware).
- **La impresión desde navegador puro (sin Electron) queda como está** (`window.print()`
  o, más adelante, impresoras de red ePOS/CloudPRNT para tablets). No bloquea esta app.
