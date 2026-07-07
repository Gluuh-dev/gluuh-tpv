import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { PERFILES_RECOMENDADOS } from "@/app/lib/permisos";

// Alta de empresa COMPLETA en un paso. SOLO el técnico de Gluuh (es_admin_plataforma):
// datos + dirección + módulos + duración → crea la cuenta (el trigger provisiona
// tenant/propietario/location SOLO con empresa_nombre en metadata, 0078), fija la
// licencia, genera el CÓDIGO DE INSTALACIÓN único (0000-0000-00000-0000-0000) que
// fija cada instalación a su empresa, y siembra usuarios y catálogo de ejemplo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clave técnica legible para el instalador: 8 caracteres sin ambiguos (0/O, 1/l/I).
const ALFABETO_CLAVE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generarClaveTecnica(): string {
  return Array.from({ length: 8 }, () => ALFABETO_CLAVE[randomInt(ALFABETO_CLAVE.length)]).join("");
}

// Código de instalación: dígitos aleatorios (CSPRNG) en grupos 4-4-5-4-4.
const dig = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
const generarCodigoInstalacion = () => `${dig(4)}-${dig(4)}-${dig(5)}-${dig(4)}-${dig(4)}`;

// Quita claves sin valor (para updates parciales).
const conValor = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ""));

type Admin = SupabaseClient;

// Aprovisionamiento tras el alta, una vez existe el tenant. Best-effort deliberado:
// la empresa queda creada aunque falle una pieza (se puede rehacer desde /admin).
async function aprovisionar(admin: Admin, tid: string, datos: {
  cif?: string; direccion?: string; poblacion?: string; provincia?: string;
  codigoPostal?: string; telefono?: string; meses?: unknown; modulos?: unknown;
}): Promise<{ codigoInstalacion: string | null; claveTecnica: string | null }> {
  // Código de instalación único (reintento ante la remotísima colisión).
  let codigoInstalacion: string | null = null;
  for (let i = 0; i < 3 && !codigoInstalacion; i++) {
    const cod = generarCodigoInstalacion();
    const { error } = await admin.from("tenant").update({ codigo_instalacion: cod }).eq("id", tid);
    if (!error) codigoInstalacion = cod;
  }

  // Licencia (duración + módulos) y datos fiscales/dirección.
  const meses = Number.isInteger(datos.meses) && (datos.meses as number) > 0 ? (datos.meses as number) : null;
  const hasta = meses ? (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString().slice(0, 10); })() : null;
  const mods = Array.isArray(datos.modulos) ? datos.modulos.filter((m: unknown) => typeof m === "string") : [];
  await admin.from("tenant").update(conValor({ cif: datos.cif, licencia_hasta: hasta, licencia_modulos: hasta ? mods : null })).eq("id", tid);
  const loc = conValor({ direccion: datos.direccion, poblacion: datos.poblacion, provincia: datos.provincia, codigo_postal: datos.codigoPostal, telefono: datos.telefono, cif: datos.cif });
  if (Object.keys(loc).length) await admin.from("location").update(loc).eq("tenant_id", tid);

  // Clave técnica de la "Zona técnica" (RPC 0045); se devuelve UNA VEZ.
  let claveTecnica: string | null = generarClaveTecnica();
  const { error: eClave } = await admin.rpc("admin_establecer_clave_tecnica", { p_tenant: tid, p_clave: claveTecnica });
  if (eClave) claveTecnica = null; // la clave se podrá fijar después

  // Perfiles recomendados + usuarios y catálogo de ejemplo.
  await admin.from("perfil").insert(
    PERFILES_RECOMENDADOS.map((r) => ({ tenant_id: tid, nombre: r.nombre, descripcion: r.descripcion, permisos: r.permisos })),
  );
  await admin.rpc("admin_sembrar_operarios_defecto", { p_tenant: tid }); // tecnico/1212 + PIN dueño
  await admin.rpc("admin_sembrar_ejemplo", { p_tenant: tid });           // admin/camareros + familias/productos

  return { codigoInstalacion, claveTecnica };
}

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const caller = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: esAdmin, error: e1 } = await caller.rpc("es_admin_plataforma");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { empresa, email, password, cif, direccion, poblacion, provincia, codigoPostal, telefono, meses, modulos } = await req.json();
  if (!empresa || !email || !password) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { empresa_nombre: empresa },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: au } = await admin
    .from("app_user")
    .select("tenant_id")
    .eq("auth_user_id", data.user?.id ?? "")
    .maybeSingle();
  if (!au?.tenant_id) {
    return NextResponse.json({ ok: true, userId: data.user?.id, claveTecnica: null, codigoInstalacion: null });
  }

  const { codigoInstalacion, claveTecnica } = await aprovisionar(admin, au.tenant_id as string, {
    cif, direccion, poblacion, provincia, codigoPostal, telefono, meses, modulos,
  });
  return NextResponse.json({ ok: true, userId: data.user?.id, claveTecnica, codigoInstalacion });
}
