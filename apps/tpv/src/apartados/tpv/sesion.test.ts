import { describe, it, expect } from "vitest";
import {
  reducirSesion, operarioActivo, sellarAtribucion, DORMIDO,
  type EstadoTerminal, type Operario,
} from "./sesion";

const MARIA: Operario = { id: "u-maria", nombre: "María Ruiz", rol: "admin" };
const BERTO: Operario = { id: "u-berto", nombre: "Berto Sanz", rol: "operario" };

const activa = (op: Operario): EstadoTerminal => reducirSesion(DORMIDO, { tipo: "identificar", operario: op });

describe("reducirSesion", () => {
  it("el terminal arranca dormido: nadie operando", () => {
    expect(operarioActivo(DORMIDO)).toBeNull();
  });

  it("identificarse desde dormido deja al operario activo", () => {
    expect(operarioActivo(activa(MARIA))).toEqual(MARIA);
  });

  it("★ el velo CONSERVA la cuenta: bloquear y desbloquear al mismo lo deja igual", () => {
    // El reducer ni conoce la comanda, así que velar no puede perderla; y
    // desbloquear al mismo operario restaura el estado activo tal cual.
    const velado = reducirSesion(activa(MARIA), { tipo: "bloquear" });
    expect(velado).toEqual({ fase: "velado", operario: MARIA });
    expect(operarioActivo(velado)).toBeNull();               // velado = nadie opera hasta meter PIN
    const vuelta = reducirSesion(velado, { tipo: "desbloquear", operario: MARIA });
    expect(vuelta).toEqual(activa(MARIA));
  });

  it("★ desbloquear con OTRO PIN cambia de camarero sin cerrar la mesa", () => {
    const velado = reducirSesion(activa(MARIA), { tipo: "bloquear" });
    const releva = reducirSesion(velado, { tipo: "desbloquear", operario: BERTO });
    expect(operarioActivo(releva)).toEqual(BERTO);
  });

  it("identificarse NO roba una sesión activa (hay que velar primero)", () => {
    const conMaria = activa(MARIA);
    expect(reducirSesion(conMaria, { tipo: "identificar", operario: BERTO })).toEqual(conMaria);
  });

  it("«Salir» devuelve el terminal a dormido desde cualquier fase", () => {
    expect(reducirSesion(activa(MARIA), { tipo: "salir" })).toEqual(DORMIDO);
    const velado = reducirSesion(activa(MARIA), { tipo: "bloquear" });
    expect(reducirSesion(velado, { tipo: "salir" })).toEqual(DORMIDO);
  });

  it("bloquear estando dormido no inventa un operario", () => {
    expect(reducirSesion(DORMIDO, { tipo: "bloquear" })).toEqual(DORMIDO);
  });
});

describe("sellarAtribucion", () => {
  it("sella las líneas nuevas con el operario activo", () => {
    expect(sellarAtribucion({}, ["cana", "menu"], MARIA.id)).toEqual({ cana: MARIA.id, menu: MARIA.id });
  });

  it("★ cambiar de camarero NO reescribe lo que ya metió el anterior", () => {
    // María abrió con caña + menú; entra Berto y añade café. Las dos primeras
    // SIGUEN siendo de María — de esto vive el informe de ventas por camarero.
    const deMaria = sellarAtribucion({}, ["cana", "menu"], MARIA.id);
    const conBerto = sellarAtribucion(deMaria, ["cana", "menu", "cafe"], BERTO.id);
    expect(conBerto).toEqual({ cana: MARIA.id, menu: MARIA.id, cafe: BERTO.id });
  });

  it("una línea añadida sobre otra existente sigue siendo de quien la abrió", () => {
    // Berto suma una caña a la línea de María: la línea entera sigue siendo suya.
    const deMaria = sellarAtribucion({}, ["cana"], MARIA.id);
    expect(sellarAtribucion(deMaria, ["cana"], BERTO.id)).toEqual({ cana: MARIA.id });
  });

  it("olvida las líneas anuladas para no crecer sin fin", () => {
    const previa = { cana: MARIA.id, menu: MARIA.id };
    expect(sellarAtribucion(previa, ["cana"], BERTO.id)).toEqual({ cana: MARIA.id });
  });

  it("con la comanda vacía, la atribución queda vacía", () => {
    expect(sellarAtribucion({ cana: MARIA.id }, [], BERTO.id)).toEqual({});
  });
});
