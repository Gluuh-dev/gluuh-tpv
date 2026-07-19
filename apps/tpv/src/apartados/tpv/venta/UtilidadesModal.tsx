import {
  LayoutGrid, ReceiptText, CircleDollarSign, ChefHat, CalendarDays, Tag, ContactRound,
  Percent, Gift, CreditCard, Mail, Banknote, Scale, FileSearch, Settings2, LogOut,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "../../../ui";

type Tono = "normal" | "caja" | "alerta";
interface Util { label: string; Icono: LucideIcon; tono?: Tono }

// Utilidades del terminal (rejilla), como en el TPV de Next. La mayoría abren su
// propio flujo al portarlas; de momento son navegables y honestas.
const UTILES: Util[] = [
  { label: "Buscar documento", Icono: FileSearch },
  { label: "Resumen de caja", Icono: CircleDollarSign, tono: "caja" },
  { label: "Cobros pendientes", Icono: CircleDollarSign, tono: "caja" },
  { label: "Apunte de caja", Icono: Banknote, tono: "caja" },
  { label: "Re. cocina", Icono: ChefHat },
  { label: "Agenda", Icono: CalendarDays },
  { label: "Selección de tarifa", Icono: Tag },
  { label: "Control de presencia", Icono: ContactRound },
  { label: "Cambio de precio", Icono: Tag, tono: "alerta" },
  { label: "Descuento", Icono: Percent, tono: "alerta" },
  { label: "Invitación", Icono: Gift, tono: "alerta" },
  { label: "Forma de pago", Icono: CreditCard },
  { label: "Enviar por email", Icono: Mail },
  { label: "Balanza", Icono: Scale },
  { label: "Abrir cajón", Icono: Banknote, tono: "caja" },
  { label: "Ajustes del terminal", Icono: Settings2 },
];

function tonoClase(t?: Tono): string {
  if (t === "caja") return "border-success/40 text-success";
  if (t === "alerta") return "border-warning/40 text-warning";
  return "border-border text-foreground";
}

export function UtilidadesModal({ onCerrar }: Readonly<{ onCerrar: () => void }>) {
  return (
    <Modal onCerrar={onCerrar} ancho="3xl" className="overflow-hidden p-0">
      <header className="flex items-center gap-3 bg-brand px-5 py-3.5 text-white">
        <LayoutGrid size={20} />
        <h2 className="font-display text-lg font-extrabold leading-none">Utilidades</h2>
      </header>

      <div className="grid grid-cols-3 gap-2.5 p-5 sm:grid-cols-4">
        {UTILES.map((u) => (
          <button key={u.label} type="button" onClick={onCerrar}
            className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border bg-surface p-2 text-center text-xs font-semibold transition-transform active:scale-95 ${tonoClase(u.tono)}`}>
            <u.Icono size={22} /> {u.label}
          </button>
        ))}
      </div>

      <footer className="flex items-center border-t border-border p-4">
        <p className="text-xs text-muted-foreground">Las opciones se van cableando por fases.</p>
        <button type="button" onClick={onCerrar} className="ml-auto flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95"><LogOut size={15} /> Volver al TPV</button>
      </footer>
    </Modal>
  );
}
