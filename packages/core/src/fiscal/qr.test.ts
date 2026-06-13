import { describe, it, expect } from "vitest";
import { generarQrVerifactuSvg, generarQrVerifactuDataUrl } from "./qr.js";

const factura = {
  nif: "B12345678",
  numSerieFactura: "F2-2026-000123",
  fechaExpedicion: "12-06-2026",
  importeTotal: "25.00",
  entorno: "pruebas" as const,
};

describe("QR VERIFACTU — imagen", () => {
  it("genera un SVG válido", async () => {
    const svg = await generarQrVerifactuSvg(factura);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("genera un data-URL PNG", async () => {
    const url = await generarQrVerifactuDataUrl(factura, { width: 200 });
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });
});
