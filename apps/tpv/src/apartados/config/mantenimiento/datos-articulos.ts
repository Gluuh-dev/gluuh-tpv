import { CATEGORIAS_DEMO, PRODUCTOS_DEMO, modsDe } from "../../tpv/datos";

// Modelo de ARTÍCULO para la pantalla de mantenimiento. Hoy se deriva del
// catálogo demo de la venta (mismos productos, misma familia, mismos extras)
// para que las dos pantallas cuenten lo mismo; al cablear el nodo esto se
// sustituye por `product` / `product_format` / `product_price` / `modifier`.
// Los TIPOS son los que se conservan.
//
// ponytail: precios y costes derivados con factores fijos, no hay tabla de
// tarifas todavía. Cuando exista `tarifa`/`product_price`, este fichero muere.

// Las MISMAS que el panel (`apps/web/app/lib/estaciones.ts`), ni una más.
// «PLANCHA» era invención de esta pantalla: no existe en la BD ni la entiende
// el enrutado de impresión, así que un artículo guardado con ella no habría
// salido por ninguna impresora — y sin dar ningún error.
export type Estacion = "COCINA" | "BARRA" | "CAMARERO" | "NINGUNA";

export interface FormatoVenta {
  id: string;
  codigo: string;
  nombre: string;
  /**
   * PVP del formato, con impuesto INCLUIDO (convención de la casa).
   *
   * UNO, no tres. Antes había `barra`/`salon`/`terraza` y era mentira: la BD
   * guarda un solo `product_format.precio`, y el precio por sala vive en las
   * TARIFAS (`product_price` + `room.tarifa_id`, migración 0131), que son por
   * artículo y no por formato. Salón y terraza se tecleaban y se perdían.
   */
  precio: number;
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

/**
 * PARÁMETROS del artículo: cómo se COMPORTA al venderlo (en Glop viven en su
 * propia ventana, «Parámetros del artículo»). Aquí van juntos porque casi todos
 * son un sí/no y comparten pantalla.
 *
 * Equivalencia con nuestra BD (`product`) para cuando se cablee el nodo:
 *   vendible        → `disponible`
 *   alPeso          → `vendido_por_peso`
 *   combinable      → `combinable`     (copas: 0126)
 *   esPrincipal     → `es_principal`
 *   esAnadido       → `es_anadido`
 *   agotado         → `agotado_hasta`  (el «86» de barra; aquí solo el sí/no)
 *   esAlcohol       → `es_alcohol`
 * Los que NO tienen columna todavía y habría que crear si se quieren de verdad:
 *   controlaStock · noImprimirSiCero · descripcionLibre · preguntarPrecio ·
 *   eCommerce (esMenuDelDia existe pero no se usa: ver el campo)
 */
export interface ParametrosArticulo {
  vendible: boolean;
  controlaStock: boolean;
  noImprimirSiCero: boolean;
  descripcionLibre: boolean;
  preguntarPrecio: boolean;
  /** Se puede pedir por internet (tienda). En Glop, la columna ECOM. */
  eCommerce: boolean;
  /** Sale en la carta por QR de la mesa. En Glop, C_DIGITAL. Son cosas distintas. */
  cartaDigital: boolean;
  /**
   * ⚠ MUERTO POR DISEÑO. Un menú no es un artículo: vive en `menu` +
   * `menu_group` + `menu_choice`. Se mantiene el campo porque la columna existe
   * (0128) y hay que seguir leyéndola y escribiéndola sin perderla, pero NO se
   * enseña en la ficha: una casilla que no crea ningún menú engaña.
   */
  esMenuDelDia: boolean;
  alPeso: boolean;
  combinable: boolean;
  esPrincipal: boolean;
  esAnadido: boolean;
  esAlcohol: boolean;
  agotado: boolean;
}

export const PARAMETROS_POR_DEFECTO: ParametrosArticulo = {
  vendible: true, controlaStock: false, noImprimirSiCero: false,
  descripcionLibre: false, preguntarPrecio: false, eCommerce: false, cartaDigital: false,
  esMenuDelDia: false, alPeso: false, combinable: false,
  esPrincipal: true, esAnadido: false, esAlcohol: false, agotado: false,
};

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
  /** Atajo de `parametros.vendible`: se ve en la lista y en la cabecera. */
  visible: boolean;
  /** Atajo de `parametros.alPeso` (se muestra en Datos generales). */
  alPeso: boolean;
  parametros: ParametrosArticulo;
  estacion: Estacion;
  tiempoPrep: number;
  alergenos: string[];
  /** Un producto puede estar en varias categorías (m2m). */
  categorias: string[];
  formatos: FormatoVenta[];
  comentarios: GrupoComentarios[];
  extras: Extra[];
  // ── Aspecto del botón en el TPV (los tres opcionales) ──
  /** Foto del artículo. Sin ella, el botón es color liso. */
  foto?: string;
  /** Color propio del botón. Sin él, hereda el de la familia. */
  color?: string;
  /** Nombre de icono (ver `lib/iconos`). Solo se pinta si NO hay foto. */
  icono?: string;
}

export const IMPUESTOS = [
  { valor: 10, texto: "IVA 10 % — hostelería" },
  { valor: 21, texto: "IVA 21 % — general" },
  { valor: 4, texto: "IVA 4 % — superreducido" },
  { valor: 7, texto: "IGIC 7 % — Canarias" },
  { valor: 0, texto: "Exento" },
];

export const ESTACIONES: { valor: Estacion; texto: string }[] = [
  { valor: "COCINA", texto: "Cocina" },
  { valor: "BARRA", texto: "Barra" },
  { valor: "CAMARERO", texto: "Lo prepara el camarero" },
  { valor: "NINGUNA", texto: "No se manda a preparar" },
];

export const ALERGENOS = [
  "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos",
  "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos",
];

const BEBIDAS = new Set(["cervezas", "vinos", "refrescos", "cafes", "cocteles"]);
// Con alcohol: lo necesita el desglose fiscal (y el tipo de IGIC en Canarias).
const ALCOHOL = new Set(["cervezas", "vinos", "cocteles", "copas", "combinados"]);

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
      precio: base,
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
    parametros: {
      ...PARAMETROS_POR_DEFECTO,
      // Las bebidas alcohólicas se marcan solas: lo pide el desglose fiscal y,
      // en Canarias, el tipo de IGIC.
      esAlcohol: ALCOHOL.has(p.categoria),
      combinable: p.categoria === "copas",
    },
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
  const sinImpuesto = f.precio / (1 + impuesto / 100);
  if (sinImpuesto <= 0) return 0;
  return ((sinImpuesto - f.coste) / sinImpuesto) * 100;
}
