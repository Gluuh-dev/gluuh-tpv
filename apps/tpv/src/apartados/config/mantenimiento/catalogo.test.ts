import { describe, it, expect } from "vitest";
import { aArticulo, aFila } from "./catalogo";

// Fila tal y como la escupe PostgREST. Ojo a los `numeric`: llegan como TEXTO.
const fila = {
  id: "11111111-1111-1111-1111-111111111111",
  nombre: "Caña", precio: "1.40", tipo_impositivo: "10",
  family_id: "fam-1", category_id: "cat-1",
  plu: "0007", codigo_barras: "8410000000017",
  nombre_ticket: "Caña", nombre_cocina: "CAÑA",
  estacion: "BARRA", tiempo_preparacion_min: 2,
  alergenos: ["gluten"],
  foto_url: null, color: "#2f7fd0", icono: "beer",
  descripcion: "Aceituna gordal", carta_nombre: "Aceitunas",
  product_barcode: [{ codigo: "8410000000017", principal: true }, { codigo: "8410000000024", principal: false }],
  disponible: true, agotado_hasta: null,
  vendido_por_peso: false, combinable: false, es_alcohol: true,
  es_principal: true, es_anadido: false,
  controla_stock: true, no_imprimir_si_cero: false, descripcion_libre: false,
  preguntar_precio: false, ecommerce: true, carta_digital: false, es_menu_del_dia: false,
  solicitar_anadidos: true, solicitar_notas: true, preguntar_cantidad: false,
  es_articulo_menu: false, descuento_escandallo: null,
  product_format: [
    { id: "f2", nombre: "Doble", precio: "2.60", orden: 2, coste: "0.70", raciones: "2" },
    { id: "f1", nombre: "Caña", precio: "1.40", orden: 1, coste: "0.35", raciones: "1" },
  ],
  product_category: [{ category_id: "cat-1" }, { category_id: "cat-9" }],
};

describe("aArticulo", () => {
  it("convierte los numeric que llegan como texto (si no, los precios se SUMAN como cadenas)", () => {
    const a = aArticulo(fila);
    expect(a.impuesto).toBe(10);
    expect(a.formatos[0]?.precio).toBe(1.4);
    expect(a.formatos[0]?.coste).toBe(0.35);
    expect(a.formatos[0]?.raciones).toBe(1);
  });

  it("ordena los formatos por `orden`, no por como vengan de la BD", () => {
    expect(aArticulo(fila).formatos.map((f) => f.nombre)).toEqual(["Caña", "Doble"]);
  });

  it("reduce `agotado_hasta` (una fecha) al sí/no que enseña la ficha", () => {
    expect(aArticulo(fila).parametros.agotado).toBe(false);
    expect(aArticulo({ ...fila, agotado_hasta: "2026-07-21T00:00:00Z" }).parametros.agotado).toBe(true);
  });

  it("trae el aspecto y las categorías múltiples", () => {
    const a = aArticulo(fila);
    expect(a.color).toBe("#2f7fd0");
    expect(a.icono).toBe("beer");
    expect(a.foto).toBeUndefined();
    expect(a.categorias).toEqual(["cat-1", "cat-9"]);
  });

  it("respeta TODAS las estaciones del panel, también CAMARERO y NINGUNA", () => {
    // Regresión: la lista de válidas era la de esta pantalla
    // (BARRA/COCINA/PLANCHA), así que un artículo guardado por el panel como
    // CAMARERO se abría como BARRA y al pulsar Aceptar se guardaba como BARRA.
    // El dato se perdía sin que nadie viera un error.
    for (const e of ["COCINA", "BARRA", "CAMARERO", "NINGUNA"]) {
      expect(aArticulo({ ...fila, estacion: e }).estacion).toBe(e);
    }
  });

  it("una estación desconocida o vacía cae a COCINA, igual que el panel", () => {
    expect(aArticulo({ ...fila, estacion: "MARCIANOS" }).estacion).toBe("COCINA");
    expect(aArticulo({ ...fila, estacion: null }).estacion).toBe("COCINA");
  });

  it("aguanta los nulos de un artículo recién creado por otra vía", () => {
    const pelado = {
      ...fila, precio: null, tipo_impositivo: null, family_id: null, plu: null,
      codigo_barras: null, nombre_ticket: null, nombre_cocina: null,
      alergenos: null, product_format: null, product_category: null,
    };
    const a = aArticulo(pelado);
    expect(a.impuesto).toBe(10);
    expect(a.codigo).toBe("");
    expect(a.alergenos).toEqual([]);
    expect(a.formatos).toEqual([]);
    expect(a.categorias).toEqual([]);
  });
});

describe("aFila", () => {
  it("el precio del producto sale del PRIMER formato (es el que cobra el camarero)", () => {
    const a = aArticulo(fila);
    expect(aFila(a).precio).toBe(1.4);
  });

  it("ida y vuelta: lo que se lee es lo que se guarda", () => {
    const f = aFila(aArticulo(fila));
    expect(f.nombre).toBe("Caña");
    expect(f.plu).toBe("0007");
    expect(f.codigo_barras).toBe("8410000000017");
    expect(f.color).toBe("#2f7fd0");
    expect(f.icono).toBe("beer");
    expect(f.controla_stock).toBe(true);
    // ECOM y carta QR son casillas DISTINTAS (0129): un bar quiere media carta
    // en el QR y nada en la tienda.
    expect(f.ecommerce).toBe(true);
    expect(f.carta_digital).toBe(false);
    expect(f.es_alcohol).toBe(true);
    expect(f.tipo_impositivo).toBe(10);
  });

  it("los textos vacíos van como NULL, no como cadena vacía", () => {
    const a = { ...aArticulo(fila), codigo: "", barras: "", nombreTicket: "", familia: "" };
    const f = aFila(a);
    expect(f.plu).toBeNull();
    expect(f.codigo_barras).toBeNull();
    expect(f.nombre_ticket).toBeNull();
    expect(f.family_id).toBeNull();
  });
});
