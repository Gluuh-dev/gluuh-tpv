import { ReceiptText, Armchair, Sun, ShoppingBag, CalendarCheck, Settings, type LucideIcon } from "lucide-react";
import { SALAS_DEMO } from "./datos";

// Rail derecho persistente (como en el TPV de Next): Ticket · Aparcado · [salas del
// restaurante] · Para llevar · Reservas · ⚙. Las SALAS son dinámicas (config del
// local): si el dueño crea una, aparece aquí. `vista` = clave fija o id de sala.
function icoSala(id: string): LucideIcon {
  if (id === "terraza") return Sun;
  return Armchair;
}

function Tab({ Icono, label, activo, badge, onClick }: Readonly<{ Icono: LucideIcon; label: string; activo?: boolean; badge?: number; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex flex-col items-center gap-1 py-3 text-[.68rem] font-semibold transition-transform active:scale-95 ${activo ? "bg-accent-soft text-brand" : "text-muted-foreground"}`}>
      {badge != null && badge > 0 && (
        <span className="absolute right-3 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-cobro px-1 text-[9px] font-bold text-white">{badge}</span>
      )}
      <Icono size={22} />
      {label}
    </button>
  );
}

export function RailSalas({
  vista, onVista, onConfig,
}: Readonly<{ vista: string; onVista: (v: string) => void; onConfig: () => void }>) {
  return (
    <aside className="flex w-[140px] flex-none flex-col overflow-y-auto border-l border-border bg-surface">
      <Tab Icono={ReceiptText} label="Ticket" activo={vista === "ticket"} onClick={() => onVista("ticket")} />
      <Tab Icono={Armchair} label="Aparcado" badge={13} activo={vista === "aparcado"} onClick={() => onVista("aparcado")} />
      {SALAS_DEMO.map((s) => {
        const ocup = s.mesas.filter((m) => m.estado !== "LIBRE").length;
        return <Tab key={s.id} Icono={icoSala(s.id)} label={s.nombre} badge={ocup} activo={vista === s.id} onClick={() => onVista(s.id)} />;
      })}
      <Tab Icono={ShoppingBag} label="Para llevar" activo={vista === "llevar"} onClick={() => onVista("llevar")} />
      <Tab Icono={CalendarCheck} label="Reservas" activo={vista === "reservas"} onClick={() => onVista("reservas")} />
      <button type="button" onClick={onConfig} aria-label="Configuración" className="mt-auto grid place-items-center border-t border-border py-3 text-muted-foreground transition-transform active:scale-95">
        <Settings size={20} />
      </button>
    </aside>
  );
}
