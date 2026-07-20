import type { Articulo } from "./datos-articulos";

/**
 * Copia un artículo para darlo de alta como uno nuevo.
 *
 * Es el atajo de toda la vida en un bar: la carta tiene ocho vinos que sólo se
 * diferencian en el nombre y el precio, y nadie quiere rellenar ocho veces la
 * misma familia, impuesto, estación y alérgenos.
 *
 * Lo que NO se copia, y por qué:
 *  · el `id` — es otro artículo, no el mismo dos veces;
 *  · el `codigo` — lo asigna la serie, como en cualquier alta;
 *  · el CÓDIGO DE BARRAS — identifica un producto físico concreto. Si se
 *    copiara, el escáner encontraría dos artículos con el mismo código y
 *    cobraría el que le diera la gana. Se deja vacío para que se teclee el suyo.
 *
 * La foto, el color y el icono SÍ se copian: es justo lo que se quiere heredar.
 */
export function duplicarArticulo(
  original: Articulo,
  codigo: string,
  nuevoId: () => string = () => crypto.randomUUID(),
): Articulo {
  return {
    ...structuredClone(original),
    id: nuevoId(),
    codigo,
    nombre: `${original.nombre} (copia)`,
    barras: "",
    // Los formatos son filas propias: con el id del original, guardar la copia
    // habría PISADO los formatos del artículo del que salió.
    formatos: original.formatos.map((f) => ({ ...structuredClone(f), id: nuevoId() })),
  };
}
