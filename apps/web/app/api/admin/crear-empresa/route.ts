import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { PERFILES_RECOMENDADOS } from "@/app/lib/permisos";

// Crea una cuenta de empresa. SOLO el administrador de plataforma (Gluuh).
// Verifica al llamante con su token (es_admin_plataforma) y luego usa la clave
// secreta para crear el usuario; el trigger provisiona tenant + propietario.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clave técnica legible para el instalador: 8 caracteres sin ambiguos (0/O, 1/l/I).
const ALFABETO_CLAVE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generarClaveTecnica(): string {
  return Array.from({ length: 8 }, () => ALFABETO_CLAVE[randomInt(ALFABETO_CLAVE.length)]).join("");
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

  const { empresa, email, password } = await req.json();
  if (!empresa || !email || !password) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { empresa_nombre: empresa },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Clave técnica de la "Zona técnica" (Impresión, Dispositivos, Copias). Se
  // guarda hasheada (RPC 0045, solo service_role) y se devuelve UNA VEZ en la
  // respuesta para que el instalador la apunte.
  let claveTecnica: string | null = generarClaveTecnica();
  const { data: au } = await admin
    .from("app_user")
    .select("tenant_id")
    .eq("auth_user_id", data.user?.id ?? "")
    .maybeSingle();
  if (au?.tenant_id) {
    const { error: eClave } = await admin.rpc("admin_establecer_clave_tecnica", {
      p_tenant: au.tenant_id,
      p_clave: claveTecnica,
    });
    if (eClave) claveTecnica = null; // la empresa queda creada; la clave se podrá fijar después
    // Perfiles recomendados listos para asignar (best-effort; el botón de /perfiles es el respaldo).
    await admin.from("perfil").insert(
      PERFILES_RECOMENDADOS.map((r) => ({ tenant_id: au.tenant_id, nombre: r.nombre, descripcion: r.descripcion, permisos: r.permisos })),
    );
    // Operarios por defecto: técnico (PIN 1212, acceso total en TPV) y PIN 1111 al
    // dueño. Ambos cambiables una vez dentro. Best-effort.
    await admin.rpc("admin_sembrar_operarios_defecto", { p_tenant: au.tenant_id });
  } else {
    claveTecnica = null;
  }

  return NextResponse.json({ ok: true, userId: data.user?.id, claveTecnica });
}
