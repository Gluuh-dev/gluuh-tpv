"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, ChefHat, Store, MonitorSmartphone, Users, BookOpen, type LucideIcon } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  const [stats, setStats] = useState({ productos: 0, empleados: 0 });

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [{ count: productos }, { count: empleados }] = await Promise.all([
        sb.from("product").select("id", { count: "exact", head: true }),
        sb.from("app_user").select("id", { count: "exact", head: true }),
      ]);
      setStats({ productos: productos ?? 0, empleados: empleados ?? 0 });
    })();
  }, []);

  const accesos = [
    { href: "/tpv", label: "Abrir TPV", icon: ShoppingCart, color: "bg-emerald-600" },
    { href: "/kiosko", label: "Kiosko", icon: Store, color: "bg-rose-600" },
    { href: "/cocina", label: "Cocina (KDS)", icon: ChefHat, color: "bg-slate-700" },
    { href: "/pantalla", label: "Display cliente", icon: MonitorSmartphone, color: "bg-sky-600" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-muted-foreground">Resumen de tu negocio y accesos rápidos.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Productos" value={stats.productos} icon={BookOpen} href="/carta" />
        <Stat label="Empleados" value={stats.empleados} icon={Users} href="/empleados" />
        <Stat label="Pedidos hoy" value="—" icon={ShoppingCart} />
        <Stat label="Ventas hoy" value="—" icon={ShoppingCart} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {accesos.map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <Card className="flex flex-col items-start gap-3 p-5 transition-shadow hover:shadow-md">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${color} text-white`}><Icon className="h-5 w-5" /></span>
                <span className="font-medium">{label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, href }: { label: string; value: number | string; icon: LucideIcon; href?: string }) {
  const body = (
    <Card className="flex items-center justify-between p-5">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      <Icon className="h-6 w-6 text-slate-300" />
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
