# TRAMPAS — los fallos que no dan error

> Esto es lo que más caro ha salido del repositorio. Si vas a tocar el nodo, el instalador o
> la sincronización, **léelo antes**. Cada una de estas ya se pagó una vez.
>
> Todas tienen algo en común: **no dan un error que se entienda.** Fallan en silencio, o con
> un mensaje que apunta al sitio equivocado. Se descubren cuando un bar no puede cobrar.

---

## 0 · LA MADRE DE TODAS: probar un camino que nadie recorre

**Es la causa de fondo de casi todo lo demás.** Escribimos pruebas que escriben en la base de
datos directamente. Ninguna pasaba por donde pasa **un camarero al darle a Cobrar**, ni por
donde pasa **un técnico al instalar**.

Consecuencias reales, todas descubiertas el mismo día:

- **El nodo no podía cobrar. Nunca había podido.** `/api/ticket` —que `cobrar()` llama *antes
  de tocar nada*— validaba la sesión **contra la nube**, con un token firmado por **el nodo**.
  La nube lo rechaza. 401. *"No se pudo calcular el ticket. No se ha cobrado nada."*
- **VERIFACTU era imposible en un nodo**: `/api/factura` pedía el local a la nube →
  «Tenant no encontrado».
- **El instalador del cliente no podía instalar nada.** Tres tapones absolutos (abajo), en el
  único script que el cliente ejecuta. Nunca se había ejecutado.

**La regla:** si hay un camino que sólo recorre el cliente, **hay que recorrerlo**. Y el
camino de desarrollo tiene que **ser el mismo** — por eso `Instalar-Gluuh.ps1` es ahora
también nuestro instalador.

---

## 1 · Fechas: Postgres y PostgREST **no se comparan como texto**

```
Postgres   →  "2026-07-14 10:48:34.098381+02"     (un espacio, y la hora del bar)
PostgREST  →  "2026-07-14T08:48:34.098381+00:00"  (una T, y UTC)
```

Es **el mismo instante**. Pero como texto, el espacio (`0x20`) es menor que la `T` (`0x54`):
la fila del bar **siempre** parecía más vieja que la de la nube.

**Resultado: el bar no podía subir un cambio de carta nunca.** Sin un error. El dueño cambia
un precio en la barra y no llega jamás a la nube.

→ `instante()` en `apps/nodo/sincronizar.mjs`. Las **marcas de agua** sí se guardan en texto
(hacen falta los microsegundos); lo que se convierte es **la comparación**.

---

## 2 · La nube se migra **ANTES** que los nodos

El nodo sube sus filas con `select *`. Una columna que la nube no tenga → **PostgREST
responde 400 y el bar deja de subir sus ventas**. El dinero se queda encerrado en el mini-PC.

Ya pasó, con `jornada_id`:

```
sales_order  FALLÓ — HTTP 400 PGRST204
  «Could not find the 'jornada_id' column of 'sales_order' in the schema cache»
```

Desde entonces el nodo **le pregunta a la nube qué columnas tiene** y le manda sólo eso
(`loQueLaNubeEntiende`). Pero **la regla no cambia: la nube va delante.**

Y si no puede leer el esquema, **manda todo** — fallar abierto, no cerrado. Más vale que la
nube rechace un lote y se reintente, a que el nodo se coma el `total` de una venta porque no
supo leer una respuesta.

---

## 3 · Windows PowerShell **5.1** (el que hay en un bar)

Un Windows de fábrica **no trae PowerShell 7**. Y en el 5.1:

- **`??`, `?.`, el ternario y `-AsHashtable` NO EXISTEN.** No es que fallen: son un error de
  **sintaxis**. El script **no se ejecuta. Ni una línea.**
  *(`Instalar-Gluuh.ps1` tenía un `??`. El `.exe` habría creado la base de datos y reventado
  al instante, dejando al técnico con una máquina a medias.)*
- **Un `.ps1` sin BOM se lee como ANSI.** Cualquier acento —y el proyecto está en español— se
  convierte en basura y **el script no carga**. Ya tumbó el vigilante una vez, y volvió a
  pasar escribiendo la prueba que lo comprueba.

→ `apps/nodo/pruebas/prueba-instalador.ps1` carga los 9 scripts y comprueba las dos cosas.

---

## 4 · Inno Setup: ninguna línea del `.iss` empieza por `#`

El preprocesador se cree que es una directiva suya («Unknown preprocessor directive»), aunque
esté **dentro de una cadena de Pascal**. Los `#13#10` van **pegados a la línea anterior**.

Y no lo dice hasta que compilas — **después de veinte minutos preparando la carga**.

---

## 5 · Empaquetar el instalador

Todas descubiertas montándolo, y **ninguna daba un error que se entendiera**:

- **En el ordenador de un bar NO HAY NODE.** El gateway, el auth, el realtime, las imágenes y
  la web son **todos Node**. El `.exe` lo empaquetaba… pero **ningún script lo metía en el
  PATH**: no arrancaba ni un servicio. El instalador habría dicho *"Servidor en marcha"* con
  **nada** en marcha.
- **`node_modules\pg` copiado del repo = `pg` sin sus tripas.** Con pnpm es un **enlace
  simbólico**, y sus dependencias viven fuera. En el bar: *"Cannot find module 'pg-pool'"* —
  el nodo no podría ni conectar a su propia base de datos. → se monta con `npm`, árbol plano.
- **El `.iss` empaqueta `supabase\*` entero y recursivo.** Si la carga vive ahí dentro, **el
  instalador se mete a sí mismo**. → la carga se monta **fuera del repositorio**.
- **Windows no pasa de 260 caracteres de ruta.** Y pnpm crea carpetas como
  `.pnpm\next@16.2.9_babel-plugin-react-compiler@1.0.0_react-dom@...\node_modules\@swc\helpers\cjs\`.
  → por eso el destino es `C:\Gluuh` y **no** `C:\Program Files\...`.
- **`postgrest.exe` necesita `libpq.dll`**, que viene con **Postgres** y no en su propio zip.
  Separados, **PostgREST muere en silencio** nada más arrancar.
- **`next build --standalone` NO copia `.next\static` ni `public`.** Sin ellos la web
  **arranca igual** y sirve el HTML **sin CSS ni JavaScript**: página en blanco en el TPV, y
  ni un error en los logs.
- **La tarea programada arranca en `C:\Windows\System32`**, y `copia.mjs` busca `pg_dump`
  relativo al directorio actual → la copia de seguridad de todas las noches habría fallado en
  silencio.
- **El `AppId` tiene que ser un GUID de verdad y ESTABLE.** Si cambia, Windows cree que es
  otro programa e instala **una segunda copia al lado**, con su segundo Postgres peleándose
  por el puerto 55432.

---

## 6 · Reinstalar y desinstalar **se comen los datos de un bar**

- `Instalar-Gluuh.ps1` **recrea la base de datos desde cero**. Reinstalar sobre un bar en
  marcha le borra las ventas, la caja, las facturas y **la cadena de VERIFACTU**.
  → el asistente avisa en rojo y por defecto dice que **no**. Para **actualizar** un bar no se
  reinstala: el nodo se actualiza solo (`apps/nodo/actualizar.mjs`).
- El **desinstalador** no borraba `pgdata` (lo crea `initdb` al vuelo, no Inno) → se quedaban
  250 MB con las ventas del bar dentro, **en silencio**. → ahora **pregunta**, y por defecto
  no las borra.

---

## 7 · En el nodo, `NEXT_PUBLIC_*` **no vale** en las rutas de API

Se incrustan **al compilar**, y apuntan a la nube. Dentro del bar eso significa hablar con
Supabase desde un servidor que **está para funcionar sin internet**.

→ **`apps/web/app/lib/supabaseServidor.ts`**. Una sola puerta: `comoElLlamante()`,
`comoElServicio()`, `quienLlama()`. Si escribes una ruta nueva que toque datos, **usa esa**.

*(Y en el navegador, lo mismo con `app/lib/config.ts`: el gateway inyecta la configuración en
el HTML al vuelo. `app/servidor/page.tsx` se saltó esto y **le preguntaba a la nube por el
estado del nodo** — decía «el nodo no responde» con el nodo vivo delante.)*

---

## 8 · El espejo: dos columnas que **jamás** suben

`NO_SUBIR_COLUMNAS` en `apps/nodo/espejo.mjs`:

- **`auth_user_id`** — el espejo lo pone a `null` (las cuentas de la nube no existen en el
  nodo). Si subiera, **dejaría a null el de la nube**: el dueño **no podría volver a entrar al
  panel desde casa**. Un bar sincronizando su carta le habría cerrado la puerta a su dueño.
- **`password_hash`** — la contraseña local del dueño. Se queda en el bar.

---

## 9 · Los borrados del catálogo llevan **tres cerrojos**

Ninguna tabla tiene `deleted_at`: en la nube se borra de verdad, así que hay que comparar las
claves. Y **una lista mal leída borra el bar entero** — la RLS devuelve `[]` con un 200 tan
tranquila si el token es de otra empresa.

1. La lista viene al tope → puede estar **cortada** → no se borra nada.
2. La nube da la tabla por **vacía** y aquí hay cosas → es un fallo → no se borra nada.
   *Una carta vieja se arregla; una carta borrada, no.*
3. La fila **acaba de subir en este pase** → no está borrada, **está llegando**. Sin esto, el
   producto que el dueño crea en la barra sin internet **se borraría solo**.

---

## 10 · Cosas sueltas que muerden

- **Las migraciones NO son idempotentes.** `0001_init.sql` hace `create table tenant` a secas.
  La cuenta la lleva `nodo_migracion`.
- **`create table if not exists` no añade columnas** a una tabla que ya está. Una migración
  que sólo funciona sobre una base virgen falla justo donde importa: **un bar en marcha**.
- **`pg_ctl` SIEMPRE con `-o "-p 55432"`.** Sin esa bandera coge el puerto de
  `postgresql.conf` (el 5432 de fábrica) y se pisaría con el Postgres del usuario. Va contra
  la **REGLA Nº1**.
- **`PGCLIENTENCODING=UTF8`** siempre que un proceso lance `psql`: en un Windows español supone
  WIN1252 y muere en la primera tilde.
- **PostgREST cachea el esquema.** Una función nueva no existe para él hasta que se lo dicen
  (`PGRST202`). En la nube Supabase trae los disparadores de fábrica; en el nodo los pone
  `05_permisos_nodo.sql`.
- **`& pg_ctl … | Out-Null` se cuelga para siempre** (Postgres hereda la tubería y no la
  cierra). Y `Start-Process -Wait` también (espera al proceso **y a sus hijos**). Los dos se
  cuelgan justo cuando no hay consola — o sea, **exactamente como corre la tarea en el bar**.
- **`$args` es una variable automática de PowerShell.** No la uses como parámetro.
