// Claves de línea de la comanda del TPV. Una clave identifica una línea:
//   "pid" · "pid|fid" · "pid|fid|mod1,mod2"   (formato/peso/modificadores)
// y puede llevar un sufijo de UNICIDAD "#n" para que, al re-añadir el mismo
// producto, la línea nueva NO fusione con otra que ya arrastra descuento o
// precio manual (si fusionara, el descuento se contagiaría a las uds nuevas).
// El "#n" es SOLO para distinguir líneas: se ignora al resolver el producto,
// el nombre o el precio base (esos se parsean sobre la clave base).

/** Quita el sufijo de unicidad "#n" y deja la clave base ("pid|fid|mods"). */
export const claveBase = (key: string): string => key.split("#")[0]!;

/** Construye la clave base de una línea a partir de producto, formato y mods. */
export function claveDeLinea(pid: string, fid: string | undefined, modIds: string[]): string {
  const sorted = [...modIds].sort();
  let key = pid;
  if (fid || sorted.length) key += `|${fid ?? ""}`;
  if (sorted.length) key += `|${sorted.join(",")}`;
  return key;
}

/**
 * Clave con la que añadir `base` a la comanda. Fusiona (misma clave) salvo que
 * esa línea YA exista y arrastre personalización (descuento o precio manual):
 * en ese caso genera una clave nueva única `base#n` para que la nueva salga
 * limpia y el descuento quede solo en la línea original.
 */
export function claveParaAnadir(
  base: string,
  comanda: Record<string, number>,
  tienePersonalizacion: (clave: string) => boolean,
): string {
  if (!(base in comanda) || !tienePersonalizacion(base)) return base;
  let n = 2;
  while (`${base}#${n}` in comanda) n++;
  return `${base}#${n}`;
}

// (El antiguo demo() autoejecutable vive ahora como tests reales en
// clave-linea.test.ts, que sí corren con `pnpm test`.)
