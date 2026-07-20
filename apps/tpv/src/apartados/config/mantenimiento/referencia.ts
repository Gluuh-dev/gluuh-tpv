import type { Articulo } from "./datos-articulos";

// ============================================================================
// QUÉ PONER EN LA URL DE UN ARTÍCULO.
//
// El id interno NO: en la carta de ejemplo son cosas como `r5` o `pop1`, que no
// dicen nada y encima parecen un código de familia; y con datos reales son
// UUIDs de 36 caracteres. Una URL que nadie puede leer ni dictar no sirve para
// lo que queríamos las rutas.
//
// Se usa el CÓDIGO del artículo (`0007`): es lo que sale en la lista, lo que el
// dueño dice en voz alta y es de solo lectura, así que no se rompe al editar.
//
// Pero hay artículos SIN código —los del nodo tienen el `plu` vacío mientras
// nadie se lo ponga—, y ahí se cae al id: fea pero funciona. Mejor una URL fea
// que una ficha que no abre.
// ============================================================================

/** Lo que va en `/config/productos/<aquí>`. */
export const refDeArticulo = (a: Articulo): string => a.codigo.trim() || a.id;

/**
 * El artículo al que apunta una referencia de la URL.
 *
 * Mira código Y id a propósito: así los enlaces siguen abriendo aunque el
 * artículo gane un código después (o la carta de ejemplo se cambie por la real).
 * Devuelve -1 si no está.
 */
export function indicePorRef(articulos: readonly Articulo[], ref: string | undefined): number {
  if (!ref) return -1;
  const porCodigo = articulos.findIndex((a) => a.codigo.trim() === ref);
  return porCodigo >= 0 ? porCodigo : articulos.findIndex((a) => a.id === ref);
}
