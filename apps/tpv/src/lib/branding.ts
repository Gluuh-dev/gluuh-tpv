// Marca del cliente: LOGO y COLOR. Por defecto es la marca Gluuh; cuando el
// dueño suba su logo y/o elija su color desde Configuración, estos valores lo
// sustituyen en TODA la app (el logo por el componente <Marca>, el color por las
// variables CSS --brand/--brand-lit que usa todo el diseño).
//
// Hoy devuelve los valores por defecto; el cableado a la config del nodo (setting
// del tenant) vendrá después — la forma no cambia.

export interface Marca {
  /** Logo del cliente (URL). null = usar el de Gluuh por defecto. */
  logoUrl: string | null;
  brand: string;
  brandLit: string;
}

/** Logo por defecto de Gluuh (según el tema) mientras el cliente no suba el suyo:
 *  en claro el logo a color, en oscuro el monocolor blanco. */
export const LOGO_GLUUH_CLARO = "/logo.svg";
export const LOGO_GLUUH_OSCURO = "/logo-gluuh-monocolor.svg";

export const MARCA_DEFECTO: Marca = { logoUrl: null, brand: "#572370", brandLit: "#7c3d9b" };

/** Temas de color que el cliente puede elegir (Configuración → color de marca). */
export const PRESETS_MARCA: ReadonlyArray<{ nombre: string; brand: string; brandLit: string }> = [
  { nombre: "Gluuh (morado)", brand: "#572370", brandLit: "#7c3d9b" },
  { nombre: "Rubí", brand: "#a11d3a", brandLit: "#d13b57" },
  { nombre: "Océano", brand: "#134e8b", brandLit: "#2f7fd0" },
  { nombre: "Bosque", brand: "#1f6b46", brandLit: "#2ea06a" },
  { nombre: "Cobre", brand: "#9a4a15", brandLit: "#d0803a" },
  { nombre: "Grafito", brand: "#33383f", brandLit: "#5a636e" },
];

export function logoSrc(m: Marca, oscuro: boolean): string {
  return m.logoUrl ?? (oscuro ? LOGO_GLUUH_OSCURO : LOGO_GLUUH_CLARO);
}

/** Escribe el color de marca en las variables CSS (recolorea toda la app). */
export function aplicarColorMarca(brand: string, brandLit: string): void {
  const s = document.documentElement.style;
  s.setProperty("--brand", brand);
  s.setProperty("--brand-lit", brandLit);
}
