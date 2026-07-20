import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftClose, Home, ChevronDown, ChevronRight, ChevronUp, type LucideIcon } from "lucide-react";
import { Desplazable } from "./Flechas";

// SHELL de los apartados de GESTIÓN (Análisis, Administrador, Visor Node).
// Lenguaje "Supabase/Notion" validado en el piloto de Administrador:
//   • Lateral a TODA la altura → al plegarlo se desplazan la barra y la página.
//   • Barra de 60px NEUTRA (nada de bloque morado): el morado solo como acento.
//   • Radios pequeños (5-7px) y controles compactos (32-36px): densidad de app
//     de gestión, no de pantalla táctil de barra.
// La operativa (TPV) y Configuración NO usan esto: siguen con su propio marco.

/** Radios del lenguaje: controles y tarjetas (el `rounded-md` del proyecto son 12px). */
export const R = "rounded-[5px]";
export const RC = "rounded-[7px]";

/** Celdas de tabla del lenguaje (cabecera sutil, filas densas). */
export const TH = "border-b border-line px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted";
export const TD = "px-3 py-2 text-[12.5px]";

export interface SeccionShell { id: string; label: string; Icono: LucideIcon }
/** Dominio con sus secciones (Configuración: Carta, Precios, Salas…). */
export interface GrupoShell { titulo: string; Icono?: LucideIcon; secciones: readonly SeccionShell[] }

/** Placa de marca: el SVG monocolor es BLANCO, así que necesita fondo de marca. */
export function PlacaMarca() {
  return (
    <span className={`grid h-7 w-7 flex-none place-items-center ${R} bg-brand`}>
      <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-4 w-auto" draggable={false} />
    </span>
  );
}

export function Boton({ children, primario, onClick, disabled }: Readonly<{
  children: ReactNode; primario?: boolean; onClick?: () => void; disabled?: boolean;
}>) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-8 items-center gap-1.5 ${R} px-2.5 text-[12.5px] font-medium transition-transform active:scale-[.97] disabled:opacity-50 ${
        primario ? "bg-brand text-white" : "border border-line bg-panel text-paper/85"
      }`}>
      {children}
    </button>
  );
}

export function Tarjeta({ titulo, extra, children }: Readonly<{ titulo?: string; extra?: ReactNode; children: ReactNode }>) {
  return (
    <section className={`${RC} border border-line bg-panel`}>
      {titulo && (
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <h3 className="mr-auto text-[12.5px] font-semibold text-paper">{titulo}</h3>
          {extra}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Campo({ label, valor }: Readonly<{ label: string; valor: ReactNode }>) {
  return (
    <div>
      <span className="mb-1 block text-[11.5px] font-medium text-muted">{label}</span>
      <div className={`flex h-8 items-center ${R} border border-line bg-background px-2.5 text-[12.5px]`}>{valor}</div>
    </div>
  );
}

/** Grupo de botones tipo segmento (periodo, filtros…). */
export function Segmento<T extends string>({ valor, opciones, onCambio }: Readonly<{
  valor: T; opciones: readonly { id: T; label: string }[]; onCambio: (v: T) => void;
}>) {
  return (
    // Mismo marco que los campos de fecha (`h-8`, `rounded-md`, `bg-paper/5`): en
    // una misma barra, un selector y un input tienen que parecer la misma pieza.
    <div className="flex h-8 items-center gap-0.5 rounded-md border border-line bg-paper/5 p-0.5">
      {opciones.map((o) => (
        <button key={o.id} type="button" onClick={() => onCambio(o.id)}
          className={`h-full rounded-[3px] px-2.5 text-[12px] font-medium transition-transform active:scale-[.97] ${
            valor === o.id ? "bg-brand text-white" : "text-muted"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ShellApartado({
  app, secciones, grupos, seccion, onSeccion, onVolver, claveLateral, subtitulo, acciones, tactil,
  plegadoPorDefecto, contenidoPropio, children,
}: Readonly<{
  /** Nombre del apartado bajo "Gluuh" en la cabecera del lateral. */
  app: string;
  /** Lista plana (Análisis, Administrador, Visor Node). */
  secciones?: readonly SeccionShell[];
  /** …o agrupada por dominios, con grupos plegables (Configuración). */
  grupos?: readonly GrupoShell[];
  seccion: string;
  onSeccion: (id: string) => void;
  onVolver: () => void;
  /** Clave para recordar si el lateral está plegado (una por apartado). */
  claveLateral: string;
  /** Segunda línea de la barra: qué se está viendo. */
  subtitulo?: string;
  /** Controles a la derecha de la barra. */
  acciones?: ReactNode;
  /** Se maneja con el dedo (Configuración desde el TPV): targets ≥44px. */
  tactil?: boolean;
  /**
   * Arranca con el lateral plegado. Para apartados cuyas pantallas necesitan el
   * ancho ENTERO (mantenimiento con tablas de precios): en un terminal de 15"
   * un lateral abierto se come un cuarto de la pantalla.
   */
  plegadoPorDefecto?: boolean;
  /** La sección se encarga de su propio scroll y alto (pantallas completas). */
  contenidoPropio?: boolean;
  children: ReactNode;
}>) {
  const [abierto, setAbierto] = useState(() => {
    if (typeof localStorage === "undefined") return !plegadoPorDefecto;
    const guardado = localStorage.getItem(`gluuh_lateral_${claveLateral}`);
    if (guardado === null) return !plegadoPorDefecto;   // primera vez
    return guardado !== "0";
  });
  // Grupos plegados (solo en modo agrupado). Por defecto, todos abiertos.
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({});

  const plegar = () => setAbierto((v) => {
    const n = !v;
    try { localStorage.setItem(`gluuh_lateral_${claveLateral}`, n ? "1" : "0"); } catch { /* sin persistencia */ }
    return n;
  });

  // Una sola lista para resolver la sección activa, venga plana o agrupada.
  const todas: readonly SeccionShell[] = grupos ? grupos.flatMap((g) => [...g.secciones]) : (secciones ?? []);
  const meta = todas.find((s) => s.id === seccion) ?? todas[0]!;

  // Táctil: filas y controles suben a ≥44px; ratón: densidad de consola.
  const alturaFila = tactil ? "min-h-11" : "h-9";
  const textoFila = tactil ? "text-[14px]" : "text-[13px]";
  const anchoAbierto = tactil ? "w-64" : "w-56";

  const fila = (s: SeccionShell) => {
    const activa = s.id === seccion;
    return (
      <button key={s.id} type="button" onClick={() => onSeccion(s.id)} title={abierto ? undefined : s.label}
        className={`flex ${alturaFila} w-full items-center gap-2.5 ${R} text-left ${textoFila} transition-colors ${
          activa ? "bg-paper/8 font-semibold text-paper" : "font-medium text-muted"
        } ${abierto ? "px-2.5" : "justify-center px-0"}`}>
        <s.Icono size={tactil ? 17 : 16} className={`flex-none ${activa ? "text-brand-lit" : ""}`} />
        {abierto && <span className="truncate">{s.label}</span>}
      </button>
    );
  };

  // TÁCTIL: fuera la barra de desplazamiento (con el dedo no se agarra, y la
  // nativa de Windows mete sus propias flechitas de 12px). Si la lista no cabe,
  // salen flechas ARRIBA/ABAJO de tamaño de dedo. Misma solución que ya usan las
  // subpestañas del marco de mantenimiento.
  const carril = useRef<HTMLDivElement>(null);
  const [desbordado, setDesbordado] = useState(false);
  const [enTope, setEnTope] = useState(true);
  const [enFondo, setEnFondo] = useState(false);

  const medir = useCallback(() => {
    const el = carril.current;
    if (!el) return;
    setDesbordado(el.scrollHeight > el.clientHeight + 1);
    setEnTope(el.scrollTop <= 1);
    setEnFondo(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  // Se remide al cambiar la lista, al plegar/desplegar y al cambiar de tamaño.
  useEffect(() => {
    medir();
    const el = carril.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir, grupos, secciones, abierto, cerrados]);

  const desplazar = (dir: -1 | 1) => {
    const el = carril.current;
    if (el) el.scrollBy({ top: dir * el.clientHeight * 0.7, behavior: "smooth" });
  };

  const flecha = (dir: -1 | 1, apagada: boolean) => (
    <button type="button" onClick={() => desplazar(dir)} disabled={apagada}
      aria-label={dir < 0 ? "Subir en el menú" : "Bajar en el menú"}
      className={`flex ${tactil ? "h-11" : "h-9"} flex-none items-center justify-center text-muted transition-transform active:scale-90 disabled:opacity-25 ${
        dir < 0 ? "border-b border-line" : "border-t border-line"
      }`}>
      {dir < 0 ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── LATERAL a toda la altura: al plegar se desplazan barra y página ── */}
      <aside className={`flex flex-none flex-col border-r border-line bg-panel transition-[width] duration-150 ${abierto ? anchoAbierto : "w-13"}`}>
        <div className="flex h-15 flex-none items-center gap-2.5 border-b border-line px-3">
          {abierto ? (
            <>
              <PlacaMarca />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-semibold leading-tight">Gluuh</b>
                <span className="block truncate text-[11px] leading-tight text-muted">{app}</span>
              </span>
              <button type="button" onClick={plegar} title="Plegar menú" aria-label="Plegar menú"
                className={`grid h-7 w-7 flex-none place-items-center ${R} text-muted transition-transform active:scale-90`}>
                <PanelLeftClose size={16} />
              </button>
            </>
          ) : (
            // Plegado: la marca ES el botón de desplegar (en 52px no caben ambos).
            <button type="button" onClick={plegar} title="Desplegar menú" aria-label="Desplegar menú"
              className="mx-auto transition-transform active:scale-90">
              <PlacaMarca />
            </button>
          )}
        </div>

        {desbordado && flecha(-1, enTope)}
        <nav ref={carril} onScroll={medir} className="no-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
          {grupos
            ? grupos.map((g) => {
              // Plegado: sin sitio para cabeceras de grupo, se listan seguidas.
              if (!abierto) return g.secciones.map(fila);
              const cerrado = !!cerrados[g.titulo];
              const tieneActiva = g.secciones.some((s) => s.id === seccion);
              return (
                <div key={g.titulo} className="pb-1">
                  <button type="button"
                    onClick={() => setCerrados((c) => ({ ...c, [g.titulo]: !c[g.titulo] }))}
                    className={`flex ${tactil ? "min-h-10" : "h-8"} w-full items-center gap-1.5 ${R} px-2.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                      tieneActiva ? "text-paper/70" : "text-muted"
                    }`}>
                    {cerrado ? <ChevronRight size={13} className="flex-none" /> : <ChevronDown size={13} className="flex-none" />}
                    <span className="truncate">{g.titulo}</span>
                    <span className="ml-auto text-[10.5px] font-medium tabular-nums opacity-70">{g.secciones.length}</span>
                  </button>
                  {!cerrado && <div className="space-y-0.5">{g.secciones.map(fila)}</div>}
                </div>
              );
            })
            : (secciones ?? []).map(fila)}
        </nav>
        {desbordado && flecha(1, enFondo)}

        <div className="flex-none border-t border-line p-2">
          <button type="button" onClick={onVolver} title="Volver al inicio (Esc)"
            className={`flex h-9 w-full items-center gap-2.5 ${R} text-[13px] font-medium text-muted transition-colors ${abierto ? "px-2.5" : "justify-center px-0"}`}>
            <Home size={16} className="flex-none" />
            {abierto && <span>Volver al inicio</span>}
          </button>
        </div>
      </aside>

      {/* ── COLUMNA DE CONTENIDO ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-15 flex-none items-center gap-3 border-b border-line px-4">
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight">{meta.label}</h1>
            {subtitulo && <p className="truncate text-[12px] text-muted">{subtitulo}</p>}
          </div>
          {acciones}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Con `contenidoPropio` la pantalla se gobierna el scroll ella (tiene
              sus propias listas con flechas). Si no, se lo ponemos aquí, que
              para eso el shell es el que sabe cuánto alto queda. */}
          {contenidoPropio ? children : <Desplazable>{children}</Desplazable>}
        </main>
      </div>
    </div>
  );
}
