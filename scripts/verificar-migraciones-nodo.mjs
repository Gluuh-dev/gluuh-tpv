#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Harness de migraciones desde cero (F0, entrega 0.2 de la guía 19).
//
//   GLUUH_DB_DESECHABLE=1 node scripts/verificar-migraciones-nodo.mjs
//
// Aplica `supabase/migrations/0001–NNNN` en orden sobre un Postgres DESECHABLE
// del nodo y contrasta el esquema resultante con el contrato generado
// (`supabase/types/database.types.ts`). Sirve para probar que una instalación
// nueva reproduce el esquema esperado ANTES de tocar la nube.
//
// GUARDAS (REGLA Nº 1 del repo — no negociables):
//   · host 127.0.0.1, puerto 55432, base `gluuh`, y nada más;
//   · aborta ANTES de conectar si el destino no coincide;
//   · exige GLUUH_DB_DESECHABLE=1: NUNCA ejecutar contra un nodo con datos
//     reales (hace DROP SCHEMA public). Sin esa variable, solo informa.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PUERTO = 55432;
const BASE = "gluuh";

// Guarda 1: el destino es fijo; cualquier intento de cambiarlo por entorno se ignora
// y se denuncia.
for (const v of ["PGHOST", "PGPORT", "PGDATABASE"]) {
  if (process.env[v]) {
    console.error(`[migraciones] ${v} está definido en el entorno; se IGNORA. Destino fijo: ${HOST}:${PUERTO}/${BASE}.`);
    delete process.env[v];
  }
}

// Guarda 2: entorno desechable confirmado explícitamente.
if (process.env.GLUUH_DB_DESECHABLE !== "1") {
  console.error(
    "[migraciones] Falta GLUUH_DB_DESECHABLE=1.\n" +
      "[migraciones] Este harness hace DROP SCHEMA public sobre 127.0.0.1:55432/gluuh.\n" +
      "[migraciones] Solo debe ejecutarse en un nodo desechable (VM/worktree), JAMÁS sobre datos reales.\n" +
      "[migraciones] No se ha conectado a ninguna base.",
  );
  process.exit(2);
}

const ficheros = readdirSync(join(RAIZ, "supabase", "migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
if (!ficheros.length) {
  console.error("[migraciones] No hay migraciones en supabase/migrations.");
  process.exit(1);
}

const cliente = new pg.Client({
  host: HOST,
  port: PUERTO,
  database: BASE,
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
});
await cliente.connect();

// Guarda 3: reconfirmar contra el servidor al que de verdad estamos conectados.
const { rows: [donde] } = await cliente.query(
  "select current_database() as db, inet_server_port() as puerto",
);
if (donde.db !== BASE || Number(donde.puerto) !== PUERTO) {
  console.error(`[migraciones] Conectado a ${donde.db}:${donde.puerto}, no a ${BASE}:${PUERTO}. Abortando.`);
  await cliente.end();
  process.exit(1);
}

console.log(`[migraciones] Destino confirmado ${HOST}:${PUERTO}/${BASE}. Reset + ${ficheros.length} migraciones…`);
let aplicadas = 0;
try {
  await cliente.query("drop schema if exists public cascade; create schema public; grant all on schema public to public;");
  for (const f of ficheros) {
    const sql = readFileSync(join(RAIZ, "supabase", "migrations", f), "utf8");
    try {
      await cliente.query(sql);
      aplicadas++;
    } catch (e) {
      console.error(`[migraciones] FALLO en ${f}: ${e.message}`);
      console.error(`[migraciones] Aplicadas ${aplicadas}/${ficheros.length}. El esquema queda INCOMPLETO (no es un éxito).`);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    // Fixtures mínimos: dos tenants sin datos personales, para las matrices A/B.
    await cliente.query(`
      insert into public.tenant (id, nombre) values
        ('00000000-0000-4000-8000-00000000000a', 'Tenant A (fixture)'),
        ('00000000-0000-4000-8000-00000000000b', 'Tenant B (fixture)')
      on conflict (id) do nothing;
    `);

    // Inventario y contraste con el contrato generado desde la nube.
    const { rows: [inv] } = await cliente.query(`
      select
        (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tablas,
        (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as funciones,
        (select count(*) from pg_policies where schemaname='public') as politicas
    `);
    console.log(`[migraciones] OK ${aplicadas}/${ficheros.length}. Esquema limpio: ${inv.tablas} tablas, ${inv.funciones} funciones, ${inv.politicas} políticas RLS.`);
    const { rows: tablasNodo } = await cliente.query(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    );
    const contrato = readFileSync(join(RAIZ, "supabase", "types", "database.types.ts"), "utf8");
    const enNodo = new Set(tablasNodo.map((r) => r.table_name));
    const seccion = contrato.slice(contrato.indexOf("    Tables: {"), contrato.indexOf("    Views: {"));
    const enContrato = [...seccion.matchAll(/^ {6}(\w+): \{/gm)].map((m) => m[1]);
    const faltanEnNodo = enContrato.filter((t) => !enNodo.has(t));
    const sobranEnNodo = [...enNodo].filter((t) => !enContrato.includes(t));
    if (faltanEnNodo.length || sobranEnNodo.length) {
      console.error(`[migraciones] DRIFT esquema-limpio ↔ nube — clasificar en docs/auditoria/08:`);
      if (faltanEnNodo.length) console.error(`  en la nube pero no en migraciones: ${faltanEnNodo.join(", ")}`);
      if (sobranEnNodo.length) console.error(`  en migraciones pero no en la nube: ${sobranEnNodo.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log("[migraciones] Las tablas del esquema limpio coinciden con el contrato de la nube.");
    }
  }
} finally {
  await cliente.end();
}
