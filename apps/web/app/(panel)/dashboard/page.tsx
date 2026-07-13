"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ShoppingCart, ChefHat, Store, MonitorSmartphone, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { getSetting } from "../../lib/settings";
import type { ConfigImpresion } from "../../lib/impresion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { eur } from "@/app/lib/money";


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

// Checklist de puesta en marcha (estilo Supabase): solo se muestra si falta algo.
interface PasoPuesta { done: boolean; label: string; href: string }

function PuestaEnMarcha() {
  const [pasos, setPasos] = useState<PasoPuesta[] | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const [branding, prod, mesas, emp, cfg] = await Promise.all([
        sb.from("tenant_branding").select("logo_url").limit(1).maybeSingle(),
        sb.from("product").select("id", { count: "exact", head: true }),
        sb.from("restaurant_table").select("id", { count: "exact", head: true }),
        sb.from("app_user").select("id", { count: "exact", head: true }).neq("rol", "PROPIETARIO"),
        getSetting<ConfigImpresion>("impresion.config").catch(() => null),
      ]);
      setPasos([
        { done: !!(branding.data as { logo_url: string | null } | null)?.logo_url, label: "Sube el logo de tu negocio", href: "/personalizar" },
        { done: (prod.count ?? 0) > 0, label: "Crea tu carta de productos", href: "/carta" },
        { done: (mesas.count ?? 0) > 0, label: "Dibuja las mesas del local", href: "/planos-de-mesas" },
        { done: (emp.count ?? 0) > 0, label: "Añade empleados con PIN", href: "/empleados" },
        { done: (cfg?.impresoras?.length ?? 0) > 0, label: "Configura una impresora", href: "/configuracion-de-impresion" },
      ]);
    })();
  }, []);

  if (!pasos || pasos.every((p) => p.done)) return null;
  const hechos = pasos.filter((p) => p.done).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Puesta en marcha</span>
          <span className="font-normal text-muted-foreground">{hechos} de {pasos.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {pasos.map((p) => (
            <Link key={p.href} href={p.href} className="group flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2.5">
                {p.done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className={p.done ? "text-muted-foreground line-through" : ""}>{p.label}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Tarjeta de estadística compacta: micro-label uppercase + número grande + sub-dato.
function StatMini({ label, value, sub, href }: {
  label: string; value: ReactNode; sub?: ReactNode; href?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {sub != null && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </>
  );
  const cls = "block rounded-lg border border-border bg-card p-4";
  return href
    ? <Link href={href} className={`${cls} transition-colors hover:bg-accent`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

// Resumen del negocio HOY: ventas cobradas, cuentas abiertas, reservas y estado de
// caja. Cada métrica es independiente (Promise.allSettled): si una consulta falla, su
// tarjeta muestra "—" sin afectar al resto. RLS filtra por tenant automáticamente.
function ResumenNegocio() {
  const [r, setR] = useState<{
    ventas: number | null; tickets: number | null;
    abiertas: number | null; reservas: number | null;
    caja: { abierta: boolean; desde: string | null } | null;
  } | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio); fin.setDate(fin.getDate() + 1);
    const desde = inicio.toISOString(), hasta = fin.toISOString();
    (async () => {
      const res = await Promise.allSettled([
        sb.from("sales_order").select("total").eq("estado", "COBRADA").gte("created_at", desde),
        sb.from("sales_order").select("id", { count: "exact", head: true })
          .in("estado", ["ABIERTA", "ENVIADA_COCINA", "SERVIDA", "POR_COBRAR"]),
        sb.from("reservation").select("id", { count: "exact", head: true })
          .gte("fecha_hora", desde).lt("fecha_hora", hasta).neq("estado", "CANCELADA"),
        sb.from("cash_session").select("abierta_en").is("cerrada_en", null)
          .order("abierta_en", { ascending: false }).limit(1).maybeSingle(),
      ]);
      // Devuelve la respuesta si la consulta se resolvió sin error; si no, null.
      const pick = (i: number) => {
        const x = res[i];
        if (!x || x.status !== "fulfilled") return null;
        const v = x.value as { data: unknown; count: number | null; error: unknown };
        return v.error ? null : v;
      };
      const v0 = pick(0), v1 = pick(1), v2 = pick(2), v3 = pick(3);
      const rows = v0 ? ((v0.data as { total: number }[] | null) ?? []) : null;
      const cajaRow = v3 ? (v3.data as { abierta_en: string } | null) : null;
      setR({
        ventas: rows ? rows.reduce((s, o) => s + Number(o.total), 0) : null,
        tickets: rows ? rows.length : null,
        abiertas: v1 ? (v1.count ?? 0) : null,
        reservas: v2 ? (v2.count ?? 0) : null,
        caja: v3 ? { abierta: !!cajaRow, desde: cajaRow?.abierta_en ?? null } : null,
      });
    })();
  }, []);

  if (!r) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const caja = r.caja;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatMini
        label="Ventas de hoy"
        value={r.ventas == null ? "—" : eur(r.ventas)}
        sub={r.tickets == null ? null : `${r.tickets.toLocaleString("es-ES")} ${r.tickets === 1 ? "ticket" : "tickets"}`}
      />
      <StatMini
        label="Cuentas abiertas"
        value={r.abiertas == null ? "—" : r.abiertas.toLocaleString("es-ES")}
        sub="En curso"
      />
      <StatMini
        label="Reservas de hoy"
        value={r.reservas == null ? "—" : r.reservas.toLocaleString("es-ES")}
        sub="Sin canceladas"
      />
      <StatMini
        label="Caja"
        href="/caja"
        value={
          caja == null ? "—"
            : caja.abierta
              ? <span className="text-emerald-500">Abierta</span>
              : <span className="text-muted-foreground">Cerrada</span>
        }
        sub={
          caja == null ? null
            : caja.abierta
              ? (caja.desde ? `Desde ${new Date(caja.desde).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Abierta")
              : "Sin sesión abierta"
        }
      />
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState("");
  const [porHora, setPorHora] = useState<number[]>(HORAS.map(() => 0));
  const [ultimos, setUltimos] = useState<Pedido[]>([]);
  const [top, setTop] = useState<{ nombre: string; n: number }[]>([]);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
      const iso = inicio.toISOString();
      const [{ data: t }, { data: orders }] = await Promise.all([
        sb.from("tenant").select("nombre").limit(1).maybeSingle(),
        sb.from("sales_order").select("id,total,estado,estado_preparacion,numero_pedido,canal,created_at,restaurant_table(nombre)").gte("created_at", iso).order("created_at", { ascending: false }),
      ]);
      const ped = (orders as unknown as Pedido[]) ?? [];
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

      setEmpresa(t?.nombre ?? "");
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

      {/* Resumen del negocio hoy */}
      <ResumenNegocio />

      <PuestaEnMarcha />

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
