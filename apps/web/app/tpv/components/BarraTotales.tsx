"use client";

// Banda de totales del ticket (estilo Glop): UDS · PRECIO/DTO · ARTÍCULOS · TOTAL.
// Los números NO reflejan lo que se teclea: muestran el valor confirmado y solo
// cambian cuando la edición se aplica. Al editar, SOLO el número del campo activo
// se pinta en cian (marca); las etiquetas quedan neutras. Encima, el mensaje "Editando…".
// Desde el plan 011 lee buffer/modo/editando DIRECTAMENTE de useTpvStore (no por
// props): así teclear re-renderiza solo esta banda, no la página entera.
import { memo } from "react";
import { useTpvStore } from "../hooks/useTpvStore";

export interface BarraTotalesProps {
  /** Hay una línea seleccionada (editando su valor) vs. armando cantidad para un producto. */
  hayLinea: boolean;
  /** Uds de la línea seleccionada (0 si no hay). */
  udsLinea: number;
  /** Precio efectivo de la línea seleccionada (0 si no hay). */
  precioLinea: number;
  /** Unidades totales del ticket. */
  unidades: number;
  total: number;
  eur: (n: number) => string;
  /** Nombre de la línea seleccionada, para el mensaje "Editando…". */
  nombreLineaSel?: string | null;
}

export const BarraTotales = memo(function BarraTotales({ hayLinea, udsLinea, precioLinea, unidades, total, eur, nombreLineaSel }: BarraTotalesProps) {
  const modo = useTpvStore((s) => s.modo);
  const editando = useTpvStore((s) => s.editando);
  const buffer = useTpvStore((s) => s.buffer);
  const enPrecio = modo === "PREC" || modo === "DTO%" || modo === "DTO€";
  const labelPrecio = modo === "DTO%" ? "Dto %" : modo === "DTO€" ? "Dto €" : "Precio";
  const udsActivo = editando && modo === "UND";
  const precActivo = editando && enPrecio;
  // Al armar cantidad SIN línea (para añadir producto), UDS muestra lo tecleado;
  // editando una línea, muestra el valor confirmado (no cambia hasta aplicar).
  const udsMostrar = editando && !hayLinea && modo === "UND" ? (buffer || "0") : udsLinea;
  // Edición inline en curso (Glop): "Editando <tipo> de «<nombre>» — teclea y pulsa <label>".
  const edicion = editando && hayLinea
    ? {
        tipo: modo === "UND" ? "unidades" : modo === "PREC" ? "precio" : modo === "DTO%" ? "descuento %" : "descuento €",
        nombre: nombreLineaSel ?? "",
        label: modo === "UND" ? "Und." : modo === "PREC" ? "Precio" : modo === "DTO%" ? "DTO%" : "DTO€",
      }
    : null;
  return (
    <>
      {/* Mensaje de edición: la palabra del modo en BLANCO y el resto en cian (marca). */}
      {edicion && (
        <div className="flex-none border-t border-border bg-brand/10 px-3 py-1 text-[11px] font-medium leading-tight text-brand">
          Editando <b className="text-white">{edicion.tipo}</b> de «{edicion.nombre}» — teclea y pulsa {edicion.label}.
        </div>
      )}
      {/* Totales: banda a todo el ancho con línea divisoria. Etiquetas neutras; solo el número se pinta. */}
      <div className="flex items-center gap-3 border-t border-border px-3 py-2">
        <div className="text-center leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Uds.</div>
          <div className={`text-sm font-bold tabular-nums ${udsActivo ? "text-brand" : "text-foreground"}`}>{udsMostrar}</div>
        </div>
        <div className="text-center leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{labelPrecio}</div>
          <div className={`text-sm font-bold tabular-nums ${precActivo ? "text-brand" : "text-foreground"}`}>{eur(precioLinea)}</div>
        </div>
        <div className="text-center leading-tight">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Artículos</div>
          <div className="text-sm font-bold tabular-nums">{unidades}</div>
        </div>
        <div className="ml-auto text-right leading-none">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-3xl font-bold tabular-nums text-foreground">{eur(total)}</div>
        </div>
      </div>
    </>
  );
});
