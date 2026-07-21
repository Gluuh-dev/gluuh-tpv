// Exportar una tabla de la Lista a PDF (A4 apaisado). jsPDF va por import
// dinámico —igual que en `lib/impresion.ts`— para no cargarlo hasta que hace
// falta. Dibujo la tabla a mano (no hay plugin autoTable): cabecera, cebra,
// divisorias y saltos de página. Genérico para poder reusarlo en otras listas.

export interface ColumnaPdf {
  clave: string;
  titulo: string;
  /** Peso relativo del ancho (se reparte el ancho útil de la página). */
  ancho: number;
  /** Alineación del texto; por defecto a la izquierda. */
  alin?: "izq" | "der";
}

/** Recorta un texto para que no se salga de su columna (sin envolver a 2 líneas). */
function recortar(doc: import("jspdf").jsPDF, texto: string, anchoPt: number): string {
  if (doc.getTextWidth(texto) <= anchoPt) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > anchoPt) t = t.slice(0, -1);
  return `${t}…`;
}

export async function exportarTablaPdf(
  titulo: string,
  columnas: readonly ColumnaPdf[],
  filas: ReadonlyArray<Record<string, string>>,
  nombreFichero: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 32;
  const tablaW = W - m * 2;
  const pad = 5;
  const filaH = 17;

  const totalPeso = columnas.reduce((s, c) => s + c.ancho, 0);
  const cols = columnas.map((c) => ({ ...c, w: (c.ancho / totalPeso) * tablaW }));

  const cabecera = (): number => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(25);
    doc.text(titulo, m, m + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
    doc.text(`${filas.length} ${filas.length === 1 ? "elemento" : "elementos"} · ${new Date().toLocaleString("es-ES")}`, m, m + 19);

    const y = m + 34;
    doc.setFillColor(232, 234, 238); doc.rect(m, y, tablaW, filaH + 3, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(70);
    let x = m;
    for (const c of cols) {
      const der = c.alin === "der";
      doc.text(c.titulo, der ? x + c.w - pad : x + pad, y + filaH - 3, { align: der ? "right" : "left" });
      x += c.w;
    }
    return y + filaH + 3;
  };

  let y = cabecera();
  filas.forEach((f, i) => {
    if (y + filaH > H - m) { doc.addPage(); y = cabecera(); }
    if (i % 2 === 1) { doc.setFillColor(246, 247, 249); doc.rect(m, y, tablaW, filaH, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(30);
    let x = m;
    for (const c of cols) {
      const der = c.alin === "der";
      const val = recortar(doc, f[c.clave] ?? "", c.w - pad * 2);
      doc.text(val, der ? x + c.w - pad : x + pad, y + filaH - 5, { align: der ? "right" : "left" });
      x += c.w;
    }
    doc.setDrawColor(226); doc.line(m, y + filaH, m + tablaW, y + filaH);
    y += filaH;
  });

  doc.save(nombreFichero.endsWith(".pdf") ? nombreFichero : `${nombreFichero}.pdf`);
}
