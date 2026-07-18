import { Delete } from "lucide-react";
import type { ReactNode } from "react";

// Teclado numérico REUTILIZABLE (PIN, cantidades, precios, importes del cobro…).
// Presentacional: no guarda estado; avisa por callbacks. La esquina inferior
// izquierda es libre (`botonIzquierda`) para un Cancelar, un "00", etc.
// Reglas del TPV: sin hover, solo animación al pulsar.
const TECLA = "rounded-2xl border border-line bg-paper/5 py-4 font-display text-2xl font-semibold tabular-nums text-paper transition-transform active:scale-90 active:bg-paper/10 disabled:opacity-50";

export function TecladoNumerico({
  onDigito, onBorrar, deshabilitado = false, botonIzquierda,
}: Readonly<{
  onDigito: (d: string) => void;
  onBorrar: () => void;
  deshabilitado?: boolean;
  botonIzquierda?: ReactNode;
}>) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <button key={d} type="button" onClick={() => onDigito(d)} disabled={deshabilitado} className={TECLA}>{d}</button>
      ))}
      {botonIzquierda ?? <span aria-hidden />}
      <button type="button" onClick={() => onDigito("0")} disabled={deshabilitado} className={TECLA}>0</button>
      <button type="button" onClick={onBorrar} disabled={deshabilitado} aria-label="Borrar"
        className="grid place-items-center rounded-2xl border border-line bg-paper/5 py-4 text-paper transition-transform active:scale-90 disabled:opacity-50">
        <Delete size={22} />
      </button>
    </div>
  );
}
