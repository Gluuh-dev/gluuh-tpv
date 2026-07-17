// Prueba de los cursores compuestos (F7, plans/021). PURA: corre sin nodo,
// sin nube y sin base de datos:
//
//   node apps/nodo/pruebas/prueba-cursores.mjs
//
// Simula el caso que mataba a la marca de agua de solo fecha: 2.501 filas con
// el MISMO updated_at, paginadas de 1000 en 1000 — cada fila debe salir
// EXACTAMENTE una vez, con el corte de página cayendo en mitad del grupo.
import { cursorLeer, cursorGuardar, despuesDe, despuesDePk } from "../cursores.mjs";

let fallos = 0;
const ok = (nombre, cond) => { console.log(`${cond ? "  ✔" : "  ✘"} ${nombre}`); if (!cond) fallos++; };

// 1. Compatibilidad con marcas antiguas (solo fecha) y nuevas (JSON).
{
  const vieja = cursorLeer("2026-07-14T08:48:34.098381+00:00");
  ok("marca antigua → {t, k:null}", vieja.t.startsWith("2026-07-14") && vieja.k === null);
  const fila = { updated_at: "2026-07-17T10:00:00+00:00", id: "abc" };
  const nueva = cursorLeer(cursorGuardar(fila, ["id"]));
  ok("marca nueva ida y vuelta", nueva.t === fila.updated_at && nueva.k[0] === "abc");
  ok("marca corrupta no revienta", cursorLeer("{basura").k === null);
}

// 2. El filtro «después de» reproduce el orden (updated_at, pk) sin saltarse
//    ni repetir — la simulación evalúa el filtro en memoria igual que lo haría
//    PostgREST con order=updated_at.asc,id.asc.
{
  const T = "2026-07-17T12:00:00+00:00";
  const filas = [];
  for (let i = 0; i < 2501; i++) filas.push({ updated_at: T, id: String(i).padStart(6, "0") });
  filas.push({ updated_at: "2026-07-17T13:00:00+00:00", id: "zzz" }); // una posterior

  // Evaluador en memoria del filtro que genera despuesDe():
  const pasaFiltro = (fila, cur) => {
    if (!cur.k) return fila.updated_at > cur.t; // (ISO mismo huso: comparable)
    return fila.updated_at > cur.t || (fila.updated_at === cur.t && fila.id > cur.k[0]);
  };

  const vistas = [];
  let cur = cursorLeer(null);
  for (let pagina = 0; pagina < 10; pagina++) {
    const lote = filas
      .filter((f) => pasaFiltro(f, cur))
      .sort((a, b) => (a.updated_at + a.id).localeCompare(b.updated_at + b.id))
      .slice(0, 1000);
    if (!lote.length) break;
    vistas.push(...lote);
    const ultima = lote[lote.length - 1];
    cur = cursorLeer(cursorGuardar(ultima, ["id"]));
  }
  ok("2.501 filas con el MISMO updated_at salen todas", vistas.length === 2502);
  ok("ninguna repetida", new Set(vistas.map((f) => f.id)).size === 2502);
  ok("la posterior sale la última", vistas[vistas.length - 1].id === "zzz");
}

// 3. La sintaxis PostgREST que generan los filtros.
{
  const f1 = despuesDe(["id"], { t: "2026-07-17T12:00:00+00:00", k: ["abc"] });
  ok("despuesDe usa or=(gt, and(eq, pk.gt))", decodeURIComponent(f1).includes('and(updated_at.eq."2026-07-17T12:00:00+00:00",id.gt."abc")'));
  const f2 = despuesDe(["id"], { t: "1970-01-01T00:00:00Z", k: null });
  ok("sin pk previa degrada a updated_at=gt.", f2.startsWith("updated_at=gt."));
  const f3 = despuesDePk(["product_id", "category_id"], { product_id: "p1", category_id: "c1" });
  ok("PK compuesta pagina con or/and", decodeURIComponent(f3).includes('and(product_id.eq."p1",category_id.gt."c1")'));
  const f4 = despuesDePk(["id"], { id: "x" });
  ok("PK simple usa gt directo", f4 === "id=gt.x");
}

console.log(fallos === 0 ? "\nCURSORES: TODO VERDE" : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
