import { useRef } from "react";
import { Flechas } from "../../../ui";
import {
  UserRound, Bookmark, ArrowRightLeft, Coffee, Split, Trash2, Send, ChefHat,
  Banknote, LayoutGrid, Printer, Lock, type LucideIcon,
} from "lucide-react";

// Rail vertical de funciones de la cuenta (izquierda), como en el TPV de Next.
// Cada botón dispara onFuncion(clave); el shell abre el modal correspondiente.
function Boton({ Icono, label, tono = "accion", onClick }: Readonly<{ Icono: LucideIcon; label: string; tono?: "accion" | "util"; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className={`flex h-14 w-full flex-col items-center justify-center gap-1 rounded-[7px] border text-[.62rem] font-semibold leading-tight transition-transform active:scale-95 ${tono === "util" ? "border-border bg-surface-overlay text-muted-foreground" : "border-border bg-surface-2 text-foreground"}`}>
      <Icono size={19} /> <span className="px-0.5 text-center">{label}</span>
    </button>
  );
}

export function ColumnaFunciones({ onVaciar, onFuncion }: Readonly<{ onVaciar: () => void; onFuncion: (f: string) => void }>) {
  const carril = useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex w-[88px] flex-none flex-col bg-surface">
      <div ref={carril} className="flex min-h-0 flex-1 flex-col gap-[.28rem] overflow-y-auto px-[.3rem] py-[.4rem]">
      <Boton Icono={UserRound} label="Cliente" onClick={() => onFuncion("cliente")} />
      <Boton Icono={Bookmark} label="Aparcar" onClick={() => onFuncion("aparcar")} />
      <Boton Icono={ArrowRightLeft} label="Pasar mesa" onClick={() => onFuncion("pasar")} />
      <Boton Icono={Coffee} label="Cons. propio" onClick={() => onFuncion("consumo")} />
      <Boton Icono={Split} label="Dividir" onClick={() => onFuncion("dividir")} />
      <Boton Icono={Trash2} label="Borrar" onClick={onVaciar} />
      <Boton Icono={Send} label="Preparar" onClick={() => onFuncion("preparar")} />
      <Boton Icono={ChefHat} label="Marchar" onClick={() => onFuncion("marchar")} />
      <div className="mt-auto flex flex-col gap-[.28rem]">
        <Boton Icono={Banknote} label="Cajón" tono="util" onClick={() => onFuncion("cajon")} />
        <Boton Icono={LayoutGrid} label="Utilidades" tono="util" onClick={() => onFuncion("utilidades")} />
        <Boton Icono={Printer} label="Imprimir" tono="util" onClick={() => onFuncion("imprimir")} />
        <Boton Icono={Lock} label="Bloquear" tono="util" onClick={() => onFuncion("bloquear")} />
      </div>
      </div>
      <Flechas contenedor={carril} className="justify-center border-t border-border py-1" />
    </div>
  );
}
