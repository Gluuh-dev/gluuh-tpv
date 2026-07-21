import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

// ============================================================================
// FLECHAS PARA MOVERSE POR UNA LISTA — en esta app no hay barras de scroll
// (ver `index.css`: se quitan globalmente). Un TPV se maneja con el dedo sobre
// un cristal y una barra de 8 px no se agarra con el pulgar.
//
// Las flechas SOLO salen si hay algo a donde ir, y cada una se apaga al llegar
// a su extremo. Una flecha que no hace nada al pulsarla es peor que ninguna:
// la primera vez confunde y a partir de ahí no te fías de las que sí funcionan.
// ============================================================================

interface Estado { antes: boolean; despues: boolean }

/**
 * Vigila un contenedor y dice si se puede subir/bajar (o ir a los lados).
 *
 * Mira el TAMAÑO y el CONTENIDO, no solo el scroll: una lista filtrada pasa de
 * 200 filas a 3 sin que nadie haga scroll, y las flechas tienen que apagarse.
 */
function useDesplazamiento(ref: RefObject<HTMLElement | null>, eje: "y" | "x"): Estado {
  const [estado, setEstado] = useState<Estado>({ antes: false, despues: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const medir = () => {
      const pos = eje === "y" ? el.scrollTop : el.scrollLeft;
      const total = eje === "y" ? el.scrollHeight : el.scrollWidth;
      const visible = eje === "y" ? el.clientHeight : el.clientWidth;
      setEstado({
        antes: pos > 1,
        // El margen de 1 px no es capricho: con zoom del navegador o pantallas
        // a 1.5x, `scrollHeight` y `clientHeight` se quedan en 0,4 px de
        // diferencia y la flecha de bajar se quedaba encendida para siempre.
        despues: pos + visible < total - 1,
      });
    };

    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    ro?.observe(el);
    // Observa también a los hijos: cambia el contenido (una búsqueda, una fila
    // nueva) sin que cambie el tamaño del contenedor.
    for (const hijo of Array.from(el.children)) ro?.observe(hijo);

    return () => {
      el.removeEventListener("scroll", medir);
      ro?.disconnect();
    };
  }, [ref, eje]);

  return estado;
}

/**
 * Flechas sueltas, para ponerlas en una cabecera o una banda (como en la
 * botonera del TPV). Si no hay a dónde ir, no ocupan sitio.
 */
export function Flechas({ contenedor, eje = "y", paso = 180, className = "" }: Readonly<{
  contenedor: RefObject<HTMLElement | null>;
  eje?: "y" | "x";
  paso?: number;
  className?: string;
}>) {
  const { antes, despues } = useDesplazamiento(contenedor, eje);
  if (!antes && !despues) return null;

  const mover = (dir: -1 | 1) =>
    contenedor.current?.scrollBy(
      eje === "y" ? { top: dir * paso, behavior: "smooth" } : { left: dir * paso, behavior: "smooth" },
    );

  const Antes = eje === "y" ? ChevronUp : ChevronLeft;
  const Despues = eje === "y" ? ChevronDown : ChevronRight;
  const clase = "grid h-9 w-9 flex-none place-items-center rounded-[6px] border border-line bg-panel text-paper/80 transition-transform active:scale-90 disabled:opacity-25";

  return (
    <span className={`flex flex-none gap-1 ${className}`}>
      <button type="button" onClick={() => mover(-1)} disabled={!antes}
        aria-label={eje === "y" ? "Subir" : "Izquierda"} className={clase}>
        <Antes size={17} />
      </button>
      <button type="button" onClick={() => mover(1)} disabled={!despues}
        aria-label={eje === "y" ? "Bajar" : "Derecha"} className={clase}>
        <Despues size={17} />
      </button>
    </span>
  );
}

/**
 * Lista desplazable con sus flechas FLOTANDO encima, abajo a la derecha.
 *
 * Para listas que no tienen una cabecera donde colgarlas (tablas, rejillas de
 * un modal). `fuera` son las clases de colocación del hueco (`min-h-0 flex-1`…)
 * y `className` las del contenido — van separadas porque el que scrollea y el
 * que se estira son dos cajas distintas.
 */
export function Desplazable({ children, fuera = "min-h-0 flex-1", className = "", eje = "y", paso = 200, estilo, pie }: Readonly<{
  children: React.ReactNode;
  fuera?: string;
  className?: string;
  /** «ambos» para tablas: se van por abajo Y por el lado. */
  eje?: "y" | "x" | "ambos";
  paso?: number;
  /** Estilo del área que se mueve (el suelo del plano lleva su textura ahí). */
  estilo?: React.CSSProperties;
  /**
   * Si se pasa, las flechas NO flotan encima: van en un PIE de la tabla, con este
   * contenido a la izquierda (el conteo de filas) y las flechas —verticales y
   * laterales— a la derecha. Es el patrón de las listas de configuración.
   */
  pie?: React.ReactNode;
}>) {
  const ref = useRef<HTMLDivElement>(null);
  const sombra = "drop-shadow-[0_2px_6px_rgba(0,0,0,.35)]";
  return (
    // `flex flex-col` + `min-h-0 flex-1` dentro, y NO `h-full`: con un tope de
    // altura relativo (`max-h-[70vh]`) el padre no tiene alto definido, así que
    // `h-full` no resuelve, el hijo crece hasta el contenido y la lista se
    // pintaba POR FUERA del modal —encima del pie— en vez de desplazarse.
    // El `overflow-hidden` es el cinturón: aunque algún hijo se pase, se corta
    // aquí y no encima de lo de al lado.
    <div className={`relative flex flex-col overflow-hidden ${fuera}`}>
      <div ref={ref} style={estilo} className={`min-h-0 flex-1 overflow-auto ${className}`}>{children}</div>
      {pie !== undefined ? (
        // Pie de la tabla: conteo a la izquierda, flechas a la derecha (no flotan).
        <div className="flex flex-none items-center gap-3 border-t border-line px-3 py-1.5">
          {pie}
          <span className="flex-1" />
          {eje !== "y" && <Flechas contenedor={ref} eje="x" paso={paso} />}
          {eje !== "x" && <Flechas contenedor={ref} eje="y" paso={paso} />}
        </div>
      ) : (
        // `pointer-events-none` en el hueco y `auto` en los botones: si no, la
        // esquina entera dejaba de recibir toques sobre la lista de debajo.
        <span className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1 *:pointer-events-auto">
          {/* En «ambos» cada pareja se apaga sola si su eje no desborda, así que una
              tabla que solo se va a lo ancho no enseña flechas de subir y bajar. */}
          {eje !== "y" && <Flechas contenedor={ref} eje="x" paso={paso} className={sombra} />}
          {eje !== "x" && <Flechas contenedor={ref} eje="y" paso={paso} className={sombra} />}
        </span>
      )}
    </div>
  );
}
