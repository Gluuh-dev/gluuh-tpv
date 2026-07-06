// Impresión del ticket: nativa (Gluuh Desktop → ESC/POS) o del navegador.
// La web compone el ticket como datos; aquí se formatea a líneas de texto
// de ancho fijo para la térmica. En navegador se imprime en una VENTANA
// AISLADA (no window.print() sobre toda la app, que sacaba hojas en blanco).

export interface TicketImpresion {
  local: { nombre: string; cif?: string; direccion?: string };
  contexto: string; // "Mesa 12" · "Para llevar · Ana" · "Barra"
  operario?: string;
  numSerieFactura?: string;
  lineas: { cantidad: number; nombre: string; importe: number }[];
  desglose: { etiqueta: string; cuota: number }[];
  total: number;
  /** URL de cotejo VERIFACTU (QR en la térmica) y leyenda. */
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
  /** Logo del local arriba del todo. Por ahora solo navegador/vista previa (ESC/POS pendiente). */
  logo?: boolean;
  nombre?: boolean;
  cif?: boolean;
  direccion?: boolean;
  /** Línea(s) libres bajo el nombre ("Cafetería · Terraza"); admite varias con \n. */
  cabecera?: string;
  fecha?: boolean;
  mesaOperario?: boolean;
  lineas?: boolean;
  desglose?: boolean;
  total?: boolean;
  qr?: boolean;
  /** Pie del ticket; admite varias líneas separadas por \n (cada una se centra). */
  pie?: string;
}

/** Una impresora del local. */
export interface ImpresoraCfg {
  id: string;
  nombre: string;
  /** Destino: `tcp://IP:9100` (red) u otro URI que entienda el escritorio. */
  uri: string;
  anchoMm: 58 | 80;
  /** Nº de copias por documento (1 por defecto, máx. 5). */
  copias?: number;
  /** El cajón portamonedas está conectado a esta impresora (kick RJ11). */
  abreCajon?: boolean;
  /** Desactivada = sus documentos no salen por ella (sin borrar la config). */
  activa?: boolean;
}
/** Configuración de impresión guardada en `setting` (clave "impresion.config"). */
export interface ConfigImpresion { ticket?: DisenoTicket; impresoras?: ImpresoraCfg[]; rutas?: Record<string, string> }

/** Impresora a la que va un tipo de documento (TICKET_CLIENTE, COMANDA_COCINA…).
 *  Una impresora desactivada no resuelve (el documento cae al plan B: fichero/navegador). */
export function resolverImpresora(cfg: ConfigImpresion | null, tipoDoc: string): ImpresoraCfg | null {
  const id = cfg?.rutas?.[tipoDoc];
  if (!id) return null;
  const p = cfg?.impresoras?.find((x) => x.id === id) ?? null;
  return p && p.activa !== false ? p : null;
}

/** Copias saneadas de una impresora (1–5). */
const copiasDe = (p?: ImpresoraCfg | null) => Math.max(1, Math.min(5, Math.round(p?.copias ?? 1)));

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

/** Línea de artículo: "  2 Bocadillo calamares      8,50 EUR", envolviendo nombres largos. */
function lineasArticulo(li: { cantidad: number; nombre: string; importe: number }, ancho: number): string[] {
  const uds = String(li.cantidad).padStart(3);
  const imp = eurTxt(li.importe);
  const anchoNombre = Math.max(8, ancho - 4 - imp.length - 1);
  const partes = envolver(li.nombre, anchoNombre);
  const out = [fila(`${uds} ${partes[0] ?? ""}`, imp, ancho)];
  for (const p of partes.slice(1)) out.push(`    ${p}`);
  return out;
}

/**
 * Serializa el ticket a líneas de texto de ancho fijo, respetando el diseño,
 * con aspecto de ticket real de hostelería: cabecera centrada, columnas
 * UDS/DESCRIPCIÓN/IMPORTE, TOTAL entre separadores dobles y pie centrado.
 * Solo caracteres seguros para una térmica ESC/POS con PC858 (nada de ─/═/emoji).
 */
export function formatearTicket(t: TicketImpresion, d: DisenoTicket = {}): string[] {
  const ancho = columnas(d.anchoMm);              // columnas según el ancho de papel
  const on = (k: keyof DisenoTicket) => d[k] !== false;   // por defecto, visible
  const raya = "-".repeat(ancho);
  const rayaDoble = "=".repeat(ancho);
  const centrado = (txt: string) => envolver(txt, ancho).map((s) => centrar(s, ancho));
  const l: string[] = [];

  // — Cabecera: local destacado, texto libre, dirección y CIF, todo centrado —
  if (on("nombre")) l.push(...centrado((t.local.nombre || "Gluuh TPV").toUpperCase()));
  if (d.cabecera?.trim()) {
    for (const c of d.cabecera.split("\n")) if (c.trim()) l.push(...centrado(c.trim()));
  }
  if (on("direccion") && t.local.direccion) l.push(...centrado(t.local.direccion));
  if (on("cif") && t.local.cif) l.push(...centrado(`CIF: ${t.local.cif}`));
  l.push(raya);

  // — Datos de la venta: fecha/hora, mesa + camarero, nº de factura —
  if (on("fecha")) {
    const f = new Date();
    l.push(`${f.toLocaleDateString("es-ES")} ${f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`);
  }
  if (on("mesaOperario")) l.push(fila(t.contexto, t.operario ? `Atiende: ${t.operario}` : "", ancho));
  if (t.numSerieFactura) l.push(`Factura: ${t.numSerieFactura}`);

  // — Líneas con cabecera de columnas —
  if (on("lineas")) {
    l.push(raya);
    l.push(fila("UDS DESCRIPCIÓN", "IMPORTE", ancho));
    l.push(raya);
    for (const linea of t.lineas) l.push(...lineasArticulo(linea, ancho));
  }

  // — TOTAL en su bloque, y debajo el desglose de impuestos alineado —
  if (on("total")) l.push(rayaDoble, fila("TOTAL", eurTxt(t.total), ancho), rayaDoble);
  else l.push(raya);
  if (on("desglose") && t.desglose.length) {
    for (const dl of t.desglose) l.push(fila(dl.etiqueta, eurTxt(dl.cuota), ancho));
    l.push(raya);
  }

  // — Avisos + VERIFACTU —
  if (t.proforma) l.push(...centrado("CUENTA - NO ES FACTURA"));
  if (t.esPrueba) l.push(...centrado("TICKET DE PRUEBA - SIN VALIDEZ FISCAL"));
  if (on("qr") && t.leyenda) l.push(...centrado(t.leyenda));
  if (on("qr") && t.huella) l.push(centrar(`Huella: ${t.huella.slice(0, Math.min(32, ancho - 8))}`, ancho));

  // — Pie centrado, multilínea, y margen en blanco para el corte —
  l.push("");
  const pie = t.proforma ? "Gracias. Pida en caja para pagar." : (d.pie ?? "¡Gracias por su visita!");
  for (const p of pie.split("\n")) {
    if (p.trim()) l.push(...centrado(p.trim()));
    else l.push("");
  }
  l.push("", "", "");
  return l;
}

/**
 * Guarda las líneas de un documento como fichero `.txt` descargado (Blob +
 * <a download>). Último recurso para que un ticket/comanda nunca se pierda
 * cuando la impresión nativa falla o no hay impresora.
 */
export function guardarTicketComoFichero(lineas: string[], nombre: string): void {
  const blob = new Blob([lineas.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Marca de tiempo apta para nombre de fichero: 2026-07-04T13-45-02. */
const fechaFichero = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

function escaparHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

// Impresión en NAVEGADOR: ventana aislada con solo el recibo. Evita imprimir toda
// la app (el bug de las hojas en blanco). En navegador hay una sola impresora
// (la del diálogo del sistema): el enrutado por IP solo aplica en Gluuh Desktop.
function imprimirLineasEnNavegador(lineas: string[], anchoMm: number, opts?: { logoUrl?: string }): void {
  const cuerpo = lineas.map((linea) => escaparHtml(linea) || "&nbsp;").join("\n");
  const logo = opts?.logoUrl
    ? `<img src="${escaparHtml(opts.logoUrl).replace(/"/g, "&quot;")}" alt="" style="display:block;margin:0 auto 3mm;max-width:60%">`
    : "";
  const w = window.open("", "gluuh_ticket", "width=340,height=640");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>` +
    `@page{size:${anchoMm}mm auto;margin:0}` +
    `body{width:${anchoMm}mm;margin:0;padding:4mm 2mm;font-family:'Courier New',monospace;font-size:12px;line-height:1.35;white-space:pre-wrap;color:#000;background:#fff}` +
    `</style></head><body>${logo}${cuerpo}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
  // No cerrar de inmediato: algunos navegadores cancelan la impresión si se cierra antes.
  setTimeout(() => w.close(), 800);
}

/**
 * Imprime un ticket: nativo (ESC/POS a la IP de `dest`) en Gluuh Desktop, o en
 * ventana aislada en navegador. `dest` = impresora destino (ticket/factura).
 *
 * `extra.logoUrl` es el logo de la cabecera del ticket. Como aquí no se lee la
 * BD, el llamador (vista previa de configuración y, en el futuro, el TPV) debe
 * pasar `branding.logo_ticket_url || branding.logo_url`: el logo de tickets
 * (b/n) si existe, y si no el logo de marca. Solo se dibuja si `d.logo` está on.
 */
export async function imprimirTicket(
  t: TicketImpresion, d: DisenoTicket = {}, dest?: ImpresoraCfg | null, extra?: { logoUrl?: string },
): Promise<{ ok: boolean; pendientes?: number; error?: string } | void> {
  const anchoMm = dest?.anchoMm ?? d.anchoMm ?? 80;
  const lineas = formatearTicket(t, { ...d, anchoMm });
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    // ponytail: logo en ESC/POS pendiente — PrintJob no soporta imagen; ampliar
    // packages/hardware (printImage) en una pasada del escritorio.
    // La cola local de Gluuh Desktop ya reintenta el envío ESC/POS; guardar el
    // documento como fichero es el cinturón extra para que nunca se pierda.
    // El cajón solo se abre si el TPV lo pide (cobro en efectivo) Y esta
    // impresora lo tiene conectado; y solo en la primera copia.
    const copias = copiasDe(dest);
    let r: { ok: boolean; pendientes?: number; error?: string } = { ok: false };
    try {
      for (let i = 0; i < copias; i++) {
        r = await gluuh.imprimir({
          lineas,
          qr: t.qrUrl,
          cortar: true,
          abrirCajon: i === 0 && (t.abrirCajon ?? false) && (dest?.abreCajon ?? true),
          impresora: dest ? { uri: dest.uri, ancho: columnas(anchoMm) } : undefined,
        });
        if (!r.ok) break;
      }
    } catch (e) {
      guardarTicketComoFichero(lineas, `ticket-${fechaFichero()}.txt`);
      throw e;
    }
    if (!r.ok) guardarTicketComoFichero(lineas, `ticket-${fechaFichero()}.txt`);
    return r;
  }
  imprimirLineasEnNavegador(lineas, anchoMm, d.logo && extra?.logoUrl ? { logoUrl: extra.logoUrl } : undefined);
}

/** Comanda de cocina/barra: solo artículos de una partida, sin precios. */
export interface ComandaImpresion {
  contexto: string;   // "Mesa 5" · "Para llevar · Ana" · "Barra"
  operario?: string;
  nota?: string;      // aviso de la mesa (alergias, cumpleaños…)
  lineas: { cantidad: number; nombre: string; nota?: string }[];
}

export function formatearComanda(c: ComandaImpresion, titulo: string, ancho = 42): string[] {
  const raya = "-".repeat(ancho);
  const hora = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const l: string[] = [centrar(titulo, ancho), raya, fila(c.contexto, hora, ancho)];
  if (c.operario) l.push(`Camarero: ${c.operario}`);
  if (c.nota?.trim()) l.push(raya, `** AVISO: ${c.nota.trim()} **`);
  l.push(raya);
  for (const li of c.lineas) {
    l.push(`${li.cantidad} x ${li.nombre}`);
    if (li.nota) l.push(`   > ${li.nota}`);
  }
  l.push(raya);
  return l;
}

/** Imprime una comanda en su impresora (cocina/barra) por IP, o en navegador. */
export async function imprimirComanda(
  c: ComandaImpresion, titulo: string, dest?: ImpresoraCfg | null,
): Promise<{ ok: boolean; pendientes?: number; error?: string } | void> {
  const anchoMm = dest?.anchoMm ?? 80;
  const lineas = formatearComanda(c, titulo, columnas(anchoMm));
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    // Cinturón extra (la cola del escritorio ya reintenta): si falla, a fichero.
    const estacion = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "comanda";
    const copias = copiasDe(dest);
    let r: { ok: boolean; pendientes?: number; error?: string } = { ok: false };
    try {
      for (let i = 0; i < copias; i++) {
        r = await gluuh.imprimir({ lineas, cortar: true, impresora: dest ? { uri: dest.uri, ancho: columnas(anchoMm) } : undefined });
        if (!r.ok) break;
      }
    } catch (e) {
      guardarTicketComoFichero(lineas, `comanda-${estacion}-${fechaFichero()}.txt`);
      throw e;
    }
    if (!r.ok) guardarTicketComoFichero(lineas, `comanda-${estacion}-${fechaFichero()}.txt`);
    return r;
  }
  imprimirLineasEnNavegador(lineas, anchoMm);
}
