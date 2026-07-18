import { Tag } from "lucide-react";
import { useVenta } from "../store";

// Cabecera del ticket: título ("Ticket" / mesa) + comensales + alias editable.
// El trío Mesa · Comensales · Gr. cocina vive ahora en el navbar (HeaderVenta).
export function CabeceraCuenta() {
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const alias = useVenta((s) => s.alias);
  const setAlias = useVenta((s) => s.setAlias);

  return (
    <div className="flex flex-none items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <span className="text-[1.05rem] font-bold text-foreground">{contexto || "Ticket"}</span>
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{comensales} pax</span>
      <label className={`ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${alias ? "border-[#0e8fa2] bg-accent-soft text-brand" : "border-border bg-surface-2 text-muted-foreground"}`}>
        <Tag size={13} />
        <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias" className="w-20 bg-transparent outline-none placeholder:text-muted-foreground/60" />
      </label>
    </div>
  );
}
