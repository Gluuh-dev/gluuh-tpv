import { Download, Printer, Search, X } from "lucide-react";
import { descargarCSV, imprimirInforme, type ColumnaInforme } from "../lib/exportar";

// Barra que convierte cualquier tabla del Análisis en un INFORME: buscador +
// «CSV» (para el Excel del gestor) e «Imprimir» (de ahí sale el PDF con «Guardar
// como PDF»). Se le pasan las MISMAS columnas que pinta la tabla, así lo que se
// descarga es exactamente lo que se ve — no una versión paralela que se desfasa.
export function BarraInforme<T>({
  titulo, columnas, filas, busqueda, onBusqueda, periodo, local, totales, extra,
}: Readonly<{
  titulo: string;
  columnas: ColumnaInforme<T>[];
  /** Las filas YA filtradas: se exporta lo que el usuario está viendo. */
  filas: T[];
  busqueda?: string;
  onBusqueda?: (v: string) => void;
  periodo?: string;
  local?: string;
  totales?: { etiqueta: string; valor: string }[];
  extra?: React.ReactNode;
}>) {
  const vacio = filas.length === 0;
  const btn = "flex items-center gap-1.5 rounded-md border border-line bg-paper/5 px-3 py-1.5 text-[12px] font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
      {onBusqueda && (
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
          <Search size={14} className="absolute left-2.5 text-muted" />
          <input
            value={busqueda ?? ""}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar…"
            aria-label={`Buscar en ${titulo}`}
            className="h-9 w-full rounded-md border border-line bg-paper/5 pl-8 pr-8 text-[12.5px] text-paper outline-none placeholder:text-muted focus:border-brand"
          />
          {busqueda && (
            <button type="button" onClick={() => onBusqueda("")} aria-label="Limpiar búsqueda"
              className="absolute right-2 text-muted transition-transform active:scale-90"><X size={14} /></button>
          )}
        </label>
      )}

      {extra}

      <span className="ml-auto text-[11.5px] tabular-nums text-muted">
        {filas.length} {filas.length === 1 ? "fila" : "filas"}
      </span>

      <button type="button" disabled={vacio} className={btn}
        onClick={() => descargarCSV(titulo, columnas, filas)}
        title="Descargar en CSV (se abre en Excel)">
        <Download size={14} /> CSV
      </button>
      <button type="button" disabled={vacio} className={btn}
        onClick={() => imprimirInforme(titulo, columnas, filas, { periodo, local, totales })}
        title="Imprimir — desde el diálogo se puede «Guardar como PDF»">
        <Printer size={14} /> Imprimir / PDF
      </button>
    </div>
  );
}
