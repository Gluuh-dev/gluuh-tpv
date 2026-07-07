import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { excedeLimite, ipDe } from "../../dispositivos/limite";

// Activa una INSTALACIÓN: canjea el código de instalación de la empresa
// (0000-0000-00000-0000-0000, generado por Gluuh en el alta) por su identidad
// { tenant_id, empresa }. El cliente lo guarda y desde entonces el equipo queda
// FIJADO a esa empresa (login solo por usuario+clave de ese tenant); cambiarlo
// exige otro código válido, que solo tiene el técnico. Endpoint público:
// el código ES la autorización → rate-limit contra fuerza bruta.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (excedeLimite(`instalar:${ipDe(req)}`, 10)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." }, { status: 429 });
  }

  const { codigo } = await req.json().catch(() => ({ codigo: "" }));
  // Normaliza: solo dígitos, re-agrupados 4-4-5-4-4 (21 dígitos).
  const digitos = String(codigo ?? "").replace(/\D/g, "");
  if (digitos.length !== 21) return NextResponse.json({ error: "Código incompleto" }, { status: 400 });
  const normalizado = [digitos.slice(0, 4), digitos.slice(4, 8), digitos.slice(8, 13), digitos.slice(13, 17), digitos.slice(17, 21)].join("-");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: t, error } = await admin
    .from("tenant")
    .select("id, nombre, activo")
    .eq("codigo_instalacion", normalizado)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!t || !t.activo) return NextResponse.json({ error: "Código no válido" }, { status: 404 });

  return NextResponse.json({ ok: true, tenant_id: t.id, empresa: t.nombre });
}
