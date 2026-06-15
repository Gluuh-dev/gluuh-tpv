// Diagnóstico de acceso (SOLO LECTURA): ¿existe el usuario en Auth?, ¿está
// confirmado?, ¿es admin de plataforma?, ¿a qué empresa (tenant) está ligado?
// Uso: DIRECT_URL=.. node scripts/diag-login.mjs [email1] [email2] ...
import pg from "pg";

const DB = process.env.DIRECT_URL;
if (!DB) { console.error("Falta DIRECT_URL"); process.exit(1); }
const emails = process.argv.slice(2).length ? process.argv.slice(2) : ["admin@gluuh.com", "demo@bar.com"];

const c = new pg.Client({ connectionString: DB });
await c.connect();

console.log("\n=== auth.users ===");
const u = await c.query(
  `SELECT email, id, email_confirmed_at IS NOT NULL AS confirmado, last_sign_in_at, created_at
     FROM auth.users WHERE email = ANY($1) ORDER BY email`, [emails]);
if (!u.rows.length) console.log("  (ninguno de esos emails existe en Auth)");
for (const r of u.rows) console.log(`  ${r.email}  id=${r.id}\n     confirmado=${r.confirmado}  último_login=${r.last_sign_in_at ?? "nunca"}`);

const ids = u.rows.map((r) => r.id);

console.log("\n=== platform_admin (acceso a /admin) ===");
const pa = await c.query("SELECT auth_user_id FROM public.platform_admin");
const adminSet = new Set(pa.rows.map((r) => r.auth_user_id));
for (const r of u.rows) console.log(`  ${r.email}  → admin_plataforma=${adminSet.has(r.id)}`);

console.log("\n=== app_user → tenant (acceso a /dashboard y pantallas) ===");
if (ids.length) {
  const au = await c.query(
    `SELECT a.email, a.rol, a.activo, a.tenant_id, t.nombre AS empresa
       FROM public.app_user a LEFT JOIN public.tenant t ON t.id = a.tenant_id
      WHERE a.auth_user_id = ANY($1) ORDER BY a.email`, [ids]);
  if (!au.rows.length) console.log("  (sin app_user: el login funciona pero current_tenant_id()=null → no verá datos)");
  for (const r of au.rows) console.log(`  ${r.email}  empresa="${r.empresa}" rol=${r.rol} activo=${r.activo} tenant=${r.tenant_id}`);
}

console.log("\n=== empresas (tenants) en el sistema ===");
const t = await c.query("SELECT nombre, email_admin, plan, id FROM public.tenant ORDER BY created_at");
for (const r of t.rows) console.log(`  "${r.nombre}"  email_admin=${r.email_admin}  plan=${r.plan}`);

await c.end();
console.log("");
