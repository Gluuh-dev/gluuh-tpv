import { describe, it, expect } from "vitest";
import { rutaDeUrl, urlDeRuta } from "./rutas";

describe("rutaDeUrl", () => {
  it("lee apartado y sección", () => {
    expect(rutaDeUrl("/config/productos")).toEqual({ vista: "config", seccion: "productos" });
    expect(rutaDeUrl("/tpv")).toEqual({ vista: "tpv" });
    expect(rutaDeUrl("/")).toEqual({ vista: "inicio" });
  });

  it("una vista desconocida cae a inicio, no a una pantalla en blanco", () => {
    expect(rutaDeUrl("/loquesea")).toEqual({ vista: "inicio" });
    expect(rutaDeUrl("/loquesea/mas")).toEqual({ vista: "inicio" });
  });

  it("aguanta barras de más y de menos", () => {
    expect(rutaDeUrl("//config//productos//")).toEqual({ vista: "config", seccion: "productos" });
    expect(rutaDeUrl("")).toEqual({ vista: "inicio" });
  });
});

describe("urlDeRuta", () => {
  it("inicio es la raíz, no /inicio", () => {
    expect(urlDeRuta({ vista: "inicio" })).toBe("/");
  });

  it("ida y vuelta", () => {
    for (const url of ["/", "/tpv", "/config", "/config/impresoras", "/admin", "/nodo"]) {
      expect(urlDeRuta(rutaDeUrl(url))).toBe(url);
    }
  });
});

describe("ficha concreta: /config/productos/<id>", () => {
  it("lee el id del tercer segmento", () => {
    expect(rutaDeUrl("/config/productos/abc-123"))
      .toEqual({ vista: "config", seccion: "productos", id: "abc-123" });
  });

  it("ida y vuelta con id", () => {
    const url = "/config/productos/11111111-1111-1111-1111-111111111111";
    expect(urlDeRuta(rutaDeUrl(url))).toBe(url);
  });

  it("un id sin sección no fabrica una URL que luego no se sabe leer", () => {
    expect(urlDeRuta({ vista: "config", id: "abc" })).toBe("/config");
  });
});
