# Arquitectura técnica unificada — Gluuh TPV

> Documento de arquitectura **unificada**: integra la referencia de plataforma
> ([`../01-arquitectura-y-plataforma/`](../01-arquitectura-y-plataforma/)), impresión y transporte
> ([`../04-impresion-y-tickets/`](../04-impresion-y-tickets/)), tiempo real de cocina
> ([`../05-cocina-kds-y-comanderas/`](../05-cocina-kds-y-comanderas/)) y las herramientas del
> configurador ([`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/)).
> Es el "cómo encaja todo" del plan de implementación ([`README.md`](README.md),
> [`modelo-de-datos.md`](modelo-de-datos.md), [`plan-por-fases.md`](plan-por-fases.md)).
>
> **Principio rector:** *la web configura, la app del local opera.* Una sola base de código React
> (`apps/web`) sirve **todas** las superficies; Tauri y Expo solo la envuelven donde el hardware lo
> exige. Cero duplicación de lógica fiscal — siempre en `@gluuh/core`.

---

## 0. Vista de 10.000 metros

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          UNA BASE REACT · apps/web                             │
│  app/(panel)  │  app/tpv · comandera · kds · pantalla · kiosko · almacen       │
│  CONFIGURA    │  OPERA (a pantalla completa, offline-first)                    │
└──────┬─────────────────────┬───────────────────────────────────────┬──────────┘
       │ web/PWA             │ Tauri (hardware caja)                   │ Expo (BT/NFC)
       ▼                     ▼                                         ▼
┌────────────┐   ┌────────────────────────┐                ┌────────────────────┐
│ Navegador  │   │ TPV mostrador (mini-PC)│                │ Comandera nativa   │
│ (remoto)   │   │ SQLite local · agente  │                │ Sunmi · impr. BT   │
└─────┬──────┘   └───────────┬────────────┘                └─────────┬──────────┘
      │                      │ PowerSync (offline-first)             │
      │                      ▼                                        │
      │          ┌────────────────────────────┐                      │
      └─────────▶│   API NestJS (apps/api)     │◀─────────────────────┘
                 │   valida RBAC · fiscal ·    │
                 │   numeración · mTLS→AEAT    │
                 └─────────────┬───────────────┘
                               ▼
                 ┌────────────────────────────┐
                 │  PostgreSQL / Supabase      │  ← verdad canónica
                 │  RLS por tenant_id · RPC    │     multi-tenant
                 └────────────────────────────┘
```

`@gluuh/core` (motor fiscal VERIFACTU + IGIC, máquinas de estado de comanda) vive **en el
dispositivo y en el backend** — misma lógica, sin duplicar. Detalle por capa abajo.

---

## 1. Superficies — una base, muchos envoltorios

Un TPV de hostelería **no es una web**: es un dispositivo de misión crítica que no puede caerse en
hora punta, habla con hardware físico y va a pantalla completa. La respuesta no es una sola
plataforma, sino un **binomio configura/opera** sobre **una única UI React** (ver
[`../01-arquitectura-y-plataforma/` §1](../01-arquitectura-y-plataforma/)).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        apps/web  (Next.js 16 · React 19)                   │
├────────────────────────────┬───────────────────────────────────────────────┤
│  CONFIGURA (modo A)         │  OPERA (modo B)                               │
│  app/(panel)                │  app/tpv      → TPV de barra/mostrador        │
│  · carta, precios, alérgenos│  app/comandera→ camarero en sala              │
│  · productos, modificadores │  app/kds      → cocina (alias → /cocina)      │
│  · proveedores, empleados   │  app/pantalla → display de cliente (CDS)      │
│  · ajustes, informes        │  app/kiosko   → autopedido                    │
│                             │  app/almacen  → recepción/recuento (operativa)│
│  Siempre online · remoto    │  Offline-first · pantalla completa · local    │
└──────────────┬──────────────┴─────────────────┬─────────────────────────────┘
               │ web / PWA                       │ envoltorios nativos
               ▼                                 ▼
        Navegador, móvil           ┌─────────────┬──────────────┬─────────────┐
        portátil (sin instalar)    │  Tauri 2.0  │   Expo       │  PWA kiosco │
                                   │  TPV caja   │  comandera   │  KDS · CDS  │
                                   │  + hardware │  BT/NFC      │  · almacén  │
                                   └─────────────┴──────────────┴─────────────┘
```

### 1.1 Plataforma por rol de dispositivo

| Rol | Hardware | Plataforma | Ruta / paquete |
|---|---|---|---|
| **TPV mostrador (caja)** | Impresora ESC/POS, cajón, datáfono, cajón inteligente | **Tauri 2.0** (Win/mini‑PC) | `apps/desktop` envuelve `app/tpv` |
| **Comandera (camarero)** | Impresora BT opcional, NFC | **PWA tablet** · Expo si BT/NFC serio | `app/comandera` · `apps/mobile` |
| **KDS cocina** | Solo pantalla + bump bar | **PWA kiosco** + realtime | `app/cocina` (`/kds`→redirect) |
| **Display cliente (CDS)** | Solo pantalla (2º monitor) | **PWA kiosco** read‑only | `app/pantalla` |
| **Kiosko autopedido** | Impresora ticket, a veces datáfono | **PWA o Tauri** según imprime/cobra | `app/kiosko` |
| **App almacén** | Tablet + lector códigos | **PWA kiosco** offline | `app/almacen` (a construir) |
| **Backoffice** | Ninguno | **Web / PWA** | `app/(panel)` |

**Por qué este reparto.** Tauri sólo donde el hardware de caja es innegociable y debe funcionar sin
red (binario ~10 MB vs ~150 MB de Electron, ~10× menos RAM en mini‑PC barato, núcleo Rust con acceso
USB/serie/red). PWA en kiosco para todo lo que sólo muestra o no toca puerto serie. Expo sólo cuando
el móvil nativo aporta algo que la PWA no puede (Bluetooth/NFC robusto). La **app de almacén** valida
el mismo patrón: operación táctil offline, separada del configurador (ver
[`../09-referencia-configurador-agora/compras-stocks/app-almacen.md`](../09-referencia-configurador-agora/compras-stocks/app-almacen.md)).

### 1.2 El patrón Ágora: el local opera, no se configura

La app del mostrador es **operación pura** — carta, mesas, comanda, cobrar, abrir caja, imprimir, y
**nada más**. Ni ajustes, ni alta de productos, ni precios. Eso vive en `app/(panel)` (modo A) y
**baja sincronizado**. Razones, no estética:

- **Velocidad y cero errores** — menos botones = comanda más rápida; un camarero no rompe la
  configuración "sin querer".
- **Seguridad por rol** — el terminal del local **ni siquiera monta** el panel de ajustes; lo que no
  está en pantalla no se puede tocar (RBAC respaldado en RLS, §7).
- **Un sitio para configurar, muchos para operar** — defines la carta una vez en la web y la usan
  todos los TPV de todos los locales. Cero "configuración local" que se desincronice.

> Lo que cambias "desde casa" (un precio, un alérgeno) **aparece solo** en los TPV del local en
> cuanto haya red: misma base de datos, misma lógica (`@gluuh/core`).

---

## 2. Datos y sincronización — offline-first

En hostelería, caerse en hora punta = perder dinero. Por eso la **verdad operativa** de cada
dispositivo es su **SQLite local**, no la nube; la nube es la **verdad canónica**.

```
   ┌──────────────────── DISPOSITIVO (offline-first) ───────────────────┐
   │                                                                    │
   │  UI React ──lee/escribe──► SQLite local ◄──sync──► PowerSync       │
   │  (instantáneo, sin red)    (verdad operativa)       (cliente)      │
   │                                  │                                 │
   │                          cola de escritura                         │
   │                          idempotente (uuid cliente)                │
   └──────────────────────────────────┼─────────────────────────────────┘
                                       │  (cuando hay red / por LAN)
                                       ▼
   ┌──────── SERVIDOR LAN edge (opcional, locales grandes) ─────────────┐
   │  PowerSync/Postgres local · namespace tiempo real · cola comandas  │
   │  → comandera→KDS por Ethernet aunque caiga la fibra                │
   └──────────────────────────────────┼─────────────────────────────────┘
                                       │  (al recuperar internet)
                                       ▼
   ┌──────────────────── NUBE (verdad canónica) ───────────────────────┐
   │  PowerSync Service ─► API NestJS (write path) ─► PostgreSQL/       │
   │  buckets tenant+location  valida RBAC·fiscal·numeración  Supabase  │
   └────────────────────────────────────────────────────────────────────┘
```

### 2.1 Reglas del diseño

1. **La UI nunca espera a la red.** Leer/escribir es local (SQLite); latencia percibida cero.
2. **PowerSync sincroniza en ambos sentidos** por *buckets* segmentados por `tenant_id` +
   `location_id`. Cada dispositivo descarga **sólo** sus datos (menos peso, aislamiento real).
3. **Toda escritura sincronizada pasa por NestJS** (`/sync/upload`): autorización por tenant, lógica
   fiscal y **numeración legal VERIFACTU**. Nada "sucio" entra en Postgres.
4. **Cola de escritura idempotente.** Sin red, las mutaciones se acumulan en SQLite y se reenvían con
   *backoff* exponencial; cada una lleva un **`uuid` generado en cliente** (`client_id`) para que un
   reenvío tras reconexión **no cobre ni numere dos veces**.

```ts
// packages/sync — cola de escritura (esquema conceptual)
type MutacionPendiente = {
  id: string;            // uuid cliente → idempotencia
  tenantId: string;
  tabla: "orders" | "order_items" | "payments";
  op: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  creadoEn: number;
  intentos: number;
};

async function procesarCola(cola: MutacionPendiente[]): Promise<void> {
  for (const m of cola) {
    try {
      await api.sync.upload(m);          // valida RBAC + fiscal en NestJS
      await marcarConfirmada(m.id);
    } catch {
      // backoff: 1s, 2s, 4s… máx 5 min; nunca se pierde
      await reintentarMasTarde(m, Math.min(2 ** m.intentos * 1000, 300_000));
    }
  }
}
```

### 2.2 Servidor LAN edge (opcional, recomendado en locales grandes)

Un mini‑PC/NAS en la LAN hospeda una instancia de PowerSync/Postgres local + el namespace de tiempo
real. Así, **aunque caiga la fibra**, los dispositivos siguen sincronizando entre sí por Ethernet/WiFi
(la comanda llega del móvil al KDS sin internet). La nube sigue siendo la verdad canónica; el servidor
LAN es un *edge cache* coherente que sube al reconectar.

### 2.3 Tiempo real (dos capas, separar responsabilidades)

| Capa | Qué transporta | Naturaleza | Estado |
|---|---|---|---|
| **Datos durables** — Supabase Realtime (hoy) → PowerSync (objetivo) | comanda, `order_line`, estados, 86 | sobrevive a reinicio, replica a SQLite | ✅ canales `cocina`/`pantalla` sobre `sales_order` |
| **Eventos efímeros** — Socket.IO en LAN | campana "nueva comanda", "mesa lista", bump | aviso, no se persiste | ⬜ objetivo (sin `@WebSocketGateway` aún) |

> **Regla mental:** si necesita sobrevivir a un reinicio, va por la capa de datos. Si es un "¡oye,
> mira!" desechable, va por Socket.IO. El KDS **nunca depende** de la campana para tener el dato: el
> pedido llega por la capa durable; el evento sólo añade el aviso (ver
> [`../05-cocina-kds-y-comanderas/` §7](../05-cocina-kds-y-comanderas/)).

```
   Comandera ──(datos durables)──► PowerSync/Supabase ──replica──► KDS /cocina
        │                                                            │
        └──(efímero, objetivo)──► Socket.IO LAN ──"nueva"──────────► campana/sonido
                                                ──"listo"──► /pantalla · comandera
   ── todo sobre LAN del local: funciona aunque caiga internet ──
```

**Dos máquinas de estado ortogonales** conviven en cada `sales_order`, ambas validadas en
`@gluuh/core` (no confundir):

```
EstadoComanda (sala):   ABIERTA → ENVIADA_COCINA → SERVIDA → POR_COBRAR → COBRADA
                                                                     └→ ABIERTA (reabrir)
                              └───────────────────────────────────────→ ANULADA
EstadoPreparacion (KDS): PENDIENTE → EN_PREPARACION → LISTO → ENTREGADO
```

Un pedido entra al KDS cuando su `EstadoComanda` pasa a `ENVIADA_COCINA` y dentro avanza por
`EstadoPreparacion` (lineal, vía `PREPARACION_SIGUIENTE`). Marcar `LISTO`/`ENTREGADO` en cocina **no**
muta el estado de sala (separación cocina/sala). *Deuda priorizada:* estado por `order_line` + campo
`pase` para pases reales y 86 parcial.

---

## 3. Motor fiscal — `@gluuh/core` en el dispositivo

«Cobrar offline» en España no es sólo guardar el cobro: hay que **emitir el ticket fiscal en el
momento**, con su QR y huella. VERIFACTU está diseñado para esto y el motor vive en `@gluuh/core`,
que **corre en el propio dispositivo** (no necesita la nube).

```
COBRO OFFLINE
  cobrar ─► @gluuh/core (EN EL DISPOSITIVO):
              · nº de serie POR TERMINAL  (TPV1-2026-…)
              · huella SHA-256 encadenada (determinista, vector AEAT)
              · construirUrlQR() → QR de cotejo AEAT
        ─► imprime ticket YA con QR  (cliente servido al instante)
        ─► encola registro VERIFACTU + cobro en SQLite
  ── (vuelve internet) ──►
        ─► API NestJS: valida orden de la cadena, persiste en Postgres
        ─► remite el lote a la AEAT por mTLS (certificado en el backend)
```

### 3.1 Reglas innegociables

1. **Huella en local, determinista.** El registro encadena SHA‑256 con el anterior; el TPV lo genera
   sin red (mismo algoritmo que valida el **vector oficial AEAT** en
   `packages/core/src/fiscal/verifactu.test.ts` — innegociable). El QR sale impreso al instante.
2. **Envío a la AEAT diferido.** VERIFACTU no exige enviar en el segundo: el registro se **encola** y
   NestJS lo remite al recuperar conexión. El cliente ya tiene su ticket válido; Hacienda recibe el
   lote después.
3. **Serie por terminal = cadena sin huecos.** Cada terminal usa su propia serie, así dos TPV
   offline nunca pelean por el mismo número y la cadena de cada serie queda íntegra; el backend valida
   el orden al subir.
4. **El certificado mTLS nunca toca el cliente.** Lo gestiona `apps/api` (cliente AEAT); en la BD
   sólo una referencia segura (`verifactu_config.certificado_ref`), nunca el `.p12` en claro.
5. **Impuesto incluido en carta.** `calcularImpuestosIncluidos` desglosa la base "hacia atrás"; el %
   por producto se resuelve por clase fiscal × territorio (`ivaAuto` ↔ tabla `tax_rate`/`resolver_iva()`,
   deben coincidir). IGIC en Canarias, IVA en península, IPSI en Ceuta/Melilla.

> Regla: **lo que el cliente necesita (ticket + QR) se resuelve en local al instante; lo que necesita
> Hacienda (recepción del registro) se sincroniza después.** Nunca se bloquea un cobro por falta de red.

### 3.2 Visor VERIFACTU (backoffice)

Ya existe motor + visor básico (commit `097da8b`). El visor lista facturas (Fecha · Número · Estado ·
CSV · Base · Cuota · Total · **Cadena Correcta** ✅/❌) con export XML AEAT. *Falta:* panel de salud de
la cadena (huecos, encolados offline, enviados/rechazados, reintentos) y reverificación bajo demanda
— ver [`../09-referencia-configurador-agora/herramientas/verifactu.md`](../09-referencia-configurador-agora/herramientas/verifactu.md).

---

## 4. Hardware — agente local fuera del navegador

Por seguridad, el JS de un navegador **no abre puertos USB/serie**. Toda interacción con periféricos
pasa por un **agente local** (núcleo Rust de Tauri, sidecar, o servicio LAN) con **abstracciones por
tipo de dispositivo** — nunca el dominio hablando bytes.

```
   DOMINIO (web/app)                 AGENTE LOCAL (Tauri/Rust · LAN)        HARDWARE
   ─────────────────                 ───────────────────────────────       ────────
   construye PrintJob   ──invoke──►  Printer  (renderer ESC/POS)  ──9100──► impresora térmica
   declarativo                       └─ pulso ESC p ─────────────────────► cajón portamonedas
   solicita cobro       ──────────►  PaymentGateway (sidecar SDK) ──2244──► datáfono / pasarela
   pide arqueo          ──────────►  CashDevice (drivers por marca)──────► cajón inteligente
   lee peso             ──────────►  Scale (HID/serie)            ──────► balanza
```

### 4.1 Abstracciones (espejo del contrato `Printer` ya existente)

`packages/hardware` ya define `PrintJob`/`Printer`; se replica el patrón para el resto:

| Abstracción | Drivers / protocolo | Transporte | Estado |
|---|---|---|---|
| **`Printer`** | ESC/POS (Epson/Star/Sunmi) | RAW :9100 LAN · ePOS · CloudPRNT · BT Sunmi · agente QZ | ✅ contrato / 🔴 impl. |
| **`CashDevice`** | Cashlogy, CashDro, CashKeeper, CashGuard | web service · ficheros · socket | 🔴 falta |
| **`PaymentGateway`** | Redsys/Stripe/AgoraPay, Tap to Pay | socket puerto escucha (2244) | 🔴 falta |
| **`Scale`** | balanza HID/serie | HID · serie | 🔴 falta |

**Decisión:** abstracción común por familia (como `Printer`) con drivers por marca, para no acoplar la
app a un fabricante. **Modo degradado** siempre: si el cajón inteligente cae, seguir cobrando efectivo
manual (offline‑first). Idempotencia/reintentos en cobro para no cobrar dos veces tras corte de red.
Detalle en [`../09-referencia-configurador-agora/herramientas/control-efectivo.md`](../09-referencia-configurador-agora/herramientas/control-efectivo.md)
y [`pasarela-cobro-mesa.md`](../09-referencia-configurador-agora/herramientas/pasarela-cobro-mesa.md).

### 4.2 Transporte de impresión (camino crítico)

```
   Camarero ENVÍA comanda ─► división por ESTACIÓN (order_line.estacion)
        ┌───────────┬───────────┬───────────┐
        ▼           ▼           ▼
      BARRA      PARRILLA    POSTRES
   impr 9100     KDS         KDS + impr (respaldo)
```

- **Camino crítico (comanda a cocina, ticket de cobro): RAW :9100 en LAN** desde NestJS o el TPV
  Tauri → **funciona sin internet**.
- **CloudPRNT** (Star, polling impresora→nube) sólo para **delivery/pedidos online**.
- **ePOS‑Print** (Epson) y **QZ Tray** como comodín para web POS y parques heterogéneos.
- **Bluetooth/USB Sunmi** en la comandera en mano.
- **Tres nombres por producto**: `nombre_carta` (pantalla, obligatorio) · `nombre_ticket` (cliente) ·
  `nombre_cocina` (comanda, MAYÚSCULAS) con fallback centralizado (función SQL + espejo TS).
- **Code page PC858** (acentos ES + €); el QR codifica `construirUrlQR()` con ECC nivel **M**.
- **Cola persistente por impresora** + reintentos con backoff + aviso en UI; idempotencia por `id` de
  trabajo. Si la cocina está offline, los tickets se acumulan y se vacían al recuperar — sin perder
  comandas. Detalle en [`../04-impresion-y-tickets/`](../04-impresion-y-tickets/).

---

## 5. Configuración — modelo `setting` por ámbito con herencia

En vez de una columna/flag por cada opción, la configuración es un **modelo `setting` con tres
ámbitos** y herencia: lo más específico gana, con *fallback* hacia arriba.

```
   GLOBAL (tenant)          ej. moneda, idioma por defecto, política de propinas
      │  hereda ▼
   LOCAL (location)         ej. dirección fiscal, horario, IGIC vs IVA del territorio
      │  hereda ▼
   DEVICE (terminal)        ej. impresora asignada, serie VERIFACTU, cajón inteligente
      │
      ▼  resolución: DEVICE → LOCAL → GLOBAL → default
   valor efectivo en el dispositivo
```

```sql
create table setting (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ambito    text not null,            -- GLOBAL | LOCAL | DEVICE
  ambito_id uuid,                     -- location_id o device_id según ámbito (null en GLOBAL)
  clave     text not null,            -- 'impuesto.territorio', 'impresora.id', 'verifactu.serie'…
  valor     jsonb not null,
  unique (tenant_id, ambito, ambito_id, clave)
);
-- resolución por herencia: DEVICE pisa LOCAL pisa GLOBAL pisa default
```

**Por qué:** dar de alta un local o terminal nuevo no requiere migraciones ni código; se escriben
*settings*. La asignación de impresora por estación, serie por terminal, cajón inteligente
(`device.control_efectivo`) y datáfono asignado al TPV (`gateway_terminal_map`) son todas *settings*
de ámbito `DEVICE`/`LOCAL` que **bajan sincronizadas** al dispositivo. Esto materializa "un sitio para
configurar, muchos para operar" (§1.2).

---

## 6. Informes — RPC/vistas en Supabase, agregación server-side

Cada informe es una **vista SQL o función RPC en Postgres** con RLS por `tenant_id` y parámetros
(rango de fechas, centro, usuario, familia). **Nunca** traer 50k filas al navegador: se agrega en el
servidor y baja el resultado.

```
   app/(panel)/informes/<x>      Supabase (Postgres)
   ┌────────────────────┐        ┌──────────────────────────────┐
   │ ReportPage         │        │ rpt_<informe>(params)         │
   │  · DateRangePicker │──RPC──►│  RLS: current_tenant_id()     │
   │  · DataTable       │        │  agrega: SUM/COUNT/GROUP BY    │
   │  · ExportButton    │◀──────│  índices (tenant_id, fecha)    │
   │  KPIs · tabla · gráf│        │  históricos: vistas material. │
   └────────────────────┘        └──────────────────────────────┘
```

```sql
-- patrón: una función por informe
create function rpt_ventas_por_centro(p_desde date, p_hasta date)
returns table(centro text, tickets int, base numeric, impuestos numeric, total numeric)
language sql security definer as $$
  select c.nombre, count(*), sum(o.base), sum(o.impuestos), sum(o.total)
  from sales_order o join sales_center c on c.id = o.sales_center_id
  where o.tenant_id = current_tenant_id()           -- RLS
    and o.fecha between p_desde and p_hasta
  group by c.nombre order by total desc;
$$;
```

**Decisiones:** componentes compartidos (`ReportPage`, `DataTable`, `DateRangePicker`, `ExportButton`)
→ un informe nuevo = una query + config de columnas, no una página desde cero. Export PDF/Excel/CSV
*server‑side*. **Coherencia fiscal**: Resumen Fiscal, Diario de Facturas y Documento 347 deben cuadrar
con VERIFACTU (`@gluuh/core`) y con las series. Dashboard del día en vivo (Realtime); históricos bajo
demanda con caché y vistas materializadas refrescadas en el cierre. Base ya hecha: 11 informes reales
— ver [`../09-referencia-configurador-agora/informes/`](../09-referencia-configurador-agora/informes/).

---

## 7. Multi-tenant, RLS y seguridad

Modelo: **shared schema + `tenant_id` + RLS**. El aislamiento vive **en la base, no en el cliente**.

```
   TENANT (grupo / cadena)
     └── LOCATION (local físico) ← location_id
           ├── 🖥️ TPV mostrador (Tauri)   ─┐
           ├── 📱 Comandera (PWA/Expo)      ├─ bucket PowerSync = tenant_id + location_id
           ├── 👨‍🍳 KDS (PWA kiosco)          │  → cada dispositivo sincroniza SOLO su local
           └── 🪧 Display cliente (PWA)    ─┘
```

### 7.1 Capas de seguridad

```
   ┌─ Identidad ──────────────────────────────────────────────────────┐
   │ Supabase Auth (sesión por dispositivo)                            │
   │   JWT porta tenant_id + location_id                               │
   └────────────────────────────┬──────────────────────────────────────┘
   ┌─ Autorización en el local ──▼─────────────────────────────────────┐
   │ PIN por superficie (validar_pin RPC): camarero/cajero por turno   │
   │   → identifica al EMPLEADO sin re-login; el rol decide qué ve      │
   └────────────────────────────┬──────────────────────────────────────┘
   ┌─ RBAC respaldado en RLS ────▼─────────────────────────────────────┐
   │ SET app.tenant_id ← JWT; RLS filtra en Postgres                   │
   │   sin contexto → CERO filas (seguro por defecto)                  │
   │   write-path NestJS revalida rol + fiscal: la UI no es la frontera│
   └───────────────────────────────────────────────────────────────────┘
```

- **`tenant_id` en el JWT**, fijado como variable de sesión (`SET app.tenant_id`); RLS por
  `current_tenant_id()` filtra cada query. Sin contexto, cero filas.
- **PIN por superficie** (RPC `validar_pin`): en el local, un terminal compartido identifica al
  empleado del turno sin cerrar sesión. El rol determina qué superficie y acciones (anular, descuento)
  ve — y el panel de ajustes **ni se monta** en el terminal de operación.
- **RBAC respaldado en RLS**: la UI esconde botones, pero la frontera real es la base + el write‑path
  NestJS, que **revalida** rol, fiscalidad y numeración. Nada confía en el cliente.
- **Buckets segmentados** por `tenant_id` + `location_id`: una tablet de un local nunca descarga datos
  de otro local ni tenant. Alta de un local nuevo = instalar la app + login con JWT que ya porta el
  ámbito; cero pasos especiales.
- **Secretos fuera del repo y del cliente**: certificado mTLS AEAT, claves de pasarela y service‑role
  de Supabase sólo en `apps/api`/agente. `.env*` en `.gitignore`; sólo se versiona `.env.example`.

---

## 8. Despliegue y entornos

```
   ┌─ Web / config (modo A) ───────────────────────────────────────────┐
   │ apps/web → Vercel / EAS Hosting   ·  PWA: manifest + service worker│
   │ deploy instantáneo · auto-update por service worker               │
   └────────────────────────────────────────────────────────────────────┘
   ┌─ Apps operativas (modo B) ────────────────────────────────────────┐
   │ Tauri 2.0  → instalador .msi firmado · auto-update firmado (caja) │
   │ Expo       → EAS Build / OTA (comandera nativa BT/NFC)            │
   │ PWA kiosco → Android Screen Pinning / Win Assigned Access (KDS…)  │
   └────────────────────────────────────────────────────────────────────┘
   ┌─ Backend ─────────────────────────────────────────────────────────┐
   │ apps/api (NestJS) → host con mTLS hacia AEAT                       │
   │ Supabase (Postgres + Auth + Realtime + RLS) → verdad canónica     │
   │ PowerSync Service → buckets por tenant+location                   │
   │ Servidor LAN edge (opcional) → mini-PC/NAS en el local            │
   └────────────────────────────────────────────────────────────────────┘
```

| Componente | Despliegue | Actualización |
|---|---|---|
| `apps/web` (panel + operativa) | Vercel / EAS Hosting | instantánea (deploy) + SW |
| `apps/desktop` (Tauri) | instalador `.msi`/`.dmg` ligero | auto‑update firmado |
| `apps/mobile` (Expo) | EAS Build → APK/TestFlight | EAS OTA |
| `apps/api` (NestJS) | host con certificado AEAT (mTLS) | CI/CD |
| Supabase + PowerSync | gestionados | migraciones `supabase/migrations/*.sql` |
| Servidor LAN edge | mini‑PC/NAS en el local | imagen mantenida |

**Entornos:** `PRUEBAS` y `PRODUCCION` claramente separados (con aviso visual) sobre todo en VERIFACTU
(`verifactu_config.entorno`). Migraciones de BD: lo canónico son `supabase/migrations/*.sql`;
`apps/api/db/schema.sql` se mantiene como **espejo** de referencia.

---

## 9. Decisiones clave

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Una base React (`apps/web`)** sirve config + operativa; Tauri/Expo sólo envuelven | cero duplicación de UI ni lógica fiscal; alta de local trivial |
| 2 | **Tauri 2.0** (no Electron) para el TPV de caja | ~10 MB vs ~150 MB, ~10× menos RAM en mini‑PC, núcleo Rust para periféricos |
| 3 | **Offline-first**: SQLite local + PowerSync; la nube es canónica | no caerse en hora punta; UI sin esperar a la red |
| 4 | **Toda escritura validada por NestJS** (`/sync/upload`) | RBAC + fiscal + numeración; nada "sucio" en Postgres |
| 5 | **`@gluuh/core` en el dispositivo**: huella + QR offline, serie por terminal | ticket fiscal legal al instante sin red; AEAT diferido |
| 6 | **Agente local** con abstracciones (`Printer`/`CashDevice`/`PaymentGateway`/`Scale`) | el navegador no abre puertos; no acoplar a fabricante |
| 7 | **Camino crítico de impresión por RAW :9100 LAN** | funciona sin internet; CloudPRNT sólo delivery |
| 8 | **Config por `setting` GLOBAL/LOCAL/DEVICE** con herencia | sin flags ni migraciones por opción; baja sincronizado |
| 9 | **Informes = RPC/vistas en Supabase** (server‑side) | nunca 50k filas al cliente; fiscal cuadrado con VERIFACTU |
| 10 | **RLS por `tenant_id` + PIN por superficie + RBAC** | aislamiento en la base, no en el cliente |
| 11 | **Tiempo real en dos capas**: datos durables (PowerSync) vs efímeros (Socket.IO) | el KDS no depende de la campana; el dato sobrevive a reinicios |

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Huecos en la cadena VERIFACTU** (offline + multi‑TPV) | rechazo AEAT, sanción | **serie por terminal**; NestJS valida orden al subir; panel de salud de la cadena |
| **Doble cobro/numeración** tras reconexión | fiscal y contable | **idempotencia por `client_id`**; UPSERT por ese id; dedup en backend |
| **Pérdida de eventos efímeros** (campana) | UX, no datos | el dato llega por la capa durable; al reconectar **rehidratar desde la BD**, no fiar de eventos |
| **Caída de fibra en hora punta** | parón total | **LAN edge**: comandera→KDS→impresora por Ethernet; sync diferido |
| **`packages/hardware`/`apps/api`/`sync` en esqueleto** | gran parte del offline/hardware no existe aún | priorizar en fases (ver [`plan-por-fases.md`](plan-por-fases.md)); contratos ya definidos |
| **Acoplamiento a un fabricante** (cajón, datáfono, impresora) | bloqueo, coste de cambio | abstracciones por familia con drivers; modo degradado |
| **Secretos en cliente** (mTLS, claves pasarela) | brecha legal/seguridad | sólo en `apps/api`/agente; en BD sólo referencias; `.env` en `.gitignore` |
| **Code page mal puesto** en tickets (acentos) | tickets ilegibles | **PC858** fijo + codificación previa (no UTF‑8) |
| **Tormenta de refrescos** en KDS (re‑consulta total) | rendimiento en rush | aplicar **delta** del evento Realtime; debounce en picos |
| **Estados imposibles** de comanda/cocina | datos corruptos | validar SIEMPRE con `puedeTransicionar()`/`PREPARACION_SIGUIENTE` en el write‑path |
| **Relojes desincronizados** entre dispositivos | SLA/cronómetros falsos | SLA sobre `created_at` del servidor, no del reloj local |

---

*Documento de implementación · Arquitectura técnica unificada. Relacionados:*
*[`README.md`](README.md) · [`modelo-de-datos.md`](modelo-de-datos.md) · [`plan-por-fases.md`](plan-por-fases.md) ·*
*[`../01-arquitectura-y-plataforma/`](../01-arquitectura-y-plataforma/) ·*
*[`../04-impresion-y-tickets/`](../04-impresion-y-tickets/) ·*
*[`../05-cocina-kds-y-comanderas/`](../05-cocina-kds-y-comanderas/) ·*
*[`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/).*
