"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";

interface Venta {
  id: string;
  total: number;
  canal: string;
  estado: string;
  created_at: string;
  restaurant_table: { nombre: string } | null;
}

const eur = (n: number) => Number(n).toFixed(2) + " €";

export default function Informes() {
  const sb = supabaseBrowser();
  const [ventas, setVentas] = useState<Venta[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("id,total,canal,estado,created_at,restaurant_table(nombre)")
        .eq("tipo_operacion", "VENTA")
        .order("created_at", { ascending: false })
        .limit(100);
      setVentas((data as unknown as Venta[]) ?? []);
    })();
    /* eslint-disable-next-line */
  }, []);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const deHoy = ventas.filter((v) => new Date(v.created_at) >= hoy);
  const totalHoy = deHoy.reduce((s, v) => s + Number(v.total), 0);
  const totalTodo = ventas.reduce((s, v) => s + Number(v.total), 0);
  const ticketMedio = ventas.length ? totalTodo / ventas.length : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Informes</h1>
        <p className="text-slate-500">Resumen de ventas (en tiempo real desde tu base de datos).</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card"><div className="text-sm text-slate-500">Pedidos hoy</div><div className="text-2xl font-semibold">{deHoy.length}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Ventas hoy</div><div className="text-2xl font-semibold">{eur(totalHoy)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Pedidos (100 últ.)</div><div className="text-2xl font-semibold">{ventas.length}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Ticket medio</div><div className="text-2xl font-semibold">{eur(ticketMedio)}</div></div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr><th className="px-4 py-3 font-medium">Fecha</th><th className="px-4 py-3 font-medium">Origen</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 text-right font-medium">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ventas.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay ventas registradas.</td></tr>}
            {ventas.slice(0, 30).map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2.5">{new Date(v.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-2.5">{v.restaurant_table?.nombre ?? v.canal}</td>
                <td className="px-4 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{v.estado}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{eur(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
