import { Ban, Combine, MessageSquarePlus, Gift, type LucideIcon } from "lucide-react";
import { useVenta } from "../store";

function Accion({ Icono, label, activo, disabled, onClick }: Readonly<{ Icono: LucideIcon; label: string; activo?: boolean; disabled?: boolean; onClick: () => void }>) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[7px] border text-[.62rem] font-semibold transition-transform active:scale-95 disabled:opacity-40 ${activo ? "border-[#0e8fa2] bg-accent-soft text-brand" : "border-border bg-surface-2 text-muted-foreground"}`}>
      <Icono size={19} /> {label}
    </button>
  );
}

// Acciones sobre la línea seleccionada (fila bajo el ticket): anular, componer
// menú, comentario/extra, invitar. Se activan con una línea seleccionada.
export function FilaAcciones() {
  const lineaSel = useVenta((s) => s.lineaSel);
  const invitadas = useVenta((s) => s.invitadas);
  const anular = useVenta((s) => s.anularLinea);
  const invitar = useVenta((s) => s.invitarLinea);
  const hay = !!lineaSel;

  return (
    <div className="flex flex-none items-stretch gap-1 px-2 pb-1">
      <Accion Icono={Ban} label="Anular" disabled={!hay} onClick={() => lineaSel && anular(lineaSel)} />
      <Accion Icono={Combine} label="Comp. menú" disabled onClick={() => {}} />
      <Accion Icono={MessageSquarePlus} label="Com. y extra" disabled onClick={() => {}} />
      <Accion Icono={Gift} label="Invitar" activo={!!lineaSel && !!invitadas[lineaSel]} disabled={!hay} onClick={() => lineaSel && invitar(lineaSel)} />
    </div>
  );
}
