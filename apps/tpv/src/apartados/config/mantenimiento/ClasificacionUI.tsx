import { Check } from "lucide-react";

// Piezas compartidas por las pantallas de Familias y Categorías: la paleta de
// color y el interruptor sí/no. Un solo sitio para que las dos se vean igual.

// Tonos oscuros a propósito: el texto de los botones del TPV es blanco y sobre
// un color claro desaparecería (la misma razón que en «Aspecto del artículo»).
export const PALETA = [
  "#2f7fd0", "#1f6fb2", "#2ea06a", "#1d7d52", "#c0553f", "#a13b2a",
  "#7c3d9b", "#5b3a8e", "#b8801f", "#8a6014", "#3b414d", "#22262e",
];

export function PaletaColor({ valor, soloLectura, onCambio }: Readonly<{
  valor: string; soloLectura?: boolean; onCambio: (c: string) => void;
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETA.map((c) => (
        <button key={c} type="button" disabled={soloLectura} onClick={() => onCambio(c)}
          aria-label={`Color ${c}`} aria-pressed={valor.toLowerCase() === c}
          className={`h-10 w-10 rounded-[5px] border-2 transition-transform active:scale-90 disabled:opacity-50 ${
            valor.toLowerCase() === c ? "border-paper" : "border-transparent"
          }`}
          style={{ background: c }}>
          {valor.toLowerCase() === c && <Check size={16} strokeWidth={3} className="mx-auto text-white" />}
        </button>
      ))}
    </div>
  );
}

export function InterruptorSN({ activo, etiqueta, soloLectura, onToggle }: Readonly<{
  activo: boolean; etiqueta: string; soloLectura?: boolean; onToggle: () => void;
}>) {
  return (
    <button type="button" aria-pressed={activo} disabled={soloLectura} onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-2.5 rounded-[5px] border border-line bg-panel-2 px-3 text-[12.5px] font-semibold text-paper/85 transition-transform active:scale-[.98] disabled:opacity-60">
      {etiqueta}
      <span className={`relative h-5.5 w-9.5 flex-none rounded-full transition-colors ${activo ? "bg-mint" : "bg-paper/20"}`}>
        <i className={`absolute top-0.75 h-4 w-4 rounded-full bg-white transition-[left] ${activo ? "left-4.75" : "left-0.75"}`} />
      </span>
    </button>
  );
}
