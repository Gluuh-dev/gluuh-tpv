import { useRef } from "react";
import { ReceiptText, Armchair, Sun, ShoppingBag, CalendarCheck, Settings, type LucideIcon } from "lucide-react";
import { SALAS_DEMO } from "./datos";
import { Flechas } from "../../ui";

// Rail derecho persistente: Ticket · Aparcado · [salas del restaurante] · Para
// llevar · Reservas · ⚙. Salas dinámicas (config del local). `vista` = clave fija
// o id de sala. Activo = pastilla morada redondeada (con margen); badge sobre el icono.
function icoSala(id: string): LucideIcon {
  return id === "terraza" ? Sun : Armchair;
}

function Tab({ Icono, label, activo, badge, onClick }: Readonly<{ Icono: LucideIcon; label: string; activo?: boolean; badge?: number; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className={`mx-1.5 flex flex-col items-center gap-0.5 rounded-xl py-4 text-[.66rem] font-semibold transition-colors ${activo ? "bg-accent-soft text-brand" : "text-muted-foreground"}`}>
      <span className="relative">
        <Icono size={20} />
        {badge != null && badge > 0 && (
          <span className="absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-cobro px-1 text-[9px] font-bold text-white">{badge}</span>
        )}
      </span>
      {label}
    </button>
  );
}

export function RailSalas({
  vista, onVista, onConfig,
}: Readonly<{ vista: string; onVista: (v: string) => void; onConfig: () => void }>) {
  const carril = useRef<HTMLDivElement>(null);
  return (
    <aside className="flex w-[84px] flex-none flex-col border-l border-border bg-surface">
      <div ref={carril} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1.5">
      <Tab Icono={ReceiptText} label="Ticket" activo={vista === "ticket"} onClick={() => onVista("ticket")} />
      <Tab Icono={Armchair} label="Aparcado" badge={13} activo={vista === "aparcado"} onClick={() => onVista("aparcado")} />
      {SALAS_DEMO.map((s) => {
        const ocup = s.mesas.filter((m) => m.estado !== "LIBRE").length;
        return <Tab key={s.id} Icono={icoSala(s.id)} label={s.nombre} badge={ocup} activo={vista === s.id} onClick={() => onVista(s.id)} />;
      })}
      <Tab Icono={ShoppingBag} label="Para llevar" activo={vista === "llevar"} onClick={() => onVista("llevar")} />
      <Tab Icono={CalendarCheck} label="Reservas" activo={vista === "reservas"} onClick={() => onVista("reservas")} />
      <button type="button" onClick={onConfig} aria-label="Configuración" className="mx-1.5 mt-auto grid place-items-center rounded-xl border-t border-border py-3 text-muted-foreground transition-transform active:scale-95">
        <Settings size={20} />
      </button>
      </div>
      <Flechas contenedor={carril} className="justify-center border-t border-border py-1" />
    </aside>
  );
}
