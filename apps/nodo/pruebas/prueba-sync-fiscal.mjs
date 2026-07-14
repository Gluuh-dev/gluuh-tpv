// LA NUBE TIENE QUE PODER DECLARAR A HACIENDA LO QUE VENDIÓ EL BAR.
//
// La decisión (plan/11 §7): el nodo genera la factura y su huella SIN internet, y la
// NUBE la remite a la AEAT. Para eso la nube necesita tres cosas, no una:
//
//   · la factura            (invoice)
//   · su desglose de IVA    (invoice_tax_line)   ← faltaba
//   · el registro de huella (verifactu_record)   ← faltaba
//
// Esto lo comprueba de punta a punta: crea una factura completa en el NODO, sincroniza
// DOS veces, y mira qué hay en la nube. Al final lo limpia todo.
//
//   node apps/nodo/pruebas/prueba-sync-fiscal.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import pg from "pg";

for (const l of fs.readFileSync(".nodo/sync.env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) process.env[m[1]] ??= m[2];
}
const { cabeceras } = await import("../nube.mjs");
const NUBE = process.env.SUPABASE_URL;
const cab = await cabeceras();
if (!cab) throw new Error("sin credenciales de la nube (.nodo/sync.env)");

const nube = async (ruta, opts = {}) => {
  const r = await fetch(`${NUBE}/rest/v1/${ruta}`, { headers: cab, ...opts });
  const t = await r.text();
  if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

const bd = new pg.Client({ connectionString: "postgres://postgres:gluuh@127.0.0.1:55432/gluuh" });
await bd.connect();

// El bar que tiene el nodo (el que se provisionó). Su tenant existe en la nube, así que
// las claves foráneas resuelven — como en una instalación real.
const { rows: [local] } = await bd.query("select id, tenant_id from public.location limit 1");
if (!local) throw new Error("el nodo no tiene local: provisiona primero");

const clientId = crypto.randomUUID();
const serie = "PRUEBA";
const numero = Math.floor(Math.random() * 900000) + 100000;
let pedidoId, facturaId;

try {
  console.log("1. El bar cobra una comanda y emite factura (SIN internet)");

  ({ rows: [{ id: pedidoId }] } = await bd.query(
    `insert into public.sales_order (tenant_id, location_id, estado, total, client_id)
          values ($1, $2, 'COBRADA', 10.70, $3) returning id`,
    [local.tenant_id, local.id, clientId],
  ));

  // IGIC canario del 7 %: 10,00 de base + 0,70 de cuota = 10,70 (impuesto INCLUIDO).
  ({ rows: [{ id: facturaId }] } = await bd.query(
    `insert into public.invoice
       (tenant_id, location_id, order_id, serie, numero, num_serie_factura,
        fecha_expedicion, nif_emisor, tipo_factura,
        base_total, cuota_total, importe_total, huella, estado_aeat)
     values ($1, $2, $3, $4, $5, $6, current_date, 'B00000000', 'F2',
             10.00, 0.70, 10.70, $7, 'NO_ENVIADA')
     returning id`,
    [local.tenant_id, local.id, pedidoId, serie, numero, `${serie}/${numero}`,
     crypto.randomBytes(32).toString("hex").toUpperCase()],
  ));

  await bd.query(
    `insert into public.invoice_tax_line (tenant_id, invoice_id, tipo, base, cuota)
          values ($1, $2, 7, 10.00, 0.70)`,
    [local.tenant_id, facturaId],
  );

  await bd.query(
    `insert into public.verifactu_record
       (tenant_id, invoice_id, tipo_registro, huella, qr_url, estado_envio, fecha_hora_gen)
     values ($1, $2, 'ALTA', $3, 'https://prueba/qr', 'PENDIENTE', now())`,
    [local.tenant_id, facturaId, crypto.randomBytes(32).toString("hex").toUpperCase()],
  );

  console.log(`   factura ${serie}/${numero} — 10,70 € (base 10,00 + IGIC 0,70)`);

  console.log("\n2. Sincronizar DOS veces (como si se cortara la línea y reintentara)");
  for (const pase of [1, 2]) {
    const salida = execSync("node apps/nodo/sincronizar.mjs", { encoding: "utf8" });
    const linea = (t) => (salida.split("\n").find((l) => l.includes(t)) ?? "").trim();
    console.log(`   pase ${pase}: ${linea("invoice ")} | ${linea("invoice_tax_line")} | ${linea("verifactu_record")}`);
    if (/FALLÓ/.test(salida)) {
      console.error(salida.split("\n").filter((l) => l.includes("FALLÓ")).join("\n"));
      throw new Error("la sincronización falló");
    }
  }

  console.log("\n3. ¿QUÉ HAY EN LA NUBE? (esto es lo que se declara a Hacienda)");
  const facturas = await nube(`invoice?select=num_serie_factura,importe_total&id=eq.${facturaId}`);
  const lineas = await nube(`invoice_tax_line?select=tipo,base,cuota&invoice_id=eq.${facturaId}`);
  const registros = await nube(`verifactu_record?select=tipo_registro,estado_envio&invoice_id=eq.${facturaId}`);

  console.log(`   factura          : ${facturas.length}  ${facturas[0]?.num_serie_factura ?? ""} — ${facturas[0]?.importe_total ?? "?"} €`);
  console.log(`   desglose de IVA  : ${lineas.length}  ${lineas[0] ? `tipo ${lineas[0].tipo}% · base ${lineas[0].base} · cuota ${lineas[0].cuota}` : "(NINGUNO — no se puede declarar)"}`);
  console.log(`   registro huella  : ${registros.length}  ${registros[0]?.tipo_registro ?? "(NINGUNO — sin cadena VERIFACTU)"}`);

  const ok = facturas.length === 1 && lineas.length === 1 && registros.length === 1;
  console.log("\n" + "═".repeat(64));
  console.log(ok
    ? "✅ La nube tiene la factura, su desglose y su huella. Puede declarar.\n   Y dos sincronizaciones = UNA sola de cada cosa."
    : "❌ Falta algo en la nube: NO se podría declarar a la AEAT.");
  console.log("═".repeat(64));
  process.exitCode = ok ? 0 : 1;
} finally {
  console.log("\n(limpiando la prueba de la nube y del nodo)");
  if (facturaId) {
    for (const t of ["verifactu_record", "invoice_tax_line"]) {
      await nube(`${t}?invoice_id=eq.${facturaId}`, { method: "DELETE" }).catch(() => {});
      await bd.query(`delete from public.${t} where invoice_id = $1`, [facturaId]);
    }
    await nube(`invoice?id=eq.${facturaId}`, { method: "DELETE" }).catch(() => {});
    await bd.query("delete from public.invoice where id = $1", [facturaId]);
  }
  if (pedidoId) {
    await nube(`sales_order?client_id=eq.${clientId}`, { method: "DELETE" }).catch(() => {});
    await bd.query("delete from public.sales_order where id = $1", [pedidoId]);
  }
  // Las marcas de agua de la prueba: se retiran para no dejar el estado tocado.
  await bd.query(
    "delete from public.nodo_sync_estado where tabla in ('invoice','invoice_tax_line','verifactu_record')",
  );
  await bd.end();
}
