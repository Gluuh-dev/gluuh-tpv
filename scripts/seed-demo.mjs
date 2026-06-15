// Siembra datos demo (un tenant, un local en Canarias, categorías y carta) en la
// base de datos indicada por DIRECT_URL. Idempotente: borra y reinserta el tenant demo.
// Uso:  DIRECT_URL="postgresql://...:5432/postgres" node scripts/seed-demo.mjs
import pg from "pg";

const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";
const DEMO_LOCATION = "22222222-2222-2222-2222-222222222222";

const CATEGORIAS = ["Hamburguesas", "Menús", "Acompañamientos", "Bebidas", "Postres"];
const PRODUCTOS = [
  ["Hamburguesa Clásica", 6.5, 7, "Hamburguesas", false],
  ["Doble Bacon", 8.9, 7, "Hamburguesas", false],
  ["Pollo Crispy", 7.2, 7, "Hamburguesas", false],
  ["Menú Clásico", 9.9, 7, "Menús", false],
  ["Menú Doble", 11.9, 7, "Menús", false],
  ["Patatas Fritas", 3.2, 7, "Acompañamientos", false],
  ["Aros de Cebolla", 3.8, 7, "Acompañamientos", false],
  ["Refresco", 2.2, 7, "Bebidas", false],
  ["Agua", 1.5, 7, "Bebidas", false],
  ["Cerveza", 2.8, 15, "Bebidas", true],
  ["Helado", 2.5, 7, "Postres", false],
  ["Tarta de Queso", 3.5, 7, "Postres", false],
];

const url = process.env.DIRECT_URL;
if (!url) { console.error("Falta DIRECT_URL"); process.exit(1); }
const c = new pg.Client({ connectionString: url });

try {
  await c.connect();
  await c.query("BEGIN");

  // Limpieza idempotente (las FK con ON DELETE CASCADE limpian lo dependiente).
  await c.query("DELETE FROM tenant WHERE id = $1", [DEMO_TENANT]);

  await c.query(
    "INSERT INTO tenant (id, nombre, plan, email_admin) VALUES ($1,$2,'PRO',$3)",
    [DEMO_TENANT, "Bar Demo Gluuh", "admin@gluuh.com"],
  );
  await c.query(
    `INSERT INTO location (id, tenant_id, nombre, direccion, cif, razon_social, territorio_fiscal, regimen_facturacion, serie_factura)
     VALUES ($1,$2,$3,$4,$5,$6,'CANARIAS','VERIFACTU','F')`,
    [DEMO_LOCATION, DEMO_TENANT, "Bar Demo (La Palma)", "C/ Real 1, S/C de La Palma", "B12345678", "Bar Demo Gluuh SL"],
  );

  const catIds = {};
  for (let i = 0; i < CATEGORIAS.length; i++) {
    const r = await c.query(
      "INSERT INTO category (tenant_id, nombre, orden) VALUES ($1,$2,$3) RETURNING id",
      [DEMO_TENANT, CATEGORIAS[i], i],
    );
    catIds[CATEGORIAS[i]] = r.rows[0].id;
  }

  for (const [nombre, precio, tipo, cat, alcohol] of PRODUCTOS) {
    await c.query(
      `INSERT INTO product (tenant_id, category_id, nombre, precio, tipo_impositivo, es_alcohol, disponible)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [DEMO_TENANT, catIds[cat], nombre, precio, tipo, alcohol],
    );
  }

  await c.query("COMMIT");
  const n = await c.query("SELECT count(*)::int n FROM product WHERE tenant_id=$1", [DEMO_TENANT]);
  console.log(`✅ Datos demo sembrados. Tenant=${DEMO_TENANT}, productos=${n.rows[0].n}`);
} catch (e) {
  try { await c.query("ROLLBACK"); } catch {}
  console.error("❌ Error sembrando:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
