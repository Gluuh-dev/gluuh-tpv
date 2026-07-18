import { Monitor, MapPin, Wifi, CircleDot } from "lucide-react";

function Sep() { return <span className="h-3.5 w-px bg-border" />; }

// Pie de la operativa: operario, terminal, contexto, caja, modo zurdo, conexión.
export function BarraEstado({
  operario, terminal, contexto, zurdo, onZurdo,
}: Readonly<{ operario: string; terminal: string; contexto: string; zurdo: boolean; onZurdo: (v: boolean) => void }>) {
  return (
    <footer className="flex flex-none items-center gap-3 border-t border-border bg-[#12141b] px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{operario.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
        {operario}
      </span>
      <Sep />
      <span className="flex items-center gap-1.5"><Monitor size={13} /> {terminal}</span>
      <Sep />
      <span className="flex items-center gap-1.5"><MapPin size={13} /> {contexto || "Sin cuenta"}</span>
      <Sep />
      <span className="flex items-center gap-1.5 text-success"><CircleDot size={13} /> Caja abierta</span>

      <label className="ml-auto flex cursor-pointer items-center gap-2 select-none">
        <input type="checkbox" checked={zurdo} onChange={(e) => onZurdo(e.target.checked)} className="accent-[color:var(--brand)]" />
        Modo zurdo
      </label>
      <Sep />
      <span className="flex items-center gap-1.5 text-success"><Wifi size={13} /> En línea</span>
    </footer>
  );
}
