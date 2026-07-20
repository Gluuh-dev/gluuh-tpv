import { describe, it, expect } from "vitest";
import { formatearTicket, formatearComanda, type TicketImpresion } from "./impresion";

// El formateo se portó del TPV de Next (ya probado allí), pero aquí se fijan las
// INVARIANTES que no se pueden romper nunca al tocarlo:
//   · una comanda de cocina JAMÁS lleva precios (el cocinero no cobra);
//   · un ticket de prueba tiene que decir que no vale como factura;
//   · la cuenta (proforma) tiene que decir que NO es factura;
//   · el ancho de papel manda: 58 mm = 32 columnas, 80 mm = 42.

const TICKET: TicketImpresion = {
  local: { nombre: "Bar La Alameda", cif: "B00000000" },
  contexto: "Mesa 3",
  operario: "María",
  lineas: [
    { cantidad: 2, nombre: "Caña", importe: 3.6 },
    { cantidad: 1, nombre: "Patatas bravas", importe: 6 },
  ],
  desglose: [{ etiqueta: "IGIC 7 %", cuota: 0.63 }],
  total: 9.6,
  esPrueba: true,
};

describe("ticket del cliente", () => {
  it("lleva el local, el contexto, las líneas y el TOTAL", () => {
    const l = formatearTicket(TICKET).join("\n");
    expect(l).toContain("BAR LA ALAMEDA");
    expect(l).toContain("Mesa 3");
    expect(l).toContain("Caña");
    expect(l).toContain("TOTAL");
    expect(l).toContain("9,60 EUR");        // en euros, con coma decimal
  });

  it("un ticket de prueba avisa de que no tiene validez fiscal", () => {
    expect(formatearTicket(TICKET).join("\n")).toContain("SIN VALIDEZ FISCAL");
  });

  it("la cuenta (proforma) avisa de que NO es una factura", () => {
    const l = formatearTicket({ ...TICKET, proforma: true }).join("\n");
    expect(l).toContain("CUENTA - NO ES FACTURA");
    expect(l).toContain("Pida en caja");     // el pie cambia
  });

  it("el ancho de papel decide las columnas (58 mm = 32, 80 mm = 42)", () => {
    const raya = (mm: 58 | 80) =>
      formatearTicket(TICKET, { anchoMm: mm }).find((x) => x.startsWith("="))!;
    expect(raya(58)).toHaveLength(32);
    expect(raya(80)).toHaveLength(42);
  });

  it("se pueden apagar bloques desde el diseño", () => {
    const l = formatearTicket(TICKET, { desglose: false, cif: false }).join("\n");
    expect(l).not.toContain("IGIC 7 %");
    expect(l).not.toContain("CIF:");
  });

  it("un nombre largo no desborda el papel", () => {
    const largo = { ...TICKET, lineas: [{ cantidad: 1, nombre: "Bocadillo de calamares con alioli y pimientos del padrón", importe: 8.5 }] };
    for (const linea of formatearTicket(largo, { anchoMm: 58 })) {
      expect(linea.length).toBeLessThanOrEqual(32);
    }
  });
});

describe("comanda de cocina", () => {
  const COMANDA = {
    contexto: "Mesa 3",
    operario: "María",
    lineas: [{ cantidad: 2, nombre: "Patatas bravas" }, { cantidad: 1, nombre: "Calamares", nota: "sin sal" }],
  };

  it("NUNCA lleva precios (invariante: el cocinero no cobra)", () => {
    const l = formatearComanda(COMANDA, "COMANDA · COCINA").join("\n");
    expect(l).not.toContain("EUR");
    expect(l).not.toMatch(/\d+,\d{2}/);      // ningún importe con decimales
  });

  it("lleva el título, la mesa, el camarero y las cantidades", () => {
    const l = formatearComanda(COMANDA, "COMANDA · COCINA").join("\n");
    expect(l).toContain("COMANDA · COCINA");
    expect(l).toContain("Mesa 3");
    expect(l).toContain("Camarero: María");
    expect(l).toContain("2 x Patatas bravas");
  });

  it("las notas del plato salen debajo, marcadas", () => {
    expect(formatearComanda(COMANDA, "COCINA").join("\n")).toContain("> sin sal");
  });

  it("un aviso de la cuenta sale destacado", () => {
    const l = formatearComanda({ ...COMANDA, nota: "alergia al marisco" }, "COCINA").join("\n");
    expect(l).toContain("** AVISO: alergia al marisco **");
  });
});
