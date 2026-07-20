import { leer, escribir, haySesion, tenantId } from "../../../lib/nodo";

// ============================================================================
// EXTRAS Y COMENTARIOS — y de dónde los saca un artículo.
//
// Un artículo NO define solos sus extras. Los hereda, y esto es lo que espera
// quien viene de Glop: los grupos de la BIBLIOTECA se asignan a una familia
// («todas las hamburguesas llevan punto de la carne») o a una categoría, y el
// artículo los recibe. Encima puede tener los SUYOS propios, y puede QUITARSE
// uno heredado que no le pegue.
//
// Resolución por niveles, de lo general a lo concreto:
//     familia → categorías (todas, es m2m) → artículo
// Dentro de cada nivel se aplican primero los EXCLUIR y luego los INCLUIR, así
// que en el mismo nivel INCLUIR gana; y un nivel más concreto puede quitar lo
// que heredó del de arriba, o volver a ponerlo.
//
// Portado 1:1 de `apps/web/app/lib/catalogo-store.ts` (`gruposDeProducto`),
// que es el que usa el TPV de Next para vender. Si los dos no dicen lo mismo,
// el camarero ve unos extras al vender y el dueño otros al configurar.
// ============================================================================

/** `tipo`: COMENTARIO (sin precio, va a cocina) o EXTRA (suma al ticket). */
export type TipoGrupo = "COMENTARIO" | "EXTRA";

export interface OpcionModificador { id: string; nombre: string; precioExtra: number }

export interface GrupoModificador {
  id: string;
  nombre: string;
  tipo: TipoGrupo;
  /** Cuántas se pueden elegir: 0/1 = opcional, 1/1 = obligatoria una. */
  min: number;
  max: number;
  opciones: OpcionModificador[];
  /** null = es de la BIBLIOTECA (compartido); si no, es propio de ese artículo. */
  productId: string | null;
}

export type ModoAsignacion = "INCLUIR" | "EXCLUIR";

export interface Asignacion {
  grupoId: string;
  familyId: string | null;
  categoryId: string | null;
  productId: string | null;
  modo: ModoAsignacion;
}

/** De dónde le viene un grupo al artículo. Se enseña en la ficha. */
export type Origen = "propio" | "familia" | "categoria" | "articulo";

export interface GrupoEfectivo extends GrupoModificador { origen: Origen }

/**
 * Los grupos que de verdad se le ofrecen al camarero para este artículo.
 *
 * Función PURA: se puede probar sin nodo, y es lo que hay que probar — el orden
 * de los niveles y el «EXCLUIR antes que INCLUIR» son justo lo que se rompe.
 */
export function gruposEfectivos(
  articulo: Readonly<{ id: string; familia: string | null; categorias: readonly string[] }>,
  propios: readonly GrupoModificador[],
  biblioteca: readonly GrupoModificador[],
  asignaciones: readonly Asignacion[],
): GrupoEfectivo[] {
  const mios: GrupoEfectivo[] = propios
    .filter((g) => g.productId === articulo.id)
    .map((g) => ({ ...g, origen: "propio" }));

  if (asignaciones.length === 0 || biblioteca.length === 0) return mios;

  // De dónde entró cada grupo, para poder decirlo en la ficha ("viene de la
  // familia"): si un nivel más concreto lo vuelve a incluir, manda el último.
  const origenDe = new Map<string, Origen>();
  const aplicarNivel = (nivel: readonly Asignacion[], origen: Origen) => {
    for (const a of nivel) if (a.modo === "EXCLUIR") origenDe.delete(a.grupoId);
    for (const a of nivel) if (a.modo === "INCLUIR") origenDe.set(a.grupoId, origen);
  };

  aplicarNivel(asignaciones.filter((a) => a.familyId !== null && a.familyId === articulo.familia), "familia");
  aplicarNivel(asignaciones.filter((a) => a.categoryId !== null && articulo.categorias.includes(a.categoryId)), "categoria");
  aplicarNivel(asignaciones.filter((a) => a.productId === articulo.id), "articulo");

  const porId = new Map(biblioteca.map((g) => [g.id, g]));
  const heredados: GrupoEfectivo[] = [];
  for (const [id, origen] of origenDe) {
    const g = porId.get(id);
    if (g) heredados.push({ ...g, origen });
  }
  return [...mios, ...heredados];
}

// ── Carga y guardado contra el nodo ─────────────────────────────────────────

interface FilaGrupo {
  id: string; product_id: string | null; nombre: string;
  min_sel: number | null; max_sel: number | null; tipo: string | null;
  modifier: { id: string; nombre: string; precio_extra: number | string | null }[] | null;
}

interface FilaAsignacion {
  modifier_group_id: string; family_id: string | null;
  category_id: string | null; product_id: string | null; modo: string;
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const aGrupo = (g: FilaGrupo): GrupoModificador => ({
  id: g.id,
  nombre: g.nombre,
  // Sin tipo explícito lo decide el precio: si alguna opción cuesta, es un EXTRA.
  tipo: g.tipo === "EXTRA" || g.tipo === "COMENTARIO"
    ? g.tipo
    : (g.modifier ?? []).some((m) => num(m.precio_extra) > 0) ? "EXTRA" : "COMENTARIO",
  min: g.min_sel ?? 0,
  max: g.max_sel ?? 1,
  productId: g.product_id,
  opciones: (g.modifier ?? []).map((m) => ({
    id: m.id, nombre: m.nombre, precioExtra: num(m.precio_extra),
  })),
});

export interface Modificadores {
  /** Todos los grupos con dueño (los de cada artículo). */
  propios: GrupoModificador[];
  /** Los compartidos (`product_id` nulo). */
  biblioteca: GrupoModificador[];
  asignaciones: Asignacion[];
}

/** Los modificadores del bar, o `null` si el terminal no está emparejado. */
export async function cargarModificadores(): Promise<Modificadores | null> {
  if (!haySesion()) return null;
  const [grupos, asignaciones] = await Promise.all([
    leer<FilaGrupo>("modifier_group?select=id,product_id,nombre,min_sel,max_sel,tipo,modifier(id,nombre,precio_extra)"),
    leer<FilaAsignacion>("modifier_group_asignacion?select=modifier_group_id,family_id,category_id,product_id,modo"),
  ]);
  if (!grupos || !asignaciones) return null;

  const todos = grupos.map(aGrupo);
  return {
    propios: todos.filter((g) => g.productId !== null),
    biblioteca: todos.filter((g) => g.productId === null),
    asignaciones: asignaciones.map((a) => ({
      grupoId: a.modifier_group_id, familyId: a.family_id,
      categoryId: a.category_id, productId: a.product_id,
      modo: a.modo === "EXCLUIR" ? "EXCLUIR" : "INCLUIR",
    })),
  };
}

function bar(): string {
  const t = tenantId();
  if (!t) throw new Error("La sesión de este terminal no dice a qué bar pertenece: no puedo guardar.");
  return t;
}

/**
 * Guarda los grupos PROPIOS de un artículo (los heredados no se tocan aquí: se
 * cambian donde viven, en la biblioteca, o se quitan con una exclusión).
 *
 * Se borran los que ya no están antes de reescribir: si solo se hiciera upsert,
 * un grupo que el dueño acaba de quitar seguiría saliendo en el TPV.
 */
export async function guardarGruposPropios(productId: string, grupos: readonly GrupoModificador[]): Promise<void> {
  const tenant_id = bar();
  const vivos = grupos.map((g) => g.id);

  await escribir(
    `modifier_group?product_id=eq.${productId}${vivos.length ? `&id=not.in.(${vivos.join(",")})` : ""}`,
    "DELETE",
  );
  if (grupos.length === 0) return;

  await escribir("modifier_group?on_conflict=id", "POST", grupos.map((g) => ({
    id: g.id, tenant_id, product_id: productId, nombre: g.nombre,
    min_sel: g.min, max_sel: g.max, tipo: g.tipo,
    updated_at: new Date().toISOString(),
  })));

  // Las opciones se reescriben enteras por grupo: son pocas y así no hay que
  // llevar la cuenta de cuáles se han quitado.
  for (const g of grupos) {
    await escribir(`modifier?modifier_group_id=eq.${g.id}`, "DELETE");
    if (g.opciones.length === 0) continue;
    await escribir("modifier", "POST", g.opciones.map((o) => ({
      id: o.id, tenant_id, modifier_group_id: g.id,
      nombre: o.nombre, precio_extra: o.precioExtra,
      updated_at: new Date().toISOString(),
    })));
  }
}

/** Quita del artículo un grupo HEREDADO, sin tocar la biblioteca ni a sus hermanos. */
export async function excluirGrupoDelArticulo(productId: string, grupoId: string): Promise<void> {
  await escribir("modifier_group_asignacion", "POST", [{
    tenant_id: bar(), modifier_group_id: grupoId, product_id: productId, modo: "EXCLUIR",
  }]);
}
