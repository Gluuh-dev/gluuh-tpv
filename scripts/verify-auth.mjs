// Verifica de punta a punta el registro multiempresa:
//  1) Crea un usuario de prueba vía Supabase Auth (admin) con metadata de empresa.
//  2) Comprueba que el trigger creó tenant + app_user propietario.
//  3) Comprueba el aislamiento RLS: ese usuario ve 0 productos (no los del tenant demo).
//  4) Limpia (borra el usuario y su tenant).
// Uso: SUPABASE_URL=.. SUPABASE_SECRET_KEY=.. DIRECT_URL=.. node scripts/verify-auth.mjs
import pg from "pg";

const SUPA = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const DB = process.env.DIRECT_URL;
if (!SUPA || !SECRET || !DB) { console.error("Faltan envs"); process.exit(1); }

const email = `qa-${Math.floor(Math.random() * 1e9)}@example.com`;
const empresa = "QA Empresa " + Math.floor(Math.random() * 1000);
const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

const created = await fetch(`${SUPA}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, password: "Test1234!", email_confirm: true, user_metadata: { empresa_nombre: empresa, nombre: "Dueño QA" } }),
}).then((r) => r.json());

if (!created.id) { console.error("❌ No se creó el usuario:", JSON.stringify(created)); process.exit(1); }
console.log("1) Usuario Auth creado:", email, created.id);

const c = new pg.Client({ connectionString: DB });
await c.connect();
try {
  const t = await c.query("SELECT id, nombre FROM tenant WHERE email_admin=$1", [email]);
  const u = await c.query("SELECT rol, tenant_id FROM app_user WHERE auth_user_id=$1", [created.id]);
  console.log("2) Trigger → tenant:", t.rows[0]?.nombre, "| app_user rol:", u.rows[0]?.rol);
  const okProvision = t.rows.length === 1 && t.rows[0].nombre === empresa && u.rows[0]?.rol === "PROPIETARIO";

  // 3) Aislamiento: simular sesión de ese usuario (rol authenticated + claim sub)
  await c.query("BEGIN");
  await c.query("SET LOCAL ROLE authenticated");
  await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: created.id, role: "authenticated" })]);
  const tid = await c.query("SELECT public.current_tenant_id() AS tid");
  const prod = await c.query("SELECT count(*)::int AS n FROM product");
  await c.query("ROLLBACK");
  const okIsolation = tid.rows[0].tid === u.rows[0].tenant_id && prod.rows[0].n === 0;
  console.log("3) RLS → current_tenant_id coincide:", tid.rows[0].tid === u.rows[0].tenant_id, "| productos visibles:", prod.rows[0].n, "(esperado 0)");

  // 4) Limpieza
  await fetch(`${SUPA}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers });
  await c.query("DELETE FROM tenant WHERE id=$1", [u.rows[0].tenant_id]);
  console.log("4) Limpieza hecha.");

  console.log(okProvision && okIsolation ? "\n✅ TODO OK: registro + aislamiento multiempresa funcionan." : "\n❌ Algo falló.");
  if (!(okProvision && okIsolation)) process.exitCode = 1;
} finally {
  await c.end();
}
