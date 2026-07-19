import { useRef } from "react";
import { Keyboard, type LucideIcon } from "lucide-react";
import { abrirTeclado } from "./TecladoEnPantalla";

// INPUT de texto de la operativa con botón de TECLADO en pantalla integrado.
// El botón enfoca el campo y abre el teclado flotante global (que escribe en lo
// enfocado). Reutilizable en notas, alias, búsquedas… Sin hover (solo animación).
export function CampoTexto({
  value, onChange, placeholder, Icono, maxLength, className,
}: Readonly<{ value: string; onChange: (v: string) => void; placeholder?: string; Icono?: LucideIcon; maxLength?: number; className?: string }>) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="relative min-w-0 flex-1">
        {Icono && <Icono size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        <input
          ref={ref} type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLength}
          aria-label={placeholder}
          className={`min-h-11 w-full rounded-md border border-border bg-background ${Icono ? "pl-9" : "pl-3"} pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20`}
        />
      </div>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { ref.current?.focus(); abrirTeclado(); }}
        aria-label="Teclado en pantalla"
        className="grid h-11 w-12 flex-none place-items-center rounded-md border border-border bg-card text-muted-foreground transition-transform active:scale-95">
        <Keyboard size={18} />
      </button>
    </div>
  );
}
