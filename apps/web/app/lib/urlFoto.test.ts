import { afterEach, describe, expect, it, vi } from "vitest";

const NUBE = "https://gxcqihslbicrszgzudjs.supabase.co/storage/v1/object/public/media/t1/productos/foto.webp";

async function cargar(modoNodo: boolean, urlNodo = "http://192.168.1.50:54321") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NODO_LOCAL", modoNodo ? "1" : "0");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", modoNodo ? urlNodo : "https://gxcqihslbicrszgzudjs.supabase.co");
  return (await import("./urlFoto")).urlFoto;
}

afterEach(() => vi.unstubAllEnvs());

describe("urlFoto — la carta tiene que verse tambien sin internet", () => {
  it("en la NUBE no toca nada (es la identidad)", async () => {
    const urlFoto = await cargar(false);
    expect(urlFoto(NUBE)).toBe(NUBE);
  });

  it("en el NODO reescribe el origen, conservando la ruta de la imagen", async () => {
    const urlFoto = await cargar(true);
    expect(urlFoto(NUBE)).toBe(
      "http://192.168.1.50:54321/storage/v1/object/public/media/t1/productos/foto.webp",
    );
  });

  it("sin foto devuelve cadena vacia (nunca 'null' pintado en un <img>)", async () => {
    const urlFoto = await cargar(true);
    expect(urlFoto(null)).toBe("");
    expect(urlFoto(undefined)).toBe("");
    expect(urlFoto("")).toBe("");
  });

  it("una URL que no es de Storage se deja intacta", async () => {
    const urlFoto = await cargar(true);
    expect(urlFoto("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(urlFoto("https://otro.sitio/logo.png")).toBe("https://otro.sitio/logo.png");
  });

  it("funciona con CUALQUIER proyecto de Supabase (no lleva el ref a fuego)", async () => {
    const urlFoto = await cargar(true, "http://nodo.local:54321");
    const otra = "https://otroproyecto.supabase.co/storage/v1/object/public/media/x/y.png";
    expect(urlFoto(otra)).toBe("http://nodo.local:54321/storage/v1/object/public/media/x/y.png");
  });
});
