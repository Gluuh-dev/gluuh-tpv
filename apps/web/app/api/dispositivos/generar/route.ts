import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { comoElLlamante, comoElServicio } from "@/app/lib/supabaseServidor";
import { excedeLimite, ipDe } from "../limite";

// Genera un código de vinculación de 6 dígitos (caduca en 10 min, un solo uso).
// Solo PROPIETARIO/ENCARGADO (el rol viaja en el JWT vía el auth hook).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function claim(token: string, nombre: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return String(payload[nombre] ?? "");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  if (excedeLimite(`generar:${ipDe(req)}`, 20)) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Contra el NODO si estamos en el bar; contra la nube si no. Con la dirección incrustada
  // al compilar, emparejar un TPV dentro de un bar sin internet era imposible.
  const caller = comoElLlamante(token);
  if (!caller) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  const { error: eUser } = await caller.auth.getUser();
  if (eUser) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rol = claim(token, "user_rol");
  if (!["PROPIETARIO", "ENCARGADO"].includes(rol)) {
    return NextResponse.json({ error: "Solo encargado o propietario" }, { status: 403 });
  }
  const tenantId = claim(token, "tenant_id");
  if (!tenantId) return NextResponse.json({ error: "Sesión sin empresa" }, { status: 403 });

  const { tipo = "TPV", modulo = "TPV", nombre = "" } = await req.json().catch(() => ({}));

  // Local del tenant (RLS del llamante).
  const { data: loc } = await caller.from("location").select("id").limit(1).maybeSingle();
  if (!loc) return NextResponse.json({ error: "La empresa no tiene local" }, { status: 400 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  // Límite de dispositivos de la empresa (licencia_limites.dispositivos, 0084):
  // si se alcanza, no se crean más — el técnico de Gluuh lo amplía en la consola.
  const { data: t } = await admin.from("tenant").select("licencia_limites").eq("id", tenantId).maybeSingle();
  const maxDisp = (t?.licencia_limites as { dispositivos?: number } | null)?.dispositivos;
  if (maxDisp && maxDisp > 0) {
    const { count } = await admin.from("device").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    if ((count ?? 0) >= maxDisp) {
      return NextResponse.json({ error: `Límite de dispositivos alcanzado (${maxDisp}). Contacta con Gluuh para ampliarlo.` }, { status: 403 });
    }
  }

  // Código aleatorio criptográfico (no Math.random, que es predecible).
  // NOTA DE SEGURIDAD: 6 dígitos = 900k combinaciones. El canje es de un solo uso,
  // caduca en 10 min y tanto este endpoint como el canje llevan rate-limit por IP
  // en memoria (../limite.ts) como fricción anti fuerza bruta.
  const codigo = String(randomInt(100000, 1000000));
  const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: dev, error } = await admin
    .from("device")
    .insert({
      tenant_id: tenantId,
      location_id: loc.id,
      tipo,
      modulo,
      nombre: nombre || `${tipo} nuevo`,
      codigo_vinculacion: codigo,
      codigo_expira: expira,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, device_id: dev.id, codigo, expira });
}
