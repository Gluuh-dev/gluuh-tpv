import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Search, PlusCircle, Keyboard, type LucideIcon } from "lucide-react";
import { Modal, BarraVentana, abrirTeclado, Desplazable } from "../../../ui";

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

/**
 * PESTAÑAS principales (Lista / Ficha / Informe). Aspecto de carpeta: la activa
 * se «pega» al cuerpo de abajo (`border-b-panel` sobre el `border-b` de la fila)
 * y va en relieve, para que se lea como pulsada y no como un enlace más.
 *
 * Componente aparte porque este trío es el esqueleto del 90% de las pantallas de
 * Configuración; MarcoMantenimiento solo lo compone.
 */
export function Pestanas({ pestanas, pestana, onPestana }: Readonly<{
  pestanas: readonly string[]; pestana: string; onPestana: (p: string) => void;
}>) {
  return (
    <div role="tablist" className="flex flex-none items-end gap-1.5 bg-background px-3 pt-2.5">
      {pestanas.map((p) => {
        const on = p === pestana;
        return (
          <button
            key={p} type="button" role="tab" aria-selected={on} onClick={() => onPestana(p)}
            className={`-mb-px flex min-h-12 items-center rounded-t-[12px] border px-6 text-[14.5px] transition-all active:scale-[.98] ${
              on
                ? "border-line border-b-panel bg-panel font-semibold text-paper shadow-[0_-2px_6px_rgba(0,0,0,.04)]"
                : "border-line/60 bg-panel-2 font-medium text-muted"
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

/**
 * SUB-PESTAÑAS dentro de Ficha (Datos generales · Extras · Precios…). Mismas
 * carpetas que las principales, un escalón por debajo y algo más pequeñas: la
 * activa es blanca (se funde con el cuerpo), las demás gris claro. Se desplazan
 * con ‹ › si no caben.
 */
export function SubPestanas({ subpestanas, subpestana, onSubpestana }: Readonly<{
  subpestanas: readonly string[]; subpestana?: string; onSubpestana?: (s: string) => void;
}>) {
  const carril = useRef<HTMLDivElement>(null);
  const desplazar = (dir: number) => carril.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  // Las flechas SOLO si no caben. Con 3 pestañas cortas sobraban y quedaban
  // muertas (no había a dónde desplazarse).
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = carril.current;
    if (!el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [subpestanas]);

  return (
    <div className="flex flex-none items-end border-b border-line bg-panel px-3 pt-2">
      <div ref={carril} role="tablist" className="no-scrollbar flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
        {subpestanas.map((s) => {
          const on = s === subpestana;
          return (
            <button
              key={s} type="button" role="tab" aria-selected={on} onClick={() => onSubpestana?.(s)}
              className={`-mb-px flex min-h-10 flex-none items-center whitespace-nowrap rounded-t-[10px] border px-5 text-[12.5px] transition-all active:scale-[.98] ${
                on
                  ? "border-line border-b-panel bg-panel font-bold text-paper"
                  : "border-line/60 bg-panel-2 font-medium text-muted"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className={`flex-none gap-1 pb-1 pl-1 ${desborda ? "flex" : "hidden"}`}>
        <button type="button" aria-label="Pestaña anterior" onClick={() => desplazar(-1)}
          className="grid h-9 w-9 place-items-center rounded-[8px] bg-panel-2 text-muted transition-transform active:scale-95">
          <ChevronLeft size={16} strokeWidth={2.6} />
        </button>
        <button type="button" aria-label="Pestaña siguiente" onClick={() => desplazar(1)}
          className="grid h-9 w-9 place-items-center rounded-[8px] bg-panel-2 text-muted transition-transform active:scale-95">
          <ChevronRight size={16} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

export function MarcoMantenimiento({
  pestanas, pestana, onPestana,
  subpestanas, subpestana, onSubpestana,
  pie, children, pegado,
}: Readonly<{
  pestanas: readonly string[];
  pestana: string;
  onPestana: (p: string) => void;
  subpestanas?: readonly string[];
  subpestana?: string;
  onSubpestana?: (s: string) => void;
  pie: ReactNode;
  children: ReactNode;
  /**
   * El contenido va PEGADO a las pestañas, sin margen y sin la esquina superior
   * redondeada bajo la pestaña activa. Para la Lista: así la tabla parece la
   * continuación de la pestaña, no una tarjeta flotando debajo.
   */
  pegado?: boolean;
}>) {
  const haySub = !!subpestanas && subpestanas.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Pestanas pestanas={pestanas} pestana={pestana} onPestana={onPestana} />

      {/* ── Cuerpo: una CAJA BLANCA con borde con la que se funde la pestaña (y
          la subpestaña) activa. La pestaña activa «abre» el borde superior de la
          caja (`-mb-px` + `border-b-panel`). Las subpestañas viven DENTRO de la
          caja, arriba, como las lengüetas de una carpeta. `min-w-0` evita que una
          tabla ancha empuje el layout. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-x border-t border-line bg-panel">
        {haySub && (
          <SubPestanas subpestanas={subpestanas} subpestana={subpestana} onSubpestana={onSubpestana} />
        )}
        <div className={pegado
          ? "flex min-h-0 min-w-0 flex-1 flex-col *:rounded-none *:border-x-0 *:border-t-0 *:bg-transparent"
          : "flex min-h-0 flex-1 flex-col gap-2.5 p-3"}>
          {children}
        </div>
      </div>

      {/* ── Barra de acciones ── */}
      <footer className="flex flex-none flex-wrap items-center gap-1 border-t border-line bg-panel px-3 py-2">
        {pie}
      </footer>
    </div>
  );
}

/** Caja de contenido: el panel con su título en versalitas y un contador opcional. */
export function Caja({ titulo, contador, acciones, crecer, children }: Readonly<{
  titulo?: string; contador?: ReactNode; acciones?: ReactNode; crecer?: boolean; children: ReactNode;
}>) {
  return (
    <section className={`flex min-h-0 flex-col rounded-[7px] border border-line bg-panel ${crecer ? "flex-1" : "flex-none"}`}>
      {titulo && (
        // Misma cabecera que la `Tarjeta` del shell de gestión: línea inferior y
        // rótulo sobrio (no versalitas gordas), para que no parezcan dos apps.
        <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-2 text-[12.5px] font-semibold text-paper">
          <h3 className="text-[12.5px] font-semibold">{titulo}</h3>
          {contador !== undefined && (
            <span className={`text-[12px] font-medium text-muted ${acciones ? "" : "ml-auto"}`}>{contador}</span>
          )}
          {/* Las acciones de la lista van AQUÍ, en su cabecera, no en una barra
              fija debajo: allí ocupaban sitio a todas horas para algo que solo
              se puede hacer mientras editas. */}
          {acciones && <span className="ml-auto flex items-center gap-1.5">{acciones}</span>}
        </div>
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
      <label htmlFor={htmlFor} className="mb-1 block text-[11.5px] font-medium text-muted">{etiqueta}</label>
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
// La ALTURA se queda táctil (44px / 40px en celda): aquí se toca con el dedo.
// Lo que baja es el peso visual (radio, tipografía, grosor) para casar con el
// resto de la gestión.
//
// ⚠️ El ANCHO va aparte por la misma razón que `compacta`: si el `w-full` de
// aquí y un `w-20` de `extra` compiten, gana el que Tailwind ponga después en la
// hoja generada (que es `w-full`), NO el del atributo class. Resultado: un campo
// de código de 4 dígitos ocupando media pantalla y aplastando al de al lado.
// Por eso, si `extra` ya trae un ancho, aquí no se pone ninguno.
export const claseEntrada = (soloLectura?: boolean, extra = "", compacta = false) =>
  `${/\bw-/.test(extra) ? "" : "w-full"} rounded-[5px] border px-2.5 font-medium outline-none transition-colors ${
    compacta ? "min-h-10 text-[13px]" : "min-h-11 text-[13.5px]"
  } ${
    soloLectura
      ? "border-line bg-paper/3 text-muted"
      : "border-line bg-background text-paper focus:border-brand-lit"
  } ${extra}`;

/**
 * SELECT con aspecto propio: el desplegable nativo pega su flecha al borde y
 * descuadra el texto respecto a los inputs. Se apaga (`appearance-none`) y se
 * pinta un chevron con su hueco reservado, para que todos los controles de la
 * ficha queden alineados.
 */
export function Selector({ id, value, onChange, disabled, children, extra = "" }: Readonly<{
  id?: string; value: string | number; onChange: (v: string) => void;
  disabled?: boolean; children: ReactNode; extra?: string;
}>) {
  const clase = claseEntrada(disabled, `appearance-none pr-9 ${extra}`);
  return (
    <div className="relative">
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className={`${clase} ${disabled ? "" : "cursor-pointer"}`}>
        {children}
      </select>
      <ChevronDown size={15} aria-hidden
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${disabled ? "text-muted/50" : "text-muted"}`} />
    </div>
  );
}

/**
 * BUSCADOR de registros (familias, categorías, tarifas…), el patrón de la lupa
 * de Glop. Lo importante no es la búsqueda: es el botón **Nuevo**.
 *
 * Sin él, dar de alta un artículo cuya familia no existe obliga a: cancelar el
 * artículo → ir a Familias → crearla → volver → empezar de cero. Con él, se crea
 * ahí mismo y queda seleccionada al Aceptar. Es la diferencia entre meter una
 * carta de 200 artículos de un tirón o pelearse con la pantalla.
 *
 * Genérico a propósito: la misma ventana vale para cualquier maestro.
 */
export interface RegistroBuscable { id: string; codigo?: string; nombre: string }

export function BuscadorRegistros({
  titulo, registros, seleccionado, onAceptar, onCrear, onCerrar, etiquetaNuevo = "Nueva",
}: Readonly<{
  titulo: string;
  registros: readonly RegistroBuscable[];
  seleccionado?: string;
  onAceptar: (id: string) => void;
  /** Crea el registro y devuelve su id; sin esto, no sale el botón «Nuevo». */
  onCrear?: (nombre: string) => string;
  onCerrar: () => void;
  etiquetaNuevo?: string;
}>) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | undefined>(seleccionado);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nq = norm(q.trim());
  const vistos = nq
    ? registros.filter((r) => norm(`${r.codigo ?? ""} ${r.nombre}`).includes(nq))
    : registros;

  const crear = () => {
    const nombre = nombreNuevo.trim();
    if (!nombre || !onCrear) return;
    const id = onCrear(nombre);
    setSel(id);                    // queda elegida: es lo que venías a hacer
    setCreando(false);
    setNombreNuevo("");
    setQ("");
  };

  const aceptar = () => { if (sel) { onAceptar(sel); onCerrar(); } };

  return (
    <Modal onCerrar={onCerrar} ancho="lg" className="overflow-hidden">
      <BarraVentana titulo={titulo} onCerrar={onCerrar} />

      {/* `data-sin-teclado`: aquí el teclado NO sale solo aunque el auto-teclado esté
          activo — tapaba la lista justo al abrir la ventana. Sale con el botón. */}
      <div data-sin-teclado className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
              className={claseEntrada(false, "w-full pl-9")} />
          </div>
          {/* `preventDefault` en mousedown: sin esto el botón roba el foco al input
              y el teclado se abriría sin saber dónde escribir. */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={abrirTeclado}
            className="flex min-h-11 flex-none items-center gap-2 rounded-[5px] border border-line px-3 text-[13px] font-medium text-muted transition-transform active:scale-95">
            <Keyboard size={15} /> Teclado
          </button>
        </div>

        {creando && (
          <div className="flex gap-2 rounded-[5px] border border-brand-lit/40 bg-accent-soft p-2">
            <input autoFocus value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
              placeholder={`Nombre de la ${etiquetaNuevo.toLowerCase()}`}
              className={claseEntrada(false, "min-w-0 flex-1")} />
            <button type="button" onClick={crear} disabled={!nombreNuevo.trim()}
              className="min-h-11 flex-none rounded-[5px] bg-brand px-4 text-[13px] font-semibold text-white transition-transform active:scale-95 disabled:opacity-40">
              Crear
            </button>
            <button type="button" onClick={() => { setCreando(false); setNombreNuevo(""); }}
              className="min-h-11 flex-none rounded-[5px] border border-line px-3 text-[13px] font-medium text-muted transition-transform active:scale-95">
              Cancelar
            </button>
          </div>
        )}

        <Desplazable fuera="max-h-[46vh] min-h-40 rounded-[5px] border border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                <th className="w-24">Código</th><th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {vistos.map((r, i) => (
                <tr key={r.id} onClick={() => setSel(r.id)} onDoubleClick={() => { onAceptar(r.id); onCerrar(); }}
                  className={`cursor-pointer border-b border-line ${r.id === sel ? "bg-accent-soft" : ""}`}>
                  <td className="px-3 py-2.5 font-mono text-[12.5px] text-muted">{r.codigo ?? i + 1}</td>
                  <td className="px-3 py-2.5 text-[13px] font-medium">{r.nombre}</td>
                </tr>
              ))}
              {vistos.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-8 text-center text-[13px] text-muted">
                  {q ? `Nada que se llame «${q.trim()}».` : "No hay registros."}
                </td></tr>
              )}
            </tbody>
          </table>
        </Desplazable>
      </div>

      <footer className="flex flex-none items-center gap-2 border-t border-line px-4 py-3">
        {onCrear && !creando && (
          <button type="button" onClick={() => { setCreando(true); setNombreNuevo(q.trim()); }}
            className="flex min-h-11 items-center gap-1.5 rounded-[5px] border border-line bg-panel px-3.5 text-[13px] font-medium text-paper/85 transition-transform active:scale-95">
            <PlusCircle size={16} /> {etiquetaNuevo}
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onCerrar}
          className="min-h-11 rounded-[5px] border border-line px-4 text-[13px] font-medium text-muted transition-transform active:scale-95">
          Cancelar
        </button>
        <button type="button" onClick={aceptar} disabled={!sel}
          className="min-h-11 rounded-[5px] bg-brand px-5 text-[13px] font-semibold text-white transition-transform active:scale-95 disabled:opacity-40">
          Aceptar
        </button>
      </footer>
    </Modal>
  );
}

/** Botón de la barra inferior: icono grande arriba, rótulo debajo. */
export function BotonPie({ Icono, children, tono = "marca", onClick, disabled }: Readonly<{
  Icono: LucideIcon; children: ReactNode;
  tono?: "marca" | "ok" | "no" | "neutro";
  onClick?: () => void; disabled?: boolean;
}>) {
  const color = { marca: "text-brand-lit", ok: "text-mint", no: "text-danger", neutro: "text-muted" }[tono];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex min-h-15 min-w-17.5 flex-col items-center justify-center gap-1 rounded-[6px] px-2 py-1.5 text-[11px] font-medium text-paper/80 transition-transform active:scale-95 disabled:opacity-35">
      <Icono size={19} strokeWidth={2} className={disabled ? "text-muted" : color} />
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
    <span className={`flex items-center gap-2 rounded-[5px] border px-3 py-1.5 text-[12px] font-medium ${
      editando ? "border-amber/40 bg-amber/10 text-paper" : "border-line bg-paper/3 text-muted"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${editando ? "bg-amber" : "bg-muted"}`} />
      {children}
    </span>
  );
}
