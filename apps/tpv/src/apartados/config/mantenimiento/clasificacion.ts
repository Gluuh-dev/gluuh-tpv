import { leer, escribir, haySesion, tenantId, subirImagen } from "../../../lib/nodo";

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
  /** Rótulo del botón si difiere del nombre (vacío = usa el nombre). */
  textoBoton: string;
  /** Orden de la familia en el ticket/factura. */
  ordenImpresion: number;
  /** Familia que la agrupa bajo un solo botón (los «grupos de familias» de Glop). null = de primer nivel. */
  familiaPadreId: string | null;
  /** Grupo mayor para el desglose del ticket (Bebida/Comida). null = ninguno. */
  grupoMayorId: string | null;
  /** URL de la imagen del botón (o data URL sin subir todavía), o vacío. */
  fotoUrl: string;
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
  textoBoton: string;
  /** Nombre en la carta por QR (vacío = el nombre normal). */
  cartaNombre: string;
  cartaDescripcion: string;
  /** Categoría que la agrupa (subcategorías). null = de primer nivel. */
  categoriaPadreId: string | null;
  /** URL de la imagen del botón (o data URL sin subir todavía), o vacío. */
  fotoUrl: string;
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
  texto_boton: string | null; orden_impresion: number | null;
  familia_padre_id: string | null; grupo_mayor_id: string | null; foto_url: string | null;
}

export async function cargarFamilias(): Promise<Familia[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<FilaFamilia>(
    "family?select=id,nombre,color,orden,combinable,mostrar_venta,mostrar_menus,texto_boton,orden_impresion,familia_padre_id,grupo_mayor_id,foto_url&order=orden");
  return filas?.map((f) => ({
    id: f.id, nombre: f.nombre, color: f.color ?? "#64748b", orden: num(f.orden),
    combinable: f.combinable ?? false,
    mostrarVenta: f.mostrar_venta ?? true,
    mostrarMenus: f.mostrar_menus ?? true,
    textoBoton: f.texto_boton ?? "", ordenImpresion: num(f.orden_impresion),
    familiaPadreId: f.familia_padre_id, grupoMayorId: f.grupo_mayor_id, fotoUrl: f.foto_url ?? "",
  })) ?? null;
}

export async function guardarFamilia(f: Familia): Promise<void> {
  await escribir("family?on_conflict=id", "POST", [{
    id: f.id, tenant_id: bar(), nombre: f.nombre, color: f.color, orden: f.orden,
    combinable: f.combinable, mostrar_venta: f.mostrarVenta, mostrar_menus: f.mostrarMenus,
    texto_boton: f.textoBoton || null, orden_impresion: f.ordenImpresion,
    familia_padre_id: f.familiaPadreId, grupo_mayor_id: f.grupoMayorId, foto_url: f.fotoUrl || null,
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
  texto_boton: string | null; carta_nombre: string | null; carta_descripcion: string | null;
  categoria_padre_id: string | null; foto_url: string | null;
}

const ESTACIONES = ["COCINA", "BARRA", "CAMARERO", "NINGUNA"];
const aEstacion = (v: string | null): string => (ESTACIONES.includes(v ?? "") ? v! : "COCINA");

export async function cargarCategorias(): Promise<Categoria[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<FilaCategoria>(
    "category?select=id,nombre,color,orden,family_id,estacion,icono,mostrar_venta,mostrar_menus,texto_boton,carta_nombre,carta_descripcion,categoria_padre_id,foto_url&order=orden");
  return filas?.map((c) => ({
    id: c.id, nombre: c.nombre, color: c.color ?? "#64748b", orden: num(c.orden),
    familyId: c.family_id, estacion: aEstacion(c.estacion), icono: c.icono ?? "",
    mostrarVenta: c.mostrar_venta ?? true,
    mostrarMenus: c.mostrar_menus ?? true,
    textoBoton: c.texto_boton ?? "", cartaNombre: c.carta_nombre ?? "", cartaDescripcion: c.carta_descripcion ?? "",
    categoriaPadreId: c.categoria_padre_id, fotoUrl: c.foto_url ?? "",
  })) ?? null;
}

export async function guardarCategoria(c: Categoria): Promise<void> {
  await escribir("category?on_conflict=id", "POST", [{
    id: c.id, tenant_id: bar(), nombre: c.nombre, color: c.color, orden: c.orden,
    family_id: c.familyId, estacion: c.estacion, icono: c.icono || null,
    mostrar_venta: c.mostrarVenta, mostrar_menus: c.mostrarMenus,
    texto_boton: c.textoBoton || null, carta_nombre: c.cartaNombre || null, carta_descripcion: c.cartaDescripcion || null,
    categoria_padre_id: c.categoriaPadreId, foto_url: c.fotoUrl || null,
    updated_at: new Date().toISOString(),
  }]);
}

/** Borrar una categoría: los productos pierden esta categoría (m2m + directa). */
export async function borrarCategoria(id: string): Promise<void> {
  await escribir(`product_category?category_id=eq.${id}`, "DELETE");
  await escribir(`product?category_id=eq.${id}`, "PATCH", { category_id: null });
  await escribir(`category?id=eq.${id}`, "DELETE");
}

// ── Grupo mayor y fotos ───────────────────────────────────────────────────────

export interface GrupoMayor { id: string; nombre: string }

/**
 * Los grupos mayores (Bebida/Comida…) para el desplegable de la familia. El TPV
 * no los da de alta —eso es del panel— así que aquí solo se leen para elegir.
 */
export async function cargarGruposMayores(): Promise<GrupoMayor[]> {
  if (!haySesion()) return [];
  return (await leer<GrupoMayor>("grupo_mayor?select=id,nombre&order=nombre")) ?? [];
}

/** Sube la foto de una familia/categoría al nodo y devuelve su URL. */
export async function subirFotoClasificacion(ambito: "familias" | "categorias", id: string, datos: Blob): Promise<string> {
  return subirImagen(`${ambito}/${id}-${Date.now()}.jpg`, datos);
}
