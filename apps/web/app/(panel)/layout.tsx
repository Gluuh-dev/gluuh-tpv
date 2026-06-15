"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Settings, LayoutGrid,
  ShoppingCart, ChefHat, Store, MonitorSmartphone, Megaphone, LogOut, Smartphone,
  Palette, ChevronDown, ChevronRight, type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem { href: string; label: string; icon: LucideIcon }

interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "principal",
    title: "Principal",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    ],
  },
  {
    id: "carta-sala",
    title: "Carta y sala",
    icon: BookOpen,
    items: [
      { href: "/carta", label: "Carta", icon: BookOpen },
      { href: "/sala", label: "Sala y mesas", icon: LayoutGrid },
      { href: "/personalizar", label: "Personalización", icon: Palette },
    ],
  },
  {
    id: "operativa",
    title: "Operativa",
    icon: ShoppingCart,
    items: [
      { href: "/tpv", label: "TPV", icon: ShoppingCart },
      { href: "/comandera", label: "Comandera", icon: Smartphone },
      { href: "/cocina", label: "Cocina (KDS)", icon: ChefHat },
      { href: "/kiosko", label: "Kiosko", icon: Store },
      { href: "/pantalla", label: "Display", icon: MonitorSmartphone },
      { href: "/ofertas", label: "Ofertas", icon: Megaphone },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    icon: Users,
    items: [
      { href: "/empleados", label: "Empleados", icon: Users },
    ],
  },
  {
    id: "analisis",
    title: "Análisis y ajustes",
    icon: BarChart3,
    items: [
      { href: "/informes", label: "Informes", icon: BarChart3 },
      { href: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];

interface SessionInfo { empresa: string; email: string; nombre: string; rol: string }

function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => item.href === pathname);
}

function buildInitialOpen(pathname: string): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const group of NAV_GROUPS) {
    state[group.id] = groupContainsPath(group, pathname);
  }
  return state;
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    buildInitialOpen(pathname)
  );

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      const { data: u } = await sb.from("app_user").select("nombre,rol").eq("auth_user_id", session.user.id).maybeSingle();
      setInfo({ empresa: t?.nombre ?? "Mi empresa", email: session.user.email ?? "", nombre: u?.nombre ?? "", rol: u?.rol ?? "" });
      setLoading(false);
    })();
  }, [router]);

  async function salir() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  function toggleGroup(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2 px-5 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">G</span>
          Gluuh <span className="text-muted-foreground">TPV</span>
        </div>

        {/* Nav con scroll */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 text-sm">
          {NAV_GROUPS.map((group) => {
            const isOpen = open[group.id] ?? false;
            const GroupIcon = group.icon;
            const Chevron = isOpen ? ChevronDown : ChevronRight;
            const groupActive = groupContainsPath(group, pathname);

            return (
              <div key={group.id} className="mb-0.5">
                {/* Encabezado del grupo */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                    groupActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left font-medium">{group.title}</span>
                  <Chevron className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>

                {/* Sub-items */}
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`flex h-9 items-center gap-3 rounded-md pl-9 pr-3 transition-colors ${
                            active
                              ? "bg-accent font-medium text-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pie de sidebar */}
        <div className="shrink-0 border-t border-border p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{info?.empresa}</div>
          <div>{info?.rol?.toLowerCase()}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="font-medium">{info?.empresa}</div>
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
