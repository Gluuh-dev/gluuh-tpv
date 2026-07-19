import { X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Cabecera común de los modales del TPV: icono en placa + título/subtítulo
// alineados a la izquierda, contenido opcional a la derecha y botón de cerrar.
// Dos tonos: "marca" (banda morada; cobro, utilidades…) y "suave" (neutra con
// línea inferior; para puertas y modales frecuentes donde la banda cansa).
// `color` pinta la placa con ese fondo (el del apartado: morado/rosa/verde) e
// icono BLANCO; sin él, la placa usa el tono por defecto. `onIcono` hace la placa
// PULSABLE (p. ej. una flecha atrás): misma placa, pero es un botón.
export function CabeceraModal({
  Icono, titulo, subtitulo, derecha, onCerrar, tono = "marca", color, onIcono,
}: Readonly<{
  Icono: LucideIcon; titulo: string; subtitulo?: string; derecha?: ReactNode;
  onCerrar?: () => void; tono?: "marca" | "suave"; color?: string; onIcono?: () => void;
}>) {
  const suave = tono === "suave";
  let placa = suave ? "bg-brand/10 text-brand-lit" : "bg-white/15";
  if (color) placa = "text-white";
  const placaClase = `grid h-9 w-9 flex-none place-items-center rounded-md ${placa}`;
  const placaEstilo = color ? { background: color } : undefined;
  return (
    <header className={`flex items-center gap-3 px-4 py-3 ${suave ? "border-b border-line text-paper" : "bg-brand text-white"}`}>
      {onIcono
        ? <button type="button" onClick={onIcono} aria-label="Volver" className={`${placaClase} transition-transform active:scale-90`} style={placaEstilo}><Icono size={18} /></button>
        : <span className={placaClase} style={placaEstilo}><Icono size={18} /></span>}
      <div className="mr-auto flex min-w-0 flex-col items-start text-left leading-tight">
        <h2 className="font-display text-[17px] font-extrabold leading-tight">{titulo}</h2>
        {subtitulo && <p className={`truncate text-[11px] leading-tight ${suave ? "text-muted" : "text-white/75"}`}>{subtitulo}</p>}
      </div>
      {derecha}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          className={`grid h-8 w-8 flex-none place-items-center rounded-md transition-transform active:scale-90 ${suave ? "border border-line bg-paper/5 text-muted" : "bg-white/10"}`}>
          <X size={17} />
        </button>
      )}
    </header>
  );
}
