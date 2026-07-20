// Monta un RESTAURANTE DE PRUEBAS completo (empresa + local + equipo + formas de
// pago + carta) para tener un banco de pruebas realista contra el que cobrar.
//
// Por qué existe: el nodo de desarrollo venía atado al tenant «Plantilla base»,
// que es el que la nube CLONA en cada empresa nueva. Meterle una carta de prueba
// ahí contamina a todos los bares futuros. Este script crea un tenant APARTE.
//
// Uso:
//   DIRECT_URL="postgres://…@127.0.0.1:55432/gluuh" node scripts/sembrar-restaurante.mjs
//   …--rehacer  borra el restaurante de pruebas y lo vuelve a crear
//
// Es idempotente: si ya existe, no duplica (sin --rehacer no toca nada).
import { readFileSync } from "node:fs";
import { argv } from "node:process";
import pg from "pg";
import { territorioDesdeDireccion } from "../packages/core/dist/index.js";
import { leerCatalogo } from "./importar-catalogo.mjs";

const NOMBRE = "Restaurante de pruebas";

// Dirección REAL (Santa Cruz de Tenerife) — a propósito canaria, para que el
// territorio se DEDUZCA y las pruebas salgan con IGIC, no con IVA peninsular.
const LOCAL = {
  nombre: NOMBRE,
  cif: "B38123456",
  razon_social: "Restaurante de Pruebas S.L.",
  direccion: "Calle del Castillo, 12",
  poblacion: "Santa Cruz de Tenerife",
  provincia: "Santa Cruz de Tenerife",
  codigo_postal: "38002",
  telefono: "922 000 000",
  regimen_facturacion: "VERIFACTU",
  serie_factura: "F",
};

const EQUIPO = [
  { nombre: "María Ruiz", rol: "PROPIETARIO", pin: "1234" },
  { nombre: "Berto Sanz", rol: "CAMARERO", pin: "2345" },
  { nombre: "Lucía Gil", rol: "CAMARERO", pin: "3456" },
  { nombre: "Paco Cocina", rol: "COCINA", pin: "4567" },
];

const codigoInstalacion = () => [4, 4, 5, 4, 4]
  .map((n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0")).join("-");

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) { console.error("Falta DIRECT_URL"); process.exit(1); }
  const u = new URL(url);
  if (["localhost", "127.0.0.1", "::1"].includes(u.hostname) && u.port !== "55432") {
    console.error(`⛔ REGLA Nº1: en local solo el Postgres del NODO (55432). Va a ${u.hostname}:${u.port || "5432"}.`);
    process.exit(1);
  }

  const territorio = territorioDesdeDireccion({
    codigoPostal: LOCAL.codigo_postal, provincia: LOCAL.provincia, pais: "España",
  });

  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    await db.query("BEGIN");

    const previo = await db.query("select id from public.tenant where nombre = $1", [NOMBRE]);
    if (previo.rows.length && !argv.includes("--rehacer")) {
      console.log(`ℹ️  «${NOMBRE}» ya existe (${previo.rows[0].id}). Usa --rehacer para recrearlo.`);
      await db.query("ROLLBACK");
      return;
    }
    if (previo.rows.length) {
      // El borrado en cascada de tenant se lleva local, equipo, carta y formas de pago.
      await db.query("delete from public.tenant where id = $1", [previo.rows[0].id]);
      console.log("🧹 Restaurante anterior borrado (--rehacer)");
    }

    // ── Empresa ──────────────────────────────────────────────────────────────
    const { rows: [t] } = await db.query(
      `insert into public.tenant (nombre, plan, email_admin, codigo_instalacion, estado_alta, es_plantilla)
       values ($1,'PRO',$2,$3,'ACTIVA',false) returning id`,
      [NOMBRE, "pruebas@gluuh.local", codigoInstalacion()],
    );
    const tid = t.id;

    // ── Local (el territorio se DEDUCE de la dirección, no se asume) ──────────
    await db.query(
      `insert into public.location
         (tenant_id, nombre, cif, razon_social, direccion, poblacion, provincia,
          codigo_postal, telefono, territorio_fiscal, regimen_facturacion, serie_factura)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [tid, LOCAL.nombre, LOCAL.cif, LOCAL.razon_social, LOCAL.direccion, LOCAL.poblacion,
        LOCAL.provincia, LOCAL.codigo_postal, LOCAL.telefono, territorio,
        LOCAL.regimen_facturacion, LOCAL.serie_factura],
    );

    // ── Equipo (PIN cifrado con bcrypt, como espera validar_pin) ──────────────
    for (const p of EQUIPO) {
      await db.query(
        `insert into public.app_user (tenant_id, nombre, email, rol, pin_hash, activo)
         values ($1,$2,$3,$4, crypt($5, gen_salt('bf')), true)`,
        [tid, p.nombre, `${p.nombre.split(" ")[0].toLowerCase()}@pruebas.local`, p.rol, p.pin],
      );
    }

    // ── Formas de pago (la misma semilla que usa el alta real) ────────────────
    await db.query("select public.admin_sembrar_formas_pago($1)", [tid]);

    // ── Carta ────────────────────────────────────────────────────────────────
    const { items } = leerCatalogo(readFileSync(new URL("./plantillas/carta-restaurante.csv", import.meta.url), "utf8"));
    const famId = new Map(), catId = new Map();
    const familias = [...new Set(items.map((i) => i.familia))];
    for (const [i, nombre] of familias.entries()) {
      const { rows: [f] } = await db.query(
        "insert into public.family (tenant_id, nombre, orden) values ($1,$2,$3) returning id", [tid, nombre, i]);
      famId.set(nombre, f.id);
    }
    const categorias = [...new Set(items.map((i) => `${i.familia}›${i.categoria}`))];
    for (const [i, par] of categorias.entries()) {
      const [fam, cat] = par.split("›");
      const { rows: [c] } = await db.query(
        "insert into public.category (tenant_id, nombre, family_id, orden) values ($1,$2,$3,$4) returning id",
        [tid, cat, famId.get(fam), i]);
      catId.set(par, c.id);
    }
    for (const it of items) {
      await db.query(
        `insert into public.product (tenant_id, category_id, nombre, precio, clase_fiscal, tipo_impositivo, estacion, es_alcohol)
         values ($1,$2,$3,$4,$5, public.resolver_iva($5,$6), $7,$8)`,
        [tid, catId.get(`${it.familia}›${it.categoria}`), it.producto, it.precio,
          it.clase_fiscal, territorio, it.estacion, it.alcohol],
      );
    }

    await db.query("COMMIT");

    console.log(`\n✅ «${NOMBRE}» listo`);
    console.log(`   tenant     ${tid}`);
    console.log(`   territorio ${territorio}  (deducido de CP ${LOCAL.codigo_postal} · ${LOCAL.poblacion})`);
    console.log(`   carta      ${items.length} productos · ${categorias.length} categorías · ${familias.length} familias`);
    console.log(`   equipo     ${EQUIPO.map((p) => `${p.nombre} (${p.rol}, PIN ${p.pin})`).join(" · ")}`);
    console.log(`\n   Compruébalo:  DIRECT_URL="…" node scripts/verificar-empresa.mjs --tenant ${tid}`);
  } catch (e) {
    try { await db.query("ROLLBACK"); } catch { /* ya cerrado */ }
    console.error("❌ Error:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await main();
