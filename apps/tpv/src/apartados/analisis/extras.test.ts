import { describe, it, expect } from "vitest";
import {
  alergenosDe, sinDeclarar, horasDe, asistenciaDe, porTipoNoVenta,
  type Fichaje, type NoVenta,
} from "./extras";

describe("alergenosDe", () => {
  const ART = [
    { nombre: "Croquetas", familia: "Cocina" },
    { nombre: "Agua", familia: "Bebidas" },
  ];

  it("★ una ficha vacía es «SIN DECLARAR», nunca «no tiene alérgenos»", () => {
    // La columna es NOT NULL DEFAULT '{}', así que vacío puede ser «no lleva
    // ninguno» o «nadie lo ha rellenado» y no se distinguen. Decirle a un bar que
    // su plato está limpio cuando nadie lo ha mirado es el error caro de aquí.
    const [croquetas, agua] = alergenosDe(ART, { Croquetas: ["Gluten", "Lácteos"] });
    expect(croquetas!.declarado).toBe(true);
    expect(agua!.declarado).toBe(false);
    expect(agua!.alergenos).toEqual([]);
  });

  it("cuenta los que faltan por declarar", () => {
    expect(sinDeclarar(alergenosDe(ART, { Croquetas: ["Gluten"] }))).toBe(1);
  });

  it("no comparte el array con la ficha (no se puede mutar por detrás)", () => {
    const ficha = { Croquetas: ["Gluten"] };
    alergenosDe(ART, ficha)[0]!.alergenos.push("Soja");
    expect(ficha.Croquetas).toEqual(["Gluten"]);
  });
});

describe("horasDe", () => {
  it("★ un turno de noche cruza medianoche sin dar horas negativas", () => {
    // Entrar a las 20:00 y salir a las 02:30 es LO NORMAL en hostelería.
    expect(horasDe({ operario: "A", entrada: "2026-07-20T20:00", salida: "2026-07-20T02:30" })).toBe(6.5);
  });

  it("un turno normal sale bien", () => {
    expect(horasDe({ operario: "A", entrada: "2026-07-20T08:00", salida: "2026-07-20T16:30" })).toBe(8.5);
  });

  it("★ un turno abierto son «horas desconocidas», NO cero", () => {
    // Con cero, a quien está trabajando ahora mismo se le hunde la media del mes.
    expect(horasDe({ operario: "A", entrada: "2026-07-20T08:00", salida: null })).toBeNull();
  });

  it("una fecha ilegible no revienta la pantalla", () => {
    expect(horasDe({ operario: "A", entrada: "ayer", salida: "hoy" })).toBeNull();
  });
});

describe("asistenciaDe", () => {
  const F: Fichaje[] = [
    { operario: "María", entrada: "2026-07-20T08:00", salida: "2026-07-20T16:00" },
    { operario: "María", entrada: "2026-07-21T08:00", salida: "2026-07-21T14:00" },
    { operario: "Berto", entrada: "2026-07-20T20:00", salida: null },
  ];

  it("suma las horas por operario", () => {
    expect(asistenciaDe(F)[0]).toEqual({ operario: "María", turnos: 2, horas: 14, abiertos: 0 });
  });

  it("★ el turno abierto se cuenta como turno pero no suma 0 horas", () => {
    const berto = asistenciaDe(F).find((a) => a.operario === "Berto")!;
    expect(berto.turnos).toBe(1);
    expect(berto.abiertos).toBe(1);
    expect(berto.horas).toBe(0);          // no ha cerrado: no hay horas que sumar todavía
  });

  it("sin fichajes, lista vacía", () => {
    expect(asistenciaDe([])).toEqual([]);
  });
});

describe("porTipoNoVenta", () => {
  const N: NoVenta[] = [
    { tipo: "INVITACION", concepto: "Menú", operario: "María", motivo: "Cliente habitual", importe: 13 },
    { tipo: "INVITACION", concepto: "Café", operario: "Berto", motivo: "Queja", importe: 1.3 },
    { tipo: "MERMA", concepto: "Croquetas", operario: "Lucía", motivo: "Se cayó", importe: 8.4 },
  ];

  it("agrupa por tipo, con el número y el importe", () => {
    expect(porTipoNoVenta(N)).toEqual([
      { tipo: "INVITACION", n: 2, importe: 14.3 },
      { tipo: "MERMA", n: 1, importe: 8.4 },
    ]);
  });

  it("★ el total de no-venta NO se mezcla con las ventas", () => {
    // La jornada del nodo lo dice: invitaciones y autoconsumo no son venta.
    // Sumarlo a la caja descuadraría el arqueo y el libro de facturación.
    // Se redondea al sumar los grupos, como hace la tabla: 14,30 + 8,40 en coma
    // flotante da 22,700000000000003, y en un informe de dinero eso se ve.
    const total = Math.round(porTipoNoVenta(N).reduce((a, t) => a + t.importe, 0) * 100) / 100;
    expect(total).toBe(22.7);
    expect(total).not.toBe(0);            // se mide, pero vive en su propia tabla
  });

  it("sin operaciones, lista vacía", () => {
    expect(porTipoNoVenta([])).toEqual([]);
  });
});
