import { describe, it, expect } from "vitest";
import { puede, puedeAutorizar, type EstadoPerfil } from "./permisos";
import type { Operario } from "./sesion";

const MARIA: Operario = { id: "u-maria", nombre: "María Ruiz", rol: "admin" };
const BERTO: Operario = { id: "u-berto", nombre: "Berto Sanz", rol: "operario" };

describe("puede", () => {
  it("el administrador puede todo (es quien autoriza a los demás)", () => {
    expect(puede("admin", { estado: "sin-cargar" }, "borrar")).toBe(true);
    expect(puede("admin", { estado: "cargado", permisos: { borrar: false } }, "borrar")).toBe(true);
  });

  it("con perfil, ausente = permitido; solo false niega", () => {
    const perfil: EstadoPerfil = { estado: "cargado", permisos: { borrar: false } };
    expect(puede("operario", perfil, "descuento")).toBe(true);   // no está → permitido
    expect(puede("operario", perfil, "borrar")).toBe(false);     // false → negado
  });

  it("sin perfil configurado, el trabajador opera con normalidad", () => {
    expect(puede("operario", { estado: "sin-perfil" }, "descuento")).toBe(true);
  });

  it("★ si el perfil NO cargó (fallo de red), se DENIEGA lo sensible", () => {
    // El bug caro del Next: un error de carga tratado como "sin restricciones"
    // deja a cualquiera anulando y descontando. Fail-closed: pide PIN de más.
    expect(puede("operario", { estado: "sin-cargar" }, "borrar")).toBe(false);
    expect(puede("operario", { estado: "sin-cargar" }, "descuento")).toBe(false);
    // Salvo el admin, que puede aunque no haya perfil (es el responsable).
    expect(puede("admin", { estado: "sin-cargar" }, "borrar")).toBe(true);
  });
});

describe("puedeAutorizar", () => {
  it("un responsable (admin) autoriza acciones que a otro se le negaron", () => {
    expect(puedeAutorizar(MARIA, "descuento")).toBe(true);
  });

  it("★ un trabajador normal NO puede autorizarse a sí mismo ni a otro", () => {
    // Si un operario pudiera autorizar, la autorización de superior no valdría nada.
    expect(puedeAutorizar(BERTO, "descuento")).toBe(false);
    expect(puedeAutorizar(BERTO, "borrar")).toBe(false);
  });
});
