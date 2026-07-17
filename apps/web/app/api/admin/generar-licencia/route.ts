import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { GluuhContractDatabase } from "@gluuh/supabase";
import { randomInt } from "node:crypto";
import { hostPlataforma } from "@/app/lib/plataforma";

// Emite un código de licencia para una empresa. SOLO el administrador de
// plataforma (Gluuh): se verifica al llamante con su token (es_admin_plataforma)
// y luego se usa la clave secreta para insertar la licencia (admin_generar_licencia).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Código legible para el cliente: GLUH-XXXX-XXXX-XXXX, alfabeto sin ambiguos.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const generarCodigo = () => `GLUH-${grupo()}-${grupo()}-${grupo()}`;

export async function POST(req: Request) {
  if (!hostPlataforma(req.headers.get("host"))) return new NextResponse(null, { status: 404 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const caller = createClient<GluuhContractDatabase>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: esAdmin, error: e1 } = await caller.rpc("es_admin_plataforma");
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!esAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { tenantId, meses, modulos } = await req.json();
  if (!tenantId || !Number.isInteger(meses) || meses <= 0) {
    return NextResponse.json({ error: "Faltan datos (tenantId / meses)" }, { status: 400 });
  }
  const mods: string[] = Array.isArray(modulos) ? modulos.filter((m) => typeof m === "string") : [];

  const admin = createClient<GluuhContractDatabase>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const codigo = generarCodigo();
  const { error } = await admin.rpc("admin_generar_licencia", {
    p_tenant: tenantId,
    p_meses: meses,
    p_modulos: mods,
    p_codigo: codigo,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, codigo });
}
