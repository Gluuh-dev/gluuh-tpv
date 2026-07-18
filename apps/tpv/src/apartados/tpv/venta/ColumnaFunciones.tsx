import {
  UserRound, Bookmark, ArrowRightLeft, Coffee, Split, Trash2, Send, ChefHat,
  ReceiptText, Banknote, LayoutGrid, Printer, Lock, type LucideIcon,
} from "lucide-react";

// Rail vertical de funciones de la cuenta (izquierda), como en el TPV de Next.
// Las que aún no tienen su modal quedan visibles pero inertes; se cablean por
// fases (Cliente, Dividir, Pasar mesa… abren sus modales al portarlos).
function Boton({ Icono, label, tono = "accion", onClick, disabled }: Readonly<{ Icono: LucideIcon; label: string; tono?: "accion" | "util"; onClick?: () => void; disabled?: boolean }>) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[7px] border text-[.62rem] font-semibold leading-tight transition-transform active:scale-95 disabled:opacity-40 ${tono === "util" ? "border-border bg-muted text-muted-foreground" : "border-border bg-surface-2 text-muted-foreground"}`}>
      <Icono size={19} /> <span className="px-0.5 text-center">{label}</span>
    </button>
  );
}

export function ColumnaFunciones({ onVaciar }: Readonly<{ onVaciar: () => void }>) {
  return (
    <div className="no-scrollbar flex w-[88px] flex-none flex-col gap-[.28rem] overflow-y-auto bg-surface px-[.3rem] py-[.4rem]">
      <Boton Icono={UserRound} label="Cliente" disabled />
      <Boton Icono={Bookmark} label="Aparcar" disabled />
      <Boton Icono={ArrowRightLeft} label="Pasar mesa" disabled />
      <Boton Icono={Coffee} label="Cons. propio" disabled />
      <Boton Icono={Split} label="Dividir" disabled />
      <Boton Icono={Trash2} label="Borrar" onClick={onVaciar} />
      <Boton Icono={Send} label="Preparar" disabled />
      <Boton Icono={ChefHat} label="Marchar" disabled />
      {/* Utilidades ancladas al fondo */}
      <div className="mt-auto flex flex-col gap-[.28rem]">
        <Boton Icono={Banknote} label="Cajón" tono="util" disabled />
        <Boton Icono={LayoutGrid} label="Utilidades" tono="util" disabled />
        <Boton Icono={Printer} label="Imprimir" tono="util" disabled />
        <Boton Icono={Lock} label="Bloquear" tono="util" disabled />
      </div>
    </div>
  );
}
