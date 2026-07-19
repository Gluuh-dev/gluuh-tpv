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

function escaparHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

// Impresión en NAVEGADOR: ventana aislada con solo el recibo (no toda la app).
function imprimirEnNavegador(lineas: string[], anchoMm: number): void {
  const cuerpo = lineas.map((linea) => escaparHtml(linea) || "&nbsp;").join("\n");
  const w = window.open("", "gluuh_ticket", "width=340,height=640");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>` +
    `@page{size:${anchoMm}mm auto;margin:0}` +
    `body{width:${anchoMm}mm;margin:0;padding:4mm 2mm;font-family:'Courier New',monospace;font-size:12px;line-height:1.35;white-space:pre-wrap;color:#000;background:#fff}` +
    `</style></head><body>${cuerpo}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
  setTimeout(() => w.close(), 800);
}

/**
 * Imprime un ticket: por la térmica en Gluuh Desktop, o en ventana aislada en
 * navegador. Para pruebas basta con esto (esPrueba, sin QR/huella → sin backend).
 */
export async function imprimirTicket(t: TicketImpresion, d: DisenoTicket = {}): Promise<void> {
  const anchoMm = d.anchoMm ?? 80;
  const lineas = formatearTicket(t, { ...d, anchoMm });
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    await gluuh.imprimir({ lineas, qr: t.qrUrl, cortar: true, abrirCajon: t.abrirCajon ?? false });
    return;
  }
  imprimirEnNavegador(lineas, anchoMm);
}
