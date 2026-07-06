// Catálogo de assets SVG del plano (en /public/plano). Estilo unificado: mismas
// sillas, mismo borde y encaje. Las mesas usan variables CSS (--mesa-fill /
// --silla-fill) para elegir color. ESCALA convierte el viewBox a píxeles del plano.
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

// Se sube al cambiar cualquier SVG del plano: fuerza al navegador a recargarlos
// (evita ver versiones cacheadas). Añadir `?v=${PLANO_VER}` a las URLs de /plano.
export const PLANO_VER = "6";

export const ASSETS: PlanoAsset[] = [
  // ── Mesas (el color va por --mesa-fill). Familia rectangular: misma profundidad, más larga a más comensales ──
  { id: "taburete", file: "taburete.svg", nombre: "Taburete", tipo: "mesa", w: 200, h: 200, seats: 1 },
  { id: "mesa-2", file: "mesa-2.svg", nombre: "Cuadrada 2", tipo: "mesa", w: 400, h: 400, seats: 2 },
  { id: "mesa-4", file: "mesa-4.svg", nombre: "Cuadrada 4", tipo: "mesa", w: 400, h: 400, seats: 4 },
  { id: "mesa-6", file: "mesa-6.svg", nombre: "Rectangular 6", tipo: "mesa", w: 800, h: 400, seats: 6 },
  { id: "mesa-8", file: "mesa-8.svg", nombre: "Rectangular 8", tipo: "mesa", w: 1200, h: 400, seats: 8 },
  { id: "mesa-redonda-4", file: "mesa-redonda-4.svg", nombre: "Redonda 4", tipo: "mesa", w: 400, h: 400, seats: 4 },
  { id: "mesa-redonda-6", file: "mesa-redonda-6.svg", nombre: "Redonda 6", tipo: "mesa", w: 800, h: 800, seats: 6 },
  { id: "mesa-toldo", file: "mesa-toldo.svg", nombre: "Sombrilla", tipo: "mesa", w: 450, h: 450, seats: 4 },
  { id: "mesa-toldo-2", file: "mesa-toldo-2.svg", nombre: "Sombrilla 2", tipo: "mesa", w: 500, h: 500, seats: 4 },
  { id: "mesa-hamaca", file: "mesa-hamaca.svg", nombre: "Hamaca", tipo: "mesa", w: 300, h: 612, seats: 1 },
  // ── Barra modular (encaja sin cortes: extremos abiertos) ──
  { id: "barra2-recta", file: "barra2-recta.svg", nombre: "Barra recta", tipo: "barra", w: 800, h: 200 },
  { id: "barra2-esquina", file: "barra2-esquina.svg", nombre: "Barra esquina", tipo: "barra", w: 400, h: 400 },
  { id: "barra2-fin", file: "barra2-fin.svg", nombre: "Barra fin", tipo: "barra", w: 200, h: 200 },
  // ── Objetos ──
  { id: "planta-redonda", file: "planta-redonda.svg", nombre: "Planta / macetero", tipo: "planta", w: 165.38, h: 165.38 },
  { id: "jardinera-larga", file: "jardinera-larga.svg", nombre: "Jardinera", tipo: "planta", w: 374.63, h: 136.35 },
  { id: "arbol", file: "arbol.svg", nombre: "Árbol / planta grande", tipo: "planta", w: 302.11, h: 288.37 },
  { id: "cactus", file: "cactus.svg", nombre: "Cactus", tipo: "planta", w: 160, h: 220 },
  { id: "planta-a", file: "planta-a.svg", nombre: "Planta alta", tipo: "planta", w: 110, h: 550 },
  { id: "planta-c", file: "planta-c.svg", nombre: "Arbusto", tipo: "planta", w: 275, h: 273 },
  { id: "planta-d", file: "planta-d.svg", nombre: "Flor", tipo: "planta", w: 275, h: 270 },
  { id: "planta-e", file: "planta-e.svg", nombre: "Macetero", tipo: "planta", w: 240, h: 233 },
  { id: "muro-gris", file: "muro-gris.svg", nombre: "Muro gris", tipo: "separador", w: 500, h: 80 },
  { id: "muro-blanco", file: "muro-blanco.svg", nombre: "Muro blanco", tipo: "separador", w: 500, h: 80 },
  { id: "muro-madera", file: "muro-madera.svg", nombre: "Muro madera", tipo: "separador", w: 500, h: 80 },
  { id: "muro-negro", file: "muro-negro.svg", nombre: "Muro negro", tipo: "separador", w: 500, h: 80 },
  { id: "separador", file: "separador.svg", nombre: "Línea fina", tipo: "separador", w: 944.05, h: 39.17 },
  { id: "puerta", file: "puerta.svg", nombre: "Puerta", tipo: "abertura", w: 800, h: 433 },
  { id: "entrada", file: "entrada.svg", nombre: "Entrada", tipo: "abertura", w: 700, h: 467 },
  // ── Legacy (solo para resolver planos ya guardados; no salen en la paleta) ──
  { id: "barra-recta", file: "barra-recta.svg", nombre: "Barra recta", tipo: "barra", w: 680.03, h: 212.83 },
  { id: "barra-esquina", file: "barra-esquina.svg", nombre: "Barra esquina", tipo: "barra", w: 676.41, h: 668.4 },
  { id: "jardinera-larga-b", file: "jardinera-larga-b.svg", nombre: "Jardinera", tipo: "planta", w: 374.63, h: 136.35 },
];

// IDs que NO se ofrecen en la paleta (legacy), aunque sí se resuelven al renderizar.
export const ASSETS_LEGACY = new Set(["barra-recta", "barra-esquina", "jardinera-larga-b", "separador"]);

// Formas de mesa elegibles al crear/editar (además de la que da la capacidad).
// `sprite` null = usa la forma por defecto de esa capacidad.
export const FORMAS_MESA: { sprite: string | null; seats: number; file: string; nombre: string }[] = [
  { sprite: null, seats: 1, file: "taburete.svg", nombre: "Taburete" },
  { sprite: null, seats: 2, file: "mesa-2.svg", nombre: "Cuadrada 2" },
  { sprite: null, seats: 4, file: "mesa-4.svg", nombre: "Cuadrada 4" },
  { sprite: null, seats: 6, file: "mesa-6.svg", nombre: "Rectang. 6" },
  { sprite: "mesa-redonda-4", seats: 4, file: "mesa-redonda-4.svg", nombre: "Redonda 4" },
  { sprite: "mesa-redonda-6", seats: 6, file: "mesa-redonda-6.svg", nombre: "Redonda 6" },
  { sprite: "mesa-toldo", seats: 4, file: "mesa-toldo.svg", nombre: "Sombrilla" },
  { sprite: "mesa-toldo-2", seats: 4, file: "mesa-toldo-2.svg", nombre: "Sombrilla 2" },
  { sprite: "mesa-hamaca", seats: 1, file: "mesa-hamaca.svg", nombre: "Hamaca" },
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

// Mesa SVG según capacidad (forma por defecto cuando no hay sprite explícito).
export function mesaPorCapacidad(cap: number): PlanoAsset {
  let id: string;
  if (cap <= 1) id = "taburete";
  else if (cap <= 2) id = "mesa-2";
  else if (cap <= 4) id = "mesa-4";
  else if (cap <= 6) id = "mesa-6";
  else id = "mesa-8";
  return ASSETS.find((a) => a.id === id)!;
}

// Tamaño en píxeles del plano para un asset.
export const dim = (a: PlanoAsset) => ({ w: Math.round(a.w * ESCALA_PLANO), h: Math.round(a.h * ESCALA_PLANO) });
