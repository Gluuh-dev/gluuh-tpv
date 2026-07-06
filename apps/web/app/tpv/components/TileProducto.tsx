"use client";

// Tile de producto del grid de venta (estilo Glop). Dos variantes según haya foto:
// con foto (imagen de fondo + degradado, nombre/precio blancos) o sin foto (color
// de la familia + nombre centrado). Badge "86" cuando está agotado. Presentacional
// puro: recibe datos + callbacks (incluido el long-press) desde el grid de page.tsx.
// Extraído de app/tpv/page.tsx (guía docs/implementacion/02-refactor-tpv.md).

export interface TileProductoProps {
  nombre: string;
  precio: number;
  agotado: boolean;
  /** URL de foto; si no hay, se pinta la variante de color. */
  foto?: string;
  /** Color de la familia (variante sin foto). */
  color: string;
  mostrarPrecio: boolean;
  /** Clase Tailwind del tamaño de texto del nombre (S/M/L → text-[10px]/text-xs/text-sm). */
  txtClase: string;
  eur: (n: number) => string;
  onClick: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
}

export function TileProducto({ nombre, precio, agotado, foto, color, mostrarPrecio, txtClase, eur, onClick, onPressStart, onPressEnd }: TileProductoProps) {
  const press = {
    onClick,
    onPointerDown: onPressStart,
    onPointerUp: onPressEnd,
    onPointerLeave: onPressEnd,
  };
  return foto ? (
    // Con foto: imagen de fondo + degradado oscuro abajo, nombre/precio blancos con sombra.
    <button type="button" {...press}
      className={`relative flex min-h-[78px] overflow-hidden rounded-[9px] border border-border bg-cover bg-center shadow-[0_2px_0_rgba(0,0,0,.28)] transition-transform active:translate-y-px active:scale-100 ${agotado ? "grayscale" : ""}`}
      style={{ backgroundImage: `url("${foto}")` }}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {agotado && <div className="absolute inset-x-0 top-0 bg-rose-600/90 text-center text-[8px] font-bold text-white">86</div>}
      <div className="absolute inset-x-0 bottom-0 px-1 py-1 text-center leading-tight">
        <div className={`line-clamp-2 ${txtClase} font-bold uppercase text-white [text-shadow:0_1px_3px_rgba(0,0,0,.85)]`}>{nombre}</div>
        {mostrarPrecio && <div className="text-[10px] font-semibold text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,.85)]">{eur(precio)}</div>}
      </div>
    </button>
  ) : (
    // Sin foto: color de la familia + nombre centrado (y precio opcional).
    <button type="button" {...press}
      className={`relative flex min-h-[78px] flex-col items-center justify-center overflow-hidden rounded-[9px] px-1 text-center shadow-[0_2px_0_rgba(0,0,0,.28)] transition-transform active:translate-y-px active:scale-100 ${agotado ? "opacity-50" : "hover:brightness-95"}`}
      style={{ background: agotado ? "#6b7280" : color || "#64748b", color: "#fff" }}>
      {agotado && <span className="absolute right-0.5 top-0.5 rounded bg-rose-700 px-1 text-[7px] font-bold text-white">86</span>}
      <span className={`line-clamp-4 ${txtClase} font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.25)]`}>{nombre}</span>
      {mostrarPrecio && <span className="mt-0.5 text-[9px] font-semibold text-white/90">{eur(precio)}</span>}
    </button>
  );
}
