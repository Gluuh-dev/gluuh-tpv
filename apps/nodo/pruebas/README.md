# Pruebas del nodo

La evidencia de que el nodo funciona. Son la suite de humo de cada release y el criterio
de aceptación de los cambios de `docs/implementacion/18`.

**Todas se ejecutan contra el NODO LOCAL (`127.0.0.1:54321`), nunca contra la nube**
(REGLA Nº1 de `CLAUDE.md`), salvo las de sincronización, que por definición tienen que
hablar con Supabase — y limpian lo que crean.

Requisitos: el nodo arrancado (`supabase\nodo\arrancar-nodo.ps1`) y provisionado
(`node apps/nodo/provisionar.mjs <tenant>`).

```powershell
node apps/nodo/pruebas/prueba-auth-sin-gotrue.mjs
node apps/nodo/pruebas/prueba-rls.mjs
node apps/nodo/pruebas/prueba-realtime.mjs
node apps/nodo/pruebas/prueba-media.mjs
node apps/nodo/pruebas/prueba-sync.mjs
node apps/nodo/pruebas/prueba-sync-fiscal.mjs
node apps/nodo/pruebas/prueba-catalogo.mjs
node apps/nodo/pruebas/prueba-dos-camareros.mjs
node apps/nodo/pruebas/prueba-facturas-a-la-vez.mjs
.\apps\nodo\pruebas\prueba-vigilante.ps1
.\apps\nodo\pruebas\prueba-secretos.ps1
```

| prueba | demuestra |
|---|---|
| `prueba-auth-sin-gotrue.mjs` | el nodo firma sus tokens: el camarero entra con su PIN (vale de un solo uso, rechazado al reutilizarlo) y **el DUEÑO entra al panel SIN INTERNET** — lo que antes era imposible. El refresco **rota** |
| `prueba-rls.mjs` | **la RLS aísla los bares**: Ana no ve a Berto ni pidiéndolo a propósito por su `tenant_id` |
| `prueba-realtime.mjs` | el comandero pica una mesa y **otro TPV lo ve** sin preguntar (LISTEN/NOTIFY → SSE) |
| `prueba-media.mjs` | subir foto **sin internet** → verla al instante → queda en cola para la nube → `../../` **bloqueado** |
| `prueba-sync.mjs` | **dos pases de sincronización = UNA venta** en la nube (idempotencia por `client_id`) |
| `prueba-sync-fiscal.mjs` | la nube recibe la factura, **su desglose de IVA y su registro de huella** — sin eso no podría declarar a la AEAT |
| `prueba-catalogo.mjs` | la carta **viaja en las dos direcciones**, los borrados de la nube llegan al bar, lo que nace en el bar **no se borra solo**… y el segundo pase **NO MUEVE NADA** |
| `prueba-dos-camareros.mjs` | Ana y Berto abren la mesa 5 a la vez. Ana añade una tortilla, Berto un vino: **la tortilla ya no desaparece** |
| `prueba-facturas-a-la-vez.mjs` | 6 cobros **simultáneos** contra `/api/factura`: 6 facturas correlativas y **la cadena de huellas no se bifurca** |
| `prueba-jornada.mjs` | **el día del bar, no el del calendario**: la jornada se abre sola, seis ventas a la vez no abren seis jornadas, el Z cuadra, las **mesas abiertas no se tocan**, y la caña de la 1:30 cae en la jornada que le toca |
| `prueba-vigilante.ps1` | se mata PostgREST y **vuelve solo en ~35 s**, sirviendo datos |
| `prueba-secretos.ps1` | la clave del bar entra (200); **la del manual, 401 — firma inválida** |
| `prueba-instalador.ps1` | **todos los `.ps1` arrancan en el Windows de un bar** (PowerShell 5.1 + BOM) |

### La prueba más tonta de todas, y la que más caro habría salido

`prueba-instalador.ps1` sólo comprueba que los scripts **carguen**. Nada más.

Y hacía falta: `Instalar-Gluuh.ps1` —el instalador del cliente— tenía un `??`, que es un
operador de **PowerShell 7**. Un Windows de fábrica trae **PowerShell 5.1**, donde eso es un
error de **sintaxis**: no se ejecuta **ni una línea**. El `.exe` habría creado la base de
datos y reventado al instante, dejando al técnico con una máquina a medias.

Y el mismo script, un poco más abajo, validaba el código de instalación consultando `tenant`
**como anónimo** — y la RLS de `tenant` es `id = current_tenant_id()`. Un anónimo no tiene
empresa: **cero filas, con un 200**. O sea que respondía «ese código no es válido» **siempre,
con cualquier código**. No se podía instalar ni un bar. *(Lo arregla la migración `0104`.)*

**Dos tapones absolutos, en el único script que el cliente ejecuta. Y ninguno se había visto
porque ese script nunca se había ejecutado**: nosotros instalábamos a mano, con otros
comandos. Probábamos un camino distinto del que recorre el cliente.

Es la misma enfermedad que dejó al nodo **sin poder cobrar** durante días (`/api/ticket`
validaba la sesión contra la nube): **probar un camino que nadie recorre**. Por eso ahora
`Instalar-Gluuh.ps1` es también **nuestro** camino de instalación — el manual empieza por
ahí.

### Tres comprobaciones que parecen tontas y son las que importan

**`prueba-catalogo.mjs`, la número 2: el segundo pase no mueve nada.**
Sin ella, la fecha de cada fila se va corriendo sola en cada pase, el bar se pasa el día
bajando y subiendo la misma carta, y **los TPV se repintan cada cinco minutos delante de los
clientes**. No da ningún error: sólo hace que el programa parezca embrujado.

**`prueba-dos-camareros.mjs`, la número 4: un camarero puede guardar dos veces seguidas.**
Es lo que separa un control de concurrencia de un candado tonto. Si el TPV chocara consigo
mismo, el bar no podría cobrar — y el arreglo sería peor que el fallo.

**`prueba-facturas-a-la-vez.mjs`, la cadena.**
Que los seis cobros entren no basta. VERIFACTU es una **cadena**: si dos facturas cuelgan de
la misma anterior, se bifurca, la AEAT rechaza el envío y **no se arregla después** — hay
que anularlo todo. Esa comprobación es la razón de ser del fichero.

> Y esta última prueba es, de paso, la primera vez que un nodo **emite una factura de
> verdad**: hasta hoy `/api/factura` le preguntaba el local **a la nube**, con un token
> firmado por el nodo, y la nube lo rechazaba. Ninguna prueba lo pilló porque todas
> escribían en la base directamente, sin pasar por donde pasa un camarero.

`ayuda.mjs` es lo común: el secreto del nodo, las claves `anon`/`service_role`, y
`barDePrueba()` — que crea empresa + local + dueño con contraseña y su sesión.

## Por qué ya no hay `signUp` en las pruebas

Las viejas creaban su bar con `auth.signUp` — la vía de GoTrue. El nodo ya no la ofrece, y
es **correcto**: un bar se **provisiona desde la nube**, nadie se registra en el servidor
de un bar. Por eso `barDePrueba()` lo crea en la base de datos, que es justo lo que hace
el provisionador.

Retiradas por obsoletas: `prueba-login.mjs` (usaba la API de administración de GoTrue),
`prueba-e2e.ps1` (aislamiento con signUp → ahora `prueba-rls.mjs`), `prueba-identidad.mjs`
(idem), `prueba-supabasejs.mjs` (signUp).
