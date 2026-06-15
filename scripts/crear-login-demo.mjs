// Crea una cuenta de acceso ligada al restaurante DEMO (tenant 1111...), para
// poder entrar y ver carta + marca + ofertas ya sembradas. Idempotente.
// Uso: SUPABASE_URL=.. SUPABASE_SECRET_KEY=.. DIRECT_URL=.. node scripts/crear-login-demo.mjs
import pg from "pg";

const SUPA = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const DB = process.env.DIRECT_URL;
const email = process.env.DEMO_EMAIL ?? "demo@bar.com";
const password = process.env.DEMO_PASSWORD ?? "Demo1234!";
const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";
if (!SUPA || !SECRET || !DB) { console.error("Faltan envs (SUPABASE_URL, SUPABASE_SECRET_KEY, DIRECT_URL)"); process.exit(1); }
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

// 1) Crear o localizar el usuario de Supabase Auth
let id;
const created = await fetch(`${SUPA}/auth/v1/admin/users`, {
  method: "POST", headers: h,
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { empresa_nombre: "Bar Demo Gluuh", nombre: "Demo" } }),
}).then((r) => r.json());

if (created.id) { id = created.id; console.log("Usuario demo creado:", email); }
else {
  const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: h }).then((r) => r.json());
  const u = (list.users ?? []).find((x) => x.email === email);
  if (!u) { console.error("No se pudo crear ni encontrar el usuario:", JSON.stringify(created)); process.exit(1); }
  id = u.id;
  console.log("Usuario demo ya existía:", email);
}

// 2) Reapuntar su app_user al tenant DEMO y limpiar el tenant huérfano que crea el trigger
const c = new pg.Client({ connectionString: DB });
await c.connect();
await c.query("DELETE FROM public.app_user WHERE auth_user_id = $1", [id]);
await c.query("DELETE FROM public.tenant WHERE email_admin = $1 AND id <> $2", [email, DEMO_TENANT]);
await c.query(
  `INSERT INTO public.app_user (tenant_id, nombre, email, rol, auth_user_id, activo)
   VALUES ($1, 'Demo', $2, 'PROPIETARIO', $3, true)`,
  [DEMO_TENANT, email, id]
);
await c.end();
console.log(`✅ Acceso demo listo → ${email} / ${password}  (tenant Bar Demo Gluuh)`);
