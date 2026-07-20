import { useEffect, useRef, useState, type ReactNode } from "react";

// Modal BASE reutilizable de la operativa: velo con desenfoque, aparición CENTRADA
// (fundido + escala desde el centro), cierre con Esc y clic fuera. Todos los
// modales del TPV (credencial, ayuda, cobro…) se montan sobre este.
// Reglas del TPV: sin hover, sombras mínimas.
//
// ARRASTRABLE: se coge por la cabecera (cualquier elemento con `data-arrastrar`,
// que es lo que marca `CabeceraModal`) y se mueve. Hace falta de verdad: con el
// teclado en pantalla abierto, el modal tapa justo lo que estás escribiendo, y
// en un terminal táctil no hay forma de apartarlo.
const ANCHOS = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-[560px]", "2xl": "max-w-3xl", "3xl": "max-w-5xl", "4xl": "max-w-6xl", "5xl": "max-w-[1240px]" } as const;

export function Modal({
  children, onCerrar, ancho = "sm", className = "", cerrarFuera = true, arrastrable = true,
}: Readonly<{
  children: ReactNode;
  onCerrar: () => void;
  ancho?: keyof typeof ANCHOS;
  className?: string;
  cerrarFuera?: boolean;
  arrastrable?: boolean;
}>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  // Geometría de la ventana SIN desplazar, medida al empezar a arrastrar: con
  // ella se calculan los topes para que no se pueda tirar fuera de la pantalla.
  const base = useRef<{ left: number; top: number; w: number; h: number } | null>(null);

  // Esc en CAPTURA y cortando el evento: si no, el Esc global de App.tsx (que
  // manda a Inicio) también se dispara y cerrar un modal te echaba además de la
  // pantalla. El modal se come su propio Esc; lo de detrás no se entera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCerrar();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCerrar]);

  const empezarArrastre = (e: React.PointerEvent) => {
    if (!arrastrable) return;
    const t = e.target as HTMLElement;
    const cabecera = t.closest("[data-arrastrar]");
    if (!cabecera) return;                       // solo se coge por la cabecera
    // OJO: el velo de fuera ES un <button>, así que `closest("button")` a secas
    // SIEMPRE encontraba algo y el arrastre no arrancaba nunca. Solo cuenta el
    // control si está DENTRO de la cabecera (la X).
    const control = t.closest("button, input, select, textarea, a");
    if (control && cabecera.contains(control)) return;
    origen.current = { x: e.clientX - (pos?.x ?? 0), y: e.clientY - (pos?.y ?? 0) };

    const r = caja.current?.getBoundingClientRect();
    base.current = r
      ? { left: r.left - (pos?.x ?? 0), top: r.top - (pos?.y ?? 0), w: r.width, h: r.height }
      : null;

    const mover = (ev: PointerEvent) => {
      if (!origen.current) return;
      let x = ev.clientX - origen.current.x;
      let y = ev.clientY - origen.current.y;
      // Como una ventana de escritorio: se mueve libre, pero SIEMPRE queda un
      // asa visible. Si no, se arrastra fuera y no hay forma de recuperarla.
      const b = base.current;
      if (b) {
        const VISIBLE = 120;                       // ancho mínimo que queda a la vista
        x = Math.max(VISIBLE - b.left - b.w, Math.min(window.innerWidth - VISIBLE - b.left, x));
        y = Math.max(8 - b.top, Math.min(window.innerHeight - 56 - b.top, y));
      }
      setPos({ x, y });
    };
    const soltar = () => {
      origen.current = null;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  return (
    <button
      type="button"
      aria-label="Cerrar"
      className="gl-velo fixed inset-0 z-50 grid cursor-default place-items-center bg-black/25 p-4 backdrop-blur-[1.5px]"
      onClick={cerrarFuera ? onCerrar : undefined}
    >
      {/*
        `text-left` NO es decorativo: el velo de arriba es un <button>, y los
        botones traen `text-align:center` del navegador, y eso se HEREDA hacia
        dentro. Sin esto, cualquier celda o texto sin alineación propia sale
        centrado (se veía en las tablas de los buscadores).
      */}
      <div
        ref={caja}
        style={pos ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        className={`gl-aparecer w-full text-left ${ANCHOS[ancho]} rounded-md bg-panel text-paper shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={empezarArrastre}
      >
        {children}
      </div>
    </button>
  );
}
