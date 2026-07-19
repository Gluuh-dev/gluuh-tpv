// Datos DEMO de la operativa (salas, mesas, catálogo). Se reemplazan por los del
// nodo (catalogo-store + jornada) al cablear; los TIPOS son los que se conservan.

export type EstadoMesa = "LIBRE" | "OCUPADA" | "POR_COBRAR";

export interface Mesa {
  id: string;
  nombre: string;
  estado: EstadoMesa;
  comensales?: number;
  total?: number;
  /** Minutos desde que se abrió (para avisar de mesas "dormidas"). */
  abiertaMin?: number;
}

export interface Sala {
  id: string;
  nombre: string;
  mesas: Mesa[];
}

export const SALAS_DEMO: Sala[] = [
  {
    id: "salon", nombre: "Salón",
    mesas: [
      { id: "s1", nombre: "1", estado: "OCUPADA", comensales: 2, total: 24.5, abiertaMin: 18 },
      { id: "s2", nombre: "2", estado: "LIBRE" },
      { id: "s3", nombre: "3", estado: "POR_COBRAR", comensales: 4, total: 63.2, abiertaMin: 72 },
      { id: "s4", nombre: "4", estado: "LIBRE" },
      { id: "s5", nombre: "5", estado: "OCUPADA", comensales: 3, total: 41.8, abiertaMin: 34 },
      { id: "s6", nombre: "6", estado: "LIBRE" },
      { id: "s7", nombre: "7", estado: "OCUPADA", comensales: 2, total: 12.0, abiertaMin: 6 },
      { id: "s8", nombre: "8", estado: "LIBRE" },
      { id: "s9", nombre: "9", estado: "LIBRE" },
      { id: "s10", nombre: "10", estado: "POR_COBRAR", comensales: 2, total: 28.9, abiertaMin: 51 },
      { id: "s11", nombre: "11", estado: "LIBRE" },
      { id: "s12", nombre: "12", estado: "LIBRE" },
    ],
  },
  {
    id: "terraza", nombre: "Terraza",
    mesas: [
      { id: "t1", nombre: "T1", estado: "OCUPADA", comensales: 4, total: 55.0, abiertaMin: 22 },
      { id: "t2", nombre: "T2", estado: "LIBRE" },
      { id: "t3", nombre: "T3", estado: "LIBRE" },
      { id: "t4", nombre: "T4", estado: "OCUPADA", comensales: 6, total: 88.4, abiertaMin: 40 },
      { id: "t5", nombre: "T5", estado: "LIBRE" },
      { id: "t6", nombre: "T6", estado: "LIBRE" },
    ],
  },
  { id: "barra", nombre: "Barra", mesas: [] },
];

// ── Catálogo demo (para la pantalla de venta) ────────────────────────────────
// Colores por familia como en el TPV real: azul bebidas, rojo comida, morado
// dulces, gris menús. "Populares" es una familia destacada (favoritos).
export interface Categoria { id: string; nombre: string; color: string }
export interface Producto { id: string; nombre: string; precio: number; categoria: string }

const AZUL = "#2f7fd0", ROJO = "#c0553f", MORADO = "#7c3d9b", GRIS = "#3b414d", VERDE = "#2ea06a";

export const CATEGORIAS_DEMO: Categoria[] = [
  { id: "populares", nombre: "Populares", color: VERDE },
  { id: "menus", nombre: "Menús", color: GRIS },
  { id: "cervezas", nombre: "Cervezas", color: AZUL },
  { id: "vinos", nombre: "Vinos", color: AZUL },
  { id: "refrescos", nombre: "Refrescos", color: AZUL },
  { id: "cafes", nombre: "Cafés e infusiones", color: AZUL },
  { id: "cocteles", nombre: "Cócteles", color: AZUL },
  { id: "raciones", nombre: "Raciones", color: ROJO },
  { id: "hamburguesas", nombre: "Hamburguesas", color: ROJO },
  { id: "bocadillos", nombre: "Bocadillos", color: ROJO },
  { id: "pizzas", nombre: "Pizzas", color: ROJO },
  { id: "postres", nombre: "Postres", color: MORADO },
  { id: "bolleria", nombre: "Bollería", color: MORADO },
];

export function colorCategoria(id: string): string {
  return CATEGORIAS_DEMO.find((c) => c.id === id)?.color ?? "#64748b";
}

// Modificadores demo (extras con precio + comentarios) por producto. Al tocar un
// producto con modificadores se abre el modal en vez de añadirlo directo.
export interface GrupoMod { titulo: string; tipo: "comentario" | "extra"; opciones: { nombre: string; precio?: number }[] }

const EXTRAS_BURGER: GrupoMod[] = [
  { titulo: "Punto de la carne", tipo: "comentario", opciones: [{ nombre: "Poco hecha" }, { nombre: "Al punto" }, { nombre: "Muy hecha" }] },
  { titulo: "Extras", tipo: "extra", opciones: [{ nombre: "Bacon", precio: 1 }, { nombre: "Extra queso", precio: 0.8 }, { nombre: "Huevo", precio: 1 }, { nombre: "Cebolla caramelizada", precio: 0.6 }] },
  { titulo: "Quitar", tipo: "comentario", opciones: [{ nombre: "Sin cebolla" }, { nombre: "Sin tomate" }, { nombre: "Sin salsa" }] },
];

export const MODIFICADORES: Record<string, GrupoMod[]> = {
  h1: EXTRAS_BURGER, h2: EXTRAS_BURGER, h3: EXTRAS_BURGER,
  pop6: EXTRAS_BURGER,
  ra1: [{ titulo: "Salsa", tipo: "extra", opciones: [{ nombre: "Alioli", precio: 0.5 }, { nombre: "Brava extra", precio: 0.5 }] }],
  co1: [{ titulo: "Con qué", tipo: "comentario", opciones: [{ nombre: "Tónica" }, { nombre: "Limón" }, { nombre: "Pepino" }] }],
  co3: [{ titulo: "Con qué", tipo: "comentario", opciones: [{ nombre: "Coca-Cola" }, { nombre: "Coca-Cola Zero" }, { nombre: "Limón" }] }],
};

export function tieneMods(id: string): boolean {
  return !!MODIFICADORES[id.split(/[#|]/)[0] ?? ""];
}
export function modsDe(id: string): GrupoMod[] {
  return MODIFICADORES[id.split(/[#|]/)[0] ?? ""] ?? [];
}

// Clientes demo (para el ClienteModal). Se reemplazan por los del nodo.
export interface ClienteDemo { id: string; nombre: string; telefono?: string; deuda?: number; alergias?: string }
export const CLIENTES_DEMO: ClienteDemo[] = [
  { id: "cl1", nombre: "Ana Torres", telefono: "600 111 222" },
  { id: "cl2", nombre: "Bar Central S.L.", telefono: "954 33 44 55", deuda: 128.4 },
  { id: "cl3", nombre: "Carlos Ruiz", telefono: "611 222 333", alergias: "Gluten, lactosa" },
  { id: "cl4", nombre: "Diana Gómez", telefono: "622 333 444" },
  { id: "cl5", nombre: "Eduardo Sanz", telefono: "633 444 555", deuda: 22.0 },
  { id: "cl6", nombre: "Familia Pérez", telefono: "644 555 666" },
];

// Tipos de documento de cobro POR DEFECTO del TPV de ejemplo (AEAT):
//  · Factura simplificada (F2, el "ticket"): la que sale por defecto, sin exigir cliente.
//  · Factura completa (F1, ordinaria): requiere destinatario identificado (NIF).
// Al cablear el nodo esto vendrá de la config fiscal del local; la forma no cambia.
export const TIPOS_DOC_DEMO = ["Factura simplificada", "Factura completa"] as const;

export const PRODUCTOS_DEMO: Producto[] = [
  // Populares (favoritos)
  { id: "pop1", nombre: "Alhambra 1925", precio: 1.4, categoria: "populares" },
  { id: "pop2", nombre: "Café con leche", precio: 1.5, categoria: "populares" },
  { id: "pop3", nombre: "Coca-Cola", precio: 2.0, categoria: "populares" },
  { id: "pop4", nombre: "Coca-Cola Zero", precio: 2.0, categoria: "populares" },
  { id: "pop5", nombre: "Croquetas caseras", precio: 4.5, categoria: "populares" },
  { id: "pop6", nombre: "Hamburguesa clásica", precio: 8.5, categoria: "populares" },
  { id: "pop7", nombre: "Patatas bravas", precio: 6.0, categoria: "populares" },
  { id: "pop8", nombre: "Rioja crianza", precio: 2.5, categoria: "populares" },
  { id: "pop9", nombre: "Tarta de queso", precio: 4.5, categoria: "populares" },
  // Cervezas
  { id: "c1", nombre: "Caña", precio: 1.8, categoria: "cervezas" },
  { id: "c2", nombre: "Doble", precio: 2.6, categoria: "cervezas" },
  { id: "c3", nombre: "Tercio", precio: 2.8, categoria: "cervezas" },
  { id: "c4", nombre: "Alhambra 1925", precio: 2.4, categoria: "cervezas" },
  { id: "c5", nombre: "Sin alcohol", precio: 2.2, categoria: "cervezas" },
  // Vinos
  { id: "v1", nombre: "Rioja crianza", precio: 2.5, categoria: "vinos" },
  { id: "v2", nombre: "Ribera del Duero", precio: 3.0, categoria: "vinos" },
  { id: "v3", nombre: "Verdejo", precio: 2.4, categoria: "vinos" },
  { id: "v4", nombre: "Albariño", precio: 2.8, categoria: "vinos" },
  // Refrescos
  { id: "r1", nombre: "Coca-Cola", precio: 2.0, categoria: "refrescos" },
  { id: "r2", nombre: "Coca-Cola Zero", precio: 2.0, categoria: "refrescos" },
  { id: "r3", nombre: "Fanta", precio: 2.0, categoria: "refrescos" },
  { id: "r4", nombre: "Tónica", precio: 2.4, categoria: "refrescos" },
  { id: "r5", nombre: "Agua 50cl", precio: 1.5, categoria: "refrescos" },
  // Cafés
  { id: "cf1", nombre: "Café solo", precio: 1.2, categoria: "cafes" },
  { id: "cf2", nombre: "Café con leche", precio: 1.5, categoria: "cafes" },
  { id: "cf3", nombre: "Cortado", precio: 1.3, categoria: "cafes" },
  { id: "cf4", nombre: "Carajillo", precio: 2.0, categoria: "cafes" },
  { id: "cf5", nombre: "Té / Infusión", precio: 1.5, categoria: "cafes" },
  // Cócteles
  { id: "co1", nombre: "Gin-tonic", precio: 7.5, categoria: "cocteles" },
  { id: "co2", nombre: "Mojito", precio: 7.0, categoria: "cocteles" },
  { id: "co3", nombre: "Ron cola", precio: 7.0, categoria: "cocteles" },
  // Raciones
  { id: "ra1", nombre: "Patatas bravas", precio: 6.0, categoria: "raciones" },
  { id: "ra2", nombre: "Croquetas caseras", precio: 4.5, categoria: "raciones" },
  { id: "ra3", nombre: "Calamares", precio: 9.5, categoria: "raciones" },
  { id: "ra4", nombre: "Jamón ibérico", precio: 12.0, categoria: "raciones" },
  // Hamburguesas
  { id: "h1", nombre: "Hamburguesa clásica", precio: 8.5, categoria: "hamburguesas" },
  { id: "h2", nombre: "Hamburguesa doble", precio: 10.5, categoria: "hamburguesas" },
  { id: "h3", nombre: "Veggie", precio: 8.0, categoria: "hamburguesas" },
  // Bocadillos
  { id: "b1", nombre: "Serranito", precio: 4.5, categoria: "bocadillos" },
  { id: "b2", nombre: "Pepito", precio: 5.0, categoria: "bocadillos" },
  { id: "b3", nombre: "Vegetal", precio: 4.0, categoria: "bocadillos" },
  // Pizzas
  { id: "pz1", nombre: "Margarita", precio: 8.0, categoria: "pizzas" },
  { id: "pz2", nombre: "Cuatro quesos", precio: 9.5, categoria: "pizzas" },
  { id: "pz3", nombre: "Barbacoa", precio: 10.0, categoria: "pizzas" },
  // Postres
  { id: "po1", nombre: "Tarta de queso", precio: 4.5, categoria: "postres" },
  { id: "po2", nombre: "Flan casero", precio: 3.5, categoria: "postres" },
  { id: "po3", nombre: "Helado", precio: 3.0, categoria: "postres" },
  // Bollería
  { id: "bo1", nombre: "Croissant", precio: 1.6, categoria: "bolleria" },
  { id: "bo2", nombre: "Napolitana", precio: 1.8, categoria: "bolleria" },
];
