# Inventario de diseños (mockups del cliente)

Ficheros en `docs/diseño/`. El cliente diseña el HTML; yo lo implemento en Next/Tailwind,
cableo los datos reales, auto-alojo fuentes y meto el teclado en pantalla. **Regla: todo
autocontenido, sin CDN ni fuentes de fuera** (el nodo va offline).

## Páginas (rutas completas)

| Fichero | Ruta / función | Tema | Estado |
|---|---|---|---|
| `gluuh-inicio-diseño.html` | `/inicio` — lanzador | **OSCURO** | ✅ implementado (usa Google Fonts → cambié a next/font) |
| `gluuh-mantenimiento-articulos.html` | Config de artículos (back office / config táctil desde el TPV) | CLARO | ⏳ diseñado |
| `gluuh-pantalla-configuracion-menu.html` | **Configuración del menú** (crear/componer: grupos + opciones) → `menu`/`menu_group`/`menu_choice` | CLARO | ⏳ diseñado |
| `gluuh-pantalla-mantenimiento-terminales.html` | **Mantenimiento de terminales** (gestión de dispositivos: crear, credencial, zona) → `device` | CLARO | ⏳ diseñado |

## Modales (overlay sobre la pantalla de ventas del TPV)

| Fichero | Modal | Tema | Estado |
|---|---|---|---|
| `gluuh-cobro-claro.html` | **Cobro** (M1) — pago dividido, tipo doc, cliente, propina, F10/F11/F12 | CLARO | ⏳ diseñado ⭐ |
| `gluuh-dividir-cuenta.html` | **Dividir cuenta** (manual/automática, cobrar todos) | CLARO | ⏳ diseñado |
| `gluuh-comentarios-extras.html` | **Comentarios + opciones + extras** de un artículo (full-screen) | CLARO | ⚠️ **A MEJORAR** (cliente) |
| `gluuh-modal-formato-combinado.html` | **Formato + combinado** (copas: producto→formato→con qué→línea) | CLARO | ⏳ diseñado |
| `gluuh-modal-invitaciones-descuentos.html` | **Invitaciones + descuentos** (por línea o toda la cuenta, consumo propio) | CLARO | ⏳ diseñado |
| `gluuh-modal-utilidades.html` | **Utilidades** (menú de herramientas del TPV) | CLARO | ⏳ diseñado |
| `gluuh-articulo-rapido.html` | **Alta/config rápida de artículo** desde ventas | CLARO | ⏳ diseñado |
| `gluuh-modal-menu-seleccion.html` | **Selección del menú** al vender (grupo → rejilla con fotos → elegir) → `MenuModal` (rediseñar al estilo Glop) | CLARO | ⏳ diseñado |

## Señal clara: la operativa es CLARA

Casi todos los diseños son **CLARO** ("mismo lenguaje que el TPV"). Solo el **lanzador** es
oscuro. → Decisión que se impone sola: **operativa = tema CLARO**. Pendiente: **rehacer el
lanzador `/inicio` en claro** para que todo case (era la opción (a) de la consistencia).

## `gluuh-comentarios-extras` — a mejorar
El cliente dice que hay que mejorarlo. Referencia buena: la captura de Glop "ENTRECOT" (M4 del
backlog) → **dos columnas**: izq. comentarios del grupo (poco hecho / al punto / sin salsa…)
con checkbox; der. **extras** (pimienta, roquefort…) con **unidades ±**; botón **comentario
manual** (teclado en pantalla) y **Guardar**. Cuando el cliente afine el HTML, lo implemento.

## Orden de implementación propuesto
1. **Decidir claro/oscuro** (parece CLARO) → rehago `/inicio` en claro.
2. **Cobro (M1)** — el más completo y de más valor.
3. **Utilidades** (menú que abre el resto).
4. Dividir cuenta · Invitaciones/descuentos · Formato/combinado · Artículo rápido.
5. **Comentarios/extras** (cuando el cliente lo mejore).
6. **Mantenimiento de artículos** (config).

Cada uno: adaptar a Next/Tailwind, cablear datos reales (ticket, formas de pago, catálogo…),
integrar el teclado, respetar operativa (camarero) vs backoffice (dueño).
