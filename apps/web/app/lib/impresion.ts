// Impresión del ticket: nativa (Gluuh Desktop → ESC/POS) o del navegador.
// La web compone el ticket como datos; aquí se formatea a líneas de texto
// de ancho fijo para la térmica. En navegador puro cae a window.print()
// (el recibo 80 mm oculto del TPV).

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
  abrirCajon?: boolean;
}

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

/** Serializa el ticket a líneas de texto de ancho fijo (42 col = 80 mm). */
export function formatearTicket(t: TicketImpresion, ancho = 42): string[] {
  const raya = "-".repeat(ancho);
  const l: string[] = [];
  l.push(centrar(t.local.nombre || "Gluuh TPV", ancho));
  if (t.local.cif) l.push(centrar(`CIF: ${t.local.cif}`, ancho));
  if (t.local.direccion) l.push(centrar(t.local.direccion, ancho));
  l.push(raya);
  l.push(new Date().toLocaleString("es-ES"));
  l.push(fila(t.contexto, t.operario ? `Atiende: ${t.operario}` : "", ancho));
  if (t.numSerieFactura) l.push(`Factura: ${t.numSerieFactura}`);
  l.push(raya);
  for (const linea of t.lineas) {
    l.push(fila(`${linea.cantidad}x ${linea.nombre}`, eurTxt(linea.importe), ancho));
  }
  l.push(raya);
  for (const d of t.desglose) l.push(fila(d.etiqueta, eurTxt(d.cuota), ancho));
  l.push(fila("TOTAL", eurTxt(t.total), ancho));
  l.push(raya);
  if (t.esPrueba) l.push(centrar("TICKET DE PRUEBA - SIN VALIDEZ FISCAL", ancho));
  if (t.leyenda) l.push(centrar(t.leyenda, ancho));
  if (t.huella) l.push(`Huella: ${t.huella.slice(0, 32)}`);
  l.push("");
  l.push(centrar("¡Gracias por su visita!", ancho));
  return l;
}

/** Imprime nativo si corre dentro de Gluuh Desktop; si no, diálogo del navegador. */
export async function imprimirTicket(t: TicketImpresion): Promise<void> {
  const gluuh = typeof window !== "undefined" ? window.gluuh : undefined;
  if (gluuh) {
    await gluuh.imprimir({
      lineas: formatearTicket(t),
      qr: t.qrUrl,
      cortar: true,
      abrirCajon: t.abrirCajon ?? false,
    });
    return;
  }
  window.print();
}
