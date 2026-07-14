// ¿Funciona `supabase-js` —la librería que usa el TPV— contra el NODO, sin tocar la app?
// Es la única prueba que importa: si esto pasa, apps/web funciona con cambiar una URL.
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const SECRETO = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars";
const URL = "http://127.0.0.1:54321";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const ahora = Math.floor(Date.now() / 1000);
const cab = b64({ alg: "HS256", typ: "JWT" });
const cuerpo = b64({ role: "anon", iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
const ANON = `${cab}.${cuerpo}.${createHmac("sha256", SECRETO).update(`${cab}.${cuerpo}`).digest("base64url")}`;

const sb = createClient(URL, ANON, { auth: { persistSession: false } });

const email = `tpv${Math.floor(Math.random() * 999999)}@prueba.local`;

console.log("1. signUp (como hace la pantalla de alta)…");
const { data: alta, error: eAlta } = await sb.auth.signUp({
  email,
  password: "Prueba1234!",
  options: { data: { empresa_nombre: "Bar del Nodo" } },
});
if (eAlta) throw new Error(`signUp: ${eAlta.message}`);
console.log(`   usuario ${alta.user?.email}`);

const claims = JSON.parse(Buffer.from(alta.session.access_token.split(".")[1], "base64url"));
console.log(`   tenant en el JWT: ${claims.tenant_id}`);

console.log("2. insert de catálogo (como el backoffice)…");
const { data: cat, error: eCat } = await sb
  .from("category")
  .insert({ nombre: "Cervezas" })
  .select()
  .single();
if (eCat) throw new Error(`insert: ${eCat.message}`);

console.log("3. insert de producto con su precio…");
const { data: prod, error: eProd } = await sb
  .from("product")
  .insert({ nombre: "Caña", precio: 2.5, category_id: cat.id })
  .select()
  .single();
if (eProd) throw new Error(`producto: ${eProd.message}`);

console.log("4. select con join anidado (como el TPV al cargar la carta)…");
// Hay DOS relaciones category<->product (la FK directa y la m2m product_category de
// la 0061), asi que PostgREST no sabe cual embeber: hay que decirselo por columna.
const { data: carta, error: eCarta } = await sb
  .from("product")
  .select("nombre, precio, categoria:category_id(nombre)");
if (eCarta) throw new Error(`carta: ${eCarta.message}`);

console.log("5. RPC fiscal (resolver_iva)…");
const { data: iva, error: eIva } = await sb.rpc("resolver_iva", {
  p_clase: "GENERAL",
  p_territorio: "CANARIAS",
});
if (eIva) throw new Error(`rpc: ${eIva.message}`);

console.log("\n── lo que devuelve el nodo ──");
console.log(JSON.stringify(carta, null, 2));
console.log(`IGIC general en Canarias: ${iva}%`);
console.log("\n✅ supabase-js habla con el NODO. El TPV funciona sin tocar código.");
