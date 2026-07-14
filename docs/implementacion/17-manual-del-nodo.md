# 17 — Manual del nodo local

Dos partes:

- **A · Configurar para PROBAR** (en tu máquina, hoy).
- **B · El INSTALADOR** para un cliente de verdad (qué pregunta y cómo se genera).

---

# A · Configurar para probar

## A.0 · Antes de nada: las migraciones pendientes en Supabase

**Las aplicas tú** (yo tengo prohibido tocar la nube sin que me lo digas). La `0099` y la
`0101` **ya están hechas**. Quedan estas dos:

**`0102_guardar_cuenta_sin_pisarse.sql`** — dos camareros dejan de pisarse.
⚠️ **Elimina `reemplazar_lineas_orden`** y la sustituye por `guardar_cuenta`. El TPV nuevo
ya llama a la nueva, así que **la nube tiene que tenerla antes de que se despliegue la web**.

**`0103_jornada.sql`** — el día del bar. Tabla `jornada` + `sales_order.jornada_id` +
el Z y el cierre. Sin ella, `/ventas-diarias` sigue agrupando por fecha de calendario y
**el cierre de todos los fines de semana está mal**.

> ### El orden: PRIMERO LA NUBE, DESPUÉS LOS NODOS.
>
> Y esto ya nos ha mordido. El nodo sube sus filas con `select *`: al aplicar la `0103` sólo
> en el nodo, empezó a mandar `jornada_id` — una columna que la nube no tenía — y **el bar
> dejó de subir sus ventas** (`PGRST204`).
>
> Desde hoy el nodo aguanta ese error (le pregunta a la nube qué columnas tiene y le manda
> sólo eso), pero **la regla no cambia**: la nube va delante.

En el nodo, la `0102` y la `0103` **ya están aplicadas** (las apliqué al probar).

## A.1 · Levantar el nodo

```powershell
.\supabase\nodo\instalar-nodo.ps1 -Recrear   # sólo la primera vez (o para rehacerla)
.\supabase\nodo\arrancar-nodo.ps1            # levanta los 7 servicios
```

Al terminar imprime la dirección. Compruébalo en el navegador:
`http://127.0.0.1:54321/nodo/estado` → debe devolver un JSON.

Para pararlo: `.\supabase\nodo\arrancar-nodo.ps1 -Parar`

| servicio | puerto | qué es |
|---|---|---|
| Postgres | 55432 | la verdad |
| PostgREST | 55433 | los datos por HTTP |
| Auth | 55434 | quién eres (**nuestro** firmador; ya no hay GoTrue) |
| Realtime | 55435 | "el comandero ha picado algo" |
| Media | 55436 | las fotos de la carta |
| Web | 3100 | la interfaz (Next). **La sirve el propio nodo** |
| **Gateway** | **54321** | ← **lo único que ve el TPV** |
| Sync | — | sube a la nube cada 5 min |

## A.1-bis · Compilar la web del nodo

```powershell
pnpm --filter @gluuh/web build:nodo
```

Produce un servidor **autocontenido** (41 MB, sin `node_modules`) que el nodo sirve por su
mismo puerto. Sin esto, el servicio `Web` tira de `next start` (vale para desarrollo).

## A.2 · Bajarse un bar de la nube

El nodo nace **vacío**. Sin este paso no tiene ni carta, ni mesas, ni empleados:

```powershell
node apps/nodo/provisionar.mjs --listar        # ¿qué bares hay?
node apps/nodo/provisionar.mjs <tenant-id>     # bájate ese
node apps/nodo/descargar-imagenes.mjs          # y sus fotos
```

**Ojo con cuál eliges**: *Bar Demo Gluuh* tiene la carta pero **no tiene mesas ni
empleados**. El bar completo (1 local, 2 salas, **21 mesas**, 4 empleados, 75 productos)
es **Plantilla base**.

## A.3 · Apuntar el TPV al nodo: **ya no hay nada que hacer**

El nodo **sirve la web además de los datos**, así que una terminal sólo tiene que saber la
dirección del servidor:

```powershell
.\supabase
odo\Instalar-TPV.ps1     # una pregunta: la IP del servidor
```

O directamente: abre `http://<ip-del-nodo>:54321` en el navegador. **Y ya.**

### Lo que se ha ido (y por qué importa)

Antes había que rellenar **cuatro variables en un `.env.local` en cada máquina**. Y
equivocarse en una —poner la clave de Supabase donde va la del nodo— **dejaba a los
camareros fuera sin decir por qué**. Ese fichero ya no existe.

La clave, la URL de los datos y la de la nube se las da el propio servidor al cargar la
página (el gateway se las inyecta en el HTML). Consecuencias:

- **Una sola compilación de la web para todos los bares** (antes habría hecho falta una
  por cliente: cada nodo tiene su IP y su secreto, y por tanto su clave).
- **Al actualizar el servidor se actualizan todas las terminales a la vez.** No hay que ir
  máquina por máquina.
- Si el servidor cambia de IP, se vuelve a ejecutar el instalador de terminal. *(Mejor:
  fija la IP en el router y no cambia.)*

> Para desarrollo contra la nube, `apps/web/.env.local` sigue siendo el de siempre.

## A.4 · Qué probar (y en qué orden)

1. **Con internet**: entrar, abrir una mesa, picar, cobrar. Que todo va.
2. **APAGA EL WIFI** y repite. *Aquí es donde se ve si esto vale.* Si algo tira de
   internet, se cae aquí.
3. **Dos pestañas** del TPV: picar en una → tiene que aparecer sola en la otra.
4. **`/servidor`**: los servicios en verde, qué hay creado, qué falta por subir, cuándo se
   hizo la última copia y si el reloj va bien.
5. **Vuelve a encender el wifi** y `node apps/nodo/sincronizar.mjs`: la venta aparece en
   Supabase. Lánzalo **dos veces**: sigue habiendo **una sola** venta.
6. **La carta, en las dos direcciones**: cambia un precio en el panel de la nube → un pase
   de sync → el TPV lo tiene. Y al revés: cámbialo en el bar sin internet → cuando vuelva
   la línea, sube.

## A.5 · Todo esto se prueba solo

```powershell
node apps/nodo/pruebas/prueba-jornada.mjs          # el día del bar (Z, arqueo, cierre)
node apps/nodo/pruebas/prueba-dos-camareros.mjs    # la misma mesa a la vez, sin pisarse
node apps/nodo/pruebas/prueba-facturas-a-la-vez.mjs # 6 cobros: la cadena no se bifurca
node apps/nodo/pruebas/prueba-catalogo.mjs         # la carta, en las dos direcciones
node apps/nodo/pruebas/prueba-sync.mjs             # las ventas, sin duplicar
node apps/nodo/pruebas/prueba-sync-fiscal.mjs      # factura + desglose + huella
```

Las demás, en `apps/nodo/pruebas/README.md`.

## A.6 · El cierre del día

En el TPV: **Utilidades → Cerrar día (Z)**. Enseña lo cobrado, las formas de pago, los
impuestos, **las mesas que quedan abiertas** y pide el recuento del cajón (y te dice al
momento si falta o sobra).

Si nadie lo hace, el nodo cierra la jornada solo a las **06:00** y la marca con **arqueo
pendiente** — nadie contó la caja, y eso se ve luego en `/ventas-diarias`.

```powershell
node apps/nodo/jornada.mjs --estado   # ¿qué jornada hay abierta y cómo va?
node apps/nodo/jornada.mjs --forzar   # ciérrala ahora (para probar)
```

**Las mesas abiertas no se tocan.** Ni al cerrar a mano ni en el automático: siguen abiertas
y su venta cuenta en la jornada en la que se cobre. Con VERIFACTU delante, inventarse un
cobro que nadie ha confirmado es firmar ante Hacienda algo que no ha pasado.

## A.7 · La copia y el reloj

```powershell
node apps/nodo/copia.mjs            # copia completa ahora (pg_dump, 7 días rotados)
node apps/nodo/copia.mjs --estado   # cuándo fue la última
node apps/nodo/reloj.mjs            # ¿va bien la hora de este ordenador?
```

Las dos las hace **solo** el vigilante a las **04:30** (`arrancar-nodo.ps1 -Vigilar`).

Lo del reloj no es una manía: **este ordenador es el que le pone la hora a cada factura**, y
con VERIFACTU esa hora va firmada y encadenada a Hacienda. Un mini-PC de tres años debajo de
una barra, con la pila de la placa gastada, se va de horas y **no se entera nadie**.

## A.7 · Si algo falla

Los logs están en `.nodo\tmp\*.log` (uno por servicio). El del vigilante, en
`vigilante.log`: ahí se anotan las caídas, las copias de la noche y los avisos del reloj.

| síntoma | causa casi seguro |
|---|---|
| Ningún camarero entra | `SUPABASE_SECRET_KEY` es la de la nube, no la del nodo (§A.3) |
| El TPV no ve nada, sin errores | la RLS no resuelve el tenant → `auth.uid()` |
| PostgREST muere al arrancar | falta `libpq.dll` → `pgsql\bin` no está en el PATH |
| El nodo arranca "vivo" pero mudo | Postgres levantó en el 5432 en vez del 55432 |
| El auth no arranca al **actualizar** | un GoTrue viejo ocupa el :55434 -> `-Parar` lo entierra |
| Cambias un precio en la nube y el bar no se entera | falta la **`0101` en Supabase** |
| El bar no sube sus cambios de carta | mira `ultimo_error` de `catalogo` en `nodo_sync_estado` |
| `/servidor` dice "el nodo no responde" con el nodo vivo | web compilada sin `NODO_BUILD` |

---

# B · El instalador para un cliente

## B.1 · Qué pregunta (y por qué eso y no más)

`supabase/nodo/Instalar-Gluuh.ps1` — cuatro preguntas, ni una de más:

**1. Código de instalación** (21 dígitos, `0000-0000-00000-0000-0000`).
Es el que Gluuh le da al cliente al darlo de alta, y **ya existía** en el sistema
(`tenant.codigo_instalacion`, migración 0078). Lo valida contra la nube y **enseña el
nombre de la empresa** para que el técnico confirme que no se ha equivocado de bar.

**2. Email y contraseña del titular.**
Para que el servidor pueda bajarse la carta y subir las ventas. **La contraseña no se
guarda**: se usa una vez, se pide un permiso, y se guarda sólo ese permiso.
Además **se comprueba que la cuenta es de esa empresa** — si el titular lleva dos bares,
el servidor de éste no puede quedarse con un permiso que apunte al otro.

**3. Datos fiscales** — CIF, razón social y territorio (IVA / IGIC / IPSI).
**Sólo si faltan.** Sin ellos **no se pueden emitir facturas**: los exige la AEAT.
(Al dar de alta una empresa, el CIF se queda en `PENDIENTE`.)

**4. ¿Arrancar solo al encender?** Sí, salvo que digan que no.

Y ya. Lo demás lo hace sin preguntar: base de datos, se baja el bar, las fotos, arranca
los servicios, registra el arranque automático y escribe `INSTALACION.txt` con **la
dirección que hay que poner en cada TPV**.

## B.2 · 🔒 Lo que el instalador **NO** hace, y es lo más importante

**No instala la clave secreta de Supabase en el ordenador del cliente.**

Esa clave (`SUPABASE_SECRET_KEY`) **salta toda la RLS**: con ella se leen y se escriben
los datos de **cualquier** bar de la plataforma. Repartirla con el instalador sería dejar
en cada mini-PC —debajo de una barra, con la wifi del local y la puerta abierta— **la
llave maestra de todos los demás clientes**. Un ordenador robado en un bar sería una fuga
de datos en todos.

En su lugar (`apps/nodo/nube.mjs`):

- El nodo **inicia sesión como el bar**, con la cuenta del titular.
- Guarda **sólo el `refresh_token`** — nunca la contraseña, nunca una clave maestra.
- El token **rota** en cada uso, y el nodo guarda el nuevo.
- **La RLS lo acota a su empresa.** No puede tocar nada de nadie más.

Si le roban el ordenador a un bar, se llevan los datos **de ese bar**. De ninguno más.

> En **nuestra** máquina de desarrollo `nube.mjs` sí acepta `SUPABASE_SECRET_KEY`, porque
> es cómodo y la máquina es nuestra. Eso **no debe salir de aquí**.

## B.3 · Cómo se genera el `.exe`

Con **Inno Setup** (gratis, es el estándar en Windows). El guion está en
`supabase/nodo/instalador/gluuh-servidor.iss`.

**1. Preparar la carga** (`supabase/nodo/instalador/carga/`):

```
carga\pgsql\          Postgres portable          (~300 MB)
carga\bin\            postgrest.exe              (~66 MB)   <- ya NO va gotrue.exe
carga\node\           Node.js portable           (~50 MB)
carga\postgrest.conf
carga\web\            .next/standalone           (~41 MB)   <- la interfaz
```

⚠️ **`postgrest.exe` necesita `libpq.dll`, que viene con Postgres y NO en su propio zip.**
Si empaquetas uno sin el otro, **PostgREST muere en silencio** nada más arrancar. Por eso
van juntos, y por eso los scripts ponen `pgsql\bin` en el PATH.

**2. Compilar:**

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" supabase\nodo\instalador\gluuh-servidor.iss
```

Sale `dist\GluuhServidor-1.0.0.exe`. Un solo fichero, ~500 MB. Parece mucho hasta que te
acuerdas de que la alternativa es pedirle al cliente que instale Postgres y Node a mano
por teléfono.

**3. Fírmalo** si tienes certificado. Sin firma, Windows SmartScreen le enseña al cliente
un aviso rojo de "aplicación no reconocida" — y ahí se acaba la instalación.

## B.4 · Lo que el instalador hace por su cuenta

1. `initdb` — crea el cluster de Postgres. **Es lo único que no se puede traer hecho**:
   el directorio de datos lleva dentro rutas absolutas de la máquina donde se creó.
2. Las 100 migraciones (bootstrap → migraciones → lo propio del nodo). El orden ya es
   el evidente: se fue GoTrue y con él las dos trampas.
3. Se baja el bar entero de la nube y sus fotos.
4. Arranca los 7 servicios y registra el arranque automático.
5. Escribe `INSTALACION.txt` con la dirección para los TPV.

Y al **desinstalar**: para los servicios y quita la tarea de arranque. Si no, quedan
procesos huérfanos comiendo memoria y una tarea programada apuntando a la nada.

## B.5 · Lo que hay que decirle al cliente (está en `INSTALACION.txt`)

- **Este ordenador se queda ENCENDIDO.** Es donde están los datos. Si se apaga, **el bar
  no puede cobrar**.
- El bar **funciona sin internet**. Cuando vuelva la línea, sube solo.
- **La IP no puede cambiar**: hay que fijarla en el router (reserva por MAC). Si el router
  le da otra IP un día, los TPV dejan de encontrar el servidor.

---

## Pendiente

- El instalador **no se ha probado de punta a punta** todavía (falta compilar el `.exe` y
  ejecutarlo en una máquina limpia).
- Falta el **segundo instalador**: el de los TPV (que sólo pregunta la dirección del
  servidor). Hoy se configura a mano con `.env.local`.
- Falta que el TPV **descubra el servidor solo** (mDNS), para no teclear la IP.
