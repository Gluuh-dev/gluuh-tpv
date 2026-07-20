import { CATEGORIAS_DEMO, PRODUCTOS_DEMO, modsDe } from "../../tpv/datos";

// Modelo de ARTÍCULO para la pantalla de mantenimiento. Hoy se deriva del
// catálogo demo de la venta (mismos productos, misma familia, mismos extras)
// para que las dos pantallas cuenten lo mismo; al cablear el nodo esto se
// sustituye por `product` / `product_format` / `product_price` / `modifier`.
// Los TIPOS son los que se conservan.
//
// ponytail: precios y costes derivados con factores fijos, no hay tabla de
// tarifas todavía. Cuando exista `tarifa`/`product_price`, este fichero muere.

export type Estacion = "BARRA" | "COCINA" | "PLANCHA";

export interface FormatoVenta {
  id: string;
  codigo: string;
  nombre: string;
  /** PVP con impuesto INCLUIDO, por sala (convención de la casa). */
  barra: number;
  salon: number;
  terraza: number;
  barras: string;
  combinado: boolean;
  modificable: boolean;
  /** Consumiciones o raciones que descuenta del stock. */
  raciones: number;
  /** Coste SIN impuesto. */
  coste: number;
}

export interface GrupoComentarios { id: string; nombre: string; min: number; max: number; opciones: string[] }
export interface Extra { id: string; nombre: string; precio: number }

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  nombreComanda: string;
  nombreTicket: string;
  /** id de categoría de `CATEGORIAS_DEMO` (la familia principal). */
  familia: string;
  /** % de impuesto incluido en el PVP. */
  impuesto: number;
  barras: string;
  visible: boolean;
  alPeso: boolean;
  estacion: Estacion;
  tiempoPrep: number;
  alergenos: string[];
  /** Un producto puede estar en varias categorías (m2m). */
  categorias: string[];
  formatos: FormatoVenta[];
  comentarios: GrupoComentarios[];
  extras: Extra[];
}

export const IMPUESTOS = [
  { valor: 10, texto: "IVA 10 % — hostelería" },
  { valor: 21, texto: "IVA 21 % — general" },
  { valor: 4, texto: "IVA 4 % — superreducido" },
  { valor: 7, texto: "IGIC 7 % — Canarias" },
  { valor: 0, texto: "Exento" },
];

export const ESTACIONES: { valor: Estacion; texto: string }[] = [
  { valor: "BARRA", texto: "Barra" },
  { valor: "COCINA", texto: "Cocina" },
  { valor: "PLANCHA", texto: "Plancha" },
];

export const ALERGENOS = [
  "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos",
  "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos",
];

const BEBIDAS = new Set(["cervezas", "vinos", "refrescos", "cafes", "cocteles"]);

// Formatos típicos por familia: [nombre, factor sobre el precio base].
const FORMATOS: Record<string, [string, number][]> = {
  cervezas: [["Caña", 1], ["Doble", 1.5], ["Jarra", 2.3]],
  vinos: [["Copa", 1], ["Botella", 5.5]],
  refrescos: [["Vaso", 1], ["Botellín", 1.15]],
  cafes: [["Taza", 1], ["Doble", 1.4]],
  cocteles: [["Copa", 1], ["Jarra", 2.6]],
  raciones: [["Tapa", 0.5], ["Media ración", 0.7], ["Ración", 1]],
};

const ALERGENOS_FAMILIA: Record<string, string[]> = {
  cervezas: ["Gluten"], bolleria: ["Gluten", "Huevos", "Lácteos"],
  postres: ["Lácteos", "Huevos"], pizzas: ["Gluten", "Lácteos"],
  bocadillos: ["Gluten"], hamburguesas: ["Gluten", "Huevos"],
  vinos: ["Sulfitos"], raciones: ["Gluten"],
};

/** Redondeo comercial a 5 céntimos: los precios de carta no llevan 3 decimales. */
const r5 = (n: number) => Math.round(n * 20) / 20;

function formatosDe(codigo: string, familia: string, precio: number, impuesto: number): FormatoVenta[] {
  const plantilla = FORMATOS[familia] ?? [["Unidad", 1]];
  const ratioCoste = BEBIDAS.has(familia) ? 0.22 : 0.34;
  return plantilla.map(([nombre, factor], j) => {
    const base = r5(precio * factor);
    return {
      id: `${codigo}-${j}`,
      codigo: `${codigo}.${j + 1}`,
      nombre,
      barra: base,
      salon: r5(base * 1.1),
      terraza: r5(base * 1.18),
      barras: "",
      combinado: familia === "cocteles",
      modificable: familia === "cocteles",
      raciones: factor,
      coste: Number(((base / (1 + impuesto / 100)) * ratioCoste).toFixed(2)),
    };
  });
}

export const ARTICULOS_DEMO: Articulo[] = PRODUCTOS_DEMO.map((p, i) => {
  const impuesto = 10; // hostelería; el territorio lo decide el motor fiscal
  const mods = modsDe(p.id);
  const codigo = String(i + 1).padStart(4, "0");
  return {
    id: p.id,
    codigo,
    nombre: p.nombre,
    nombreComanda: p.nombre,
    nombreTicket: p.nombre,
    familia: p.categoria,
    impuesto,
    barras: `840${String(i * 37 + 11).padStart(10, "0")}`,
    visible: true,
    alPeso: false,
    estacion: BEBIDAS.has(p.categoria) ? "BARRA" : "COCINA",
    tiempoPrep: BEBIDAS.has(p.categoria) ? 1 : 8,
    alergenos: ALERGENOS_FAMILIA[p.categoria] ?? [],
    categorias: [p.categoria],
    formatos: formatosDe(codigo, p.categoria, p.precio, impuesto),
    comentarios: mods
      .filter((g) => g.tipo === "comentario")
      .map((g, k) => ({ id: `${p.id}-c${k}`, nombre: g.titulo, min: 0, max: 1, opciones: g.opciones.map((o) => o.nombre) })),
    extras: mods
      .filter((g) => g.tipo === "extra")
      .flatMap((g, k) => g.opciones.map((o, j) => ({ id: `${p.id}-e${k}${j}`, nombre: o.nombre, precio: o.precio ?? 0 }))),
  } satisfies Articulo;
});

/**
 * Siguiente número libre de una serie (códigos de artículo, de formato…).
 * Sale del MÁXIMO en uso, nunca de la longitud: al borrar un registro, contar
 * devuelve un número ya usado y se duplican código e id — y entonces editar un
 * registro editaba también su gemelo.
 */
export const siguienteNumero = (enUso: number[]) =>
  enUso.reduce((m, n) => Math.max(m, n), 0) + 1;

export const nombreFamilia = (id: string) => CATEGORIAS_DEMO.find((c) => c.id === id)?.nombre ?? id;
export const FAMILIAS = CATEGORIAS_DEMO;

/** Margen sobre el PVP de barra, en %. Negativo = se vende a pérdida. */
export function margen(f: FormatoVenta, impuesto: number): number {
  const sinImpuesto = f.barra / (1 + impuesto / 100);
  if (sinImpuesto <= 0) return 0;
  return ((sinImpuesto - f.coste) / sinImpuesto) * 100;
}
