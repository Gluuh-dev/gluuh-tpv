"use client";

import { useEffect, useState, type ReactNode, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Settings, LayoutGrid,
  ShoppingCart, ChefHat, Store, MonitorSmartphone, Megaphone, LogOut, Smartphone,
} from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

interface NavItem { href: string; label: string; icon: ComponentType<{ className?: string }> }

const GESTION: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/carta", label: "Carta", icon: BookOpen },
  { href: "/sala", label: "Sala", icon: LayoutGrid },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];
const OPERATIVA: NavItem[] = [
  { href: "/tpv", label: "TPV", icon: ShoppingCart },
  { href: "/comandera", label: "Comandera", icon: Smartphone },
  { href: "/kds", label: "Cocina (KDS)", icon: ChefHat },
  { href: "/kiosko", label: "Kiosko", icon: Store },
  { href: "/pantalla", label: "Display", icon: MonitorSmartphone },
  { href: "/ofertas", label: "Ofertas", icon: Megaphone },
];

interface SessionInfo { empresa: string; email: string; nombre: string; rol: string }

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Cargando…</div>;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 px-5 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">G</span>
          Gluuh <span className="text-slate-400">TPV</span>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 text-sm">
          <NavSection title="Gestión" items={GESTION} pathname={pathname} />
          <NavSection title="Operativa" items={OPERATIVA} pathname={pathname} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="font-medium">{info?.empresa}</div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{info?.nombre || info?.email} · <span className="text-slate-400">{info?.rol}</span></span>
            <button onClick={salir} className="btn-ghost"><LogOut className="h-4 w-4" /> Salir</button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            className={`mt-0.5 flex items-center gap-3 rounded-lg px-3 py-2 ${active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700 hover:bg-slate-100"}`}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        );
      })}
    </div>
  );
}
