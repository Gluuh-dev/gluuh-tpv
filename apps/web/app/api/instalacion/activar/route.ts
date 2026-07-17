import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { GluuhContractDatabase } from "@gluuh/supabase";
import { excedeLimite, ipDe } from "../../dispositivos/limite";

// Activa una INSTALACIÓN canjeando el código 0000-0000-00000-0000-0000.
//
// Dos generaciones de código (F3, migración 0116):
//  1. ORDEN DE INSTALACIÓN (nueva): un solo uso real, ligada a empresa+LOCAL,
//     caduca a los 30 días, reserva de 24 h reanudable, y registra la instancia
//     del nodo (clave pública si el instalador la manda). Canje atómico en SQL.
//  2. LEGACY `tenant.codigo_instalacion`: reutilizable y eterno — se mantiene
//     hasta migrar los instaladores existentes (F3.4) y entonces se retira.
// Endpoint público: el código ES la autorización → rate-limit contra fuerza bruta.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (excedeLimite(`instalar:${ipDe(req)}`, 10)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." }, { status: 429 });
  }

  const cuerpo = await req.json().catch(() => ({}));
  // Normaliza: solo dígitos, re-agrupados 4-4-5-4-4 (21 dígitos).
  const digitos = String(cuerpo.codigo ?? "").replace(/\D/g, "");
  if (digitos.length !== 21) return NextResponse.json({ error: "Código incompleto" }, { status: 400 });
  const normalizado = [digitos.slice(0, 4), digitos.slice(4, 8), digitos.slice(8, 13), digitos.slice(13, 17), digitos.slice(17, 21)].join("-");

  const admin = createClient<GluuhContractDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );

  // 1) Flujo ORDEN (0116). `intento` lo persiste el instalador para poder
  // reanudar tras un corte dentro de la ventana de 24 h; si no manda uno, la IP
  // hace de intento (mismo equipo ⇒ misma reserva en la práctica).
  const intento = String(cuerpo.intento ?? ipDe(req));
  const { data: canje, error: eCanje } = await admin.rpc("canjear_orden_instalacion", {
    p_codigo_hash: createHash("sha256").update(normalizado).digest("hex"),
    p_reserva_hash: createHash("sha256").update(intento).digest("hex"),
    p_clave_publica: typeof cuerpo.clave_publica === "string" ? cuerpo.clave_publica : null,
    p_fingerprint: typeof cuerpo.fingerprint === "string" ? cuerpo.fingerprint : null,
    p_version: typeof cuerpo.version === "string" ? cuerpo.version : null,
    p_plataforma: typeof cuerpo.plataforma === "string" ? cuerpo.plataforma : null,
  });
  // Si la RPC no existe aún (0116 sin aplicar), se cae al flujo legacy.
  const r = Array.isArray(canje) ? (canje[0] as { resultado: string; tenant_id: string | null; location_id: string | null; nodo_id: string | null; empresa: string | null; local: string | null } | undefined) : undefined;
  if (!eCanje && r) {
    if (r.resultado === "OK") {
      return NextResponse.json({
        ok: true, tenant_id: r.tenant_id, empresa: r.empresa,
        location_id: r.location_id, local: r.local, nodo_id: r.nodo_id,
      });
    }
    if (r.resultado === "CADUCADA") return NextResponse.json({ error: "El código ha caducado. Pide uno nuevo a Gluuh." }, { status: 410 });
    if (r.resultado === "RESERVADA_OTRO") return NextResponse.json({ error: "Otro equipo está instalando con este código. Si fue un intento tuyo fallido, espera o pide un código nuevo." }, { status: 409 });
    // INVALIDA → puede ser un código legacy: probar el flujo antiguo.
  }

  // 2) Flujo LEGACY (compat): código eterno de la empresa.
  const { data: t, error } = await admin
    .from("tenant")
    .select("id, nombre, activo")
    .eq("codigo_instalacion", normalizado)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!t || !t.activo) return NextResponse.json({ error: "Código no válido" }, { status: 404 });

  return NextResponse.json({ ok: true, tenant_id: t.id, empresa: t.nombre });
}
