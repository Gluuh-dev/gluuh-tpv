import {
  CookingPot, Users, UtensilsCrossed, FileSearch, Settings2, ReceiptText, Banknote,
  ArchiveRestore, CircleDollarSign, CalendarDays, Tag, ContactRound, PackagePlus, LogOut,
  FileText, Gift, Tags, SlidersHorizontal, Percent, Scale, CreditCard, Mail, PackageOpen,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "../../../ui";

type Tono = "normal" | "caja" | "alerta";
interface Util { label: string; Icono: LucideIcon; tono?: Tono; off?: boolean }

// Las 31 utilidades del TPV de Next. Las atenuadas (off) necesitan un módulo o
// integración aún no activa. Tonos: caja (verde $), alerta (naranja), normal.
const UTILES: Util[] = [
  { label: "Re. cocina", Icono: CookingPot },
  { label: "Grupo cocina", Icono: Users, off: true },
  { label: "Zonas de impresión", Icono: UtensilsCrossed, off: true },
  { label: "Buscador de artículos", Icono: FileSearch, off: true },
  { label: "Opciones CashKeeper", Icono: Settings2, off: true },

  { label: "Buscar documento", Icono: ReceiptText, off: true },
  { label: "Apunte de caja", Icono: Banknote, tono: "caja", off: true },
  { label: "Cerrar turno / día", Icono: ArchiveRestore, tono: "caja" },
  { label: "Resumen de caja", Icono: CircleDollarSign, tono: "caja" },
  { label: "Opciones CashLogy", Icono: Settings2, off: true },

  { label: "Agenda", Icono: CalendarDays },
  { label: "Selección de tarifa", Icono: Tag, off: true },
  { label: "Empleados", Icono: ContactRound },
  { label: "Control de presencia", Icono: ContactRound, off: true },
  { label: "Cobros pendientes", Icono: CircleDollarSign, tono: "caja" },

  { label: "Opciones SafePay", Icono: Settings2, off: true },
  { label: "Nuevo artículo", Icono: PackagePlus },
  { label: "Cambiar de usuario", Icono: LogOut, tono: "alerta" },
  { label: "Conversor de documentos", Icono: FileText, off: true },
  { label: "Canjeo de regalos", Icono: Gift, off: true },

  { label: "Opciones Bip", Icono: Settings2, off: true },
  { label: "Cambio de precio", Icono: Tags, tono: "alerta", off: true },
  { label: "Cambio de unidades", Icono: SlidersHorizontal, off: true },
  { label: "Desactivar imp. cocina", Icono: CookingPot, tono: "alerta", off: true },
  { label: "Descuento de línea", Icono: Percent, tono: "alerta" },

  { label: "Opciones balanza", Icono: Scale, off: true },
  { label: "Selec. forma de pago", Icono: CreditCard, off: true },
  { label: "Abrir cajón", Icono: Banknote, tono: "caja", off: true },
  { label: "Enviar por email", Icono: Mail, off: true },
  { label: "Invitación", Icono: Gift, tono: "alerta" },

  { label: "Ajustes del terminal", Icono: Settings2 },
];

function icoColor(t?: Tono): string {
  if (t === "caja") return "text-success";
  if (t === "alerta") return "text-warning";
  return "text-brand";
}

export function UtilidadesModal({ onCerrar, onFuncion }: Readonly<{ onCerrar: () => void; onFuncion: (f: string) => void }>) {
  const pulsar = (u: Util) => {
    if (u.label === "Invitación") { onFuncion("invitar"); return; }
    if (u.label === "Descuento de línea") { onCerrar(); return; }
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar} ancho="3xl" className="overflow-hidden p-0">
      <header className="flex items-center gap-3 bg-brand px-5 py-3.5 text-white">
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-7 w-auto" draggable={false} />
        <div><h2 className="font-display text-lg font-extrabold leading-none">Utilidades</h2><p className="text-[11px] opacity-80">Terminal</p></div>
      </header>

      <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-5">
        {UTILES.map((u) => (
          <button key={u.label} type="button" onClick={() => pulsar(u)} disabled={u.off}
            className={`flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-lg border px-1.5 text-center text-[11.5px] font-semibold leading-tight transition-transform active:scale-95 ${u.off ? "cursor-not-allowed border-border/60 bg-surface/40 text-muted-foreground opacity-50" : "border-border bg-surface text-foreground"}`}>
            <u.Icono size={21} className={u.off ? "" : icoColor(u.tono)} />
            {u.label}
          </button>
        ))}
      </div>

      <footer className="flex items-center gap-3 border-t border-border bg-surface-2 px-4 py-2.5">
        <p className="hidden text-xs text-muted-foreground sm:block">Las opciones atenuadas necesitan un módulo o una integración que aún no está activa.</p>
        <button type="button" onClick={onCerrar} className="ml-auto flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground transition-transform active:scale-95"><PackageOpen size={16} /> Módulos</button>
        <button type="button" onClick={onCerrar} className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground transition-transform active:scale-95"><ReceiptText size={16} /> Último ticket</button>
        <button type="button" onClick={onCerrar} className="rounded-md bg-success px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95">Volver al TPV</button>
      </footer>
    </Modal>
  );
}
