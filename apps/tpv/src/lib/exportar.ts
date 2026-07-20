// Exportar informes: CSV para Excel e IMPRIMIR (de ahí sale el PDF, con «Guardar
// como PDF» del diálogo del navegador — sin cargar una librería de 400 kB en un
// mini-PC de bar).
//
// Portado del `exportarCsv`/`imprimir` de apps/web/components/tabla-datos.tsx
// (skill gluuh-tpv-portar): los detalles de abajo están pagados, no se tocan.

/** Qué clase de dato lleva la columna: decide formato, alineación y orden. */
export type TipoColumna = "texto" | "numero" | "euro";

export interface ColumnaInforme<T> {
  titulo: string;
  /**
   * Valor CRUDO de la celda. Devolver el número pelado (no «1.486,30 €»): es lo
   * que se ordena, se busca y se exporta, y un importe formateado se ordenaría
   * como texto — «9,50» por encima de «1.486,30».
   */
  valor: (fila: T) => string | number | null;
  tipo?: TipoColumna;
  /** Se deduce de `tipo`; solo para forzarlo. */
  derecha?: boolean;
}

/** Importes y cantidades, a la derecha: es como se comparan dos cifras de un vistazo. */
export const alaDerecha = <T,>(c: ColumnaInforme<T>): boolean =>
  c.derecha ?? (c.tipo === "euro" || c.tipo === "numero");

/**
 * Texto de la celda para EXPORTAR (CSV y PDF).
 *
 * Los importes salen «1486,30»: coma decimal para que el Excel español los sume,
 * y sin el símbolo € ni separador de miles, que convertirían la columna en texto
 * y dejarían al gestor sin poder sumarla.
 */
export function textoExport<T>(c: ColumnaInforme<T>, fila: T): string {
  const v = c.valor(fila);
  if (v == null) return "";
  if (c.tipo === "euro" && typeof v === "number") return v.toFixed(2).replace(".", ",");
  // Cualquier decimal va con coma, por lo mismo: con punto, Excel en español lo
  // lee como texto (o peor, «12.3» como una fecha) y la columna deja de sumarse.
  if (c.tipo === "numero" && typeof v === "number") return String(v).replace(".", ",");
  return String(v);
}

const textoCelda = (v: string | number | null) => (v == null ? "" : String(v));

/** Escapa para CSV: comillas dobladas y entrecomillado si hay `;`, `"` o salto. */
function escCsv(v: string | number | null): string {
  const s = textoCelda(v);
  return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const escHtml = (v: string | number | null) =>
  textoCelda(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;");

/**
 * Descarga las filas como CSV.
 *
 * OJO con dos cosas, y son a propósito:
 *  · el separador es `;` (no la coma);
 *  · y la cadena empieza por un BOM (U+FEFF) invisible.
 * Con las dos, **Excel en español abre el fichero en columnas y con los acentos
 * bien**. Sin ellas, sale todo en una columna y con la ñ rota — y el dueño del bar
 * concluye, con razón, que el programa exporta mal.
 */
export function descargarCSV<T>(nombre: string, columnas: ColumnaInforme<T>[], filas: T[]): void {
  const cabecera = columnas.map((c) => escCsv(c.titulo)).join(";");
  const cuerpo = filas.map((f) => columnas.map((c) => escCsv(textoExport(c, f))).join(";")).join("\n");
  const csv = `﻿${cabecera}\n${cuerpo}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Abre el informe listo para imprimir. Desde el diálogo del navegador se puede
 * «Guardar como PDF», que es el PDF que pide el dueño para su gestor.
 *
 * `pie` es para el contexto que hace falta al leerlo en papel (periodo, local,
 * quién lo sacó): un informe sin fecha ni bar no vale para nada.
 */
export function imprimirInforme<T>(
  titulo: string,
  columnas: ColumnaInforme<T>[],
  filas: T[],
  pie?: { periodo?: string; local?: string; totales?: { etiqueta: string; valor: string }[] },
): void {
  const th = columnas.map((c) => `<th${c.derecha ? ' class="d"' : ""}>${escHtml(c.titulo)}</th>`).join("");
  const tr = filas
    .map((f) => `<tr>${columnas.map((c) => `<td${c.derecha ? ' class="d"' : ""}>${escHtml(c.valor(f))}</td>`).join("")}</tr>`)
    .join("");
  const totales = pie?.totales?.length
    ? `<div class="tot">${pie.totales.map((t) => `<span><b>${escHtml(t.etiqueta)}</b> ${escHtml(t.valor)}</span>`).join("")}</div>`
    : "";
  const cuando = new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });

  const html = `<!doctype html><meta charset="utf-8"><title>${escHtml(titulo)}</title>
<style>
  body{font:12px system-ui,-apple-system,"Segoe UI",sans-serif;margin:24px;color:#111}
  h1{font-size:17px;margin:0 0 2px}
  .sub{color:#666;font-size:11px;margin-bottom:14px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
  th{background:#f2f2f2;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  td.d,th.d{text-align:right;font-variant-numeric:tabular-nums}
  tbody tr:nth-child(even){background:#fafafa}
  .tot{margin-top:12px;display:flex;gap:22px;font-size:12px}
  .tot b{color:#666;font-weight:600}
  @media print{body{margin:8mm} thead{display:table-header-group}}
</style>
<h1>${escHtml(titulo)}</h1>
<div class="sub">${[pie?.local, pie?.periodo, `${filas.length} registro${filas.length === 1 ? "" : "s"}`, `emitido ${cuando}`]
    .filter((x): x is string => !!x).map(escHtml).join(" · ")}</div>
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
${totales}`;

  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) return;                       // el navegador bloqueó la ventana
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
