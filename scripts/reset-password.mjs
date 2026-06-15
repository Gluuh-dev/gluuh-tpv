// Restablece la contraseña de un usuario de Supabase Auth a una conocida.
// Uso: SUPABASE_URL=.. SUPABASE_SECRET_KEY=.. node scripts/reset-password.mjs [email] [nuevaPassword]
const SUPA = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const email = process.argv[2] ?? process.env.RESET_EMAIL ?? "admin@gluuh.com";
const nueva = process.argv[3] ?? process.env.RESET_PASSWORD ?? "Gluuh2026!";
if (!SUPA || !SECRET) { console.error("Faltan SUPABASE_URL / SUPABASE_SECRET_KEY"); process.exit(1); }
const h = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" };

const list = await fetch(`${SUPA}/auth/v1/admin/users?per_page=200`, { headers: h }).then((r) => r.json());
const u = (list.users ?? []).find((x) => x.email === email);
if (!u) { console.error("No existe el usuario:", email); process.exit(1); }

const res = await fetch(`${SUPA}/auth/v1/admin/users/${u.id}`, {
  method: "PUT", headers: h,
  body: JSON.stringify({ password: nueva, email_confirm: true }),
}).then((r) => r.json());

if (res.id) console.log(`✅ Contraseña restablecida → ${email} / ${nueva}`);
else console.error("Error:", JSON.stringify(res));
