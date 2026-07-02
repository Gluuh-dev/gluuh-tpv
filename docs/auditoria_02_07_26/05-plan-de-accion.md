# 05 — Plan de acción

Orden recomendado. Esfuerzos en días de un desarrollador con IA, aproximados.
El criterio de prioridad: **P0 = sin esto no se puede vender**, P1 = paridad
Glop/argumentos de venta, P2 = crecimiento. Complementa (no sustituye) el plan
F0–F8 de `docs/auditoria/implementacion/plan-por-fases.md`.

## Quick wins (esta semana, ~2-3 días en total)

| # | Acción | Por qué |
|---|---|---|
| 1 | Verificar en la BD real la **doble definición de `invoice`** (0001 vs 0022) y consolidar con migración correctiva | `/api/factura` puede estar escribiendo contra columnas que no existen. Bloquea P0-1 |
| 2 | Borrar el editor de plano viejo `(panel)/sala` | Redundante con `planos-de-mesas`; dos editores = bugs dobles |
| 3 | Actualizar README raíz + `docs/README.md` y barrer "Tauri" de los docs 03/04/06/09/10/12/13 | El repo describe un proyecto que ya no existe |
| 4 | Unificar puerto del desktop (3100) y decidir `customer` vs `client` | Fricción diaria |
| 5 | Primer consumidor del sistema `setting` (p. ej. config de impresora/ticket) | Estrena el mecanismo F0 que lleva un mes construido y sin usar |

## P0 — Sin esto no se puede vender (≈ 4-6 semanas)

**P0-1 · VERIFACTU real en el cobro (3-5 d)**
Activar `VERIFACTU_ACTIVO`, llamar a `/api/factura` al cobrar, persistir y encadenar.
El endpoint ya existe; es cablear, probar la cadena en el visor y decidir la serie por
terminal. Después: envío real a AEAT vía `apps/api` (cliente mTLS ya escrito; falta
parsear respuesta y guardar estado). Es el argumento comercial nº1 de 2026-2027.

**P0-2 · Refactor del TPV (3-4 d)**
Trocear `tpv/page.tsx` en componentes antes de añadirle nada. Sin lógica nueva.

**P0-3 · App de escritorio funcional (2-3 sem)** — doc 02, piezas 1-4
Impresión ESC/POS + cajón + cola local; identidad de dispositivo; modo kiosk;
instalador con auto-update. Entregable: un bar imprime tickets reales desde un PC
con Gluuh instalado.

**P0-4 · Módulos base + emparejado (1-1,5 sem)** — doc 03, pasos 1-4
`tenant_module`, página Módulos, gating, `/conectar` con código. Entregable: la
pantalla de cocina se conecta a una tele con un código de 6 dígitos.

## P1 — Paridad Glop y argumentos de venta (≈ 4-6 semanas)

**P1-1 · Paridad de venta (1,5-2 sem)** — tabla 4.2 del doc 04
Aparcar, pasar a mesa, cliente/comensales en ticket, invitación/autoconsumo como
botones, último documento, Utilidades, barra de estado, imprimir cuenta (proforma),
tipo de documento (factura nominativa), F10/F11/F12, imágenes de producto.

**P1-2 · Offline con PowerSync (2-3 sem, la más incierta)**
`@powersync/web` en la web + instancia PowerSync + write-path real de `/sync/upload`
+ numeración por rangos por dispositivo. Iguala el mejor argumento de Glop y hace
verdad el marketing del landing. Empezar por lectura (carta/mesas offline), luego
escritura encolada.

**P1-3 · Tarifas reales (1 sem)**
`product_price` por tarifa + programación horaria + "tarifa activa" en la barra de
estado. Ya diseñado en `docs/auditoria/implementacion/modelo-de-datos.md`.

**P1-4 · Dividir cuenta (3-4 d)**
Por líneas y por comensales (genera dos pedidos/pagos).

**P1-5 · Backup local + impresión compartida (3-4 d)** — docs 02 y 06
Exportación nocturna a USB/directorio desde la app de escritorio (incluida en el plan
base, no de pago) y tabla `print_job` + Realtime para que comandera y kiosko impriman
por las impresoras del PC.

## P2 — Crecimiento (a partir de ~3 meses)

- **Pagos reales**: Stripe Terminal + QR Bizum (módulo PAGOS); desbloquea el cobro
  del kiosko y "cobro en mesa" desde comandera. Redsys después (docs/08).
- **Compras/stock completo**: el mayor hueco funcional contra Ágora (docs/18); todo
  el diseño está en `docs/auditoria/`. Es un producto en sí mismo — no colarlo antes
  que P0/P1.
- **QR en mesa** (venta desde pantalla sin hardware), **API keys + webhooks**,
  delivery vía Deliverect, permisos finos (`role`/`permission`), visor VFD serie,
  envío de ticket por email, asistente IA con backend.

## Riesgos a vigilar

- **PowerSync** es la pieza con más incógnitas (infra nueva, sync rules, conflictos).
  Prototipo de 2-3 días antes de comprometer fechas; si se atasca, el desktop puede
  salir online-only con cola de impresión local (degradación aceptable, Glop-parity
  se retrasa pero nada se bloquea).
- **AEAT**: las URLs y `SOAPAction` del cliente mTLS están sin reconfirmar
  (`apps/api/src/fiscal/aeat.service.ts`); probar contra el entorno de pruebas de la
  AEAT en cuanto haya certificado.
- **Alcance**: el menú del backoffice tiene ~60 stubs "En preparación". No rellenarlos
  por orden de menú: solo lo que pida P0/P1. Cada stub extra es un día que Glop-parity
  no llega.

## Resultado esperado a ~3 meses

Un bar en La Palma con: PC con Gluuh Desktop imprimiendo tickets VERIFACTU reales,
cajón que se abre, tele de cocina emparejada por código, kiosko con la marca del bar,
comandera en el móvil del camarero, el TPV aguantando cortes de fibra y la copia de
seguridad en el USB del dueño cada noche. Eso es "mejor que Glop": todo lo suyo, más
cloud, más fiscalidad nativa, sin licencias por puesto.
