/**
 * Catálogo de demostración (estilo fast-food, Canarias · IGIC).
 * En producción esto vendría de Supabase (tabla product). Ver docs/06.
 */

export interface ProductoKiosko {
  id: string;
  nombre: string;
  precio: number; // PVP, IGIC incluido
  tipo: number; // % impositivo (7 general hostelería, 15 alcohol para llevar)
  categoria: string;
  emoji: string;
  esAlcohol?: boolean;
}

export const CATEGORIAS = [
  "Hamburguesas",
  "Menús",
  "Acompañamientos",
  "Bebidas",
  "Postres",
] as const;

export const CATALOGO: ProductoKiosko[] = [
  { id: "h1", nombre: "Hamburguesa Clásica", precio: 6.5, tipo: 7, categoria: "Hamburguesas", emoji: "🍔" },
  { id: "h2", nombre: "Doble Bacon", precio: 8.9, tipo: 7, categoria: "Hamburguesas", emoji: "🍔" },
  { id: "h3", nombre: "Pollo Crispy", precio: 7.2, tipo: 7, categoria: "Hamburguesas", emoji: "🍗" },
  { id: "m1", nombre: "Menú Clásico", precio: 9.9, tipo: 7, categoria: "Menús", emoji: "🍟" },
  { id: "m2", nombre: "Menú Doble", precio: 11.9, tipo: 7, categoria: "Menús", emoji: "🍟" },
  { id: "a1", nombre: "Patatas Fritas", precio: 3.2, tipo: 7, categoria: "Acompañamientos", emoji: "🍟" },
  { id: "a2", nombre: "Aros de Cebolla", precio: 3.8, tipo: 7, categoria: "Acompañamientos", emoji: "🧅" },
  { id: "b1", nombre: "Refresco", precio: 2.2, tipo: 7, categoria: "Bebidas", emoji: "🥤" },
  { id: "b2", nombre: "Agua", precio: 1.5, tipo: 7, categoria: "Bebidas", emoji: "💧" },
  { id: "b3", nombre: "Cerveza", precio: 2.8, tipo: 15, categoria: "Bebidas", emoji: "🍺", esAlcohol: true },
  { id: "p1", nombre: "Helado", precio: 2.5, tipo: 7, categoria: "Postres", emoji: "🍦" },
  { id: "p2", nombre: "Tarta de Queso", precio: 3.5, tipo: 7, categoria: "Postres", emoji: "🍰" },
];

export function productoPorId(id: string): ProductoKiosko | undefined {
  return CATALOGO.find((p) => p.id === id);
}
