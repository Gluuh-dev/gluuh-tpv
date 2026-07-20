import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Download, FileSpreadsheet, Printer, Search, X } from "lucide-react";
import { descargarCSV, imprimirInforme, alaDerecha, type ColumnaInforme } from "../lib/exportar";
import { RC } from "./ShellApartado";
import { eur } from "../lib/dinero";

// TABLA del Análisis: una sola pieza con su cabecera (título, buscador, contador
// y descarga), ordenación por columna, paginación y fila de totales.
//
// Por qué existe: antes cada tabla declaraba sus columnas DOS VECES — una para el
// CSV/PDF y otra en el JSX de los `<td>`. Dos listas que hay que acordarse de
// cambiar a la vez son dos listas que acaban diciendo cosas distintas, y en un
// informe eso no se ve: sale un PDF al que le falta una columna y nadie se entera.
// Aquí la columna se declara una vez y de ahí salen la celda, el orden, la
// búsqueda, el total y la exportación.

export interface ColumnaTabla<T> extends ColumnaInforme<T> {
  /** Pintado rico (chips, colores, iconos). Lo que se exporta sigue siendo `valor`. */
  celda?: (fila: T) => ReactNode;
  /** Total de la columna, si lo tiene. Con uno basta para que salga el pie. */
  total?: (filas: readonly T[]) => string | number | null;
  ordenable?: boolean;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Nulos SIEMPRE al final: un hueco no es «lo más pequeño», es que no se sabe. */
function comparar(a: string | number | null, b: string | number | null): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
}

export function ordenar<T>(filas: readonly T[], col: ColumnaTabla<T>, desc: boolean): T[] {
  return [...filas].sort((f1, f2) => {
    const a = col.valor(f1), b = col.valor(f2);
    if (a == null || b == null) return (a == null ? 1 : 0) - (b == null ? 1 : 0);
    return desc ? -comparar(a, b) : comparar(a, b);
  });
}

/** Busca en TODAS las columnas, sin acentos: «cana» encuentra «Caña». */
export function buscar<T>(filas: readonly T[], columnas: readonly ColumnaTabla<T>[], q: string): T[] {
  const t = sinAcentos(q.trim());
  if (!t) return [...filas];
  return filas.filter((f) => columnas.some((c) => sinAcentos(String(c.valor(f) ?? "")).includes(t)));
}

const TH = "px-3 py-2 text-[11px] font-semibold uppercase tracking-[.04em] text-muted";
const TD = "px-3 py-2 text-[12.5px]";

export function Tabla<T>({
  titulo, columnas, filas, clave, porPagina = 25, ordenPor, descPorDefecto = true,
  acciones, periodo, local, vacio = "No hay nada que enseñar aquí todavía.", nota, sinBuscador,
}: Readonly<{
  titulo: string;
  columnas: readonly ColumnaTabla<T>[];
  filas: readonly T[];
  clave: (fila: T) => string;
  /** 0 = sin paginar. Con menos filas que una página, el paginador no aparece. */
  porPagina?: number;
  /** Título de la columna por la que se ordena de entrada. */
  ordenPor?: string;
  descPorDefecto?: boolean;
  acciones?: ReactNode;
  periodo?: string;
  local?: string;
  vacio?: string;
  nota?: ReactNode;
  sinBuscador?: boolean;
}>) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ col: string; desc: boolean } | null>(
    ordenPor ? { col: ordenPor, desc: descPorDefecto } : null,
  );
  const [pagina, setPagina] = useState(0);
  const [menu, setMenu] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Al buscar o reordenar se vuelve a la primera página: si no, se busca algo con
  // 3 resultados estando en la página 4 y la tabla sale vacía «sin motivo».
  useEffect(() => { setPagina(0); }, [q, orden]);

  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => { if (!caja.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const filtradas = useMemo(() => buscar(filas, columnas, q), [filas, columnas, q]);
  const ordenadas = useMemo(() => {
    const col = orden && columnas.find((c) => c.titulo === orden.col);
    return col ? ordenar(filtradas, col, orden.desc) : filtradas;
  }, [filtradas, columnas, orden]);

  const paginas = porPagina > 0 ? Math.max(Math.ceil(ordenadas.length / porPagina), 1) : 1;
  const pag = Math.min(pagina, paginas - 1);                       // por si encogió la lista
  const visibles = porPagina > 0 ? ordenadas.slice(pag * porPagina, pag * porPagina + porPagina) : ordenadas;

  // Los totales se calculan sobre lo FILTRADO, no sobre la página: quien busca
  // «Terraza» quiere lo que suma la terraza entera, no lo que cabe en pantalla.
  const conTotal = columnas.filter((c) => c.total);
  // En el PIE del PDF los totales van como texto plano (aquí sí con € y miles:
  // se lee en papel, no se suma en Excel).
  const totales = conTotal.map((c) => {
    const v = c.total!(ordenadas);
    return { etiqueta: c.titulo, valor: c.tipo === "euro" && typeof v === "number" ? eur(v) : String(v ?? "—") };
  });

  const exportar = { titulo: periodo ? `${titulo} · ${periodo}` : titulo, cols: [...columnas] };
  const opcion = "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] text-paper transition-colors active:bg-brand/15";

  return (
    <section className={`${RC} border border-line bg-panel`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <h3 className="text-[12.5px] font-semibold text-paper">{titulo}</h3>

        {!sinBuscador && (
          <label className="relative flex min-w-0 flex-1 items-center sm:max-w-60">
            <Search size={14} className="absolute left-2.5 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
              aria-label={`Buscar en ${titulo}`}
              className="h-8 w-full rounded-md border border-line bg-paper/5 pl-8 pr-8 text-[12px] text-paper outline-none placeholder:text-muted focus:border-brand" />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda"
                className="absolute right-2 text-muted transition-transform active:scale-90"><X size={14} /></button>
            )}
          </label>
        )}

        {acciones}

        <span className="ml-auto text-[11.5px] tabular-nums text-muted">
          {ordenadas.length}{q && filas.length !== ordenadas.length ? ` de ${filas.length}` : ""}{" "}
          {ordenadas.length === 1 ? "fila" : "filas"}
        </span>

        <div ref={caja} className="relative">
          <button type="button" disabled={ordenadas.length === 0} onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu" aria-expanded={menu}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper/5 px-3 text-[12px] font-semibold text-paper transition-transform active:scale-95 disabled:opacity-40">
            <Download size={14} /> Descargar
          </button>
          {menu && (
            <div role="menu" className="gl-aparecer absolute right-0 top-[calc(100%+4px)] z-30 w-56 overflow-hidden rounded-md border border-line bg-panel shadow-xl">
              <button type="button" role="menuitem" className={opcion}
                onClick={() => { setMenu(false); descargarCSV(exportar.titulo, exportar.cols, ordenadas); }}>
                <FileSpreadsheet size={16} className="flex-none text-mint" />
                <span className="min-w-0"><b className="block font-semibold">CSV</b>
                  <small className="block text-[11px] text-muted">Se abre en Excel</small></span>
              </button>
              <button type="button" role="menuitem" className={`${opcion} border-t border-line`}
                onClick={() => { setMenu(false); imprimirInforme(exportar.titulo, exportar.cols, ordenadas, { periodo, local, totales }); }}>
                <Printer size={16} className="flex-none text-brand-lit" />
                <span className="min-w-0"><b className="block font-semibold">PDF o impresora</b>
                  <small className="block text-[11px] text-muted">Elige «Guardar como PDF»</small></span>
              </button>
            </div>
          )}
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <p className="px-3 py-10 text-center text-[12.5px] text-muted">{q ? "Nada cuadra con la búsqueda." : vacio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                {columnas.map((c) => {
                  const der = alaDerecha(c);
                  const activa = orden?.col === c.titulo;
                  const puede = c.ordenable !== false;
                  return (
                    <th key={c.titulo} className={`${TH} ${der ? "text-right" : "text-left"} ${puede ? "" : "cursor-default"}`}>
                      {puede ? (
                        <button type="button"
                          onClick={() => setOrden((o) => o?.col === c.titulo ? { col: c.titulo, desc: !o.desc } : { col: c.titulo, desc: der })}
                          className={`inline-flex items-center gap-1 uppercase tracking-[.04em] transition-transform active:scale-95 ${der ? "flex-row-reverse" : ""} ${activa ? "text-paper" : ""}`}>
                          {c.titulo}
                          {activa
                            ? <span className="text-[9px] leading-none">{orden.desc ? "▼" : "▲"}</span>
                            : <ChevronsUpDown size={11} className="opacity-40" />}
                        </button>
                      ) : c.titulo}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={clave(f)} className="border-b border-line last:border-0">
                  {columnas.map((c) => (
                    <td key={c.titulo} className={`${TD} ${alaDerecha(c) ? "text-right tabular-nums" : ""}`}>
                      {c.celda ? c.celda(f) : pinta(c, c.valor(f))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {conTotal.length > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-paper/3">
                  {columnas.map((c, i) => (
                    <td key={c.titulo} className={`${TD} font-semibold ${alaDerecha(c) ? "text-right tabular-nums" : ""}`}>
                      {c.total ? pinta(c, c.total(ordenadas), true) : i === 0 ? "Total" : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {(paginas > 1 || nota) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2">
          {nota && <span className="text-[11.5px] leading-relaxed text-muted">{nota}</span>}
          {paginas > 1 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11.5px] tabular-nums text-muted">
                {pag * porPagina + 1}–{Math.min((pag + 1) * porPagina, ordenadas.length)} de {ordenadas.length}
              </span>
              <div className="flex items-center gap-1">
                <BotonPag alDar={() => setPagina(pag - 1)} apagado={pag === 0} etiqueta="Página anterior">
                  <ChevronLeft size={15} />
                </BotonPag>
                <span className="px-1 text-[12px] tabular-nums text-paper">{pag + 1} / {paginas}</span>
                <BotonPag alDar={() => setPagina(pag + 1)} apagado={pag >= paginas - 1} etiqueta="Página siguiente">
                  <ChevronRight size={15} />
                </BotonPag>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Formato de pantalla: el € y los miles se ven aquí, pero NO viajan al CSV. */
function pinta<T>(c: ColumnaTabla<T>, v: string | number | null, esTotal = false): ReactNode {
  if (v == null) return <span className="text-muted">—</span>;
  if (c.tipo === "euro" && typeof v === "number") return eur(v);
  if (c.tipo === "numero" && typeof v === "number") return v.toLocaleString("es-ES");
  return esTotal ? String(v) : v;
}

function BotonPag({ alDar, apagado, etiqueta, children }: Readonly<{
  alDar: () => void; apagado: boolean; etiqueta: string; children: ReactNode;
}>) {
  return (
    <button type="button" onClick={alDar} disabled={apagado} aria-label={etiqueta}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper/5 text-paper transition-transform active:scale-90 disabled:opacity-30">
      {children}
    </button>
  );
}

