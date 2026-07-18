import { create } from "zustand";
import { PRODUCTOS_DEMO } from "./datos";

// Store de la VENTA (operativa), calcado en esencia del TPV de Next (page.tsx +
// useTpvStore): comanda, línea seleccionada, teclado con modos, contexto. Demo
// sobre PRODUCTOS_DEMO; al cablear el nodo se cambia la fuente del catálogo y el
// cobro, no la forma del store.

export type ModoTeclado = "UND" | "PREC" | "DTO%" | "DTO€";
export interface Descuento { tipo: "PCT" | "EUR"; valor: number }

function precioBase(id: string): number {
  return PRODUCTOS_DEMO.find((p) => p.id === id)?.precio ?? 0;
}

export interface VentaState {
  // Contexto de la cuenta
  contexto: string;
  comensales: number;
  alias: string;

  // Comanda: clave de línea → unidades
  comanda: Record<string, number>;
  precios: Record<string, number>;        // precio manual por línea
  descuentos: Record<string, Descuento>;  // descuento por línea
  invitadas: Record<string, boolean>;
  lineaSel: string | null;

  // Rejilla
  catSel: string | null;
  busqueda: string;

  // Teclado
  buffer: string;
  modo: ModoTeclado;
  editando: boolean;

  // Acciones
  iniciar: (contexto: string, comensales?: number) => void;
  addProd: (id: string) => void;
  seleccionar: (id: string) => void;
  setComensales: (n: number) => void;
  setAlias: (a: string) => void;
  setCatSel: (c: string | null) => void;
  setBusqueda: (b: string) => void;
  invitarLinea: (id: string) => void;
  anularLinea: (id: string) => void;
  vaciar: () => void;

  // Teclado
  pulsarModo: (m: ModoTeclado) => void;
  pulsarDigito: (d: string) => void;
  aplicar: () => void;      // "Label": aplica el buffer al modo activo sobre la línea sel
  borrar: () => void;       // retroceso
  limpiar: () => void;      // tecla C: vacía el buffer

  // Derivados
  precioEfectivo: (id: string) => number;
  total: () => number;
  unidades: () => number;
}

export const useVenta = create<VentaState>((set, get) => ({
  contexto: "",
  comensales: 1,
  alias: "",
  comanda: {},
  precios: {},
  descuentos: {},
  invitadas: {},
  lineaSel: null,
  catSel: null,
  busqueda: "",
  buffer: "",
  modo: "UND",
  editando: false,

  iniciar: (contexto, comensales = 1) => set({
    contexto, comensales, alias: "",
    comanda: {}, precios: {}, descuentos: {}, invitadas: {},
    lineaSel: null, buffer: "", modo: "UND", editando: false, busqueda: "",
  }),

  addProd: (id) => set((s) => {
    // En modo Und. con buffer, añade esa cantidad; si no, +1.
    const n = s.editando && s.modo === "UND" && s.buffer ? Math.max(1, parseInt(s.buffer, 10) || 1) : 1;
    return {
      comanda: { ...s.comanda, [id]: (s.comanda[id] ?? 0) + n },
      lineaSel: id, buffer: "", editando: false, modo: "UND",
    };
  }),

  seleccionar: (id) => set({ lineaSel: id, buffer: "", editando: false }),
  setComensales: (n) => set({ comensales: Math.max(1, n) }),
  setAlias: (a) => set({ alias: a }),
  setCatSel: (c) => set({ catSel: c }),
  setBusqueda: (b) => set({ busqueda: b }),

  invitarLinea: (id) => set((s) => ({ invitadas: { ...s.invitadas, [id]: !s.invitadas[id] } })),

  anularLinea: (id) => set((s) => {
    const comanda = { ...s.comanda }; delete comanda[id];
    const precios = { ...s.precios }; delete precios[id];
    const descuentos = { ...s.descuentos }; delete descuentos[id];
    const invitadas = { ...s.invitadas }; delete invitadas[id];
    return { comanda, precios, descuentos, invitadas, lineaSel: s.lineaSel === id ? null : s.lineaSel };
  }),

  vaciar: () => set({ comanda: {}, precios: {}, descuentos: {}, invitadas: {}, lineaSel: null, buffer: "", editando: false }),

  pulsarModo: (m) => set((s) => (s.modo === m && s.editando ? { editando: false, buffer: "" } : { modo: m, editando: true, buffer: "" })),

  pulsarDigito: (d) => set((s) => {
    if (!s.editando) return s;
    if (d === "," && s.buffer.includes(",")) return s;
    return { buffer: (s.buffer + d).slice(0, 8) };
  }),

  borrar: () => set((s) => ({ buffer: s.buffer.slice(0, -1) })),
  limpiar: () => set({ buffer: "" }),

  aplicar: () => set((s) => {
    const id = s.lineaSel;
    if (!id || !s.editando || !s.buffer) return { editando: false, buffer: "" };
    const num = parseFloat(s.buffer.replace(",", ".")) || 0;
    if (s.modo === "UND") {
      const n = Math.max(1, Math.round(num));
      return { comanda: { ...s.comanda, [id]: n }, buffer: "", editando: false };
    }
    if (s.modo === "PREC") return { precios: { ...s.precios, [id]: num }, buffer: "", editando: false };
    if (s.modo === "DTO%") return { descuentos: { ...s.descuentos, [id]: { tipo: "PCT", valor: num } }, buffer: "", editando: false };
    return { descuentos: { ...s.descuentos, [id]: { tipo: "EUR", valor: num } }, buffer: "", editando: false };
  }),

  precioEfectivo: (id) => {
    const s = get();
    let base = s.precios[id] ?? precioBase(id.split("|")[0]!);
    const d = s.descuentos[id];
    if (d) base = d.tipo === "PCT" ? base * (1 - d.valor / 100) : base - d.valor;
    return Math.max(0, Math.round(base * 100) / 100);
  },

  total: () => {
    const s = get();
    return Object.entries(s.comanda).reduce((acc, [id, q]) => acc + (s.invitadas[id] ? 0 : s.precioEfectivo(id) * q), 0);
  },

  unidades: () => Object.values(get().comanda).reduce((a, q) => a + q, 0),
}));
