import { Ban, Combine, MessageSquarePlus, Gift, type LucideIcon } from "lucide-react";
import { useVenta } from "../store";
import { useSesionTpv } from "../sesion-contexto";

function Accion({ Icono, label, disabled, onClick }: Readonly<{ Icono: LucideIcon; label: string; disabled?: boolean; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[7px] border border-border bg-surface-2 text-[.62rem] font-semibold text-muted-foreground transition-transform active:scale-95 disabled:opacity-40">
      <Icono size={19} /> {label}
    </button>
  );
}

// Acciones sobre la línea seleccionada: anular (directa), componer menú y
// comentario/extra (modal de la línea), invitar (modal de invitaciones).
export function FilaAcciones({ onFuncion }: Readonly<{ onFuncion: (f: string) => void }>) {
  const lineaSel = useVenta((s) => s.lineaSel);
  const anular = useVenta((s) => s.anularLinea);
  const { hacer } = useSesionTpv();
  const hay = !!lineaSel;

  return (
    <div className="flex flex-none items-stretch gap-1 px-2 pb-1">
      {/* Anular e invitar salen dinero de la caja: si el operario no tiene el
          permiso, `hacer` pide el PIN de un responsable antes de ejecutarlas. */}
      <Accion Icono={Ban} label="Anular" disabled={!hay} onClick={() => lineaSel && hacer("borrar", () => anular(lineaSel))} />
      <Accion Icono={Combine} label="Comp. menú" disabled={!hay} onClick={() => onFuncion("menu")} />
      <Accion Icono={MessageSquarePlus} label="Com. y extra" disabled={!hay} onClick={() => onFuncion("extra")} />
      <Accion Icono={Gift} label="Invitar" onClick={() => hacer("invitar", () => onFuncion("invitar"))} />
    </div>
  );
}
