# Operativa estilo Glop/Ágora — backlog de análisis

> Cuaderno de trabajo compartido. El cliente va pasando referencias (manuales/capturas de
> Glop y Ágora) y aquí las apuntamos, las analizamos entre los dos, y las convertimos en
> tareas. **Objetivo: la operativa (TPV táctil) tan buena como Glop/Ágora, o mejor.**
>
> No confundir con el **backoffice** (estilo Supabase, para el dueño). Esto es la **operativa**
> táctil que usa el camarero, colorida y con la marca del cliente.

## Principio que ya cumplimos

- **Configurar una vez y que se quede** (lo de Ágora): nuestro primer arranque del Electron
  (IP + credencial + "Recordar") lo hace, y un no-TPV abre directo su pantalla. ✅ Hecho.
- **Config offline**: el nodo sirve el backoffice sin internet. ✅ Existe (falta hacerlo táctil).

---

## Backlog

### 1. ⭐ Teclado en pantalla (in-app) — PRIORIDAD
**Referencia:** botón "Teclado" de Glop en cada campo de texto.

**Decisión: teclado DENTRO de la app, NO el de Windows.** Motivos:
- El de Windows (osk.exe / TabTip) en un TPV a pantalla completa (kiosko) es un desastre:
  el TabTip solo sale en "modo tableta" o con ajustes concretos; el osk.exe es el de
  accesibilidad (feo, flotante, tapa la app sin control). En un táctil de barra, no aparece
  o aparece mal.
- Uno propio: sale exactamente donde y cuando queremos, con el estilo de la operativa,
  numérico para cantidades/PIN y QWERTY para nombres/CIF, igual en todos los equipos, sin
  depender de la config de Windows.

**Plan:** componente de teclado en pantalla (React) integrado en la operativa. Aparece al
tocar un campo (o botón "Teclado"), overlay abajo, manda las teclas al campo con foco.
Variantes: numérico y completo. Autocontenido (offline). *(Opción: `react-simple-keyboard`,
ligero y probado, o uno mínimo propio.)*

**Estado:** por empezar. Es el gap más notado en el día a día.

### 2. Lanzador de inicio "Abrir TPV / Configuración"
**Referencia:** Glop abre en un menú (Tarifas, Promociones, Actualizaciones de precios… +
"Acceso a TPV"). Ágora igual (elige tipo de terminal).

**Tensión:** hoy la app de escritorio carga **solo la operativa** (decisión del proyecto:
el camarero no configura). **Reconciliación:** el lanzador (`/inicio`) ofrece **"Abrir TPV"**
(directo) y **"Configuración"** (pide clave técnica/dueño → backoffice). Entrada estilo Glop
sin abrir la config a cualquiera.

**Estado:** existe `/inicio` pero flojo. Por rehacer.

### 3. Config táctil estilo Glop (por fases)
**Referencia:** pantallas de Glop de tarifas, promociones, actualización de precios, selección
masiva de artículos por familia, etc. — todo táctil, rápido, offline.

**Análisis:** nuestro backoffice ya hace esto pero en estilo Supabase (ratón/dueño). Hacerlo
**táctil como Glop** es un proyecto de UX grande → por fases, pantalla a pantalla. Empezar por
las más usadas (tarifas, promociones).

**Estado:** por analizar con los manuales.

### 4. (Ágora) Monitor KDS: estación + tamaño de fuente en la pantalla de conexión
Opcional. Hoy la estación se asigna en el panel. Se podría dejar elegir en el equipo.
**Estado:** opcional, en espera.

---

## Por analizar (manuales que el cliente irá pasando)
- [ ] Lanzador de inicio de Glop (opciones exactas).
- [ ] Teclado en pantalla de Glop (numérico vs completo, dónde sale).
- [ ] Selección masiva de artículos por familia (visto en promociones).
- [ ] Tarifas de venta.
- [ ] Actualización de precios.
- [ ] (ir añadiendo)
