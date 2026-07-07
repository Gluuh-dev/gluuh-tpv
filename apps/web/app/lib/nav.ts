import {
  LayoutDashboard, BarChart3, ShoppingCart, Landmark, Package, Wrench, Info, type LucideIcon,
} from "lucide-react";
import type { Modulo } from "./modulos";

export type Rol = "PROPIETARIO" | "ENCARGADO" | "CAMARERO" | "COCINA";
// `modulo`: la entrada se oculta si la empresa tiene ese módulo desactivado
// (tabla tenant_module; catálogo en lib/modulos.ts). Tipado contra MODULOS para
// que un typo (p. ej. "CARTELERÍA") no compile.
// `perm`: permiso de perfil (lib/permisos) que además de rol/módulo gatea esta
// página — oculta del menú y bloquea el acceso directo por URL. Sin `perm`, la
// página se gatea solo por la zona (panel.<id> de su entrada).
export interface NavLink { href?: string; label: string; roles?: Rol[]; soon?: boolean; blank?: boolean; modulo?: Modulo; perm?: string }
export interface NavSection { title?: string; items: NavLink[] }
export interface NavEntry { id: string; title: string; icon: LucideIcon; sections: NavSection[]; direct?: boolean; index?: string }

const GEST: Rol[] = ["PROPIETARIO", "ENCARGADO"];
const PROP: Rol[] = ["PROPIETARIO"];
const VENTA: Rol[] = ["PROPIETARIO", "ENCARGADO", "CAMARERO"];

export const puede = (rol: Rol, roles?: Rol[]) => !roles || roles.includes(rol);

// Menu estilo Agora. Cada entrada tiene su pagina indice (index) y un submenu.
export const NAV: NavEntry[] = [
  { id: "inicio", title: "Inicio", icon: LayoutDashboard, direct: true, index: "/dashboard", sections: [
    { items: [{ href: "/dashboard", label: "Inicio", roles: GEST }] },
  ] },
  { id: "operativa", title: "Operativa", icon: ShoppingCart, index: "/operativa", sections: [
    { title: "Venta", items: [
      { href: "/tpv", label: "TPV", roles: VENTA, blank: true },
      { href: "/comandera", label: "Comandera", roles: VENTA, blank: true, modulo: "COMANDERA" },
    ] },
    { title: "Pantallas", items: [
      { href: "/cocina", label: "Cocina (KDS)", roles: ["PROPIETARIO", "ENCARGADO", "COCINA"], blank: true, modulo: "COCINA" },
      { href: "/kiosko", label: "Kiosko", roles: GEST, blank: true, modulo: "KIOSKO" },
      { href: "/pantalla", label: "Display", roles: GEST, blank: true, modulo: "PANTALLA" },
      { href: "/ofertas", label: "Ofertas", roles: GEST, blank: true, modulo: "CARTELERIA" },
    ] },
    { title: "Caja", items: [
      { href: "/caja", label: "Control de caja", roles: GEST },
      { href: "/configuracion-de-caja", label: "Configuracion de caja", roles: PROP },
    ] },
  ] },
  { id: "admin", title: "Administracion", icon: Landmark, index: "/administracion", sections: [
    { title: "Empresa", items: [
      { href: "/ajustes", label: "Empresa y local", roles: PROP },
      { href: "/puntos-venta", label: "Puntos de venta", roles: PROP, perm: "admin.usuarios" },
      { href: "/periodos-servicio", label: "Periodos de servicio", roles: GEST },
      { href: "/series", label: "Series", roles: PROP, perm: "admin.fiscal" },
    ] },
    { title: "Usuarios y seguridad", items: [
      { href: "/perfiles", label: "Perfiles y permisos", roles: PROP, perm: "admin.usuarios" },
      { href: "/empleados", label: "Usuarios y PIN", roles: GEST, perm: "admin.usuarios" },
      { href: "/seguridad", label: "Seguridad", roles: PROP, perm: "admin.usuarios" },
      { href: "/auditoria", label: "Auditoria", roles: PROP, perm: "admin.usuarios" },
    ] },
    { title: "Clientes", items: [
      { href: "/tipos-cliente", label: "Tipos de clientes", roles: GEST },
      { href: "/clientes", label: "Clientes", roles: GEST },
      { href: "/reservas", label: "Reservas", roles: GEST, modulo: "RESERVAS" },
    ] },
    { title: "Catalogo", items: [
      { href: "/grupos-mayores", label: "Grupos mayores", roles: GEST, perm: "admin.catalogo" }, { href: "/familias", label: "Familias", roles: GEST, perm: "admin.catalogo" },
      { href: "/categorias", label: "Categorias", roles: GEST, perm: "admin.catalogo" }, { href: "/productos", label: "Productos", roles: GEST, perm: "admin.catalogo" },
      { href: "/modificadores", label: "Modificadores", roles: GEST, perm: "admin.catalogo" },
      { href: "/menus", label: "Menus", roles: GEST, perm: "admin.catalogo" }, { href: "/alergenos", label: "Alergenos", roles: GEST, perm: "admin.catalogo" }, { href: "/etiquetas", label: "Etiquetas de productos", roles: GEST, perm: "admin.catalogo" },
    ] },
    { title: "Precios e impuestos", items: [
      { href: "/impuestos", label: "Impuestos", roles: PROP, perm: "admin.fiscal" }, { href: "/formas-pago", label: "Formas de pago", roles: GEST },
      { href: "/tarifas", label: "Tarifas", roles: GEST }, { href: "/promociones", label: "Promociones", roles: GEST },
      { href: "/descuentos", label: "Descuentos", roles: GEST }, { href: "/centros-venta", label: "Centros de venta", roles: GEST },
    ] },
    { title: "Comandas y cocina", items: [
      { href: "/plantillas-comandas", label: "Plantillas de comandas", roles: GEST }, { href: "/notas-preparacion", label: "Notas de preparacion", roles: GEST },
      { href: "/tipos-preparacion", label: "Tipos de preparacion", roles: GEST }, { href: "/ordenes-preparacion", label: "Ordenes de preparacion", roles: GEST }, { href: "/motivos-cancelacion", label: "Motivos de cancelacion", roles: GEST },
    ] },
    { title: "Tickets y entradas", items: [
      { href: "/plantillas-ticket", label: "Plantillas de ticket", roles: GEST }, { href: "/plantillas-etiquetas", label: "Plantillas de etiquetas", roles: GEST },
      { href: "/plantillas-entradas", label: "Plantillas de entradas", roles: GEST }, { href: "/entradas", label: "Entradas", roles: GEST },
    ] },
  ] },
  { id: "compras", title: "Compras y Stocks", icon: Package, index: "/compras", sections: [
    { title: "General", items: [{ href: "/almacenes", label: "Almacenes", roles: GEST }, { href: "/proveedores", label: "Proveedores", roles: GEST }, { href: "/unidades", label: "Unidades de medida", roles: GEST }] },
    { title: "Compras", items: [{ href: "/pedidos-a-proveedor", label: "Pedidos a proveedor", roles: GEST }, { href: "/albaranes-de-entrada", label: "Albaranes de entrada", roles: GEST }, { href: "/facturas-de-proveedor", label: "Facturas de proveedor", roles: GEST }] },
    { title: "Control de stock", items: [
      { href: "/regularizacion-de-inventario", label: "Regularizacion de inventario", roles: GEST, perm: "compras.stock" }, { href: "/variaciones-de-stock", label: "Variaciones de stock", roles: GEST, perm: "compras.stock" }, { href: "/fabricaciones-escandallos", label: "Fabricaciones escandallos", roles: GEST, perm: "compras.stock" },
      { href: "/historico-de-movimientos", label: "Historico de movimientos", roles: GEST, perm: "compras.stock" }, { href: "/cierres-de-almacen", label: "Cierres de almacen", roles: GEST, perm: "compras.stock" },
    ] },
    { title: "Utilidades", items: [{ href: "/exportar-productos", label: "Exportar productos", roles: GEST }, { href: "/aplicacion-web-almacen", label: "Aplicacion web almacen", roles: GEST }] },
  ] },
  { id: "herramientas", title: "Herramientas", icon: Wrench, index: "/herramientas", sections: [
    { title: "Visualizacion", items: [
      { href: "/ordenar-familias-y-categorias", label: "Ordenar familias y categorias", roles: GEST }, { href: "/ordenar-productos", label: "Ordenar productos", roles: GEST }, { href: "/configuracion-de-botones", label: "Configuracion de botones", roles: GEST },
      { href: "/acciones-personalizadas", label: "Acciones personalizadas", roles: GEST }, { href: "/planos-de-mesas", label: "Planos de mesas", roles: GEST },
    ] },
    { title: "Precios", items: [
      { href: "/exportar-precios", label: "Exportar precios Excel", roles: GEST, perm: "herramientas.precios" }, { href: "/importar-precios", label: "Importar precios Excel", roles: GEST, perm: "herramientas.precios" }, { href: "/modificacion-global-de-precios", label: "Modificacion global de precios", roles: GEST, perm: "herramientas.precios" },
      { href: "/ajustar-margenes", label: "Ajustar margenes", roles: GEST, perm: "herramientas.precios" }, { href: "/programacion-de-tarifas", label: "Programacion de tarifas", roles: GEST, perm: "herramientas.precios" },
    ] },
    { title: "VERI*FACTU", items: [{ href: "/visor-de-verifactu", label: "Visor de Verifactu", roles: PROP, perm: "admin.fiscal" }, { href: "/configuracion-verifactu", label: "Configuracion Verifactu", roles: PROP, perm: "admin.fiscal" }] },
    { title: "Cartas digitales", items: [
      { href: "/personalizar", label: "Marca y carteleria", roles: PROP, perm: "cartas" }, { href: "/traducciones", label: "Traducciones", roles: GEST, perm: "cartas" },
      { href: "/pago-y-pedidos-qr", label: "Pago y pedidos QR", roles: GEST, perm: "cartas" }, { href: "/generar-qrs", label: "Generar QRs", roles: GEST, perm: "cartas" },
    ] },
    { title: "Pasarela de pago", items: [{ href: "/configuracion-de-pago", label: "Configuracion de pago", roles: GEST }, { href: "/cobro-en-mesa", label: "Cobro en mesa", roles: GEST }] },
    // Zona tecnica: paginas que configura el instalador (candado con clave tecnica).
    { title: "Zona tecnica", items: [
      { href: "/configuracion-de-impresion", label: "Impresion", roles: GEST, perm: "tecnica" },
      { href: "/modulos", label: "Modulos y pantallas", roles: PROP, perm: "tecnica" },
      { href: "/copias-de-seguridad", label: "Copias de seguridad", roles: PROP, perm: "tecnica" },
    ] },
  ] },
  { id: "informes", title: "Informes", icon: BarChart3, index: "/informes", sections: [
    { title: "Resumen", items: [{ href: "/informes", label: "Panel de informes", roles: GEST }] },
    { title: "Analisis", items: [{ href: "/analisis-de-ventas", label: "Analisis de ventas", roles: GEST }, { href: "/analisis-de-compras", label: "Analisis de compras", roles: GEST }, { href: "/analisis-de-stocks", label: "Analisis de stocks", roles: GEST }] },
    { title: "Ventas", items: [
      { href: "/evolucion-de-ventas", label: "Evolucion de ventas", roles: GEST }, { href: "/comparativa-interanual", label: "Comparativa interanual", roles: GEST }, { href: "/resumen-fiscal", label: "Resumen fiscal", roles: GEST }, { href: "/invitaciones", label: "Invitaciones", roles: GEST },
      { href: "/reservas", label: "Reservas", roles: GEST }, { href: "/documento-347", label: "Documento 347", roles: GEST },
    ] },
    { title: "Catalogo", items: [
      { href: "/familias-y-productos", label: "Familias y productos", roles: GEST }, { href: "/margenes-por-familia", label: "Margenes por familia", roles: GEST }, { href: "/menu-engineering", label: "Menu engineering", roles: GEST },
      { href: "/top-50-productos", label: "Top 50 productos", roles: GEST }, { href: "/ventas-diarias", label: "Ventas diarias", roles: GEST }, { href: "/alergenos-por-producto", label: "Alergenos por producto", roles: GEST },
    ] },
    { title: "Usuarios", items: [
      { href: "/rendimiento-de-usuarios", label: "Rendimiento de usuarios", roles: GEST }, { href: "/productos-por-usuario", label: "Productos por usuario", roles: GEST }, { href: "/descuentos-por-usuario", label: "Descuentos por usuario", roles: GEST },
      { href: "/cancelaciones-por-usuario", label: "Cancelaciones por usuario", roles: GEST }, { href: "/propinas-por-usuario", label: "Propinas por usuario", roles: GEST }, { href: "/asistencia", label: "Asistencia", roles: GEST },
    ] },
    { title: "Caja", items: [
      { href: "/formas-de-pago", label: "Cobros por forma de pago", roles: GEST }, { href: "/movimientos-de-caja", label: "Movimientos de caja", roles: GEST }, { href: "/cobros-pendientes", label: "Cobros pendientes", roles: GEST },
      { href: "/propinas-por-forma-de-pago", label: "Propinas por forma de pago", roles: GEST }, { href: "/transacciones-con-tarjeta", label: "Transacciones con tarjeta", roles: GEST },
    ] },
    { title: "Clientes", items: [{ href: "/ventas-a-cliente", label: "Ventas a cliente", roles: GEST }, { href: "/facturas-por-cliente", label: "Facturas por cliente", roles: GEST }, { href: "/impuestos-por-cliente", label: "Impuestos por cliente", roles: GEST }] },
    { title: "Almacen", items: [
      { href: "/compras-por-proveedor", label: "Compras por proveedor", roles: GEST }, { href: "/stock-por-producto", label: "Stock por producto", roles: GEST }, { href: "/compras-y-ventas-por-producto", label: "Compras y ventas por producto", roles: GEST },
      { href: "/valoracion-de-mermas", label: "Valoracion de mermas", roles: GEST }, { href: "/pagos-pendientes", label: "Pagos pendientes", roles: GEST },
    ] },
    { title: "Cocina", items: [{ href: "/tiempos-de-preparacion", label: "Tiempos de preparacion", roles: GEST }] },
    { title: "Diarios", items: [
      { href: "/diario-de-facturas", label: "Diario de facturas", roles: GEST }, { href: "/diario-de-pedidos", label: "Diario de pedidos", roles: GEST }, { href: "/diario-de-cierres-de-caja", label: "Diario de cierres de caja", roles: GEST }, { href: "/diario-de-ventas", label: "Diario de ventas", roles: GEST },
    ] },
  ] },
  { id: "ayuda", title: "Ayuda", icon: Info, sections: [{ items: [
    { href: "/documentacion", label: "Documentacion", roles: GEST },
    { href: "/acerca-de", label: "Acerca de / Licencia", roles: GEST },
  ] }] },
];
