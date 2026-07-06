"use client";

// Rail de salas (barra derecha, layout fijo estilo Glop): botones de zona
// (Ticket · Barra · salas · Para llevar · Reservas) con su icono lucide, la activa
// en cian y un badge de contador; abajo, candado (bloquear) y engranaje (config)
// con sus divisores. Presentacional puro: la lista de zonas (con sus contadores y
// onClick) se construye en page.tsx y se pasa por `tabs`. Extraído de app/tpv/page.tsx.
import { Settings, type LucideIcon } from "lucide-react";

export interface RailTab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  onClick(): void;
}

export interface RailSalasProps {
  tabs: RailTab[];
  /** Id de la zona activa (se resalta en cian). */
  activo: string;
  /** Deshabilita las zonas mientras hay una operación en curso. */
  busy: boolean;
  onConfig: () => void;
}

export function RailSalas({ tabs, activo, busy, onConfig }: RailSalasProps) {
  return (
    <aside className="flex w-[140px] flex-none flex-col overflow-y-auto border-l border-border bg-surface">
      {tabs.map((t) => {
        const Icono = t.icon;
        const act = activo === t.id;
        return (
          <button type="button" key={t.id} onClick={t.onClick} disabled={busy}
            className={`relative flex flex-none flex-col items-center justify-center gap-1 px-2 py-3 text-[.68rem] font-semibold leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${
              act ? "bg-accent-soft text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Icono size={22} strokeWidth={1.75} />
            <span className="w-full truncate text-center">{t.label}</span>
            {t.badge ? <span className="absolute right-1 top-1 grid h-5 min-w-5 flex-none place-items-center rounded-full bg-[#c46a2a] px-1 text-[10px] font-bold text-white">{t.badge}</span> : null}
          </button>
        );
      })}
      <button type="button" onClick={onConfig} title="Ajustes / Utilidades"
        className="mt-auto flex flex-none items-center justify-center border-t border-border py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Settings size={22} strokeWidth={1.5} />
      </button>
    </aside>
  );
}
