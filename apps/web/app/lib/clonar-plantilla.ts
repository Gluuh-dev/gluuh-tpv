import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Clona el CATÁLOGO de un tenant plantilla a una empresa nueva (consola de
// plataforma, Fase 3). Server-only: recibe el cliente service-role (salta RLS).
// Remapea IDs y relaciones (familia→categoría→producto, m2m, formatos,
// modificadores). Best-effort por tabla: si una falla, se sigue con el resto
// (mejor una carta parcial que abortar el alta).
type Fila = Record<string, unknown>;
const sinMeta = (o: Fila): Fila => {
  const r = { ...o };
  for (const k of ["id", "tenant_id", "created_at", "updated_at"]) delete r[k];
  return r;
};
const remap = (m: Map<string, string>, id: unknown): string | null =>
  typeof id === "string" ? (m.get(id) ?? null) : null;

export async function clonarCatalogo(
  admin: SupabaseClient,
  origen: string,
  destino: string,
): Promise<void> {
  const mapF = new Map<string, string>();
  const mapC = new Map<string, string>();
  const mapP = new Map<string, string>();
  const mapG = new Map<string, string>();

  // Familias (se aplana jerarquía y grupo mayor: null para no arrastrar deps).
  const fams = (await admin.from("family").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasF = (fams ?? []).map((f) => {
    const id = randomUUID();
    mapF.set(f.id as string, id);
    return { ...sinMeta(f), id, tenant_id: destino, familia_padre_id: null, grupo_mayor_id: null };
  });
  if (filasF.length) await admin.from("family").insert(filasF);

  // Categorías (FK family_id remapeada).
  const cats = (await admin.from("category").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasC = (cats ?? []).map((c) => {
    const id = randomUUID();
    mapC.set(c.id as string, id);
    return { ...sinMeta(c), id, tenant_id: destino, family_id: remap(mapF, c.family_id), categoria_padre_id: null };
  });
  if (filasC.length) await admin.from("category").insert(filasC);

  // Productos (FK category_id y family_id remapeadas).
  const prods = (await admin.from("product").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasP = (prods ?? []).map((p) => {
    const id = randomUUID();
    mapP.set(p.id as string, id);
    return { ...sinMeta(p), id, tenant_id: destino, category_id: remap(mapC, p.category_id), family_id: remap(mapF, p.family_id) };
  });
  if (filasP.length) await admin.from("product").insert(filasP);

  // Producto ↔ categoría (m2m).
  const pcs = (await admin.from("product_category").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasPC = (pcs ?? [])
    .filter((pc) => mapP.get(pc.product_id as string) && mapC.get(pc.category_id as string))
    .map((pc) => ({ ...sinMeta(pc), tenant_id: destino, product_id: remap(mapP, pc.product_id), category_id: remap(mapC, pc.category_id) }));
  if (filasPC.length) await admin.from("product_category").insert(filasPC);

  // Formatos del producto.
  const pfs = (await admin.from("product_format").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasPF = (pfs ?? [])
    .filter((pf) => mapP.get(pf.product_id as string))
    .map((pf) => ({ ...sinMeta(pf), tenant_id: destino, product_id: remap(mapP, pf.product_id) }));
  if (filasPF.length) await admin.from("product_format").insert(filasPF);

  // Grupos de modificadores (product_id null = grupo de biblioteca; se conserva).
  const mgs = (await admin.from("modifier_group").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasMG = (mgs ?? []).map((g) => {
    const id = randomUUID();
    mapG.set(g.id as string, id);
    return { ...sinMeta(g), id, tenant_id: destino, product_id: g.product_id ? remap(mapP, g.product_id) : null };
  });
  if (filasMG.length) await admin.from("modifier_group").insert(filasMG);

  // Opciones de modificador.
  const mods = (await admin.from("modifier").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasM = (mods ?? [])
    .filter((m) => mapG.get(m.modifier_group_id as string))
    .map((m) => ({ ...sinMeta(m), tenant_id: destino, modifier_group_id: remap(mapG, m.modifier_group_id) }));
  if (filasM.length) await admin.from("modifier").insert(filasM);

  // Asignaciones de la biblioteca (0064): grupo → familia/categoría/producto.
  // Sin esto los grupos de biblioteca clonados quedan huérfanos (sin herencia).
  const asigs = (await admin.from("modifier_group_asignacion").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasA = (asigs ?? [])
    .filter((a) => mapG.get(a.modifier_group_id as string)
      && (mapF.get(a.family_id as string) || mapC.get(a.category_id as string) || mapP.get(a.product_id as string)))
    .map((a) => ({
      ...sinMeta(a), tenant_id: destino, modifier_group_id: remap(mapG, a.modifier_group_id),
      family_id: remap(mapF, a.family_id), category_id: remap(mapC, a.category_id), product_id: remap(mapP, a.product_id),
    }));
  if (filasA.length) await admin.from("modifier_group_asignacion").insert(filasA);

  // Notas de preparación (globales del tenant, sin FKs).
  await clonarTabla(admin, "nota_preparacion", origen, destino);

  // Etiquetas de producto + su m2m.
  const mapE = new Map<string, string>();
  const etis = (await admin.from("etiqueta_producto").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasE = (etis ?? []).map((e) => {
    const id = randomUUID();
    mapE.set(e.id as string, id);
    return { ...sinMeta(e), id, tenant_id: destino };
  });
  if (filasE.length) await admin.from("etiqueta_producto").insert(filasE);
  const pes = (await admin.from("product_etiqueta").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasPE = (pes ?? [])
    .filter((pe) => mapP.get(pe.product_id as string) && mapE.get(pe.etiqueta_id as string))
    .map((pe) => ({ ...sinMeta(pe), tenant_id: destino, product_id: remap(mapP, pe.product_id), etiqueta_id: remap(mapE, pe.etiqueta_id) }));
  if (filasPE.length) await admin.from("product_etiqueta").insert(filasPE);

  // Menús/combos: menu → menu_group → menu_choice(product_id).
  const mapM = new Map<string, string>();
  const mapMG = new Map<string, string>();
  const menus = (await admin.from("menu").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasMn = (menus ?? []).map((m) => {
    const id = randomUUID();
    mapM.set(m.id as string, id);
    return { ...sinMeta(m), id, tenant_id: destino };
  });
  if (filasMn.length) await admin.from("menu").insert(filasMn);
  const mgrupos = (await admin.from("menu_group").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasMGr = (mgrupos ?? [])
    .filter((g) => mapM.get(g.menu_id as string))
    .map((g) => {
      const id = randomUUID();
      mapMG.set(g.id as string, id);
      return { ...sinMeta(g), id, tenant_id: destino, menu_id: remap(mapM, g.menu_id) };
    });
  if (filasMGr.length) await admin.from("menu_group").insert(filasMGr);
  const choices = (await admin.from("menu_choice").select("*").eq("tenant_id", origen)).data as Fila[] | null;
  const filasCh = (choices ?? [])
    .filter((c) => mapMG.get(c.group_id as string) && mapP.get(c.product_id as string))
    .map((c) => ({ ...sinMeta(c), tenant_id: destino, group_id: remap(mapMG, c.group_id), product_id: remap(mapP, c.product_id) }));
  if (filasCh.length) await admin.from("menu_choice").insert(filasCh);
}

// Clona filas sueltas de una tabla (sin FKs a remapear): impuestos, formas de
// pago, plantillas de ticket… Cambia solo el tenant_id.
export async function clonarTabla(
  admin: SupabaseClient,
  tabla: string,
  origen: string,
  destino: string,
): Promise<void> {
  const { data } = await admin.from(tabla).select("*").eq("tenant_id", origen);
  const filas = (data as Fila[] | null ?? []).map((row) => ({ ...sinMeta(row), tenant_id: destino }));
  if (filas.length) await admin.from(tabla).insert(filas);
}
