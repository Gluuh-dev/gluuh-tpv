import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigGluuh } from "./config";

const NUBE = "https://gxcqihslbicrszgzudjs.supabase.co/storage/v1/object/public/media/t1/productos/foto.webp";

/**
 * Carga `urlFoto` con la configuración que le inyectaría el nodo (o sin ella, que es la
 * nube). Antes esto simulaba variables de compilación; ahora la configuración llega en
 * tiempo de ejecución, que es lo que permite una sola compilación para todos los bares.
 */
async function cargar(cfg: Partial<ConfigGluuh> | null) {
  vi.resetModules();
  if (cfg) {
    vi.stubGlobal("window", {
      __GLUUH__: { nodo: true, url: "", clave: "x", urlNube: "https://x.supabase.co", ...cfg },
      location: { origin: "http://192.168.1.50:54321" },
    });
  } else {
    vi.stubGlobal("window", { location: { origin: "https://app.gluuh.com" } });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://gxcqihslbicrszgzudjs.supabase.co");
  }
  return (await import("./urlFoto")).urlFoto;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("urlFoto — la carta tiene que verse tambien sin internet", () => {
  it("en la NUBE no toca nada (es la identidad)", async () => {
    const urlFoto = await cargar(null);
    expect(urlFoto(NUBE)).toBe(NUBE);
  });

  it("en el NODO reescribe el origen, conservando la ruta de la imagen", async () => {
    const urlFoto = await cargar({});
    expect(urlFoto(NUBE)).toBe(
      "http://192.168.1.50:54321/storage/v1/object/public/media/t1/productos/foto.webp",
    );
  });

  it("sin foto devuelve cadena vacia (nunca 'null' pintado en un <img>)", async () => {
    const urlFoto = await cargar({});
    expect(urlFoto(null)).toBe("");
    expect(urlFoto(undefined)).toBe("");
    expect(urlFoto("")).toBe("");
  });

  it("una URL que no es de Storage se deja intacta", async () => {
    const urlFoto = await cargar({});
    expect(urlFoto("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(urlFoto("https://otro.sitio/logo.png")).toBe("https://otro.sitio/logo.png");
  });

  it("funciona con CUALQUIER proyecto de Supabase (no lleva el ref a fuego)", async () => {
    const urlFoto = await cargar({ url: "http://nodo.local:54321" });
    const otra = "https://otroproyecto.supabase.co/storage/v1/object/public/media/x/y.png";
    expect(urlFoto(otra)).toBe("http://nodo.local:54321/storage/v1/object/public/media/x/y.png");
  });
});
