import { useEffect, type ReactNode } from "react";

// Modal BASE reutilizable de la operativa: velo con desenfoque, aparición CENTRADA
// (fundido + escala desde el centro), cierre con Esc y clic fuera. Todos los
// modales del TPV (credencial, ayuda, cobro…) se montan sobre este.
// Reglas del TPV: sin hover, sombras mínimas.
const ANCHOS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-[560px]", "2xl": "max-w-3xl", "3xl": "max-w-5xl", "4xl": "max-w-6xl", "5xl": "max-w-[1240px]" } as const;

export function Modal({
  children, onCerrar, ancho = "sm", className = "", cerrarFuera = true,
}: Readonly<{
  children: ReactNode;
  onCerrar: () => void;
  ancho?: keyof typeof ANCHOS;
  className?: string;
  cerrarFuera?: boolean;
}>) {
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

  return (
    <button
      type="button"
      aria-label="Cerrar"
      className="gl-velo fixed inset-0 z-50 grid cursor-default place-items-center bg-black/25 p-4 backdrop-blur-[1.5px]"
      onClick={cerrarFuera ? onCerrar : undefined}
    >
      <div
        className={`gl-aparecer w-full ${ANCHOS[ancho]} rounded-md bg-panel text-paper shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </button>
  );
}
