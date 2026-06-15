"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { COLOR, LABEL, SIGUIENTE, type EstadoPrep } from "../lib/estados";

interface Linea { nombre: string; cantidad: number }
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

  const cargar = useCallback(async () => {
    const { data } = await sb
      .from("sales_order")
      .select("id,numero_pedido,canal,estado_preparacion,created_at,order_line(nombre,cantidad),restaurant_table(nombre)")
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

  return (
    <div className="dark">
      <main className="min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <strong className="text-lg font-semibold tracking-tight">Cocina</strong>
          <span className="text-sm text-muted-foreground tabular-nums">{pedidos.length} pedidos · tiempo real</span>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pedidos.length === 0 && (
            <p className="col-span-full text-muted-foreground">No hay comandas en cocina.</p>
          )}
          {pedidos.map((p) => {
            const titulo = p.restaurant_table?.nombre ?? (p.numero_pedido ? `A-${p.numero_pedido}` : "Pedido");
            const sig = SIGUIENTE[p.estado_preparacion];
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
                  {p.order_line.map((l, i) => (
                    <li key={i}><b>{l.cantidad}×</b> {l.nombre}</li>
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
