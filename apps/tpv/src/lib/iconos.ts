import {
  Beer, Wine, Martini, Coffee, CupSoda, Milk, GlassWater,
  Beef, Fish, Egg, Salad, Soup, Sandwich, Pizza, Drumstick, Ham,
  Croissant, CakeSlice, IceCreamCone, Cookie, Candy, Popcorn,
  Grape, Apple, Carrot, Wheat, UtensilsCrossed, Flame, Leaf, Star,
  type LucideIcon,
} from "lucide-react";

// Iconos de artículo/categoría. Se guarda el NOMBRE (no el componente), igual que
// `category.icono` de la migración 0060 — así el dato viaja en la BD y sobrevive a
// cambiar de librería de iconos.
export const ICONOS: Record<string, LucideIcon> = {
  beer: Beer, wine: Wine, martini: Martini, coffee: Coffee, "cup-soda": CupSoda,
  milk: Milk, "glass-water": GlassWater,
  beef: Beef, fish: Fish, egg: Egg, salad: Salad, soup: Soup, sandwich: Sandwich,
  pizza: Pizza, drumstick: Drumstick, ham: Ham,
  croissant: Croissant, "cake-slice": CakeSlice, "ice-cream-cone": IceCreamCone,
  cookie: Cookie, candy: Candy, popcorn: Popcorn,
  grape: Grape, apple: Apple, carrot: Carrot, wheat: Wheat,
  "utensils-crossed": UtensilsCrossed, flame: Flame, leaf: Leaf, star: Star,
};

/** Nombres en orden de rejilla (bebida → comida → dulce → genéricos). */
export const NOMBRES_ICONOS = Object.keys(ICONOS);

/** El componente, o `undefined` si el nombre no está (icono retirado, dato viejo). */
export const iconoPorNombre = (nombre?: string | null): LucideIcon | undefined =>
  nombre ? ICONOS[nombre] : undefined;
