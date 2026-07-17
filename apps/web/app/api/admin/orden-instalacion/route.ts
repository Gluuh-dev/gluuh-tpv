import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { hostPlataforma, mfaPlataformaInsuficiente } from "@/app/lib/plataforma";
import { quienLlama, comoElServicio } from "@/app/lib/supabaseServidor";

// Emitir una ORDEN DE INSTALACIÓN (F3 entrega 3.1, migración 0116). Solo personal
// Gluuh (es_admin_plataforma) desde admin.gluuh.com. El código largo (formato
// 0000-0000-00000-0000-0000, como el legacy) viaja UNA vez en la respuesta; en la
// base solo queda su hash. 30 días de caducidad, un solo uso, ligada a un LOCAL.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dig = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");
const generarCodigo = () => `${dig(4)}-${dig(4)}-${dig(5)}-${dig(4)}-${dig(4)}`;

export async function POST(req: Request) {
  if (!hostPlataforma(req.headers.get("host"))) return new NextResponse(null, { status: 404 });
  if (mfaPlataformaInsuficiente((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""))) {
    return NextResponse.json({ error: "Esta acción requiere verificación en dos pasos (MFA)" }, { status: 403 });
  }
  const llamante = await quienLlama(req);
  if (!llamante) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: esAdmin, error: eAdmin } = await llamante.supa.rpc("es_admin_plataforma");
  if (eAdmin) return NextResponse.json({ error: eAdmin.message }, { status: 500 });
  if (!esAdmin) return NextResponse.json({ error: "Solo personal de la plataforma" }, { status: 403 });

  const cuerpo = await req.json().catch(() => ({}));
  const tenantId = typeof cuerpo.tenant_id === "string" ? cuerpo.tenant_id : "";
  if (!tenantId) return NextResponse.json({ error: "Falta tenant_id" }, { status: 400 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servicio no configurado" }, { status: 500 });

  // Local objetivo: el indicado o el primero de la empresa (una orden = un local).
  let locationId = typeof cuerpo.location_id === "string" ? cuerpo.location_id : null;
  if (!locationId) {
    const { data: loc } = await admin.from("location").select("id").eq("tenant_id", tenantId)
      .order("created_at").limit(1).maybeSingle();
    locationId = (loc as { id: string } | null)?.id ?? null;
  }
  if (!locationId) return NextResponse.json({ error: "La empresa no tiene ningún local" }, { status: 400 });

  const codigo = generarCodigo();
  const { data: emisor } = await admin.from("cuenta").select("id").eq("auth_user_id", llamante.userId).maybeSingle();
  const { error } = await admin.from("orden_instalacion").insert({
    tenant_id: tenantId,
    location_id: locationId,
    codigo_hash: createHash("sha256").update(codigo).digest("hex"),
    emitida_por: (emisor as { id: string } | null)?.id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El código en claro solo existe en esta respuesta.
  return NextResponse.json({ ok: true, codigo, caduca_dias: 30, location_id: locationId });
}
