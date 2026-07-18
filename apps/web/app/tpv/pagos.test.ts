// Mapeo de pagos del cobro (ruta del dinero): clamp, propina y abrir cajón.
import { describe, it, expect } from "vitest";
import { mapearPagos, metodoPago, type FormaResuelta } from "./pagos";
import type { CobrarOpciones } from "./components/CobrarModal";

const formas: FormaResuelta[] = [
  { id: "ef", tipo: "EFECTIVO", abre_cajon: true },
  { id: "ta", tipo: "TARJETA", abre_cajon: false },
  { id: "va", tipo: "VALE", abre_cajon: false },
];
const opts = (o: Partial<CobrarOpciones> = {}): CobrarOpciones =>
  ({ imprimir: false, tipoDoc: "", propina: 0, descuento: 0, notas: "", enviarFactura: false, ...o });

describe("metodoPago", () => {
  it("mapea tipos conocidos y cae a WALLET", () => {
    expect(metodoPago("EFECTIVO")).toBe("EFECTIVO");
    expect(metodoPago("TARJETA")).toBe("TARJETA");
    expect(metodoPago("BIZUM")).toBe("BIZUM");
    expect(metodoPago("VALE")).toBe("WALLET");
    expect(metodoPago(undefined)).toBe("WALLET");
  });
});

describe("mapearPagos", () => {
  it("pago único en efectivo cubre el total y abre cajón", () => {
    const r = mapearPagos([{ formaPagoId: "ef", importe: 10 }], 10, opts(), formas);
    expect(r.filas).toEqual([{ metodo: "EFECTIVO", importe: 10, propina: 0 }]);
    expect(r.abrirCajon).toBe(true);
  });

  it("clampa cada importe al pendiente (no cobra de más)", () => {
    const r = mapearPagos([{ formaPagoId: "ta", importe: 999 }], 10, opts(), formas);
    expect(r.filas).toEqual([{ metodo: "TARJETA", importe: 10, propina: 0 }]);
    expect(r.abrirCajon).toBeUndefined();   // tarjeta no abre cajón
  });

  it("pago mixto: el segundo se clampa al restante", () => {
    const r = mapearPagos([{ formaPagoId: "ta", importe: 6 }, { formaPagoId: "ef", importe: 10 }], 10, opts(), formas);
    expect(r.filas).toEqual([
      { metodo: "TARJETA", importe: 6, propina: 0 },
      { metodo: "EFECTIVO", importe: 4, propina: 0 },
    ]);
    expect(r.abrirCajon).toBe(true);   // el efectivo abre cajón
  });

  it("la propina sube el debido y se descuenta del primer importe (no se doble-cuenta)", () => {
    // base 10 + propina 2 = due 12; pago 12 en efectivo → importe 10, propina 2
    const r = mapearPagos([{ formaPagoId: "ef", importe: 12 }], 10, opts({ propina: 2 }), formas);
    expect(r.filas).toEqual([{ metodo: "EFECTIVO", importe: 10, propina: 2 }]);
  });

  it("el descuento baja el debido", () => {
    const r = mapearPagos([{ formaPagoId: "ef", importe: 10 }], 10, opts({ descuento: 3 }), formas);
    expect(r.filas).toEqual([{ metodo: "EFECTIVO", importe: 7, propina: 0 }]);
  });

  it("ignora líneas que no aportan (importe 0 o pendiente ya saldado)", () => {
    const r = mapearPagos([{ formaPagoId: "ef", importe: 10 }, { formaPagoId: "ta", importe: 5 }], 10, opts(), formas);
    expect(r.filas).toHaveLength(1);
  });
});
