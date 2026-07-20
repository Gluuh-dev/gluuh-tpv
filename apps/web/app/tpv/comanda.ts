// Qué líneas salen de verdad en la COMANDA de cocina/barra.
//
// El flag `no_imprimir_si_cero` (0128) existía desde hacía días y no lo leía
// nadie: se guardaba y ya. Esto es lo que lo hace servir para algo.
//
// Para qué sirve en un bar: las invitaciones y las cortesías se dejan en la
// cuenta a 0 € para que quede constancia de que salieron, pero **ensucian la
// comanda** — el cocinero ve «1 Postre» y lo prepara otra vez. Con el flag
// puesto, la línea sigue en la cuenta y desaparece del papel de cocina.

export interface LineaComanda {
  /** Clave completa de la línea (producto|formato|mods#n). */
  id: string;
  /** Producto real, o null si es un menú (pseudo-producto). */
  productId: string | null;
  precio: number;
  cantidad: number;
}

/**
 * Quita de la comanda lo que está a 0 € Y cuyo artículo pide no imprimirse así.
 *
 * Las dos condiciones, no una:
 *  · a 0 € pero SIN el flag → sale (una tapa de la casa que cocina debe preparar);
 *  · con el flag pero CON precio → sale (es una venta normal).
 *
 * Si no se supiera el artículo (un menú, `productId` null) se imprime: ante la
 * duda, que salga. Una comanda de más se tira; una de menos es un cliente
 * esperando un plato que nadie está haciendo.
 */
export function lineasQueSalenEnComanda<T extends LineaComanda>(
  lineas: readonly T[],
  noImprimirSiCero: (productId: string) => boolean,
): T[] {
  return lineas.filter((l) => {
    if (l.precio !== 0) return true;
    if (!l.productId) return true;
    return !noImprimirSiCero(l.productId);
  });
}
