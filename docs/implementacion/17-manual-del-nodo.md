# 17 — Manual del nodo local

## Instalar un bar son DOS comandos. No cuarenta.

```powershell
pnpm install                          # sólo la primera vez
.\supabase\nodo\Instalar-Gluuh.ps1    # y ya está
```

Ese segundo comando es **el instalador de verdad**: exactamente el que ejecuta el técnico en
el bar, exactamente el que va dentro del `.exe`. Te hace cuatro preguntas (código de
instalación, cuenta del titular, datos fiscales si faltan, y si arranca solo) y luego hace
todo lo demás sin preguntar: crea la base de datos, se baja la carta y las fotos, compila la
interfaz, arranca los siete servicios, registra el arranque automático y te escribe la
dirección que hay que poner en cada TPV.

> **Para probar aquí**, el código de instalación de *Plantilla base* (1 local, 2 salas,
> 21 mesas, 4 empleados, 75 productos) es **`5244-7793-03261-5161-6093`**.

### Por qué esto es lo importante, y no un detalle de comodidad

Hasta hoy había **dos caminos**: el técnico ejecutaba `Instalar-Gluuh.ps1`, y nosotros
instalábamos a mano con otros seis comandos. **Probábamos un camino distinto del que recorre
el cliente.**

Consecuencia: ese script llevaba semanas **sin poder ni cargarse**. Tenía un `??` — un
operador de PowerShell 7 —, y un Windows de fábrica trae **PowerShell 5.1**, donde eso es un
error de **sintaxis**. No es que fallara una línea: **no se ejecutaba ninguna**. El `.exe`
habría creado la base de datos y reventado al instante, dejando al técnico con una máquina a
medias y sin un mensaje que explicara nada.

Nadie lo sabía porque **nadie lo había ejecutado nunca**. Ahora lo comprueba
`.\apps\nodo\pruebas\prueba-instalador.ps1` en cada vuelta.

*(Lo mismo, y por lo mismo, pasó con `/api/ticket`: el nodo **no podía cobrar** porque
validaba la sesión contra la nube. Todas las pruebas escribían en la base directamente y
ninguna pasaba por donde pasa un camarero.)*

---

Lo que sigue es el detalle: qué hace cada pieza, qué probar y cómo se genera el `.exe`.

- **A · Probar** en tu máquina, hoy.
- **B · El INSTALADOR** para un cliente de verdad.

---

# A · Probar

## A.0 · Antes de nada: las migraciones pendientes en Supabase

**Las aplicas tú** (yo tengo prohibido tocar la nube sin que me lo digas). La `0099` y la
`0101` ya están hechas. Quedan **tres**:

| migración | qué pasa si no |
|---|---|
| **`0104_empresa_por_codigo_instalacion.sql`** | 🔴 **el instalador no instala nada**: dice «ese código no es válido» siempre |
| **`0102_guardar_cuenta_sin_pisarse.sql`** | el TPV nuevo llama a `guardar_cuenta`, que no existiría: **no se puede guardar una cuenta** |
| **`0103_jornada.sql`** | `/ventas-diarias` sigue agrupando por calendario: el cierre de los fines de semana está mal |

La **`0104` es la que bloquea la prueba de esta tarde.** Sin ella, `Instalar-Gluuh.ps1` no
pasa de la primera pregunta.

> ### El orden: PRIMERO LA NUBE, DESPUÉS LOS NODOS.
>
> Y esto ya nos ha mordido. El nodo sube sus filas con `select *`: al aplicar la `0103` sólo
> en el nodo, empezó a mandar `jornada_id` — una columna que la nube no tenía — y **el bar
> dejó de subir sus ventas** (`PGRST204`).
>
> Desde hoy el nodo aguanta ese error (le pregunta a la nube qué columnas tiene y le manda
> sólo eso), pero **la regla no cambia**: la nube va delante.

En el nodo ya están aplicadas las tres (las apliqué al probar).

## A.1 · Los siete servicios

`Instalar-Gluuh.ps1` los levanta solo. Esto es para cuando algo falle y haya que mirar.

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

```powershell
.\supabase\nodo\arrancar-nodo.ps1            # levanta lo que esté parado
.\supabase\nodo\arrancar-nodo.ps1 -Parar     # lo para todo
.\supabase\nodo\arrancar-nodo.ps1 -Vigilar   # y se queda vigilando (esto es lo que corre en el bar)
```

`http://127.0.0.1:54321/nodo/estado` → un JSON con todo: servicios, contenido, última copia,
si el reloj va bien.

### Y las piezas sueltas, por si hace falta

Lo hace todo el instalador; están aquí porque un día habrá que rehacer una sola cosa.

```powershell
.\supabase\nodo\instalar-nodo.ps1 -Recrear     # rehacer SÓLO la base de datos
pnpm --filter @gluuh/web build:nodo            # recompilar SÓLO la interfaz
node apps/nodo/provisionar.mjs --listar        # ¿qué bares hay en la nube?
node apps/nodo/provisionar.mjs <tenant-id>     # volver a bajarse uno entero
node apps/nodo/descargar-imagenes.mjs          # y sus fotos
```

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

## B.0 · Lo que ve el técnico: **un asistente, no una consola negra**

Cuatro páginas de ventana, con «Atrás» y «Siguiente». **Y cada una se valida contra la nube
antes de dejar pasar**, así que los errores salen **antes de tocar el ordenador** — nada de
instalar Postgres, crear la base de datos, y reventar en la última pantalla porque la
contraseña estaba mal.

| página | valida |
|---|---|
| 1 · Qué bar es | canjea el código contra la nube y **pide confirmación con el nombre de la empresa** |
| 2 · Cuenta del titular | entra de verdad, y comprueba que la cuenta **sea de esa empresa** |
| 3 · Datos fiscales | **sólo aparece si faltan** (lo mira en la nube) |
| 4 · Arranque automático | una casilla |

Antes esas preguntas se hacían en una **consola negra de PowerShell**. Aparte de la
impresión que da un técnico pidiéndole a un hostelero su contraseña y su CIF en una pantalla
así, **una consola no sabe volver atrás**: un dígito mal tecleado en el código y el único
camino era empezar de cero.

Las respuestas llegan al script en un fichero de `{tmp}` (no por línea de comandos: **la
contraseña quedaría a la vista en la lista de procesos de Windows**), y el script lo borra en
cuanto lo lee.

> El mismo `Instalar-Gluuh.ps1` sirve para las dos cosas: con `-Respuestas` no pregunta nada
> (lo que hace el `.exe`), y sin él pregunta por consola — que es **nuestro** camino. Un solo
> script. Lo que probamos es lo que se ejecuta en el bar.

### Y dos cerrojos que no estaban

**Reinstalar encima de un bar que ya funciona.** `Instalar-Gluuh.ps1` **recrea la base de
datos desde cero**: reinstalar habría borrado las ventas, la caja, las facturas y la cadena
de VERIFACTU de ese bar. Ahora, si encuentra un Postgres con datos, **avisa en rojo y por
defecto dice que no**. *(Para actualizar un bar no se reinstala: el nodo se actualiza solo.)*

**Desinstalar.** `pgdata` no lo crea el instalador (lo crea `initdb` al vuelo), así que Inno
no lo borraba — y se quedaban 250 MB con las ventas del bar dentro, en silencio. Ahora
**pregunta**, y por defecto **no los borra**.

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

## B.3 · Cómo se genera el `.exe` — **un comando**

```powershell
winget install --id JRSoftware.InnoSetup     # sólo la primera vez
.\supabase\nodo\instalador\Montar-Paquete.ps1
```

Sale **`C:\gluuh-paquete\dist\GluuhServidor-1.0.0.exe`** — un solo fichero de **86 MB**.

`Montar-Paquete.ps1` prepara la carga y compila. **Y es un script, no una lista de pasos en
un documento, a propósito:** un paquete al que le falta una pieza **no da error**. Se
entrega, se instala, y el bar no arranca.

| dentro del paquete | | |
|---|---|---|
| `pgsql\` | 120 MB | Postgres **podado**: `bin`+`lib`+`share`. Fuera pgAdmin (616 MB) y los símbolos (156 MB) |
| `bin\` | 66 MB | `postgrest.exe` |
| `node\` | 94 MB | **Node portable** — en el ordenador de un bar no hay Node |
| `web\` | 230 MB | la interfaz, sin los 5.185 mapas de código ni los runtimes de desarrollo |
| `node_modules\` | 1 MB | `pg` y sus dependencias, en árbol **plano** |
| | **510 MB** | → comprimido: **86 MB** |

**Fírmalo** antes de dárselo a un cliente. Sin firma, Windows SmartScreen enseña un aviso
rojo de "aplicación no reconocida" — y el técnico no va a pulsar *"ejecutar de todas formas"*
en el ordenador de un cliente.

### Las seis trampas de empaquetar esto

Todas descubiertas montándolo. **Ninguna daba un error que se entendiera.**

**1. No había Node en el paquete… y sí lo había, pero no en el PATH.**
El gateway, el auth, el realtime, las imágenes y la web son **todos Node**. En el mini-PC de
un bar no hay Node instalado. El `.iss` lo empaquetaba en `{app}\node`, pero **ningún script
lo metía en el PATH**: `node` no existía y no arrancaba ni un servicio. El instalador habría
terminado diciendo *"Servidor en marcha"* con nada en marcha.

**2. `node_modules\pg` copiado del repositorio: `pg` sin sus tripas.**
Con pnpm eso es un **enlace simbólico**, y sus dependencias (`pg-pool`, `pg-protocol`,
`pg-types`, `pgpass`…) viven fuera del enlace. En el bar, `import pg` reventaría con
*"Cannot find module 'pg-pool'"* y **el nodo no podría ni conectar a su propia base de
datos**. Ahora se monta un árbol plano con npm.

**3. El instalador se empaquetaba a sí mismo.**
La carga vivía en `supabase\nodo\instalador\carga\`, y el `.iss` empaqueta `supabase\*`
**entero y recursivo**. Los 510 MB, otra vez, dentro del paquete. Por eso la carga se monta
**fuera del repositorio** (`C:\gluuh-paquete`).

**4. Los 260 caracteres de Windows.**
pnpm crea carpetas como
`.pnpm\next@16.2.9_babel-plugin-react-compiler@1.0.0_react-dom@19.2.7_react@19.2.7__react@19.2.7\node_modules\@swc\helpers\cjs\`.
Desde dentro del repositorio, eso se pasa del límite y la compilación **revienta a media
faena** — después de veinte minutos comprimiendo, y con un error que no dice ni qué fichero.
(Por lo mismo el destino es `C:\Gluuh` y no `C:\Program Files\...`.)

**5. El `AppId` no era un GUID.**
`{{8F3A6C21-...-GLUUH0000001}` — la `G`, la `L`, la `U` y la `H` no son dígitos
hexadecimales. El `AppId` identifica la aplicación para actualizar y desinstalar: si Windows
no lo reconoce como el mismo programa, una actualización instalaría **una segunda copia al
lado**, con su segundo Postgres peleándose por el puerto 55432.

**6. La tarea programada arranca en `C:\Windows\System32`.**
Y `copia.mjs` busca `pg_dump.exe` **relativo al directorio actual**. La copia de seguridad de
todas las noches habría fallado en silencio — y el día que se rompiera el disco del bar, no
habría ninguna.

### ⚠️ Lo que todavía NO está probado

**El `.exe` no se ha ejecutado en una máquina limpia.** Compila y pesa lo que tiene que
pesar, pero eso no demuestra que instale. Lo que hay que hacer, en una máquina **sin Node,
sin Postgres y sin nuestro repositorio**:

1. Ejecutarlo. Que pase las cuatro preguntas.
2. Que los siete servicios queden en verde en `http://<ip>:54321/nodo/estado`.
3. **Cobrar una mesa.** Es la prueba de verdad.
4. Apagar el wifi y volver a cobrar.
5. Reiniciar el ordenador y comprobar que todo vuelve solo.

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
