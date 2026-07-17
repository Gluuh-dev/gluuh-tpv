# Qué probar (checklist vivo)

Lista de lo NUEVO para verificar. Se va actualizando según implementamos.
Marca ✅ lo que ya has probado y ✔️/❌ si va bien o no.

## A) Se prueba YA en dev (web)

Arranca: `pnpm --filter @gluuh/web dev` → http://localhost:3100 → login `admin@gluuh.com`.

- [ ] **Teclado en pantalla** — YA **no** hay botón flotante en todas las pantallas. Sale
  con un botón **"⌨ Teclado"** que se pone **dentro de cada modal/página** que lo necesite
  (aún por cablear). Layout tipo **móvil/SwiftKey**: fila numérica arriba, **⇧** y **⌫** en
  los extremos de la fila `zxcv`, **coma** a la izquierda del espacio y **punto** a la derecha,
  **?#$** para símbolos (con el guion), **acentos** al mantener pulsada una vocal, **Intro**
  esconde el teclado. Arrástralo por la barra (recuerda la posición, no si estaba abierto).
- [ ] **Lanzador `/inicio`** — al entrar: tema **CLARO**, por **tiles**, **morado `#572370`**,
  hero **TPV**, chip del terminal (punto verde), reloj, saludo por hora, botón **Salir**.
- [ ] **Morado nuevo `#572370`** en todo el app (botones, acentos) — en **claro Y oscuro**.
- [ ] **Operativa en CLARO por defecto** — el TPV arranca en claro (antes podía salir oscuro).
- [ ] **Tema claro/oscuro** — el **botón de tema** (arriba) cambia entre los dos y ambos se ven bien.
- [ ] **Cobro** (abre mesa → toca productos → **Cobrar**) — paneles blancos, tu morado,
  **pago dividido** (varias formas), **propina**, **tipo de documento**, teclado numérico,
  **A devolver** (cambio), y F10/F11/F12.
- [ ] **Menú** (toca un menú del día) — te pide **cada plato** (bebida/primero/segundo/postre),
  eliges uno por grupo (check verde), **Aceptar** solo con todos elegidos.
- [ ] **Dividir cuenta** — abre en claro con tu morado.
- [ ] **Comentarios/extras** (toca un producto con opciones) — modal de modificadores en claro.
- [ ] **Bloqueo relajado** (Plantilla Base) — te identificas **una vez** (usuario/clave o PIN)
  y te mueves libre **sin que te lo vuelva a pedir**, hasta que le des a **Bloquear** a mano.

## B) Necesita el instalador / el nodo (probar con el .exe)

Esto no se ve en dev; hay que reinstalar el servidor y/o el TPV (`C:\gluuh-instaladores\`).

- [ ] **Instalador del servidor** — el progreso se ve **DENTRO del asistente** (sin consola
  negra), acceso **"Desinstalar Gluuh"** + icono verde en Agregar/quitar programas.
- [ ] **Icono verde** del acceso directo del servidor (escudo verde, no morado viejo).
- [ ] **Instalador del TPV** — al terminar **pregunta "¿abrir?"** (checkbox). Crea el atajo
  "Gluuh TPV".
- [ ] **Primer arranque del TPV** — pantalla de conexión: **IP + usuario + contraseña**
  (`tpv1`/`121212` si sembrado) + **Recordar**. Entra a la operativa.
- [ ] **Pantalla "Conectando…"** — abre el TPV con el nodo **apagado** → sale "Conectando…"
  y **entra solo** al arrancar el servidor; si ya conocía un servidor caído, avisa en el login.
- [ ] **Panel del servidor** (`/servidor`) — Fluent, con datos reales (CPU/RAM, catálogo,
  dispositivos, copias…).
- [ ] **Empresa nueva** (desde admin) — al crearla se siembran: **formas de pago** (Efectivo/
  Tarjeta/Bizum), **terminal por defecto** `tpv1`/`121212`, operarios, perfiles.

## Pendiente de afinar (aún no probable)
Cabecera morada del cobro · líneas `(M)` del menú · rejilla de menú con fotos · el resto de
modales contra los mockups. Se irá añadiendo aquí a medida que lo implemente.
