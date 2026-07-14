// ¿VA BIEN EL RELOJ DEL BAR?
//
// Parece una tontería y no lo es: **el mini-PC del bar es el que pone la fecha y la hora
// en cada factura**. Si su reloj va veinte minutos adelantado, el bar está emitiendo
// facturas con una hora que no ocurrió — y eso, con VERIFACTU, va firmado y encadenado a
// Hacienda. No se arregla después.
//
// Y hay más: de la fecha depende **quién gana** al sincronizar la carta con la nube. Un
// nodo con el reloj adelantado creería que su versión es siempre la más nueva y pisaría
// para siempre lo que el dueño cambia desde casa.
//
// Un Windows recién instalado, sin dominio y sin que nadie mire, se desvía. Y una BIOS con
// la pila gastada —un mini-PC barato que lleva tres años debajo de una barra— se va de
// horas.
//
// Aquí no se TOCA el reloj (eso es de Windows, y cambiárselo a alguien por detrás es peor
// que el problema): se MIDE contra la nube y se avisa. En `/servidor` se ve en rojo.
//
//   node apps/nodo/reloj.mjs           mide y lo dice
//   node apps/nodo/reloj.mjs --json    para el panel

import { pathToFileURL } from "node:url";
import { credenciales } from "./nube.mjs";

// Dos minutos. Por debajo de eso no merece la pena molestar a nadie: ni cambia una factura
// de tramo horario ni decide una sincronización. Por encima, algo va mal de verdad.
const AVISO_MS = 2 * 60 * 1000;

export async function derivaDelReloj() {
  const url = credenciales().url;
  if (!url) return { ok: null, motivo: "sin nube configurada" };

  try {
    const antes = Date.now();
    // Sirve CUALQUIER respuesta HTTP: lo que se lee es la cabecera `Date`, que la pone el
    // servidor. No hace falta ni autenticarse.
    const r = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    const despues = Date.now();

    const suya = r.headers.get("date");
    if (!suya) return { ok: null, motivo: "la nube no dice la hora" };

    // La ida y vuelta introduce su propio retraso. Se compara contra el punto MEDIO de la
    // petición, y se descuenta la mitad del viaje: si no, una línea lenta parecería un
    // reloj desviado y el bar tendría un aviso rojo permanente que acabaría ignorando.
    const nuestra = (antes + despues) / 2;
    const deriva = nuestra - Date.parse(suya);
    const viaje = despues - antes;

    return {
      ok: Math.abs(deriva) < AVISO_MS,
      deriva_segundos: Math.round(deriva / 1000),
      viaje_ms: viaje,
      nuestra: new Date(nuestra).toISOString(),
      suya: new Date(Date.parse(suya)).toISOString(),
    };
  } catch (e) {
    // Sin internet no se puede medir. No es un fallo del bar: es un martes cualquiera.
    return { ok: null, motivo: `sin línea (${e.message.slice(0, 60)})` };
  }
}

// «¿Me han ejecutado a mí, o me está importando `estado.mjs`?». En Windows hay que pasar
// por `pathToFileURL`: `file://C:/…` (con dos barras, que es lo que sale de concatenar a
// mano) no es lo mismo que `file:///C:/…`, y la comparación no casaba NUNCA — o sea que
// `node apps/nodo/reloj.mjs` no imprimía absolutamente nada.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const d = await derivaDelReloj();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(d, null, 2));
  } else if (d.ok === null) {
    console.log(`No se ha podido comprobar: ${d.motivo}`);
  } else if (d.ok) {
    console.log(`El reloj del bar va bien (${d.deriva_segundos > 0 ? "+" : ""}${d.deriva_segundos} s).`);
  } else {
    const min = Math.round(Math.abs(d.deriva_segundos) / 60);
    console.error(
      `\n⚠  EL RELOJ DEL BAR VA ${d.deriva_segundos > 0 ? "ADELANTADO" : "ATRASADO"} ${min} MINUTO(S).\n\n` +
      `   Aquí:    ${d.nuestra}\n   La hora: ${d.suya}\n\n` +
      `   Este ordenador es el que pone la hora en cada FACTURA. Hay que arreglarlo:\n` +
      `   Windows → Hora e idioma → Sincronizar ahora. Y si se vuelve a desviar, la pila\n` +
      `   de la placa está gastada.\n`,
    );
    process.exit(1);
  }
}
