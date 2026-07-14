# 11 — Decisiones del nodo local (14-07-2026)

Diez decisiones tomadas con el cliente. Cada una con **por qué** y con **qué obliga a
construir**. Las que no están aquí, no están decididas.

---

## 1 · El nodo se identifica con una CUENTA DE SERVICIO propia

Una cuenta por bar (por **local**, ver §9), que crea Gluuh al dar de alta la empresa.
El instalador la canjea con el código de instalación y guarda sólo su `refresh_token`.

**Por qué no la del titular** (que es lo que hay hoy): si el dueño cambia su contraseña,
GoTrue revoca las sesiones y **el nodo deja de sincronizar sin decir nada**. Las ventas se
quedan encerradas en el bar y nadie se entera hasta que alguien mira.

**Por qué no la clave maestra**: `SUPABASE_SECRET_KEY` salta toda la RLS. En el mini-PC de
un cliente sería la llave de los datos de **todos los demás bares**. Ya está quitada
(`apps/nodo/nube.mjs`, commit `0a57985`), y esto lo remata.

**Obliga a**: crear la cuenta al dar de alta la empresa + un endpoint que la canjee por el
código de instalación (`/api/instalacion/activar` ya existe; hay que ampliarlo).

---

## 2 · Los TPV: segundo instalador que pregunta la IP del servidor

Cada terminal lleva la app de escritorio (Electron) instalada, y el instalador le pregunta
la dirección del servidor.

**Consecuencia que hay que entender**: la app de escritorio **carga la interfaz de una
URL** (`ventana.loadURL`, `apps/desktop/src/main.ts:62`). Así que **el nodo tiene que
servir también la web**, no sólo los datos. No es opcional: es lo que hace que exista un
producto instalable.

**Y eso simplifica mucho**: sirviendo la web y los datos **desde el mismo origen**, el TPV
habla con rutas relativas y **no hay nada que configurar por terminal** — ni claves, ni
`.env`, ni la IP repetida en cada sitio. Sólo la IP, una vez, en el instalador.

**Ojo técnico**: las `NEXT_PUBLIC_*` se incrustan **al compilar**, así que no se puede
hornear la IP ni la clave `anon` de cada bar. El cliente tiene que leer su configuración
**en tiempo de ejecución** del propio nodo (`/nodo/config`). Hay que tocar
`supabaseBrowser()`.

---

## 3 · Si el nodo se cae, los TPV se van a la nube

Modo emergencia: si el servidor muere, las terminales siguen cobrando contra Supabase
(mientras haya internet). Cuando vuelve el nodo, se vuelve a él.

**Es la opción más difícil de las tres** y hay que decirlo: crea **dos fuentes de verdad**
durante ese rato, y al volver hay que juntarlas sin perder ni duplicar una venta.

---

## 4 · El árbitro es el LATIDO del nodo contra la nube

El caso que rompe el modo emergencia **no es que el nodo muera**: es que **un TPV se quede
aislado**. Los wifis baratos de bar tienen "aislamiento de clientes" — un TPV puede perder
al nodo y **seguir viendo internet**. Se iría a la nube él solo mientras los demás siguen
en el nodo, y **la misma mesa acabaría abierta en dos sitios**.

Solución: **el nodo late contra la nube cada minuto**. Cuando un TPV pierde al nodo, le
pregunta a la nube cuándo fue el último latido:

| último latido | qué significa | qué hace el TPV |
|---|---|---|
| hace 20 s | el nodo **está vivo** | **el aislado eres tú** → avisa y NO cae a la nube |
| más de 2 min | el nodo está muerto | modo emergencia |

Barato (el nodo ya sincroniza) y mata el caso peligroso. Si el TPV tampoco ve internet, no
puede hacer nada de todos modos.

**Obliga a**: un latido (`nodo_latido` o reutilizar `device.ultima_conexion`) y la lógica
de conmutación en el cliente.

---

## 5 · Series fiscales separadas: A el nodo, B la emergencia

**Una cadena VERIFACTU no puede tener dos escritores.** Si el nodo y la nube emiten
facturas en la misma serie, dos facturas apuntan a la misma huella anterior: **cadena rota
ante la AEAT**.

El nodo emite en la serie **A**; el modo emergencia, en la **B**. Dos cadenas
independientes, ambas válidas — la AEAT admite varias series. El bar sólo ve que algunos
tickets llevan otra letra, y sólo los días que se cayó el servidor.

Ya existe `invoice_series` y el campo `serie`. Es casi gratis, **pero no hacerlo sería
romper la contabilidad de un cliente**.

---

## 6 · Impresoras de RED, el nodo les habla por IP

Las impresoras (Epson TM-T20 Ethernet y similares) se enchufan al router, no a un PC. El
nodo les manda los trabajos directamente por IP (ESC/POS sobre TCP, puerto 9100).

**Por qué**: no dependen de que ningún TPV esté encendido. **La comanda de cocina sale
aunque el camarero apague su terminal.** Con impresoras USB colgadas de cada TPV, un PC
apagado es una cocina sin comandas, que es el bar parado.

La tabla `printer` ya tiene la columna **`transporte`** — estaba prevista y nadie la usaba.

**Obliga a**: un servicio de impresión en el nodo que hable ESC/POS por TCP.

---

## 7 · VERIFACTU: opcional por empresa; **envía la NUBE**

Cada empresa decide si lo activa. Si está activo:

- **El nodo genera la factura y su huella SIN internet** (el motor ya está hecho y pasa el
  vector oficial de la AEAT).
- **La nube la envía a Hacienda** con el certificado del cliente, cuando sincroniza.

**Por qué la nube y no el nodo**: ese certificado **puede firmar en nombre de la empresa** —
con él se presentan impuestos. Un mini-PC robado con el certificado dentro es muchísimo
peor que unos datos robados. Y encaja con lo construido: `apps/api` ya tiene el cliente
mTLS de la AEAT.

**Contrapartida, y hay que asumirla**: custodiar certificados de clientes es una
responsabilidad seria. **Tiene que estar en el contrato.**

---

## 8 · La nube va SIEMPRE conectada; el módulo de pago es el panel remoto

Todo bar sincroniza: **copia de seguridad, actualizaciones, modo emergencia y AEAT**.
Lo que se paga es **entrar a verlo desde casa** (informes, varios locales).

**Por qué**: un bar sin copia de seguridad que pierde el disco un sábado **te llama a ti,
pague o no pague**. Y sin conexión no podrías ni mandarle un arreglo cuando descubras un
fallo. El coste de servidor de sincronizar es prácticamente cero comparado con el de un
cliente enfadado.

---

## 9 · Un nodo por LOCAL (no por empresa)

Cada restaurante, su mini-PC. El instalador, si la empresa tiene más de un local,
**pregunta cuál es éste**.

Cada nodo se baja la **carta y la configuración de la empresa** (compartidas) pero **sólo
las salas, mesas, impresoras y empleados de SU local**. Sus ventas suben marcadas con su
local, y el dueño los ve todos juntos desde casa.

**Era un agujero real**: `provisionar.mjs` baja por empresa. Con tres restaurantes, **cada
mini-PC se habría llevado los datos de los otros dos** — y si el dueño vende uno de los
bares, el nuevo propietario se queda con los datos de los demás.

---

## 10 · Orden de trabajo

1. **El nodo sirve la web + instalador de TPV.** ← lo siguiente
   Es lo que convierte esto en algo instalable. Hoy, para probar el TPV contra el nodo hay
   que levantar `pnpm dev` a mano y editar un `.env`: eso no se puede llevar a un bar.
2. Rematar el instalador del servidor: cuenta de servicio + un nodo por local.
3. Latido y modo emergencia.
4. Impresión por IP.
5. Envío a la AEAT desde la nube.

---

## Lo que sigue SIN decidir

- Hardware mínimo del mini-PC (y si lo vende Gluuh o lo pone el bar).
- Retención: qué hace el nodo con las ventas de hace tres años que ya están en la nube.
- Qué pasa exactamente con una **cuenta abierta** cuando el nodo vuelve de una emergencia
  (los tickets cerrados son inmutables y se recuperan solos; las mesas a medias, no).
