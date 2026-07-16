import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";

// Caché en memoria de los clientes (tabla `customer`). La lista PERSISTE entre aperturas del
// modal (no se recarga desde cero cada vez): la primera vez se descarga y las siguientes se
// revalidan EN 2º PLANO (stale-while-revalidate), así no parpadea. Alta/edición/borrado
// actualizan el caché al instante (upsert/quitar) sin volver a consultar.
export interface Cli {
  id: string; nombre: string | null; telefono: string | null; nif: string | null; email: string | null;
  direccion: string | null; codigo_postal: string | null; poblacion: string | null; provincia: string | null;
  notas: string | null; consentimiento_marketing: boolean; puntos_fidelidad: number; created_at: string;
}
export const CLI_COLS = "id,nombre,telefono,nif,email,direccion,codigo_postal,poblacion,provincia,notas,consentimiento_marketing,puntos_fidelidad,created_at";

interface ClientesState {
  clientes: Cli[];
  cargado: boolean;
  cargando: boolean;
  /** Descarga la lista. La 1ª vez marca `cargando` (spinner); después revalida en silencio. */
  cargar: (sb: SupabaseClient, opts?: { force?: boolean }) => Promise<void>;
  upsert: (c: Cli) => void;
  quitar: (id: string) => void;
}

const ordena = (a: Cli, b: Cli) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es");

export const useClientesStore = create<ClientesState>((set, get) => ({
  clientes: [],
  cargado: false,
  cargando: false,
  cargar: async (sb, opts) => {
    const primera = !get().cargado;
    if (get().cargando && !opts?.force) return;
    if (primera) set({ cargando: true });
    const { data } = await sb.from("customer").select(CLI_COLS).order("nombre").limit(500);
    set({ clientes: ((data as Cli[]) ?? []).slice().sort(ordena), cargado: true, cargando: false });
  },
  upsert: (c) => set((s) => {
    const i = s.clientes.findIndex((x) => x.id === c.id);
    const arr = i >= 0 ? s.clientes.map((x) => (x.id === c.id ? c : x)) : [...s.clientes, c];
    return { clientes: arr.sort(ordena) };
  }),
  quitar: (id) => set((s) => ({ clientes: s.clientes.filter((x) => x.id !== id) })),
}));
