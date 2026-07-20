import { useState, type ReactNode } from "react";
import { Home, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";

// SHELL de los apartados "de app" (Análisis, Administrador, Visor Node), con el
// lenguaje del mockup del cliente (`docs/diseño/gluuh-empleados.html`) y de la
// operativa que ya existe:
//   • Barra superior COMPACTA de 56px (h-14) morada, como la del TPV — no la
//     cabecera-ficha de 88px del MarcoApartado (que se queda para Configuración).
//   • Menú lateral COLAPSABLE: 240px abierto / 56px en iconos. La preferencia se
//     recuerda por apartado en localStorage (como el modo zurdo).
//   • El scroll vive DENTRO del contenido, nunca en la página.
// Reglas del TPV: sin hover, animación al pulsar, objetivos ≥44px.

export interface SeccionShell { id: string; label: string; Icono: LucideIcon }

export function ShellApartado({
  titulo, secciones, seccion, onSeccion, onVolver, acciones, claveLateral, children,
}: Readonly<{
  titulo: string;
  secciones: readonly SeccionShell[];
  seccion: string;
  onSeccion: (id: string) => void;
  onVolver: () => void;
  /** Controles a la derecha de la barra superior (filtros, actualizar…). */
  acciones?: ReactNode;
  /** Clave para recordar si el lateral está plegado (una por apartado). */
  claveLateral: string;
  children: ReactNode;
}>) {
  const [abierto, setAbierto] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(`gluuh_lateral_${claveLateral}`) !== "0";
  });

  const plegar = () => {
    setAbierto((v) => {
      const n = !v;
      try { localStorage.setItem(`gluuh_lateral_${claveLateral}`, n ? "1" : "0"); } catch { /* sin persistencia */ }
      return n;
    });
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ── Barra superior (56px), igual que la del TPV ── */}
      <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-white">
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" draggable={false} />
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold">{titulo}</span>
        <div className="ml-auto flex items-center gap-2">
          {acciones}
          <button type="button" onClick={onVolver} title="Volver al inicio (Esc)" aria-label="Volver al inicio"
            className="grid h-9 w-9 flex-none place-items-center rounded-md bg-white/10 transition-transform active:scale-90">
            <Home size={17} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Lateral colapsable ── */}
        <nav className={`flex flex-none flex-col border-r border-line bg-panel transition-[width] duration-150 ${abierto ? "w-60" : "w-14"}`}>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {secciones.map((s) => {
              const activa = s.id === seccion;
              return (
                <button key={s.id} type="button" onClick={() => onSeccion(s.id)}
                  title={abierto ? undefined : s.label}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] font-semibold transition-transform active:scale-[.98] ${
                    activa ? "bg-brand text-white" : "text-paper/80"
                  } ${abierto ? "" : "justify-center px-0"}`}>
                  <s.Icono size={17} className={`flex-none ${activa ? "text-white" : "text-muted"}`} />
                  {abierto && <span className="truncate">{s.label}</span>}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={plegar} title={abierto ? "Plegar menú" : "Desplegar menú"}
            className={`flex min-h-11 flex-none items-center gap-3 border-t border-line px-3 text-[12.5px] font-semibold text-muted transition-transform active:scale-[.98] ${abierto ? "" : "justify-center px-0"}`}>
            {abierto ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            {abierto && <span>Plegar</span>}
          </button>
        </nav>

        {/* ── Contenido (con su propio scroll) ── */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

/** Barra de herramientas de la sección: título + subtítulo y acciones a la derecha. */
export function BarraSeccion({ titulo, sub, children }: Readonly<{ titulo: string; sub?: string; children?: ReactNode }>) {
  return (
    <div className="flex flex-none items-center gap-3 border-b border-line px-4 py-2.5">
      <div className="mr-auto min-w-0">
        <h2 className="truncate font-display text-[15px] font-bold leading-tight">{titulo}</h2>
        {sub && <p className="truncate text-[12px] text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** Caja/panel del mockup: rótulo en mayúsculas + contador a la derecha. */
export function Caja({
  titulo, contador, acciones, scroll, className = "", children,
}: Readonly<{
  titulo?: string; contador?: string; acciones?: ReactNode; scroll?: boolean;
  className?: string; children: ReactNode;
}>) {
  return (
    <section className={`flex min-h-0 flex-col rounded-xl border border-line bg-panel ${className}`}>
      {titulo && (
        <div className="flex flex-none items-center gap-2 px-3.5 pb-2 pt-3">
          <h3 className="text-[11.5px] font-bold uppercase tracking-widest text-muted">{titulo}</h3>
          {contador && <span className="ml-auto text-[12px] font-semibold text-paper/70">{contador}</span>}
          {acciones && <span className={contador ? "" : "ml-auto"}>{acciones}</span>}
        </div>
      )}
      <div className={`px-3.5 pb-3.5 ${titulo ? "" : "pt-3.5"} ${scroll ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        {children}
      </div>
    </section>
  );
}
