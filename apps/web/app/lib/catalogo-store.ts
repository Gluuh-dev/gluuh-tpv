import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

// Tipos del catálogo (compartidos por TPV, kiosko, KDS…).
export interface Family { id: string; nombre: string; color: string }
export interface Cat    { id: string; nombre: string; orden: number; family_id: string | null; foto_url?: string | null }
export interface Prod   { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null; estacion: string | null; foto_url: string | null; agotado_hasta: string | null; vendido_por_peso: boolean; nombre_ticket?: string | null; nombre_cocina?: string | null }
export interface Formato { id: string; product_id: string; nombre: string; precio: number }
export interface ModOpcion { id: string; nombre: string; precio_extra: number }
export interface ModGrupo  { id: string; product_id: string; nombre: string; min_sel: number; max_sel: number; opciones: ModOpcion[] }

interface CatalogoState {
  cargado: boolean;
  families: Family[];
  cats: Cat[];
  prods: Prod[];
  formatos: Record<string, Formato[]>;
  gruposMod: Record<string, ModGrupo[]>;
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
      cargado: false, families: [], cats: [], prods: [], formatos: {}, gruposMod: {}, modById: {},

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
        const [{ data: f }, { data: c }, { data: p }, { data: fmts }, { data: mgs }, { data: mods }] = await Promise.all([
          sb.from("family").select("id,nombre,color").order("orden"),
          sb.from("category").select("id,nombre,orden,family_id").order("orden"),
          cargarProds(),
          sb.from("product_format").select("id,product_id,nombre,precio").order("orden"),
          sb.from("modifier_group").select("id,product_id,nombre,min_sel,max_sel"),
          sb.from("modifier").select("id,modifier_group_id,nombre,precio_extra"),
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
        const gruposMod: Record<string, ModGrupo[]> = {};
        for (const g of (mgs as ModGrupo[]) ?? []) (gruposMod[g.product_id] ??= []).push({ ...g, opciones: opcionesPorGrupo[g.id] ?? [] });

        set({
          cargado: true,
          families: (f as Family[]) ?? [], cats: (c as Cat[]) ?? [], prods: (p as Prod[]) ?? [],
          formatos, gruposMod, modById,
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
        cargado: s.cargado, families: s.families, cats: s.cats, prods: s.prods,
        formatos: s.formatos, gruposMod: s.gruposMod, modById: s.modById,
      }),
    }
  )
);
