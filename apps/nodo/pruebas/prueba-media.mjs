// "El dueño cambia la foto de un producto un martes que se ha caído la línea."
// Se guarda en el nodo, se ve al instante, y queda en cola para subirla a Supabase.
import pg from "pg";

const NODO = "http://127.0.0.1:54321";
const RUTA = "tenant-de-prueba/productos/cana.png";

// Un PNG de 1x1 de verdad (no hace falta más para probar el circuito)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

console.log("1. El dueño sube la foto (SIN internet) →", RUTA);
const subida = await fetch(`${NODO}/storage/v1/object/media/${RUTA}`, {
  method: "POST",
  headers: { "content-type": "image/png" },
  body: PNG,
});
if (!subida.ok) throw new Error(`subida falló: HTTP ${subida.status}`);
console.log("   guardada:", (await subida.json()).Key);

console.log("2. El TPV la pide, como la pintaría urlFoto()…");
const bajada = await fetch(`${NODO}/storage/v1/object/public/media/${RUTA}`);
const bytes = Buffer.from(await bajada.arrayBuffer());
console.log(`   HTTP ${bajada.status}  ${bajada.headers.get("content-type")}  ${bytes.length} bytes`);

const igual = bytes.equals(PNG);
console.log(`   ¿es la misma imagen? ${igual ? "sí" : "NO"}`);

console.log("3. ¿Quedó en cola para subirla a la nube?");
const bd = new pg.Client({ connectionString: "postgres://postgres:gluuh@127.0.0.1:55432/gluuh" });
await bd.connect();
const { rows } = await bd.query(
  "select ruta, subida_at from public.nodo_media_pendiente where ruta = $1",
  [RUTA],
);
await bd.end();

const enCola = rows.length === 1 && rows[0].subida_at === null;
console.log(`   ${enCola ? "sí: pendiente de subir a Supabase" : "NO está en cola"}`);

console.log("\n4. ¿Se puede escapar de la carpeta de imágenes? (no debería)");
const ataque = await fetch(`${NODO}/storage/v1/object/public/media/..%2F..%2Fgotrue.env`);
const bloqueado = ataque.status === 404;
console.log(`   HTTP ${ataque.status} → ${bloqueado ? "bloqueado" : "¡FUGA! sirve ficheros de fuera"}`);

const ok = igual && enCola && bloqueado;
console.log(ok
  ? "\n✅ Imágenes del nodo: se suben sin internet, se ven al instante y quedan en cola."
  : "\n❌ Algo falla.");
process.exit(ok ? 0 : 1);
