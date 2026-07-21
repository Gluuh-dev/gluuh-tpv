// ============================================================================
// GALERÍA DE FOTOS DE LA CARTA — las 500+ imágenes que vienen DENTRO de la app
// (`src/assets/catalogo/…`), para elegirlas en el botón de un producto o una
// familia sin subir nada.
//
// Se guardan por REFERENCIA ESTABLE, no por URL: `galeria:productos/cafes/espresso`.
// La URL real de un asset la genera Vite con un hash que cambia en cada build
// (`/assets/img-espresso-a1b2c3.webp`); si guardáramos esa URL en la BD, al
// recompilar la foto del botón se rompería. La referencia es fija; `urlFoto()`
// la resuelve a la URL del build actual al pintar.
// ============================================================================

// `eager` = las URLs se resuelven en el bundle (son solo cadenas, no las
// imágenes): 500 strings no pesan. `import: "default"` da la URL del asset.
const MODULOS = import.meta.glob("../assets/catalogo/**/*.webp", { eager: true, import: "default" }) as Record<string, string>;

export interface FotoGaleria {
  /** Referencia estable, p. ej. `productos/cafes/espresso` (sin el prefijo). */
  id: string;
  /** URL del asset en el build actual. */
  url: string;
  /** Carpeta: `cafes`, `bocadillos`… o `categorias`. */
  grupo: string;
  /** Nombre legible: «Café espresso» → aquí el slug, ya limpio. */
  nombre: string;
}

const PREFIJO = "galeria:";

// De `../assets/catalogo/productos/cafes/img-espresso.webp` saca
// { id: "productos/cafes/espresso", grupo: "cafes", nombre: "espresso" }.
// De `../assets/catalogo/categorias/img-cat-cafes.webp` saca
// { id: "categorias/cafes", grupo: "categorias", nombre: "cafes" }.
function analizar(ruta: string, url: string): FotoGaleria {
  const partes = ruta.split("/catalogo/")[1]!.replace(/\.webp$/i, "").split("/");
  const seccion = partes[0]!;                       // "productos" | "categorias"
  const archivo = partes[partes.length - 1]!;       // "img-espresso" | "img-cat-cafes"
  const grupo = partes.length > 2 ? partes[1]! : seccion;
  const nombre = archivo.replace(/^img-(cat-)?/, "");
  const id = seccion === "categorias" ? `categorias/${nombre}` : `${seccion}/${grupo}/${nombre}`;
  return { id, url, grupo, nombre };
}

const TODAS: FotoGaleria[] = Object.entries(MODULOS)
  .map(([ruta, url]) => analizar(ruta, url))
  .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));

const POR_ID = new Map(TODAS.map((f) => [f.id, f]));

/** Fotos de PRODUCTOS (para la ficha de artículo), agrupadas por categoría. */
export const galeriaProductos: FotoGaleria[] = TODAS.filter((f) => f.id.startsWith("productos/"));
/** Fotos de CATEGORÍAS (para los botones de familia/categoría). */
export const galeriaCategorias: FotoGaleria[] = TODAS.filter((f) => f.id.startsWith("categorias/"));

/** Referencia estable a partir de una foto elegida. */
export const refDeFoto = (f: FotoGaleria): string => PREFIJO + f.id;

/**
 * Resuelve el valor guardado en `foto` a una URL pintable:
 *  · `galeria:productos/cafes/espresso` → la URL del asset del build actual.
 *  · cualquier otra cosa (URL subida al nodo, data URL) → tal cual.
 *  · una referencia que ya no existe (foto retirada) → `undefined` (sin foto),
 *    nunca una imagen rota.
 */
export function urlFoto(foto: string | null | undefined): string | undefined {
  if (!foto) return undefined;
  if (!foto.startsWith(PREFIJO)) return foto;
  return POR_ID.get(foto.slice(PREFIJO.length))?.url;
}
