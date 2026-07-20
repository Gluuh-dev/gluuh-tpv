import { describe, it, expect, beforeEach } from "vitest";
import { useVenta } from "../store";
import { construirComandas, construirTicketPrueba, estacionDeCategoria, marcharPendientes } from "./ticket-impresion";

// Qué se prueba aquí y por qué:
//  · El ENRUTADO por estación: si una caña acaba en cocina y unas bravas en la
//    barra, el bar deja de funcionar.
//  · Que el TICKET CUADRE: la suma de las líneas impresas tiene que dar el total
//    que se cobra, con descuento y propina incluidos.
//  · Que `marcharPendientes` marque lo que manda (si no, se manda dos veces).
//    En Node no hay `window`, así que no imprime: solo calcula y marca.

const s = () => useVenta.getState();

describe("estación de cada producto", () => {
  it("las bebidas van a la barra", () => {
    expect(estacionDeCategoria("cervezas")).toBe("BARRA");
    expect(estacionDeCategoria("refrescos")).toBe("BARRA");
  });

  it("la comida y lo desconocido van a cocina", () => {
    expect(estacionDeCategoria("raciones")).toBe("COCINA");
    expect(estacionDeCategoria("")).toBe("COCINA");
  });
});

describe("construir las comandas", () => {
  it("separa una comanda por estación", () => {
    const comandas = construirComandas("Mesa 3", "María", [
      { id: "c1", cantidad: 2 },    // caña  → BARRA
      { id: "ra1", cantidad: 1 },   // bravas → COCINA
    ]);
    expect(comandas.map((c) => c.estacion).sort()).toEqual(["BARRA", "COCINA"]);

    const barra = comandas.find((c) => c.estacion === "BARRA")!;
    expect(barra.comanda.lineas).toEqual([{ cantidad: 2, nombre: "Caña" }]);
    expect(barra.comanda.contexto).toBe("Mesa 3");
    expect(barra.comanda.operario).toBe("María");
  });

  it("no crea comanda para una estación sin líneas", () => {
    const comandas = construirComandas("Barra", undefined, [{ id: "c1", cantidad: 1 }]);
    expect(comandas).toHaveLength(1);
    expect(comandas[0]!.estacion).toBe("BARRA");
  });

  it("ignora cantidades a cero y sin contexto cae a «Barra»", () => {
    const comandas = construirComandas("", undefined, [
      { id: "c1", cantidad: 0 },
      { id: "ra1", cantidad: 1 },
    ]);
    expect(comandas).toHaveLength(1);
    expect(comandas[0]!.comanda.contexto).toBe("Barra");
    expect(comandas[0]!.comanda.lineas).toHaveLength(1);
  });
});

describe("marchar solo lo pendiente", () => {
  beforeEach(() => s().iniciar("Mesa 5", 2, "Salón"));

  it("devuelve las estaciones a las que fue y deja la cuenta sin pendientes", () => {
    s().addProd("c1");
    s().addProd("ra1");
    const est = marcharPendientes({ operario: "María" });
    expect(est.sort()).toEqual(["BARRA", "COCINA"]);
    expect(s().pendientes()).toEqual([]);
  });

  it("marchar dos veces seguidas NO repite la comanda", () => {
    s().addProd("c1");
    marcharPendientes();
    expect(marcharPendientes()).toEqual([]);   // no hay nada nuevo
  });

  it("solo manda las líneas pedidas cuando se le pasan ids", () => {
    s().addProd("c1");
    s().addProd("ra1");
    expect(marcharPendientes({ ids: ["ra1"] })).toEqual(["COCINA"]);
    // La caña sigue sin marchar.
    expect(s().pendientes()).toEqual([{ id: "c1", cantidad: 1 }]);
  });

  it("no cobra ni vacía: la cuenta sigue abierta", () => {
    s().addProd("ra1");
    marcharPendientes();
    expect(s().total()).toBeGreaterThan(0);
    expect(Object.keys(s().comanda)).toHaveLength(1);
  });
});

describe("ticket del cliente", () => {
  beforeEach(() => s().iniciar("Mesa 7", 2, "Salón"));

  it("las líneas impresas suman el total que se cobra (con descuento y propina)", () => {
    s().addProd("c1");    // 1,80
    s().addProd("ra1");   // 6,00 → 7,80
    const descuento = 0.8, propina = 1;
    const total = 7.8 - descuento + propina;

    const t = construirTicketPrueba({
      contexto: "Mesa 7", operario: "María",
      baseImponible: total / 1.1, impuesto: total - total / 1.1,
      total, descuento, propina,
    });

    const suma = t.lineas.reduce((a, l) => a + l.importe, 0);
    expect(suma).toBeCloseTo(t.total, 2);
    expect(t.lineas.map((l) => l.nombre)).toContain("Descuento");
    expect(t.lineas.map((l) => l.nombre)).toContain("Propina");
  });

  it("sin descuento ni propina no inventa líneas", () => {
    s().addProd("c1");
    const t = construirTicketPrueba({ contexto: "Mesa 7", baseImponible: 1.64, impuesto: 0.16, total: 1.8 });
    expect(t.lineas).toHaveLength(1);
    expect(t.lineas[0]!.nombre).toBe("Caña");
  });

  it("una línea invitada va al ticket a cero (se ve, pero no se cobra)", () => {
    s().addProd("ra1");
    s().invitarLinea("ra1");
    const t = construirTicketPrueba({ contexto: "Mesa 7", baseImponible: 0, impuesto: 0, total: 0 });
    expect(t.lineas[0]!.importe).toBe(0);
  });

  it("es ticket de PRUEBA y sin QR ni huella (no toca fiscalidad)", () => {
    s().addProd("c1");
    const t = construirTicketPrueba({ contexto: "Barra", baseImponible: 1.64, impuesto: 0.16, total: 1.8 });
    expect(t.esPrueba).toBe(true);
    expect(t.qrUrl).toBeUndefined();
    expect(t.huella).toBeUndefined();
  });
});
