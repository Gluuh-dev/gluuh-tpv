import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { hostPlataforma } from "@/app/lib/plataforma";

// Gestión de una empresa ya creada. SOLO el técnico de Gluuh (es_admin_plataforma).
// Acciones de soporte remoto (sin tocar la BD a mano): resetear la password del
// cliente (sin email, el rescate lo hace Gluuh), renovar la licencia y regenerar
// el código de instalación si se ha filtrado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const legible = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const dig = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
const generarCodigoInstalacion = () => `${dig(4)}-${dig(4)}-${dig(5)}-${dig(4)}-${dig(4)}`;

// La cuenta de EMPRESA de un tenant: el app_user con email (sintético
// @cuentas.gluuh.local) y auth_user_id — los operarios tienen email null.
async function cuentaEmpresa(admin: SupabaseClient, tid: string): Promise<string | null> {
  const { data } = await admin
    .from("app_user")
    .select("auth_user_id")
    .eq("tenant_id", tid)
    .not("auth_user_id", "is", null)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  return (data as { auth_user_id: string } | null)?.auth_user_id ?? null;
}

async function resetPassword(admin: SupabaseClient, tid: string) {
  const authId = await cuentaEmpresa(admin, tid);
  if (!authId) return NextResponse.json({ error: "Esta empresa no tiene cuenta de acceso con contraseña." }, { status: 404 });
  const nueva = legible(10);
  const { data: u } = await admin.auth.admin.getUserById(authId);
  const meta = { ...(u.user?.user_metadata ?? {}), debe_cambiar_password: true };
  const { error } = await admin.auth.admin.updateUserById(authId, { password: nueva, user_metadata: meta });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, passwordInicial: nueva });
}

async function renovarLicencia(admin: SupabaseClient, tid: string, meses: unknown, modulos: unknown) {
  const m = Number(meses);
  if (!Number.isInteger(m) || m <= 0) return NextResponse.json({ error: "Duración no válida" }, { status: 400 });
  const d = new Date(); d.setMonth(d.getMonth() + m);
  const hasta = d.toISOString().slice(0, 10);
  const mods = Array.isArray(modulos) ? modulos.filter((x: unknown) => typeof x === "string") : [];
  const { error } = await admin.from("tenant").update({ licencia_hasta: hasta, licencia_modulos: mods }).eq("id", tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, licenciaHasta: hasta });
}

async function regenerarCodigo(admin: SupabaseClient, tid: string) {
  for (let i = 0; i < 3; i++) {
    const cod = generarCodigoInstalacion();
    const { error } = await admin.from("tenant").update({ codigo_instalacion: cod }).eq("id", tid);
    if (!error) return NextResponse.json({ ok: true, codigoInstalacion: cod });
  }
  return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
}

export async function POST(req: Request) {
  if (!hostPlataforma(req.headers.get("host"))) return new NextResponse(null, { status: 404 });
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

  const { accion, tenantId, meses, modulos } = await req.json().catch(() => ({}));
  if (!tenantId) return NextResponse.json({ error: "Falta la empresa" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  switch (accion) {
    case "reset-password": return resetPassword(admin, tenantId);
    case "renovar-licencia": return renovarLicencia(admin, tenantId, meses, modulos);
    case "regenerar-codigo": return regenerarCodigo(admin, tenantId);
    default: return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }
}
