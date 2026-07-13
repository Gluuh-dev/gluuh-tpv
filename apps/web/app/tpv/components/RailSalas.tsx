"use client";

// Rail de salas (barra derecha, layout fijo estilo Glop): botones de zona
// (Ticket · Barra · salas · Para llevar · Reservas) con su icono lucide, la activa
// en cian y un badge de contador; abajo, candado (bloquear) y engranaje (config)
// con sus divisores. Presentacional puro: la lista de zonas (con sus contadores y
// onClick) se construye en page.tsx y se pasa por `tabs`. Extraído de app/tpv/page.tsx.
// Memoizado (plan 011): con `tabs` estable (useMemo en el padre), teclear o tocar
// líneas no re-renderiza el rail.
import { memo } from "react";
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

export const RailSalas = memo(function RailSalas({ tabs, activo, busy, onConfig }: RailSalasProps) {
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
            <div className="relative">
              <Icono size={22} strokeWidth={1.75} />
              {t.badge ? (
                <span className="absolute -right-2.5 -top-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#c46a2a] px-1 text-[9px] font-extrabold text-white border border-card shadow-sm">
                  {t.badge}
                </span>
              ) : null}
            </div>
            <span className="w-full truncate text-center">{t.label}</span>
          </button>
        );
      })}
      <button type="button" onClick={onConfig} title="Ajustes / Utilidades"
        className="mt-auto flex flex-none items-center justify-center border-t border-border py-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Settings size={22} strokeWidth={1.5} />
      </button>
    </aside>
  );
});
