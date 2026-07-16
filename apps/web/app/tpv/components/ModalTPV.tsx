"use client";

// Modal REUTILIZABLE del TPV (estilo mockups docs/diseño): cabecera morada con logo +
// título + X, ARRASTRABLE por la cabecera y REDIMENSIONABLE por la esquina inferior
// (sizer propio). El fondo apenas oscurece, para seguir viendo el ticket detrás.
// Un clic fuera cierra. Sigue el tema (claro/oscuro) por tokens.
import { useCallback, useRef, useState, type ReactNode } from "react";

export interface ModalTPVProps {
  titulo: string;
  subtitulo?: string;
  /** Contenido opcional a la derecha de la cabecera (p. ej. el TOTAL en el cobro). */
  derecha?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Tamaño inicial (px). Se puede redimensionar luego con el sizer. */
  ancho?: number;
  alto?: number;
  /** Si el clic en el fondo cierra el modal. Por defecto NO (evita cerrar sin querer un
   *  formulario a medias): solo cierran la X o los botones del propio modal. */
  cerrarAlTocarFondo?: boolean;
}

export function ModalTPV({ titulo, subtitulo, derecha, onClose, children, ancho = 760, alto = 560, cerrarAlTocarFondo = false }: Readonly<ModalTPVProps>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);   // null = centrado
  const [size, setSize] = useState<{ w: number; h: number }>({ w: ancho, h: alto });
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(size.w, vw - 16);
  const h = Math.min(size.h, vh - 16);
  const left = pos?.x ?? Math.max(8, (vw - w) / 2);
  const top = pos?.y ?? Math.max(8, (vh - h) / 2);

  // ── Arrastre por la cabecera ──
  const onDragDown = (e: React.PointerEvent) => {
    arrastre.current = { dx: e.clientX - left, dy: e.clientY - top };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!arrastre.current) return;
    const x = Math.max(0, Math.min(vw - 80, e.clientX - arrastre.current.dx));
    const y = Math.max(0, Math.min(vh - 40, e.clientY - arrastre.current.dy));
    setPos({ x, y });
  };
  const onDragUp = () => { arrastre.current = null; };

  // ── Redimensionar por la esquina inferior derecha ──
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    resize.current = { x: e.clientX, y: e.clientY, w, h };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resize.current) return;
    const nw = Math.max(360, Math.min(vw - 16, resize.current.w + (e.clientX - resize.current.x)));
    const nh = Math.max(280, Math.min(vh - 16, resize.current.h + (e.clientY - resize.current.y)));
    setSize({ w: nw, h: nh });
  };
  const onResizeUp = () => { resize.current = null; };

  const stop = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    // Fondo casi transparente: se sigue viendo el ticket detrás. Por defecto NO cierra al
    // tocarlo (solo la X): así no se pierde un formulario a medias.
    <div className="fixed inset-0 z-50 bg-black/5" onClick={cerrarAlTocarFondo ? onClose : undefined}>
      <div
        onClick={cerrarAlTocarFondo ? stop : undefined}
        style={{ left, top, width: w, height: h }}
        className="absolute flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
      >
        {/* Cabecera morada: logo + título (arrastrable) + derecha + X */}
        <header
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
          className="flex h-13 flex-none cursor-move touch-none select-none items-center gap-3 bg-brand px-3 text-brand-foreground"
          style={{ height: 52 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gluuh-monocolor.svg" alt="" aria-hidden className="h-6 w-auto flex-none" />
          <div className="min-w-0 leading-tight">
            <h2 className="truncate text-[17px] font-extrabold">{titulo}</h2>
            {subtitulo && <div className="truncate text-[11px] font-semibold text-white/70">{subtitulo}</div>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {derecha}
            <button type="button" onClick={onClose} aria-label="Cerrar"
              onPointerDown={(e) => e.stopPropagation()}
              className="grid h-9 w-9 flex-none place-items-center rounded-md border border-white/30 text-lg leading-none hover:bg-white/15">✕</button>
          </div>
        </header>

        {/* Cuerpo */}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>

        {/* Sizer (esquina inferior derecha) */}
        <div
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
          aria-hidden
          title="Redimensionar"
        >
          <svg viewBox="0 0 10 10" className="absolute bottom-1 right-1 h-2.5 w-2.5 text-muted-foreground">
            <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
