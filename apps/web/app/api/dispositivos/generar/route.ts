import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { comoElLlamante, comoElServicio } from "@/app/lib/supabaseServidor";
import { excedeLimite, ipDe } from "../limite";

// Genera un código de vinculación de 6 dígitos (caduca en 10 min, un solo uso).
// Solo PROPIETARIO/ENCARGADO. El rol y la empresa se leen de `app_user`, no del JWT.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const { data: { user }, error: eUser } = await caller.auth.getUser();
  if (eUser || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });

  // El rol y la empresa se leen de `app_user` por el usuario autenticado, NO del claim del
  // JWT. El hook `custom_access_token_hook` no está siempre activo (en la nube no lo está),
  // y entonces `user_rol` viene vacío y esto devolvía 403 SIEMPRE: no se podía emparejar ni
  // un terminal. Preguntando a la tabla funciona con hook y sin él, en el nodo y en la nube.
  // (Es el mismo arreglo que ya hace el instalador del nodo.)
  const { data: yo } = await admin
    .from("app_user")
    .select("tenant_id, rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!yo?.tenant_id) return NextResponse.json({ error: "Sesión sin empresa" }, { status: 403 });
  if (!["PROPIETARIO", "ENCARGADO"].includes(yo.rol ?? "")) {
    return NextResponse.json({ error: "Solo encargado o propietario" }, { status: 403 });
  }
  const tenantId = yo.tenant_id as string;

  const { tipo = "TPV", modulo = "TPV", nombre = "", usuario = "", clave = "" } = await req.json().catch(() => ({}));
  // Dos formas de dar de alta un terminal:
  //  · con CREDENCIAL (usuario+contraseña, 0105): reutilizable, se mete en el primer arranque.
  //  · sin ella: CÓDIGO de 6 dígitos de un solo uso (el flujo de siempre, /conectar).
  const conCredencial = Boolean(String(usuario).trim() && String(clave));

  // Local del tenant (RLS del llamante).
  const { data: loc } = await caller.from("location").select("id").limit(1).maybeSingle();
  if (!loc) return NextResponse.json({ error: "La empresa no tiene local" }, { status: 400 });

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
  const codigo = conCredencial ? null : String(randomInt(100000, 1000000));
  const expira = conCredencial ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString();
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

  // Con credencial: se fija usuario+contraseña (bcrypt en Postgres, 0105). Si el usuario ya
  // existe en este bar, el índice único lo rechaza; se borra el device recién creado para no
  // dejar una fila a medias.
  if (conCredencial) {
    const { error: eCred } = await admin.rpc("fijar_clave_dispositivo", {
      p_device: dev.id,
      p_usuario: String(usuario).trim(),
      p_clave: String(clave),
    });
    if (eCred) {
      await admin.from("device").delete().eq("id", dev.id);
      const dup = /duplicate|unique/i.test(eCred.message);
      return NextResponse.json(
        { error: dup ? "Ya hay un terminal con ese usuario." : eCred.message },
        { status: dup ? 409 : 500 },
      );
    }
    return NextResponse.json({ ok: true, device_id: dev.id, usuario: String(usuario).trim() });
  }

  return NextResponse.json({ ok: true, device_id: dev.id, codigo, expira });
}
