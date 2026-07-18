import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Escudo } from "./Escudo";

// Marco común de un apartado (Configuración, Análisis, Administrador, Visor Node,
// TPV…): cabecera con su escudo + título + descripción + volver al inicio (Esc),
// y debajo su contenido. Da coherencia a todas las pantallas del hub.
export function MarcoApartado({
  titulo, desc, icono, color, onVolver, acciones, children,
}: Readonly<{
  titulo: string;
  desc?: string;
  icono: ReactNode;
  color: string;
  onVolver: () => void;
  acciones?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-none items-center gap-4 border-b border-line px-8 py-5">
        <Escudo fondo={color} tam={44}>{icono}</Escudo>
        <div className="mr-auto">
          <h1 className="font-display text-xl font-extrabold leading-none tracking-tight">{titulo}</h1>
          {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
        </div>
        {acciones}
        <button type="button" onClick={onVolver} className="flex items-center gap-2 rounded-md border border-line bg-paper/5 px-4 py-2 text-sm font-semibold text-paper/85 transition-transform active:scale-95">
          <ArrowLeft size={16} /> Inicio
          <span className="ml-1 rounded bg-paper/10 px-1.5 py-0.5 font-mono text-[11px] text-muted">Esc</span>
        </button>
      </header>
      {children}
    </div>
  );
}
