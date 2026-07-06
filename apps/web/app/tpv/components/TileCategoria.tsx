"use client";

// Tile de categoría del grid de venta (estilo Glop). Tres variantes: icono lucide,
// foto de fondo, o solo texto. Check de seleccionada arriba a la derecha.
// Presentacional puro: recibe datos + onClick desde el grid de page.tsx.
// Extraído de app/tpv/page.tsx (guía docs/implementacion/02-refactor-tpv.md).
import { IconCircleCheckFilled } from "@tabler/icons-react";
import type { LucideIcon } from "lucide-react";

export interface TileCategoriaProps {
  nombre: string;
  color: string;
  seleccionada: boolean;
  /** Icono lucide por nombre (category.icono); si no hay, cae a foto/texto. */
  Icono?: LucideIcon;
  /** Foto de la categoría (solo si no hay icono). */
  foto?: string;
  onClick: () => void;
}

export function TileCategoria({ nombre, color, seleccionada, Icono, foto, onClick }: TileCategoriaProps) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex min-h-[76px] overflow-hidden rounded-[9px] shadow-[0_2px_0_rgba(0,0,0,.22)] transition-transform active:translate-y-px active:scale-100 ${seleccionada ? "ring-2 ring-inset ring-white/95" : "hover:brightness-95"}`}
      style={{ background: color }}>
      {seleccionada && <IconCircleCheckFilled size={18} className="absolute right-0.5 top-0.5 z-20 text-white drop-shadow" />}
      {Icono ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-white">
          <Icono size={26} strokeWidth={1.75} className="drop-shadow" />
          <span className="line-clamp-2 text-[11px] font-bold uppercase leading-tight">{nombre}</span>
        </span>
      ) : foto ? (<>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-background/95 px-0.5 py-0.5 text-center text-[11px] font-bold uppercase leading-tight text-foreground">{nombre}</span>
      </>) : (
        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-bold uppercase leading-tight text-white line-clamp-3">{nombre}</span>
      )}
    </button>
  );
}
