// CURSORES COMPUESTOS del sincronizador (F7, plans/021). PUROS a propósito —
// ni red ni base de datos — para poder probarlos sin levantar el nodo
// (pruebas/prueba-cursores.mjs). El porqué vive en sincronizar.mjs (sección
// «CURSOR COMPUESTO»): una marca de agua de solo fecha pierde filas cuando un
// grupo con el mismo updated_at cae en un borde de página.

export function cursorLeer(valor) {
  if (typeof valor === "string" && valor.startsWith("{")) {
    try { const j = JSON.parse(valor); return { t: j.t, k: j.k ?? null }; } catch { /* marca antigua */ }
  }
  return { t: valor ?? "1970-01-01T00:00:00Z", k: null };
}

export const cursorGuardar = (fila, pk) => JSON.stringify({ t: fila.updated_at, k: pk.map((c) => fila[c]) });

/** Filtro PostgREST «después de (t, k…)»: or=(updated_at.gt."t",and(updated_at.eq."t",pk.gt."k")…). */
export function despuesDe(pk, cur) {
  const q = (v) => `"${String(v).replaceAll('"', "")}"`;
  if (!cur.k) return `updated_at=gt.${encodeURIComponent(cur.t)}`;
  const ramas = pk.map((col, i) => {
    const iguales = pk.slice(0, i).map((c, j) => `${c}.eq.${q(cur.k[j])}`);
    return `and(updated_at.eq.${q(cur.t)},${[...iguales, `${col}.gt.${q(cur.k[i])}`].join(",")})`;
  });
  return `or=${encodeURIComponent(`(updated_at.gt.${q(cur.t)},${ramas.join(",")})`)}`;
}

/** Filtro «después de (k…)» solo por PK (para paginar la foto, que no tiene orden temporal). */
export function despuesDePk(pk, fila) {
  const q = (v) => `"${String(v).replaceAll('"', "")}"`;
  if (pk.length === 1) return `${pk[0]}=gt.${encodeURIComponent(String(fila[pk[0]]))}`;
  const ramas = pk.map((col, i) => {
    const iguales = pk.slice(0, i).map((c) => `${c}.eq.${q(fila[c])}`);
    return i === 0
      ? `${col}.gt.${q(fila[col])}`
      : `and(${[...iguales, `${col}.gt.${q(fila[col])}`].join(",")})`;
  });
  return `or=${encodeURIComponent(`(${ramas.join(",")})`)}`;
}
