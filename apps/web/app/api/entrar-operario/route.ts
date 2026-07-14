import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { claveDeServicio, comoElServicio, enNodo, origenDeDatos } from "@/app/lib/supabaseServidor";
import { excedeLimite, ipDe } from "../dispositivos/limite";

// Login local por USUARIO (nombre) + clave (backoffice sin email). Verifica
// (verificar_clave_operario, solo operarios sin email) y asegura una cuenta auth
// SINTÉTICA (email interno estable por código) con contraseña = clave; devuelve su
// email para que el cliente complete signInWithPassword. El login por email no se toca.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email interno determinista (tenant8 + código → único). No se muestra al usuario.
const emailSintetico = (codigo: string, tenantId: string) =>
  `op.${codigo}.${tenantId.slice(0, 8)}@codigo.gluuh.local`;

export async function POST(req: Request) {
  // Anti fuerza bruta de claves de operario (mismo mecanismo que el emparejado):
  // 10 intentos/min por IP. Las claves suelen ser de 4 dígitos → imprescindible.
  if (excedeLimite(`operario:${ipDe(req)}`, 10)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." }, { status: 429 });
  }

  const { usuario, clave, tenant_id } = await req.json().catch(() => ({}));
  if (!usuario || !clave) return NextResponse.json({ error: "Falta el usuario o la clave" }, { status: 400 });

  // En el NODO esta ruta corre DENTRO del propio servidor del bar, así que habla con él
  // por loopback. Nada de variables NEXT_PUBLIC_: no hay que configurar cada terminal.
  //
  // Esto lo hacía a mano y bien —era la ÚNICA ruta que lo hacía—. Ahora pasa por la misma
  // puerta que las demás (`lib/supabaseServidor.ts`): dos formas de resolver lo mismo
  // acaban separándose, y la que se quede atrás hablará con la nube desde dentro del bar.
  const admin = comoElServicio();
  if (!admin) return NextResponse.json({ error: "Servidor sin configurar" }, { status: 500 });
  // Instalación fijada a una empresa (0078): el operario SOLO puede entrar en su
  // tenant, aunque usuario+clave coincidan en otra empresa.
  const { data, error } = await admin.rpc("verificar_clave_operario", {
    p_usuario: String(usuario),
    p_clave: String(clave),
    p_tenant: typeof tenant_id === "string" && tenant_id ? tenant_id : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const op = (Array.isArray(data) ? data[0] : data) as { id: string; tenant_id: string; nombre: string; codigo: string; auth_user_id: string | null } | undefined;
  if (!op) return NextResponse.json({ error: "Usuario o clave incorrectos" }, { status: 401 });

  const email = emailSintetico(op.codigo, op.tenant_id);

  // ── EN EL NODO: un VALE de un solo uso, no un usuario falso ─────────────────
  //
  // El nodo no lleva GoTrue: firma sus tokens él mismo (apps/nodo/auth.mjs). Aquí ya
  // hemos validado el PIN contra `clave_hash`, así que sólo hay que pedir un vale que el
  // navegador canjee por una sesión. Un solo uso, dos minutos de vida.
  //
  // Desaparece la pantomima que había que hacerle a GoTrue: crearle un usuario falso con
  // una contraseña aleatoria única y exclusivamente para que nos firmara el token.
  //
  // El contrato con el navegador NO cambia: sigue llamando a signInWithPassword con lo
  // que le devolvemos aquí. Sólo que la "contraseña" es ahora un vale.
  if (enNodo()) {
    const { url } = origenDeDatos();
    const secret = claveDeServicio()!;   // `comoElServicio()` ya ha comprobado que está
    const r = await fetch(`${url}/auth/v1/vale`, {
      method: "POST",
      headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ app_user_id: op.id }),
    });
    if (!r.ok) {
      return NextResponse.json({ error: "El servidor del local no pudo preparar el acceso" }, { status: 500 });
    }
    const { vale } = (await r.json()) as { vale: string };
    return NextResponse.json({ ok: true, email, secret: vale });
  }

  // ── EN LA NUBE: GoTrue, como siempre ───────────────────────────────────────
  // La clave (4+ díg.) ya se verificó contra clave_hash. La contraseña de la cuenta
  // sintética es un TOKEN aleatorio fuerte (Supabase exige ≥6) que se fija ahora y se
  // devuelve para que el cliente inicie sesión. Nunca toca un email real (verificar
  // excluye operarios con email).
  const passSesion = randomBytes(24).toString("base64url");
  if (op.auth_user_id) {
    const { error: e } = await admin.auth.admin.updateUserById(op.auth_user_id, { password: passSesion });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  } else {
    const { data: creado, error: e } = await admin.auth.admin.createUser({ email, password: passSesion, email_confirm: true });
    if (e || !creado.user) return NextResponse.json({ error: e?.message ?? "No se pudo preparar el acceso" }, { status: 500 });
    const { error: e2 } = await admin.from("app_user").update({ auth_user_id: creado.user.id }).eq("id", op.id);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, secret: passSesion });
}
