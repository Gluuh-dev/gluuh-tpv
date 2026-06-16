"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BarChart3, ShoppingCart, LogOut, ExternalLink,
  PanelLeftClose, PanelLeft, Landmark, Package, Wrench, Info, type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Rol = "PROPIETARIO" | "ENCARGADO" | "CAMARERO" | "COCINA";
interface NavLink { href?: string; label: string; roles?: Rol[]; soon?: boolean; blank?: boolean }
interface NavSection { title?: string; items: NavLink[] }
interface NavEntry { id: string; title: string; icon: LucideIcon; sections: NavSection[] }

const GEST: Rol[] = ["PROPIETARIO", "ENCARGADO"];
const PROP: Rol[] = ["PROPIETARIO"];

// Menú principal estilo Ágora. soon: página aún no construida.
const NAV: NavEntry[] = [
  { id: "inicio", title: "Inicio", icon: LayoutDashboard, sections: [
    { items: [{ href: "/dashboard", label: "Resumen", roles: GEST }] },
  ] },
  { id: "operativa", title: "Operativa", icon: ShoppingCart, sections: [
    { title: "Venta", items: [
      { href: "/tpv", label: "TPV", roles: ["PROPIETARIO", "ENCARGADO", "CAMARERO"], blank: true },
      { href: "/comandera", label: "Comandera", roles: ["PROPIETARIO", "ENCARGADO", "CAMARERO"], blank: true },
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
    { title: "General", items: [{ href: "/ajustes", label: "Empresa y local", roles: PROP }] },
    { title: "Usuarios", items: [
      { href: "/empleados", label: "Empleados y PIN", roles: GEST },
      { label: "Perfiles y permisos", roles: PROP, soon: true },
    ] },
    { title: "Catálogo", items: [
      { href: "/carta", label: "Familias y productos", roles: GEST },
      { href: "/menus", label: "Menús y combos", roles: GEST },
      { label: "Alérgenos", roles: GEST, soon: true },
    ] },
    { title: "Sala", items: [{ href: "/sala", label: "Salas y mesas", roles: GEST }] },
    { title: "Tarifas y precios", items: [
      { href: "/formas-pago", label: "Formas de pago", roles: GEST },
      { href: "/descuentos", label: "Descuentos", roles: GEST },
      { label: "Impuestos", roles: PROP, soon: true },
      { label: "Tarifas y promociones", roles: GEST, soon: true },
    ] },
    { title: "Marca", items: [{ href: "/personalizar", label: "Personalización", roles: PROP }] },
  ] },
  { id: "compras", title: "Compras y Stocks", icon: Package, sections: [
    { title: "General", items: [{ label: "Almacenes", roles: GEST, soon: true }, { label: "Proveedores", roles: GEST, soon: true }] },
    { title: "Compras", items: [{ label: "Pedidos a proveedor", roles: GEST, soon: true }, { label: "Albaranes y facturas", roles: GEST, soon: true }] },
    { title: "Stock", items: [{ label: "Inventario y mermas", roles: GEST, soon: true }, { label: "Escandallos", roles: GEST, soon: true }] },
  ] },
  { id: "herramientas", title: "Herramientas", icon: Wrench, sections: [
    { title: "VERI*FACTU", items: [{ label: "Visor Verifactu", roles: PROP, soon: true }] },
    { title: "Impresión", items: [{ label: "Impresoras", roles: GEST, soon: true }] },
  ] },
  { id: "informes", title: "Informes", icon: BarChart3, sections: [
    { items: [{ href: "/informes", label: "Informes", roles: GEST }] },
  ] },
  { id: "ayuda", title: "Ayuda", icon: Info, sections: [
    { items: [{ label: "Documentación", soon: true }] },
  ] },
];

interface SessionInfo { empresa: string; email: string; nombre: string; rol: Rol }
const puede = (rol: Rol, roles?: Rol[]) => !roles || roles.includes(rol);

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [entrada, setEntrada] = useState("inicio");
  const [abierto, setAbierto] = useState(true);
  const [railOpen, setRailOpen] = useState(false);

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

  // entrada activa según ruta
  useEffect(() => {
    const e = NAV.find((n) => n.sections.some((s) => s.items.some((i) => i.href === pathname)));
    if (e) setEntrada(e.id);
  }, [pathname]);

  // filtra por rol; oculta secciones/entradas vacías
  const nav = useMemo(() => {
    const rol = info?.rol ?? "PROPIETARIO";
    return NAV.map((e) => ({
      ...e,
      sections: e.sections.map((s) => ({ ...s, items: s.items.filter((i) => puede(rol, i.roles)) })).filter((s) => s.items.length > 0),
    })).filter((e) => e.sections.length > 0);
  }, [info?.rol]);

  const activa = nav.find((e) => e.id === entrada) ?? nav[0];

  async function salir() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }
  // Solo abre el submenú; NO navega (las páginas se abren al pulsarlas).
  function abrirEntrada(e: NavEntry) { setEntrada(e.id); setAbierto(true); }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
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
        <button onClick={() => setRailOpen((v) => !v)} title={railOpen ? "Contraer" : "Expandir"}
          className={`mt-auto flex h-10 items-center gap-3 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${railOpen ? "px-3" : "w-11 justify-center"}`}>
          {railOpen ? <PanelLeftClose className="h-5 w-5 shrink-0" /> : <PanelLeft className="h-5 w-5 shrink-0" />}{railOpen && <span className="text-sm">Contraer</span>}
        </button>
      </nav>

      {/* Submenú al lado (secciones + páginas de la entrada activa) */}
      {abierto && activa && (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-16 items-center px-4 text-base font-semibold">{activa.title}</div>
          <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 text-sm">
            {activa.sections.map((s, si) => (
              <div key={si} className="space-y-0.5">
                {s.title && <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</div>}
                {s.items.map((i) => {
                  if (!i.href) return (
                    <div key={i.label} className="flex h-9 items-center justify-between rounded-md px-3 text-muted-foreground/50" title="Próximamente">
                      {i.label}<span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">pronto</span>
                    </div>
                  );
                  const cls = `flex h-9 items-center justify-between rounded-md px-3 transition-colors ${pathname === i.href ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;
                  return i.blank
                    ? <a key={i.label} href={i.href} target="_blank" rel="noreferrer" className={cls}>{i.label}<ExternalLink className="h-3.5 w-3.5 opacity-50" /></a>
                    : <Link key={i.label} href={i.href} className={cls}>{i.label}</Link>;
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
            <Button variant="ghost" size="icon" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} onClick={() => setAbierto((v) => !v)}>
              {abierto ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <span className="font-medium">{activa?.title}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{info?.nombre || info?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={salir}><LogOut className="h-4 w-4" /> Cerrar sesión</Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
