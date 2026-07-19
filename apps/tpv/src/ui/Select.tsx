import { useEffect, useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

// SELECT propio de la operativa: desplegable con el estilo del TPV (no el nativo,
// que se ve feo y no sigue el tema). Táctil, sin hover (solo animación al pulsar),
// se cierra al tocar fuera. Las opciones pueden ir deshabilitadas.
export interface OpcionSelect { value: string; label: string; disabled?: boolean }

export function Select({
  value, onChange, opciones, Icono, className,
}: Readonly<{ value: string; onChange: (v: string) => void; opciones: OpcionSelect[]; Icono?: LucideIcon; className?: string }>) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = opciones.find((o) => o.value === value);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button type="button" onClick={() => setAbierto((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border bg-card pl-3 pr-2 text-left text-[13.5px] font-semibold outline-none transition-transform active:scale-[.99] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40">
        {Icono && <Icono size={14} className="flex-none text-muted-foreground" />}
        <span className="flex-1 truncate">{sel?.label ?? "—"}</span>
        <ChevronDown size={16} className={`flex-none text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="gl-aparecer absolute left-0 top-[calc(100%+4px)] z-30 w-full overflow-hidden rounded-md border border-border bg-panel shadow-xl">
          {opciones.map((o) => (
            <button key={o.value} type="button" disabled={o.disabled}
              onClick={() => { onChange(o.value); setAbierto(false); }}
              className={`flex w-full items-center px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors active:bg-accent-soft disabled:opacity-40 ${o.value === value ? "bg-accent-soft text-brand" : "text-foreground"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
