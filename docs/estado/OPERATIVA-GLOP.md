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

### 2. Lanzador de inicio "Abrir TPV / Configuración" ⭐ (tiene diseño ya)
**Referencia:** Glop abre en un menú (Tarifas, Promociones… + "Acceso a TPV"). Ágora igual.

**Tensión:** hoy la app de escritorio carga **solo la operativa**. **Reconciliación:** el
lanzador ofrece **"Abrir TPV"** (directo) y **"Configuración"** (pide clave técnica/dueño →
backoffice). Entrada estilo Glop sin abrir la config a cualquiera.

**DISEÑO QUE PASÓ EL CLIENTE (mockup HTML "Gluuh · Inicio"):** ← la línea a seguir
- Fondo **oscuro morado Gluuh** (`#572370`) con degradados radiales y textura sutil de azulejo.
- **Barra superior:** marca (logo + "Gluuh") + chips de estado (reloj, punto verde de conexión,
  nodo) + pastilla de usuario (avatar + nombre + rol).
- **Saludo** ("Buenas tardes, …").
- **Rejilla de tiles:** un **HERO grande "TPV"** (2×2, con silueta de escudo, un par de stats
  —mesas abiertas, caja— y botón "Entrar →" blanco) + tiles secundarios (Equipo/camareros,
  Servidor/nodo, Ajustes…). Cada tile: placa con forma de **escudo** + título + descripción +
  **atajo de teclado** en la esquina (encaja con el teclado en pantalla).
- **Botón de ayuda ámbar** → modal con filas de opciones + caja con el ID del terminal.
- Interacciones: hover que levanta el tile, **anillo de foco accesible**, toast de feedback.
- Tipografías: **Bricolage Grotesque** (display), **DM Sans** (texto), **JetBrains Mono** (mono).

**⚠️ Ojo al construirlo:**
- El mockup carga las fuentes de **Google Fonts (CDN)** → **hay que auto-alojarlas** (el nodo
  no tiene internet). Regla de oro: nada que se baje de fuera.
- Adaptar de HTML suelto a **Next/Tailwind** (nuestra stack), y **cablear las acciones reales**:
  "Abrir TPV" → operativa; "Configuración" → clave técnica → backoffice; chips → estado real del
  nodo; stats del hero → datos reales.
- El mockup llegó **truncado** en el chat (imagen base64 gigante). Tengo el CSS y la estructura
  completos; si hace falta el HTML entero, que el cliente lo deje en un fichero.

**Estado:** existe `/inicio` pero flojo. **Con diseño ya** → buen candidato tras el teclado.

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

### 7. Cierre diario de caja (cierre Z) desde la operativa
**Referencia:** Glop — botón **"UTILIDADES"** (junto al teclado numérico de la pantalla de
ventas) → **"CIERRE DE DÍA"** (2ª fila del popup) → confirmación → imprime informes.
Si el terminal tiene **tickets/cuentas pendientes**, NO deja cerrar (avisa).

**Qué tenemos:** el backend de **la jornada** ya está (`z_de_jornada`, `cerrar_jornada` con
efectivo contado y descuadre, GLU04 si ya cerrada, cierre automático de madrugada). ✅
**Gaps:** el **acceso desde la operativa** (menú "Utilidades" → "Cierre de día"), la **guarda
de cuentas abiertas** antes de cerrar, y elegir qué **informes se imprimen** al cerrar.
→ Es sobre todo UX de operativa sobre backend ya hecho.

### 8. Accesibilidad / textos grandes (para problemas de vista)
**Referencia:** Glop — "Visor total de cobro GRANDE", aumentar contraste y fuente (2 niveles),
fuente por terminal, y opciones: ocultar barra de estado, **botones solo texto** (sin iconos),
quitar fondo blanco de botones, mostrar/ocultar decimales. Afecta pantalla de ventas y el
**visor de cobro** (el total que sale al cobrar).

**Qué tenemos:** tema claro/oscuro + tamaño de texto (`setting tpv.botones`). 🟡
**Gaps (valioso — dueños mayores):** **modo alto contraste**, **visor de cobro grande** (total
enorme al cobrar), fuente **por terminal**, toggles de accesibilidad. Barato y muy agradecido.

### 9. Modo DEMO / límites por licencia (modelo de negocio)
**Referencia:** Glop demo = 500 tickets con cabecera "DEMO" (la mitad si haces cierres),
edición de documentos desactivada, módulos bloqueados, forma de pago única. Indicador
"versión sin licencia activa" arriba y "DEMO" impreso en cada ticket.

**Qué tenemos:** `licencia_limites`, `tenant_module` (gating por módulo), `licencia_hasta`. 🟡
**Gap:** un **modo demo/trial** real (cabecera DEMO en tickets, tope de tickets, features
capadas) para vender. Es negocio, no operativa — para más adelante.

> Nota: los artículos de la web de Glop dan **poco detalle visual** (son texto). Para el
> aspecto (colores, tamaños, distribución) me sirven más las **capturas/vídeos** que pasas tú.

### 10. Reordenar artículos/familias de la pantalla de ventas ⭐ (cliente: "importante")
**Referencia:** Glop — Config → Terminales → modificar → Familias de venta. Dos columnas
(familias / artículos), reordena con **flechas** o metiendo el **nº de orden** + botón ORDEN.
Aplica al instante. Lo hace **por terminal**.

**Qué tenemos:** `category.orden` / `product.orden` + página `/ordenar-familias-y-categorias`
en el backoffice. ✅ (ordenación GLOBAL).
**Gaps:** (a) hacerlo **por terminal** (cada TPV con su propio orden), (b) **arrastrar táctil**
en vez de flechas/números. → Tenemos la base; falta la capa por-terminal y el drag táctil.
**Prioridad:** media-alta (el cliente lo marca importante).

### 11. Enviar facturas por email (SMTP saliente) 🆕 (cliente: "no lo tenemos, añadirlo")
**Referencia:** Glop — Utilidades → Configuración de correo (credenciales SMTP, carpeta de
copia, ruta PDF). En cobro: botón "Enviar por Email" → hasta 2 destinatarios → PDF. Mensaje
predefinido. "Verificar correo".

**Qué tenemos:** nada de email saliente. ❌
**Propuesta: AÑADIRLO.** Config SMTP por empresa (backoffice) + botón "Enviar factura por
email" en el cobro/factura → PDF al cliente. Ojo: **necesita internet** → en el nodo se
enviaría al estar online o se **encola** (como la sync). Esfuerzo medio, valor alto.
**Prioridad:** media (buen candidato).

### 12. Categorías/etiquetas de producto (cliente: "importante")
**Referencia:** Glop — "Tipo de Productos": 2 etiquetas complementarias para clasificar
artículos (Limpieza/Desechables, Marca/Temporada…), para filtrar en informes, stock y ofertas.

**Qué tenemos:** ✅ ya está — `etiqueta_producto` + `product_etiqueta` (etiquetas de producto),
además de familias + categorías + grupos mayores. Cubierto de sobra en el modelo.
**Gap posible:** exponer bien el **filtrado por etiqueta** en informes/ofertas. A revisar.

### 13. Tarjetas prepago / monedero (fidelización)
**Referencia:** Glop — tarjeta prepago ligada al cliente (recargar saldo, pagar con saldo).
Se activa en Activación puntos.

**Qué tenemos:** módulo fidelización (cliente + puntos), pero **no monedero/saldo prepago**. 🟡
**Criterio:** de nicho (gimnasios, piscinas, algunos bares con "bote"). Extensión del módulo
fidelización, **baja prioridad** salvo que un cliente concreto lo pida.

### 14. Cambiar datos fiscales de la licencia — AQUÍ SOMOS MEJORES
**Referencia:** Glop — los datos fiscales (nombre comercial, razón social, CIF, dirección,
teléfono) van en el **archivo de licencia** y **SOLO los cambia el distribuidor** con un
formulario; no se pueden tocar desde el software.

**Qué tenemos:** editables en el **panel** (`location`: razón social, CIF, dirección, nombre
comercial, teléfono) y se fijan en el alta/instalación. ✅ **Más flexible que Glop.**
**Ojo (VERIFACTU):** una vez emitiendo facturas, cambiar datos fiscales tiene implicaciones
(las facturas van firmadas con esos datos). Conviene avisar/controlar el cambio, no bloquearlo.

### 15. Actualizar versión conservando datos — VALIDA NUESTRO "MODO MANTENIMIENTO"
**Referencia:** Glop — subir de MiniGlop a Glop = **licencia nueva + copiar a mano** la BD
(`glop.fdb`), config (`glop.ini`) y diseños, **desinstalar con `unins000.exe` (NO por el Panel
de control)**, reinstalar y restaurar. Los datos se conservan si copias bien.

**Lo que confirma:**
- **`unins000.exe` es estándar de Inno Setup** (Glop lo usa igual) → nuestra decisión del
  acceso directo "Desinstalar" apuntando a `unins000` es correcta.
- **Conservar datos al actualizar** es justo el **modo mantenimiento** que propusimos para
  nuestro instalador. Glop lo hace **a mano** (backup+restore); nosotros podemos hacerlo
  **automático** (Reinstalar/Reparar conservando datos). → Buen argumento para priorizarlo.
- **MiniGlop = versión capada** (sin stock/compras/proveedores) → mapea a nuestro gating por
  **módulos/licencia** (`licencia_limites`, `tenant_module`). Ya lo tenemos.

## Cobertura completa — las 96 FAQs de Glop mapeadas

> Leyenda: ✅ lo tenemos · 🟡 parcial / falta UX · 🆕 hueco real (añadir) · ⛔ no aplica
> (cosas de su Firebird/licencia/Android que nosotros resolvemos distinto).

**Primeros pasos**
| Glop | Estado | Nota |
|---|---|---|
| 01/07 Cierre de día (caja) | 🟡 | Motor (jornada) ✅; falta UX operativa "Utilidades→Cierre" |
| 02 Personalizar documento venta | ✅ | `plantilla_ticket` |
| 03 Optimizar ventas tablet 10" | 🟡 | web responsive ✅; pulir táctil |
| 04 Ajuste textos (vista) | 🟡🆕 | accesibilidad: alto contraste + visor grande (gap) |
| 05 Tipos de familia | ✅ | `family` |
| 06 Personalizar pantalla inicio | ⭐ | **lanzador** (ya con diseño) |
| 08 Limitaciones demo | 🟡 | modo demo/trial (negocio) |

**Configuración**
| Glop | Estado | Nota |
|---|---|---|
| 09 Error GlopDroid | ⛔ | su Android |
| 10 Tarjetas prepago | 🟡 | monedero, nicho |
| 11 Orden artículos/familias | 🟡 | orden global ✅; falta por-terminal + drag táctil |
| 12 Correo saliente (email facturas) | 🆕 | **añadir** (SMTP + enviar PDF) |
| 13 Nuevas categorías producto | ✅ | `etiqueta_producto` + category |
| 14 Cambiar datos licencia | ✅ | editable en panel (mejores que Glop) |
| 15/19 Actualizar versión | 🟡 | **modo mantenimiento** del instalador |
| 16 Activar licencia | ✅ | licencia/código |
| 17 Error fichero licencia | ⛔ | su modelo de licencia |
| 18 Requisitos Firebird | ⛔ | nosotros Postgres/nodo |
| 20 Config regional Windows | ✅ | web, no dependemos (mejor) |
| 21 Cambiar símbolo/moneda | 🟡 | EUR fijo (España); multimoneda lejano |

**Artículos y formatos**
| Glop | Estado | Nota |
|---|---|---|
| 22 Stock a cero | 🟡 | stock |
| 23/34 Borrar/crear familia | ✅ | `family` |
| 24 Configurar categorías | ✅ | `category` |
| 25 Artículos heladería | ✅ | caso de uso del catálogo |
| 26 Ordenar alfabéticamente | 🟡 | añadir botón "ordenar A-Z" |
| 27 Cambios en toda la familia | 🟡 | **edición/selección masiva** (visto en promociones) |
| 28 Menú hostelería | ✅ | `menu`/`menu_group` |
| 29 Unificar ingredientes extra | ✅ | `modifier` |
| 30 Escandallo | 🟡 | `recipe_item` |
| 31 Etiqueta talla/color | 🟡 | comercio (formatos) |
| 32 Oferta/promoción/rebajas | ✅ | `promocion`/`offer` |
| 33 Grupo trabajo formato | 🟡 | grupo_pv/formato |
| 35 Tipos de artículo | ✅ | product tipos |

**Empleados**
| Glop | Estado | Nota |
|---|---|---|
| 36 Control de presencia | 🆕 | **fichaje/horas** (gap, si interesa) |
| 37/38 Crear/modificar empleados+permisos | ✅ | `app_user`/`perfil` |

**Ventas y TPV** (core operativa)
| Glop | Estado | Nota |
|---|---|---|
| 39 Precios masivos + tarifa camarero | 🟡 | `tarifa` ✅; cambio masivo 🟡 |
| 41 Abonar ticket/factura | 🟡 | abono/refund |
| 42 Abrir/cerrar turno (varios terminales) | 🟡 | turno/`cash_session` |
| 43 Tickets reembolso/regalo | 🟡 | comercio |
| 44/50 Invitaciones/consumo propio | 🟡 | `tipo_operacion` |
| 45 Códigos barras diferidos | 🟡 | comercio |
| 46 Borrar ventas | ✅ | anulación |
| 47 Traspaso entre mesas | ✅ | traspaso |
| 48 Dividir cuenta | 🟡 | split bill |
| 49 Crear salón | ✅ | `room` |
| 51 Anular líneas/descuentos línea | ✅ | |
| 52 Ventas pendientes | ✅ | aparcar (`aparcado_como`) |
| 53 Artículo combinado | ✅ | combinado/menú |
| 54 Realizar venta | ✅ | core TPV |

**Impresoras/zonas**
| Glop | Estado | Nota |
|---|---|---|
| 55 "Su turno" cocina | 🟡 | |
| 56/59 Caracteres extraños | 🟡 | encoding impresión |
| 57 Instalar impresora | ✅ | ESC/POS (hardware) |
| 58 Zonas de impresión | ✅ | `print_route` |
| 60 Ver pedidos cocina otra zona | ✅ | KDS |
| 61 Logo con drivers | ✅ | `logo_ticket` |
| 62/63 Logo sin drivers/doble | 🟡 | ESC/POS logo |

**Documentos e informes**
| Glop | Estado | Nota |
|---|---|---|
| 64 Exportar CSV | 🆕 | export (gap posible) |
| 65/76/77/80/81/85 Informes/gráficos/por cliente | ✅ | backoffice (rendimiento, top-50, ventas-diarias) |
| 66/72/83/84 Stock/inventario/import | 🟡 | módulo stock |
| 67 Comensales | ✅ | informes |
| 68 Numeración tickets | ✅ | `serie_factura` |
| 70 Modelo 347 | 🆕 | **modelo AEAT** (fiscal, gap) |
| 71 Sistema de encargos | 🟡 | encargos/pre-pedidos |
| 75 No Más Tickets | 🟡 | factura-e / sin ticket |
| 82 Imprimir A4 | 🟡 | |
| resto (73/74/78/79) diseños/guardar docs | 🟡✅ | plantillas de documento |

**Personalización**
| Glop | Estado | Nota |
|---|---|---|
| 86 Tamaño imágenes ventas | ✅ | `setting tpv.botones` |
| 87 Logo+texto pantalla cobro | 🟡 | visor de cobro |

**Módulos**
| Glop | Estado | Nota |
|---|---|---|
| 88/89 Comunicaciones/Envío-Recibo | ✅ | nuestra **sync nodo↔nube** |
| 90 Módulo Android | ✅ | mobile/comandera (Expo) |

**Base de datos**
| Glop | Estado | Nota |
|---|---|---|
| 91 Limpieza BD | 🟡 | mantenimiento |
| 92/94 Error inicio / Glop en red Firebird | ⛔ | nosotros Postgres/nodo (mejor) |
| 93 Importación artículos | 🆕 | import catálogo (gap) |
| 95 Cierre de año | 🟡 | cierre anual (fiscal) |
| 96 Restaurar copia | ✅ | copia nube + local |

### Huecos REALES que salen de las 96 (lo que de verdad no tenemos)
1. **Teclado en pantalla** (transversal) ⭐
2. **Lanzador de inicio** (ya con diseño) ⭐
3. **Email de facturas** (SMTP) 🆕
4. **Accesibilidad** (alto contraste + visor de cobro grande) 🆕
5. **Modo mantenimiento** del instalador (actualizar sin borrar) 🆕
6. **Edición/selección masiva** de artículos (cambios por familia, precios masivos) 🆕
7. **Reordenar ventas por terminal + drag táctil** 🟡
8. **Fiscal AEAT extra**: modelo 347, cierre de año 🆕 (si el mercado lo pide)
9. **Import/Export** catálogo (CSV / .txt) 🆕
10. **Control de presencia / fichaje** 🆕 (opcional)
11. Modo **demo/trial** (negocio) 🟡

Todo lo demás (el ~75%) **ya lo tenemos** o lo resolvemos mejor (web/nodo vs su Firebird).

## Cómo debe VERSE (dirección visual) — honestidad sobre las fuentes

**Aviso honesto:** los artículos de texto de la web de Glop dan **poco detalle visual** (son
FAQs de texto). Para "cómo debe verse" las fuentes buenas son las **imágenes/mockups**, no los
artículos. Lo que SÍ tenemos y manda:

1. **El mockup del cliente** `docs/diseño/gluuh-inicio-diseño.html` — **la referencia visual
   nº1.** Define el estilo Gluuh: oscuro **morado `#572370`**, moderno, por **tiles**, botones
   grandes, placa en forma de **escudo**, degradados, foco accesible. → Es el norte del look.
2. **Capturas de Ágora** (config-una-vez, pantallas de conexión) → patrón "configura y se queda".
3. **Capturas de Glop** (menú de config verde, selección masiva por familia) → estructura de
   navegación y edición masiva.

**Regla de estilo (dos mundos, ya en el proyecto):**
- **Operativa** (TPV, camarero, táctil): estilo **Glop/Ágora** — colorido, botones GRANDES,
  marca del cliente, oscuro Gluuh del mockup. NADA de estilo backoffice aquí.
- **Backoffice** (dueño, ratón): estilo **Supabase/Notion** (el que ya tiene el panel).

El teclado en pantalla ya sigue el look (morado Gluuh, botones grandes). Cada pieza nueva de la
operativa se hace con la **paleta y el estilo del mockup**, no con el del backoffice.

> Si el cliente quiere que clave un aspecto concreto (una pantalla igual que una captura suya),
> que pase LA IMAGEN — de un artículo de texto no se saca el pixel.

## Modales de la operativa (CAPTURAS de Glop — referencia visual buena)

El cliente pasó capturas de los modales del TPV de Glop (verde, botones grandes, acento
naranja en la acción principal). Son la referencia visual para construir/afinar los nuestros.

### M1. Cobrar (VISOR DE COBRO) — captura "Cobrar mesa 4" ⭐ = prioridad #2
Es LA pantalla de cobro. Elementos de Glop:
- Cabecera: **Cliente / Empleado / Terminal** (con toggles) + **Tipo de documento** (Fra.
  simplificada / completa) + Fecha + Importe + Base imponible + Impuesto + Descuento.
- **Total GRANDE** centrado (40,00) + **teclado numérico**.
- **Formas de pago** en lista grande: CONTADO, TARJETA, CHEQUE, PAGO QR (→ Efectivo/Tarjeta/
  Bizum/QR en lo nuestro).
- **PAGO DIVIDIDO**: 3 líneas de importe (paga una parte en efectivo, otra en tarjeta). ← gap
- **Descuento** y **Propina**.
- **A devolver** (cambio) grande en verde.
- Zonas de impresión (activadas).
- Pie: Cancelar · **Enviar por Email** · Imprimir cuenta (F10) · Cobrar Imprimir (F11) · **Cobrar (F12)** (naranja).

**Qué tenemos:** `CobrarModal` (con propina, cambio). **Gaps vs Glop:** pago DIVIDIDO en varias
formas, selector de **tipo de documento**, selector de **cliente**, **enviar por email** (feature
ya apuntada). → La captura #4 es EL diseño de referencia del visor de cobro.

**✅ DISEÑO HECHO por el cliente:** `docs/diseño/gluuh-cobro-claro.html` — autocontenido (CSS
inline, logo base64, JS plano, fuentes de sistema, SIN red ✅). Cubre TODO: pago dividido (3
líneas), tipo de documento, cliente/empleado/terminal, base+impuesto+descuento, notas, propina,
zonas de impresión, A devolver, y F10/F11/F12 + Enviar email. Táctil (tap 56px), foco accesible.
→ **Este es el mockup a implementar** para M1. Es **tema CLARO** (paneles blancos, morado de
acento), "lenguaje de la app actual".

> ⚠️ **Coherencia claro/oscuro (decidir):** el **lanzador** que hice es OSCURO (mockup Gluuh);
> este **cobro es CLARO** (app actual). Hay que decidir si la operativa es clara u oscura para
> que todo case. Opciones: (a) operativa CLARA (cobro manda, y reharía el lanzador claro), (b)
> operativa OSCURA (rehacer el cobro oscuro), (c) el TPV en claro y solo el lanzador oscuro (a
> propósito). Lo dejo como pregunta al cliente.

### M2. Dividir cuenta — captura "Dividir cuenta"
- "Divide el documento en tantos como necesites". Ticket Actual a la derecha.
- Controles: **Nº Docs** (spinner ±), **División manual**, **División automática**, **Unidades**
  (spinner ±), **Traspasar**, y Cancelar división / Abrir cajón / **Cobrar todos** / Cobrar.
**Qué tenemos:** split bill parcial (🟡). → Modal a construir con esta referencia.

### M3. Invitaciones en ticket — captura "Invitaciones en ticket"
- Tabla de artículos con checkbox. Acciones: **Invitar artículo(s)**, Anular invitación,
  **Entrada / consumo**, Anular entrada/cons, **Desglosar artículos**, Salir.
**Qué tenemos:** `tipo_operacion` (AUTOCONSUMO/invitación) 🟡. → Modal a construir.

### M4. Comentarios + extras del artículo — captura "ENTRECOT"
- Al tocar un producto con opciones: **dos columnas** → izq. **Comentarios** del grupo
  (POCO HECHO/AL PUNTO/MUY HECHO/SIN SALSA…) con checkbox; der. **Extras** (PIMIENTA, ROQUEFORT,
  BARBACOA) con **unidades ±**. Botón **Comentario manual** (→ teclado en pantalla), **Guardar**
  (naranja), Cancelar, flechas de orden.
**Qué tenemos:** `modifier` / `modifier_group` / `nota_preparacion` ✅ (motor). → Verificar que
nuestro modal de modificadores tiene ESTE layout (comentarios + extras con uds + comentario libre).

### M5. Home/launcher de Glop — captura "GLOP TPV HOSTELERIA"
- Barra de título con empresa/CIF/terminal. Sidebar izq: Menú, Manual, Demo guiada, Conoce tu
  negocio, **Acceso a TPV** (naranja grande). Sidebar der: **ARTÍCULOS** (familias, formatos,
  artículos, actualización de precios), **COMPRAS**, **UTILIDADES** (agenda, apuntes de caja),
  **GLOP** (Mi Glop, Salir, Apagar ordenador).
**Nuestro lanzador** (recién hecho) es más limpio y por tiles; el menú de config de Glop mapea a
nuestro **backoffice**. La captura confirma: **Acceso a TPV** destacado + config a un lado.
> Nota: "Apagar ordenador" desde el TPV es una idea útil para el mini-PC del bar (apagar limpio).

### Lo que FALTA de estos modales (resumen)
- **Pago dividido** en el cobro (parte efectivo + parte tarjeta) 🆕
- **Selector de tipo de documento** (simplificada/completa) en el cobro 🆕
- **Selector de cliente** en el cobro 🟡
- **Modal Dividir cuenta** (manual/automática) 🆕
- **Modal Invitaciones** 🟡
- Verificar **modal de comentarios+extras** con el layout de Glop 🟡
- (Idea) **Apagar el equipo** desde el menú del TPV 🟡

> El **vídeo de YouTube no lo puedo "ver"** (WebFetch no lee vídeo). Para el aspecto, las
> CAPTURAS como estas son lo que vale — sigue pasándolas.

## Por analizar (manuales que el cliente irá pasando)
- [ ] Lanzador de inicio de Glop (opciones exactas).
- [ ] Teclado en pantalla de Glop (numérico vs completo, dónde sale).
- [ ] Selección masiva de artículos por familia (visto en promociones).
- [ ] Tarifas de venta.
- [ ] Actualización de precios.
- [ ] (ir añadiendo)
