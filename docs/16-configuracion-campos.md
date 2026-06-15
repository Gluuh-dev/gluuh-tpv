# 16 · Panel de configuración y campos de datos

Plano del **panel de configuración profesional** (estilo Supabase: menú lateral con
secciones, separaciones claras, formularios densos) y de **todos los campos** de cada
entidad. Marca: ✅ ya implementado · 🟡 pendiente.

---

## 1. Estructura del panel de configuración

Menú lateral de "Configuración" (sub-navegación dentro de Ajustes), agrupado:

| Sección | Pantalla | Estado |
|---|---|---|
| **Negocio** | Empresa y local (datos generales) | ✅ |
| | Datos fiscales (territorio, serie, Verifactu) | ✅ |
| | Formas de pago y caja | 🟡 |
| **Catálogo** | Familias | ✅ |
| | Categorías | ✅ |
| | Productos (precio, clase fiscal, alérgenos, foto) | ✅ / 🟡 alérgenos+foto |
| | Modificadores y menús/combos | 🟡 |
| | Tipos impositivos por territorio | ✅ (tabla `tax_rate`) |
| **Sala** | Salas y mesas | ✅ |
| | Centros de producción (cocina/barra) | 🟡 |
| **Personal** | Empleados y PIN | ✅ |
| | Roles y permisos | 🟡 |
| **Dispositivos** | Impresoras (ticket/comanda) | 🟡 |
| | Cajón, datáfono, balanza | 🟡 |
| **Marca** | Logo, colores, kiosko | ✅ |
| | Ofertas / cartelería | ✅ |
| **Seguridad** | Contraseña, passkeys | ✅ |
| | Sesiones / cierre de sesión | 🟡 |

---

## 2. Campos por entidad

### Empresa · `tenant` ✅
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre | texto | sí | Nombre comercial de la empresa |
| plan | enum | sí | FREE / PRO / … |
| email_admin | email | sí | Contacto de alta |

### Local · `location` ✅
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre | texto | sí | Nombre del local |
| direccion | texto | sí | Dirección fiscal |
| cif | texto | sí | CIF/NIF (obligatorio para facturar) |
| razon_social | texto | sí | Razón social |
| territorio_fiscal | enum | sí | PENINSULA_BALEARES / CANARIAS / CEUTA_MELILLA / FORAL_PV / FORAL_NAVARRA → decide IVA/IGIC/IPSI |
| regimen_facturacion | enum | sí | VERIFACTU / TICKETBAI |
| serie_factura | texto | sí | Serie (p. ej. "F") |

### Familia · `family` ✅
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre | texto | sí | Bebidas, Comidas, Postres… |
| orden | entero | no | Orden de aparición |
| color | color | no | Color identificativo |

### Categoría · `category` ✅
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre | texto | sí | |
| family_id | ref familia | no | Familia a la que pertenece |
| orden | entero | no | |

### Producto · `product`
| Campo | Tipo | Obligatorio | Estado | Notas |
|---|---|---|---|---|
| nombre | texto | sí | ✅ | |
| precio | decimal | sí | ✅ | PVP, impuesto incluido |
| clase_fiscal | enum | sí | ✅ | GENERAL / REDUCIDO / SUPERREDUCIDO / EXENTO |
| tipo_impositivo | decimal | auto | ✅ | Calculado por clase + territorio (IVA automático) |
| category_id | ref | no | ✅ | |
| es_alcohol | bool | no | ✅ | |
| disponible | bool | no | ✅ | Agotado/disponible |
| descripcion | texto | no | 🟡 | Descripción para carta/kiosko |
| foto_url | imagen | no | 🟡 | Foto (Supabase Storage) |
| codigo_barras | texto | no | 🟡 | Para lector |
| alergenos | multi | no | 🟡 | 14 alérgenos UE |
| escandallo | receta | no | 🟡 | Ingredientes → stock |

### Tipos impositivos · `tax_rate` ✅
`territorio` + `clase_fiscal` → `porcentaje`. IVA (21/10/4/0), IGIC Canarias (7/3/0/0), IPSI Ceuta/Melilla (10/4/1/0).

### Empleado · `app_user`
| Campo | Tipo | Obligatorio | Estado | Notas |
|---|---|---|---|---|
| nombre | texto | sí | ✅ | |
| email | email | no | ✅ | |
| rol | enum | sí | ✅ | PROPIETARIO / ENCARGADO / CAMARERO / COCINA |
| pin | texto(4+) | sí | ✅ | Cifrado (bcrypt) |
| activo | bool | no | ✅ | |
| permisos | json | no | 🟡 | Permisos finos por acción |

### Sala · `room` ✅ · Mesa · `restaurant_table`
| Campo | Tipo | Estado | Notas |
|---|---|---|---|
| room.nombre / orden | texto/int | ✅ | |
| mesa.nombre | texto | ✅ | |
| mesa.estado | enum | ✅ | LIBRE / OCUPADA / … |
| mesa.capacidad | entero | 🟡 | Nº comensales |
| mesa.pos_x, pos_y | entero | 🟡 | Plano visual de sala |

### Pedido · `sales_order` ✅ · Línea · `order_line` ✅
Pedido: canal (TPV/COMANDERA/KIOSKO/ONLINE), tipo_operacion (VENTA/INVITACION/AUTOCONSUMO/MERMA/FORMACION), tipo_consumo (LOCAL/PARA_LLEVAR), estado, estado_preparacion, numero_pedido, total, mesa, comensales, client_id (idempotencia).
Línea: producto, nombre, cantidad, precio_unitario, tipo_impositivo · 🟡 modificadores, notas, pase, estación.

### Marca · `tenant_branding` ✅
nombre_comercial, logo_url, color_primario, color_secundario, kiosko_titulo, kiosko_subtitulo.

### Oferta · `offer` ✅
titulo, descripcion, precio, media_tipo (EMOJI/IMAGEN/VIDEO), media_url, emoji, color, orden, activa · 🟡 hora_inicio/hora_fin (programación).

### Impresora · `printer` 🟡
| Campo | Tipo | Notas |
|---|---|---|
| nombre | texto | "Cocina", "Barra", "Caja" |
| conexion | enum | RED / USB |
| host | texto | IP (red) |
| puerto | entero | 9100 por defecto |
| ancho | enum | 58mm / 80mm |
| centro_produccion | ref | Qué familias/categorías imprime |
| abre_cajon | bool | Manda "kick" al cajón |
| copias | entero | Nº de copias |

### Caja · `cash_session` 🟡
apertura (fondo inicial, usuario, hora), movimientos (entrada/retirada, motivo), arqueo (contado vs teórico), cierre Z (totales por forma de pago, nº tickets, hora).

---

## 3. Principios de diseño (UI)
- **Estilo Supabase**: poco redondeo (radios ≤8px), bordes 1px claros, layout denso, modo claro/oscuro.
- **Configuración con sub-navegación** lateral por secciones (no todo en una página).
- **Formularios**: etiqueta arriba, input completo, ayuda debajo; agrupar en tarjetas por bloque.
- **Sin huecos vacíos**: estados vacíos con guía + acción.
