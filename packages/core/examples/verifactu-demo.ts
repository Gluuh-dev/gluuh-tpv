/**
 * Demo ejecutable del motor fiscal: simula el cierre de una cuenta en un bar de
 * La Palma (Canarias → IGIC), calcula impuestos, genera la factura simplificada,
 * su huella VERIFACTU encadenada y la URL del QR de cotejo de la AEAT.
 *
 * Ejecutar:  pnpm core:demo
 */

import {
  calcularImpuestosIncluidos,
  formatImporte,
  type LineaFiscal,
} from "../src/fiscal/tax.js";
import {
  encadenarRegistros,
  construirUrlQR,
  LEYENDA_VERIFACTU,
} from "../src/fiscal/verifactu.js";

const sep = (t = "") => console.log("\n" + "─".repeat(56) + (t ? " " + t : ""));

// ── 1. Comanda de ejemplo (PVP con IGIC incluido) ──────────────────────
const lineas: LineaFiscal[] = [
  { importe: 5.0, tipo: 7 }, // 2 cañas (servicio, IGIC 7 %)
  { importe: 14.0, tipo: 7 }, // 1 ración de pulpo (IGIC 7 %)
  { importe: 6.0, tipo: 15 }, // 1 botella de vino para llevar (alcohol, IGIC 15 %)
];

const territorio = "CANARIAS" as const;
const impuestos = calcularImpuestosIncluidos(lineas, territorio);

sep("FACTURA SIMPLIFICADA (Canarias · IGIC)");
console.log("Bar La Palma — NIF B12345678");
for (const l of lineas) console.log(`  ${formatImporte(l.importe)} €  (${l.tipo}%)`);
console.log("Desglose de impuestos:");
for (const d of impuestos.desglose) {
  console.log(
    `  ${impuestos.impuesto} ${d.tipo}%  base ${formatImporte(d.base)}  cuota ${formatImporte(d.cuota)}`,
  );
}
console.log(`TOTAL: ${formatImporte(impuestos.importeTotal)} €`);

// ── 2. Registro VERIFACTU encadenado ───────────────────────────────────
const nif = "B12345678";
const numSerie = "F2-2026-000123";
const fecha = "12-06-2026";

const cadena = encadenarRegistros(
  [
    {
      idEmisorFactura: nif,
      numSerieFactura: numSerie,
      fechaExpedicionFactura: fecha,
      tipoFactura: "F2", // factura simplificada (ticket)
      cuotaTotal: formatImporte(impuestos.cuotaTotal),
      importeTotal: formatImporte(impuestos.importeTotal),
      fechaHoraHusoGenRegistro: "2026-06-12T21:05:00+01:00",
    },
  ],
  // huella de la última factura del dispositivo (vacío = primera de la cadena)
  "",
);

const registro = cadena[0]!;
sep("REGISTRO VERIFACTU");
console.log("Huella (SHA-256):", registro.huella);
console.log("Huella anterior :", registro.huellaRegistroAnterior || "(primera)");

// ── 3. QR de cotejo ────────────────────────────────────────────────────
const urlQR = construirUrlQR({
  nif,
  numSerieFactura: numSerie,
  fechaExpedicion: fecha,
  importeTotal: formatImporte(impuestos.importeTotal),
  entorno: "pruebas",
});

sep("CÓDIGO QR DE LA FACTURA");
console.log("Leyenda :", LEYENDA_VERIFACTU);
console.log("Contenido del QR (URL de cotejo AEAT):");
console.log("  " + urlQR);

sep();
console.log("✅ Demo completada. El QR codifica la URL anterior; para generar la");
console.log("   imagen del QR usar una librería (p. ej. 'qrcode') con ese contenido.");
console.log("   Para enviar el registro a la AEAT se requiere el web service XML +");
console.log("   certificado electrónico (ver docs/07 §3.4).");
