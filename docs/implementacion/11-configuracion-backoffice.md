# 11 — Configuración del backoffice (zona técnica, marca, carta, impresión, backups)

**Fecha:** 04-07-2026. Estado: **implementado en apps/web** (esta guía documenta lo
hecho y lo que queda por cablear). Decisiones de diseño acordadas con el usuario
el 04-07-2026; complementa las guías 03 (escritorio), 04 (módulos) y 10 (KDS/tickets).

## 1. El modelo: dos niveles sin roles nuevos

- **El cliente puede configurarlo todo** (carta, formatos, añadidos, mesas, marca,
  empleados, caja, promociones, tarifas) con su rol de siempre.
- **Las páginas técnicas van detrás de un candado**: `components/zona-tecnica.tsx`
  (`<ZonaTecnica>`) pide la **clave técnica** — 8 caracteres autogenerados por
  cliente al crear la empresa (`api/admin/crear-empresa` la devuelve una sola vez).
  Desbloqueo por sesión (sessionStorage, 8 h) + botón "Bloquear". Es un candado
  "no toques esto", **no** seguridad dura (el hash es legible por el tenant vía RLS).
- Páginas en zona técnica: **Impresión** (`/configuracion-de-impresion`),
  **Módulos y pantallas** (`/modulos`, que absorbió `/dispositivos` — ésta redirige),
  **Copias de seguridad** (`/copias-de-seguridad`), **VERIFACTU**
  (`/configuracion-verifactu`).
- RPCs: `validar_clave_tecnica(p_clave)` (sin clave configurada → true, para no
  bloquear empresas antiguas), `establecer_clave_tecnica(p_actual, p_nueva)`,
  `admin_establecer_clave_tecnica` (solo service_role). Migración **0045**.

## 2. Dónde persiste cada configuración

| Config | Persistencia | Página |
|---|---|---|
| Fiscal (CIF, territorio, serie) | `tenant` + `location` | `/ajustes` |
| Marca: logo, colores, kiosko, mesa/silla | `tenant_branding` + Storage `media/<tenant>/marca` | `/personalizar` (única fuente; la card de `/ajustes` se eliminó) |
| Diseño ticket + impresoras (IP) + enrutado | `setting` GLOBAL `impresion.config` | `/configuracion-de-impresion` (con "Imprimir prueba" vía `window.gluuh`) |
| Backup: hora + destino USB/carpeta | `setting` GLOBAL `backup.hora` / `backup.destino` | `/copias-de-seguridad` |
| Serie fiscal VERIFACTU | `setting` GLOBAL `modulo.FISCAL.serie` | `/configuracion-verifactu` |
| Caja: fondo, arqueo ciego, umbral descuadre, cajón | `setting` GLOBAL `caja.fondo_inicial`, `caja.arqueo_ciego`, `caja.umbral_descuadre`, `caja.vender_sin_caja`, `caja.abrir_cajon_efectivo` | `/configuracion-de-caja` |
| Botonera TPV: columnas, precio, foto, tamaño | `setting` GLOBAL `tpv.botones` (objeto único) | `/configuracion-de-botones` |
| Bloqueo TPV | `setting` GLOBAL `tpv.bloqueo` | `/ajustes` |
| Orden de familias/categorías | `family.orden` / `category.orden` | `/ordenar-familias-y-categorias` |
| Orden de productos | `product.orden` (**0046**) | `/ordenar-productos` (solo lectura hasta aplicar 0046) |
| Módulos activos + pantallas | `tenant_module` + `device` (código 6 dígitos, rate-limit en memoria en `api/dispositivos/limite.ts`) | `/modulos` |
| Precios por tarifa | `product_price` (**0047**) | `/tarifas` |
| Permisos por perfil | `perfil.permisos` (**0048**, mismo jsonb que `app_user.permisos`) | `/perfiles` (+ "Aplicar perfil…" en `/empleados`) |
| Reglas de promoción | columnas en `promocion` (**0049**) | `/promociones` |
| Formatos y añadidos de producto | `product_format`, `modifier_group`+`modifier` | ficha de producto (plantillas rápidas + "Copiar de otro producto…") |
| Notas de preparación | `nota_preparacion` (0021) | `/notas-preparacion` |

Convención respetada: configuración → tabla `setting` (0023, DEVICE > LOCAL > GLOBAL);
valores de dominio → sus tablas. Hoy todas las claves nuevas son GLOBAL; pasar a
DEVICE cuando los lectores pasen `device_id`.

## 3. Migraciones de esta tanda (aplicar en orden)

| Nº | Fichero | Qué |
|---|---|---|
| 0045 | `0045_clave_tecnica.sql` | `tenant.clave_tecnica_hash` + RPCs de la clave técnica |
| 0046 | `0046_product_orden.sql` | `product.orden` (activa las flechas de `/ordenar-productos`) |
| 0047 | `0047_product_price.sql` | `product_price` (precio por producto × tarifa) |
| 0048 | `0048_perfil_permisos.sql` | `perfil.permisos jsonb` |
| 0049 | `0049_promocion_reglas.sql` | reglas en `promocion` (tipo, valor, fechas, franja, días, ámbito) |
| 0050 | `0050_category_estacion.sql` | `category.estacion` (herencia de estación cocina/barra) |
| 0051 | `0051_product_nombres_impresion.sql` | `product.nombre_ticket` / `nombre_cocina` |
| 0052 | `0052_licencias.sql` | `licencia` + `tenant.licencia_hasta`/`licencia_modulos` + RPC `activar_licencia` |
| 0053 | `0053_precios_server_side.sql` | 🔒 recalcula precios en `crear_pedido`/`crear_pedido_srv` (anti-fraude kiosko) |

Las páginas degradan con aviso ámbar si su migración no está aplicada (patrón de
`/ordenar-productos`): nada rompe con la BD por detrás.

## 4. Limpiezas hechas

- `/sala` (editor de planos viejo, huérfano) **eliminado** — el bueno es `/planos-de-mesas`.
- `/plantillas-ticket` → redirect a `/configuracion-de-impresion` (el diseño del
  ticket vive en `impresion.config`; el CRUD contra `plantilla_ticket` era cosmético).
- `/alergenos` ya no escribe en la tabla `alergeno` (que nada leía): muestra los 14
  alérgenos oficiales UE (`lib/alergenos.ts`) con los productos que los llevan.
- `/dispositivos` → redirect a `/modulos`. Nav: fuera "Configuración global"
  (duplicaba Ajustes); "Formas de pago" del bloque informes renombrado a
  "Cobros por forma de pago".
- Dashboard: card "Puesta en marcha" (logo → carta → mesas → empleados → impresora)
  que desaparece al completarse. Página `/auditoria` nueva (solo lectura:
  invitaciones, consumos propios, mermas, formación, cuentas anuladas).

## 4bis. Pantallas, kiosko, licencias y seguridad (tanda 04-07-2026 tarde)

- **Pantallas configurables** vía `tenant_module.config` (jsonb, antes sin uso): cocina
  (estación por defecto, tema claro/oscuro, umbrales ámbar/rojo, beep), pantalla de
  recogida (textos, incluir barra), cartelería (segundos por oferta), visor (restyle a
  tokens). Slide-over "Configurar" en `/modulos`. Contrato en `app/lib/modulos.ts`.
- **Kiosko**: 4 diseños (`marca`/`claro`/`calido`/`oscuro`) + `colorFondo`, fotos reales,
  táctil ≥48px, pago simulado honesto, teclado de nombre. Config en `tenant_module.config`
  del módulo KIOSKO.
- **Ticket profesional**: `formatearTicket` con logo, cabecera libre, columnas alineadas,
  desglose, pie multilínea, QR. Diseñador en `/configuracion-de-impresion`. Nombres de
  impresión por producto (`nombre_ticket`/`nombre_cocina`, 0051). Si no hay impresora o
  falla → `guardarTicketComoFichero` (.txt). Estación por categoría con herencia (0050).
- **Licencias** (0052): código `GLUH-XXXX-XXXX-XXXX` con duración + módulos; se genera en
  `/admin`, se activa en `/modulos`. Gating: un módulo premium (KIOSKO/PAGOS/QR_MESA/
  DELIVERY/API/STOCK) se apaga si hay licencia registrada y está caducada o no lo incluye;
  **si `licencia_hasta` es null (tenants actuales) no se gatea** — degradación segura.
- **Seguridad**: 0053 recalcula precios server-side (el kiosko no puede pedir a 0€) y
  `/api/factura` lee las líneas del pedido real. Rate-limit en códigos de dispositivo.
  Pendientes de seguridad (ver §5): modo kiosko de Electron y credencial de solo-pedidos
  (C2), límite de intentos de PIN, activación real de VERIFACTU.

## 4ter. Hecho después (04-07-2026, tarde-noche) — migraciones 0056-0058

- **Logo de tickets** separado del de marca (0056): `tenant_branding.logo_ticket_url`,
  se sube en `/personalizar`, la impresión usa `logo_ticket_url || logo_url`.
- **Cambiar PIN** de empleado (0057): RPC `cambiar_pin`, botón en `/empleados`.
- **Grupos mayores** como división real sobre familias (0058): `family.grupo_mayor_id`;
  jerarquía Grupo mayor → Familia → Categoría → Producto, cada nivel con página propia.
- **Carta en páginas separadas** (Ágora): `/familias`, `/categorias`, `/productos`
  (lista → `[id]` editar/crear), fila clicable; `/carta` redirige a `/productos`.
  Editor de producto con "Copiar de otro producto" (formatos/añadidos).
- **CrudPage** genérico = tabla con clic-en-fila + más tipos de campo + `Skeleton`.
- **TPV**: los 3 modales (Cobrar/Dividir/Modificadores) CABLEADOS en `page.tsx`;
  `abre_cajon` por forma de pago, logo de ticket y `nombre_ticket`/`nombre_cocina`
  al imprimir, chips de `nota_preparacion`, aviso de `min_sel`. Fiscal intacto.
- **Caja**: `caja/page.tsx` consume `caja.fondo_inicial` (apertura), `caja.arqueo_ciego`
  (oculta el teórico) y `caja.umbral_descuadre` (aviso + confirmación en el cierre Z).
- **Reservas**: `/reservas` (backoffice del módulo que solo existía en el TPV).
- **Switch** unificado; carga homogénea (Skeleton) en ~25 páginas.
- Verificado: `typecheck` limpio + `build` de producción limpio.

## 5. Pendiente de cablear (fuera del panel — no tocar sin coordinar)

- **TPV**: consumir `tpv.botones`, tarifas (`product_price` para Cons. propio),
  promociones al vender, y persistir descuento aplicado + `cancel_reason` en
  anulaciones (los echa en falta `/auditoria`). Descuento global no prorrateado
  en el desglose fiscal (hacer antes de activar VERIFACTU).
- **Escritorio** (`apps/desktop`): leer `backup.hora`/`backup.destino` e
  `impresora.*` de `setting` en vez de `config.json` (guía 03).
- Cola compartida `print_job` (guía 03/10) para que comandera/kiosko impriman por el PC.
- Rate-limit de códigos con contador en BD si el despliegue es multi-instancia.
- Decisión SQL: retirar la tabla `alergeno` (0020) cuando se confirme que nada más la usa.

## Criterios de aceptación

- [ ] Con 0045 aplicada: entrar en Impresión/Módulos/Copias/VERIFACTU pide la clave;
      con la clave se desbloquea 8 h; "Regenerar clave" funciona con la actual.
- [ ] Crear empresa devuelve y muestra la clave técnica una sola vez.
- [ ] "Imprimir prueba" saca un ticket por la impresora elegida desde Gluuh Desktop.
- [ ] La copia nocturna se configura desde `/copias-de-seguridad` sin editar JSON.
- [ ] Con 0046-0049: ordenar productos con flechas, precio por tarifa editable,
      perfil aplicable a un empleado, promoción con resumen legible.
- [ ] Un camarero (rol CAMARERO) no ve la zona técnica en el menú y el propietario
      la ve pero necesita la clave.
