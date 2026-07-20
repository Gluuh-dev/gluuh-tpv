import { describe, it, expect } from "vitest";
import { lineasQueSalenEnComanda } from "./comanda";

const l = (id: string, productId: string | null, precio: number) =>
  ({ id, productId, precio, cantidad: 1 });

// «p-invita» es el único artículo marcado como «no imprimir si vale 0».
const marcado = (pid: string) => pid === "p-invita";

describe("lineasQueSalenEnComanda", () => {
  it("una línea normal sale", () => {
    const r = lineasQueSalenEnComanda([l("a", "p1", 4.5)], marcado);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("a 0 € Y con el flag: NO sale (la invitación no ensucia la comanda)", () => {
    const r = lineasQueSalenEnComanda([l("a", "p-invita", 0)], marcado);
    expect(r).toEqual([]);
  });

  it("a 0 € pero SIN el flag: SÍ sale — cocina tiene que prepararlo igual", () => {
    // Una tapa de la casa vale 0 y hay que hacerla.
    const r = lineasQueSalenEnComanda([l("a", "p1", 0)], marcado);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("con el flag pero CON precio: sale, es una venta normal", () => {
    const r = lineasQueSalenEnComanda([l("a", "p-invita", 3)], marcado);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("ante la duda, IMPRIME: un menú (sin productId) a 0 sale igual", () => {
    // Una comanda de más se tira; una de menos es un cliente esperando un plato
    // que nadie está haciendo.
    const r = lineasQueSalenEnComanda([l("a", null, 0)], marcado);
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("no toca el resto de la comanda", () => {
    const r = lineasQueSalenEnComanda(
      [l("a", "p1", 4), l("b", "p-invita", 0), l("c", "p2", 2)], marcado);
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });
});
