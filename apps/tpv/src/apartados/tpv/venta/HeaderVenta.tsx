import { Search, Minus, Plus, ArrowLeft } from "lucide-react";
import { useVenta } from "../store";

function Chip({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <span className="flex flex-col rounded-md bg-white/10 px-3 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-[.1em] text-white/60">{label}</span>
      <span className="text-sm font-bold leading-tight">{children}</span>
    </span>
  );
}

// Cabecera morada de la venta: volver al plano · logo · MESA · COMENSALES (±) ·
// GR. COCINA (el trío que antes estaba sobre el ticket) · buscador. Siempre morada.
export function HeaderVenta({ onVolverPlano }: Readonly<{ onVolverPlano: () => void }>) {
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const setComensales = useVenta((s) => s.setComensales);
  const busqueda = useVenta((s) => s.busqueda);
  const setBusqueda = useVenta((s) => s.setBusqueda);

  return (
    <header className="flex h-14 flex-none items-center gap-2.5 bg-brand px-3 text-white">
      <button type="button" onClick={onVolverPlano} aria-label="Volver al plano" className="grid h-9 w-9 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><ArrowLeft size={18} /></button>
      <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto flex-none" draggable={false} />

      <Chip label="Mesa">{contexto || "—"}</Chip>

      <span className="flex flex-col rounded-md bg-white/10 px-3 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-[.1em] text-white/60">Comensales</span>
        <span className="flex items-center gap-2 text-sm font-bold leading-tight">
          <button type="button" onClick={() => setComensales(comensales - 1)} aria-label="Menos" className="grid h-5 w-5 place-items-center rounded bg-white/15 transition-transform active:scale-90"><Minus size={12} /></button>
          <span className="min-w-4 text-center tabular-nums">{comensales}</span>
          <button type="button" onClick={() => setComensales(comensales + 1)} aria-label="Más" className="grid h-5 w-5 place-items-center rounded bg-white/15 transition-transform active:scale-90"><Plus size={12} /></button>
        </span>
      </span>

      <Chip label="Gr. cocina"><span className="text-[#ffd27a]">General</span></Chip>

      <label className="relative ml-1 flex flex-1 items-center">
        <Search size={16} className="absolute left-3 opacity-80" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto o código de barras…"
          className="h-9 w-full rounded-md bg-white/15 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/60" />
      </label>
    </header>
  );
}
