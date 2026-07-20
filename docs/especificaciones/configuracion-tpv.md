# Configuración del TPV — inventario completo

> Qué se configura hoy, dónde vive cada ajuste, qué falta por traer al terminal
> y qué falta por construir en cualquier sitio.
>
> Fuentes: `apps/tpv/src/apartados/config/`, `apps/web/app/(panel)/*`,
> Supabase `gxcqihslbicrszgzudjs` (lectura del 20-07-2026).

---

## 1. Resumen en tres frases

1. En **`apps/tpv`** la pantalla de Configuración tiene **22 secciones y funcionan 2**:
   Preferencias (tema del terminal) y **Productos** (mantenimiento de artículos completo,
   20-07). Las otras 20 son fichas de texto que dicen "esto se hace en el panel web".
   El patrón de pantalla para portar el resto está en
   [`mantenimiento/Marco.tsx`](../../apps/tpv/src/apartados/config/mantenimiento/Marco.tsx).
2. En **`apps/web`** la configuración sí existe y está mayormente implementada, repartida en
   **~30 páginas** más ~25 CRUDs de catálogo, contra **~40 tablas** de Supabase y la tabla
   clave-valor `setting`.
3. Lo que hace que el TPV se vea poco profesional no es que falte configuración: es que la
   pantalla **promete 22 secciones y no entrega ninguna**. Un rail con 22 puertas cerradas es
   peor que un rail con 6 puertas que abren.

---

## 2. Estado actual de `apps/tpv/src/apartados/config/`

| Fichero | Papel |
|---|---|
| [Configuracion.tsx](../../apps/tpv/src/apartados/config/Configuracion.tsx) | Toda la pantalla: rail, buscador, vista general, ficha, y el único ajuste real |
| [secciones.tsx](../../apps/tpv/src/apartados/config/secciones.tsx) | `GRUPOS`: constante estática con 8 dominios / 22 secciones. Sin fetch |
| [lib/tema.ts](../../apps/tpv/src/lib/tema.ts) | Único store: tema en `localStorage["gluuh_tema"]` |

- Acceso: tarjeta de Inicio o **F2**, con PIN/pulsera de rol `admin` **cada vez** (no se cachea).
- Sin router: `sel: Seccion | null` en estado local ([Configuracion.tsx:150](../../apps/tpv/src/apartados/config/Configuracion.tsx#L150)).
- Buscador funcional (normaliza acentos) que lleva a fichas inertes.
- Despacho literal en [Configuracion.tsx:221](../../apps/tpv/src/apartados/config/Configuracion.tsx#L221):
  `sel.id === "preferencias" ? <Preferencias/> : <FichaAlcance/>`.

### Las 22 secciones declaradas

| Grupo | Secciones | Funciona |
|---|---|---|
| Carta | **productos**, familias, categorías, modificadores, menús, ordenar | solo productos |
| Precios | tarifas, descuentos, promociones | ✗ |
| Salas y zonas | planos, centros de venta, puntos de venta, periodos de servicio | ✗ |
| Cobro | formas de pago, caja, impuestos, series | ✗ |
| Impresión | impresoras, ticket, comandas, etiquetas | ✗ |
| Terminales y pantallas | terminales, módulos | ✗ |
| Marca | marca | ✗ |
| Este terminal | botones, **preferencias** | sólo preferencias |

### Ajustes de terminal que existen pero NO están en Configuración

Contradicen directamente el grupo "Este terminal":

| Ajuste | Dónde vive hoy | Clave |
|---|---|---|
| Modo zurdo | `UtilidadesModal` dentro del TPV — [Tpv.tsx:46](../../apps/tpv/src/apartados/tpv/Tpv.tsx#L46) | `gluuh_zurdo` |
| Teclado en pantalla automático | [TecladoEnPantalla.tsx:273](../../apps/tpv/src/ui/TecladoEnPantalla.tsx#L273) | `CLAVE_AUTO` |
| Posición del teclado flotante | [TecladoEnPantalla.tsx:65](../../apps/tpv/src/ui/TecladoEnPantalla.tsx#L65) | `gluuh_teclado_pos` |
| Sesión del dispositivo | [operarios.ts:26](../../apps/tpv/src/apartados/acceso/operarios.ts#L26) | `SESION` |

---

## 3. Todo lo configurable, por área

Leyenda de **Estado**: ✅ implementado y consumido · 🟡 se guarda pero nadie lo lee ·
🔶 maqueta parcial · ❌ no existe.

### 3.1 Empresa, local y fiscalidad

| Qué se configura | Dónde (web) | Persistencia | Estado | ¿En TPV? |
|---|---|---|---|---|
| Nombre empresa, comercial, razón social, CIF | `/ajustes` | `tenant`, `location` | ✅ | ❌ |
| Contacto: persona, teléfono, email, web | `/ajustes` | `location` | ✅ | ❌ |
| Local: nombre, dirección, población, provincia, CP | `/ajustes` | `location` | ✅ | ❌ |
| **Territorio fiscal** (Península/Canarias/Ceuta-Melilla/PV/Navarra) | `/ajustes` | `location.territorio_fiscal` | ✅ | ❌ |
| Régimen de facturación (VERIFACTU/TicketBAI/Batuz) | — | `location.regimen_facturacion` | ❌ sin UI | ❌ |
| Tipos impositivos por territorio × clase fiscal | `/impuestos` | `tax_rate` (20 filas) | ✅ | ❌ |
| Series de facturación (código, tipo, predeterminada) | `/series` | `invoice_series` (**vacía**) | ✅ UI | ❌ |
| Serie del local | `/ajustes` | `location.serie_factura` | ✅ | ❌ |
| Serie fiscal VERIFACTU | `/configuracion-verifactu` | `setting: modulo.FISCAL.serie` | ✅ | ❌ |
| Certificado AEAT (mTLS) | `/configuracion-verifactu` | — sólo texto | 🔶 sin subida de fichero | ❌ |
| Estado VERIFACTU (prueba/producción) | `/configuracion-verifactu` | — banner fijo | 🔶 hardcodeado | ❌ |

### 3.2 Catálogo

| Qué | Página | Tabla | Filas | Estado |
|---|---|---|---|---|
| Productos (precio, clase fiscal, estación, PLU, código barras, alérgenos, al peso, tiempo prep.) | `/productos` | `product` | 150 | ✅ |
| Familias (orden, color, padre, grupo mayor, texto botón, foto, combinable) | `/familias` | `family` | 7 | ✅ |
| Categorías (orden, estación, icono, color, mostrar en venta/menús) | `/categorias` | `category` | 25 | ✅ |
| Producto en N categorías | — | `product_category` | 168 | ✅ |
| Formatos y precios por formato | `/productos` | `product_format`, `product_price` | 116 / 75 | ✅ |
| Modificadores y grupos (min/max sel, EXTRA/COMENTARIO) | `/modificadores` | `modifier`, `modifier_group` | 216 / 58 | ✅ |
| Asignación de grupos por familia/categoría/producto (INCLUIR/EXCLUIR) | `/modificadores` | `modifier_group_asignacion` | 14 | ✅ |
| Menús y combos | `/menus` | `menu`, `menu_group`, `menu_choice` | 2/8/30 | ✅ |
| Etiquetas de producto | `/etiquetas` | `etiqueta_producto` | 10 | ✅ |
| Notas y tipos de preparación | `/notas-preparacion`, `/tipos-preparacion` | `nota_preparacion` | 40 / 0 | ✅ |
| Alérgenos | `/alergenos` | `product.alergenos[]` | — | ✅ |
| Grupos mayores | `/grupos-mayores` | `grupo_mayor` | 0 | ✅ |
| Orden de familias/categorías y productos | `/ordenar-*` | `orden` | — | ✅ |
| **Horario de categoría** (franja + días) | — | `category_horario` | 0 | ❌ tabla sin UI |
| Categoría por centro de venta / grupo PV | — | `category_sales_center`, `category_grupo_pv` | 0 / 1 | ❌ sin UI |

### 3.3 Precios y promociones

| Qué | Página | Tabla | Estado |
|---|---|---|---|
| Tarifas (listas de precio) | `/tarifas` | `tarifa` (1), `product_price` | ✅ |
| Descuentos (% o €) | `/descuentos` | `discount` (**vacía**) | ✅ UI |
| Promociones (ventana fechas/horas/días, ámbito) | `/promociones` | `promocion` (**vacía**) | ✅ UI |
| Programación de tarifas | `/programacion-de-tarifas` | — | ❌ catch-all |
| Modificación global de precios | `/modificacion-global-de-precios` | — | ❌ catch-all |
| Importar/exportar precios y productos | `/importar-precios`, `/exportar-*` | — | ❌ catch-all |

### 3.4 Salas, mesas y organización de venta

| Qué | Página | Tabla | Filas | Estado |
|---|---|---|---|---|
| Salas (orden, suelo) | `/planos-de-mesas` | `room` | 2 | ✅ |
| Mesas (posición, rotación, capacidad, sprite, color) | `/planos-de-mesas` | `restaurant_table` | 21 | ✅ |
| Elementos decorativos del plano | `/planos-de-mesas` | `plano_elemento` | 5 | ✅ |
| Centros de venta | `/centros-venta` | `sales_center` | 0 | ✅ UI |
| Puntos de venta | `/puntos-venta` | `punto_venta` | 0 | ✅ UI |
| Grupos de punto de venta | `/modulos` | `grupo_punto_venta` | 2 | ✅ |
| Periodos de servicio (franjas horarias) | `/periodos-servicio` | `periodo_servicio` | 0 | ✅ UI |

### 3.5 Cobro y caja

| Qué | Página | Persistencia | Estado |
|---|---|---|---|
| Formas de pago (tipo, orden, **abre cajón**, cuenta de arqueo) | `/formas-pago` | `payment_method` (**vacía**) | ✅ UI · ⚠️ ver 4.3 |
| Fondo de caja inicial | `/configuracion-de-caja` | `setting: caja.fondo_inicial` | ✅ |
| Umbral de aviso de descuadre | `/configuracion-de-caja` | `setting: caja.umbral_descuadre` | ✅ |
| Arqueo ciego obligatorio | `/configuracion-de-caja` | `setting: caja.arqueo_ciego` | ✅ |
| Permitir vender con caja cerrada | `/configuracion-de-caja` | `setting: caja.vender_sin_caja` | 🟡 nadie lo lee |
| Abrir cajón al cobrar en efectivo | `/configuracion-de-caja` | `setting: caja.abrir_cajon_efectivo` | 🟡 nadie lo lee |
| Motivos de cancelación | `/motivos-cancelacion` | `cancel_reason` (vacía) | ✅ UI |
| Propinas: política y reparto | — | — | ❌ no existe |
| Redondeo / céntimos | — | — | ❌ no existe |
| Datáfono / integración de pago | `/configuracion-de-pago` | — | ❌ catch-all |

### 3.6 Impresión ⚠️ (dos sistemas conviviendo — ver 4.1)

| Qué | Página | Persistencia | Estado |
|---|---|---|---|
| Impresoras (nombre, IP/puerto o URI, ancho 58/80, copias, abre cajón, prueba) | `/configuracion-de-impresion` | `setting: impresion.config.impresoras` | ✅ lo consume el TPV |
| Enrutado de documentos (TICKET/FACTURA/COMANDA_COCINA/COMANDA_BARRA/TICKET_CAMARERO) | `/configuracion-de-impresion` | `setting: impresion.config` | ✅ |
| Reparto por estación | `/configuracion-de-impresion` | lectura de `product.estacion` | ✅ sólo lectura |
| IP del servidor + carpeta de backup del terminal | `/configuracion-de-impresion` → `ConfigTerminal` | **`config.json` del escritorio**, no Supabase | ✅ sólo en Electron |
| Plantilla de ticket (ancho, logo, CIF, dirección, texto libre, campos del cuerpo, pie, QR) | `/plantillas-ticket` | `setting: impresion.config.ticket` | ✅ |
| Impresoras (modelo alternativo: rol, transporte, destino, tipo EPSON/STAR) | `/impresoras` | `printer` (**vacía**) | ✅ UI, sin consumidor |
| Enrutado por estación × sala | `/impresoras` | `print_route` (**vacía**) | ✅ UI, sin consumidor |
| Cola de impresión | — | `print_job` | esqueleto |
| Plantillas de comanda / etiqueta | `/plantillas-comandas`, `/plantillas-etiquetas` | `plantilla_comanda`, `plantilla_etiqueta` (vacías) | 🔶 sólo nombre y descripción |

### 3.7 Usuarios, roles y seguridad

| Qué | Página | Tabla | Estado |
|---|---|---|---|
| Empleados (PIN, pulsera, perfil, activo, bloqueo por intentos) | `/empleados` | `app_user` (4) | ✅ |
| Perfiles + matriz de permisos | `/perfiles/[id]` | `perfil.permisos` jsonb (4) | ✅ |
| Catálogo de permisos | — | **hardcodeado** en `app/lib/permisos.ts` | ⚠️ no está en BD |
| Asignación usuario↔local | — | `app_user_local` (4) | ❌ sin UI |
| Override de permiso por usuario y local | — | `app_user_permiso` (0) | ❌ sin UI |
| Bloqueo del TPV (al cobrar / por inactividad + segundos) | `/seguridad` | `setting: tpv.bloqueo` | ✅ |
| MFA TOTP, passkeys, sesiones abiertas | `/seguridad` | Supabase Auth | ✅ |
| Clave técnica (zona técnica, 8 h en sessionStorage) | `/seguridad` | `tenant.clave_tecnica_hash` | ✅ |
| Política de PIN, registro de accesos, quién entra en Configuración | `/seguridad` | — | ❌ declarado como pendiente en la propia página |

### 3.8 Terminales, módulos y licencia

| Qué | Página | Persistencia | Estado |
|---|---|---|---|
| Activar/desactivar 13 módulos | `/modulos` | `tenant_module` (**vacía**) | ✅ |
| Catálogo de módulos | — | **hardcodeado** en `app/lib/modulos.ts` | ⚠️ no está en BD |
| Config por módulo (COCINA, PANTALLA, CARTELERIA, VISOR, KIOSKO) | `/modulos` | `tenant_module.config` jsonb | ✅ |
| Alta de terminal con código de 6 dígitos (10 min, un uso) | `/modulos` | `device.codigo_vinculacion` | ✅ |
| Grupo de punto de venta y estación KDS por dispositivo | `/modulos` | `device` | ✅ |
| Estado en línea (latido < 3 min) | `/modulos` | `device.ultima_conexion` | ✅ |
| Licencia: código, módulos incluidos, vigencia | `/modulos`, `/acerca-de` | `tenant.licencia_*`, `licencia` (vacía) | ✅ |
| Versión del nodo / actualizaciones | — | `nodo_release` (vacía) | ❌ sin UI |

### 3.9 Marca y pantallas de cliente

| Qué | Página | Tabla | Estado |
|---|---|---|---|
| Nombre comercial, logo color, logo b/n de tickets | `/personalizar` | `tenant_branding` (1) | ✅ |
| Color primario, secundario, de mesas, de sillas | `/personalizar` | `tenant_branding` | ✅ |
| Título y subtítulo del kiosko | `/personalizar` | `tenant_branding` | ✅ |
| Ofertas / cartelería (título, precio, emoji o media, color, orden) | `/personalizar` | `offer` (3) + Storage | ✅ |
| Plantilla y textos del kiosko | `/modulos` | `tenant_module.config` | ✅ |

### 3.10 Aspecto del TPV

| Qué | Página | Persistencia | Estado |
|---|---|---|---|
| Columnas (auto/6/8/10), tamaño de texto, mostrar precio, mostrar foto | `/configuracion-de-botones` | `setting: tpv.botones` | ✅ lo consume el TPV |
| Orden de los botones de funciones | `/ajustes` | `setting: tpv.funciones.orden` | ✅ |
| Categoría de combinados | `/ajustes` | `setting: tpv.combinados.categoria_id` | ✅ |
| **Tema claro/oscuro** | **TPV › Configuración › Preferencias** | `localStorage: gluuh_tema` | ✅ único ajuste local |

### 3.11 Clientes

| Qué | Página | Tabla | Estado |
|---|---|---|---|
| Clientes (datos fiscales, tarifa, % descuento, saldo, puntos, consentimiento) | `/clientes` | `customer` (2) | ✅ |
| Tipos de cliente | `/tipos-cliente` | `customer_type` (0) | ✅ UI |
| Reservas | — | `reservation` (3) | parcial |
| Fidelización: reglas de puntos, canje | — | — | ❌ hay columnas, no hay reglas |

### 3.12 Copias de seguridad y nodo

| Qué | Página | Persistencia | Estado |
|---|---|---|---|
| Hora de la copia automática | `/copias-de-seguridad` | `setting: backup.hora` | 🟡 el escritorio no lo lee |
| Carpeta/USB de destino | `/copias-de-seguridad` | `setting: backup.destino` | 🟡 el escritorio no lo lee |
| Copia manual | `/copias-de-seguridad` | `setting: backup.ultima` | ✅ sólo en Electron |
| Restaurar copia | — | — | ❌ no existe |

### 3.13 Compras y stock (esqueleto completo)

`supplier`, `warehouse`, `unit_of_measure`, `ingredient`, `recipe_item`, `stock_move` —
todas vacías. CRUDs existentes: `/proveedores`, `/almacenes`, `/unidades`.
Escandallos, inventario, mermas y pedidos a proveedor son entradas de menú que caen
en el catch-all "En preparación".

---

## 4. Problemas conocidos (deuda que ya está en el código)

### 4.1 Dos sistemas de impresoras sin puente
`setting.impresion.config.impresoras` (JSON, lo que **realmente** usa el TPV) vs las tablas
`printer` / `print_route` / `print_job` (guía 15 §6, ambas vacías). Dos verdades para lo mismo.
**Decidir cuál gana antes de meterlo en el terminal.**

### 4.2 `impresion.config` lo escriben dos páginas
`/configuracion-de-impresion` y `/plantillas-ticket` hacen `setSetting("GLOBAL", ...)` del objeto
entero. Guardar en una puede pisar cambios de la otra.

### 4.3 `payment_method` no manda
`payment.metodo` está atado por CHECK a `EFECTIVO|TARJETA|BIZUM|QR|WALLET|MIXTO`.
Dar de alta una forma de pago en la tabla no basta para poder cobrar con ella.

### 4.4 Ajustes huérfanos (se guardan, nadie los lee)
`caja.vender_sin_caja`, `caja.abrir_cajon_efectivo`, `backup.hora`, `backup.destino`.

### 4.5 Todo es ámbito GLOBAL
`setting` soporta GLOBAL / LOCAL / DEVICE con precedencia DEVICE > LOCAL > GLOBAL, pero **todas**
las páginas escriben GLOBAL. Con varios terminales o varios locales esto se rompe: hoy no se puede
configurar una impresora distinta por terminal.

### 4.6 Catálogos hardcodeados
Módulos (`app/lib/modulos.ts`) y permisos (`app/lib/permisos.ts`) no están en BD. Añadir uno exige
desplegar.

### 4.7 Nombres colisionantes
`/formas-pago` (configuración, `payment_method`) vs `/formas-de-pago` (informe, `payment`).

### 4.8 50 rutas del menú sin página
Caen en `[...slug]` → "En preparación". El menú promete más de lo que hay.

---

## 5. Qué falta por añadir (no existe en ningún sitio)

**Cobro**
- Política de propinas y reparto
- Redondeo de céntimos
- Integración con datáfono
- Vales, anticipos y cuentas a crédito

**Operativa**
- Reglas de fidelización (cómo se ganan y canjean puntos)
- Horarios de categoría con UI (`category_horario` existe vacía)
- Reglas de reserva (aforo, duración de turno, antelación)
- Traducciones de carta (`/traducciones` es catch-all)

**Seguridad**
- Política de PIN (longitud, caducidad, reintentos)
- Registro de accesos consultable
- Quién puede entrar en Configuración, por perfil
- UI para `app_user_local` y `app_user_permiso`

**Fiscal**
- Subida y gestión del certificado AEAT desde la UI
- Selector de régimen de facturación (`location.regimen_facturacion` no tiene UI)
- Paso de modo prueba a producción de VERIFACTU

**Sistema**
- Restaurar copia de seguridad
- Actualización del nodo desde la UI (`nodo_release` vacía)
- Diagnóstico: estado de sync, cola pendiente, última subida

---

## 6. Propuesta para la pantalla del TPV

El problema no es el inventario, es la promesa incumplida. Tres reglas:

**1. No enseñar puertas cerradas.** Que `GRUPOS` marque cada sección con
`donde: "terminal" | "panel" | "pendiente"` y que la vista general muestre por defecto sólo las
de terminal. Lo del panel, detrás de un "Ver ajustes que se hacen en el panel web".

**2. Empezar por "Este terminal", que es lo único que legítimamente vive aquí.**
Ahí ya hay 5 ajustes reales dispersos por la app, sin pantalla que los reúna:

| Ajuste | Hoy | Traer a Configuración |
|---|---|---|
| Tema claro/oscuro | ya está | — |
| Modo zurdo | `UtilidadesModal` | sí |
| Teclado en pantalla automático | oculto | sí |
| Posición del teclado | oculto | sí |
| Impresora de este terminal | `setting` GLOBAL | requiere ámbito DEVICE (4.5) |
| Nombre y estación de este terminal | `/modulos` | sí, sólo lectura + editar nombre |

Eso son ~6 controles reales: una sección que **funciona entera**. Vale más que 22 fichas.

**3. Después, lo que el camarero necesita sin ir al ordenador**, por orden de dolor real:
impresoras del terminal (necesita 4.5 y 4.1 resueltos) → caja (fondo, arqueo) → botones
(columnas, tamaño) → formas de pago.

El resto — catálogo, precios, planos, marca, módulos, fiscalidad — se queda en el panel web y la
pantalla del TPV debe **decirlo claro con un enlace**, no fingir que algún día estará ahí.

---

## 7. Orden sugerido de trabajo

1. **Ámbito DEVICE en `setting`** (4.5) — bloquea toda configuración por terminal. Es el cuello de botella.
2. **Decidir el modelo de impresoras** (4.1) y borrar el perdedor.
3. **Sección "Este terminal" completa** en el TPV con los 6 controles de arriba.
4. **Cablear los ajustes huérfanos** (4.4) o borrarlos.
5. **Limpiar `GRUPOS`**: marcar dónde vive cada sección, no listar 22 fichas muertas.
6. Resto de secciones del TPV por orden de dolor.
