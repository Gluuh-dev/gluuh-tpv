// Verifica el alta de empleados con PIN bajo RLS, como lo hace la web:
//  1) crea una empresa (admin), 2) login (password grant) -> token de usuario,
//  3) rpc crear_empleado con ese token, 4) comprueba en BD (pin hasheado, tenant),
//  5) limpia.
// Uso: SUPABASE_URL=.. SUPABASE_SECRET_KEY=.. SUPABASE_PUBLISHABLE_KEY=.. DIRECT_URL=.. node scripts/verify-empleados.mjs
import pg from "pg";

const SUPA = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB = process.env.DIRECT_URL;
if (!SUPA || !SECRET || !ANON || !DB) { console.error("Faltan envs"); process.exit(1); }

const email = `owner-${Math.floor(Math.random() * 1e9)}@example.com`;
const pass = "Test1234!";
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

// 1) Empresa (propietario)
const owner = await fetch(`${SUPA}/auth/v1/admin/users`, {
  method: "POST", headers: admin,
  body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { empresa_nombre: "QA Bar", nombre: "Dueño" } }),
}).then((r) => r.json());
console.log("1) Empresa creada, propietario:", owner.id);

// 2) Login -> token de usuario
const tok = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pass }),
}).then((r) => r.json());
console.log("2) Login OK, token:", tok.access_token ? "sí" : "NO");

// 3) Crear empleado vía RPC con el token del propietario (RLS activa)
const rpc = await fetch(`${SUPA}/rest/v1/rpc/crear_empleado`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_nombre: "Ana Camarera", p_email: "", p_rol: "CAMARERO", p_pin: "4729" }),
});
const empId = await rpc.json();
console.log("3) crear_empleado ->", rpc.status, empId);

// 4) Comprobar en BD
const c = new pg.Client({ connectionString: DB });
await c.connect();
try {
  const r = await c.query(
    "SELECT nombre, rol, tenant_id, (pin_hash = crypt('4729', pin_hash)) AS pin_ok FROM app_user WHERE id = $1",
    [empId],
  );
  const ownerRow = await c.query("SELECT tenant_id FROM app_user WHERE auth_user_id = $1", [owner.id]);
  const e = r.rows[0];
  const ok = e && e.rol === "CAMARERO" && e.pin_ok === true && e.tenant_id === ownerRow.rows[0].tenant_id;
  console.log("4) BD -> empleado:", e?.nombre, "| rol:", e?.rol, "| PIN válido:", e?.pin_ok, "| mismo tenant:", e?.tenant_id === ownerRow.rows[0].tenant_id);

  // 5) Limpieza
  await fetch(`${SUPA}/auth/v1/admin/users/${owner.id}`, { method: "DELETE", headers: admin });
  await c.query("DELETE FROM tenant WHERE id = $1", [ownerRow.rows[0].tenant_id]);
  console.log("5) Limpieza hecha.");

  console.log(ok ? "\n✅ Alta de empleados con PIN OK (RLS + hash + tenant correctos)." : "\n❌ Algo falló.");
  if (!ok) process.exitCode = 1;
} finally {
  await c.end();
}
