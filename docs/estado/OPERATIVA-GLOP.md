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

**Spec (aclarada por el cliente):**
- **Teclado COMPLETO** (QWERTY + números + símbolos), no solo numérico. Para escribir de
  todo: nombres de producto, precios, CIF…
- **FLOTANTE, por encima de todo** (overlay top-most), no docked fijo abajo.
- **NO tapa el campo que estás editando.** Como se usa para **crear productos, cambiar
  precios, etc.** (formularios con varios campos), tiene que poder verse el input a la vez.
  → **Movible/arrastrable** (lo apartas si estorba) y/o auto-reposiciona / hace scroll del
  campo con foco a la zona visible. Recuerda su última posición.
- Se usa en la **operativa Y en la config** (backoffice), porque en un TPV táctil sin teclado
  físico hay que poder configurar también. → El componente debe ser **global**, no solo del TPV.

**Plan:** componente de teclado en pantalla (React), **flotante y arrastrable**, montado a
nivel global (layout) para que salga en cualquier pantalla. Aparece al tocar un campo (o
botón "Teclado"), manda las teclas al campo con foco. Autocontenido (offline). *(Opción:
`react-simple-keyboard` para las teclas + una capa propia de ventana flotante/arrastrable,
o todo propio.)*

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

### 5. Pantalla de inicio del TPV personalizable (Glop)
**Referencia:** FAQ Glop "personalizar la pantalla de inicio del TPV". Glop deja configurar:
- **Fondo (wallpaper)** hasta 1920x1080 y **logo** hasta 110x110.
- **Colores / skins** (esquemas predefinidos) y **tamaños de letra**.
- Hasta **2 enlaces** personalizados en el menú principal + un **botón auxiliar** de acceso rápido.
- **Personalización de la pantalla de ventas POR terminal** (Config → Terminales → modificar).
- Adaptación a **tablet 10"** vía "tipo de pantalla".

**Qué tenemos ya:** `tenant_branding` (logo, colores, título/subtítulo kiosko, colores de mesa) +
tema claro/oscuro + `setting tpv.botones` (tamaño texto, columnas, foto). La web es responsive
(tablet ✓).
**Gaps:** enlaces personalizados + botón auxiliar en el inicio; personalización **por terminal**
(hoy la marca es del bar entero, no por equipo). → Encaja con el **lanzador** (punto 2).

### 6. Menú de Configuración estilo Glop — mapeo con lo nuestro
El menú de config de Glop y dónde lo tenemos (casi todo existe, en el backoffice):

| Glop (Configuración) | En Gluuh |
|---|---|
| Perfiles de Usuario | `perfil` (roles/permisos) ✅ |
| Sedes / franquicias | `tenant`/`location` (multi-sede parcial) 🟡 |
| Grupos de terminales | `grupo_punto_venta` ✅ |
| Zonas de Impresión | rutas/zonas de impresión (`print_route`/`printer`) ✅ |
| Terminales | `device` ✅ (gestión nueva de dispositivos) |
| Salones | `room` ✅ |
| Imágenes mesas | `restaurant_table.sprite` / plano ✅ |
| Skins | tema + `tenant_branding` ✅ |
| Activación puntos | módulo fidelización 🟡 |
| Formas de Pago | `payment_method` ✅ (recién sembrado, 0106) |
| Impuestos | `tax_rate` ✅ (global) |
| Desglose de monedas | arqueo por denominación 🟡 (revisar) |
| Conceptos de caja | movimientos de caja / categorías 🟡 (revisar) |
| Mi Glop | cuenta/licencia (`tenant`/`licencia`) ✅ |

**Conclusión:** la mayoría del menú de Glop **ya lo tenemos** en el backoffice. Lo que falta es
(a) presentarlo como un **menú de config táctil accesible desde el TPV** (punto 2/3), y (b) un
par de piezas sueltas (desglose de monedas, conceptos de caja, enlaces del inicio) — a revisar.

## Por analizar (manuales que el cliente irá pasando)
- [ ] Lanzador de inicio de Glop (opciones exactas).
- [ ] Teclado en pantalla de Glop (numérico vs completo, dónde sale).
- [ ] Selección masiva de artículos por familia (visto en promociones).
- [ ] Tarifas de venta.
- [ ] Actualización de precios.
- [ ] (ir añadiendo)
