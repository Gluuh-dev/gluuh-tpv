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
import path from "node:path";
import pg from "pg";

const PUERTO = Number(process.env.NODO_MEDIA_PUERTO ?? 55436);
const RAIZ = path.resolve(process.env.NODO_MEDIA_DIR ?? ".nodo/media");
const BD = process.env.NODO_BD ?? "postgres://postgres:gluuh@127.0.0.1:55432/gluuh";

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
    const rel = url.pathname.slice("/object/media/".length);
    const fichero = rutaSegura(rel);
    if (!fichero) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "ruta inválida" }));
      return;
    }

    const trozos = [];
    for await (const t of req) trozos.push(t);
    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    fs.writeFileSync(fichero, Buffer.concat(trozos));

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
