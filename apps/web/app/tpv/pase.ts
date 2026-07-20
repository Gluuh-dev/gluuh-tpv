// PASE de cocina de un paso de menú: en qué orden sale cada plato.
//
//   1 primeros · 2 segundos · 3 terceros · 4 postres · 5 bebidas
//
// Lo que MANDA es lo configurado (`menu_group.orden_prep`, migración 0133). El
// nombre solo se mira si nadie lo ha configurado, y como apaño heredado: es lo
// que se venía haciendo, y un bar que llame a un paso «Para picar» o
// «Entrantes» se quedaba SIN PASE — la comanda salía sin ordenar y cocina no
// sabía qué iba antes. No daba ningún error: simplemente salía mal.

/** Sale del NOMBRE. Apaño heredado, para menús que aún no tengan el pase puesto. */
export function paseDeNombre(nombre: string): number | undefined {
  const n = nombre.trim().toLowerCase();
  if (/postre/.test(n)) return 4;
  if (/bebid/.test(n)) return 5;
  if (/^1|prim/.test(n)) return 1;
  if (/^2|segu/.test(n)) return 2;
  if (/^3|terc/.test(n)) return 3;
  return undefined;
}

/**
 * El pase de un paso. Lo configurado gana; si no hay nada, se deduce del nombre.
 *
 * `ordenPrep` a 0 se respeta como «sin pase» explícito: hay menús —una tabla de
 * quesos, un catering— donde no hay orden y todo sale junto, y eso es una
 * decisión, no un olvido.
 */
export function paseDeGrupo(nombre: string, ordenPrep?: number | null): number | undefined {
  if (ordenPrep === 0) return undefined;
  if (typeof ordenPrep === "number") return ordenPrep;
  return paseDeNombre(nombre);
}
