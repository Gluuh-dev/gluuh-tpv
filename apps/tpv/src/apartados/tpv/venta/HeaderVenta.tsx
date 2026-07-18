import { Search, Minus, Plus, ArrowLeft } from "lucide-react";
import { useVenta } from "../store";

// Cabecera morada de la venta: volver al plano · logo · contexto · comensales ·
// buscador de productos · operario. Barra siempre morada (marca) en ambos temas.
export function HeaderVenta({ onVolverPlano }: Readonly<{ onVolverPlano: () => void }>) {
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const setComensales = useVenta((s) => s.setComensales);
  const busqueda = useVenta((s) => s.busqueda);
  const setBusqueda = useVenta((s) => s.setBusqueda);

  return (
    <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-white">
      <button type="button" onClick={onVolverPlano} aria-label="Volver al plano" className="grid h-9 w-9 place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><ArrowLeft size={18} /></button>
      <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" draggable={false} />

      <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold">{contexto || "Ticket"}</span>

      <span className="flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-1 text-sm font-semibold">
        <button type="button" onClick={() => setComensales(comensales - 1)} aria-label="Menos comensales" className="grid h-6 w-6 place-items-center rounded transition-transform active:scale-90"><Minus size={14} /></button>
        <span className="min-w-8 text-center tabular-nums">{comensales} <span className="text-[11px] opacity-70">pax</span></span>
        <button type="button" onClick={() => setComensales(comensales + 1)} aria-label="Más comensales" className="grid h-6 w-6 place-items-center rounded transition-transform active:scale-90"><Plus size={14} /></button>
      </span>

      <label className="relative flex flex-1 items-center">
        <Search size={16} className="absolute left-3 opacity-80" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto…"
          className="h-9 w-full rounded-md bg-white/15 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/60" />
      </label>
    </header>
  );
}
