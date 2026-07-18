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
export interface Categoria { id: string; nombre: string; color: string }
export interface Producto { id: string; nombre: string; precio: number; categoria: string }

export const CATEGORIAS_DEMO: Categoria[] = [
  { id: "cafes", nombre: "Cafés", color: "#8a5a2b" },
  { id: "cervezas", nombre: "Cervezas", color: "#b5892b" },
  { id: "refrescos", nombre: "Refrescos", color: "#2f7fd0" },
  { id: "copas", nombre: "Copas", color: "#7c3d9b" },
  { id: "raciones", nombre: "Raciones", color: "#c0553f" },
  { id: "bocadillos", nombre: "Bocadillos", color: "#2ea06a" },
];

export function colorCategoria(id: string): string {
  return CATEGORIAS_DEMO.find((c) => c.id === id)?.color ?? "#64748b";
}

export const PRODUCTOS_DEMO: Producto[] = [
  { id: "p1", nombre: "Café solo", precio: 1.2, categoria: "cafes" },
  { id: "p2", nombre: "Café con leche", precio: 1.4, categoria: "cafes" },
  { id: "p3", nombre: "Cortado", precio: 1.3, categoria: "cafes" },
  { id: "p4", nombre: "Carajillo", precio: 2.0, categoria: "cafes" },
  { id: "p5", nombre: "Caña", precio: 1.8, categoria: "cervezas" },
  { id: "p6", nombre: "Doble", precio: 2.6, categoria: "cervezas" },
  { id: "p7", nombre: "Tercio", precio: 2.8, categoria: "cervezas" },
  { id: "p8", nombre: "Sin alcohol", precio: 2.2, categoria: "cervezas" },
  { id: "p9", nombre: "Coca-Cola", precio: 2.2, categoria: "refrescos" },
  { id: "p10", nombre: "Fanta", precio: 2.2, categoria: "refrescos" },
  { id: "p11", nombre: "Agua", precio: 1.5, categoria: "refrescos" },
  { id: "p12", nombre: "Tónica", precio: 2.4, categoria: "refrescos" },
  { id: "p13", nombre: "Gin-tonic", precio: 7.5, categoria: "copas" },
  { id: "p14", nombre: "Ron cola", precio: 7.0, categoria: "copas" },
  { id: "p15", nombre: "Whisky", precio: 6.5, categoria: "copas" },
  { id: "p16", nombre: "Bravas", precio: 5.5, categoria: "raciones" },
  { id: "p17", nombre: "Croquetas", precio: 6.0, categoria: "raciones" },
  { id: "p18", nombre: "Calamares", precio: 9.5, categoria: "raciones" },
  { id: "p19", nombre: "Jamón", precio: 12.0, categoria: "raciones" },
  { id: "p20", nombre: "Serranito", precio: 4.5, categoria: "bocadillos" },
  { id: "p21", nombre: "Pepito", precio: 5.0, categoria: "bocadillos" },
  { id: "p22", nombre: "Vegetal", precio: 4.0, categoria: "bocadillos" },
];
