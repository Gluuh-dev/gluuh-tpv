// ¿ES VERDAD LO QUE HE DICHO?
//
// Afirmé: "el nodo se identifica como su bar, guarda sólo el refresh_token, y la RLS lo
// acota a su empresa. Si roban el ordenador de un bar, se llevan los datos de ese bar.
// De ninguno más."
//
// Esto lo comprueba. Usa el propio nodo como "nube" (habla el mismo protocolo):
//
//   1. Dos bares distintos, cada uno con su carta.
//   2. Un nodo configurado SOLO con el refresh_token del Bar A. Sin clave maestra.
//   3. ¿Qué ve? ¿Sólo lo suyo, o lo de todos?
//   4. ¿Rota el token y se guarda el nuevo? (si no, el nodo se queda fuera mañana)
import fs from "node:fs";
import { createHmac } from "node:crypto";

const NODO = "http://127.0.0.1:54321";
const SECRETO = "clave-jwt-de-desarrollo-del-nodo-gluuh-min-32-chars";
const ENV = ".nodo/sync.env";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const firmar = (rol) => {
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64({ alg: "HS256", typ: "JWT" });
  const cue = b64({ role: rol, iss: "gluuh-nodo", iat: ahora, exp: ahora + 3600 });
  return `${cab}.${cue}.${createHmac("sha256", SECRETO).update(`${cab}.${cue}`).digest("base64url")}`;
};
const ANON = firmar("anon");
const MAESTRA = firmar("service_role");

const guardado = fs.readFileSync(ENV, "utf8");   // lo restauramos al final

async function alta(nombre) {
  const r = Math.floor(Math.random() * 999999);
  const email = `duenyo${r}@prueba.local`;
  const res = await fetch(`${NODO}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Prueba1234!", data: { empresa_nombre: nombre } }),
  });
  const s = await res.json();
  if (!res.ok) throw new Error(`alta ${nombre}: ${JSON.stringify(s).slice(0, 120)}`);
  return s;
}

const rest = (tok, ruta, opts = {}) =>
  fetch(`${NODO}/rest/v1/${ruta}`, {
    headers: { apikey: ANON, authorization: `Bearer ${tok}`, "content-type": "application/json", ...(opts.headers ?? {}) },
    ...opts,
  });

try {
  console.log("1. Dos bares, cada uno con su carta");
  const A = await alta("Bar de Ana");
  const B = await alta("Bar de Berto");
  await rest(A.access_token, "category", { method: "POST", body: JSON.stringify({ nombre: "Vinos de Ana" }) });
  await rest(B.access_token, "category", { method: "POST", body: JSON.stringify({ nombre: "Tapas de Berto" }) });
  console.log("   creadas: 'Vinos de Ana' y 'Tapas de Berto'");

  console.log("\n2. El nodo del Bar de Ana: SOLO el refresh_token, sin clave maestra");
  fs.writeFileSync(ENV,
    `SUPABASE_URL=${NODO}\nSUPABASE_ANON_KEY=${ANON}\nSUPABASE_REFRESH_TOKEN=${A.refresh_token}\n`);
  console.log("   .nodo/sync.env escrito (así lo deja el instalador en el bar)");

  // Se importa AHORA, con el fichero ya puesto.
  const { cabeceras } = await import("../nube.mjs");

  console.log("\n3. ¿Qué ve ese nodo?");
  const cab = await cabeceras();
  if (!cab) throw new Error("cabeceras() devolvió null: el refresco no funcionó");
  if (cab.authorization === `Bearer ${MAESTRA}`) throw new Error("¡está usando la clave maestra!");

  const r = await fetch(`${NODO}/rest/v1/category?select=nombre`, { headers: cab });
  const ve = await r.json();
  const nombres = ve.map((c) => c.nombre);
  console.log(`   ve ${ve.length} categoría(s): ${nombres.join(", ") || "(ninguna)"}`);

  console.log("\n4. Y con la CLAVE MAESTRA, ¿qué se vería? (lo que evitamos)");
  const rm = await fetch(`${NODO}/rest/v1/category?select=nombre`, {
    headers: { apikey: MAESTRA, authorization: `Bearer ${MAESTRA}` },
  });
  const todo = await rm.json();
  console.log(`   se verían ${todo.length}: TODOS los bares de la plataforma`);

  console.log("\n5. ¿Rotó el refresh_token y se guardó el nuevo?");
  const ahora = fs.readFileSync(ENV, "utf8");
  const nuevo = /^SUPABASE_REFRESH_TOKEN=(.*)$/m.exec(ahora)?.[1];
  const roto = nuevo && nuevo !== A.refresh_token;
  console.log(`   ${roto ? "sí: guardado el nuevo" : "NO — el nodo se quedaría fuera mañana"}`);

  // ── Veredicto ──────────────────────────────────────────────────────────────
  const soloLoSuyo = nombres.length === 1 && nombres[0] === "Vinos de Ana";
  const maestraVeMas = todo.length > ve.length;

  console.log("\n" + "═".repeat(62));
  if (soloLoSuyo && maestraVeMas && roto) {
    console.log("✅ CIERTO. El nodo del Bar de Ana ve SU carta y sólo la suya.");
    console.log("   Con la clave maestra habría visto la de todos los bares.");
    console.log("   Robar ese ordenador = robar los datos de ESE bar. De ninguno más.");
  } else {
    console.log("❌ NO se cumple:");
    if (!soloLoSuyo) console.log(`   · ve cosas que no son suyas: ${nombres.join(", ")}`);
    if (!maestraVeMas) console.log("   · la prueba no distingue (¿hay datos de otros bares?)");
    if (!roto) console.log("   · el refresh_token no rotó");
  }
  console.log("═".repeat(62));
  process.exitCode = soloLoSuyo && maestraVeMas && roto ? 0 : 1;
} finally {
  fs.writeFileSync(ENV, guardado);   // devolvemos las credenciales de verdad
  console.log("\n(.nodo/sync.env restaurado)");
}
