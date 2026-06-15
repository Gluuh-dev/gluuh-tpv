"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, ChefHat, Store, MonitorSmartphone, TrendingUp, Receipt, Coins, Armchair, ArrowRight } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

const eur = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

interface Pedido {
  id: string; total: number; estado: string; estado_preparacion: string;
  numero_pedido: number | null; canal: string; created_at: string;
  restaurant_table: { nombre: string } | null;
}

const ESTADO_BADGE: Record<string, { t: string; c: string }> = {
  ABIERTA: { t: "Abierta", c: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  ENVIADA_COCINA: { t: "En cocina", c: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  SERVIDA: { t: "Servida", c: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  POR_COBRAR: { t: "Por cobrar", c: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  COBRADA: { t: "Cobrada", c: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ANULADA: { t: "Anulada", c: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};
const HORAS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00 → 23:00

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState("");
  const [k, setK] = useState({ ventas: 0, tickets: 0, medio: 0, mesas: 0, ocupadas: 0 });
  const [porHora, setPorHora] = useState<number[]>(HORAS.map(() => 0));
  const [ultimos, setUltimos] = useState<Pedido[]>([]);
  const [top, setTop] = useState<{ nombre: string; n: number }[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
      const iso = inicio.toISOString();
      const [{ data: t }, { data: orders }, { data: mesas }] = await Promise.all([
        sb.from("tenant").select("nombre").limit(1).maybeSingle(),
        sb.from("sales_order").select("id,total,estado,estado_preparacion,numero_pedido,canal,created_at,restaurant_table(nombre)").gte("created_at", iso).order("created_at", { ascending: false }),
        sb.from("restaurant_table").select("id,estado"),
      ]);
      const ped = (orders as unknown as Pedido[]) ?? [];
      const ventas = ped.reduce((s, o) => s + Number(o.total), 0);
      const horas = HORAS.map(() => 0);
      ped.forEach((o) => { const h = new Date(o.created_at).getHours(); const i = HORAS.indexOf(h); if (i >= 0) horas[i] += Number(o.total); });

      const ids = ped.map((o) => o.id);
      let lineas: { nombre: string; cantidad: number }[] = [];
      if (ids.length) {
        const { data } = await sb.from("order_line").select("nombre,cantidad,order_id").in("order_id", ids);
        lineas = (data as { nombre: string; cantidad: number }[]) ?? [];
      }
      const acc: Record<string, number> = {};
      lineas.forEach((l) => { acc[l.nombre] = (acc[l.nombre] ?? 0) + Number(l.cantidad); });
      const topArr = Object.entries(acc).map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n).slice(0, 5);

      const ms = (mesas as { estado: string }[]) ?? [];
      setEmpresa(t?.nombre ?? "");
      setK({ ventas, tickets: ped.length, medio: ped.length ? ventas / ped.length : 0, mesas: ms.length, ocupadas: ms.filter((m) => m.estado !== "LIBRE").length });
      setPorHora(horas);
      setUltimos(ped.slice(0, 6));
      setTop(topArr);
      setLoading(false);
    })();
  }, []);

  const maxHora = Math.max(1, ...porHora);
  const hoy = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={empresa || "Inicio"}
        description={hoy}
        actions={<Button asChild><Link href="/tpv"><ShoppingCart className="h-4 w-4" /> Abrir TPV</Link></Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Ventas hoy" value={loading ? "…" : eur(k.ventas)} />
        <StatCard icon={<Receipt className="h-4 w-4" />} label="Tickets" value={loading ? "…" : String(k.tickets)} />
        <StatCard icon={<Coins className="h-4 w-4" />} label="Ticket medio" value={loading ? "…" : eur(k.medio)} />
        <StatCard icon={<Armchair className="h-4 w-4" />} label="Mesas" value={loading ? "…" : `${k.ocupadas}/${k.mesas}`} hint={k.mesas ? `${k.mesas - k.ocupadas} libres` : undefined} />
      </div>

      {/* Ventas por hora */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ventas por hora</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1.5">
            {porHora.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t bg-primary/85 transition-all" style={{ height: `${Math.max(2, (v / maxHora) * 100)}%` }} title={eur(v)} />
                </div>
                <span className="text-[10px] text-muted-foreground">{HORAS[i]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Últimos pedidos */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Últimos pedidos</CardTitle></CardHeader>
          <CardContent>
            {!loading && ultimos.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin pedidos hoy todavía.</p>}
            <div className="divide-y divide-border">
              {ultimos.map((o) => {
                const b = ESTADO_BADGE[o.estado] ?? { t: o.estado, c: "bg-muted text-muted-foreground" };
                const titulo = o.restaurant_table?.nombre ?? (o.numero_pedido ? `${o.canal} · A-${o.numero_pedido}` : o.canal);
                return (
                  <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{titulo}</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">{eur(Number(o.total))}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.c}`}>{b.t}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top productos */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Top productos hoy</CardTitle></CardHeader>
          <CardContent>
            {!loading && top.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aún sin ventas de productos.</p>}
            <div className="space-y-2.5">
              {top.map((p) => (
                <div key={p.nombre}>
                  <div className="mb-1 flex justify-between text-sm"><span>{p.nombre}</span><span className="text-muted-foreground">{p.n}</span></div>
                  <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(p.n / top[0].n) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { href: "/tpv", label: "TPV", icon: ShoppingCart },
          { href: "/cocina", label: "Cocina", icon: ChefHat },
          { href: "/kiosko", label: "Kiosko", icon: Store },
          { href: "/pantalla", label: "Display", icon: MonitorSmartphone },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="flex items-center justify-between p-4 transition-colors hover:bg-accent">
              <span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
