"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BarChart3, ShoppingCart, LogOut, ExternalLink,
  PanelLeftClose, PanelLeft, Landmark, Package, Wrench, Info, type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { useUI } from "../lib/ui-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Rol = "PROPIETARIO" | "ENCARGADO" | "CAMARERO" | "COCINA";
interface NavLink { href?: string; label: string; roles?: Rol[]; soon?: boolean; blank?: boolean }
interface NavSection { title?: string; items: NavLink[] }
interface NavEntry { id: string; title: string; icon: LucideIcon; sections: NavSection[]; direct?: boolean }

const GEST: Rol[] = ["PROPIETARIO", "ENCARGADO"];
const PROP: Rol[] = ["PROPIETARIO"];
const VENTA: Rol[] = ["PROPIETARIO", "ENCARGADO", "CAMARERO"];
const s = (label: string, roles: Rol[] = GEST): NavLink => ({ label, roles, soon: true }); // placeholder "pronto"

// Menú estilo Ágora. Páginas reales con href; el resto marcado soon.
const NAV: NavEntry[] = [
  { id: "inicio", title: "Inicio", icon: LayoutDashboard, direct: true, sections: [
    { items: [{ href: "/dashboard", label: "Inicio", roles: GEST }] },
  ] },
  { id: "operativa", title: "Operativa", icon: ShoppingCart, sections: [
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
  { id: "admin", title: "Administración", icon: Landmark, sections: [
    { title: "General", items: [
      { href: "/ajustes", label: "Empresa y local", roles: PROP },
      s("Series", PROP), s("Configuración global", PROP), s("Plantillas de ticket"),
      s("Plantillas de etiquetas"), s("Periodos de servicio"), s("Tipos de clientes"),
      s("Clientes"), s("Puntos de venta", PROP),
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
      s("Impuestos", PROP), { href: "/formas-pago", label: "Formas de pago", roles: GEST },
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
  { id: "compras", title: "Compras y Stocks", icon: Package, sections: [
    { title: "General", items: [s("Almacenes"), s("Proveedores"), s("Unidades de medida")] },
    { title: "Compras", items: [s("Pedidos a proveedor"), s("Albaranes de entrada"), s("Facturas de proveedor")] },
    { title: "Control de stock", items: [
      s("Regularización de inventario"), s("Variaciones de stock"), s("Fabricaciones (escandallos)"),
      s("Histórico de movimientos"), s("Cierres de almacén"),
    ] },
    { title: "Herramientas", items: [s("Exportar productos"), s("Aplicación web almacén")] },
  ] },
  { id: "herramientas", title: "Herramientas", icon: Wrench, sections: [
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
  { id: "informes", title: "Informes", icon: BarChart3, sections: [
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

interface SessionInfo { empresa: string; email: string; nombre: string; rol: Rol }
const puede = (rol: Rol, roles?: Rol[]) => !roles || roles.includes(rol);

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [entrada, setEntrada] = useState("inicio");
  const { railOpen, menuOpen, toggleRail, toggleMenu, setMenuOpen } = useUI();

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      const { data: u } = await sb.from("app_user").select("nombre,rol").eq("auth_user_id", session.user.id).maybeSingle();
      setInfo({ empresa: t?.nombre ?? "Mi empresa", email: session.user.email ?? "", nombre: u?.nombre ?? "", rol: (u?.rol as Rol) ?? "PROPIETARIO" });
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    const e = NAV.find((n) => n.sections.some((sec) => sec.items.some((i) => i.href === pathname)));
    if (e) setEntrada(e.id);
  }, [pathname]);

  const nav = useMemo(() => {
    const rol = info?.rol ?? "PROPIETARIO";
    return NAV.map((e) => ({
      ...e,
      sections: e.sections.map((sec) => ({ ...sec, items: sec.items.filter((i) => puede(rol, i.roles)) })).filter((sec) => sec.items.length > 0),
    })).filter((e) => e.sections.length > 0);
  }, [info?.rol]);

  const activa = nav.find((e) => e.id === entrada) ?? nav[0];

  async function salir() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }
  function abrirEntrada(e: NavEntry) {
    setEntrada(e.id);
    if (e.direct) { const h = e.sections[0]?.items[0]?.href; if (h) router.push(h); return; }
    setMenuOpen(true);
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  const verSubmenu = menuOpen && activa && !activa.direct;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Menú principal (rail) */}
      <nav className={`flex shrink-0 flex-col gap-1 border-r border-border bg-card py-3 transition-all ${railOpen ? "w-56 px-3" : "w-16 items-center"}`}>
        <div className={`mb-2 flex items-center gap-2 ${railOpen ? "px-1" : ""}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">G</div>
          {railOpen && <span className="font-semibold">Gluuh <span className="text-muted-foreground">TPV</span></span>}
        </div>
        {nav.map((e) => {
          const Icon = e.icon;
          const act = e.id === activa?.id;
          return (
            <button key={e.id} onClick={() => abrirEntrada(e)} title={e.title}
              className={`flex h-11 items-center gap-3 rounded-lg transition-colors ${railOpen ? "px-3" : "w-11 justify-center"} ${act ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <Icon className="h-5 w-5 shrink-0" />{railOpen && <span className="text-sm font-medium">{e.title}</span>}
            </button>
          );
        })}
        <button onClick={toggleRail} title={railOpen ? "Contraer" : "Expandir"}
          className={`mt-auto flex h-10 items-center gap-3 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${railOpen ? "px-3" : "w-11 justify-center"}`}>
          {railOpen ? <PanelLeftClose className="h-5 w-5 shrink-0" /> : <PanelLeft className="h-5 w-5 shrink-0" />}{railOpen && <span className="text-sm">Contraer</span>}
        </button>
      </nav>

      {/* Submenú al lado */}
      {verSubmenu && (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-16 items-center px-4 text-base font-semibold">{activa.title}</div>
          <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 text-sm">
            {activa.sections.map((sec, si) => (
              <div key={si} className="space-y-0.5">
                {sec.title && <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{sec.title}</div>}
                {sec.items.map((i, ii) => {
                  if (!i.href) return (
                    <div key={ii} className="flex h-9 items-center justify-between rounded-md px-3 text-muted-foreground/50" title="Próximamente">
                      {i.label}<span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">pronto</span>
                    </div>
                  );
                  const cls = `flex h-9 items-center justify-between rounded-md px-3 transition-colors ${pathname === i.href ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;
                  return i.blank
                    ? <a key={ii} href={i.href} target="_blank" rel="noreferrer" className={cls}>{i.label}<ExternalLink className="h-3.5 w-3.5 opacity-50" /></a>
                    : <Link key={ii} href={i.href} className={cls}>{i.label}</Link>;
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">{info?.empresa}</div>
            <div className="capitalize">{info?.rol?.toLowerCase()}</div>
          </div>
        </aside>
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            {!activa?.direct && (
              <Button variant="ghost" size="icon" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={toggleMenu}>
                {menuOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
            )}
            <span className="font-medium">{activa?.title}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{info?.nombre || info?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={salir}><LogOut className="h-4 w-4" /> Cerrar sesión</Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
