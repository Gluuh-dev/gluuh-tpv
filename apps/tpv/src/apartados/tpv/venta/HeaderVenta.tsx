import { Search, Minus, Plus, ArrowLeft, Tag } from "lucide-react";
import { useVenta } from "../store";

// Chip compacto de una sola línea (estilo del PAX): etiqueta pequeña + valor.
function Chip({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-semibold">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">{label}</span>
      {children}
    </span>
  );
}

// Cabecera morada de la venta: volver al plano · logo · MESA · COMENSALES (±) ·
// GR. COCINA · buscador. Chips compactos (una línea). Siempre morada.
export function HeaderVenta({ onVolverPlano }: Readonly<{ onVolverPlano: () => void }>) {
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const setComensales = useVenta((s) => s.setComensales);
  const alias = useVenta((s) => s.alias);
  const setAlias = useVenta((s) => s.setAlias);
  const busqueda = useVenta((s) => s.busqueda);
  const setBusqueda = useVenta((s) => s.setBusqueda);

  return (
    <header className="flex h-14 flex-none items-center gap-2 bg-brand px-3 text-white">
      <button type="button" onClick={onVolverPlano} aria-label="Volver al plano" className="grid h-9 w-9 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><ArrowLeft size={18} /></button>
      <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto flex-none" draggable={false} />

      <Chip label="Mesa">{contexto || "—"}</Chip>

      <Chip label="Pax">
        <button type="button" onClick={() => setComensales(comensales - 1)} aria-label="Menos" className="grid h-5 w-5 place-items-center rounded bg-white/15 transition-transform active:scale-90"><Minus size={12} /></button>
        <span className="min-w-4 text-center tabular-nums">{comensales}</span>
        <button type="button" onClick={() => setComensales(comensales + 1)} aria-label="Más" className="grid h-5 w-5 place-items-center rounded bg-white/15 transition-transform active:scale-90"><Plus size={12} /></button>
      </Chip>

      <Chip label="Gr. cocina"><span className="text-[#ffd27a]">General</span></Chip>

      <label className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-semibold ${alias ? "bg-white/25" : "bg-white/10"}`}>
        <Tag size={13} className="opacity-80" />
        <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias" className="w-24 bg-transparent text-white outline-none placeholder:text-white/50" />
      </label>

      <label className="relative ml-1 flex flex-1 items-center">
        <Search size={16} className="absolute left-3 opacity-80" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto o código de barras…"
          className="h-9 w-full rounded-md bg-white/15 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/60" />
      </label>
    </header>
  );
}
