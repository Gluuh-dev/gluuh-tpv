# @gluppo/desktop — TPV de barra (Electron)

Aplicación de escritorio (Windows) del TPV principal. **Electron** carga la
aplicación web (Next.js) y aporta lo que el navegador no puede: acceso al
**hardware local** (impresora ESC/POS, cajón portamonedas, datáfono) y
funcionamiento robusto en barra. Ver [docs/05](../../docs/05-stack-tecnologico.md) y [docs/10](../../docs/10-comanderas-kds-e-impresion.md).

## Ejecutar (desarrollo)

```bash
# 1) Arranca la web (en otra terminal):
pnpm --filter @gluppo/web dev          # http://localhost:3000

# 2) Arranca el escritorio (carga la web):
pnpm --filter @gluppo/desktop dev
# o apuntando a otra URL:
GLUPPO_URL=http://localhost:3000/tpv pnpm --filter @gluppo/desktop dev
```

## Hardware

El puente está en `electron/preload.js` (expone `window.gluppo`) y la lógica en
`electron/main.js` (`ipcMain.handle("gluppo:imprimir-ticket", …)`).

Desde la web:

```ts
await window.gluppo.imprimirTicket(textoEscPos);
```

> El handler de impresión es un **esqueleto** (registra y simula). La impresión
> real ESC/POS se implementa con `node-thermal-printer`/`serialport` y la apertura
> del cajón con `ESC p`. Ver [docs/10 §3](../../docs/10-comanderas-kds-e-impresion.md).

## Empaquetado

Para generar el instalable de Windows se usará `electron-builder` (pendiente, ver roadmap).
