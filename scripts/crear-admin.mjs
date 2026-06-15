// Crea (o localiza) el usuario administrador de plataforma y lo registra en
// platform_admin. Idempotente.
// Uso: SUPABASE_URL=.. SUPABASE_SECRET_KEY=.. DIRECT_URL=.. ADMIN_EMAIL=.. ADMIN_PASSWORD=.. node scripts/crear-admin.mjs
import pg from "pg";

const SUPA = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const DB = process.env.DIRECT_URL;
const email = process.env.ADMIN_EMAIL ?? "admin@gluuh.com";
const password = process.env.ADMIN_PASSWORD ?? "GluuhAdmin!2026";
if (!SUPA || !SECRET || !DB) { console.error("Faltan envs"); process.exit(1); }
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

let id;
const created = await fetch(`${SUPA}/auth/v1/admin/users`, {
  method: "POST", headers: h,
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { empresa_nombre: "Gluuh (plataforma)" } }),
}).then((r) => r.json());

if (created.id) { id = created.id; console.log("Admin creado:", email); }
else {
  // Ya existía: buscarlo
  const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: h }).then((r) => r.json());
  const u = (list.users ?? []).find((x) => x.email === email);
  if (!u) { console.error("No se pudo crear ni encontrar el admin:", JSON.stringify(created)); process.exit(1); }
  id = u.id;
  console.log("Admin ya existía:", email);
}

const c = new pg.Client({ connectionString: DB });
await c.connect();
await c.query("INSERT INTO public.platform_admin (auth_user_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
await c.end();
console.log(`✅ ${email} es admin de plataforma. Contraseña: ${password} (cámbiala en Supabase).`);
