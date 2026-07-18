import { Tag, Minus, Plus } from "lucide-react";
import { useVenta } from "../store";

function Celda({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-2 py-1">
      <p className="text-[.58rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <div className="text-sm font-bold text-foreground">{children}</div>
    </div>
  );
}

// Cabecera de la cuenta: contexto (mesa/ticket) + alias editable, y el trío
// Mesa · Comensales (stepper) · Gr. cocina, como en el TPV de Next.
export function CabeceraCuenta() {
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const alias = useVenta((s) => s.alias);
  const setComensales = useVenta((s) => s.setComensales);
  const setAlias = useVenta((s) => s.setAlias);

  return (
    <div className="flex-none border-b border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[1.05rem] font-bold text-foreground">{contexto || "Ticket"}</span>
        <label className={`ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${alias ? "border-[#0e8fa2] bg-accent-soft text-brand" : "border-border bg-surface-2 text-muted-foreground"}`}>
          <Tag size={13} />
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias" className="w-20 bg-transparent outline-none placeholder:text-muted-foreground/60" />
        </label>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1.15fr_1fr] gap-1">
        <Celda label="Mesa">{contexto || "—"}</Celda>
        <Celda label="Comensales">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setComensales(comensales - 1)} aria-label="Menos" className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground transition-transform active:scale-90"><Minus size={13} /></button>
            <span className="min-w-4 text-center tabular-nums">{comensales}</span>
            <button type="button" onClick={() => setComensales(comensales + 1)} aria-label="Más" className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground transition-transform active:scale-90"><Plus size={13} /></button>
          </div>
        </Celda>
        <Celda label="Gr. cocina"><span className="text-warning">GENERAL</span></Celda>
      </div>
    </div>
  );
}
