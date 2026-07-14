// LA RLS AÍSLA LOS BARES. Ni con la sesión de uno se ven los datos del otro.
//
// Es la prueba de seguridad más importante del nodo. Sustituye a prueba-e2e.ps1, que
// creaba los bares con `signUp` — una vía que el nodo ya no ofrece (y con razón: un bar
// se PROVISIONA desde la nube, nadie se registra en el servidor de un bar).
//
//   node apps/nodo/pruebas/prueba-rls.mjs
import { NODO, SERVICIO, conectar, barDePrueba, borrarBar, conSesion } from "./ayuda.mjs";

const bd = await conectar();
let ana, berto;

const rest = (ruta, cab, opts = {}) =>
  fetch(`${NODO}/rest/v1/${ruta}`, { headers: cab, ...opts });

try {
  console.log("1. Dos bares distintos, cada uno con su carta");
  ana = await barDePrueba(bd, "Bar de Ana");
  berto = await barDePrueba(bd, "Bar de Berto");

  await rest("category", conSesion(ana.sesion), {
    method: "POST", body: JSON.stringify({ nombre: "Vinos de Ana" }),
  });
  await rest("category", conSesion(berto.sesion), {
    method: "POST", body: JSON.stringify({ nombre: "Tapas de Berto" }),
  });
  console.log("   creadas: 'Vinos de Ana' y 'Tapas de Berto'");

  console.log("\n2. ¿Qué ve cada uno con SU sesión?");
  const veAna = await (await rest("category?select=nombre", conSesion(ana.sesion))).json();
  const veBerto = await (await rest("category?select=nombre", conSesion(berto.sesion))).json();

  const nAna = veAna.map((c) => c.nombre);
  const nBerto = veBerto.map((c) => c.nombre);
  console.log(`   Ana ve   ${veAna.length}: ${nAna.join(", ")}`);
  console.log(`   Berto ve ${veBerto.length}: ${nBerto.join(", ")}`);

  console.log("\n3. Ana intenta leer la carta de Berto a propósito");
  const robo = await (await rest(
    `category?select=nombre&tenant_id=eq.${berto.tenantId}`,
    conSesion(ana.sesion),
  )).json();
  console.log(`   pidiendo explícitamente el tenant de Berto: ${robo.length} filas`);

  console.log("\n4. Y con la clave de ADMINISTRADOR (la que se salta la RLS)");
  const todo = await (await rest("category?select=nombre", {
    apikey: SERVICIO, authorization: `Bearer ${SERVICIO}`,
  })).json();
  console.log(`   se ven ${todo.length} (las de todos los bares del nodo)`);

  const bien =
    nAna.includes("Vinos de Ana") && !nAna.includes("Tapas de Berto") &&
    nBerto.includes("Tapas de Berto") && !nBerto.includes("Vinos de Ana") &&
    robo.length === 0 && todo.length > veAna.length;

  console.log("\n" + "═".repeat(64));
  console.log(bien
    ? "✅ La RLS aísla. Ana no ve a Berto ni pidiéndolo a propósito."
    : "❌ FUGA: un bar ve datos de otro.");
  console.log("═".repeat(64));
  process.exitCode = bien ? 0 : 1;
} finally {
  if (ana) await borrarBar(bd, ana.tenantId);
  if (berto) await borrarBar(bd, berto.tenantId);
  console.log("\n(bares de prueba borrados)");
  await bd.end();
}
