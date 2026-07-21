// Índice de imágenes del catálogo. Las 488 fotos de producto + 30 de categoría
// viven en `src/assets/catalogo/` y Vite las procesa (hash, lazy): NO se listan a
// mano. `import.meta.glob` construye el mapa slug→URL en build, así que añadir una
// foto con el nombre correcto la enseña sola, sin tocar código.
//
// Los ficheros se llaman `img-<slug>.webp` (producto) e `img-cat-<slug>.webp`
// (categoría), donde el slug es el nombre sin acentos en kebab-case. Se resuelve
// por ESE slug, no por la carpeta: da igual en qué categoría esté la foto.

const FOTOS_PROD = import.meta.glob("../../assets/catalogo/productos/**/*.webp", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;
const FOTOS_CAT = import.meta.glob("../../assets/catalogo/categorias/*.webp", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

/** «Café con leche» → «cafe-con-leche». El mismo slug con el que se nombran los ficheros. */
export function slug(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // fuera acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Del path completo (…/cafes/img-cafe-con-leche.webp) al slug (cafe-con-leche).
function indexar(fotos: Record<string, string>, prefijo: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [path, url] of Object.entries(fotos)) {
    const base = path.split("/").pop() ?? "";
    const s = base.replace(/^img-/, "").replace(/\.webp$/, "");
    m.set(s.startsWith(prefijo) ? s.slice(prefijo.length) : s, url);
  }
  return m;
}

const PROD = indexar(FOTOS_PROD, "");
const CAT = indexar(FOTOS_CAT, "cat-");

// Alias nombre→imagen para cuando el nombre del producto no es el de la foto:
// marcas concretas que usan la foto genérica (Coca-Cola → cola) y pequeños
// desajustes de slug (Tarta de queso → tarta-queso, sin el «de»). La clave es el
// slug del NOMBRE; el valor, el slug de la IMAGEN.
const ALIAS_PRODUCTO: Record<string, string> = {
  "alhambra-1925": "botellin", doble: "jarra",
  "coca-cola": "cola", "coca-cola-zero": "cola-light", fanta: "naranja", "agua-50cl": "agua",
  "croquetas-caseras": "croquetas", "hamburguesa-clasica": "hamburguesa-queso", veggie: "hamburguesa-vegetal",
  "rioja-crianza": "tinto-reserva", "ribera-del-duero": "vino-tinto", verdejo: "vino-blanco", albarino: "blanco-joven",
  "tarta-de-queso": "tarta-queso", "flan-casero": "flan", helado: "copa-helado",
  "cafe-solo": "espresso", "te-infusion": "manzanilla", "ron-cola": "cola",
  serranito: "serrano-tomate", pepito: "pepito-ternera",
};

/** Foto de un producto por su nombre, o undefined si no hay ninguna con ese slug. */
export function fotoProducto(nombre: string): string | undefined {
  const s = slug(nombre);
  return PROD.get(ALIAS_PRODUCTO[s] ?? s);
}

// Algunas categorías demo no tienen imagen con su id exacto: se apunta a la que
// mejor las representa (lo demás cae por id directo, p. ej. "cervezas").
const ALIAS_CAT: Record<string, string> = { menus: "menu", bolleria: "desayunos", populares: "tapas", tostadas: "desayunos" };

/** Foto de cabecera de una categoría por su id, o undefined si no hay. */
export function fotoCategoria(id: string): string | undefined {
  return CAT.get(ALIAS_CAT[id] ?? id) ?? CAT.get(id);
}

/** Cuántas fotos hay cargadas (para el diagnóstico de «qué falta»). */
export const TOTAL_FOTOS = { productos: PROD.size, categorias: CAT.size };
export const SLUGS_PRODUCTO = new Set(PROD.keys());

// ── Catálogo derivado de las imágenes ───────────────────────────────────────
// Cada foto de producto es un artículo en potencia. Esto agrupa las fotos por su
// CARPETA (la categoría), para poder llenar el catálogo demo con lo que hay sin
// escribir cada producto a mano.
export interface FotoItem { slug: string; url: string; nombre: string }

/** «arroz-negro» → «Arroz negro». Sin acentos (vienen del nombre del fichero). */
export function deslug(s: string): string {
  const t = s.replaceAll("-", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const POR_CATEGORIA: Map<string, FotoItem[]> = (() => {
  const m = new Map<string, FotoItem[]>();
  for (const [path, url] of Object.entries(FOTOS_PROD)) {
    const partes = path.split("/");
    const categoria = partes.at(-2) ?? "";
    const s = (partes.at(-1) ?? "").replace(/^img-/, "").replace(/\.webp$/, "");
    if (!m.has(categoria)) m.set(categoria, []);
    m.get(categoria)!.push({ slug: s, url, nombre: deslug(s) });
  }
  for (const items of m.values()) items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return m;
})();
