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
const s = (label: string, roles: Rol[] = GEST): NavLink => ({ label, roles, soon: true });

export const puede = (rol: Rol, roles?: Rol[]) => !roles || roles.includes(rol);

// Menú estilo Ágora. Cada entrada tiene su página índice (index) y un submenú.
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
  { id: "admin", title: "Administración", icon: Landmark, index: "/administracion", sections: [
    { title: "General", items: [
      { href: "/ajustes", label: "Empresa y local", roles: PROP },
      s("Series", PROP), s("Configuración global", PROP), s("Plantillas de ticket"),
      s("Plantillas de etiquetas"), s("Periodos de servicio"), s("Tipos de clientes"),
      { href: "/clientes", label: "Clientes", roles: GEST }, s("Puntos de venta", PROP),
    ] },
    { title: "Usuarios", items: [
      s("Perfiles y permisos", PROP), { href: "/empleados", label: "Usuarios y PIN", roles: GEST },
    ] },
    { title: "Catálogo", items: [
      s("Grupos mayores"), { href: "/carta", label: "Familias", roles: GEST },
      { href: "/carta", label: "Categorías", roles: GEST }, { href: "/carta", label: "Productos", roles: GEST },
      { href: "/menus", label: "Menús", roles: GEST }, s("Alérgenos"), s("Etiquetas de productos"),
    ] },
    { title: "Tarifas y precios", items: [
      { href: "/impuestos", label: "Impuestos", roles: PROP }, { href: "/formas-pago", label: "Formas de pago", roles: GEST },
      s("Centros de venta"), s("Tarifas"), s("Promociones"),
      { href: "/descuentos", label: "Descuentos", roles: GEST },
    ] },
    { title: "Comandas", items: [
      s("Plantillas de comandas"), s("Notas de preparación"), s("Motivos de cancelación"),
      s("Tipos de preparación"), s("Órdenes de preparación"),
      { href: "/cocina", label: "Monitores de cocina", roles: GEST, blank: true },
    ] },
    { title: "Entradas", items: [s("Plantillas de entradas"), s("Entradas")] },
  ] },
  { id: "compras", title: "Compras y Stocks", icon: Package, index: "/compras", sections: [
    { title: "General", items: [{ href: "/almacenes", label: "Almacenes", roles: GEST }, { href: "/proveedores", label: "Proveedores", roles: GEST }, s("Unidades de medida")] },
    { title: "Compras", items: [s("Pedidos a proveedor"), s("Albaranes de entrada"), s("Facturas de proveedor")] },
    { title: "Control de stock", items: [
      s("Regularización de inventario"), s("Variaciones de stock"), s("Fabricaciones (escandallos)"),
      s("Histórico de movimientos"), s("Cierres de almacén"),
    ] },
    { title: "Herramientas", items: [s("Exportar productos"), s("Aplicación web almacén")] },
  ] },
  { id: "herramientas", title: "Herramientas", icon: Wrench, index: "/herramientas", sections: [
    { title: "Visualización", items: [
      s("Ordenar familias y categorías"), s("Ordenar productos"), s("Configuración de botones"),
      s("Acciones personalizadas"), s("Planos de mesas"),
    ] },
    { title: "Precios", items: [
      s("Exportar precios (Excel)"), s("Importar precios (Excel)"), s("Modificación global de precios"),
      s("Ajustar márgenes"), s("Programación de tarifas"),
    ] },
    { title: "VERI*FACTU", items: [s("Visor de Verifactu", PROP), s("Configuración Verifactu", PROP)] },
    { title: "Control de efectivo", items: [{ href: "/caja", label: "Caja", roles: GEST }, s("Configuración de caja", PROP)] },
    { title: "Pasarela de pago", items: [s("Configuración de pago"), s("Cobro en mesa")] },
    { title: "Cartas digitales", items: [
      { href: "/personalizar", label: "Marca y cartelería", roles: PROP }, s("Traducciones"),
      s("Pago y pedidos (QR)"), s("Generar QRs"),
    ] },
    { title: "Otros", items: [s("Copias de seguridad", PROP), s("Auditoría", PROP)] },
  ] },
  { id: "informes", title: "Informes", icon: BarChart3, index: "/informes", sections: [
    { title: "Resumen", items: [{ href: "/informes", label: "Panel de informes", roles: GEST }] },
    { title: "Análisis", items: [s("Análisis de ventas"), s("Análisis de compras"), s("Análisis de stocks")] },
    { title: "Ventas", items: [
      s("Evolución de ventas"), s("Comparativa interanual"), s("Resumen fiscal"), s("Invitaciones"),
      s("Reservas"), s("Documento 347"),
    ] },
    { title: "Catálogo", items: [
      s("Familias y productos"), s("Márgenes por familia"), s("Menú engineering"),
      s("Top 50 productos"), s("Ventas diarias"), s("Alérgenos por producto"),
    ] },
    { title: "Usuarios", items: [
      s("Rendimiento de usuarios"), s("Productos por usuario"), s("Descuentos por usuario"),
      s("Cancelaciones por usuario"), s("Propinas por usuario"), s("Asistencia"),
    ] },
    { title: "Caja", items: [
      s("Formas de pago"), s("Movimientos de caja"), s("Cobros pendientes"),
      s("Propinas por forma de pago"), s("Transacciones con tarjeta"),
    ] },
    { title: "Clientes", items: [s("Ventas a cliente"), s("Facturas por cliente"), s("Impuestos por cliente")] },
    { title: "Almacén", items: [
      s("Compras por proveedor"), s("Stock por producto"), s("Compras y ventas por producto"),
      s("Valoración de mermas"), s("Pagos pendientes"),
    ] },
    { title: "Cocina", items: [s("Tiempos de preparación")] },
    { title: "Diarios", items: [
      s("Diario de facturas"), s("Diario de pedidos"), s("Diario de cierres de caja"), s("Diario de ventas"),
    ] },
  ] },
  { id: "ayuda", title: "Ayuda", icon: Info, sections: [{ items: [s("Documentación", GEST)] }] },
];
