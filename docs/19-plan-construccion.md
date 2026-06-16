# 19 · Plan de construcción página a página

Cómo construimos cada pantalla: **diseño limpio (verde/oscuro Supabase), funcional y
todo configurable desde la propia página** (sin salir a herramientas externas). Este
doc es el manual de ejecución; los campos exactos están en [17](17-paginas-creacion-configuracion.md)
y el mapa Ágora en [18](18-mapa-agora-completo.md).

## Fundación (ya lista ✅)
- **Diseño**: tokens en `globals.css` (verde `#34B27B`, oscuro por defecto), skill `.agents/skills/ui-kit-shadcn`. Verificado en vivo.
- **Shell**: menú estilo Ágora (rail + submenú al lado + página índice por sección), Inicio directo, claro/oscuro, estado persistente (Zustand).
- **Primitivos** (reutilizar, no reinventar): `PageHeader`, `StatCard`, `EmptyState`, `Card`, `Table`, `Badge`, `Dialog`, `Select`, `Input`, `PasswordInput`, toasts (sonner), `ProductoDialog`.
- **Datos**: multi-tenant + RLS, IVA automático, tablas `family/category/product/menu/payment_method/discount/cash_session…`.

## Patrón estándar (TODA página de gestión se hace igual)
1. `PageHeader` (título 20px + descripción + acción primaria, p. ej. "Nuevo …").
2. Si es lista: **buscador/filtros** arriba.
3. **Tabla densa** (`Table`) o tarjetas: columnas clave + **badge de estado** de color + acciones por fila (✏️ editar, 🗑️ borrar, 👁️ activar/ocultar).
4. **Crear/editar en `Dialog`** sobre la misma página → todo se configura sin cambiar de pantalla.
5. **Estados**: `EmptyState` (vacío con guía + botón), spinner (carga), **toast** (éxito/error).
6. **Reglas**: solo tokens (cero hex/`bg-white`); filtrado por rol; va en claro y oscuro; `tenant_id` en inserts; RLS por tenant.
7. Números en `tabular-nums`; iconos lucide con `aria-label` si van solos.

## Orden de construcción (prioridad)

### Fase A — Catálogo y precios (lo que alimenta el TPV)  ✅ casi hecho
| Página | Ruta | Configura | Estado |
|---|---|---|---|
| Familias / Categorías / Productos | `/carta` | catálogo + clase fiscal + foto/alérgenos | ✅ |
| Menús y combos | `/menus` | 1º/2º/postre, precio | ✅ |
| Formas de pago | `/formas-pago` | medios de cobro | ✅ |
| Descuentos | `/descuentos` | % / importe | ✅ |
| **Impuestos** | `/impuestos` | ver/editar `tax_rate` por territorio | 🟡 |
| **Tarifas / Promociones** | `/tarifas` | precio por sala/horario | 🟡 |

### Fase B — Negocio y personas
| Empresa y local (fiscal) | `/ajustes` | datos + Verifactu | ✅ |
| Empleados y PIN | `/empleados` | alta, rol, PIN | ✅ (falta editar/reset PIN 🟡) |
| **Perfiles y permisos** | `/perfiles` | permisos finos por rol (→ RLS) | 🟡 |
| **Clientes** | `/clientes` | ficha, NIF, contacto | 🟡 |
| Sala y mesas | `/sala` | salas, mesas | ✅ (falta plano visual 🟡) |
| Marca y cartelería | `/personalizar` | logo, colores, ofertas | ✅ |

### Fase C — Caja y fiscal (dinero + ley)
| Caja (apertura/arqueo/cierre Z) | `/caja` | turno de caja | ✅ |
| **Cobro real + factura** | en TPV | persistir `invoice`+`tax_line`+`verifactu_record` (huella) | 🟡 ★ |
| **Visor Verifactu** | `/verifactu` | facturas emitidas + QR + estado AEAT | 🟡 |

### Fase D — Compras y stock (módulo entero 🟡)
Almacenes, Proveedores, Pedidos, Albaranes, Inventario, **Escandallos**, Mermas, Cierres.

### Fase E — Informes (ampliar el básico)
Ventas, Resumen fiscal, Menú engineering, por usuario, por caja, diarios… (ver doc 17).

### Fase F — Dispositivos
**Impresoras** (`/impresoras`: red IP:9100/USB, ancho, centro de producción) + cajón + datáfono.

## Siguiente
Empezar por **Fase A pendiente** (Impuestos, Tarifas) o saltar a **Fase C ★ cobro+factura Verifactu** (lo más crítico legal). Cada página, con el patrón estándar, ~1 commit.
