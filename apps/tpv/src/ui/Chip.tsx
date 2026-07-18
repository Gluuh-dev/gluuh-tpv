import type { ReactNode } from "react";

// Chip de estado de la barra superior (Node conectado, impresora, hora…). El
// punto opcional lleva color de estado (verde por defecto, ámbar si `warn`).
export function Chip({ dot, warn, children }: Readonly<{ dot?: boolean; warn?: boolean; children: ReactNode }>) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-paper/5 px-3.5 py-2 font-mono text-[12.5px] text-paper/90">
      {dot && (
        <span
          className={`h-2 w-2 rounded-full ${warn ? "bg-amber" : "bg-mint"}`}
          style={{ boxShadow: `0 0 0 4px ${warn ? "rgba(245,166,35,.16)" : "rgba(63,216,164,.16)"}` }}
        />
      )}
      {children}
    </span>
  );
}
