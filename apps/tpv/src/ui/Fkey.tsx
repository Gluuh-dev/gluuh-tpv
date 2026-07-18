import type { ReactNode } from "react";

// Distintivo de tecla de función (F1–F5) que se muestra en las tarjetas del hub.
export function Fkey({ children, sobreOscuro = false }: Readonly<{ children: ReactNode; sobreOscuro?: boolean }>) {
  return (
    <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${sobreOscuro ? "border-white/15 bg-black/15 text-white/60" : "border-line bg-black/10 text-muted"}`}>
      {children}
    </span>
  );
}
