import type { ReactNode } from "react";
import { ArrowLeft, Hammer } from "lucide-react";

// Sección destino del hub (Abrir TPV / Configuración / Análisis / Administrador /
// Visor Node). Por ahora es el marco navegable + un aviso HONESTO de "en obras":
// cada una se irá diseñando aquí, sin fingir contenido que no existe.
export function Seccion({
  titulo, desc, icono, color, onVolver,
}: Readonly<{
  titulo: string; desc: string; icono: ReactNode; color: string; onVolver: () => void;
}>) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-none items-center gap-4 border-b border-border px-8 py-5">
        <span className="escudo grid h-11 w-11 place-items-center text-white" style={{ background: color }}>{icono}</span>
        <div className="mr-auto">
          <h1 className="text-xl font-black leading-none tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        </div>
        <button type="button" onClick={onVolver} className="flex items-center gap-2 rounded-md border border-border bg-surface-overlay px-4 py-2 text-sm font-semibold text-secondary-foreground transition-transform active:scale-95">
          <ArrowLeft size={16} /> Inicio <span className="ml-1 rounded bg-foreground/10 px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">Esc</span>
        </button>
      </header>

      <main className="grid flex-1 place-items-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-overlay text-muted-foreground"><Hammer size={28} /></span>
          <p className="text-lg font-semibold text-secondary-foreground">«{titulo}» se diseña aquí</p>
          <p className="max-w-md text-sm text-muted-foreground">
            El marco y la navegación ya están. El contenido de esta sección se construye
            en las siguientes tandas, con la operativa moviéndose desde el TPV actual sin big-bang.
          </p>
        </div>
      </main>
    </div>
  );
}
