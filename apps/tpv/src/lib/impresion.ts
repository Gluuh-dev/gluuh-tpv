// Impresión del ticket en la SPA — PORTADO de apps/web/app/lib/impresion.ts
// (solo las piezas puras: formateo a texto de ancho fijo + salida). Sin jspdf,
// sin comanda, sin enrutado por IP: eso llega cuando se cablee la config real.
//
// Salida en dos caminos, elegido en tiempo de ejecución:
//   • Dentro de Gluuh Desktop (Electron): `window.gluuh.imprimir` → ESC/POS a la
//     térmica (la SPA de producción corre dentro de Electron servida por el nodo).
//   • En navegador (dev en :3120): ventana AISLADA con `window.print()` — evita
//     imprimir toda la app (el bug de las hojas en blanco). Sale por el diálogo
//     del sistema (o "Guardar como PDF"). Cero dependencias.

export interface TicketImpresion {
  local: { nombre: string; cif?: string; direccion?: string };
  contexto: string; // "Mesa 12" · "Para llevar · Ana" · "Barra"
  operario?: string;
  numSerieFactura?: string;
  lineas: {
    cantidad: number;
    nombre: string;
    importe: number;
    extras?: { nombre: string; cantidad: number; precioExtra: number }[];
  }[];
  desglose: { etiqueta: string; cuota: number }[];
  total: number;
  qrUrl?: string;
  leyenda?: string;
  huella?: string;
  esPrueba?: boolean;
  /** Proforma (cuenta): documento no fiscal para llevar a la mesa. */
  proforma?: boolean;
  abrirCajon?: boolean;
}

/** Diseño del ticket (qué líneas salen, ancho y pie), configurable en el panel. */
export interface DisenoTicket {
  anchoMm?: 58 | 80;
  /** Logo arriba del ticket (default sí). Sin logo de empresa, se usa el de Gluuh. */
  logo?: boolean;
  /** Logo del local; si falta, cae al de Gluuh (`LOGO_GLUUH`). */
  logoUrl?: string;
  nombre?: boolean;
  cif?: boolean;
  direccion?: boolean;
  cabecera?: string;
  fecha?: boolean;
  mesaOperario?: boolean;
  lineas?: boolean;
  desglose?: boolean;
  total?: boolean;
  qr?: boolean;
  pie?: string;
}

// Logo de Gluuh por defecto (public/): se pinta cuando el local no tiene el suyo.
const LOGO_GLUUH = "/icono-app.png";

// El puente de Gluuh Desktop (solo lo que usa la impresión). En navegador no existe.
interface PuenteGluuh {
  imprimir(job: {
    lineas: string[]; qr?: string; cortar?: boolean; abrirCajon?: boolean;
    impresora?: { uri: string; ancho: number };
  }): Promise<{ ok: boolean; pendientes?: number; error?: string }>;
}
declare global {
  interface Window { gluuh?: PuenteGluuh }
}

const columnas = (mm?: number) => (mm === 58 ? 32 : 42);
const eurTxt = (n: number) => `${n.toFixed(2).replace(".", ",")} EUR`;

function fila(izq: string, der: string, ancho: number): string {
  const hueco = ancho - izq.length - der.length;
  if (hueco < 1) return `${izq.slice(0, Math.max(0, ancho - der.length - 1))} ${der}`;
  return izq + " ".repeat(hueco) + der;
}

function centrar(texto: string, ancho: number): string {
  if (texto.length >= ancho) return texto;
  return " ".repeat(Math.floor((ancho - texto.length) / 2)) + texto;
}

/** Parte un texto en líneas de como mucho `ancho` caracteres, por palabras. */
function envolver(texto: string, ancho: number): string[] {
  const out: string[] = [];
  let linea = "";
  for (let palabra of texto.trim().split(/\s+/)) {
    while (palabra.length > ancho) {
      if (linea) { out.push(linea); linea = ""; }
      out.push(palabra.slice(0, ancho));
      palabra = palabra.slice(ancho);
    }
    if (!palabra) continue;
    if (!linea) linea = palabra;
    else if (linea.length + 1 + palabra.length <= ancho) linea += ` ${palabra}`;
    else { out.push(linea); linea = palabra; }
  }
  if (linea) out.push(linea);
  return out;
}

/** Línea de artículo: "  2 Bocadillo calamares      8,50 EUR", envolviendo nombres largos y sus extras. */
function lineasArticulo(
  li: TicketImpresion["lineas"][number],
  ancho: number,
): string[] {
  const uds = String(li.cantidad).padStart(3);
  const imp = eurTxt(li.importe);
  const anchoNombre = Math.max(8, ancho - 4 - imp.length - 1);
  const partes = envolver(li.nombre, anchoNombre);
  const out = [fila(`${uds} ${partes[0] ?? ""}`, imp, ancho)];
  for (const p of partes.slice(1)) out.push(`    ${p}`);

  for (const ext of li.extras ?? []) {
    const extUds = ext.cantidad > 1 ? ` x${ext.cantidad}` : "";
    const extPrecio = ext.precioExtra > 0 ? ` (+${eurTxt(ext.precioExtra * ext.cantidad)})` : "";
    for (const pe of envolver(`+ ${ext.nombre}${extUds}${extPrecio}`, anchoNombre - 4)) out.push(`      ${pe}`);
  }
  return out;
}

/**
 * Serializa el ticket a líneas de texto de ancho fijo con aspecto de ticket real:
 * cabecera centrada, columnas UDS/DESCRIPCIÓN/IMPORTE, TOTAL entre separadores
 * dobles y pie centrado. Solo caracteres seguros para térmica ESC/POS (PC858).
 */
export function formatearTicket(t: TicketImpresion, d: DisenoTicket = {}): string[] {
  const ancho = columnas(d.anchoMm);
  const on = (k: keyof DisenoTicket) => d[k] !== false; // por defecto, visible
  const raya = "-".repeat(ancho);
  const rayaDoble = "=".repeat(ancho);
  const centrado = (txt: string) => envolver(txt, ancho).map((s) => centrar(s, ancho));
  const l: string[] = [];

  if (on("nombre")) l.push(...centrado((t.local.nombre || "Gluuh TPV").toUpperCase()));
  if (d.cabecera?.trim()) {
    for (const c of d.cabecera.split("\n")) if (c.trim()) l.push(...centrado(c.trim()));
  }
  if (on("direccion") && t.local.direccion) l.push(...centrado(t.local.direccion));
  if (on("cif") && t.local.cif) l.push(...centrado(`CIF: ${t.local.cif}`));
  l.push(raya);

  if (on("fecha")) {
    const f = new Date();
    l.push(`${f.toLocaleDateString("es-ES")} ${f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`);
  }
  if (on("mesaOperario")) l.push(fila(t.contexto, t.operario ? `Atiende: ${t.operario}` : "", ancho));
  if (t.numSerieFactura) l.push(`Factura: ${t.numSerieFactura}`);

  if (on("lineas")) {
    l.push(raya, fila("UDS DESCRIPCIÓN", "IMPORTE", ancho), raya);
    for (const linea of t.lineas) l.push(...lineasArticulo(linea, ancho));
  }

  if (on("total")) l.push(rayaDoble, fila("TOTAL", eurTxt(t.total), ancho), rayaDoble);
  else l.push(raya);
  if (on("desglose") && t.desglose.length) {
    for (const dl of t.desglose) l.push(fila(dl.etiqueta, eurTxt(dl.cuota), ancho));
    l.push(raya);
  }

  if (t.proforma) l.push(...centrado("CUENTA - NO ES FACTURA"));
  if (t.esPrueba) l.push(...centrado("TICKET DE PRUEBA - SIN VALIDEZ FISCAL"));
  if (on("qr") && t.leyenda) l.push(...centrado(t.leyenda));
  if (on("qr") && t.huella) l.push(centrar(`Huella: ${t.huella.slice(0, Math.min(32, ancho - 8))}`, ancho));

  l.push("");
  const pie = t.proforma ? "Gracias. Pida en caja para pagar." : (d.pie ?? "¡Gracias por su visita!");
  for (const p of pie.split("\n")) l.push(p.trim() ? centrar(p.trim(), ancho) : "");
  l.push("", "", "");
  return l;
}

// Marca de tiempo apta para nombre de fichero: 2026-07-19T13-45-02.
const fechaFichero = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// Carga una imagen (el logo) de forma asíncrona; null si falla (CORS/ruta mala).
async function cargarImagenLogo(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Pasa el logo a blanco y negro puro (como saldría en una térmica).
function logoBlancoYNegro(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return img;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) < 10) continue;                       // casi transparente: se deja
      const gris = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const val = gris < 185 ? 0 : 255;                            // umbral B/N
      data[i] = val; data[i + 1] = val; data[i + 2] = val;
      if (val === 255) data[i + 3] = 0;                            // el blanco, transparente
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return img;
  }
}

/** Último recurso: descarga las líneas como `.txt` (si falla jsPDF). */
export function guardarTicketComoFichero(lineas: string[], nombre: string): void {
  const blob = new Blob([lineas.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Descarga el documento como PDF (fuente Courier para conservar las columnas).
 * Con `logoUrl`, pinta el logo centrado arriba en blanco y negro. Sin jsPDF, .txt.
 */
export async function guardarTicketComoPdf(lineas: string[], nombre: string, logoUrl?: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { jsPDF } = await import("jspdf");
    const cols = lineas[0]?.length || 42;
    const mm = cols === 32 ? 58 : 80;
    const ptWidth = Math.round(mm * 2.83465); // 1 mm = 2.83465 pt
    const fontSize = mm === 58 ? 7.5 : 8.0;
    const lineSpacing = mm === 58 ? 11 : 12;

    let logoImg: HTMLImageElement | null = null;
    let logoHeight = 0;
    const logoWidth = mm === 58 ? 32 : 42;
    if (logoUrl) {
      logoImg = await cargarImagenLogo(logoUrl);
      if (logoImg?.naturalWidth) logoHeight = (logoImg.naturalHeight / logoImg.naturalWidth) * logoWidth;
    }

    const topPadding = 15;
    const topMargin = topPadding + (logoHeight > 0 ? logoHeight + 10 : 0);
    const ptHeight = topMargin + lineas.length * lineSpacing + 15;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [ptWidth, ptHeight] });
    if (logoImg && logoHeight > 0) {
      doc.addImage(logoBlancoYNegro(logoImg), "PNG", (ptWidth - logoWidth) / 2, topPadding, logoWidth, logoHeight);
    }
    doc.setFont("courier", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    const leftMargin = mm === 58 ? 6 : 8;
    let y = topMargin + fontSize;
    for (const line of lineas) { doc.text(line, leftMargin, y); y += lineSpacing; }
    doc.save(nombre.endsWith(".pdf") ? nombre : `${nombre}.pdf`);
  } catch {
    guardarTicketComoFichero(lineas, nombre.replace(/\.pdf$/i, "") + ".txt");
  }
}

/**
 * Imprime un ticket: por la térmica en Gluuh Desktop; si NO hay impresora (o
 * falla), lo descarga en PDF — con el logo de Gluuh cuando el local no tiene el suyo.
 */
export async function imprimirTicket(t: TicketImpresion, d: DisenoTicket = {}): Promise<void> {
  const anchoMm = d.anchoMm ?? 80;
  const lineas = formatearTicket(t, { ...d, anchoMm });
  const logoUrl = d.logo === false ? undefined : (d.logoUrl ?? LOGO_GLUUH);
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    try {
      const r = await gluuh.imprimir({ lineas, qr: t.qrUrl, cortar: true, abrirCajon: t.abrirCajon ?? false });
      if (r.ok) return;
    } catch { /* cae a PDF */ }
  }
  await guardarTicketComoPdf(lineas, `ticket-${fechaFichero()}.pdf`, logoUrl);
}

// ── COMANDA de cocina/barra: el OTRO documento — SIN precios, para la partida —
// El destino depende de la estación del producto (COCINA/BARRA…): al marchar,
// cada grupo sale por la impresora de su estación (aquí, una impresión por
// estación). Portado de apps/web/app/lib/impresion.ts (sin pases, que la demo
// aún no tiene).

export interface ComandaImpresion {
  contexto: string;
  operario?: string;
  nota?: string;
  lineas: { cantidad: number; nombre: string; nota?: string }[];
}

export function formatearComanda(c: ComandaImpresion, titulo: string, anchoMm: 58 | 80 = 80): string[] {
  const ancho = columnas(anchoMm);
  const raya = "-".repeat(ancho);
  const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const l: string[] = [centrar(titulo, ancho), raya, fila(c.contexto, hora, ancho)];
  if (c.operario) l.push(`Camarero: ${c.operario}`);
  if (c.nota?.trim()) l.push(raya, `** AVISO: ${c.nota.trim()} **`);
  l.push(raya);
  for (const li of c.lineas) {
    l.push(`${li.cantidad} x ${li.nombre}`);
    if (li.nota?.trim()) l.push(`   > ${li.nota.trim()}`);
  }
  l.push(raya, "", "", "");
  return l;
}

/** Imprime una comanda: por la térmica de su estación en Electron; si no, PDF (sin logo). */
export async function imprimirComanda(c: ComandaImpresion, titulo: string, anchoMm: 58 | 80 = 80): Promise<void> {
  const lineas = formatearComanda(c, titulo, anchoMm);
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    try {
      const r = await gluuh.imprimir({ lineas, cortar: true });
      if (r.ok) return;
    } catch { /* cae a PDF */ }
  }
  const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "comanda";
  await guardarTicketComoPdf(lineas, `${slug}-${fechaFichero()}.pdf`);
}
