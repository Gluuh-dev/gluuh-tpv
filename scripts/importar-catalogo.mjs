// Importa la CARTA de un bar (familias → categorías → productos) desde un CSV.
//
// Pensado para dar de alta un negocio REAL en minutos en vez de horas: casi todos
// los TPV del mercado (Ágora, Glop, Revo, SumUp, Square…) exportan la carta a
// CSV/Excel; se guarda como CSV y se pasa por aquí.
//
// Uso:
//   DIRECT_URL="postgresql://…" node scripts/importar-catalogo.mjs carta.csv --tenant <uuid>
//   …añade --aplicar para ESCRIBIR (sin él es simulación y no toca nada)
//   node scripts/importar-catalogo.mjs --autotest    (comprueba el parser, sin BD)
//
// Columnas (el orden da igual; se aceptan sinónimos y mayúsculas/acentos):
//   familia | categoria | producto | precio | clase_fiscal | estacion | alcohol
//
// · `precio` es el PVP con IMPUESTO INCLUIDO (como toda la carta del proyecto).
// · `clase_fiscal` es GENERAL/REDUCIDO/SUPERREDUCIDO/EXENTO; el % lo resuelve la BD
//   con `resolver_iva(clase, territorio)` → así el IGIC canario sale solo.
// · Es IDEMPOTENTE: pasarlo dos veces no duplica ni mueve nada (como prueba-catalogo).
import { readFileSync } from "node:fs";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import pg from "pg";

// ── CSV: parser mínimo con comillas y auto-detección de separador ─────────────
export function detectarSeparador(cabecera) {
  const cand = [";", ",", "\t", "|"];
  return cand.map((s) => [s, cabecera.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
}

export function parsearCSV(texto) {
  const limpio = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primeraLinea = limpio.slice(0, limpio.indexOf("\n") === -1 ? undefined : limpio.indexOf("\n"));
  const sep = detectarSeparador(primeraLinea);

  const filas = [];
  let campo = "", fila = [], enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === sep) { fila.push(campo); campo = ""; continue; }
    if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; continue; }
    campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s) => sinAcentos(String(s ?? "")).trim().toLowerCase().replace(/[\s_-]+/g, "");

// Sinónimos de cabecera → nombre canónico.
const ALIAS = {
  familia: "familia", family: "familia", grupo: "familia", grupofamilia: "familia",
  categoria: "categoria", category: "categoria", subfamilia: "categoria", seccion: "categoria",
  producto: "producto", articulo: "producto", nombre: "producto", product: "producto", descripcion: "producto",
  precio: "precio", pvp: "precio", price: "precio", precioventa: "precio",
  clasefiscal: "clase_fiscal", clase: "clase_fiscal", tipoiva: "clase_fiscal", impuesto: "clase_fiscal",
  estacion: "estacion", cocina: "estacion", zona: "estacion", impresora: "estacion",
  alcohol: "alcohol", esalcohol: "alcohol",
};

const CLASES = ["GENERAL", "REDUCIDO", "SUPERREDUCIDO", "EXENTO"];
// Palabras que suele traer una exportación → clase fiscal.
function normalizarClase(v) {
  const k = clave(v);
  if (!k) return "REDUCIDO";                 // hostelería por defecto
  if (k.startsWith("gen") || k === "21" || k === "7") return "GENERAL";
  if (k.startsWith("red") || k === "10" || k === "3") return "REDUCIDO";
  if (k.startsWith("super") || k === "4" || k === "0") return "SUPERREDUCIDO";
  if (k.startsWith("ex")) return "EXENTO";
  const directo = String(v).trim().toUpperCase();
  return CLASES.includes(directo) ? directo : "REDUCIDO";
}

export function normalizarPrecio(v) {
  const s = String(v ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!s) return NaN;
  // "1.234,56" (es) vs "1,234.56" (en): manda el ÚLTIMO separador como decimal.
  const ultimaComa = s.lastIndexOf(","), ultimoPunto = s.lastIndexOf(".");
  let limpio = s;
  if (ultimaComa > ultimoPunto) limpio = s.replace(/\./g, "").replace(",", ".");
  else limpio = s.replace(/,/g, "");
  return Number.parseFloat(limpio);
}

const esSi = (v) => ["si", "sí", "s", "true", "1", "x", "yes"].includes(clave(v));

/** CSV (texto) → filas normalizadas + errores por fila. */
export function leerCatalogo(texto) {
  const filas = parsearCSV(texto);
  if (!filas.length) return { items: [], errores: ["El fichero está vacío."] };

  const cabecera = filas[0].map((h) => ALIAS[clave(h)] ?? clave(h));
  if (!cabecera.includes("producto") || !cabecera.includes("precio")) {
    return { items: [], errores: [`La cabecera necesita al menos 'producto' y 'precio'. Encontrado: ${filas[0].join(" | ")}`] };
  }

  const items = [], errores = [];
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const obj = {};
    cabecera.forEach((h, j) => { obj[h] = (f[j] ?? "").trim(); });

    const producto = obj.producto;
    const precio = normalizarPrecio(obj.precio);
    if (!producto) { errores.push(`Fila ${i + 1}: sin nombre de producto.`); continue; }
    if (!Number.isFinite(precio) || precio < 0) { errores.push(`Fila ${i + 1} (${producto}): precio inválido «${obj.precio}».`); continue; }

    items.push({
      familia: obj.familia || "General",
      categoria: obj.categoria || obj.familia || "General",
      producto,
      precio: Math.round(precio * 100) / 100,
      clase_fiscal: normalizarClase(obj.clase_fiscal),
      estacion: obj.estacion || null,
      alcohol: esSi(obj.alcohol),
    });
  }
  return { items, errores };
}

// ── Autotest (sin BD): la lógica no trivial deja su comprobación ──────────────
function autotest() {
  const assert = (cond, msg) => { if (!cond) { console.error("❌", msg); process.exit(1); } };

  assert(detectarSeparador("a;b;c") === ";", "separador ;");
  assert(detectarSeparador("a,b,c") === ",", "separador ,");

  const csv = 'familia;categoria;producto;precio;clase_fiscal\nBebidas;Refrescos;"Coca-Cola, lata";2,50;GENERAL\nComida;;Tortilla;8.75;\n';
  const { items, errores } = leerCatalogo(csv);
  assert(errores.length === 0, `sin errores, hubo: ${errores}`);
  assert(items.length === 2, `2 items, hubo ${items.length}`);
  assert(items[0].producto === "Coca-Cola, lata", "comillas con separador dentro");
  assert(items[0].precio === 2.5, `precio es 2,50 → ${items[0].precio}`);
  assert(items[0].clase_fiscal === "GENERAL", "clase GENERAL");
  assert(items[1].precio === 8.75, `precio en 8.75 → ${items[1].precio}`);
  assert(items[1].clase_fiscal === "REDUCIDO", "clase por defecto REDUCIDO");
  assert(items[1].categoria === "Comida", "categoría cae a familia si falta");

  assert(normalizarPrecio("1.234,56") === 1234.56, "formato es");
  assert(normalizarPrecio("1,234.56") === 1234.56, "formato en");

  console.log("✅ autotest del importador OK");
}

// ── Importación ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--autotest")) return autotest();

  const fichero = args.find((a) => !a.startsWith("--"));
  const tenant = args[args.indexOf("--tenant") + 1];
  const territorioArg = args.includes("--territorio") ? args[args.indexOf("--territorio") + 1] : null;
  const aplicar = args.includes("--aplicar");

  if (!fichero || !args.includes("--tenant") || !tenant) {
    console.error("Uso: node scripts/importar-catalogo.mjs <carta.csv> --tenant <uuid> [--territorio CANARIAS] [--aplicar]");
    process.exit(1);
  }
  const url = process.env.DIRECT_URL;
  if (!url) { console.error("Falta DIRECT_URL"); process.exit(1); }

  // REGLA Nº1: en local, SOLO el Postgres del nodo (55432). Nunca el del sistema.
  const u = new URL(url);
  const esLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  if (esLocal && u.port !== "55432") {
    console.error(`⛔ REGLA Nº1: en local solo se toca el Postgres del NODO (puerto 55432). DIRECT_URL apunta a ${u.hostname}:${u.port || "5432"}.`);
    process.exit(1);
  }

  const { items, errores } = leerCatalogo(readFileSync(fichero, "utf8"));
  for (const e of errores) console.warn("⚠ ", e);
  if (!items.length) { console.error("Nada que importar."); process.exit(1); }

  const familias = [...new Set(items.map((i) => i.familia))];
  const categorias = [...new Set(items.map((i) => `${i.familia}›${i.categoria}`))];
  console.log(`\n📋 ${fichero}: ${items.length} productos · ${familias.length} familias · ${categorias.length} categorías`);
  if (errores.length) console.log(`   (${errores.length} filas descartadas)`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log(`🔌 ${u.hostname}:${u.port || "5432"}${u.pathname}`);

  const res = { familias: 0, categorias: 0, productos: 0, actualizados: 0, iguales: 0 };
  try {
    await client.query("BEGIN");

    const { rows: t } = await client.query("select id from public.tenant where id = $1", [tenant]);
    if (!t.length) throw new Error(`El tenant ${tenant} no existe.`);

    const territorio = territorioArg ?? (await client.query(
      "select territorio_fiscal from public.location where tenant_id = $1 order by created_at limit 1", [tenant],
    )).rows[0]?.territorio_fiscal ?? "PENINSULA_BALEARES";
    console.log(`🧾 Territorio fiscal: ${territorio} (el % sale de resolver_iva)`);

    const idFamilia = new Map(), idCategoria = new Map();

    for (const nombre of familias) {
      const { rows } = await client.query(
        "select id from public.family where tenant_id = $1 and lower(nombre) = lower($2) limit 1", [tenant, nombre],
      );
      if (rows.length) { idFamilia.set(nombre, rows[0].id); continue; }
      res.familias++;
      const ins = await client.query(
        "insert into public.family (tenant_id, nombre, orden) values ($1,$2,$3) returning id",
        [tenant, nombre, familias.indexOf(nombre)],
      );
      idFamilia.set(nombre, ins.rows[0].id);
    }

    for (const par of categorias) {
      const [fam, cat] = par.split("›");
      const { rows } = await client.query(
        "select id from public.category where tenant_id = $1 and lower(nombre) = lower($2) limit 1", [tenant, cat],
      );
      if (rows.length) { idCategoria.set(par, rows[0].id); continue; }
      res.categorias++;
      const ins = await client.query(
        "insert into public.category (tenant_id, nombre, family_id, orden) values ($1,$2,$3,$4) returning id",
        [tenant, cat, idFamilia.get(fam), categorias.indexOf(par)],
      );
      idCategoria.set(par, ins.rows[0].id);
    }

    for (const it of items) {
      const catId = idCategoria.get(`${it.familia}›${it.categoria}`);
      const { rows } = await client.query(
        "select id, precio, clase_fiscal, estacion, es_alcohol from public.product where tenant_id = $1 and lower(nombre) = lower($2) and category_id is not distinct from $3 limit 1",
        [tenant, it.producto, catId],
      );
      if (!rows.length) {
        res.productos++;
        await client.query(
          `insert into public.product (tenant_id, category_id, nombre, precio, clase_fiscal, tipo_impositivo, estacion, es_alcohol)
           values ($1,$2,$3,$4,$5, public.resolver_iva($5,$6), $7,$8)`,
          [tenant, catId, it.producto, it.precio, it.clase_fiscal, territorio, it.estacion, it.alcohol],
        );
        continue;
      }
      const p = rows[0];
      const cambia = Number(p.precio) !== it.precio || p.clase_fiscal !== it.clase_fiscal
        || (p.estacion ?? null) !== it.estacion || p.es_alcohol !== it.alcohol;
      if (!cambia) { res.iguales++; continue; }
      res.actualizados++;
      await client.query(
        `update public.product set precio=$2, clase_fiscal=$3, tipo_impositivo=public.resolver_iva($3,$4),
         estacion=$5, es_alcohol=$6, updated_at=now() where id=$1`,
        [p.id, it.precio, it.clase_fiscal, territorio, it.estacion, it.alcohol],
      );
    }

    if (aplicar) { await client.query("COMMIT"); console.log("\n💾 Cambios GUARDADOS."); }
    else { await client.query("ROLLBACK"); console.log("\n🧪 SIMULACIÓN (nada guardado). Repite con --aplicar para escribir."); }

    console.log(`   familias nuevas: ${res.familias}`);
    console.log(`   categorías nuevas: ${res.categorias}`);
    console.log(`   productos nuevos: ${res.productos}`);
    console.log(`   productos actualizados: ${res.actualizados}`);
    console.log(`   sin cambios: ${res.iguales}`);
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { /* ya cerrado */ }
    console.error("❌ Error importando:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Solo se ejecuta si lo invocas directamente; así el módulo se puede importar
// (autotest, o reutilizar `leerCatalogo` desde el panel) sin lanzar la importación.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) await main();
