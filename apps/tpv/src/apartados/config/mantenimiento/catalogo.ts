import { leer, escribir, subirImagen, haySesion, tenantId } from "../../../lib/nodo";
import { PARAMETROS_POR_DEFECTO, type Articulo, type Estacion, type FormatoVenta } from "./datos-articulos";

// ============================================================================
// CATÁLOGO REAL — la ficha de artículo contra `product` del nodo.
//
// Sin terminal emparejado no se toca la red: `cargarCatalogo()` devuelve null y
// la pantalla se queda con el catálogo demo, marcado como ejemplo.
//
// El precio por SALA ya no se finge aquí: vive en las TARIFAS (`product_price`
// + `room.tarifa_id`, migración 0131), que son por artículo, no por formato.
// ============================================================================

interface FilaProducto {
  id: string; nombre: string; precio: number | string | null;
  tipo_impositivo: number | string | null;
  family_id: string | null; category_id: string | null;
  plu: string | null; codigo_barras: string | null;
  nombre_ticket: string | null; nombre_cocina: string | null;
  estacion: string | null; tiempo_preparacion_min: number | null;
  alergenos: string[] | null;
  foto_url: string | null; color: string | null; icono: string | null;
  disponible: boolean; agotado_hasta: string | null;
  vendido_por_peso: boolean; combinable: boolean; es_alcohol: boolean;
  es_principal: boolean; es_anadido: boolean;
  controla_stock: boolean; no_imprimir_si_cero: boolean; descripcion_libre: boolean;
  preguntar_precio: boolean; ecommerce: boolean; carta_digital: boolean; es_menu_del_dia: boolean;
  solicitar_anadidos: boolean; solicitar_notas: boolean; preguntar_cantidad: boolean;
  es_articulo_menu: boolean; descuento_escandallo: number | string | null;
  product_format: FilaFormato[] | null;
  product_category: { category_id: string }[] | null;
}

interface FilaFormato {
  id: string; nombre: string | null; precio: number | string | null;
  orden: number | null; coste: number | string | null; raciones: number | string | null;
}

const COLUMNAS =
  "id,nombre,precio,tipo_impositivo,family_id,category_id,plu,codigo_barras," +
  "nombre_ticket,nombre_cocina,estacion,tiempo_preparacion_min,alergenos," +
  "foto_url,color,icono,disponible,agotado_hasta,vendido_por_peso,combinable," +
  "es_alcohol,es_principal,es_anadido,controla_stock,no_imprimir_si_cero," +
  "descripcion_libre,preguntar_precio,ecommerce,carta_digital,es_menu_del_dia," +
  "solicitar_anadidos,solicitar_notas,preguntar_cantidad,es_articulo_menu,descuento_escandallo," +
  "product_format(id,nombre,precio,orden,coste,raciones)," +
  "product_category(category_id)";

/** `numeric` de Postgres llega como TEXTO por JSON: sin esto los precios se suman como cadenas. */
const num = (v: number | string | null | undefined, pordefecto = 0): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : pordefecto;
};

const ESTACIONES_VALIDAS = ["COCINA", "BARRA", "CAMARERO", "NINGUNA"] as const;

/**
 * Estación de la fila, o COCINA si viene vacía (mismo criterio que el panel).
 *
 * ⚠ Esto ANTES normalizaba a "BARRA" cualquier valor que no conociera, y la
 * lista de conocidos era la de esta pantalla (BARRA/COCINA/PLANCHA). Un
 * artículo que el panel hubiera guardado como CAMARERO se abría aquí como
 * barra, y al pulsar Aceptar se guardaba como barra: el dato se perdía sin que
 * nadie viera un error. Ahora la lista es la MISMA que la del panel.
 */
const aEstacion = (v: string | null): Estacion =>
  (ESTACIONES_VALIDAS as readonly string[]).includes(v ?? "") ? (v as Estacion) : "COCINA";

/** Fila del nodo → ficha de la pantalla. */
export function aArticulo(p: FilaProducto): Articulo {
  const precio = num(p.precio);
  const formatos: FormatoVenta[] = (p.product_format ?? [])
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((f, i) => ({
      id: f.id,
      codigo: String(i + 1).padStart(2, "0"),
      nombre: f.nombre ?? "Unidad",
      precio: num(f.precio, precio),
      barras: "",
      combinado: false,
      modificable: true,
      raciones: num(f.raciones, 1),
      coste: num(f.coste),
    }));

  return {
    id: p.id,
    codigo: p.plu ?? "",
    nombre: p.nombre,
    nombreComanda: p.nombre_cocina ?? "",
    nombreTicket: p.nombre_ticket ?? "",
    familia: p.family_id ?? "",
    impuesto: num(p.tipo_impositivo, 10),
    barras: p.codigo_barras ?? "",
    visible: p.disponible,
    alPeso: p.vendido_por_peso,
    parametros: {
      ...PARAMETROS_POR_DEFECTO,
      vendible: p.disponible,
      // `agotado_hasta` es una FECHA («86 hasta mañana»); la ficha solo enseña
      // el sí/no, así que aquí se reduce a "hay fecha o no la hay".
      agotado: p.agotado_hasta !== null,
      alPeso: p.vendido_por_peso,
      combinable: p.combinable,
      esPrincipal: p.es_principal,
      esAnadido: p.es_anadido,
      esAlcohol: p.es_alcohol,
      controlaStock: p.controla_stock,
      noImprimirSiCero: p.no_imprimir_si_cero,
      descripcionLibre: p.descripcion_libre,
      preguntarPrecio: p.preguntar_precio,
      eCommerce: p.ecommerce,
      cartaDigital: p.carta_digital,
      esMenuDelDia: p.es_menu_del_dia,
      solicitarAnadidos: p.solicitar_anadidos,
      solicitarNotas: p.solicitar_notas,
      preguntarCantidad: p.preguntar_cantidad,
      esArticuloMenu: p.es_articulo_menu,
    },
    estacion: aEstacion(p.estacion),
    tiempoPrep: p.tiempo_preparacion_min ?? 0,
    alergenos: p.alergenos ?? [],
    categorias: (p.product_category ?? []).map((c) => c.category_id),
    formatos,
    comentarios: [],
    extras: [],
    ...(p.foto_url ? { foto: p.foto_url } : {}),
    ...(p.color ? { color: p.color } : {}),
    ...(p.icono ? { icono: p.icono } : {}),
    ...(p.descuento_escandallo === null ? {} : { descuentoEscandallo: num(p.descuento_escandallo) }),
  };
}

/**
 * Ficha → fila de `product`.
 *
 * `precio` sale del PRIMER formato: es el que enseña el botón del TPV. Si se
 * dejara suelto, cambiar el precio en la ficha no cambiaría lo que cobra el
 * camarero — y eso es dinero.
 */
export function aFila(a: Articulo): Record<string, unknown> {
  return {
    id: a.id,
    nombre: a.nombre,
    precio: a.formatos[0]?.precio ?? 0,
    tipo_impositivo: a.impuesto,
    family_id: a.familia || null,
    plu: a.codigo || null,
    codigo_barras: a.barras || null,
    nombre_ticket: a.nombreTicket || null,
    nombre_cocina: a.nombreComanda || null,
    estacion: a.estacion,
    tiempo_preparacion_min: a.tiempoPrep,
    alergenos: a.alergenos,
    foto_url: a.foto ?? null,
    color: a.color ?? null,
    icono: a.icono ?? null,
    disponible: a.parametros.vendible,
    vendido_por_peso: a.parametros.alPeso,
    combinable: a.parametros.combinable,
    es_alcohol: a.parametros.esAlcohol,
    es_principal: a.parametros.esPrincipal,
    es_anadido: a.parametros.esAnadido,
    controla_stock: a.parametros.controlaStock,
    no_imprimir_si_cero: a.parametros.noImprimirSiCero,
    descripcion_libre: a.parametros.descripcionLibre,
    preguntar_precio: a.parametros.preguntarPrecio,
    ecommerce: a.parametros.eCommerce,
    carta_digital: a.parametros.cartaDigital,
    es_menu_del_dia: a.parametros.esMenuDelDia,
    solicitar_anadidos: a.parametros.solicitarAnadidos,
    solicitar_notas: a.parametros.solicitarNotas,
    preguntar_cantidad: a.parametros.preguntarCantidad,
    es_articulo_menu: a.parametros.esArticuloMenu,
    descuento_escandallo: a.descuentoEscandallo ?? null,
    updated_at: new Date().toISOString(),
  };
}

export interface FamiliaCatalogo { id: string; nombre: string; codigo: string; color: string }

interface FilaFamilia { id: string; nombre: string; color: string | null; orden: number | null }

/**
 * El catálogo del bar, o `null` si este terminal no está emparejado (entonces la
 * pantalla se queda en demo). Un fallo de red también da `null`: enseñar la demo
 * es preferible a una pantalla vacía sin explicación.
 */
export async function cargarCatalogo(): Promise<{ articulos: Articulo[]; familias: FamiliaCatalogo[] } | null> {
  if (!haySesion()) return null;
  const [productos, familias] = await Promise.all([
    leer<FilaProducto>(`product?select=${COLUMNAS}&order=nombre`),
    leer<FilaFamilia>("family?select=id,nombre,color,orden&order=orden"),
  ]);
  if (!productos || !familias) return null;
  return {
    articulos: productos.map(aArticulo),
    familias: familias.map((f, i) => ({
      id: f.id, nombre: f.nombre, codigo: String(f.orden ?? i + 1),
      color: f.color ?? "#64748b",
    })),
  };
}

/**
 * `tenant_id` es NOT NULL y sin DEFAULT en todo el catálogo, así que cada alta
 * tiene que decir de qué bar es. Si el token no lo trae, se para AQUÍ: escribir
 * sin bar sería una fila huérfana que la RLS ya no deja ni leer.
 */
function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

/** Guarda la ficha (alta o cambio) con sus formatos y sus categorías. */
export async function guardarArticulo(a: Articulo): Promise<void> {
  const tenant_id = bar();
  await escribir("product?on_conflict=id", "POST", [{ ...aFila(a), tenant_id }]);

  if (a.formatos.length > 0) {
    await escribir("product_format?on_conflict=id", "POST", a.formatos.map((f, i) => ({
      id: f.id, product_id: a.id, tenant_id, nombre: f.nombre, precio: f.precio,
      orden: i, coste: f.coste, raciones: f.raciones,
      updated_at: new Date().toISOString(),
    })));
  }

  // Las categorías son una lista COMPLETA: se borra y se reescribe. Un upsert a
  // secas dejaría vivas las que el usuario acaba de quitar.
  await escribir(`product_category?product_id=eq.${a.id}`, "DELETE");
  if (a.categorias.length > 0) {
    await escribir("product_category", "POST", a.categorias.map((c, i) => ({
      product_id: a.id, category_id: c, tenant_id, orden: i,
    })));
  }
}

export async function borrarArticulo(id: string): Promise<void> {
  await escribir(`product?id=eq.${id}`, "DELETE");
}

export async function crearFamiliaEnNodo(id: string, nombre: string, orden: number): Promise<void> {
  await escribir("family", "POST", [{ id, nombre, orden, color: "#64748b", tenant_id: bar() }]);
}

/** Sube la foto del artículo al nodo y devuelve su URL. */
export async function subirFotoArticulo(idArticulo: string, datos: Blob): Promise<string> {
  return subirImagen(`productos/${idArticulo}-${Date.now()}.jpg`, datos);
}

// ── TARIFAS (0131) ──────────────────────────────────────────────────────────
// El precio por sala vive AQUÍ, no en el formato: la tarifa es del artículo, y
// la sala elige tarifa (`room.tarifa_id`). Si una tarifa no dice nada de un
// artículo, se cobra su precio normal — nunca 0.

export interface TarifaCatalogo { id: string; nombre: string }

export interface PrecioTarifa { tarifaId: string; precio: number }

export async function cargarTarifas(): Promise<TarifaCatalogo[] | null> {
  if (!haySesion()) return null;
  return leer<TarifaCatalogo>("tarifa?select=id,nombre&order=nombre");
}

export async function cargarPreciosDeArticulo(productId: string): Promise<PrecioTarifa[] | null> {
  if (!haySesion()) return null;
  const filas = await leer<{ tarifa_id: string; precio: number | string | null }>(
    `product_price?product_id=eq.${productId}&select=tarifa_id,precio`);
  return filas?.map((f) => ({ tarifaId: f.tarifa_id, precio: num(f.precio) })) ?? null;
}

/**
 * Fija (o quita, con `precio` null) el precio de un artículo en una tarifa.
 *
 * Quitar borra la fila en vez de guardar 0: un 0 es «regalado» y eso no es lo
 * que quiere decir «esta tarifa no cambia el precio de esto».
 */
export async function fijarPrecioTarifa(
  productId: string, tarifaId: string, precio: number | null,
): Promise<void> {
  if (precio === null) {
    await escribir(`product_price?product_id=eq.${productId}&tarifa_id=eq.${tarifaId}`, "DELETE");
    return;
  }
  await escribir("product_price?on_conflict=tenant_id,product_id,tarifa_id", "POST", [{
    tenant_id: bar(), product_id: productId, tarifa_id: tarifaId, precio,
    updated_at: new Date().toISOString(),
  }]);
}
