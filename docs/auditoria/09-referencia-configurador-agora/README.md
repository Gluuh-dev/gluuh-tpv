# 09 — Referencia del configurador de Ágora (paridad funcional)

> Inventario **página a página** del configurador (administración web) de Ágora, capturado del entorno real de *Sabores de La Palma*. Para cada pantalla anotamos: **qué campos/opciones tiene Ágora**, **qué necesitamos nosotros**, **cómo lo mapeamos** a nuestro modelo (Supabase + `@gluuh/core`) y **dónde mejorarlo**. Objetivo: alcanzar paridad funcional y superarla, no copiar la UI (la nuestra sigue la dirección de diseño Supabase/Notion).
>
> Documento **vivo**: se completa según se reciben capturas. Cada ficha enlaza con **[07 — Configuración y administración](../07-configuracion-y-administracion/)** (modelo de datos de config) y con la fiscalidad **[../07-facturacion-y-cumplimiento-legal.md](../../07-facturacion-y-cumplimiento-legal.md)**.

---

## Menú de primer nivel de Ágora (confirmado por capturas)

La barra lateral del configurador (`setup`) tiene estas secciones de nivel superior:

```
★ Favoritos          (accesos directos del usuario)
🏛  Administración     ← empresa, locales, series, plantillas, tipos de cliente, periodos…
📦 Compras y Stocks   ← proveedores, pedidos de compra, almacenes, inventario
⚙  Herramientas
📊 Informes
ℹ  Ayuda
⏻  Cerrar Sesión
```

Ruta de ejemplo observada: `172.16.2.83:8984/#/admin/labels` (servidor **local** en LAN, puerto 8984 — coherente con la arquitectura offline/LAN de [01](../01-arquitectura-y-plataforma/)).

## Cómo está organizado

Replicamos esa jerarquía en subcarpetas:

```
09-referencia-configurador-agora/
├── README.md                  ← este índice + leyenda
├── administracion/
│   ├── empresa.md             ← datos fiscales de la empresa (titular)
│   ├── locales.md             ← «Editar Local» = configuración global (pagos, series, cierre, operativa…)
│   ├── series.md              ← numeración legal de documentos
│   ├── plantillas-ticket.md   ← editor de plantillas de ticket/factura
│   ├── plantillas-etiquetas.md
│   ├── tipos-clientes.md · clientes.md
│   ├── periodos-servicio.md
│   ├── puntos-de-venta.md     ← terminales (config por dispositivo) + grupos
│   ├── usuarios-y-perfiles.md ← RBAC (empleados + permisos)
│   └── administracion-web.md
├── productos/
│   ├── clasificacion.md        ← Grupos Mayores · Familias · Categorías (taxonomía)
│   ├── producto.md             ← ★ Editar Producto: nombres múltiples, añadidos, precios por tarifa
│   ├── menus.md · alergenos.md · etiquetas.md · entradas.md
├── cocina/
│   ├── estaciones-y-pases.md   ← Tipos de Preparación (estación) + Órdenes de Preparación (pase)
│   ├── notas-y-motivos.md      ← notas de cocina predefinidas + motivos de cancelación
│   ├── plantillas-comandas.md  ← formato del ticket de cocina
│   └── monitores-cocina.md     ← ★ KDS: alcance, botones, estados, estilos por tiempo
└── compras-stocks/             ← sección "Compras y Stocks" (doc 06)
    ├── proveedores.md
    ├── almacenes.md             ← PMP, series de compra, reposición
    ├── documentos-compra.md     ← Pedido → Albarán → Factura de proveedor
    ├── unidades-medida.md       ← unidades + factores de conversión
    ├── inventario.md            ← movimientos, variaciones (ajuste/traspaso/recuento), fabricación, cierres
    └── app-almacen.md           ← PWA táctil de almacén (recepción/recuento/mermas/traspasos)
└── herramientas/
    ├── exportar-productos.md    ← export catálogo/inventario a Excel/CSV
    ├── planos-mesas.md          ← ★★ editor gráfico de plano de sala (DnD, suelos, elementos, ubicaciones)
    ├── acciones-personalizadas.md ← botones de cobro directo / URL-app
    ├── configuracion-botones.md ← perfiles de botonera por dispositivo
    ├── ordenar-productos.md     ← orden de productos/familias/categorías en pantalla
    ├── precios.md               ← Precios: programador de tarifas, márgenes, modif. masiva, etiquetas, import/export
    ├── verifactu.md             ← ★ config emisor + visor de cadena VERIFACTU
    ├── control-efectivo.md      ← cajones inteligentes (Cashlogy/CashDro…)
    ├── copias-seguridad.md      ← backup manual + automático
    ├── formacion.md             ← modo entrenamiento (ventas no fiscales)
    ├── carta-digital.md         ← SmartMenu / carta QR
    ├── pasarela-cobro-mesa.md   ← integración datáfono (puerto, mapeos)
    ├── config-pago-pedidos.md   ← ★ modos: Scan&Pay, Pedido en Mesa, Delivery, Take Away
    ├── recursos.md              ← multi-idioma / traducciones
    └── mantenimiento.md         ← auditoría · eliminar tickets (⚠ fiscal) · generar QRs de mesa
└── informes/
    └── README.md                ← ★ catálogo Ágora + propuesta Gluuh priorizada + arquitectura (qué y cómo)
```
> Herramientas agrupa: **Visualización** (planos, botonera, orden, acciones), **Precios** (`precios.md`), **Sistema** (verifactu, control-efectivo, copias, formación, mantenimiento) y **Online/Pedidos** (carta-digital, pasarela-cobro-mesa, config-pago-pedidos, recursos).

> **Pestañas colapsadas:** cuando una captura muestra una sección plegada sin su contenido, la ficha **propone las opciones que creemos necesarias**, marcadas como **`[propuesta]`** (a petición del usuario). Si luego despliegas esa pestaña, se ajusta a lo real.

## Leyenda de cada ficha

| Sección | Para qué |
|---------|----------|
| **Ágora — qué muestra** | Transcripción fiel de campos y opciones de la captura. |
| **Qué necesitamos** | Lo que sí queremos en Gluuh (puede ser subconjunto o superconjunto). |
| **Mapeo a nuestro modelo** | Tabla/columna Supabase o módulo de `@gluuh/core` donde vive. |
| **Mejoras sobre Ágora** | Dónde podemos hacerlo más simple, más claro o más potente. |

> Convención de estado: ✅ ya existe en nuestro repo · 🟡 parcial · 🔴 falta. Se marca por campo cuando se conoce.

---

## Índice de páginas capturadas

| Sección | Página | Ficha | Estado doc |
|---------|--------|-------|-----------|
| Administración | Empresa | [`administracion/empresa.md`](administracion/empresa.md) | ✅ documentada |
| Administración | Editar Local (**= Configuración global**) | [`administracion/locales.md`](administracion/locales.md) | ✅ documentada |
| Administración | Series | [`administracion/series.md`](administracion/series.md) | ✅ documentada |
| Administración | Plantillas de Ticket | [`administracion/plantillas-ticket.md`](administracion/plantillas-ticket.md) | ✅ documentada |
| Administración | Plantillas de Etiquetas | [`administracion/plantillas-etiquetas.md`](administracion/plantillas-etiquetas.md) | ✅ documentada |
| Administración | Tipos de Clientes | [`administracion/tipos-clientes.md`](administracion/tipos-clientes.md) | ✅ documentada |
| Administración | Grupos de Periodos de Servicio | [`administracion/periodos-servicio.md`](administracion/periodos-servicio.md) | ✅ documentada |
| Administración | Clientes | [`administracion/clientes.md`](administracion/clientes.md) | ✅ documentada |
| Administración | Puntos de Venta (terminales) + Grupos | [`administracion/puntos-de-venta.md`](administracion/puntos-de-venta.md) | ✅ documentada |
| Administración | Usuarios y Perfiles (RBAC) | [`administracion/usuarios-y-perfiles.md`](administracion/usuarios-y-perfiles.md) | ✅ documentada |
| Administración | Administración Web | [`administracion/administracion-web.md`](administracion/administracion-web.md) | ✅ documentada |
| Administración | **Impuestos** ★ (fiscal) | [`administracion/impuestos.md`](administracion/impuestos.md) | ✅ documentada |
| Administración | Formas de Pago | [`administracion/formas-de-pago.md`](administracion/formas-de-pago.md) | ✅ documentada |
| Administración | Tarifas (listas de precio) | [`administracion/tarifas.md`](administracion/tarifas.md) | ✅ documentada |
| Administración | Centros de Venta (zonas/salas) | [`administracion/centros-de-venta.md`](administracion/centros-de-venta.md) | ✅ documentada |
| Administración | Promociones (automáticas) | [`administracion/promociones.md`](administracion/promociones.md) | ✅ documentada |
| Administración | Descuentos (manuales) | [`administracion/descuentos.md`](administracion/descuentos.md) | ✅ documentada |
| Productos | Grupos Mayores · Familias · Categorías | [`productos/clasificacion.md`](productos/clasificacion.md) | ✅ documentada |
| Productos | Etiquetas (tags) | [`productos/etiquetas.md`](productos/etiquetas.md) | ✅ documentada |
| Productos | **Editar Producto** (ficha central) ★ | [`productos/producto.md`](productos/producto.md) | ✅ documentada |
| Productos | Menús (combos / menú del día) | [`productos/menus.md`](productos/menus.md) | ✅ documentada |
| Productos | Alérgenos (14 UE) | [`productos/alergenos.md`](productos/alergenos.md) | ✅ documentada |
| Productos | Entradas (vales canjeables) | [`productos/entradas.md`](productos/entradas.md) | ✅ documentada |
| Cocina | Tipos de Preparación + Órdenes (estaciones/pases) | [`cocina/estaciones-y-pases.md`](cocina/estaciones-y-pases.md) | ✅ documentada |
| Cocina | Notas de Preparación + Motivos de Cancelación | [`cocina/notas-y-motivos.md`](cocina/notas-y-motivos.md) | ✅ documentada |
| Cocina | Plantillas de Comandas | [`cocina/plantillas-comandas.md`](cocina/plantillas-comandas.md) | ✅ documentada |
| Cocina | **Monitores de Cocina (KDS)** ★ | [`cocina/monitores-cocina.md`](cocina/monitores-cocina.md) | ✅ documentada |
| Compras y Stocks | Proveedores | [`compras-stocks/proveedores.md`](compras-stocks/proveedores.md) | ✅ documentada |
| Compras y Stocks | Almacenes | [`compras-stocks/almacenes.md`](compras-stocks/almacenes.md) | ✅ documentada |
| Compras y Stocks | Documentos de compra (Pedido→Albarán→Factura) | [`compras-stocks/documentos-compra.md`](compras-stocks/documentos-compra.md) | ✅ documentada |
| Compras y Stocks | Unidades de Medida | [`compras-stocks/unidades-medida.md`](compras-stocks/unidades-medida.md) | ✅ documentada |
| Compras y Stocks | Inventario (movimientos·variaciones·fabricación·cierres) | [`compras-stocks/inventario.md`](compras-stocks/inventario.md) | ✅ documentada |
| Compras y Stocks | App de Almacén (PWA táctil) | [`compras-stocks/app-almacen.md`](compras-stocks/app-almacen.md) | ✅ documentada |
| Herramientas | Exportar Productos | [`herramientas/exportar-productos.md`](herramientas/exportar-productos.md) | ✅ documentada |
| Herramientas | **Planos de Mesas (editor de sala)** ★★ | [`herramientas/planos-mesas.md`](herramientas/planos-mesas.md) | ✅ documentada |
| Herramientas | Acciones Personalizadas | [`herramientas/acciones-personalizadas.md`](herramientas/acciones-personalizadas.md) | ✅ documentada |
| Herramientas | Configuración de Botones | [`herramientas/configuracion-botones.md`](herramientas/configuracion-botones.md) | ✅ documentada |
| Herramientas | Ordenar productos/familias/categorías | [`herramientas/ordenar-productos.md`](herramientas/ordenar-productos.md) | ✅ documentada |
| Herramientas | Precios (programador, márgenes, masiva, etiquetas, Excel) | [`herramientas/precios.md`](herramientas/precios.md) | ✅ documentada |
| Herramientas | VERIFACTU (config + visor) ★ | [`herramientas/verifactu.md`](herramientas/verifactu.md) | ✅ documentada |
| Herramientas | Control de Efectivo (cajones inteligentes) | [`herramientas/control-efectivo.md`](herramientas/control-efectivo.md) | ✅ documentada |
| Herramientas | Copias de Seguridad | [`herramientas/copias-seguridad.md`](herramientas/copias-seguridad.md) | ✅ documentada |
| Herramientas | Formación (modo entrenamiento) | [`herramientas/formacion.md`](herramientas/formacion.md) | ✅ documentada |
| Herramientas | Cartas Digitales (SmartMenu) | [`herramientas/carta-digital.md`](herramientas/carta-digital.md) | ✅ documentada |
| Herramientas | Pasarela de Pago — Cobro en Mesa | [`herramientas/pasarela-cobro-mesa.md`](herramientas/pasarela-cobro-mesa.md) | ✅ documentada |
| Herramientas | Config. de Pago y Pedidos (modos) ★ | [`herramientas/config-pago-pedidos.md`](herramientas/config-pago-pedidos.md) | ✅ documentada |
| Herramientas | Recursos (multi-idioma) | [`herramientas/recursos.md`](herramientas/recursos.md) | ✅ documentada |
| Herramientas | Mantenimiento (auditoría·purga·QRs) | [`herramientas/mantenimiento.md`](herramientas/mantenimiento.md) | ✅ documentada |
| Informes | **Catálogo + propuesta Gluuh** ★ | [`informes/README.md`](informes/README.md) | ✅ documentada |
| Ayuda | Acerca de — Licencia y módulos | [`licencia-y-modulos.md`](licencia-y-modulos.md) | ✅ documentada |

*(Se irán añadiendo filas conforme lleguen capturas: Centros de venta, Almacenes, Usuarios/Empleados, Formas de pago, Productos, Familias, Modificadores, Clientes, TPVs/Terminales, Impresoras, etc.)*
