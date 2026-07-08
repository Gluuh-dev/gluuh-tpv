"use client";

// Consola de PLATAFORMA (admin.gluuh.com): chrome propio — menú lateral
// (Empresas · Suscripciones · Plantilla base) + gate es_admin_plataforma.
// Es una superficie distinta del backoffice de cliente; solo la ve Gluuh.
// El host ya está acotado por app/admin/layout.tsx (server, notFound fuera de
// admin.gluuh.com); aquí se comprueba que el usuario es admin de plataforma.
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, Building2, CreditCard, LayoutTemplate, Tags, LogOut, ShieldAlert } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Empresas", icon: Building2 },
  { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard },
  { href: "/admin/uso", label: "Uso", icon: Activity },
  { href: "/admin/tarifas", label: "Tarifas", icon: Tags },
  { href: "/admin/plantilla", label: "Plantilla base", icon: LayoutTemplate },
] as const;

const activo = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

export function ConsolaPlataforma({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"cargando" | "no-auth" | "ok">("cargando");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      setEmail(session.user.email ?? "");
      const { data: esAdmin } = await sb.rpc("es_admin_plataforma");
      setEstado(esAdmin ? "ok" : "no-auth");
    })();
  }, [router]);

  if (estado === "cargando") return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Cargando…</div>;

  if (estado === "no-auth") return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
      <div className="max-w-sm rounded-lg border border-border bg-surface p-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted"><ShieldAlert className="h-5 w-5 text-muted-foreground" aria-hidden /></div>
        <h1 className="mt-3 text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Esta zona es solo para el equipo de Gluuh.</p>
        <Button className="mt-4" onClick={() => router.replace("/login")}>Iniciar sesión</Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border bg-surface p-2">
        <div className="mb-2 flex items-center gap-2 px-2 py-2 text-[15px] font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand font-bold text-brand-foreground">G</span>
          Gluuh <span className="text-muted-foreground">Plataforma</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const act = activo(n.href, pathname);
            return (
              <Link key={n.href} href={n.href}
                className={`flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${act ? "bg-surface-muted font-medium text-foreground" : "text-(--text-secondary) hover:bg-surface-overlay hover:text-foreground"}`}>
                <Icon className="h-4 w-4 shrink-0" /> {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
          <span className="text-[13px] font-medium">{NAV.find((n) => activo(n.href, pathname))?.label ?? "Plataforma"}</span>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="hidden text-muted-foreground sm:inline">{email}</span>
            <Button variant="ghost" size="sm" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); }}>
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
