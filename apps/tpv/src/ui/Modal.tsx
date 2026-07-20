import { useEffect, useRef, useState, type ReactNode } from "react";

// Modal BASE reutilizable de la operativa: velo con desenfoque, aparición CENTRADA
// (fundido + escala desde el centro), cierre con Esc y clic fuera. Todos los
// modales del TPV (credencial, ayuda, cobro…) se montan sobre este.
// Reglas del TPV: sin hover, sombras mínimas.
//
// ARRASTRABLE: se coge por la cabecera (cualquier elemento con `data-arrastrar`,
// que es lo que marca `CabeceraModal`) y se mueve. Hace falta de verdad: con el
// teclado en pantalla abierto, el modal tapa justo lo que estás escribiendo, y
// en un terminal táctil no hay forma de apartarlo.
const ANCHOS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-[560px]", "2xl": "max-w-3xl", "3xl": "max-w-5xl", "4xl": "max-w-6xl", "5xl": "max-w-[1240px]" } as const;

export function Modal({
  children, onCerrar, ancho = "sm", className = "", cerrarFuera = true, arrastrable = true,
}: Readonly<{
  children: ReactNode;
  onCerrar: () => void;
  ancho?: keyof typeof ANCHOS;
  className?: string;
  cerrarFuera?: boolean;
  arrastrable?: boolean;
}>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);

  // Esc en CAPTURA y cortando el evento: si no, el Esc global de App.tsx (que
  // manda a Inicio) también se dispara y cerrar un modal te echaba además de la
  // pantalla. El modal se come su propio Esc; lo de detrás no se entera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);

  const empezarArrastre = (e: React.PointerEvent) => {
    if (!arrastrable) return;
    const t = e.target as HTMLElement;
    // Solo por la cabecera, y sin robarle el toque a sus botones (la X).
    if (!t.closest("[data-arrastrar]") || t.closest("button, input, select, textarea, a")) return;
    origen.current = { x: e.clientX - (pos?.x ?? 0), y: e.clientY - (pos?.y ?? 0) };

    const mover = (ev: PointerEvent) => {
      if (!origen.current) return;
      setPos({ x: ev.clientX - origen.current.x, y: ev.clientY - origen.current.y });
    };
    const soltar = () => {
      origen.current = null;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  return (
    <button
      type="button"
      aria-label="Cerrar"
      className="gl-velo fixed inset-0 z-50 grid cursor-default place-items-center bg-black/25 p-4 backdrop-blur-[1.5px]"
      onClick={cerrarFuera ? onCerrar : undefined}
    >
      {/*
        `text-left` NO es decorativo: el velo de arriba es un <button>, y los
        botones traen `text-align:center` del navegador, y eso se HEREDA hacia
        dentro. Sin esto, cualquier celda o texto sin alineación propia sale
        centrado (se veía en las tablas de los buscadores).
      */}
      <div
        style={pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        className={`gl-aparecer w-full text-left ${ANCHOS[ancho]} rounded-md bg-panel text-paper shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={empezarArrastre}
      >
        {children}
      </div>
    </button>
  );
}
