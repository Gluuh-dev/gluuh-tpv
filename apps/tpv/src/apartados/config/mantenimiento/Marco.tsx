import { type ReactNode, useRef } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

// ============================================================================
// MARCO DE MANTENIMIENTO — el patrón clásico de los TPV de hostelería (Ágora,
// Glop), portado al lenguaje de la operativa (marca themeable, claro/oscuro,
// sin hover, táctil ≥44px). Del mockup docs/diseño/configuracion-faltante.
//
//   pestañas ──── Lista / Ficha / Informes
//   sub-pestañas ─ Datos generales · Extras · Precios…  (desplazables con ‹ ›)
//   cuerpo ────── cajas con formularios y tablas
//   barra ─────── ◀ ▶ navegación · Nuevo/Modificar/Eliminar · Aceptar/Cancelar
//                 · estado ("Consulta · artículo 3 de 48") · Salir
//
// La barra de abajo es lo que hace que se sienta un TPV y no una web: se
// consulta en solo lectura y hay que pulsar «Modificar» para poder tocar nada.
// Lo comparten todas las pantallas de Configuración; ver Productos.tsx.
// ============================================================================

export function MarcoMantenimiento({
  pestanas, pestana, onPestana,
  subpestanas, subpestana, onSubpestana,
  pie, children,
}: Readonly<{
  pestanas: string[];
  pestana: string;
  onPestana: (p: string) => void;
  subpestanas?: string[];
  subpestana?: string;
  onSubpestana?: (s: string) => void;
  pie: ReactNode;
  children: ReactNode;
}>) {
  const carril = useRef<HTMLDivElement>(null);
  const desplazar = (dir: number) => carril.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Pestañas principales ── */}
      <div role="tablist" className="flex flex-none gap-0.5 border-b border-line bg-ink-2/40 px-3">
        {pestanas.map((p) => {
          const on = p === pestana;
          return (
            <button
              key={p} type="button" role="tab" aria-selected={on} onClick={() => onPestana(p)}
              className={`-mb-px mt-1.5 flex min-h-11.5 items-center rounded-t-lg border px-7 text-[14.5px] transition-transform active:scale-[.98] ${
                on
                  ? "border-line border-b-panel bg-panel font-extrabold text-brand-lit"
                  : "border-transparent font-semibold text-muted"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* ── Sub-pestañas (solo si la pestaña las tiene) ── */}
      {subpestanas && subpestanas.length > 0 && (
        <div className="flex flex-none items-center border-b border-line bg-panel px-1.5">
          <div ref={carril} role="tablist" className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {subpestanas.map((s) => {
              const on = s === subpestana;
              return (
                <button
                  key={s} type="button" role="tab" aria-selected={on} onClick={() => onSubpestana?.(s)}
                  className={`flex min-h-11 flex-none items-center whitespace-nowrap border-b-[3px] px-4 text-[11.5px] font-extrabold uppercase tracking-wider transition-transform active:scale-[.98] ${
                    on ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-transparent text-muted"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div className="flex flex-none gap-1 p-1">
            <button type="button" aria-label="Pestaña anterior" onClick={() => desplazar(-1)}
              className="grid h-9.5 w-9.5 place-items-center rounded-md border border-line text-brand-lit transition-transform active:scale-95">
              <ChevronLeft size={16} strokeWidth={2.6} />
            </button>
            <button type="button" aria-label="Pestaña siguiente" onClick={() => desplazar(1)}
              className="grid h-9.5 w-9.5 place-items-center rounded-md border border-line text-brand-lit transition-transform active:scale-95">
              <ChevronRight size={16} strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {/* ── Cuerpo ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">{children}</div>

      {/* ── Barra de acciones ── */}
      <footer className="flex flex-none flex-wrap items-center gap-1 border-t border-line bg-panel px-3 py-2">
        {pie}
      </footer>
    </div>
  );
}

/** Caja de contenido: el panel con su título en versalitas y un contador opcional. */
export function Caja({ titulo, contador, crecer, children }: Readonly<{
  titulo?: string; contador?: ReactNode; crecer?: boolean; children: ReactNode;
}>) {
  return (
    <section className={`flex min-h-0 flex-col rounded-xl border border-line bg-panel ${crecer ? "flex-1" : "flex-none"}`}>
      {titulo && (
        <h3 className="flex flex-none items-center gap-2 px-3.5 pb-2 pt-3 text-[11.5px] font-extrabold uppercase tracking-[.07em] text-muted">
          {titulo}
          {contador !== undefined && (
            <span className="ml-auto text-[12.5px] font-semibold normal-case tracking-normal text-paper/70">{contador}</span>
          )}
        </h3>
      )}
      {children}
    </section>
  );
}

/** Campo de formulario: etiqueta arriba, control(es) debajo. */
export function Campo({ etiqueta, htmlFor, children }: Readonly<{
  etiqueta: string; htmlFor?: string; children: ReactNode;
}>) {
  return (
    <div className="mb-2.5 last:mb-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-semibold text-paper/70">{etiqueta}</label>
      {children}
    </div>
  );
}

/**
 * Estilo compartido de input/select. En solo lectura se apaga visualmente.
 * `compacta` es la variante de celda de tabla: NO se puede lograr añadiendo
 * `min-h-10` en `extra`, porque entre dos utilidades de la misma propiedad gana
 * el orden de la hoja generada, no el del atributo class.
 */
export const claseEntrada = (soloLectura?: boolean, extra = "", compacta = false) =>
  `w-full rounded-md border px-2.5 font-semibold outline-none transition-colors ${
    compacta ? "min-h-10 text-[13.5px]" : "min-h-11 text-[14.5px]"
  } ${
    soloLectura
      ? "border-line bg-paper/[.04] font-medium text-paper/70"
      : "border-line bg-panel-2 text-paper focus:border-brand-lit"
  } ${extra}`;

/** Botón de la barra inferior: icono grande arriba, rótulo debajo. */
export function BotonPie({ Icono, children, tono = "marca", onClick, disabled }: Readonly<{
  Icono: LucideIcon; children: ReactNode;
  tono?: "marca" | "ok" | "no" | "neutro";
  onClick?: () => void; disabled?: boolean;
}>) {
  const color = { marca: "text-brand-lit", ok: "text-mint", no: "text-danger", neutro: "text-muted" }[tono];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex min-h-16 min-w-[74px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-paper/80 transition-transform active:scale-95 disabled:opacity-35">
      <Icono size={22} strokeWidth={1.9} className={disabled ? "text-muted" : color} />
      {children}
    </button>
  );
}

export function SepPie() {
  return <span className="mx-1.5 h-11 w-px flex-none bg-line" />;
}

/** Píldora de estado a la derecha de la barra: qué modo y qué registro. */
export function EstadoPie({ editando, children }: Readonly<{ editando?: boolean; children: ReactNode }>) {
  return (
    <span className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold ${
      editando ? "border-amber/40 bg-amber/10 text-amber" : "border-line bg-paper/5 text-paper/70"
    }`}>
      <span className={`h-2.5 w-2.5 rounded-full ${editando ? "bg-amber" : "bg-muted"}`} />
      {children}
    </span>
  );
}
