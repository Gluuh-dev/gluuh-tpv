"use client";

// Botón de acción del TPV (estilo `.act` del mockup): icono arriba + etiqueta,
// relleno panel-2 con borde línea; variante cian (accent-soft + borde accent-d)
// para activo/favorito; badge verde opcional. Altura fija 56px.
// Reutilizable en el rail VERTICAL (ancho = w-full del contenedor) y en la fila
// HORIZONTAL de acciones de línea (flex-1). El ancho lo fija quien lo usa
// vía `className`. Presentacional puro: datos por props, acción por callback.
import type { LucideIcon } from "lucide-react";

export interface BotonAccionTPVProps {
  icon: LucideIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  /** Estado seleccionado/activo (p. ej. Cons. propio activo, Invitar con invitadas). */
  activo?: boolean;
  /** Resaltado permanente como favorito (Aparcar / Marchar). */
  favorito?: boolean;
  badge?: number;
  /** Tono del botón: "accion" (fondo panel-2, texto/filo gris) o "utilidad"
   *  (gris del teclado: fondo muted). Por defecto "accion". */
  tono?: "accion" | "utilidad";
  /** Ancho del botón: "w-full" en el rail vertical, "flex-1" en la fila horizontal. */
  className?: string;
}

export function BotonAccionTPV({ icon: Icon, label, onClick, disabled, activo, favorito, badge, tono = "accion", className }: BotonAccionTPVProps) {
  // Estados de color. Los hexes exactos del cliente van con variante dark: explícita
  // (fondo #1D222B / texto+filo #6F7987 en oscuro; blanco / #60646C en claro) para
  // garantizar que el fondo se pinta en ambos modos.
  const estilo =
    activo || favorito
      ? "border-[#0e8fa2] bg-accent-soft text-brand hover:brightness-95"
      : tono === "utilidad"
        ? "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
        : "border-border bg-white text-[#60646c] hover:bg-surface-overlay hover:text-foreground active:bg-surface-muted dark:bg-[#1d222b] dark:text-[#6f7987]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-[56px] select-none flex-col items-center justify-center gap-[.3rem] rounded-[7px] border px-1 text-center leading-[1.15] transition active:scale-[.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${estilo} ${className ?? ""}`}
    >
      <Icon size={19} strokeWidth={1.75} />
      <span className="text-[.62rem] font-medium leading-[1.15]">{label}</span>
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#2ea06a] px-1 text-[9px] font-bold text-[#03210f] shadow ring-2 ring-card">{badge}</span>
      ) : null}
    </button>
  );
}
