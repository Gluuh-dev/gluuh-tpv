import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { comoElServicio } from "@/app/lib/supabaseServidor";
import { excedeLimite, ipDe } from "../limite";

// Renovación de la credencial de dispositivo v2 (F4, migración 0117).
// POST { refresh } → rota el secreto (el viejo queda consumido) y devuelve un
// access de 12 h + el refresh nuevo. Revocar el terminal = borrar su credencial:
// la siguiente renovación falla y el access caduca solo.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (excedeLimite(`renovar:${ipDe(req)}`, 30)) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }
  const { refresh } = await req.json().catch(() => ({ refresh: "" }));
  if (typeof refresh !== "string" || refresh.length < 20) {
    return NextResponse.json({ error: "Credencial inválida" }, { status: 400 });
  }
  const secreto = process.env.DEVICE_JWT_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta DEVICE_JWT_SECRET en el servidor" }, { status: 500 });
  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  const nuevo = randomBytes(32).toString("base64url");
  const { data, error } = await admin.rpc("renovar_credencial_dispositivo", {
    p_refresh_hash: createHash("sha256").update(refresh).digest("hex"),
    p_nuevo_hash: createHash("sha256").update(nuevo).digest("hex"),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const d = Array.isArray(data) ? (data[0] as { device_id: string; tenant_id: string; modulo: string | null; nombre: string; estacion: string | null } | undefined) : undefined;
  // Rotado/revocado/caducado: el terminal debe volver a emparejarse con código.
  if (!d) return NextResponse.json({ error: "Credencial revocada o caducada. Vuelve a vincular el terminal." }, { status: 401 });

  const access = await new SignJWT({ tenant_id: d.tenant_id, device_id: d.device_id, modulo: d.modulo ?? "TPV", v: 2 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secreto));

  return NextResponse.json({
    ok: true, device_id: d.device_id, nombre: d.nombre, modulo: d.modulo ?? "TPV",
    estacion: d.estacion ?? null, access, refresh: nuevo, access_expira_horas: 12,
  });
}
