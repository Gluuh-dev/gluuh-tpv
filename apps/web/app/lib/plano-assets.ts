// Catálogo de assets SVG del plano (en /public/plano). Las mesas usan variables
// CSS (--mesa-fill / --silla-fill) para poder elegir color; vía <img> se ve el
// color por defecto. ESCALA convierte el viewBox del SVG a píxeles del plano.
export interface PlanoAsset {
  id: string;
  file: string;
  nombre: string;
  tipo: "mesa" | "barra" | "planta" | "separador" | "abertura";
  w: number;   // ancho del viewBox
  h: number;   // alto del viewBox
  seats?: number;
}

export const ESCALA_PLANO = 0.2;

export const ASSETS: PlanoAsset[] = [
  { id: "mesa-4-cuadrada", file: "mesa-4-cuadrada.svg", nombre: "Mesa cuadrada 4", tipo: "mesa", w: 460.53, h: 464.78, seats: 4 },
  { id: "mesa-2-vertical", file: "mesa-2-vertical.svg", nombre: "Mesa 2", tipo: "mesa", w: 329, h: 464.78, seats: 2 },
  { id: "mesa-4-b", file: "mesa-4-b.svg", nombre: "Mesa 4 (b)", tipo: "mesa", w: 427.63, h: 431.57, seats: 4 },
  { id: "mesa-2-b", file: "mesa-2-b.svg", nombre: "Mesa 2 (b)", tipo: "mesa", w: 329, h: 431.57, seats: 2 },
  { id: "mesa-8-cuadrada", file: "mesa-8-cuadrada.svg", nombre: "Mesa cuadrada 8", tipo: "mesa", w: 772, h: 769.21, seats: 8 },
  { id: "mesa-6", file: "mesa-6.svg", nombre: "Mesa 6", tipo: "mesa", w: 784, h: 467.55, seats: 6 },
  { id: "mesa-8-larga", file: "mesa-8-larga.svg", nombre: "Mesa larga 8", tipo: "mesa", w: 1104.79, h: 464.78, seats: 8 },
  { id: "taburete", file: "taburete.svg", nombre: "Taburete", tipo: "mesa", w: 230, h: 230, seats: 1 },
  { id: "puerta", file: "puerta.svg", nombre: "Puerta", tipo: "abertura", w: 240, h: 130 },
  { id: "entrada", file: "entrada.svg", nombre: "Entrada", tipo: "abertura", w: 240, h: 160 },
  { id: "barra-recta", file: "barra-recta.svg", nombre: "Barra recta", tipo: "barra", w: 680.03, h: 212.83 },
  { id: "barra-esquina", file: "barra-esquina.svg", nombre: "Barra esquina", tipo: "barra", w: 676.41, h: 668.4 },
  { id: "planta-redonda", file: "planta-redonda.svg", nombre: "Planta / macetero", tipo: "planta", w: 165.38, h: 165.38 },
  { id: "jardinera-larga", file: "jardinera-larga.svg", nombre: "Jardinera", tipo: "planta", w: 374.63, h: 136.35 },
  { id: "jardinera-larga-b", file: "jardinera-larga-b.svg", nombre: "Jardinera (b)", tipo: "planta", w: 374.63, h: 136.35 },
  { id: "arbol", file: "arbol.svg", nombre: "Árbol / planta grande", tipo: "planta", w: 302.11, h: 288.37 },
  { id: "separador", file: "separador.svg", nombre: "Separador", tipo: "separador", w: 944.05, h: 39.17 },
];

export const SUELOS: { id: string; nombre: string }[] = [
  { id: "", nombre: "Liso" },
  { id: "suelo-madera", nombre: "Madera" },
  { id: "suelo-ceramica-clara", nombre: "Cerámica clara" },
  { id: "suelo-ceramica-oscura", nombre: "Cerámica oscura" },
  { id: "suelo-hormigon", nombre: "Hormigón" },
  { id: "suelo-terraza", nombre: "Terraza" },
];

export const assetPorId = (id?: string | null): PlanoAsset | undefined => ASSETS.find((a) => a.id === id);

// Mesa SVG según capacidad (cuando no se ha elegido sprite explícito).
export function mesaPorCapacidad(cap: number): PlanoAsset {
  const id = cap <= 1 ? "taburete" : cap >= 8 ? "mesa-8-larga" : cap >= 5 ? "mesa-6" : cap <= 2 ? "mesa-2-vertical" : "mesa-4-cuadrada";
  return ASSETS.find((a) => a.id === id)!;
}

// Tamaño en píxeles del plano para un asset.
export const dim = (a: PlanoAsset) => ({ w: Math.round(a.w * ESCALA_PLANO), h: Math.round(a.h * ESCALA_PLANO) });
