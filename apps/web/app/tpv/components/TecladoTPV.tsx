"use client";

// Teclado numérico bajo el ticket (estilo Glop): dígitos 1-9/0/,/C/←, teclas de
// MODO (Und./Precio/DTO%/DTO€) y el botón Cobrar naranja a toda la altura.
// El teclado numérico está DESHABILITADO hasta que se pulsa un modo (`editando`):
// entonces se habilita y el botón de ese modo se pinta en verde.
// (Utilidades · Abrir cajón · Imprimir viven ahora en el rail.)
// Desde el plan 011 lee modo/editando DIRECTAMENTE de useTpvStore (no por props)
// y va memoizado: teclear no re-renderiza la página. La lógica (handleKey, cobro)
// sigue en page.tsx; aquí solo se emiten callbacks.
import { memo } from "react";
import { useTpvStore } from "../hooks/useTpvStore";

export interface TecladoTPVProps {
  /** Dígitos, coma, C (CLR) y ← (borrar): rutan a handleKey en page.tsx. */
  onKey: (k: string) => void;
  /** Teclas de modo (Und./Precio/DTO%/DTO€): rutan a handleKey en page.tsx. */
  onModo: (m: "UND" | "PREC" | "DTO%" | "DTO€") => void;
  onCobrar: () => void;
  /** Cobrar deshabilitado: `!unidades || busy || !puede("cobrar")`. */
  cobrarDisabled: boolean;
}

const OFF = "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

export const TecladoTPV = memo(function TecladoTPV({ onKey, onModo, onCobrar, cobrarDisabled }: TecladoTPVProps) {
  const modo = useTpvStore((s) => s.modo);
  const editando = useTpvStore((s) => s.editando);
  // Verde solo cuando hay edición activa Y es el modo pulsado; si no, tecla neutra (bg elev #232a34).
  const modoCls = (m: "UND" | "PREC" | "DTO%" | "DTO€") =>
    editando && modo === m
      ? "border border-brand bg-brand font-semibold text-brand-foreground shadow-sm"
      : "border border-border bg-surface-overlay font-semibold text-foreground hover:bg-accent";
  return (
    <div className="p-2">
      <div className="flex gap-[.55rem]">
        {/* Números (fondo elev #232a34): deshabilitados hasta que un modo esté activo */}
        <div className="grid flex-1 grid-cols-3 gap-[.55rem]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0"].map((n) => (
            <button type="button" key={n} onClick={() => onKey(n)} disabled={!editando} className={`flex min-h-[62px] select-none items-center justify-center rounded-[10px] border border-border bg-surface-overlay text-[1.55rem] font-semibold transition hover:bg-accent active:scale-95 ${OFF} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>{n}</button>
          ))}
          <button type="button" onClick={() => onKey("CLR")} disabled={!editando} className={`flex min-h-[62px] select-none items-center justify-center rounded-[10px] border border-border bg-surface-overlay text-[1.55rem] font-semibold text-muted-foreground transition hover:bg-accent active:scale-95 ${OFF}`}>C</button>
        </div>
        {/* Funciones en UNA columna: Und · Precio · DTO% · DTO€ (siempre activas para
            armar el teclado) y la ← debajo. Se reparten (flex-1) el alto. */}
        <div className="flex w-[4.5rem] flex-none flex-col gap-[.55rem]">
          <button type="button" onClick={() => onModo("UND")} className={`grid min-h-[44px] w-full flex-1 place-items-center rounded-[10px] text-xs transition active:scale-95 ${modoCls("UND")}`}>Und.</button>
          <button type="button" onClick={() => onModo("PREC")} className={`grid min-h-[44px] w-full flex-1 place-items-center rounded-[10px] text-xs transition active:scale-95 ${modoCls("PREC")}`}>Precio</button>
          <button type="button" onClick={() => onModo("DTO%")} className={`grid min-h-[44px] w-full flex-1 place-items-center rounded-[10px] text-xs transition active:scale-95 ${modoCls("DTO%")}`}>DTO%</button>
          <button type="button" onClick={() => onModo("DTO€")} className={`grid min-h-[44px] w-full flex-1 place-items-center rounded-[10px] text-xs transition active:scale-95 ${modoCls("DTO€")}`}>DTO€</button>
          <button type="button" onClick={() => onKey("<")} disabled={!editando} className={`grid min-h-[44px] w-full flex-1 place-items-center rounded-[10px] border border-border bg-surface-overlay text-xl font-semibold transition hover:bg-accent active:scale-95 ${OFF}`}>←</button>
        </div>
        {/* Cobrar: acción de dinero, único acento naranja; se estira a la altura del teclado */}
        <button type="button" onClick={onCobrar} disabled={cobrarDisabled}
          className="flex w-24 select-none flex-col items-center justify-center gap-1 rounded-[10px] border border-[#d47c34] bg-[#c46a2a] text-xl font-bold text-white shadow-sm transition hover:bg-[#d47c34] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d47c34]">
          Cobrar
        </button>
      </div>
    </div>
  );
});
