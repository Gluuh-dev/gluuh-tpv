// Prueba adversarial de la superficie LAN del nodo (F5, plans/023).
// Requiere el nodo levantado (gateway 54321 + media vía /storage/v1).
//
//   node apps/nodo/pruebas/prueba-superficie-lan.mjs
//
// NOTA: corre desde el propio servidor, así que los caminos "solo local"
// (estado, acciones) responden como local. La parte "desde otro host de la LAN"
// (estado→401 sin token) hay que probarla una vez desde un segundo equipo:
//   curl http://<ip-del-nodo>:54321/nodo/estado   → 401
import { firmar } from "../secreto.mjs";
import { noConcluyente } from "./ayuda.mjs";

const BASE = process.env.NODO_URL ?? "http://127.0.0.1:54321";
let fallos = 0;
const ok = (nombre, cond) => { console.log(`${cond ? "  ✔" : "  ✘"} ${nombre}`); if (!cond) fallos++; };
const pedir = (ruta, opciones) => fetch(BASE + ruta, opciones).catch(() => null);

// 1. Health público: vivo + versión y NADA más (ni recuentos ni rutas de disco).
{
  const r = await pedir("/nodo/health");
  const j = r ? await r.json().catch(() => null) : null;
  ok("health responde 200", r?.status === 200);
  ok("health solo trae ok/nodo/version", j && Object.keys(j).sort().join(",") === "nodo,ok,version");
}

// 2. Acciones: GET rechazado; POST con Origin ajeno rechazado.
{
  const get = await pedir("/nodo/accion/reiniciar");
  ok("acción por GET → 405", get?.status === 405);
  const csrf = await pedir("/nodo/accion/reiniciar", { method: "POST", headers: { origin: "http://malo.example" } });
  ok("acción con Origin ajeno → 403", csrf?.status === 403);
  const desconocida = await pedir("/nodo/accion/formatear", { method: "POST" });
  ok("acción desconocida → 404", desconocida?.status === 404);
}

// 3. Media: subir sin token → 401; token de otro secreto → 401; con token del
//    nodo pero extensión rara → 415; traversal → 400/404; grande → 413.
{
  const sin = await pedir("/storage/v1/object/media/prueba-lan.png", { method: "POST", body: "x" });
  ok("subida sin token → 401", sin?.status === 401);

  const ajeno = firmar("authenticated", "un-secreto-que-no-es-el-del-nodo");
  const falso = await pedir("/storage/v1/object/media/prueba-lan.png", {
    method: "POST", body: "x", headers: { authorization: `Bearer ${ajeno}` },
  });
  ok("subida con token de OTRO secreto → 401", falso?.status === 401);

  const token = firmar("authenticated"); // firmado con el secreto real del nodo

  // CONTROL, antes de dar por buenos los bloqueos: si la subida LEGÍTIMA no pasa,
  // todo lo demás sale "bloqueado" por el motivo equivocado y la prueba mentiría
  // (un 401 a todo hace que hasta «token ajeno → 401» pase por casualidad).
  const control = await pedir("/storage/v1/object/media/prueba-lan.png", {
    method: "POST", body: Buffer.from([0x89, 0x50, 0x4e, 0x47]), headers: { authorization: `Bearer ${token}` },
  });
  if (control?.status === 401 || control?.status === 403) {
    noConcluyente(
      `el servicio de media RECHAZA el token del propio nodo (HTTP ${control.status})`,
      "Corre con un secreto JWT distinto del de .nodo/nodo.env (servicios elevados del\n"
      + "instalado anterior). Reinicia Windows o relanza arrancar-nodo.ps1 y repite.",
    );
  }

  const exe = await pedir("/storage/v1/object/media/troyano.exe", {
    method: "POST", body: "MZ", headers: { authorization: `Bearer ${token}` },
  });
  ok("extensión no admitida → 415", exe?.status === 415);

  const traversal = await pedir("/storage/v1/object/media/..%2f..%2f..%2fWindows%2fwin.ini", {
    method: "POST", body: "x", headers: { authorization: `Bearer ${token}` },
  });
  ok("path traversal → 400", traversal?.status === 400);

  const gigante = await pedir("/storage/v1/object/media/gorda.png", {
    method: "POST", body: Buffer.alloc(16 * 1024 * 1024), headers: { authorization: `Bearer ${token}` },
  });
  ok("subida de 16 MB → 413", gigante?.status === 413);

  const buena = await pedir("/storage/v1/object/media/prueba-lan.png", {
    method: "POST", body: Buffer.from([0x89, 0x50, 0x4e, 0x47]), headers: { authorization: `Bearer ${token}` },
  });
  ok("subida legítima con token del nodo → 200", buena?.status === 200);
  const servida = await pedir("/storage/v1/object/public/media/prueba-lan.png");
  ok("la carta se sirve pública (GET) por diseño", servida?.status === 200);
}

console.log(fallos === 0 ? "\nTODO VERDE" : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
