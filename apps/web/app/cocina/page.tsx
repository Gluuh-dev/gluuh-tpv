"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { COLOR, LABEL, SIGUIENTE, type EstadoPrep } from "../lib/estados";
import { estacionDe } from "../lib/estaciones";

interface Linea { nombre: string; cantidad: number; estacion: string | null; notas: string | null }
type Filtro = "COCINA" | "BARRA" | "CAMARERO" | "TODAS";
const FILTROS: { k: Filtro; label: string }[] = [
  { k: "COCINA", label: "Cocina" }, { k: "BARRA", label: "Barra" },
  { k: "CAMARERO", label: "Camarero" }, { k: "TODAS", label: "Todas" },
];
interface Pedido {
  id: string;
  numero_pedido: number | null;
  canal: string;
  estado_preparacion: EstadoPrep;
  created_at: string;
  order_line: Linea[];
  restaurant_table: { nombre: string } | null;
}

const minutos = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

export default function Cocina() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("COCINA");

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from("sales_order")
      .select("id,numero_pedido,canal,estado_preparacion,created_at,order_line(nombre,cantidad,estacion,notas),restaurant_table(nombre)")
      .eq("estado", "ENVIADA_COCINA")
      .neq("estado_preparacion", "ENTREGADO")
      .order("created_at", { ascending: true });
    setPedidos((data as unknown as Pedido[]) ?? []);
  }, [sb]);

  useEffect(() => {
    let ch: ReturnType<typeof sb.channel> | undefined;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      await cargar();
      setLoading(false);
      ch = sb
        .channel("cocina")
        .on("postgres_changes", { event: "*", schema: "public", table: "sales_order" }, () => cargar())
        .subscribe();
    })();
    return () => { if (ch) sb.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, []);

  async function avanzar(p: Pedido) {
    const sig = SIGUIENTE[p.estado_preparacion];
    if (!sig) return;
    await sb.from("sales_order").update({ estado_preparacion: sig }).eq("id", p.id);
    cargar();
  }

  if (loading) return (
    <div className="dark grid min-h-screen place-items-center bg-background text-muted-foreground">
      Cargando…
    </div>
  );

  const visibles = pedidos.filter((p) => filtro === "TODAS" || p.order_line.some((l) => estacionDe(l.estacion) === filtro));

  return (
    <div className="dark">
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center justify-between">
            <strong className="text-lg font-semibold tracking-tight">Preparación</strong>
            <span className="text-sm text-muted-foreground tabular-nums">{visibles.length} comandas · tiempo real</span>
          </div>
          <div className="mt-2 flex gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.k}
                onClick={() => setFiltro(f.k)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${filtro === f.k ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.length === 0 && (
            <p className="col-span-full text-muted-foreground">No hay comandas en {FILTROS.find((f) => f.k === filtro)?.label.toLowerCase()}.</p>
          )}
          {visibles.map((p) => {
            const titulo = p.restaurant_table?.nombre ?? (p.numero_pedido ? `A-${p.numero_pedido}` : "Pedido");
            const sig = SIGUIENTE[p.estado_preparacion];
            const lineas = filtro === "TODAS" ? p.order_line : p.order_line.filter((l) => estacionDe(l.estacion) === filtro);
            return (
              <div
                key={p.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
                style={{ borderTopColor: COLOR[p.estado_preparacion], borderTopWidth: 4 }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <strong className="text-lg font-semibold">{titulo}</strong>
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: COLOR[p.estado_preparacion] }}
                  >
                    {LABEL[p.estado_preparacion]}
                  </span>
                </div>
                <div className="mb-2 text-xs text-muted-foreground tabular-nums">
                  {p.canal} · hace {minutos(p.created_at)} min
                </div>
                <ul className="mb-3 space-y-0.5 text-sm">
                  {lineas.map((l, i) => (
                    <li key={i}>
                      <b>{l.cantidad}×</b> {l.nombre}
                      {l.notas && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">✎ {l.notas}</span>}
                    </li>
                  ))}
                </ul>
                {sig && (
                  <button
                    onClick={() => avanzar(p)}
                    className="w-full rounded-md py-2 text-sm font-medium text-white"
                    style={{ background: COLOR[sig] }}
                  >
                    → {LABEL[sig]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
