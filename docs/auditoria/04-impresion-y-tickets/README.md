# 04 — Impresión y diseño de tickets

> Diseño de tickets de **principio a fin** para un TPV de hostelería en España: cómo
> llega un trabajo de impresión desde la web/app a una térmica local, el protocolo
> **ESC/POS**, el modelo de **tres nombres por producto** (carta / ticket / cocina), el
> **enrutado por estación**, y plantillas concretas con **maquetas ASCII** a 42/48
> columnas. Profundiza en lo que [09 — Hardware](../../09-hardware.md) y
> [10 — Comanderas, KDS e impresión](../../10-comanderas-kds-e-impresion.md) introducen.
> El QR de cotejo y la huella encadenada salen de `packages/core/src/fiscal/qr.ts` y
> `verifactu.ts`; la impresión usa las interfaces `PrintJob`/`Printer` de
> `packages/hardware`.

---

## 1. Recordatorio de interfaces del proyecto

`packages/hardware` ya define el contrato mínimo. Todo lo de este documento **produce un
`PrintJob`** y lo entrega a un `Printer`; el "cómo llega a la impresora" (vía de
transporte) es intercambiable.

```ts
// packages/hardware — contrato existente (referencia)
export interface PrintJob {
  lineas: Linea[];      // contenido ya maquetado (texto + estilos por línea)
  cortar?: boolean;     // GS V — autocorte al final
  abrirCajon?: boolean; // ESC p — pulso al cajón
  qr?: string;          // contenido del QR (p. ej. URL de cotejo VERIFACTU)
}

export interface Printer {
  imprimir(job: PrintJob): Promise<void>;
}
```

> **Regla de oro:** el dominio (web/API) **nunca** habla bytes ESC/POS. Construye un
> `PrintJob` declarativo; un **renderer ESC/POS** (en `@gluuh/hardware`) lo traduce a
> bytes justo antes del transporte. Así una misma plantilla sirve para Epson, Star,
> Sunmi o un emulador de pruebas.

---

## 2. Cómo imprimir desde una web/app a una térmica local

Por seguridad, **el JS de un navegador o una app móvil no abren directamente el puerto
USB/serie** de una impresora (sandbox). Hay cinco vías reales; todas terminan enviando
**bytes ESC/POS** a la impresora, cambia solo el transporte.

### 2.1 Vías reales

1. **Impresora de RED (RAW puerto 9100).** La impresora tiene IP propia y escucha en el
   puerto **9100** (estándar de facto "RAW/JetDirect"). Abres un socket TCP y le mandas
   los bytes ESC/POS tal cual. Es la vía más **universal y fiable** en LAN, pero exige un
   proceso que abra el socket (la API NestJS, el TPV de escritorio o un agente local — el
   navegador **no** puede abrir TCP crudo).
2. **ePOS-Print (Epson).** Las Epson de red (TM-m30III, T88VII, TM-i…) llevan un
   mini-servidor web. Desde el **navegador**, con el ePOS SDK for JavaScript, te conectas a
   `IP:puerto` y mandas `addText`/`addCut`. **Sin drivers** por equipo. Ideal para web POS
   en red local; atado a Epson.
3. **CloudPRNT (Star).** Protocolo **REST inverso**: la impresora hace **polling** a tu
   servidor ("¿hay algo que imprimir?") y este responde con el trabajo. No hay que abrir
   puertos en el router ni tener un PC encendido. Perfecto para **pedidos online/delivery**
   (la impresora de cocina imprime sola). Latencia = intervalo de polling (2–10 s).
4. **Bluetooth/USB del dispositivo (Sunmi, datáfono Android).** En la **comandera** nativa,
   el SDK del fabricante (Sunmi InnerPrinter, Epson/Star SDK) o ESC/POS por BT/USB. La
   impresora es la del propio terminal en mano del camarero.
5. **Agente/servicio local (print server en LAN).** Un mini-PC/Raspberry corre un servicio
   que expone las impresoras a la web (WebSocket o REST) y emite los bytes por TCP/USB.
   Equivalente open-source: **QZ Tray** (WebSocket firmado, ESC/POS crudo desde JS); de
   pago/nube: **PrintNode**. Resuelve el hardware **heterogéneo**.

### 2.2 Tabla comparativa

| Vía | Transporte | ¿Navegador directo? | Offline (sin internet) | Pros | Contras | Cuándo usarla |
|-----|-----------|---------------------|------------------------|------|---------|---------------|
| **RED RAW 9100** | TCP socket → 9100 | ❌ (necesita backend/agente) | ✅ en LAN | Universal, fiable, cualquier marca | Requiere proceso que abra el socket | **Cocina/barra fijas** desde API o TPV |
| **ePOS-Print** | HTTP(S) a la impresora | ✅ Chrome/Edge | ✅ en LAN | Sin drivers, desde JS web | Solo Epson; soporte iOS irregular | **Web POS** en red local con Epson |
| **CloudPRNT** | REST (polling impresora→nube) | ✅ (servidor) | ❌ depende de la nube | Sin abrir puertos, ideal remoto | Latencia de polling, solo Star | **Delivery/pedidos online** a cocina |
| **BT/USB local (Sunmi)** | SDK nativo BT/USB | ❌ (app nativa) | ✅ total | Imprime en mano, en mesa | Atado al dispositivo y su SDK | **Comandera móvil**, cobro en mesa |
| **Agente local (QZ/PrintNode)** | WebSocket/REST → TCP/USB | ✅ vía agente | ✅ (QZ) / ❌ (PrintNode nube) | Hardware mixto, desde cualquier web | Hay que instalar y mantener el agente | **SaaS multi-local** con impresoras variadas |

> **Recomendación Gluuh.** Camino crítico (comanda a cocina, ticket de cobro) por **RAW
> 9100 en LAN** desde la API NestJS o el TPV de escritorio → **funciona sin internet**.
> **CloudPRNT** solo para delivery. **ePOS-Print** y **QZ Tray** como comodín para web POS
> y parques heterogéneos. Comandera Sunmi por **Bluetooth** integrado.

### 2.3 Esqueleto del transporte RAW 9100 (Node/Nest)

```ts
import { Socket } from "node:net";

/** Envía bytes ESC/POS ya renderizados a una térmica de red por el puerto 9100. */
export function enviarRaw(ip: string, puerto = 9100, datos: Buffer, timeoutMs = 4000) {
  return new Promise<void>((resolve, reject) => {
    const sock = new Socket();
    sock.setTimeout(timeoutMs);
    sock.once("error", reject);
    sock.once("timeout", () => sock.destroy(new Error("Impresora no responde (timeout)")));
    sock.connect(puerto, ip, () => {
      sock.write(datos, (err) => (err ? reject(err) : sock.end(resolve)));
    });
  });
}
```

---

## 3. Protocolo ESC/POS — lo esencial

ESC/POS es un flujo de **bytes de control** que empiezan por `ESC` (0x1B) o `GS` (0x1D)
intercalados con el texto. No se programa "a pelo": el renderer del proyecto encapsula
estos comandos.

### 3.1 Comandos clave

| Comando | Bytes (hex) | Función |
|---------|-------------|---------|
| Inicializar | `1B 40` | `ESC @` — resetea estilos y buffer |
| Alineación | `1B 61 n` | `ESC a` — n=0 izq, 1 centro, 2 der |
| Negrita | `1B 45 n` | `ESC E` — n=1 on, 0 off |
| Tamaño (alto/ancho) | `1D 21 n` | `GS !` — nibble alto=alto, bajo=ancho (`0x11` = doble alto y ancho) |
| Subrayado | `1B 2D n` | `ESC -` — n=0/1/2 |
| Avance de líneas | `1B 64 n` | `ESC d` — alimenta n líneas |
| **Corte** | `1D 56 00` / `1D 56 42 n` | `GS V` — corte total / corte con avance |
| **Cajón** | `1B 70 00 19 FA` | `ESC p 0 25 250` — pulso kick-out RJ11 |
| **QR** (4 pasos) | ver §3.3 | `GS ( k` — modelo, tamaño, ECC, store, print |
| **Code page** | `1B 74 n` | `ESC t` — selecciona tabla de caracteres |

### 3.2 Acentos en español (code page)

El español necesita `á é í ó ú ñ ç ¿ ¡`. La térmica trae varias tablas; la más segura es
**PC858** (`ESC t 19`, code page 19 = PC858, con € y acentos latinos) o **PC850**
(`ESC t 2`). El texto se codifica en esa tabla **antes** de enviarse — no es UTF-8.

```ts
// Selecciona PC858 y codifica una cadena a esa tabla.
const SELECT_PC858 = Buffer.from([0x1b, 0x74, 19]);
import iconv from "iconv-lite"; // o un mapa propio
const bytes = Buffer.concat([SELECT_PC858, iconv.encode("Jamón ibérico ñoño", "CP858")]);
```

> **Síntoma típico de tabla mal puesta:** "Jam�n", "ni�o", el € convertido en otro símbolo.
> Si los acentos salen mal, casi siempre es `ESC t` incorrecto o codificar en UTF-8 por
> error.

### 3.3 QR del ticket (VERIFACTU) en ESC/POS

El contenido es la **URL de cotejo de la AEAT** que produce `construirUrlQR()` de
`@gluuh/core`. La spec exige **ECC nivel M** (igual que `qr.ts`, que usa
`errorCorrectionLevel: "M"`). El QR se manda en cuatro comandos `GS ( k`:

```ts
function qrEscPos(url: string): Buffer {
  const data = Buffer.from(url, "ascii");
  const len = data.length + 3;
  const pL = len & 0xff, pH = (len >> 8) & 0xff;
  return Buffer.concat([
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // modelo 2
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]),       // tamaño módulo 6
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),       // ECC = M
    Buffer.concat([Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]), data]), // store
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),       // print
  ]);
}
```

> Alternativa si la impresora no renderiza QR nativo: rasterizar el SVG de
> `generarQrVerifactuSvg()` a bitmap y enviarlo con `GS v 0` (más bytes, más lento, pero
> universal).

---

## 4. Tres nombres por producto (clave del usuario)

Un mismo producto se **nombra distinto** según a quién mira:

- **`nombre_carta`** — lo que ve el camarero/cliente en pantalla y en la carta del TPV.
  Comercial y completo. *"Pizza Margarita Artesana 32cm"*.
- **`nombre_ticket`** — lo que sale en el **ticket de cliente / factura simplificada**.
  Más corto, legible, sin tecnicismos. *"Pizza Margarita"*.
- **`nombre_cocina`** — lo que sale en la **comanda/impresora/KDS de cocina**. Abreviado,
  EN MAYÚSCULAS, optimizado para que el cocinero lo lea de un vistazo (puede ir en otro
  idioma del personal de cocina). *"MARGARITA 32"*.

```
                     ┌─────────────────────────┐
                     │  producto (1 fila)      │
                     │  nombre_carta           │  Pizza Margarita Artesana 32cm
                     │  nombre_ticket          │  Pizza Margarita
                     │  nombre_cocina          │  MARGARITA 32
                     └─────────┬───────────────┘
            ┌──────────────────┼────────────────────┐
            ▼                  ▼                     ▼
     PANTALLA / TPV      TICKET CLIENTE         COCINA / KDS
   "Pizza Margarita     "Pizza Margarita"      "MARGARITA 32"
    Artesana 32cm"
```

### 4.1 DDL (Supabase, multi-tenant con RLS por `tenant_id`)

```sql
alter table producto
  add column nombre_carta  text not null,                       -- pantalla/TPV (obligatorio)
  add column nombre_ticket text,                                -- ticket cliente (opcional)
  add column nombre_cocina text;                                -- comanda/KDS (opcional)

-- Resolución con fallback: si no hay específico, usa el de carta.
-- Centralizado en una función para que web, API y motor de tickets coincidan.
create or replace function nombre_para(p producto, destino text)
returns text language sql immutable as $$
  select case destino
    when 'cocina' then coalesce(p.nombre_cocina, upper(p.nombre_ticket), upper(p.nombre_carta))
    when 'ticket' then coalesce(p.nombre_ticket, p.nombre_carta)
    else p.nombre_carta            -- 'carta' / pantalla
  end;
$$;
```

### 4.2 Resolución en TypeScript (espejo de la función SQL)

```ts
type Destino = "carta" | "ticket" | "cocina";

export function nombrePara(p: Producto, destino: Destino): string {
  switch (destino) {
    case "cocina": return p.nombreCocina ?? (p.nombreTicket ?? p.nombreCarta).toUpperCase();
    case "ticket": return p.nombreTicket ?? p.nombreCarta;
    default:       return p.nombreCarta;
  }
}
// nombrePara(pizza, "carta")  -> "Pizza Margarita Artesana 32cm"
// nombrePara(pizza, "ticket") -> "Pizza Margarita"
// nombrePara(pizza, "cocina") -> "MARGARITA 32"
```

> **Decisión:** `nombre_carta` es **obligatorio**; los otros dos **opcionales con
> fallback**. Así el alta de un producto sigue siendo de un solo campo y los nombres
> específicos se añaden solo cuando aportan (platos largos, cocina con personal extranjero,
> nombres comerciales con marca). El fallback vive en **un único sitio** (función SQL + su
> espejo TS) para que pantalla, ticket y cocina nunca se desincronicen.

---

## 5. Enrutado por estación

Una comanda se **divide por estación** (barra, cocina fría, parrilla, postres). Cada
estación tiene un **destino** configurable: una impresora de comandas, una pantalla KDS, o
ambas (KDS + impresora de respaldo).

### 5.1 Flujo

```
   Camarero ENVÍA comanda (mesa 12, pase 1)
                │
                ▼
   ┌───────────────────────────────┐
   │  División por ESTACIÓN         │   cada línea -> producto.estacion_id
   │  (agrupar líneas)              │
   └───┬───────────┬───────────┬───┘
       ▼           ▼           ▼
    BARRA      PARRILLA     POSTRES
   ┌──────┐   ┌────────┐   ┌────────┐
   │ impr │   │  KDS   │   │  KDS   │
   │ 9100 │   │ pase 1 │   │  +impr │
   └──────┘   └────────┘   └────────┘
   1 ticket   pantalla     pantalla + ticket
   solo lo    solo lo      solo lo de postres
   de barra   de parrilla
```

### 5.2 Agrupar e imprimir un ticket por estación

```ts
// Agrupa las líneas de la comanda por estación y emite un PrintJob por destino impresora.
function enrutar(comanda: Comanda, estaciones: Estacion[]): Tarea[] {
  const porEstacion = new Map<string, LineaComanda[]>();
  for (const l of comanda.lineas) {
    (porEstacion.get(l.estacionId) ?? porEstacion.set(l.estacionId, []).get(l.estacionId)!)
      .push(l);
  }
  const tareas: Tarea[] = [];
  for (const [estacionId, lineas] of porEstacion) {
    const est = estaciones.find((e) => e.id === estacionId)!;
    if (est.destinoKds) tareas.push({ tipo: "kds", estacionId, lineas });
    if (est.destinoImpresoraId)
      tareas.push({
        tipo: "imprimir",
        impresoraId: est.destinoImpresoraId,
        job: ticketCocina(comanda, est, lineas), // §6.1: solo SUS líneas
      });
  }
  return tareas;
}
```

Cada ticket de cocina lleva **solo las líneas de su estación**, con sus **modificadores**
(`+extra` / `sin X`) y **notas de cocina**, más la cabecera (mesa, pase, hora, camarero).

---

## 6. Diseño de tickets — plantillas y maquetas

Anchos reales: **80 mm ≈ 48 columnas** y **58 mm ≈ 32 columnas** (a fuente normal); las
maquetas siguientes están a **42/48 col**. Convención: precios alineados a la derecha, el
nombre se trunca si excede.

### 6.1 Ticket de COCINA (comanda) — 80 mm, grande y legible

Usa `nombre_cocina`. Doble alto en cabecera y cantidades. Modificadores indentados; notas
destacadas. Si la impresora es de impacto a 2 colores, los alérgenos/urgente van en rojo.

```
================================================
            MESA 12   ***  PASE 1  ***
================================================
 Camarero: Ana          19/06/2026  21:07
 Estacion: PARRILLA            Comensales: 3
------------------------------------------------
 2x  ENTRECOT 300                  (C2)
       > al punto
       > +salsa pimienta
 1x  SOLOMILLO                     (C1)
       > MUY HECHO
       > sin guarnicion
------------------------------------------------
 !! ALERGIA: FRUTOS SECOS (mesa)  !!
================================================
            >>> 21:07  ·  PASE 1 <<<
================================================
```

> `(C2)`/`(C1)` = comensal/asiento; `!! ALERGIA !!` en **rojo** si hay 2 colores. Nada de
> precios ni impuestos: la cocina no los necesita.

### 6.2 Ticket de CLIENTE / factura simplificada — 80 mm, con VERIFACTU

Usa `nombre_ticket`. Precios con **impuesto INCLUIDO** (la base se desglosa "hacia atrás"
con `calcularImpuestosIncluidos` de `@gluuh/core`). En Canarias **IGIC**, en península
**IVA**. Lleva **QR de cotejo AEAT**, número de factura y huella (de `verifactu.ts`).

```
================================================
                 BAR LA PALMA
              NIF: B-12345678
        C/ Real 1 · 38700 S/C de La Palma
              Tel. 922 00 00 00
------------------------------------------------
 Factura simplificada  F2-2026-000123
 19/06/2026 21:09        Mesa 12  Cam: Ana
------------------------------------------------
 2 Pizza Margarita              19,00
 1 Solomillo                    18,50
 2 Caña                          5,00
------------------------------------------------
 Base IGIC 7%                   39,72
 Cuota IGIC 7%                   2,78
------------------------------------------------
 TOTAL                         42,50 EUR
------------------------------------------------
 Forma de pago: TARJETA        42,50

            [######  QR  ######]
            [##  cotejo AEAT ##]
            [##################]

         VERI*FACTU
 Factura verificable en la sede
 electronica de la AEAT.
 Huella: 9F3A...C1  (SHA-256)
================================================
```

> El QR codifica `construirUrlQR(input)`; la leyenda exacta es `LEYENDA_VERIFACTU`
> (`"VERI*FACTU"`) más *"Factura verificable en la sede electrónica de la AEAT"*. Si el
> envío a la AEAT fue diferido (offline), igualmente se imprime: la huella encadenada ya es
> válida y el envío se completa al reconectar.

### 6.3 Ticket de CUENTA / precuenta (sin valor fiscal)

Para que el cliente revise antes de cobrar. **No** lleva número de factura ni QR; debe
decir claramente que **no es factura**.

```
================================================
                 BAR LA PALMA
            ---  PRE-CUENTA  ---
          (documento sin valor fiscal)
------------------------------------------------
 Mesa 12        19/06/2026 21:08   Cam: Ana
------------------------------------------------
 2 Pizza Margarita              19,00
 1 Solomillo                    18,50
 2 Caña                          5,00
------------------------------------------------
 TOTAL A PAGAR                 42,50 EUR
------------------------------------------------
   Este documento NO es una factura.
   Solicite su factura simplificada
   al realizar el pago.
================================================
```

### 6.4 Recibo de DATÁFONO

Lo emite el datáfono (Redsys/Stripe) o se replica desde su respuesta. Va junto al ticket
de cliente, no lo sustituye.

```
================================================
            BAR LA PALMA  ·  COMERCIO
 ------------------------------------------------
   PAGO CON TARJETA - COPIA COMERCIO
 ------------------------------------------------
 Tarjeta:  **** **** **** 4321  (VISA)
 Importe:  42,50 EUR
 Modo:     CONTACTLESS
 Aut.:     089123     Resultado: APROBADO
 AID: A0000000031010   TERM: 12345678
 19/06/2026 21:09:33
 ------------------------------------------------
        Gracias por su visita
================================================
```

---

## 7. Plantillas configurables

Todo lo maquetable es **datos**, no código: logo, pie, idioma, ancho, copias y qué imprime
cada estación. Modelo propuesto (tablas Supabase + JSON de plantilla).

### 7.1 Tablas

```sql
-- Una impresora física (o destino lógico).
create table printer (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  nombre        text not null,                       -- "Cocina parrilla"
  via           text not null,                       -- 'raw9100'|'epos'|'cloudprnt'|'sunmi_bt'|'agente'
  host          text,                                -- IP (raw9100/epos)
  puerto        int  default 9100,
  ancho_mm      int  not null default 80,            -- 80 | 58
  code_page     text not null default 'PC858',
  corta_papel   boolean not null default true,
  cajon         boolean not null default false
);

-- Estación de cocina/barra y su destino (impresora y/o KDS).
create table print_station (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null,
  nombre               text not null,                -- "Parrilla"
  destino_printer_id   uuid references printer(id),
  destino_kds          boolean not null default false,
  copias               int not null default 1
);

-- Plantilla de un tipo de documento.
create table ticket_template (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  tipo        text not null,                         -- 'cocina'|'cliente'|'precuenta'|'datafono'
  config      jsonb not null
);
```

### 7.2 JSON de plantilla (ejemplo: ticket de cliente)

```json
{
  "tipo": "cliente",
  "ancho_mm": 80,
  "idioma": "es",
  "copias": 1,
  "cabecera": {
    "logo_url": "supabase://logos/bar-la-palma.png",
    "lineas": ["{{local.nombre}}", "NIF: {{local.nif}}", "{{local.direccion}}", "Tel. {{local.telefono}}"]
  },
  "cuerpo": { "nombre": "nombre_ticket", "mostrar_impuesto_incluido": true },
  "fiscal": { "qr_verifactu": true, "leyenda": "Factura verificable en la sede electronica de la AEAT", "mostrar_huella": true },
  "pie": ["Gracias por su visita", "www.barlapalma.es"],
  "corta_papel": true,
  "abrir_cajon": true
}
```

> Con esto, cambiar "qué imprime la parrilla", el ancho o el pie es **configuración del
> backoffice**, sin tocar código. El renderer lee la plantilla + el `nombre_para(destino)`
> y produce el `PrintJob`.

---

## 8. Reimpresión, cajón, errores y reintentos

### 8.1 Apertura del cajón

El cajón no tiene electrónica: se abre con `ESC p` enviado **a la impresora** (RJ11). Se
acciona al imprimir el ticket de cobro en efectivo, o manualmente ("abrir cajón" con
permiso y registro en auditoría). En el `PrintJob`, `abrirCajon: true`.

### 8.2 Reimpresión

- **Ticket de cliente:** la reimpresión debe marcarse como **COPIA / DUPLICADO** y **no**
  genera un nuevo registro VERIFACTU (misma huella, mismo número). Imprimir el mismo QR.
- **Comanda de cocina:** reimprimir está permitido (p. ej. atasco de papel); conviene
  marcar **"REIMPRESIÓN"** para que cocina no la prepare dos veces.

### 8.3 Errores de impresora y reintentos

Estados típicos: **sin papel**, **tapa abierta**, **offline/timeout**, **cajón
atascado**. Estrategia:

```ts
async function imprimirConReintentos(printer: Printer, job: PrintJob, max = 3) {
  for (let intento = 1; intento <= max; intento++) {
    try {
      await printer.imprimir(job);
      return { ok: true };
    } catch (e) {
      if (intento === max) {
        await encolarPendiente(job);     // cola persistente: se reintenta al recuperar
        await avisarUI("Impresora sin respuesta — trabajo en cola");
        return { ok: false, error: e };
      }
      await esperar(500 * intento);      // backoff lineal
    }
  }
}
```

Principios:

- **Cola persistente** por impresora: si la cocina está offline, los tickets se acumulan y
  se vacían al recuperar (no se pierden comandas).
- **Idempotencia:** cada trabajo lleva un `id`; reintentar no debe duplicar (la impresora o
  el agente descarta `id` ya impresos).
- **Aviso en UI**, no silencio: el camarero debe saber que la mesa 5 no imprimió en cocina.
- **Camino crítico en LAN**, nunca dependiente de internet (ver §2.2): si cae la fibra, la
  cocina sigue imprimiendo.

---

## 9. Resumen de decisiones

| Aspecto | Decisión |
|---------|----------|
| Vía principal cocina/barra | **RAW 9100** en LAN desde API/TPV (offline) |
| Vía web POS | **ePOS-Print** (Epson) / **QZ Tray** (heterogéneo) |
| Vía delivery | **Star CloudPRNT** |
| Vía comandera | **Bluetooth/USB Sunmi** (SDK) |
| Code page | **PC858** (acentos ES + €) |
| Nombres por producto | `nombre_carta` (obligatorio) + `nombre_ticket`/`nombre_cocina` (opcionales, fallback en SQL+TS) |
| Enrutado | Por **estación** → impresora y/o KDS, configurable |
| QR/huella | `construirUrlQR()` + ECC **M** (espejo de `qr.ts`/`verifactu.ts`) |
| Plantillas | `printer` + `print_station` + `ticket_template` (JSON) |
| Errores | Cola persistente + reintentos con backoff + aviso UI |

---

## 10. Referencias

- [09 — Hardware](../../09-hardware.md) §2–3, §5 (impresoras, cajón RJ11, KDS).
- [10 — Comanderas, KDS e impresión](../../10-comanderas-kds-e-impresion.md) §3 (vías ESC/POS) y §4 (formatos).
- [07 — Facturación y cumplimiento legal](../../07-facturacion-y-cumplimiento-legal.md) (VERIFACTU, QR).
- `packages/core/src/fiscal/qr.ts` y `verifactu.ts` — URL de cotejo, huella, leyenda.
- `packages/hardware` — interfaces `PrintJob` / `Printer`.
