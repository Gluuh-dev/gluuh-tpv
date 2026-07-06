"use client";

// Cabecera de la cuenta (calcada del mockup HTML del cliente): una fila
// `título · [pax] · [cliente] · … · [Alias]` (el alias es una píldora a la
// derecha, editable in-situ) y debajo el trío de celdas (Mesa · Comensales
// con −/+ · Gr. Cocina en dorado). Presentacional puro: valores por props,
// cambios por callbacks; el estado vive en page.tsx.
import { Tag } from "lucide-react";

export interface CabeceraCuentaProps {
  /** Título del contexto: nombre de mesa, "Para llevar · X" o "Ticket". */
  titulo: string;
  /** Alias libre de la cuenta. */
  alias: string;
  onAlias: (v: string) => void;
  /** Nombre del cliente asignado (o null). */
  cliente: string | null;
  tipoOperacion: "VENTA" | "INVITACION" | "AUTOCONSUMO";
  /** Nota de la mesa (chip 📝) si la hay. */
  notaMesa: string;
  /** Nombre de la mesa (o null si no hay mesa). */
  mesaNombre: string | null;
  /** Cuenta "para llevar" (sin mesa). */
  esLlevar: boolean;
  comensales: number;
  onComensalesMenos: () => void;
  onComensalesMas: () => void;
  /** Grupo de cocina (partida) al que va el pedido. */
  grCocina: string;
}

export function CabeceraCuenta({
  titulo,
  alias,
  onAlias,
  cliente,
  tipoOperacion,
  notaMesa,
  mesaNombre,
  esLlevar,
  comensales,
  onComensalesMenos,
  onComensalesMas,
  grCocina,
}: CabeceraCuentaProps) {
  return (
    <div className="flex-none bg-surface">
      {/* acc-head: título + chips + alias (píldora a la derecha) — una sola fila */}
      <div className="flex items-center gap-2 px-[.7rem] pb-[.45rem] pt-[.65rem]">
        <h2 className="flex-none text-[1.05rem] font-bold leading-none">{titulo}</h2>
        {comensales > 0 && <span className="flex-none rounded-full bg-accent-soft px-2 py-0.5 text-[.66rem] font-bold text-brand">{comensales} pax</span>}
        {cliente && <span className="flex-none truncate rounded-full bg-accent-soft px-2 py-0.5 text-[.66rem] font-medium text-brand">{cliente}</span>}
        {tipoOperacion === "INVITACION" && <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-[.66rem] font-semibold text-amber-500">Invitación</span>}
        {tipoOperacion === "AUTOCONSUMO" && <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-[.66rem] font-semibold text-amber-500">Consumo propio</span>}
        {notaMesa.trim() && <span className="min-w-0 truncate rounded-full bg-amber-500/15 px-2 py-0.5 text-[.66rem] font-medium text-amber-500">📝 {notaMesa}</span>}
        <span className="flex-1" />
        {/* Alias: píldora (.alias-btn) — input editable in-situ; teal cuando tiene valor */}
        <label className={`flex max-w-[170px] flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[.72rem] transition-colors ${
          alias ? "border-[#0e8fa2] bg-accent-soft text-brand" : "border-border bg-surface-2 text-muted-foreground focus-within:border-[#0e8fa2] focus-within:text-foreground"
        }`}>
          <Tag size={13} className="flex-none" />
          <input value={alias} onChange={(e) => onAlias(e.target.value)} placeholder="Alias"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      {/* trio: mesa · comensales · gr. cocina (fondo panel-2, cocina en dorado) */}
      <div className="grid grid-cols-[1fr_1.15fr_1fr] gap-[.45rem] px-[.7rem] pb-[.35rem] pt-[.15rem]">
        <div className="rounded-md border border-border bg-surface-2 px-[.3rem] py-[.42rem] text-center">
          <div className="text-[.58rem] uppercase tracking-[0.08em] text-muted-foreground">Mesa</div>
          <div className="mt-0.5 truncate text-base font-bold leading-tight">{mesaNombre ? mesaNombre.replace("Mesa ", "") : esLlevar ? "Llevar" : "—"}</div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 px-[.3rem] py-[.42rem] text-center">
          <div className="text-[.58rem] uppercase tracking-[0.08em] text-muted-foreground">Comensales</div>
          {/* Stepper compacto: − · número · + (gap .5rem, dentro de la celda) */}
          <div className="mt-0.5 flex items-center justify-center gap-2">
            <button type="button" aria-label="Menos comensales" onClick={onComensalesMenos} className="grid h-6 w-6 flex-none place-items-center rounded border border-border text-lg leading-none transition-colors hover:bg-accent active:scale-95">−</button>
            <span className="min-w-[1.2rem] text-base font-bold tabular-nums">{comensales}</span>
            <button type="button" aria-label="Más comensales" onClick={onComensalesMas} className="grid h-6 w-6 flex-none place-items-center rounded border border-border text-lg leading-none transition-colors hover:bg-accent active:scale-95">+</button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface-2 px-[.3rem] py-[.42rem] text-center">
          <div className="text-[.58rem] uppercase tracking-[0.08em] text-muted-foreground">Gr. Cocina</div>
          <div className="mt-0.5 truncate text-[.78rem] font-bold uppercase leading-tight text-warning">{grCocina}</div>
        </div>
      </div>
    </div>
  );
}
