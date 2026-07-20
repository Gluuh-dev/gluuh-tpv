import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// MENÚS — un menú NO es un artículo.
//
//   menu            nombre, precio CERRADO, clase fiscal, activo
//    └ menu_group   los PASOS, en orden: Bebida → Primero → Segundo → Postre
//       └ opciones  de una CATEGORÍA entera, o una lista a mano
//
// De dónde salen los platos de un paso, y por qué importa (modelo Ágora): si el
// paso apunta a una CATEGORÍA, cambiar el menú del día es cambiar qué hay en esa
// categoría — lo que hace el encargado un martes a las once. Con una lista de 30
// platos a mano, el menú del día se queda viejo el primer día que alguien tiene
// prisa. La lista explícita se queda para el menú de Nochevieja, que sí se monta
// plato a plato.
//
// El PASE de cocina se configura (0133). Antes se adivinaba con un regex del
// nombre del paso, y un bar que llamara a un paso «Para picar» se quedaba sin
// pase: la comanda salía sin ordenar y nadie veía un error.
// ============================================================================

/** Pases de cocina. El 0 es «sin pase» a propósito: sale todo junto. */
export const PASES = [
  { valor: 0, texto: "Sin pase — sale todo junto" },
  { valor: 1, texto: "1º Primeros" },
  { valor: 2, texto: "2º Segundos" },
  { valor: 3, texto: "3º Terceros" },
  { valor: 4, texto: "Postres" },
  { valor: 5, texto: "Bebidas" },
] as const;

export interface PasoMenu {
  id: string;
  nombre: string;
  orden: number;
  /** Categoría de la que salen los platos. null = lista a mano (`opciones`). */
  categoryId: string | null;
  /** Cuántos platos se eligen aquí (el «Nº Platos» de Ágora). */
  numPlatos: number;
  /** Pase de cocina configurado; null = se deduce del nombre. */
  ordenPrep: number | null;
  /** Solo si no hay categoría: los product_id elegidos a mano. */
  opciones: string[];
}

export interface Menu {
  id: string;
  nombre: string;
  /** Precio CERRADO del menú, con impuesto incluido. */
  precio: number;
  claseFiscal: string;
  activo: boolean;
  pasos: PasoMenu[];
}

const num = (v: number | string | null | undefined, pordefecto = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : pordefecto;
};

interface FilaMenu {
  id: string; nombre: string; precio: number | string | null;
  clase_fiscal: string | null; activo: boolean;
  menu_group: {
    id: string; nombre: string; orden: number | null; category_id: string | null;
    num_platos: number | null; orden_prep: number | null;
    menu_choice: { product_id: string }[] | null;
  }[] | null;
}

const COLUMNAS =
  "id,nombre,precio,clase_fiscal,activo," +
  "menu_group(id,nombre,orden,category_id,num_platos,orden_prep,menu_choice(product_id))";

const aMenu = (m: FilaMenu): Menu => ({
  id: m.id,
  nombre: m.nombre,
  precio: num(m.precio),
  claseFiscal: m.clase_fiscal ?? "REDUCIDO",
  activo: m.activo,
  pasos: (m.menu_group ?? [])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((g, i) => ({
      id: g.id,
      nombre: g.nombre,
      orden: g.orden ?? i + 1,
      categoryId: g.category_id,
      numPlatos: g.num_platos ?? 1,
      ordenPrep: g.orden_prep,
      opciones: (g.menu_choice ?? []).map((c) => c.product_id),
    })),
});

export async function cargarMenus(): Promise<Menu[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<FilaMenu>(`menu?select=${COLUMNAS}&order=orden`);
  return filas?.map(aMenu) ?? null;
}

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

/**
 * Guarda el menú entero: cabecera, pasos y opciones.
 *
 * Los pasos y las opciones se reescriben: son pocos y así un paso quitado no se
 * queda vivo saliendo en el TPV.
 */
export async function guardarMenu(m: Menu): Promise<void> {
  const tenant_id = bar();

  await escribir("menu?on_conflict=id", "POST", [{
    id: m.id, tenant_id, nombre: m.nombre, precio: m.precio,
    clase_fiscal: m.claseFiscal, activo: m.activo,
    updated_at: new Date().toISOString(),
  }]);

  const vivos = m.pasos.map((p) => p.id);
  const salvo = vivos.length > 0 ? `&id=not.in.(${vivos.join(",")})` : "";
  await escribir(`menu_group?menu_id=eq.${m.id}${salvo}`, "DELETE");

  if (m.pasos.length === 0) return;
  await escribir("menu_group?on_conflict=id", "POST", m.pasos.map((p, i) => ({
    id: p.id, tenant_id, menu_id: m.id, nombre: p.nombre, orden: i + 1,
    category_id: p.categoryId, num_platos: p.numPlatos, orden_prep: p.ordenPrep,
    updated_at: new Date().toISOString(),
  })));

  for (const p of m.pasos) {
    await escribir(`menu_choice?group_id=eq.${p.id}`, "DELETE");
    // Con categoría, las opciones SON las de la categoría: guardar además una
    // copia congelada dejaría dos verdades y una de las dos envejecería.
    if (p.categoryId || p.opciones.length === 0) continue;
    await escribir("menu_choice", "POST", p.opciones.map((productId) => ({
      tenant_id, group_id: p.id, product_id: productId,
      updated_at: new Date().toISOString(),
    })));
  }
}

export async function borrarMenu(id: string): Promise<void> {
  await escribir(`menu?id=eq.${id}`, "DELETE");
}

/** Cuántos platos ofrece de verdad un paso, mire donde mire. */
export function opcionesDePaso(
  paso: Pick<PasoMenu, "categoryId" | "opciones">,
  productosPorCategoria: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  return paso.categoryId ? (productosPorCategoria[paso.categoryId] ?? []) : paso.opciones;
}

/**
 * Qué le falta a un menú para poder venderse.
 *
 * Se comprueba antes de guardar y no al vender: un menú con un paso vacío deja
 * al camarero delante del cliente sin poder elegir nada, y eso no se arregla en
 * barra.
 */
export function problemasDelMenu(
  m: Menu,
  productosPorCategoria: Readonly<Record<string, readonly string[]>>,
): string[] {
  const fallos: string[] = [];
  if (!m.nombre.trim()) fallos.push("El menú necesita un nombre.");
  if (m.precio <= 0) fallos.push("El menú necesita un precio: es cerrado, no sale de los platos.");
  if (m.pasos.length === 0) fallos.push("Un menú sin pasos no se puede vender.");

  for (const p of m.pasos) {
    const cuantas = opcionesDePaso(p, productosPorCategoria).length;
    if (cuantas === 0) {
      fallos.push(`El paso «${p.nombre || "sin nombre"}» no ofrece ningún plato.`);
    } else if (p.numPlatos > cuantas) {
      fallos.push(`«${p.nombre}» pide elegir ${p.numPlatos} platos y solo ofrece ${cuantas}.`);
    }
  }
  return fallos;
}
