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

/**
 * Auto-comprobación (assert). No se ejecuta al importar; correr a mano con:
 *   npx tsx apps/web/app/tpv/clave-linea.ts   (o desde un script)
 * Verifica el bug del descuento contagiado: añadir · DTO · re-añadir → 2 líneas,
 * el descuento solo en la 1ª, total correcto.
 */
export function demo(): void {
  const ok = (c: boolean, msg: string) => { if (!c) throw new Error("FALLO: " + msg); };

  const PRECIO = 10;
  const comanda: Record<string, number> = {};
  const descuentos: Record<string, { pct: number }> = {};
  const preciosManuales: Record<string, number> = {};
  const tienePerso = (k: string) => descuentos[k] !== undefined || preciosManuales[k] !== undefined;
  const anadir = (base: string) => {
    const k = claveParaAnadir(base, comanda, tienePerso);
    comanda[k] = (comanda[k] ?? 0) + 1;
    return k;
  };
  const precio = (k: string) => {
    const b = preciosManuales[k] ?? PRECIO;   // claveBase no altera el precio en el demo
    const d = descuentos[k];
    return d ? b * (1 - d.pct / 100) : b;
  };

  // 1) añadir producto "p" · 2) aplicar DTO 20% · 3) re-añadir "p"
  const k1 = anadir("p");
  ok(k1 === "p", "la 1ª línea usa la clave base");
  descuentos[k1] = { pct: 20 };
  const k2 = anadir("p");
  ok(k2 === "p#2", "la 2ª línea recibe clave única #2 (no fusiona)");
  ok(Object.keys(comanda).length === 2, "hay 2 líneas");
  ok(comanda["p"] === 1 && comanda["p#2"] === 1, "1 unidad en cada línea");
  ok(descuentos["p#2"] === undefined, "la nueva línea sale sin descuento");
  ok(precio("p") === 8, "la 1ª línea mantiene el descuento (8 €)");
  ok(precio("p#2") === 10, "la nueva línea a precio completo (10 €)");
  const total = precio("p") * comanda["p"]! + precio("p#2") * comanda["p#2"]!;
  ok(total === 18, "total correcto = 18 €");

  // Sin personalización, sí fusiona (comportamiento normal).
  const q1 = anadir("q");
  const q2 = anadir("q");
  ok(q1 === "q" && q2 === "q" && comanda["q"] === 2, "las líneas normales fusionan");

  // claveBase / claveDeLinea.
  ok(claveBase("p#2") === "p" && claveBase("a|b|c#3") === "a|b|c", "claveBase quita #n");
  ok(claveDeLinea("x", "f1", ["b", "a"]) === "x|f1|a,b", "claveDeLinea ordena mods");
  ok(claveDeLinea("x", undefined, []) === "x", "claveDeLinea simple = pid");

  // eslint-disable-next-line no-console
  console.log("clave-linea demo OK");
}
