import type { ReactNode } from "react";

// Placa con la silueta del ESCUDO del logo Gluuh (icono dentro). El motivo de
// marca que se repite en el hub, las tarjetas y los modales.
export function Escudo({
  children, fondo, tam = 56, className = "",
}: Readonly<{ children: ReactNode; fondo: string; tam?: number; className?: string }>) {
  return (
    <span className={`escudo grid place-items-center text-white ${className}`} style={{ width: tam, height: tam, background: fondo }}>
      {children}
    </span>
  );
}
