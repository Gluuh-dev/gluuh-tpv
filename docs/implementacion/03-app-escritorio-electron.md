# 03 — App de escritorio (Electron): guía de implementación

**Objetivo:** convertir el esqueleto `apps/desktop` en el instalador Windows que un
bar usa a diario: TPV a pantalla completa, impresión ESC/POS con cajón, visor en
segunda pantalla, auto-update, identidad de terminal y copia de seguridad a USB.
Arquitectura y justificación en `docs/auditoria_02_07_26/02-app-escritorio-windows.md`.

## Estructura destino

```
apps/desktop/
  package.json          ← + electron-builder, electron-updater,
                          node-thermal-printer, serialport
  electron-builder.yml  ← nsis, appId com.gluuh.tpv, publish: github
  src/
    main.ts             ← arranque, ventanas, updater (hoy main.js)
    preload.ts          ← window.gluuh (contextBridge)
    impresion.ts        ← cola local + driver + suscripción print_job
    identidad.ts        ← device.json en userData, flujo /conectar
    backup.ts           ← exportación nocturna a USB/directorio
    visor.ts            ← segunda BrowserWindow si hay 2º monitor
```

TypeScript compilado con `tsc` a `dist/` (sin bundler; Electron carga CommonJS/ESM
según `package.json`). Migrar los `main.js`/`preload.js` actuales tal cual.

## Contrato `window.gluuh` (preload)

```ts
interface GluuhDesktop {
  version: string;
  device: { id: string; nombre: string } | null;   // null = sin vincular
  imprimir(job: PrintJob): Promise<{ ok: boolean; error?: string }>;
  abrirCajon(): Promise<void>;
  online: boolean;                                  // estado de red del main
  onEvento(cb: (e: { tipo: "impresion" | "red" | "update"; datos: unknown }) => void): void;
}
```

`PrintJob` es la interfaz ya definida en `packages/hardware/src/index.ts` — el
contrato compartido web↔desktop. La web detecta `window.gluuh` y, si existe, usa
`imprimir()` en vez de `window.print()` (un solo `if` en el flujo de ticket).

## Pieza 1 — Impresión ESC/POS + cajón

1. En `packages/hardware`: `EscPosPrinter implements Printer` usando
   `node-thermal-printer` (tipos Epson/Star; transporte red `tcp://ip:9100`, USB o
   serie vía `serialport`). Serializa `PrintJob` → líneas, corte, QR, y pulso de
   cajón `ESC p` cuando `abrirCajon: true`.
2. En `apps/desktop/src/impresion.ts`: cola FIFO en memoria con persistencia a disco
   (JSON en `userData/cola-impresion.json`) — un ticket no se pierde por impresora
   apagada; reintento cada 15 s y evento a la web para el toast.
3. Config de impresora en `setting` ámbito DEVICE (`impresora.tipo`, `impresora.uri`,
   `impresora.ancho`): editable desde una pantalla simple de ajustes del dispositivo.
4. **Cola compartida `print_job`** (los dispositivos sin impresora imprimen por el PC):
   ```sql
   create table print_job (
     id uuid primary key default gen_random_uuid(),
     tenant_id uuid not null references tenant(id) on delete cascade,
     device_destino uuid references device(id),   -- null = cualquier PC del local
     payload jsonb not null,                      -- PrintJob
     estado text not null default 'PENDIENTE',    -- PENDIENTE|IMPRESO|ERROR
     error text,
     created_at timestamptz not null default now()
   );
   -- RLS por tenant como el resto
   ```
   El main se suscribe por Supabase Realtime a inserts de su tenant, imprime y marca
   estado. Limitación asumida (doc 06 de la auditoría): sin internet solo imprime el
   propio PC.

## Pieza 2 — Identidad de dispositivo

Depende del flujo de emparejado de la guía 04 (código de 6 dígitos → credencial).
El desktop guarda `{ device_id, token, nombre }` en `userData/device.json`; si no
existe, la ventana carga `/conectar` en vez del TPV. Exponer en `window.gluuh.device`.

## Pieza 3 — Modo kiosk

- `fullscreen: true`, `autoHideMenuBar: true`, bloqueo de navegación fuera del dominio
  (`will-navigate` + `setWindowOpenHandler`), zoom deshabilitado.
- Salir/cerrar pide PIN de encargado (diálogo servido por la propia web; el main solo
  intercepta `close` y pregunta vía IPC).
- `app.setLoginItemSettings({ openAtLogin: true })` y relanzado en
  `render-process-gone`/`unresponsive`.
- Unificar la URL por defecto a `http://localhost:3100/tpv` en dev y `GLUUH_URL` en
  producción (corregir el README que dice 3000).

## Pieza 4 — Empaquetado y auto-update

- `electron-builder.yml`: target `nsis`, `publish: { provider: github }`. Firma de
  código: pendiente hasta tener certificado (anotar en README; SmartScreen avisará).
- `electron-updater`: comprobar al arrancar y cada 6 h; descargar en silencio;
  instalar al siguiente arranque (nunca reiniciar en mitad del servicio).
- Scripts: `pnpm --filter @gluuh/desktop build` (tsc + electron-builder) y `dist` en CI.

## Pieza 5 — Visor de cliente (2º monitor)

- Al arrancar y en `screen.on("display-added")`: si hay 2º display, abrir
  `BrowserWindow` fullscreen en él con `/visor` (vista nueva en `apps/web`: total y
  líneas del ticket en curso; en reposo, rotación de `offer` como `/ofertas`).
- El ticket en curso viaja por IPC: la ventana TPV publica cambios
  (`gluuh:ticket-actual`) y el main los reenvía a la ventana visor. Sin red, sin BD.

## Pieza 6 — Copia de seguridad local (USB/disco)

- `backup.ts`: a la hora configurada (`backup.hora`, `backup.destino` en `setting`
  DEVICE), descargar los datos del tenant y escribir
  `<destino>/gluuh-backup-YYYY-MM-DD/` con un CSV por tabla (carta, pedidos, líneas,
  pagos, facturas, caja, clientes) + `manifest.json` (fecha, tenant, versión).
  Formato abierto a propósito: que se pueda leer sin Gluuh.
- Fuente de datos: RPC `export_tenant_csv(tabla)` security-definer acotada al tenant
  del token del dispositivo (no exponer service key en el desktop).
- Botón "Exportar ahora" en los ajustes del dispositivo. Retención: conservar las
  últimas 30 carpetas, borrar anteriores.
- Incluido en el plan base (decisión comercial en auditoría doc 06).

## Criterios de aceptación

- [ ] Instalador `.exe` NSIS generado por CI; se instala y arranca en un Windows limpio.
- [ ] Ticket de venta impreso en una térmica ESC/POS real (red o USB) en < 2 s, con
      QR y corte; el cajón se abre en cobros en efectivo.
- [ ] Impresora apagada → el ticket queda en cola, se imprime al encenderla, la web
      muestra el aviso.
- [ ] Comandera (móvil) imprime en la térmica del PC vía `print_job`.
- [ ] Con 2º monitor conectado, el cliente ve su ticket en curso; en reposo, ofertas.
- [ ] Cerrar la app pide PIN de encargado; tras un crash del renderer se recarga sola.
- [ ] Publicar una release en GitHub → los desktops instalados se actualizan solos.
- [ ] A la hora configurada aparece la carpeta de backup en el USB con CSVs legibles.
