// LA COPIA DE SEGURIDAD DEL BAR.
//
// El mini-PC de debajo de la barra tiene un disco, y los discos se rompen. Hasta ahora, el
// día que se rompiera uno, el bar perdía TODO lo que no hubiera subido a la nube: las
// mesas abiertas, la caja del día, y las ventas de las horas sin línea. Y no se enteraría
// nadie hasta el momento de intentar cobrar.
//
// Esto hace un `pg_dump` completo, comprimido, y guarda los 7 últimos. Lo lanza el
// vigilante de madrugada (arrancar-nodo.ps1 -Vigilar).
//
//   node apps/nodo/copia.mjs           hace una copia ahora
//   node apps/nodo/copia.mjs --estado  dice cuál fue la última y cuánto ocupa
//
// NO SUSTITUYE A LA NUBE, la complementa: la nube tiene lo cerrado, esto tiene TODO —
// incluidas las mesas que ahora mismo están abiertas.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(".");
const NODO = path.join(RAIZ, ".nodo");
const DESTINO = process.env.NODO_COPIAS ?? path.join(NODO, "copias");
const CUANTAS = Number(process.env.NODO_COPIAS_GUARDAR ?? 7);

// OJO con `{...fs.statSync(x)}`: los `Stats` de Node llevan `mtime` en el PROTOTIPO, así
// que el spread se lo deja por el camino y sale `undefined`. Se copia a mano.
const listar = () =>
  (fs.existsSync(DESTINO) ? fs.readdirSync(DESTINO) : [])
    .filter((f) => f.endsWith(".dump"))
    .map((f) => {
      const s = fs.statSync(path.join(DESTINO, f));
      return { f, mtime: s.mtime, mtimeMs: s.mtimeMs, size: s.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

if (process.argv.includes("--estado")) {
  const copias = listar();
  console.log(JSON.stringify({
    ultima: copias[0] ? copias[0].mtime.toISOString() : null,
    fichero: copias[0]?.f ?? null,
    tamano: copias[0] ? copias[0].size : 0,
    cuantas: copias.length,
  }, null, 2));
  process.exit(0);
}

fs.mkdirSync(DESTINO, { recursive: true });

// El nombre lleva la fecha delante para que ordenen solas y se vea de un vistazo cuál es
// la última sin mirar propiedades de ficheros.
const sello = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const fichero = path.join(DESTINO, `gluuh-${sello}.dump`);
const parcial = `${fichero}.parcial`;

const pgDump = path.join(NODO, "pgsql", "bin", "pg_dump.exe");
process.env.PGPASSWORD = "gluuh";

console.log(`Copiando la base del bar → ${path.basename(fichero)}`);

try {
  // -Fc: el formato propio de Postgres. Comprime, y permite restaurar una sola tabla si
  // hiciera falta (que es lo que se necesita el día que alguien borra una carta entera).
  //
  // Se escribe a un `.parcial` y se renombra AL FINAL. Si el bar se queda sin luz a mitad
  // del volcado —que es exactamente cuando pasan estas cosas—, lo que queda es un fichero
  // `.parcial` que nadie confundirá con una copia buena. Un backup a medias que PARECE
  // entero es peor que no tener ninguno: se descubre el día que hace falta.
  execFileSync(pgDump, [
    "-h", "127.0.0.1", "-p", "55432", "-U", "postgres",
    "-d", "gluuh", "-Fc", "-f", parcial,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  fs.renameSync(parcial, fichero);
} catch (e) {
  fs.rmSync(parcial, { force: true });
  console.error(`La copia FALLÓ: ${String(e.stderr ?? "").trim() || e.message}`);
  process.exit(1);
}

const copias = listar();
console.log(`  ${mb(copias[0].size)}`);

// Y se tiran las viejas. Sin esto, el disco del mini-PC se llena en unos meses y el bar se
// para por un backup — que es la forma más tonta de caerse.
for (const vieja of copias.slice(CUANTAS)) {
  fs.rmSync(path.join(DESTINO, vieja.f), { force: true });
  console.log(`  - ${vieja.f}`);
}

console.log(`${Math.min(copias.length, CUANTAS)} copia(s) guardadas en ${DESTINO}`);
