# 06 — Fiscalidad, plataforma, informes y negocio

> Cómo Gluuh supera a Ágora en el **núcleo serio** del producto: cumplimiento fiscal
> (**VERIFACTU + IGIC**) integrado en el cobro, plataforma **offline‑first con acceso
> remoto de serie**, informes que **dicen qué hacer** (no solo qué pasó) y un **modelo de
> negocio SaaS** sin licencia atada a la máquina. Destila las fichas de
> [`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/):
> [impuestos](../09-referencia-configurador-agora/administracion/impuestos.md) ·
> [series](../09-referencia-configurador-agora/administracion/series.md) ·
> [empresa](../09-referencia-configurador-agora/administracion/empresa.md) ·
> [verifactu](../09-referencia-configurador-agora/herramientas/verifactu.md) ·
> [copias-seguridad](../09-referencia-configurador-agora/herramientas/copias-seguridad.md) ·
> [formación](../09-referencia-configurador-agora/herramientas/formacion.md) ·
> [mantenimiento](../09-referencia-configurador-agora/herramientas/mantenimiento.md) ·
> [informes](../09-referencia-configurador-agora/informes/) ·
> [licencia y módulos](../09-referencia-configurador-agora/licencia-y-modulos.md). La base de
> plataforma está en [01 — Arquitectura](../01-arquitectura-y-plataforma/).

**Patrón de cada bloque:** *Para qué sirve · Cómo lo hace Ágora · Cómo lo mejoramos · Prioridad.*

---

## Por qué este documento importa más que los otros

Una carta bonita o un KDS rápido no te llevan a juicio. **La fiscalidad sí.** VERIFACTU es
obligatorio en España, y un TPV que rompa la cadena de huellas, numere con huecos o permita
borrar registros fiscales **no es un fallo de UX: es un incumplimiento sancionable**. Aquí se
nota la ventaja de nacer en la nube: lo que Ágora resuelve con add‑ons de pago y BD local
(My Ágora Premium, copias manuales, licencia por máquina), nosotros lo damos **de serie**. Y
la regla que atraviesa todo: **el cumplimiento no se "configura aparte", se integra en el
cobro** — el camarero pulsa "Cobrar" y el ticket sale con su QR y su huella; no hay un paso
fiscal que alguien pueda olvidar.

---

# A. FISCALIDAD

## A1. Impuestos territorio‑conscientes (IVA / IGIC / IPSI)

**Para qué sirve.** Aplicar el % de impuesto **correcto** a cada producto según el tipo de
gravamen (general, reducido, superreducido, exento) y el **territorio** del negocio
(península→IVA, Canarias→IGIC, Ceuta/Melilla→IPSI). Es la base de que el ticket, la factura
y el registro VERIFACTU cuadren con Hacienda.

**Cómo lo hace Ágora.** Una **tabla de hasta 10 tipos** por instalación (`Nombre · Valor % ·
Recargo equivalencia % · Tipo · Habilitado`), editada **a mano**. El campo "Tipo" es un
desplegable genérico (`IVA`); en Canarias el instalador tendría que reescribir todos los
valores a IGIC manualmente. Nada impide poner 21 % en un local canario por error.

**Cómo lo mejoramos.** El % **no se edita por local**: se resuelve por
**clase fiscal × territorio**, y el territorio es un dato del tenant
([empresa](../09-referencia-configurador-agora/administracion/empresa.md)).

```
Producto.clase_fiscal (GENERAL|REDUCIDO|SUPERREDUCIDO|EXENTO)
        × Tenant.territorio (PENINSULA|CANARIAS|CEUTA_MELILLA|FORAL)
        → @gluuh/core ivaAuto  /  SQL resolver_iva()  → % aplicado
```

| Clase | Península (IVA) | Canarias (IGIC) | Ceuta/Melilla (IPSI) |
|-------|----------------:|----------------:|---------------------:|
| General       | 21 % | 7 % | ~10 % |
| Reducido      | 10 % | 3 % | … |
| Superreducido |  4 % | 0 % | … |
| Exento        |  0 % | 0 % | 0 % |

- **Eliges territorio una vez** (en la ficha de empresa) y todos los tipos se aplican solos:
  imposible facturar IVA peninsular en un negocio canario.
- **IGIC e IPSI nativos**, no un "IVA genérico" reetiquetado. Es nuestro mercado objetivo
  (Canarias).
- **Recargo de equivalencia** ligado al cliente y calculado por `@gluuh/core`, no una columna
  suelta que alguien tiene que recordar marcar.
- **Validación de coherencia:** si la provincia es canaria y el territorio dice "península",
  el sistema avisa. Si alguien edita un % y se desvía del oficial del territorio, lo señala.
- Los precios de carta llevan **impuesto incluido**; `calcularImpuestosIncluidos` desglosa la
  base "hacia atrás". Los valores **deben coincidir** con `TIPOS_POR_TERRITORIO` de
  `@gluuh/core` y el seed SQL `resolver_iva()` — y los valida el **vector oficial AEAT**
  (`CLAUDE.md`, innegociable).

**Prioridad: 🔴 Crítica.** Ya existe parcialmente en `@gluuh/core` (`tax-rates.ts`, `ivaAuto`)
y la tabla `tax_rate`. Falta cerrar la UI de empresa que propaga el territorio.

---

## A2. Series de numeración: por terminal, para cobro offline sin huecos

**Para qué sirve.** Cada documento fiscal (ticket, factura, devolución…) lleva una
**numeración legal correlativa y sin huecos**. Es la base de la trazabilidad y el ancla de la
cadena VERIFACTU `(serie, número)`.

**Cómo lo hace Ágora.** Tabla maestra de series por **tipo de documento × origen**
(`T` ticket, `F` factura, `TD` devolución de ticket…; sufijo `W` para administración web,
`C` para proveedor). Un contador `Siguiente Nº` por serie que crece eternamente (el `T` del
local de ejemplo va por **195.580**). **No hay serie por terminal**: para no romper la
numeración con varios TPV a la vez, Ágora **obliga a estar online**.

**Cómo lo mejoramos.** Mantenemos serie por tipo × origen, y añadimos lo que falta para el
offline real:

- **Serie por terminal** (`device_id`): cada TPV cobra **offline** con su propia serie
  (`TPV1‑2026‑…`), así dos terminales nunca pelean por el mismo número y **cada cadena
  VERIFACTU queda íntegra** ([01 §4 — ticaje sin internet](../01-arquitectura-y-plataforma/)).
- **Contador atómico en el backend** (función Postgres en `apps/api`), **nunca** desde el
  cliente. El terminal offline pre‑reserva su rango por dispositivo.
- **Reinicio anual asistido:** al cambiar de ejercicio sugiere serie nueva (`T2026`) en vez
  de un contador eterno.
- **Bloqueo de borrado** de series con documentos emitidos (`en_uso = true`): Ágora deja el
  botón Eliminar sin distinguir.

```sql
create table document_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  device_id uuid,                 -- null = compartida del local; set = por terminal (offline)
  nombre text not null,           -- 'T', 'F', 'TW', 'PC'...
  tipo text not null,             -- FRA_SIMP|FACTURA|DEV_SIMP|DEVOLUCION|ALBARAN|PEDIDO|...
  origen text not null,           -- TPV|WEB|COMPRAS
  ejercicio int not null,
  siguiente_num bigint not null default 1,
  en_uso boolean not null default false,
  unique (tenant_id, location_id, nombre, ejercicio)
);
```

**Prioridad: 🔴 Crítica.** Habilita el cobro offline legal; sin esto, el offline rompe la
cadena.

---

## A3. VERIFACTU: panel de salud de cadena, reverificación, pruebas vs producción

**Para qué sirve.** Garantizar que **ningún registro fiscal se ha alterado ni falta**: cada
factura encadena su huella SHA‑256 con la anterior. Si la cadena se rompe, Hacienda lo
detecta. Es nuestro **diferenciador** y ya existe parcialmente (motor en `@gluuh/core` + Visor
Verifactu en `apps/web`, commit `097da8b`).

**Cómo lo hace Ágora.** Configuración del emisor (Nombre fiscal, CIF, **certificado mTLS**,
fecha de activación) y un **visor de facturas** con columnas `Fecha · Número · Estado · CSV ·
Base · Cuota · Total · Cadena Correcta` + exportar XML. Distingue entorno Producción/Pruebas.

**Cómo lo mejoramos.** Tomamos el visor como base y añadimos lo que falta para operar offline
con confianza:

- **Panel de salud de la cadena:** huecos detectados, registros **encolados offline**,
  enviados/aceptados/rechazados por la AEAT, reintentos pendientes. De un vistazo sabes si tu
  cadena está sana.
- **Reverificación bajo demanda:** recalcular todas las huellas y compararlas con las
  almacenadas (auditoría interna), no solo confiar en una columna.
- **Entorno Pruebas vs Producción** claramente separado, con **aviso visual** permanente para
  no confundir un envío de prueba con uno real.
- **Integración con cobro offline:** la cadena se calcula en el dispositivo con `@gluuh/core`
  (determinista, sin red), el ticket sale con QR al instante y el envío a la AEAT se **difiere**
  hasta recuperar conexión — sin huecos gracias a la serie por terminal (A2).
- **Certificado mTLS** lo gestiona `apps/api`; **nunca** viaja al cliente. Se guarda una
  referencia segura, no el `.p12` en claro.

```sql
create table verifactu_config (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre_fiscal text, nif text, activado_en date,
  entorno text default 'PRODUCCION',   -- PRUEBAS | PRODUCCION
  certificado_ref text                 -- referencia segura, no el .p12
);
```

**Prioridad: 🔴 Crítica.** ✅ motor + visor básico hechos · 🟡 falta panel de salud, envío
diferido y reverificación.

## A4. Declaración responsable VERIFACTU

**Para qué sirve.** Documento legal que el **fabricante del software** debe ofrecer,
declarando que su sistema cumple el reglamento. Ágora lo enlaza desde "Acerca de".

**Cómo lo mejoramos.** Generamos nuestra **declaración responsable** y la enlazamos desde la
pantalla "Acerca de" propia (ver D2), junto al **estado de cumplimiento** del tenant. No es
opcional: es requisito para vender el software legalmente.

**Prioridad: 🔴 Crítica** (requisito legal de comercialización).

---

## A5. Modo formación SIN registro fiscal (crítico)

**Para qué sirve.** Que un camarero nuevo practique en el **TPV real** (carta y flujos
verdaderos) **sin contaminar** los datos reales ni la fiscalidad. Sus "ventas" se descartan al
cierre.

**Cómo lo hace Ágora.** Marca usuarios "en formación"; sus ventas se eliminan al cerrar el
punto de venta. Hay un panel de sesiones de formación con un botón "Borrar todas".

**Cómo lo mejoramos.** Lo tratamos como **frontera fiscal dura**, no como un borrado posterior:

- Una venta en formación **NO genera registro VERIFACTU**, **NO consume numeración legal** y
  **NO mueve stock real**. Se marca `formacion=true` y **se excluye del motor fiscal** y de las
  series desde el origen — no se crea y luego se borra, **directamente no entra en la cadena**.
- Esto evita el riesgo más peligroso de Ágora: que una práctica acabe colándose en la cadena
  de huellas y la corrompa.
- **Entorno sandbox opcional** con datos de ejemplo (no la carta real), además del modo "en
  vivo", para onboarding sin tocar nada de producción.
- Tutoriales guiados integrados para formar al personal.

```sql
alter table app_user add column en_formacion boolean default false;
-- order/payment con formacion=true → sin VERIFACTU, sin serie legal, sin stock
```

**Prioridad: 🟠 Alta.** 🔴 hoy no existe; es importante separarlo limpio antes de tener tráfico
real de formación.

---

## A6. NO permitir borrado de registros fiscales (retención legal)

**Para qué sirve.** Con VERIFACTU los registros de facturación tienen **obligación de
conservación** (años) y forman una **cadena de huellas**. Borrar uno la rompe y es ilegal.

**Cómo lo hace Ágora.** Tiene una herramienta **"Eliminar Tickets y Movimientos de Caja"** con
un botón rojo que borra todo lo anterior a una fecha. Peligroso bajo VERIFACTU.

**Cómo lo mejoramos.** **No replicamos esa herramienta tal cual.** Los registros fiscales son
**inmutables y no borrables** por diseño. Como mucho, ofrecemos **archivar/purgar datos
operativos NO fiscales** (borradores, logs, comandas no facturadas) respetando la retención
legal. La corrección de un error fiscal se hace con **devolución/abono** (documento nuevo
encadenado), nunca borrando.

**Prioridad: 🔴 Crítica** (cumplimiento legal — es un *no‑hacer* deliberado).

---

# B. PLATAFORMA Y OPERACIÓN

## B1. Backup cifrado + export RGPD por tenant

**Para qué sirve.** Proteger los datos del negocio y permitir **portabilidad** (que el cliente
se lleve sus datos, derecho RGPD).

**Cómo lo hace Ágora.** Corre con **BD local** (servidor LAN), así que necesita su propio
backup: creación/descarga manual + programación automática (`Nº de copias a mantener`,
`Frecuencia`). Es una tarea más que el cliente debe gestionar.

**Cómo lo mejoramos.** La fuente de verdad es **Supabase (PostgreSQL gestionado con backups
automáticos)**: el backup canónico **viene de serie**, sin que nadie lo configure. Encima
añadimos:

- **Export/backup bajo demanda por tenant**, firmado y a **formato abierto** (portabilidad
  RGPD): el cliente puede llevarse sus datos.
- **Backups cifrados y verificados** (restore de prueba periódico — un backup que no restaura
  no sirve).
- **Retención por niveles** (diaria/semanal/mensual), no solo "guardar N copias".
- Si se despliega **servidor LAN/edge** (offline en locales grandes), su SQLite/Postgres local
  rota copias como hace Ágora.

**Prioridad: 🟡 Media.** Supabase cubre lo canónico; falta el export por tenant y la estrategia
del edge local.

---

## B2. Auditoría con consultas guardadas y alertas

**Para qué sirve.** Registrar **quién hizo qué y dónde**: anulaciones, descuentos, aperturas
de cajón, cambios de configuración. Es la base de seguridad, control de fraude y RGPD.

**Cómo lo hace Ágora.** Pantalla de Auditoría con filtros (Fecha · Usuario · TPV · Consulta) y
**consultas guardables**. Tabla de eventos exportable.

**Cómo lo mejoramos.** Mantenemos el `audit_log` y le añadimos **inteligencia**:

- **Consultas guardadas** (como Ágora) **+ alertas proactivas**: por ejemplo, avisar si un
  usuario supera **N anulaciones/día** o autoriza descuentos por encima de un umbral —
  detección de fraude en vez de tener que ir a buscarlo.
- Cruce con los informes de **Descuentos/Cancelaciones por usuario** (ver C) para cerrar el
  círculo de control.

```sql
create table audit_log (
  id bigserial primary key, tenant_id uuid,
  fecha timestamptz, user_id uuid, tipo text, accion text,
  device_id uuid, aplicacion text, equipo text, detalle jsonb
);
```

**Prioridad: 🟠 Alta.** 🔴 hoy no existe; clave para seguridad y RGPD.

---

## B3. Offline‑first y acceso remoto de serie (el gancho)

**Para qué sirve.** Que el local **nunca se caiga** en hora punta (offline‑first) y que el
dueño **gestione desde casa** por el navegador (acceso remoto).

**Cómo lo hace Ágora.** El acceso remoto/backoffice en la nube es un **add‑on de pago**:
*My Ágora Premium*. La operativa local va sobre BD en LAN.

**Cómo lo mejoramos.** Es el corazón de [01 — Arquitectura](../01-arquitectura-y-plataforma/),
y aquí se vuelve **argumento comercial**:

- **Acceso remoto incluido en base**, no como extra. El dueño entra desde el móvil o el
  portátil de casa, cambia un precio o un alérgeno, y **aparece solo** en los TPV del local en
  cuanto haya red.
- **Offline‑first de serie:** cada dispositivo lee/escribe en su **SQLite local** (PowerSync),
  sigue cobrando y emitiendo VERIFACTU sin internet; el envío a la AEAT se difiere.
- **Una sola base de código React** (`apps/web`) sirve backoffice + TPV + KDS + pantalla
  cliente; **Tauri** envuelve donde hay hardware de caja. Cero duplicación de lógica fiscal
  (siempre en `@gluuh/core`).

**Prioridad: 🔴 Crítica** (es el diferenciador de plataforma y comercial).

---

# C. INFORMES QUE DICEN QUÉ HACER

## C1. De "cuánto vendí" a "qué hacer": Menú Engineering y márgenes

**Para qué sirve.** No basta con saber **cuánto** vendiste; el valor está en saber **qué
potenciar, resituar o quitar** de la carta y **dónde ganas o pierdes margen**.

**Cómo lo hace Ágora.** Trae **~60 informes** (Análisis, Ventas, Catálogo, Usuarios, Caja,
Almacén…), incluido Menú Engineering y márgenes por familia. Potente, pero **disperso y
descriptivo**: te dice qué pasó, no qué hacer.

**Cómo lo mejoramos.** No replicamos los 60; **construimos ~20 bien**, priorizando los que
mueven el negocio, y los hacemos **accionables**:

- **★ Menú Engineering** — matriz **popularidad × margen** (Estrella / Vaca / Incógnita /
  Perro) que dice qué platos potenciar, resituar en la carta o retirar. Es el informe más
  valioso para un restaurante y pocos TPV lo hacen bien.
- **Márgenes por familia/categoría/producto** con *food cost* real, ligado al escandallo
  ([compras e inventario](../09-referencia-configurador-agora/informes/)).
- **Operación diaria (casi hecha):** Ventas diarias · Top productos · Formas de pago · Resumen
  fiscal · Diario de ventas · Movimientos de caja · ventas por centro/usuario.
- **Cumplimiento:** Resumen Fiscal, Diario de Facturas y **Documento 347** (operaciones con un
  tercero > 3.005,06 €/año) que **cuadran con VERIFACTU** y las series.
- **No aplica:** *Estado de Ticket BAI* (es foral del País Vasco; nosotros VERIFACTU + IGIC).

**Ya tenemos (datos reales, `apps/web`):** Ventas diarias · Top 50 productos · Formas de pago ·
Resumen fiscal · Evolución de ventas · Rendimiento de usuarios · Diarios de ventas/pedidos ·
Movimientos de caja · Cancelaciones por usuario · Familias y productos · Invitaciones + Visor
VERIFACTU.

**Prioridad: 🟠 Alta** (Menú Engineering + márgenes son el diferencial de rentabilidad).

---

## C2. Arquitectura de informes: RPC en Supabase, no en el navegador

**Para qué sirve.** Que añadir un informe sea **barato** y que ninguno traiga 50.000 filas al
navegador.

**Cómo lo mejoramos.**

1. **Agregación en el servidor:** cada informe = **vista SQL / función RPC en Supabase**, con
   **RLS por `tenant_id`** y parámetros (fechas, centro, usuario, familia).
2. **Página estándar** (`ReportPage`, `DataTable`, `DateRangePicker`, `ExportButton`): un
   informe nuevo = **una query + un config de columnas**, no una página desde cero.
3. **Export** PDF/Excel/CSV server‑side; **tiempo real** donde aporta (dashboard del día);
   históricos con caché / **vistas materializadas** refrescadas en el cierre.

```sql
create function rpt_ventas_por_centro(p_desde date, p_hasta date)
returns table(centro text, tickets int, base numeric, impuestos numeric, total numeric)
language sql security definer as $$
  select c.nombre, count(*), sum(o.base), sum(o.impuestos), sum(o.total)
  from sales_order o join sales_center c on c.id = o.sales_center_id
  where o.tenant_id = current_tenant_id()
    and o.fecha between p_desde and p_hasta
  group by c.nombre order by total desc;
$$;
```

**Prioridad: 🟠 Alta.** 🟡 base hecha (11 informes reales); falta el framework reutilizable y
Cierre Z consolidado.

---

# D. MODELO DE NEGOCIO

## D1. SaaS por suscripción, no licencia por máquina

**Para qué sirve.** Definir **cómo cobramos** — y que eso sea más simple y atractivo que Ágora.

**Cómo lo hace Ágora.** Licencia **atada a la máquina** (huella "ID de Máquina"), con plan
(Professional) y **monetización por módulos + nº de dispositivos** (único tope: 8 dispositivos).
Lo que más valor remoto aporta (*My Ágora Premium*) es un **add‑on de pago**.

**Cómo lo mejoramos.** Nacemos en la nube, multi‑tenant, así que:

- **Suscripción por tenant/local** (mensual/anual), **sin "ID de máquina"** ni licencia por
  equipo. Más simple: das de alta un local instalando la PWA/Tauri e iniciando sesión.
- **Acceso remoto incluido en base** como **gancho** frente a Ágora (que lo cobra como
  *My Ágora Premium*).
- **Planes/tiers** (Básico / Pro / Premium) para módulos de mayor valor: **Carta Digital,
  KDS, Delivery/Take Away**; o como add‑ons.
- **Reservas: integrar terceros** (al estilo Ágora con CoverManager/Eveve) antes que construir
  módulo propio — decisión de fase posterior.
- **API pública** (`@gluuh/api-client`, OpenAPI/tRPC) como producto vendible: habilita
  integraciones con contabilidad, delivery aggregators y reservas.

**Prioridad: 🟢 Estratégica** (decisión de negocio; no bloquea desarrollo, lo guía).

## D2. Pantalla "Acerca de" propia (plan + cumplimiento)

**Para qué sirve.** Que el cliente vea su **plan activo**, los **módulos** habilitados, el
**estado de cumplimiento VERIFACTU** y el enlace a la **declaración responsable** (A4).

**Cómo lo mejoramos.** Una sola pantalla que une licencia (suscripción, no clave de máquina) +
estado fiscal. Transmite confianza: "tu negocio cumple, y aquí está la prueba".

**Prioridad: 🟢 Media.**

---

# Tabla resumen

| # | Mejora | Para qué sirve | Cómo lo mejoramos vs Ágora | Prioridad | Estado |
|---|--------|----------------|----------------------------|:---------:|--------|
| A1 | Impuestos territorio‑conscientes | % correcto por producto y territorio | Clase fiscal × territorio (no editar % a mano); IGIC/IPSI nativos; validación | 🔴 Crítica | 🟡 parcial (`@gluuh/core`) |
| A2 | Serie por terminal | Numeración legal sin huecos offline | Serie por `device_id`; contador atómico; reinicio anual; bloqueo de borrado | 🔴 Crítica | 🔴 falta |
| A3 | VERIFACTU: salud de cadena | Garantizar integridad de la cadena | Panel de salud, reverificación, pruebas/producción, envío diferido offline | 🔴 Crítica | 🟡 motor+visor ok |
| A4 | Declaración responsable | Requisito legal del fabricante | Generarla y enlazarla desde "Acerca de" | 🔴 Crítica | 🔴 falta |
| A5 | Modo formación sin fiscalidad | Practicar sin contaminar datos reales | Excluido del motor fiscal/series **desde el origen**; sandbox opcional | 🟠 Alta | 🔴 falta |
| A6 | No borrar registros fiscales | Retención legal VERIFACTU | No replicar el "Eliminar"; inmutabilidad; corregir con abono | 🔴 Crítica | 🟢 no‑hacer |
| B1 | Backup cifrado + export RGPD | Proteger datos y portabilidad | Backup canónico de serie (Supabase); export por tenant firmado; cifrado | 🟡 Media | 🟡 parcial |
| B2 | Auditoría con alertas | Quién hizo qué; antifraude | Consultas guardadas + **alertas proactivas** (N anulaciones/día) | 🟠 Alta | 🔴 falta |
| B3 | Offline‑first + remoto de serie | Local no se cae; gestión desde casa | Acceso remoto **incluido**; offline‑first; una base de código | 🔴 Crítica | 🟡 en curso |
| C1 | Informes accionables | Decidir qué hacer, no solo ver | Menú Engineering + márgenes con *food cost*; 347; cuadre fiscal | 🟠 Alta | 🟡 11 informes reales |
| C2 | Arquitectura RPC Supabase | Informes baratos y rápidos | RPC + RLS server‑side; página estándar; export; materializadas | 🟠 Alta | 🟡 parcial |
| D1 | SaaS por suscripción | Cómo cobramos | Sin licencia por máquina; remoto de gancho; tiers Carta/KDS/Delivery | 🟢 Estratégica | — decisión |
| D2 | "Acerca de" propia | Plan + estado de cumplimiento | Suscripción + estado VERIFACTU + declaración responsable | 🟢 Media | 🔴 falta |

---

## Lo innegociable, en tres frases

1. **El cumplimiento se integra en el cobro**, no se configura aparte: territorio→impuesto,
   serie→numeración, cobro→VERIFACTU, todo en `@gluuh/core` y validado por el vector AEAT.
2. **Offline‑first con serie por terminal** hace el cobro sin internet **legal**, sin huecos en
   la cadena; el envío a la AEAT se difiere sin bloquear al cliente.
3. **Lo que Ágora cobra como extra** (acceso remoto, backoffice en la nube) **lo damos de
   serie**, sobre un modelo **SaaS por suscripción** sin licencia atada a la máquina.

---

*Documento de mejoras · 06 — Fiscalidad, plataforma, informes y negocio. Relacionados:*
*[01 — Arquitectura](../01-arquitectura-y-plataforma/) ·*
*[fichas Ágora](../09-referencia-configurador-agora/) ·*
*[índice de mejoras](README.md).*
