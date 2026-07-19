import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Cabecera morada común de los modales del TPV: icono en placa + título/subtítulo
// alineados a la izquierda, contenido opcional a la derecha y botón de cerrar.
export function CabeceraModal({
  Icono, titulo, subtitulo, derecha, onCerrar,
}: Readonly<{ Icono: LucideIcon; titulo: string; subtitulo?: string; derecha?: ReactNode; onCerrar?: () => void }>) {
  return (
    <header className="flex items-center gap-3 bg-brand px-4 py-3 text-white">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-white/15"><Icono size={18} /></span>
      <div className="mr-auto flex min-w-0 flex-col items-start text-left leading-tight">
        <h2 className="font-display text-[17px] font-extrabold leading-tight">{titulo}</h2>
        {subtitulo && <p className="truncate text-[11px] leading-tight text-white/75">{subtitulo}</p>}
      </div>
      {derecha}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-8 w-8 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90"><X size={17} /></button>
      )}
    </header>
  );
}
