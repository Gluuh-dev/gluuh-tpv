// Verifica un login real contra GoTrue con la publishable key (lo mismo que hace la web).
// Uso: SUPABASE_URL=.. SUPABASE_PUBLISHABLE_KEY=.. node scripts/verify-login.mjs <email> <password>
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.argv[2];
const password = process.argv[3];
if (!URL || !KEY || !email || !password) { console.error("Faltan datos"); process.exit(1); }

const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const j = await r.json();
if (r.ok && j.access_token) console.log(`✅ LOGIN CORRECTO para ${email}`);
else console.log(`❌ Falló: ${j.error_description || j.msg || j.error || JSON.stringify(j)}`);
