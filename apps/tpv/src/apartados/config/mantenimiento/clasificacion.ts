import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// FAMILIAS y CATEGORÍAS — la clasificación de la carta.
//
// Una FAMILIA agrupa (Bebidas, Cocina, Postres) y puede marcar rasgos que
// heredan sus productos (combinable = copas). Una CATEGORÍA es la botonera del
// TPV (Cervezas, Vinos…): cuelga de una familia, tiene color e icono, y decide
// la ESTACIÓN por defecto de lo que va dentro.
//
// Sin terminal emparejado, `cargar*` devuelve null y la pantalla se queda en
// demo. Con sesión, sale del nodo y guarda allí.
// ============================================================================

export interface Familia {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  /** Copas: al vender un producto de esta familia, pregunta con qué va. */
  combinable: boolean;
  mostrarVenta: boolean;
  mostrarMenus: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  /** Familia a la que pertenece (null = sin familia). */
  familyId: string | null;
  /** Estación por defecto de sus productos: COCINA, BARRA, CAMARERO, NINGUNA. */
  estacion: string;
  /** Nombre de icono (lib/iconos), o vacío. */
  icono: string;
  mostrarVenta: boolean;
  mostrarMenus: boolean;
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

// ── Familias ────────────────────────────────────────────────────────────────

interface FilaFamilia {
  id: string; nombre: string; color: string | null; orden: number | null;
  combinable: boolean | null; mostrar_venta: boolean | null; mostrar_menus: boolean | null;
}

export async function cargarFamilias(): Promise<Familia[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<FilaFamilia>(
    "family?select=id,nombre,color,orden,combinable,mostrar_venta,mostrar_menus&order=orden");
  return filas?.map((f) => ({
    id: f.id, nombre: f.nombre, color: f.color ?? "#64748b", orden: num(f.orden),
    combinable: f.combinable ?? false,
    mostrarVenta: f.mostrar_venta ?? true,
    mostrarMenus: f.mostrar_menus ?? true,
  })) ?? null;
}

export async function guardarFamilia(f: Familia): Promise<void> {
  await escribir("family?on_conflict=id", "POST", [{
    id: f.id, tenant_id: bar(), nombre: f.nombre, color: f.color, orden: f.orden,
    combinable: f.combinable, mostrar_venta: f.mostrarVenta, mostrar_menus: f.mostrarMenus,
    updated_at: new Date().toISOString(),
  }]);
}

/**
 * Borrar una familia. Sus categorías y productos NO se borran: se les quita la
 * familia (`family_id` → null). Borrar la familia «Bebidas» no puede llevarse
 * por delante media carta.
 */
export async function borrarFamilia(id: string): Promise<void> {
  await escribir(`category?family_id=eq.${id}`, "PATCH", { family_id: null });
  await escribir(`product?family_id=eq.${id}`, "PATCH", { family_id: null });
  await escribir(`family?id=eq.${id}`, "DELETE");
}

// ── Categorías ────────────────────────────────────────────────────────────────

interface FilaCategoria {
  id: string; nombre: string; color: string | null; orden: number | null;
  family_id: string | null; estacion: string | null; icono: string | null;
  mostrar_venta: boolean | null; mostrar_menus: boolean | null;
}

const ESTACIONES = ["COCINA", "BARRA", "CAMARERO", "NINGUNA"];
const aEstacion = (v: string | null): string => (ESTACIONES.includes(v ?? "") ? v! : "COCINA");

export async function cargarCategorias(): Promise<Categoria[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<FilaCategoria>(
    "category?select=id,nombre,color,orden,family_id,estacion,icono,mostrar_venta,mostrar_menus&order=orden");
  return filas?.map((c) => ({
    id: c.id, nombre: c.nombre, color: c.color ?? "#64748b", orden: num(c.orden),
    familyId: c.family_id, estacion: aEstacion(c.estacion), icono: c.icono ?? "",
    mostrarVenta: c.mostrar_venta ?? true,
    mostrarMenus: c.mostrar_menus ?? true,
  })) ?? null;
}

export async function guardarCategoria(c: Categoria): Promise<void> {
  await escribir("category?on_conflict=id", "POST", [{
    id: c.id, tenant_id: bar(), nombre: c.nombre, color: c.color, orden: c.orden,
    family_id: c.familyId, estacion: c.estacion, icono: c.icono || null,
    mostrar_venta: c.mostrarVenta, mostrar_menus: c.mostrarMenus,
    updated_at: new Date().toISOString(),
  }]);
}

/** Borrar una categoría: los productos pierden esta categoría (m2m + directa). */
export async function borrarCategoria(id: string): Promise<void> {
  await escribir(`product_category?category_id=eq.${id}`, "DELETE");
  await escribir(`product?category_id=eq.${id}`, "PATCH", { category_id: null });
  await escribir(`category?id=eq.${id}`, "DELETE");
}
