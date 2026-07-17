import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { comoElServicio } from "@/app/lib/supabaseServidor";
import { excedeLimite, ipDe } from "../limite";

// Canjea un código de vinculación de 6 dígitos por una credencial de
// dispositivo (JWT propio, no sesión Supabase). Lo llama la pantalla /conectar
// SIN autenticar: el código vigente ES la autorización (un solo uso, 10 min).
// Diseño: docs/implementacion/04-modulos-y-emparejado.md (paso 3).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Rate-limit ANTES de tocar nada: este endpoint es público (el código ES la
  // autorización) y es el blanco natural de una fuerza bruta del código.
  if (excedeLimite(`canjear:${ipDe(req)}`, 10)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  const { codigo } = await req.json().catch(() => ({ codigo: "" }));
  if (!/^\d{6}$/.test(String(codigo ?? ""))) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const secreto = process.env.DEVICE_JWT_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "Falta DEVICE_JWT_SECRET en el servidor" }, { status: 500 });
  }

  // Contra el NODO si estamos en el bar. Canjear el código de emparejado de una terminal
  // no puede depender de que el bar tenga internet ese día.
  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  // Canje ATÓMICO: el UPDATE con WHERE (código vigente + sin vincular) es a la vez
  // la comprobación y el consumo. Dos peticiones simultáneas con el mismo código:
  // solo la primera actualiza la fila; la segunda no encuentra fila que cumpla el
  // WHERE y recibe 404. Evita que un código de un solo uso se canjee dos veces.
  const ahora = new Date().toISOString();
  const { data: filas, error } = await admin
    .from("device")
    .update({ vinculado_at: ahora, codigo_vinculacion: null, codigo_expira: null })
    .eq("codigo_vinculacion", String(codigo))
    .is("vinculado_at", null)
    .gt("codigo_expira", ahora)
    .select("id, tenant_id, nombre, modulo, estacion");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const dev = filas?.[0];
  if (!dev) return NextResponse.json({ error: "Código no válido o caducado" }, { status: 404 });

  const modulo = dev.modulo ?? "TPV";
  // Legacy (compat clientes actuales): JWT firmado con el secreto compartido,
  // ACORTADO de 365 a 30 días — no es revocable, así que su vida es el daño.
  // Se retira en F4.4 cuando todos los clientes usen access+refresh.
  const token = await new SignJWT({ tenant_id: dev.tenant_id, device_id: dev.id, modulo })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(secreto));

  // Credencial v2 (0117): access CORTO (12 h) + refresh ROTATORIO cuyo hash vive
  // en la base — revocable de verdad. El refresh solo viaja aquí y al rotar.
  const refresh = randomBytes(32).toString("base64url");
  const { error: eCred } = await admin.rpc("emitir_credencial_dispositivo", {
    p_device: dev.id,
    p_refresh_hash: createHash("sha256").update(refresh).digest("hex"),
  });
  const access = await new SignJWT({ tenant_id: dev.tenant_id, device_id: dev.id, modulo, v: 2 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secreto));

  // `estacion` (0068): la partida propia del monitor KDS; null = la global.
  return NextResponse.json({
    ok: true, device_id: dev.id, nombre: dev.nombre, modulo, estacion: dev.estacion ?? null,
    token,
    // v2 (los clientes nuevos guardan `refresh` en safeStorage y renuevan en
    // /api/dispositivos/renovar; si emitir falló, siguen con el legacy).
    ...(eCred ? {} : { access, refresh, access_expira_horas: 12 }),
  });
}
