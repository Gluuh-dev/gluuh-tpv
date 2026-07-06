import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Tipos del catálogo (compartidos por TPV, kiosko, KDS…).
export interface Family { id: string; nombre: string; color: string }
export interface Cat    { id: string; nombre: string; orden: number; family_id: string | null; foto_url?: string | null; mostrar_venta?: boolean }
export interface Prod   { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; estacion: string | null; foto_url: string | null; agotado_hasta: string | null; vendido_por_peso: boolean; nombre_ticket?: string | null; nombre_cocina?: string | null }
export interface Formato { id: string; product_id: string; nombre: string; precio: number }
export interface ModOpcion { id: string; nombre: string; precio_extra: number }
export interface ModGrupo  { id: string; product_id: string | null; nombre: string; min_sel: number; max_sel: number; tipo?: "EXTRA" | "COMENTARIO"; opciones: ModOpcion[] }
/** Asignación de un grupo de biblioteca a familia/categoría/producto (0064, Fase 2 Glop). */
export interface ModAsignacion { modifier_group_id: string; family_id: string | null; category_id: string | null; product_id: string | null; modo: "INCLUIR" | "EXCLUIR" }

interface CatalogoState {
  cargado: boolean;
  families: Family[];
  cats: Cat[];
  prods: Prod[];
  /** Categorías de cada producto (m2m `product_category`, Fase 1 Glop). Vacío si aún no aplicada. */
  prodCats: Record<string, string[]>;
  formatos: Record<string, Formato[]>;
  /** Grupos PROPIOS de cada producto (modifier_group con product_id). */
  gruposMod: Record<string, ModGrupo[]>;
  /** Biblioteca del tenant (modifier_group con product_id NULL, 0064). */
  biblioteca: ModGrupo[];
  /** Asignaciones de biblioteca por nivel (0064). Vacío si la migración no existe. */
  asignaciones: ModAsignacion[];
  modById: Record<string, ModOpcion>;
  /** Carga el catálogo. Cache en memoria + localStorage; solo fetchea la 1ª vez (o con force). */
  cargar: (sb: SupabaseClient, opts?: { force?: boolean }) => Promise<void>;
  setProds: (p: Prod[]) => void;
  setCats: (updater: (prev: Cat[]) => Cat[]) => void;
}

// Se resetea al recargar la página (no persiste): garantiza UNA revalidación por sesión
// cuando el catálogo venía de cache (stale-while-revalidate).
let revalidadoSesion = false;

// Catálogo compartido: persiste en localStorage (arranque instantáneo tras recargar) y
// vive en memoria mientras navegas → cambiar de pantalla no re-fetchea.
export const useCatalogo = create<CatalogoState>()(
  persist(
    (set, get) => ({
      cargado: false, families: [], cats: [], prods: [], prodCats: {}, formatos: {}, gruposMod: {}, biblioteca: [], asignaciones: [], modById: {},

      setProds: (p) => set({ prods: p }),
      setCats: (updater) => set((s) => ({ cats: updater(s.cats) })),

      cargar: async (sb, opts) => {
        if (get().cargado && !opts?.force) {
          // Cache caliente: pinta ya y revalida en segundo plano una vez por sesión.
          if (!revalidadoSesion) { revalidadoSesion = true; void get().cargar(sb, { force: true }); }
          return;
        }
        // nombre_ticket/nombre_cocina (0051) pueden no existir aún en algún entorno:
        // si el select con esas columnas falla, reintenta sin ellas (no rompe la carta).
        const PROD_COLS = "id,nombre,precio,tipo_impositivo,category_id,estacion,foto_url,agotado_hasta,vendido_por_peso";
        const cargarProds = async () => {
          const r = await sb.from("product").select(`${PROD_COLS},nombre_ticket,nombre_cocina`).eq("disponible", true).order("nombre");
          return r.error ? sb.from("product").select(PROD_COLS).eq("disponible", true).order("nombre") : r;
        };
        // category.mostrar_venta (0061) puede no existir aún: si falla, reintenta sin ella.
        const CAT_COLS = "id,nombre,orden,family_id";
        const cargarCats = async () => {
          const r = await sb.from("category").select(`${CAT_COLS},mostrar_venta`).order("orden");
          return r.error ? sb.from("category").select(CAT_COLS).order("orden") : r;
        };
        // modifier_group.tipo (0064) puede no existir aún: reintenta sin la columna.
        const MG_COLS = "id,product_id,nombre,min_sel,max_sel";
        const cargarGrupos = async () => {
          const r = await sb.from("modifier_group").select(`${MG_COLS},tipo`);
          return r.error ? sb.from("modifier_group").select(MG_COLS) : r;
        };
        const [{ data: f }, { data: c }, { data: p }, { data: fmts }, { data: mgs }, { data: mods }, { data: pcs }, { data: asg }] = await Promise.all([
          sb.from("family").select("id,nombre,color").order("orden"),
          cargarCats(),
          cargarProds(),
          sb.from("product_format").select("id,product_id,nombre,precio").order("orden"),
          cargarGrupos(),
          sb.from("modifier").select("id,modifier_group_id,nombre,precio_extra"),
          sb.from("product_category").select("product_id,category_id"),   // m2m (0061); vacío si no aplicada
          sb.from("modifier_group_asignacion").select("modifier_group_id,family_id,category_id,product_id,modo"), // 0064; vacío si no aplicada
        ]);
        // Formatos por producto
        const formatos: Record<string, Formato[]> = {};
        for (const ft of (fmts as Formato[]) ?? []) (formatos[ft.product_id] ??= []).push(ft);
        // Modificadores: opciones por grupo + grupos por producto + índice por id
        const opcionesPorGrupo: Record<string, ModOpcion[]> = {};
        const modById: Record<string, ModOpcion> = {};
        for (const m of (mods as (ModOpcion & { modifier_group_id: string })[]) ?? []) {
          const op: ModOpcion = { id: m.id, nombre: m.nombre, precio_extra: Number(m.precio_extra) };
          (opcionesPorGrupo[m.modifier_group_id] ??= []).push(op);
          modById[m.id] = op;
        }
        // Grupos: los de producto van a gruposMod[product_id]; los de biblioteca
        // (product_id NULL, 0064) a la biblioteca — el resolver los reparte por herencia.
        const gruposMod: Record<string, ModGrupo[]> = {};
        const biblioteca: ModGrupo[] = [];
        for (const g of (mgs as ModGrupo[]) ?? []) {
          const grupo = { ...g, opciones: opcionesPorGrupo[g.id] ?? [] };
          if (g.product_id) (gruposMod[g.product_id] ??= []).push(grupo);
          else biblioteca.push(grupo);
        }
        // Categorías por producto (m2m). Si `product_category` no existe aún, queda vacío
        // y el TPV cae a `product.category_id` (categoría principal).
        const prodCats: Record<string, string[]> = {};
        for (const pc of (pcs as { product_id: string; category_id: string }[]) ?? []) (prodCats[pc.product_id] ??= []).push(pc.category_id);

        set({
          cargado: true,
          families: (f as Family[]) ?? [], cats: (c as Cat[]) ?? [], prods: (p as Prod[]) ?? [],
          prodCats, formatos, gruposMod, biblioteca, asignaciones: (asg as ModAsignacion[]) ?? [], modById,
        });

        // Imágenes de categoría (best-effort; la columna foto_url puede no existir aún, 0044).
        void sb.from("category").select("id,foto_url").then(({ data, error }) => {
          if (error || !data) return;
          const fotos = Object.fromEntries((data as { id: string; foto_url: string | null }[]).map((r) => [r.id, r.foto_url]));
          set((s) => ({ cats: s.cats.map((cc) => ({ ...cc, foto_url: fotos[cc.id] ?? null })) }));
        });
      },
    }),
    {
      name: "gluuh-catalogo",
      version: 1,
      // Solo datos (las acciones no se serializan).
      partialize: (s) => ({
        cargado: s.cargado, families: s.families, cats: s.cats, prods: s.prods, prodCats: s.prodCats,
        formatos: s.formatos, gruposMod: s.gruposMod, biblioteca: s.biblioteca, asignaciones: s.asignaciones, modById: s.modById,
      }),
    }
  )
);

// ── Herencia de la biblioteca (Fase 2 Glop) ─────────────────────────────────
// Grupos EFECTIVOS de un producto = sus grupos propios + los de biblioteca que
// le llegan por asignación, resuelta por niveles: familia (de su categoría
// principal) → categorías (todas las suyas, m2m) → producto. En cada nivel se
// aplican primero los EXCLUIR y luego los INCLUIR (dentro del nivel, INCLUIR
// gana); un nivel inferior puede quitar lo heredado o volver a añadirlo.
// Función pura: la usan el TPV (store) y el panel (con datos propios).
export function gruposDeProducto(
  s: Pick<CatalogoState, "gruposMod" | "biblioteca" | "asignaciones" | "prods" | "cats" | "prodCats">,
  productId: string,
): ModGrupo[] {
  const propios = s.gruposMod[productId] ?? [];
  if (s.asignaciones.length === 0 || s.biblioteca.length === 0) return propios;

  const prod = s.prods.find((p) => p.id === productId);
  if (!prod) return propios;
  const m2m = s.prodCats[productId];
  let catIds: string[] = [];
  if (m2m?.length) catIds = m2m;
  else if (prod.category_id) catIds = [prod.category_id];
  const famId = s.cats.find((c) => c.id === prod.category_id)?.family_id ?? null;

  const efectivos = new Set<string>();
  const aplicarNivel = (as: ModAsignacion[]) => {
    for (const a of as) if (a.modo === "EXCLUIR") efectivos.delete(a.modifier_group_id);
    for (const a of as) if (a.modo === "INCLUIR") efectivos.add(a.modifier_group_id);
  };
  aplicarNivel(s.asignaciones.filter((a) => a.family_id !== null && a.family_id === famId));
  aplicarNivel(s.asignaciones.filter((a) => a.category_id !== null && catIds.includes(a.category_id)));
  aplicarNivel(s.asignaciones.filter((a) => a.product_id === productId));

  const porId = new Map(s.biblioteca.map((g) => [g.id, g]));
  const heredados = [...efectivos].map((id) => porId.get(id)).filter((g): g is ModGrupo => !!g);
  return [...propios, ...heredados];
}
