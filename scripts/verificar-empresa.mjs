// Comprueba si una empresa está LISTA PARA OPERAR, antes de ir al bar.
//
// Es SOLO LECTURA: no escribe nada, nunca. Su razón de ser es que descubrir en el
// bar que el territorio fiscal está mal, que nadie tiene PIN o que no hay formas de
// pago cuesta un viaje. Aquí sale en 2 segundos.
//
// Uso:
//   DIRECT_URL="postgresql://…" node scripts/verificar-empresa.mjs --tenant <uuid>
//   DIRECT_URL="postgresql://…" node scripts/verificar-empresa.mjs --codigo 1234-5678-90123-4567-8901
//
// Sale con código 1 si hay algo BLOQUEANTE (❌); 0 si solo hay avisos.
import pg from "pg";
import { argv } from "node:process";

const problemas = { bloqueantes: 0, avisos: 0 };
const ok = (m) => console.log(`  ✅ ${m}`);
const aviso = (m) => { problemas.avisos++; console.log(`  ⚠️  ${m}`); };
const error = (m) => { problemas.bloqueantes++; console.log(`  ❌ ${m}`); };
const titulo = (m) => console.log(`\n${m}`);
/** Muestra unos pocos ejemplos para que sepas por dónde mirar, sin volcar 200 filas. */
const ejemplos = (filas, campo = "nombre", n = 5) =>
  filas.slice(0, n).map((f) => f[campo]).join(", ") + (filas.length > n ? `… (+${filas.length - n})` : "");

async function main() {
  const tenantArg = argv.includes("--tenant") ? argv[argv.indexOf("--tenant") + 1] : null;
  const codigoArg = argv.includes("--codigo") ? argv[argv.indexOf("--codigo") + 1] : null;
  if (!tenantArg && !codigoArg) {
    console.error("Uso: node scripts/verificar-empresa.mjs --tenant <uuid> | --codigo <código-instalación>");
    process.exit(1);
  }
  const url = process.env.DIRECT_URL;
  if (!url) { console.error("Falta DIRECT_URL"); process.exit(1); }

  // REGLA Nº1: en local, SOLO el Postgres del nodo (55432).
  const u = new URL(url);
  if (["localhost", "127.0.0.1", "::1"].includes(u.hostname) && u.port !== "55432") {
    console.error(`⛔ REGLA Nº1: en local solo el Postgres del NODO (55432). DIRECT_URL va a ${u.hostname}:${u.port || "5432"}.`);
    process.exit(1);
  }

  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    // ── Empresa ──────────────────────────────────────────────────────────────
    const { rows: emp } = await db.query(
      `select id, nombre, plan, estado_alta, codigo_instalacion from public.tenant
       where ($1::uuid is not null and id = $1::uuid) or ($2::text is not null and codigo_instalacion = $2)`,
      [tenantArg, codigoArg],
    );
    if (!emp.length) { console.error(`❌ No existe esa empresa (${tenantArg ?? codigoArg}).`); process.exit(1); }
    const t = emp[0];

    console.log(`\n═══ ${t.nombre} ═══`);
    console.log(`    ${t.id} · plan ${t.plan ?? "—"}`);

    titulo("🏢 Empresa");
    if (t.estado_alta === "ACTIVA") ok(`Alta ACTIVA`);
    else aviso(`estado_alta = ${t.estado_alta} (se espera ACTIVA)`);
    if (t.codigo_instalacion) ok(`Código de instalación: ${t.codigo_instalacion}`);
    else error("Sin código de instalación: el nodo no puede atarse a esta empresa");

    // ── Local y fiscalidad ───────────────────────────────────────────────────
    titulo("🧾 Local y fiscalidad");
    const { rows: locs } = await db.query(
      `select nombre, cif, razon_social, territorio_fiscal, regimen_facturacion, serie_factura
       from public.location where tenant_id = $1 order by created_at`, [t.id],
    );
    let territorio = null;
    if (!locs.length) error("No hay ningún local (location): sin él no se puede facturar");
    else {
      const l = locs[0];
      territorio = l.territorio_fiscal;
      const { rows: terr } = await db.query("select 1 from public.tax_rate where territorio = $1 limit 1", [territorio]);
      if (!territorio) error("territorio_fiscal vacío");
      else if (!terr.length) error(`territorio_fiscal «${territorio}» no existe en tax_rate`);
      else ok(`Territorio fiscal: ${territorio}${territorio === "CANARIAS" ? " (IGIC)" : ""}`);

      if (!l.cif || l.cif === "PENDIENTE") aviso("CIF sin poner (queda 'PENDIENTE'): la factura saldrá sin CIF real");
      else ok(`CIF: ${l.cif}`);
      if (l.serie_factura) ok(`Serie de factura: ${l.serie_factura}`);
      else error("Sin serie de factura");
      ok(`Régimen: ${l.regimen_facturacion ?? "—"}`);
      if (locs.length > 1) ok(`${locs.length} locales`);
    }

    // ── Carta ────────────────────────────────────────────────────────────────
    titulo("📖 Carta");
    const uno = async (sql, params = [t.id]) => Number((await db.query(sql, params)).rows[0].n);
    const nFam = await uno("select count(*)::int n from public.family where tenant_id = $1");
    const nCat = await uno("select count(*)::int n from public.category where tenant_id = $1");
    const nProd = await uno("select count(*)::int n from public.product where tenant_id = $1");

    if (!nProd) error("La carta está VACÍA (0 productos)");
    else ok(`${nProd} productos · ${nCat} categorías · ${nFam} familias`);

    if (nProd) {
      const { rows: sinCat } = await db.query(
        "select nombre from public.product where tenant_id = $1 and category_id is null", [t.id]);
      if (sinCat.length) aviso(`${sinCat.length} productos sin categoría (no se verán en el TPV): ${ejemplos(sinCat)}`);

      const { rows: malPrecio } = await db.query(
        "select nombre from public.product where tenant_id = $1 and (precio is null or precio <= 0)", [t.id]);
      if (malPrecio.length) aviso(`${malPrecio.length} productos a 0 € o sin precio: ${ejemplos(malPrecio)}`);

      // ⭐ El chequeo que más caro sale si falla: el % guardado en el producto tiene
      // que ser EXACTAMENTE el que resuelve tax_rate para su clase y territorio.
      if (territorio) {
        const { rows: descuadre } = await db.query(
          `select nombre, clase_fiscal, tipo_impositivo, public.resolver_iva(clase_fiscal, $2) esperado
           from public.product
           where tenant_id = $1 and tipo_impositivo is distinct from public.resolver_iva(clase_fiscal, $2)`,
          [t.id, territorio],
        );
        if (descuadre.length) {
          error(`${descuadre.length} productos con impuesto DESCUADRADO respecto a ${territorio}:`);
          for (const d of descuadre.slice(0, 5)) {
            console.log(`       · ${d.nombre}: guarda ${d.tipo_impositivo}% y ${d.clase_fiscal} en ${territorio} son ${d.esperado}%`);
          }
          if (descuadre.length > 5) console.log(`       … (+${descuadre.length - 5})`);
        } else ok("Los impuestos de todos los productos cuadran con el territorio");
      }

      const { rows: sinEstacion } = await db.query(
        "select nombre from public.product where tenant_id = $1 and (estacion is null or estacion = '')", [t.id]);
      if (sinEstacion.length) aviso(`${sinEstacion.length} productos sin estación (no saldrán en la comanda de cocina/barra): ${ejemplos(sinEstacion)}`);

      const nNoDisp = await uno("select count(*)::int n from public.product where tenant_id = $1 and disponible = false");
      if (nNoDisp) aviso(`${nNoDisp} productos marcados como NO disponibles`);
    }

    // ── Formas de pago ───────────────────────────────────────────────────────
    titulo("💳 Formas de pago");
    const { rows: fp } = await db.query(
      "select nombre, tipo, activo from public.payment_method where tenant_id = $1 order by orden", [t.id]);
    const activas = fp.filter((f) => f.activo);
    if (!activas.length) error("No hay ninguna forma de pago activa: no se puede cobrar");
    else {
      ok(`${activas.length} activas: ${activas.map((f) => f.nombre).join(", ")}`);
      if (!activas.some((f) => /CONTADO|EFECTIVO/i.test(`${f.tipo} ${f.nombre}`))) {
        aviso("Ninguna es de efectivo/contado: revisa que sea intencionado");
      }
    }

    // ── Equipo ───────────────────────────────────────────────────────────────
    titulo("👤 Equipo");
    const { rows: gente } = await db.query(
      "select nombre, rol, activo, (pin_hash is not null) tiene_pin from public.app_user where tenant_id = $1", [t.id]);
    const vivos = gente.filter((g) => g.activo);
    if (!vivos.length) error("No hay ningún usuario activo");
    else {
      ok(`${vivos.length} usuarios activos`);
      const conPin = vivos.filter((g) => g.tiene_pin);
      if (!conPin.length) error("NADIE tiene PIN: no se puede entrar al TPV");
      else ok(`${conPin.length} con PIN: ${conPin.map((g) => `${g.nombre} (${g.rol})`).join(", ")}`);
      const sinPin = vivos.filter((g) => !g.tiene_pin);
      if (sinPin.length) aviso(`${sinPin.length} sin PIN (no entran al TPV): ${ejemplos(sinPin)}`);
      if (!vivos.some((g) => g.rol === "PROPIETARIO")) aviso("Ningún PROPIETARIO activo");
    }

    // ── Veredicto ────────────────────────────────────────────────────────────
    console.log("\n" + "─".repeat(56));
    if (problemas.bloqueantes) {
      console.log(`⛔ NO está lista: ${problemas.bloqueantes} bloqueante(s), ${problemas.avisos} aviso(s).`);
      process.exitCode = 1;
    } else if (problemas.avisos) {
      console.log(`✅ Puede operar, con ${problemas.avisos} aviso(s) que conviene revisar.`);
    } else {
      console.log("✅ Lista para operar.");
    }
  } catch (e) {
    console.error("❌ Error verificando:", e.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await main();
