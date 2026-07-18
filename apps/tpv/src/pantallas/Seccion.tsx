import type { ReactNode } from "react";
import { ArrowLeft, Hammer } from "lucide-react";

const PENTA = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";

// Sección destino del hub (Abrir TPV / Configuración / Análisis / Administrador /
// Visor Node). Por ahora es el marco navegable + un aviso HONESTO de "en obras":
// cada una se irá diseñando aquí, sin fingir contenido que no existe.
export function Seccion({
  titulo, desc, icono, color, onVolver,
}: {
  titulo: string; desc: string; icono: ReactNode; color: string; onVolver: () => void;
}) {
  return (
    <div className="flex h-screen flex-col bg-[#0c0d12] text-white">
      <header className="flex flex-none items-center gap-4 border-b border-white/[.07] px-8 py-5">
        <span className="grid h-11 w-11 place-items-center text-white" style={{ background: color, clipPath: PENTA }}>{icono}</span>
        <div className="mr-auto">
          <h1 className="text-xl font-black leading-none tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-white/40">{desc}</p>
        </div>
        <button type="button" onClick={onVolver} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/[.08]">
          <ArrowLeft size={16} /> Inicio <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-white/50">Esc</span>
        </button>
      </header>

      <main className="grid flex-1 place-items-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/[.05] text-white/40"><Hammer size={28} /></span>
          <p className="text-lg font-semibold text-white/70">«{titulo}» se diseña aquí</p>
          <p className="max-w-md text-sm text-white/35">
            El marco y la navegación ya están. El contenido de esta sección se construye
            en las siguientes tandas, con la operativa moviéndose desde el TPV actual sin big-bang.
          </p>
        </div>
      </main>
    </div>
  );
}
