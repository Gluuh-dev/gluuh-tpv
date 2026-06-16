"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Settings, LayoutGrid,
  ShoppingCart, ChefHat, Store, MonitorSmartphone, Megaphone, LogOut, Smartphone,
  Palette, PanelLeftClose, PanelLeft, type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Rol = "PROPIETARIO" | "ENCARGADO" | "CAMARERO" | "COCINA";
interface NavItem { href: string; label: string; icon: LucideIcon; roles?: Rol[] }
interface NavGroup { id: string; title: string; icon: LucideIcon; items: NavItem[] }

// roles? ausente = visible para todos
const NAV_GROUPS: NavGroup[] = [
  { id: "inicio", title: "Inicio", icon: LayoutDashboard, items: [
    { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, roles: ["PROPIETARIO", "ENCARGADO"] },
  ] },
  { id: "operativa", title: "Operativa", icon: ShoppingCart, items: [
    { href: "/tpv", label: "TPV", icon: ShoppingCart, roles: ["PROPIETARIO", "ENCARGADO", "CAMARERO"] },
    { href: "/comandera", label: "Comandera", icon: Smartphone, roles: ["PROPIETARIO", "ENCARGADO", "CAMARERO"] },
    { href: "/cocina", label: "Cocina (KDS)", icon: ChefHat, roles: ["PROPIETARIO", "ENCARGADO", "COCINA"] },
    { href: "/kiosko", label: "Kiosko", icon: Store, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/pantalla", label: "Display", icon: MonitorSmartphone, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/ofertas", label: "Ofertas", icon: Megaphone, roles: ["PROPIETARIO", "ENCARGADO"] },
  ] },
  { id: "carta", title: "Carta y sala", icon: BookOpen, items: [
    { href: "/carta", label: "Carta", icon: BookOpen, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/sala", label: "Sala y mesas", icon: LayoutGrid, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/personalizar", label: "Personalización", icon: Palette, roles: ["PROPIETARIO"] },
  ] },
  { id: "gestion", title: "Gestión", icon: BarChart3, items: [
    { href: "/empleados", label: "Empleados", icon: Users, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/informes", label: "Informes", icon: BarChart3, roles: ["PROPIETARIO", "ENCARGADO"] },
    { href: "/ajustes", label: "Ajustes", icon: Settings, roles: ["PROPIETARIO"] },
  ] },
];

interface SessionInfo { empresa: string; email: string; nombre: string; rol: Rol }
const puede = (rol: Rol, roles?: Rol[]) => !roles || roles.includes(rol);

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<string>("inicio");
  const [abierto, setAbierto] = useState(true);

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

  // grupo activo según la ruta
  useEffect(() => {
    const g = NAV_GROUPS.find((gr) => gr.items.some((i) => i.href === pathname));
    if (g) setGrupo(g.id);
  }, [pathname]);

  // navegación filtrada por rol
  const grupos = useMemo(() => {
    const rol = info?.rol ?? "PROPIETARIO";
    return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => puede(rol, i.roles)) })).filter((g) => g.items.length > 0);
  }, [info?.rol]);

  const grupoActivo = grupos.find((g) => g.id === grupo) ?? grupos[0];

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }
  function abrirGrupo(g: NavGroup) {
    setGrupo(g.id);
    setAbierto(true);
    if (!g.items.some((i) => i.href === pathname)) router.push(g.items[0]!.href);
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Rail principal (iconos) */}
      <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
        <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">G</div>
        {grupos.map((g) => {
          const Icon = g.icon;
          const activo = g.id === grupoActivo?.id;
          return (
            <button key={g.id} onClick={() => abrirGrupo(g)} title={g.title}
              className={`grid h-11 w-11 place-items-center rounded-lg transition-colors ${activo ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </nav>

      {/* Submenú al lado (del grupo activo) */}
      {abierto && grupoActivo && (
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-16 items-center px-4 text-base font-semibold">{grupoActivo.title}</div>
          <div className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 text-sm">
            {grupoActivo.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}
                  className={`flex h-9 items-center gap-3 rounded-md px-3 transition-colors ${active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </Link>
              );
            })}
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
            <span className="font-medium">{grupoActivo?.title}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{info?.nombre || info?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={salir}><LogOut className="h-4 w-4" /> Salir</Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
