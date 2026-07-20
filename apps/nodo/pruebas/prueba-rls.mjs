// LA RLS AÍSLA LOS BARES. Ni con la sesión de uno se ven los datos del otro.
//
// Es la prueba de seguridad más importante del nodo. Sustituye a prueba-e2e.ps1, que
// creaba los bares con `signUp` — una vía que el nodo ya no ofrece (y con razón: un bar
// se PROVISIONA desde la nube, nadie se registra en el servidor de un bar).
//
//   node apps/nodo/pruebas/prueba-rls.mjs
import { NODO, SERVICIO, conectar, barDePrueba, borrarBar, conSesion, exigirNodoVivo, noConcluyente } from "./ayuda.mjs";

// Si el nodo no atiende peticiones autenticadas, esta prueba NO puede concluir
// nada: todas las lecturas darían 0 filas y el veredicto sería mentira.
await exigirNodoVivo();

const bd = await conectar();
let ana, berto;

const rest = (ruta, cab, opts = {}) =>
  fetch(`${NODO}/rest/v1/${ruta}`, { headers: cab, ...opts });

try {
  console.log("1. Dos bares distintos, cada uno con su carta");
  ana = await barDePrueba(bd, "Bar de Ana");
  berto = await barDePrueba(bd, "Bar de Berto");

  // Si la carta no se llega a crear, lo que venga después no significa nada.
  for (const [quien, sesion, nombre] of [["Ana", ana.sesion, "Vinos de Ana"], ["Berto", berto.sesion, "Tapas de Berto"]]) {
    const r = await rest("category", conSesion(sesion), { method: "POST", body: JSON.stringify({ nombre }) });
    if (!r.ok) {
      await borrarBar(bd, ana.tenantId); await borrarBar(bd, berto.tenantId); await bd.end();
      noConcluyente(
        `${quien} no ha podido crear ni su propia categoría (HTTP ${r.status})`,
        "Sin poder escribir, un 0 en las lecturas no distingue «aislado» de «rechazado».",
      );
    }
  }
  console.log("   creadas: 'Vinos de Ana' y 'Tapas de Berto'");

  // Lee esperando una LISTA. Si el nodo devuelve un error disfrazado, no hay
  // veredicto de seguridad posible: se corta aquí en vez de inventarse uno.
  const leerLista = async (ruta, cab, que) => {
    const resp = await (await rest(ruta, cab)).json();
    if (!Array.isArray(resp)) {
      await borrarBar(bd, ana.tenantId); await borrarBar(bd, berto.tenantId); await bd.end();
      noConcluyente(
        `el nodo no devolvió una lista al leer ${que}: ${JSON.stringify(resp).slice(0, 160)}`,
        "Eso es un error del nodo, no un veredicto de seguridad.",
      );
    }
    return resp;
  };

  console.log("\n2. ¿Qué ve cada uno con SU sesión?");
  const veAna = await leerLista("category?select=nombre", conSesion(ana.sesion), "lo de Ana");
  const veBerto = await leerLista("category?select=nombre", conSesion(berto.sesion), "lo de Berto");

  const nAna = veAna.map((c) => c.nombre);
  const nBerto = veBerto.map((c) => c.nombre);
  console.log(`   Ana ve   ${veAna.length}: ${nAna.join(", ")}`);
  console.log(`   Berto ve ${veBerto.length}: ${nBerto.join(", ")}`);

  console.log("\n3. Ana intenta leer la carta de Berto a propósito");
  const robo = await leerLista(
    `category?select=nombre&tenant_id=eq.${berto.tenantId}`,
    conSesion(ana.sesion), "el robo",
  );
  console.log(`   pidiendo explícitamente el tenant de Berto: ${robo.length} filas`);

  console.log("\n4. Y con la clave de ADMINISTRADOR (la que se salta la RLS)");
  const todo = await leerLista("category?select=nombre",
    { apikey: SERVICIO, authorization: `Bearer ${SERVICIO}` }, "la lectura de administrador");
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
