import { X } from "lucide-react";
import type { ReactNode } from "react";

// BARRA DE TÍTULO estilo ventana de escritorio: franja morada fina, el título a
// la izquierda y la ✕ a la derecha. Sin icono ni subtítulo — es cromo de
// ventana, no una cabecera de contenido.
//
// La usan las ventanas "de herramienta" (buscadores, teclado): las que se
// mueven por la pantalla y conviven con otras. Los modales que ocupan el centro
// y cuentan algo (cobro, parámetros) siguen con `CabeceraModal`.
//
// `data-arrastrar` la convierte en el asa: por aquí se coge para mover (Modal.tsx).
export function BarraVentana({ titulo, onCerrar, derecha }: Readonly<{
  titulo: string; onCerrar?: () => void; derecha?: ReactNode;
}>) {
  return (
    <header data-arrastrar
      className="flex h-9 flex-none cursor-move touch-none items-center gap-2 bg-brand pl-3.5 pr-1.5 text-white select-none">
      <h2 className="mr-auto truncate text-[13px] font-semibold">{titulo}</h2>
      {derecha}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          className="grid h-7 w-7 flex-none place-items-center rounded-[4px] text-white/90 transition-transform active:scale-90">
          <X size={16} strokeWidth={2.4} />
        </button>
      )}
    </header>
  );
}
