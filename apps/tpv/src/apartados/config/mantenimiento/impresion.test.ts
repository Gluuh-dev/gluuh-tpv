import { describe, it, expect } from "vitest";
import { elegirImpresora, explicarRuta, type Impresora, type Ruta } from "./impresion";

const imp = (id: string, rol: string, activa = true): Impresora => ({
  id, nombre: id, rol, transporte: "RED", destino: "192.168.1.1:9100",
  ancho: 48, tipo: "EPSON", activa,
});

const COCINA = imp("p-cocina", "COCINA");
const BARRA = imp("p-barra", "BARRA");
const TERRAZA = imp("p-terraza", "BARRA");
const TICKETS = imp("p-tickets", "TICKETS");
const TODAS = [COCINA, BARRA, TERRAZA, TICKETS];

const ruta = (estacion: string, roomId: string | null, printerId: string): Ruta =>
  ({ id: `${estacion}-${roomId}`, estacion, roomId, printerId });

describe("elegirImpresora", () => {
  it("sin reglas cae en la impresora del rol equivalente", () => {
    expect(elegirImpresora("COCINA", null, [], TODAS)).toBe("p-cocina");
    expect(elegirImpresora("BARRA", null, [], TODAS)).toBe("p-barra");
    // CAMARERO no tiene rol propio: lo prepara el camarero, sale por tickets.
    expect(elegirImpresora("CAMARERO", null, [], TODAS)).toBe("p-tickets");
  });

  it("LO CONCRETO GANA: la regla de la sala manda sobre la general", () => {
    const rutas = [ruta("BARRA", null, "p-barra"), ruta("BARRA", "sala-terraza", "p-terraza")];
    expect(elegirImpresora("BARRA", "sala-terraza", rutas, TODAS)).toBe("p-terraza");
    expect(elegirImpresora("BARRA", "sala-salon", rutas, TODAS)).toBe("p-barra");
  });

  it("la regla general se usa aunque la mesa esté en una sala sin regla propia", () => {
    expect(elegirImpresora("COCINA", "sala-x", [ruta("COCINA", null, "p-tickets")], TODAS)).toBe("p-tickets");
  });

  it("una impresora APAGADA no recibe por defecto", () => {
    const apagada = [imp("p-cocina", "COCINA", false), TICKETS];
    expect(elegirImpresora("COCINA", null, [], apagada)).toBeNull();
  });

  it("pero una regla EXPLÍCITA manda aunque la impresora esté apagada", () => {
    // A propósito: si el dueño la enrutó a mano, el problema es que está
    // apagada — y eso se ve en la lista, no se arregla desviando el papel a otro
    // sitio sin avisar.
    const apagada = [imp("p-cocina", "COCINA", false)];
    expect(elegirImpresora("COCINA", null, [ruta("COCINA", null, "p-cocina")], apagada)).toBe("p-cocina");
  });

  it("sin nada que aplique, null: no se inventa una impresora", () => {
    expect(elegirImpresora("COCINA", null, [], [])).toBeNull();
    expect(elegirImpresora("LOQUESEA", null, [], TODAS)).toBe("p-tickets");
  });
});

describe("explicarRuta", () => {
  it("dice por qué sale por ahí, que es lo que evita el error al configurar", () => {
    const rutas = [ruta("BARRA", null, "p-barra"), ruta("BARRA", "sala-terraza", "p-terraza")];
    expect(explicarRuta("BARRA", "sala-terraza", rutas, TODAS).motivo).toContain("esta sala");
    expect(explicarRuta("BARRA", "sala-salon", rutas, TODAS).motivo).toContain("general");
    expect(explicarRuta("COCINA", null, rutas, TODAS).motivo).toContain("Sin regla");
  });

  it("avisa cuando NO va a salir nada", () => {
    const r = explicarRuta("COCINA", null, [], []);
    expect(r.impresora).toBeNull();
    expect(r.motivo).toContain("no saldrá nada");
  });
});
