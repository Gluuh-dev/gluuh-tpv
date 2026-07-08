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
