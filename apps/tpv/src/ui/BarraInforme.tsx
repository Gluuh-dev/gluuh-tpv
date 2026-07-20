import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Printer, Search, X } from "lucide-react";
import { descargarCSV, imprimirInforme, type ColumnaInforme } from "../lib/exportar";

// Barra que convierte cualquier tabla del Análisis en un INFORME: buscador +
// «Descargar», que abre un popup para elegir formato (hay más de uno: CSV para el
// Excel del gestor, PDF por el diálogo de impresión). Se le pasan las MISMAS
// columnas que pinta la tabla, así lo que se descarga es exactamente lo que se ve
// — no una versión paralela que se desfasa.
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
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const vacio = filas.length === 0;

  // Cerrar al tocar fuera o con Escape (si no, el popup se queda colgado sobre la tabla).
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);

  const opcion = "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] text-paper transition-colors active:bg-brand/15";

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

      <div ref={caja} className="relative">
        <button type="button" disabled={vacio} onClick={() => setAbierto((v) => !v)}
          aria-haspopup="menu" aria-expanded={abierto}
          className="flex items-center gap-1.5 rounded-md border border-line bg-paper/5 px-3 py-1.5 text-[12px] font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40">
          <Download size={14} /> Descargar
        </button>

        {abierto && (
          <div role="menu"
            className="gl-aparecer absolute right-0 top-[calc(100%+4px)] z-30 w-56 overflow-hidden rounded-md border border-line bg-panel shadow-xl">
            <button type="button" role="menuitem" className={opcion}
              onClick={() => { setAbierto(false); descargarCSV(titulo, columnas, filas); }}>
              <FileSpreadsheet size={16} className="flex-none text-mint" />
              <span className="min-w-0">
                <b className="block font-semibold">CSV</b>
                <small className="block text-[11px] text-muted">Se abre en Excel</small>
              </span>
            </button>
            <button type="button" role="menuitem" className={`${opcion} border-t border-line`}
              onClick={() => { setAbierto(false); imprimirInforme(titulo, columnas, filas, { periodo, local, totales }); }}>
              <Printer size={16} className="flex-none text-brand-lit" />
              <span className="min-w-0">
                <b className="block font-semibold">PDF o impresora</b>
                <small className="block text-[11px] text-muted">Elige «Guardar como PDF»</small>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
