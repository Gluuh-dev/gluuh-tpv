import {
  LayoutDashboard, BarChart3, ShoppingCart, Landmark, Package, Wrench, Info, type LucideIcon,
} from "lucide-react";

export type Rol = "PROPIETARIO" | "ENCARGADO" | "CAMARERO" | "COCINA";
export interface NavLink { href?: string; label: string; roles?: Rol[]; soon?: boolean; blank?: boolean }
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
      { href: "/comandera", label: "Comandera", roles: VENTA, blank: true },
    ] },
    { title: "Pantallas", items: [
      { href: "/cocina", label: "Cocina (KDS)", roles: ["PROPIETARIO", "ENCARGADO", "COCINA"], blank: true },
      { href: "/kiosko", label: "Kiosko", roles: GEST, blank: true },
      { href: "/pantalla", label: "Display", roles: GEST, blank: true },
      { href: "/ofertas", label: "Ofertas", roles: GEST, blank: true },
    ] },
    { title: "Caja", items: [{ href: "/caja", label: "Control de caja", roles: GEST }] },
  ] },
  { id: "admin", title: "Administracion", icon: Landmark, index: "/administracion", sections: [
    { title: "General", items: [
      { href: "/ajustes", label: "Empresa y local", roles: PROP },
      { href: "/series", label: "Series", roles: PROP }, { href: "/configuracion-global", label: "Configuracion global", roles: PROP }, { href: "/plantillas-ticket", label: "Plantillas de ticket", roles: GEST },
      { href: "/plantillas-etiquetas", label: "Plantillas de etiquetas", roles: GEST }, { href: "/periodos-servicio", label: "Periodos de servicio", roles: GEST }, { href: "/tipos-cliente", label: "Tipos de clientes", roles: GEST },
      { href: "/clientes", label: "Clientes", roles: GEST }, { href: "/puntos-venta", label: "Puntos de venta", roles: PROP },
    ] },
    { title: "Usuarios", items: [
      { href: "/perfiles", label: "Perfiles y permisos", roles: PROP }, { href: "/empleados", label: "Usuarios y PIN", roles: GEST },
    ] },
    { title: "Catalogo", items: [
      { href: "/grupos-mayores", label: "Grupos mayores", roles: GEST }, { href: "/carta", label: "Familias", roles: GEST },
      { href: "/carta", label: "Categorias", roles: GEST }, { href: "/carta", label: "Productos", roles: GEST },
      { href: "/menus", label: "Menus", roles: GEST }, { href: "/alergenos", label: "Alergenos", roles: GEST }, { href: "/etiquetas", label: "Etiquetas de productos", roles: GEST },
    ] },
    { title: "Tarifas y precios", items: [
      { href: "/impuestos", label: "Impuestos", roles: PROP }, { href: "/formas-pago", label: "Formas de pago", roles: GEST },
      { href: "/centros-venta", label: "Centros de venta", roles: GEST }, { href: "/tarifas", label: "Tarifas", roles: GEST }, { href: "/promociones", label: "Promociones", roles: GEST },
      { href: "/descuentos", label: "Descuentos", roles: GEST },
    ] },
    { title: "Comandas", items: [
      { href: "/plantillas-comandas", label: "Plantillas de comandas", roles: GEST }, { href: "/notas-preparacion", label: "Notas de preparacion", roles: GEST },
      { href: "/tipos-preparacion", label: "Tipos de preparacion", roles: GEST }, { href: "/ordenes-preparacion", label: "Ordenes de preparacion", roles: GEST }, { href: "/motivos-cancelacion", label: "Motivos de cancelacion", roles: GEST },
      { href: "/cocina", label: "Monitores de cocina", roles: GEST, blank: true },
    ] },
    { title: "Entradas", items: [{ href: "/plantillas-entradas", label: "Plantillas de entradas", roles: GEST }, { href: "/entradas", label: "Entradas", roles: GEST }] },
  ] },
  { id: "compras", title: "Compras y Stocks", icon: Package, index: "/compras", sections: [
    { title: "General", items: [{ href: "/almacenes", label: "Almacenes", roles: GEST }, { href: "/proveedores", label: "Proveedores", roles: GEST }, { href: "/unidades", label: "Unidades de medida", roles: GEST }] },
    { title: "Compras", items: [{ href: "/pedidos-a-proveedor", label: "Pedidos a proveedor", roles: GEST }, { href: "/albaranes-de-entrada", label: "Albaranes de entrada", roles: GEST }, { href: "/facturas-de-proveedor", label: "Facturas de proveedor", roles: GEST }] },
    { title: "Control de stock", items: [
      { href: "/regularizacion-de-inventario", label: "Regularizacion de inventario", roles: GEST }, { href: "/variaciones-de-stock", label: "Variaciones de stock", roles: GEST }, { href: "/fabricaciones-escandallos", label: "Fabricaciones escandallos", roles: GEST },
      { href: "/historico-de-movimientos", label: "Historico de movimientos", roles: GEST }, { href: "/cierres-de-almacen", label: "Cierres de almacen", roles: GEST },
    ] },
    { title: "Herramientas", items: [{ href: "/exportar-productos", label: "Exportar productos", roles: GEST }, { href: "/aplicacion-web-almacen", label: "Aplicacion web almacen", roles: GEST }] },
  ] },
  { id: "herramientas", title: "Herramientas", icon: Wrench, index: "/herramientas", sections: [
    { title: "Visualizacion", items: [
      { href: "/ordenar-familias-y-categorias", label: "Ordenar familias y categorias", roles: GEST }, { href: "/ordenar-productos", label: "Ordenar productos", roles: GEST }, { href: "/configuracion-de-botones", label: "Configuracion de botones", roles: GEST },
      { href: "/acciones-personalizadas", label: "Acciones personalizadas", roles: GEST }, { href: "/planos-de-mesas", label: "Planos de mesas", roles: GEST },
    ] },
    { title: "Precios", items: [
      { href: "/exportar-precios", label: "Exportar precios Excel", roles: GEST }, { href: "/importar-precios", label: "Importar precios Excel", roles: GEST }, { href: "/modificacion-global-de-precios", label: "Modificacion global de precios", roles: GEST },
      { href: "/ajustar-margenes", label: "Ajustar margenes", roles: GEST }, { href: "/programacion-de-tarifas", label: "Programacion de tarifas", roles: GEST },
    ] },
    { title: "VERI*FACTU", items: [{ href: "/visor-de-verifactu", label: "Visor de Verifactu", roles: PROP }, { href: "/configuracion-verifactu", label: "Configuracion Verifactu", roles: PROP }] },
    { title: "Control de efectivo", items: [{ href: "/caja", label: "Caja", roles: GEST }, { href: "/configuracion-de-caja", label: "Configuracion de caja", roles: PROP }] },
    { title: "Pasarela de pago", items: [{ href: "/configuracion-de-pago", label: "Configuracion de pago", roles: GEST }, { href: "/cobro-en-mesa", label: "Cobro en mesa", roles: GEST }] },
    { title: "Cartas digitales", items: [
      { href: "/personalizar", label: "Marca y carteleria", roles: PROP }, { href: "/traducciones", label: "Traducciones", roles: GEST },
      { href: "/pago-y-pedidos-qr", label: "Pago y pedidos QR", roles: GEST }, { href: "/generar-qrs", label: "Generar QRs", roles: GEST },
    ] },
    { title: "Otros", items: [{ href: "/copias-de-seguridad", label: "Copias de seguridad", roles: PROP }, { href: "/auditoria", label: "Auditoria", roles: PROP }] },
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
      { href: "/formas-de-pago", label: "Formas de pago", roles: GEST }, { href: "/movimientos-de-caja", label: "Movimientos de caja", roles: GEST }, { href: "/cobros-pendientes", label: "Cobros pendientes", roles: GEST },
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
  { id: "ayuda", title: "Ayuda", icon: Info, sections: [{ items: [{ href: "/documentacion", label: "Documentacion", roles: GEST }] }] },
];
