# 06 — Decisión: ¿base de datos local, en la nube, o las dos?

> ⚠️ **ACTUALIZADO por [10-arquitectura-nodo-local-y-nube.md](10-arquitectura-nodo-local-y-nube.md) (12-07-2026).**
> El modelo evolucionó: **hay nodo local** y es la **fuente de verdad operativa** del
> local; la nube pasa de "fuente de verdad" a **espejo + módulo de gestión remota**.
> Lo que sigue vigente de este doc: NO dos productos (una sola base de código), NO
> modo dual de pago, la copia local incluida. Lo superado: "la nube es la fuente de
> verdad y no hay servidor local". Leer el doc 10 para la arquitectura actual.

**Fecha:** 02-07-2026. **Pregunta que responde:** Glop instala la base de datos en el
PC del bar (el PC es el servidor: los móviles se conectan por IP local, la copia de
seguridad va a un USB/disco, y la nube es un plugin de pago). ¿Copiamos ese modelo?
¿Ofrecemos las dos opciones y cobramos la nube — o el local — como extra mensual?

## Decisión

**Una sola arquitectura: nube como fuente de verdad + copia local en cada dispositivo
(offline-first con PowerSync).** No se ofrece un "modo local" con base de datos en el
PC, ni como opción de pago. Del modelo Glop se adoptan dos features baratas: la copia
de seguridad a USB/directorio y que el PC imprima para todos los dispositivos del
local (ambas en el doc 02).

## Opciones consideradas

| | A — Nube + offline-first (elegida) | B — Dual: el cliente elige nube o local (extra mensual) | C — PC-servidor puro (modelo Glop) |
|---|---|---|---|
| Funciona sin internet | ✅ copia SQLite en **cada** dispositivo | ✅ en modo local | ✅ |
| Se rompe/roban el PC | ✅ no pasa nada: otro PC y sesión | ❌ en modo local: datos = último backup | ❌ bar caído, datos = último USB |
| Backoffice remoto, multi-local | ✅ | Solo en modo nube | ❌ |
| VERIFACTU 2027 (remisión continua a AEAT) | ✅ nativo | El modo local necesita internet igualmente | Necesita internet igualmente |
| Actualizaciones | Solas (web + auto-update del shell) | Dos pipelines | Instalación a mano |
| Bases de código | **1** | **~2** (auth, sync, updates, migraciones y soporte duplicados) | 1 (pero reescribiendo todo lo hecho) |
| Coste de cambio hoy | 0 (es lo ya construido/decidido) | Meses + soporte ×2 para siempre | Meses; invalida Supabase/RLS/backoffice/realtime |

## Por qué NO la opción B (la dual)

1. **Son dos productos disfrazados de uno.** Cada funcionalidad nueva se diseña, prueba
   y soporta dos veces. Con un equipo de 1-3 personas es la forma más rápida de no
   avanzar en ninguna de las dos.
2. **La migración es una trampa.** El cliente que empieza en local y luego quiere nube
   (o al revés) convierte cada cambio de opinión en un proyecto de migración de datos
   con numeración fiscal en medio.
3. **La ventaja del modo local caduca en 2027.** VERIFACTU exige remisión continua de
   los registros de facturación: el bar necesitará conectividad para lo más crítico
   hagamos lo que hagamos. Pagar años de doble mantenimiento por una ventaja con fecha
   de caducidad es mal negocio.
4. **El segmento "sin nube" no es nuestro cliente.** Es el cliente histórico de
   Glop/ICG: exige presencialidad, paga licencia única y no quiere cuota. Nuestro
   posicionamiento (docs/02) es el contrario: cuota clara, sin permanencia, cloud.
5. **La objeción real del hostelero no es "quiero la BD en mi PC"**, es *"¿y si se cae
   internet?"* y *"¿mis datos son míos?"*. Las dos se responden sin modo local:
   offline-first (sigue vendiendo sin fibra) + copia de seguridad automática a su USB.

## Entonces, ¿qué se cobra como extra mensual?

El instinto de "cobrar un extra al mes" es correcto — pero el precio no va sobre dónde
está la base de datos, sino sobre **módulos** (doc 03), que es además como ya está
planteado el modelo de negocio (docs/11):

| Incluido en la base | Extras mensuales (módulos) |
|---|---|
| TPV + app de escritorio, carta, caja, plano de mesas, informes básicos, VERIFACTU, **copia de seguridad local a USB/disco** | Kiosko de autopedido · KDS/pantallas extra · Comandera(s) adicionales · Pagos integrados (datáfono/QR) · Delivery/agregadores · Reservas · Conexiones API/webhooks · Multi-local · Compras y stock |

Nota deliberada: la copia de seguridad local va **incluida**, no de pago. Glop cobra el
backup en nube porque su base es local; nosotros lo invertimos — la nube va de serie y
el "backup en tu USB" es la feature de confianza que desarma la objeción del modelo
Glop en la puerta del bar. Cobrar por ella sería matar su valor comercial.

## Consecuencias en el resto de la auditoría

- Doc 02: se añaden la **copia de seguridad local** (pieza 7) y la **cola de impresión
  compartida** (el PC imprime lo de comanderas/kiosko) — sin servidor local: la cola va
  por la nube (tabla `print_job` + Realtime), coherente con la decisión §2.5.
- Doc 05: entran en P1 como P1-5.
- El argumento de venta queda: *"funciona sin internet como Glop, pero si te roban el
  PC no pierdes ni un ticket, la copia está en tu USB cada noche, y las ventas las ves
  desde el sofá"*.
