# 16 · Rutas, layouts y ventanas de la SPA del TPV

**Estado:** vigente desde 20-07-2026 · afecta a `apps/tpv`

Cómo navega el TPV nuevo. Escrito porque «cada botón es una ruta» tiene cuatro
decisiones detrás que, si no se toman a propósito, se toman solas y mal.

---

## 1 · Router propio, no `react-router`

**Decisión: router propio (`src/lib/rutas.ts`, ~90 líneas).**

No es por ahorrar 15 KB. Es que **nuestra puerta de acceso no encaja** con el
modelo de una librería de rutas: aquí la URL **pide** un apartado y quien lo
**abre** es la credencial (PIN/pulsera). En `react-router` lo natural es que la
ruta monte la pantalla, y entonces el guardia hay que montarlo a contrapelo con
loaders o rutas guardián — más piezas para acabar en el mismo sitio.

Con seis apartados y tres segmentos (`vista/seccion/id`), un `split("/")` con
tests hace el trabajo entero y se lee de una sentada.

**Cuándo cambiar de idea:** si aparecen rutas anidadas de verdad (tres niveles de
layout), transiciones con datos precargados, o hace falta compartir rutas con
otra app. Entonces `react-router` deja de ser exceso y pasa a ser ahorro.

---

## 2 · La URL PIDE; la credencial ABRE

**Esta es la regla que no se puede romper.**

```
URL /admin  ─→  App ve la petición  ─→  modal de credencial  ─→  (PIN válido)  ─→  se monta Administrador
```

Lo que se renderiza sale de `vista`, un estado que **solo cambia tras validar**.
La URL nunca monta un apartado por sí misma.

Por qué: si la URL abriera, un acceso directo en el escritorio del terminal —o
el historial del navegador— se saltaría el control de acceso del bar. Y recargar
`/admin` volvería a entrar sin preguntar. El PIN se pide **cada vez**, también
al recargar.

`/tpv` es la excepción deliberada: entra directo, porque el login por operario
ocurre **dentro**, por acción (cobrar, anular), no en la puerta.

---

## 3 · Layouts: lo que no se desmonta

Un TPV tiene que sentirse nativo, y lo que delata a una web es **el parpadeo**:
que al cambiar de sección se caiga y se vuelva a montar la cáscara.

| capa | qué es | qué NO se desmonta al navegar |
|---|---|---|
| Raíz (`App`) | tema, teclado en pantalla, ventanas globales | nada de esto se remonta nunca |
| Gestión (`ShellApartado`) | navbar de 60px + lateral plegable | se mantiene entre secciones de un mismo apartado |
| Operativa (`Tpv`) | su propia cáscara a pantalla completa | — |

Regla práctica: **la sección cambia el CONTENIDO, no el shell**. Por eso
`Configuracion` renderiza `<ShellApartado>` una vez y dentro conmuta la pantalla;
no hay un shell por sección.

El teclado en pantalla vive en la raíz **a propósito**: si viviera en la
pantalla, cambiar de sección con el teclado abierto lo cerraría de golpe.

---

## 4 · Ventanas (modales): cuáles van a la URL y cuáles no

La pregunta del millón. Regla:

**Va a la URL (`?ventana=…`)** si cumple las dos:
1. tiene **contenido propio** que alguien querría enlazar o recuperar, y
2. cerrarla con **Atrás** es lo que uno espera (es "un sitio", no un aviso).

Ejemplos: `Parámetros del artículo`, `Aspecto en el TPV`, buscador de familias.

**Se queda en estado local** si es transitoria: confirmaciones («¿Borrar?»),
avisos, cualquier cosa que se conteste en dos segundos. Meterlas en la URL llena
el historial de basura y hace que Atrás conteste preguntas por ti — que en una
ruta de dinero es exactamente lo que no queremos.

**Ventanas globales** (ayuda, credencial): en la raíz, disponibles desde
cualquier página, porque no pertenecen a ninguna.

---

## 5 · Que vaya rápido

- **Apartados en carga diferida** (`React.lazy`): al arrancar solo baja Inicio.
  El TPV de un bar arranca en un mini-PC, no en un portátil de desarrollo.
- **El shell no se remonta** (punto 3): cambiar de sección no repinta el marco.
- **Elegir sección REEMPLAZA historial** (`replaceState`): si cada clic del menú
  apilara, salir de Configuración pediría catorce veces Atrás. Abrir una ficha
  concreta sí apila: ahí el Atrás tiene sentido.

---

## 6 · El mapa

```
/                              Inicio
/tpv                           Operativa            (entra directo)
/config                        Configuración        (vista general)
/config/<seccion>              p. ej. /config/productos
/config/<seccion>/<id>         p. ej. /config/productos/<uuid>
/analisis  /admin  /nodo       idem, con credencial
?ventana=<nombre>              ventana abierta sobre la página actual
```

⚠ **Sirviendo el build**: `base: "/"` en Vite y **fallback a `index.html`** en
quien sirva `apps/tpv/dist`. Las dos cosas fallan **solo en producción**
(TRAMPAS §15 bis).
