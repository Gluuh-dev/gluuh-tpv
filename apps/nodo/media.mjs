// IMÁGENES DEL NODO — la carta tiene que verse aunque no haya línea.
//
// Habla el mismo dialecto que Supabase Storage, así que el TPV no nota la diferencia:
//
//   GET  /object/public/media/<ruta>   sirve la imagen desde el disco del nodo
//   POST /object/media/<ruta>          guarda una imagen nueva (el dueño cambia una foto
//                                      SIN internet) y la deja en cola para subirla a la
//                                      nube cuando vuelva la conexión
//
// El gateway lo publica bajo /storage/v1, que es exactamente donde `urlFoto()` apunta.

import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";
import { verificar } from "./secreto.mjs";

const PUERTO = Number(process.env.NODO_MEDIA_PUERTO ?? 55436);
const RAIZ = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";
// Tope de subida (F5): una foto de carta redimensionada ronda los cientos de KB;
// 15 MB deja margen a un vídeo corto sin permitir agotar el disco del mini-PC.
const MAX_BYTES = 15 * 1024 * 1024;

fs.mkdirSync(RAIZ, { recursive: true });

const bd = new pg.Pool({ connectionString: BD });

const TIPOS = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

/**
 * Convierte la ruta pedida en una ruta REAL del disco, o null si se sale de la carpeta.
 *
 * Esto no es paranoia: sin esta comprobación, un `GET /object/public/media/../../../../
 * Windows/System32/config/SAM` serviría ficheros del sistema a cualquiera de la red del
 * bar. Se resuelve el destino y se exige que siga colgando de RAIZ.
 */
function rutaSegura(rel) {
  const limpia = decodeURIComponent(rel).replace(/^\/+/, "");
  const destino = path.resolve(RAIZ, limpia);
  if (destino !== RAIZ && !destino.startsWith(RAIZ + path.sep)) return null;
  return destino;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://nodo");

  // ── Servir ────────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname.startsWith("/object/public/media/")) {
    const fichero = rutaSegura(url.pathname.slice("/object/public/media/".length));
    if (!fichero || !fs.existsSync(fichero)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": TIPOS[path.extname(fichero).toLowerCase()] ?? "application/octet-stream",
      // Las fotos de carta cambian poco y las pantallas las piden sin parar.
      "cache-control": "public, max-age=86400",
    });
    fs.createReadStream(fichero).pipe(res);
    return;
  }

  // ── Guardar (el dueño cambia una foto sin internet) ───────────────────────
  if (req.method === "POST" && url.pathname.startsWith("/object/media/")) {
    // F5 (plans/023): escribir en el disco del nodo YA NO es anónimo. Hace falta
    // un token firmado por esta instalación (el que lleva cualquier sesión del
    // bar); un portátil ajeno en la LAN no lo tiene. Servir (GET) sigue público
    // por diseño: es la carta.
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!verificar(token)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Identifícate para subir ficheros al nodo" }));
      return;
    }

    const rel = url.pathname.slice("/object/media/".length);
    const fichero = rutaSegura(rel);
    if (!fichero) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "ruta inválida" }));
      return;
    }
    // Solo formatos de carta (la extensión decide el content-type al servir;
    // un .exe o un .html aquí no pintan nada).
    if (!TIPOS[path.extname(fichero).toLowerCase()]) {
      res.writeHead(415, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "formato no admitido" }));
      return;
    }

    // Tope de tamaño DURANTE el streaming: un body gigante se corta en cuanto
    // pasa del límite, no cuando ya se comió la RAM del mini-PC.
    const trozos = [];
    let bytes = 0;
    let excedido = false;
    // OJO: aquí había un `break` al pasarse del tope. Salir de un `for await`
    // DESTRUYE el stream de la petición, y con él la conexión — que es keep-alive
    // y el gateway reutiliza. Resultado: la petición SIGUIENTE de ese TPV moría con
    // ECONNRESET (subes una foto grande, se rechaza bien, y lo siguiente falla).
    //
    // Para poder responder y que la conexión siga sirviendo hay que CONSUMIR el
    // cuerpo entero, aunque se tire. Se sigue leyendo y descartando, con un tope
    // duro por si alguien manda sin parar: a ése sí se le corta.
    const TOPE_DRENAJE = MAX_BYTES * 4;
    for await (const t of req) {
      bytes += t.length;
      if (bytes > MAX_BYTES) {
        if (!excedido) { excedido = true; trozos.length = 0; }   // lo leído ya no sirve: fuera de la RAM
        if (bytes > TOPE_DRENAJE) { req.destroy(); break; }
        continue;                                                 // drenar sin guardar
      }
      trozos.push(t);
    }
    if (excedido) {
      // El cuerpo ya se ha consumido entero arriba, así que se puede responder y
      // dejar la conexión sana (antes se hacía `req.destroy()` y la envenenaba).
      res.writeHead(413, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `demasiado grande (máx ${MAX_BYTES / 1024 / 1024} MB)` }));
      return;
    }

    // Escritura ATÓMICA (temporal + rename): un corte a mitad no deja una foto
    // corrupta con el nombre bueno servida a todos los TPV.
    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    const temporal = `${fichero}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporal, Buffer.concat(trozos));
      fs.renameSync(temporal, fichero);
    } catch (e) {
      fs.rmSync(temporal, { force: true });
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }

    // A la cola: cuando haya internet, esta foto sube a Supabase (que es el archivo
    // de verdad — el disco de un mini-PC en una barra no es sitio para el único
    // ejemplar de nada).
    await bd.query(
      `insert into public.nodo_media_pendiente (ruta) values ($1)
         on conflict (ruta) do update set subida_at = null, intentos = 0`,
      [rel],
    );

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ Key: `media/${rel}` }));
    return;
  }

  res.writeHead(404).end();
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`media: sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO}`);
});
