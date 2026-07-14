# 12 — Auditoría del nodo: qué cambiaría ahora que aún es barato (14-07-2026)

Repaso de TODO lo construido y decidido para el nodo, con una sola pregunta:
**¿de qué nos arrepentiremos cuando haya diez bares instalados?** Ahora un cambio cuesta
una tarde; con bares en producción, cuesta una migración remota y noches de soporte.

Orden: primero lo que rompe dinero o deja el bar tirado; después las simplificaciones
que sólo son baratas hoy; después robustez; al final, lo decidible con calma.

Cada punto lleva: **el problema → la propuesta → qué cuesta**. Los tres primeros de la
sección A están **verificados contra el código**, no son teoría.

---

## A · Fallos de corrección — arreglar antes de seguir construyendo

### A1 · El sincronizador NO sube lo que la nube necesita para la AEAT ⚠️ VERIFICADO

`sincronizar.mjs` sube: `sales_order`, `order_line`, `payment`, `invoice`,
`cash_session`, `cash_move`. **No sube `invoice_tax_line` ni `verifactu_record`.**

Consecuencia directa: la decisión 7 de `plan/11` ("el nodo genera la factura y su huella;
**la nube la envía a la AEAT**") es **imposible** tal como está — la nube recibiría
facturas sin desglose de impuestos y sin el registro de la cadena de huellas que tiene
que remitir. Nadie lo notaría hasta activar VERIFACTU en el primer cliente.

**Propuesta**: añadir a `TABLAS` → `invoice_tax_line` (tras `invoice`) y
`verifactu_record` (tras `invoice_tax_line`; conflicto por `id`, tiempo `created_at`).
Más adelante `ticketbai_record` si se activa el País Vasco.

**Coste**: 4 líneas + una prueba. **Hacerlo ya.**

### A2 · "Nunca cerrándose" no se cumple: no hay vigilante ⚠️ VERIFICADO

La tarea programada (`servicio-windows.ps1`, `RestartCount 999`) reinicia **el script de
arranque** si falla. Pero `arrancar-nodo.ps1` lanza los siete servicios **y termina**.
Los hijos quedan huérfanos de vigilancia: si PostgREST muere a las 15:00 de un martes,
**se queda muerto hasta el próximo reinicio del ordenador**. La promesa al cliente era
"se levantará automático y se pondrá ahí, nunca cerrándose" — hoy solo se cumple la
primera mitad.

**Propuesta**: `arrancar-nodo.ps1 -Vigilar` — un bucle infinito que cada 30 s comprueba
cada servicio (`pg_isready` + ping HTTP a cada puerto) y **relevanta solo al caído**.
La tarea programada ejecuta ESTE modo (ya tiene `ExecutionTimeLimit` cero); si el propio
bucle muriera, la tarea lo reinicia — dos niveles de defensa.

**Coste**: ~40 líneas de PowerShell. **Hacerlo ya.**

### A3 · Después de provisionar, el catálogo NUNCA vuelve a bajar

La bajada de datos es **de un solo disparo** (al instalar). Si el dueño cambia un precio
desde casa (módulo de pago → escribe en la nube), **el nodo no se entera jamás**. La
decisión de `plan/10` era catálogo **bidireccional** con LWW por `updated_at`; solo está
construida la mitad (subida de ventas).

**Propuesta**: `bajar-cambios` dentro del bucle del sincronizador — el espejo de
`subirTabla`: marca de agua por tabla, `updated_at > marca`, upsert local. Los borrados
se propagan por `deleted_at` (soft-delete, que ya existe en la mayoría de tablas de
catálogo); para las tablas de unión sin `deleted_at` (`product_category`…), reconciliar
el conjunto del padre modificado. Y re-lanzar `descargar-imagenes` al final de cada pase
(ya es idempotente y barato: se salta lo que existe).

**Coste**: 1 día con pruebas. Necesario antes de vender el módulo "ver desde casa".

### A4 · El dueño no puede entrar al PANEL local ⚠️ VERIFICADO

`app/login/page.tsx:59` entra con `signInWithPassword(email…)` contra GoTrue. En el nodo,
el GoTrue está vacío (los `auth_user_id` de la nube se anulan al provisionar, y la cuenta
sintética solo se crea para **operarios** vía `/api/entrar-operario`). Resultado: los
camareros entran al TPV, pero **el dueño/encargado no puede abrir el backoffice local**
(cambiar un precio, ver la caja) sin internet.

**Propuesta**: no parchearlo — se arregla de raíz con **B1** (auth local unificada).
Si B1 se pospone, el parche mínimo es extender `/api/entrar-operario` para cuentas con
email (misma mecánica de cuenta sintética).

### A5 · Secretos de fábrica en todos los bares

Hoy: JWT `clave-jwt-de-desarrollo-…`, Postgres `postgres/gluuh` — **iguales en todas las
instalaciones** y visibles en el repo/manual. Vale para desarrollo; en producción,
cualquiera que lea el manual puede firmar tokens `service_role` válidos para **cualquier
nodo** al que alcance por red.

**Propuesta**: el instalador (`Instalar-Gluuh.ps1`) genera **por bar**: secreto JWT
aleatorio (≥32 chars), contraseña de Postgres aleatoria; los escribe en
`postgrest.conf`/`sync.env`/config de servicios, y deriva las claves `anon`/`service`
con `claves.mjs`. Nada de esto viaja fuera del mini-PC.

**Coste**: ~20 líneas en el instalador. Antes del primer bar real.

---

## B · Simplificaciones que SOLO son baratas ahora

### B1 · Eliminar GoTrue del nodo — la simplificación grande ★

**Qué hace GoTrue en el nodo, de verdad**: acuñar JWTs para operarios. Nada más. No hay
signup real (los bares se provisionan), no hay email/SMTP, no hay recuperación de
contraseña. El PIN se valida contra `app_user.clave_hash` (RPC nuestra), y GoTrue solo
pone la firma final.

**Qué nos cuesta tenerlo**:

| coste | detalle |
|---|---|
| Un fork parcheado de Go | 50 MB, compilado por nosotros (parche SO_REUSEPORT). **Cada aviso de seguridad de Supabase Auth nos obliga a re-parchear y re-compilar** — para siempre |
| Las DOS trampas del orden de instalación | `auth.users` (no crearla antes) y `auth.uid()` (pisada con la forma antigua → RLS muerta en silencio). Existen **solo** por GoTrue; costaron horas encontrarlas |
| Un proceso más que vigilar | y su config (`gotrue.env`), su traspaso de propiedad del esquema, `01_despues_de_gotrue.sql` |
| El bug A4 | el login local por email no funciona |

**Propuesta**: un endpoint de tokens en el gateway (~150 líneas de Node, cero
dependencias) que imita la parte del contrato de GoTrue que `supabase-js` usa:
`POST /auth/v1/token?grant_type=password` y `grant_type=refresh_token` (+ `GET /user`).
Valida contra `app_user` (PIN de operario **y** email/clave del dueño → arregla A4 de
paso), acuña el JWT con los claims del hook (`tenant_id`, `user_rol`) directamente — el
hook 0011 deja de hacer falta en el nodo — y gestiona refresh en una tabla mínima
`nodo_sesion`. PostgREST no nota la diferencia: mismo secreto, mismos claims.

**Qué desaparece**: gotrue.exe y su fork, `gotrue.env`, los pasos 2-3 del instalador (las
dos trampas), 50 MB del instalador, un proceso. **La nube no cambia**: allí GoTrue es de
Supabase y lo mantienen ellos.

**Riesgo**: imitar mal el contrato de sesión de `supabase-js`. Acotado — la superficie
usada es pequeña y tenemos pruebas e2e que lo verifican (`apps/nodo/pruebas/`).

**Coste**: 1–2 días. **La ventana es ahora**: cada pieza nueva que se apoye en el GoTrue
del nodo encarece quitarlo.

### B2 · De 7 procesos a 5: fusionar `media` y `estado` en el gateway

`media.mjs` y `estado.mjs` son HTTP trivial; pueden vivir dentro de `gateway.mjs` (un
puerto interno menos, dos procesos menos que vigilar). `realtime.mjs` se queda aparte a
propósito (su diseño es suicidarse si pierde Postgres) y `sincronizar --bucle` también.

**Coste**: 1 hora. Opcional; hacer junto a B1 si se hace.

### B3 · El actualizador tiene dos huecos

1. **No actualiza la web** que el nodo va a servir (decisión 2 de `plan/11`). El artefacto
   de release debe pasar a ser `zip(apps/nodo + supabase + web standalone)` con su sha.
2. **Se sobreescribe a sí mismo en caliente** (descomprime sobre `apps/nodo` mientras
   `actualizar.mjs` corre desde ahí). Funciona porque Node ya cargó el fichero, pero es
   frágil: copiarse a `tmp` y re-ejecutarse desde allí antes de tocar nada.

**Coste**: (1) va con el trabajo de servir la web; (2) 10 líneas.

---

## C · Robustez de bar real

### C1 · Copia local nocturna (la nube no lo cubre todo)

La nube guarda ventas cerradas + catálogo. El caso que NO cubre: **tres días sin internet
y el disco muere** → se pierden esos tres días. Un `pg_dump` nocturno rotado (7 días) en
`.nodo/backups` — y si hay un segundo disco/USB, copia allí también — cuesta 15 líneas en
el vigilante y salva exactamente ese caso. El panel `/servidor` debe enseñar la fecha de
la última copia.

### C2 · El reloj del mini-PC es una amenaza fiscal

Las facturas llevan fecha/hora del nodo, y la cadena VERIFACTU también. Un mini-PC barato
con la pila del reloj gastada y semanas sin internet → **facturas con fecha mala ante la
AEAT**. Propuesta: en cada pase de sincronización, comparar el reloj local con la nube;
si la deriva pasa de ~2 min, avisar en grande en `/servidor` (y anotarlo en el latido
para que Gluuh lo vea). No corregir el reloj solos (eso es del SO); avisar sí.

### C3 · Dos camareros en la misma mesa se pisan

`reemplazar_lineas` es *last-write-wins*: A abre la mesa 5, B abre la mesa 5, ambos
añaden, ambos guardan → **las líneas de uno desaparecen sin error**. El realtime lo
mitiga (se ven al instante) pero la carrera existe, y en una barra con dos camareros es
cuestión de tiempo. Propuesta: control optimista — `reemplazar_lineas` recibe
`p_updated_at_esperado`; si la orden cambió, devuelve conflicto y el TPV recarga la mesa
y avisa ("la mesa ha cambiado"). 20 líneas de SQL + manejo en el TPV.

### C4 · Numeración de facturas: `max+1` con reintento

`/api/factura` calcula el siguiente número leyendo el máximo. Con varios TPV cobrando a
la vez contra el mismo nodo puede chocar (hay un único reintento). Propuesta: secuencia
de Postgres por serie o `pg_advisory_xact_lock(hash(serie))` en una RPC. Pequeño, pero es
dinero y es la cadena fiscal: mejor determinista.

### C5 · Los logs crecen para siempre

`.nodo/tmp/*.log` sin rotación → en meses llenan el disco de un mini-PC pequeño. El
vigilante (A2) debe truncar/rotar por tamaño (p. ej. 10 MB por servicio).

### C6 · El latido debe llevar telemetría (y Gluuh una vista de nodos)

El latido (decisión 4 de `plan/11`) ya va a existir; que lleve carga útil: versión,
pendientes de subir, errores de sync, deriva de reloj, fecha de última copia. Y en el
admin de la plataforma, una vista "nodos": *«Bar Paco — visto hace 40 s — v1.2.0 — 0
pendientes»*. Soporte proactivo en vez de enterarse por teléfono.

### C7 · Las pruebas del nodo vivían en una carpeta temporal ⚠️ (rescatado hoy)

Toda la evidencia de que el nodo funciona (e2e de RLS, realtime, media, sync idempotente,
identidad, login) estaba en `.nodo/tmp/` — **ignorada por git y borrable**. Hoy quedan en
`apps/nodo/pruebas/` con un README. Siguiente paso: `probar-nodo.ps1` que las encadene
contra una instalación limpia (criterio de aceptación de cada release), y algún día un
runner Windows en CI.

---

## D · Para decidir con calma (no bloquean)

- **D1 · Requisitos del local** (doc de venta/técnico): Windows 10/11 x64, 8 GB, SSD,
  **el servidor SIEMPRE por cable ethernet** (nunca wifi), SAI/UPS recomendado, reserva
  de IP por MAC en el router. El wifi para el *servidor* es el origen de la mitad de los
  fantasmas que luego se llaman "el TPV va lento".
- **D2 · `tipo_consumo`** (barra/mesa/llevar) — columna existente sin usar. Puede cambiar
  el tipo de IVA aplicable. Resolver **antes** de activar VERIFACTU en un cliente real.
- **D3 · HTTPS en la LAN**: no en v1 (certificados autofirmados = más soporte que
  seguridad ganada en una red local). Revisar si algún día el TPV integra pagos que lo
  exijan. Dejarlo escrito para que no parezca un olvido.
- **D4 · Retención en el nodo**: purgar ventas de hace >2 años ya confirmadas en la nube.
  No urge (años de margen de disco), pero que exista la decisión.
- **D5 · ¿Por qué no PowerSync/ElectricSQL/replicación lógica?** Se evaluó al principio;
  hoy el sync a mano está **construido y probado** (idempotencia demostrada), es ~300
  líneas legibles y no mete un motor opaco en el camino del dinero. Cambiarlo ahora sería
  coste sin beneficio. Se reevalúa si el sync bidireccional (A3) se complica de verdad.
- **D6 · Contratos**: custodia de certificados AEAT (decisión 7) **y** encargo de
  tratamiento de datos (RGPD: hay datos de clientes finales en nodo y nube). Para el
  abogado, no para el editor de código.

---

## Orden propuesto (revisa el §10 de plan/11)

1. **A1 + A2 + A5** — horas, y son corrección/seguridad pura.
2. **B1 (quitar GoTrue del nodo)** — antes de que el trabajo "servir la web + instalador
   TPV" construya nada más encima del auth local. B2 y B3.2 de paso.
3. **Servir la web + instalador de TPV** (lo ya decidido como siguiente) — ahora sobre un
   nodo más simple.
4. **A3 (catálogo baja)** + C1 + C2 — el paquete "módulo nube honesto".
5. **C3 + C4** — antes del primer bar con dos camareros.
6. Latido/emergencia/series A-B (plan/11 §3-5), impresión IP, AEAT — como estaba.

---

*Verificado contra código el 14-07-2026: A1 (`sincronizar.mjs` TABLAS), A2
(`servicio-windows.ps1` RestartCount / `arrancar-nodo.ps1` termina tras arrancar), A4
(`app/login/page.tsx:59`). El resto es diseño: discutible y discutámoslo.*
