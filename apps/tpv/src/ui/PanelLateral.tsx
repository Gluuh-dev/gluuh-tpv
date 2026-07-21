import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// PANEL LATERAL (drawer) — se desliza desde la derecha, a toda la altura y
// ancho. Para ventanas con mucho contenido en rejilla (la galería de fotos),
// donde un modal centrado se queda estrecho. Velo con clic fuera + Esc.
// ────────────────────────────────────────────────────────────────────────────
export function PanelLateral({ titulo, onCerrar, children, ancho = "820px" }: Readonly<{
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Ancho del panel (se recorta a 96vw en pantallas pequeñas). */
  ancho?: string;
}>) {
  // Esc en CAPTURA y cortado, como el Modal: si no, el Esc global de App.tsx
  // (que manda a Inicio) también salta y cerrar el panel te echa de la pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);

  return (
    <div className="gl-velo fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[1.5px]">
      {/* Velo HERMANO (no envuelve el contenido) para no anidar botones. */}
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 cursor-default" />
      <div className="gl-lateral relative flex h-full flex-none flex-col border-l border-line bg-panel shadow-[-12px_0_40px_-20px_rgba(0,0,0,.5)]"
        style={{ width: `min(${ancho}, 96vw)` }}>
        <div className="flex flex-none items-center justify-between border-b border-line bg-panel-2 px-4 py-3">
          <h2 className="text-[14px] font-semibold text-paper">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-[6px] text-muted transition-transform active:scale-90">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
