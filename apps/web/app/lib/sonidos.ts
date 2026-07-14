"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  EL SONIDO. Una sola puerta.
//
//  Un TPV es una pantalla de cristal: al tocarla no se hunde nada, no hay recorrido, no hay
//  clic. En una barra ruidosa, un camarero que pica veinte cañas necesita **saber que ha
//  entrado**. Por eso todos los TPV del mercado (Glop, Ágora, Revo) suenan. No es adorno.
//
//  Por dentro usa **cuelume** (2 KB, síntesis con Web Audio, sin ficheros y sin
//  dependencias). Que no use ficheros importa **mucho** aquí: el bar funciona **sin
//  internet**, y un `.mp3` es una cosa más que puede no estar cacheada el día que se corte
//  la línea. Un sonido sintetizado siempre suena.
//
//  ── PERO VA DETRÁS DE ESTA PUERTA, Y NO SE USA DIRECTAMENTE ────────────────
//
//  Tres razones, y las tres son de fondo:
//
//  1. **CUELUME ES `v0.1.0`, DE UN AUTOR DESCONOCIDO.** Un paquete así se abandona, o le
//     meten algo en una actualización. Si un día hay que sacarlo, se cambia **este fichero**
//     y ya — no veinte. (Es el mismo patrón que `supabaseServidor.ts`.)
//
//  2. **SUS `press`/`release` NO SUENAN EN UNA PANTALLA TÁCTIL.** La librería los ata a
//     «puntero fino» (ratón) a propósito. O sea que la forma que ella recomienda —poner
//     `data-cuelume-press` en el HTML y llamar a `bind()`— **sería muda en el TPV de un
//     bar**, que es justo donde tiene que sonar. Aquí se llama a `play()` a mano, que sí
//     funciona con el dedo.
//
//  3. **Y ESCONDE EL FALLO QUE MÁS DUELE.** Su documentación dice, literalmente, que intenta
//     reanudar el audio bloqueado *«sin mostrar errores»*. Eso está bien para una web
//     bonita, y es **inaceptable en una cocina**: ver más abajo.
//
//  ── EL FALLO QUE HAY QUE VER: LA PANTALLA MUDA ─────────────────────────────
//
//  Los navegadores **no dejan sonar** a una página en la que nadie ha tocado nada (política
//  de autoplay). Y no avisan: `new AudioContext()` **no lanza ninguna excepción** — devuelve
//  un contexto `suspended`, y todo lo que suene después no suena. En silencio.
//
//  El caso real: una pantalla de **cocina**, colgada de la pared encima del pase. Arranca
//  sola por la mañana. **Nadie la toca nunca** —nadie toca una pantalla de cocina con las
//  manos llenas de aceite—, así que el audio se queda bloqueado **para siempre** y el
//  cocinero **no oye ni una comanda** en todo el servicio.
//
//  Por eso esta puerta expone **`estaMudo()`**: para que la pantalla pueda **decirlo**.
//  Grande, y sin quitarse hasta que alguien la toque. Una cocina muda que no avisa de que
//  está muda es peor que una cocina sin sonido.
// ─────────────────────────────────────────────────────────────────────────────

import { play, setEnabled } from "cuelume";

/** Contexto propio: el de cuelume no se puede consultar, y hay que saber si está bloqueado. */
let ctx: AudioContext | null = null;
let activado = true;

const hayNavegador = () => typeof window !== "undefined" && "AudioContext" in window;

/**
 * ¿Está la pantalla MUDA ahora mismo?
 *
 * `true` = el navegador no deja sonar porque nadie ha tocado nada. **Hay que decirlo en
 * pantalla**, no tragárselo.
 */
export function estaMudo(): boolean {
  if (!activado || !hayNavegador()) return false;   // apagado a propósito no es "mudo"
  return ctx === null || ctx.state !== "running";
}

/**
 * Desbloquea el audio. **Sólo funciona DENTRO de un gesto del usuario** (un toque, un clic).
 * Llamarlo al arrancar la pantalla no sirve de nada — de ahí que las pantallas lo enganchen
 * al primer `pointerdown`.
 */
export async function desbloquear(): Promise<boolean> {
  if (!hayNavegador()) return false;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** El interruptor de la pantalla (la config del módulo ya tenía uno). */
export function activarSonido(si: boolean): void {
  activado = si;
  setEnabled(si);
}

const suena = (nombre: Parameters<typeof play>[0]) => {
  if (!activado || estaMudo()) return;
  void play(nombre);
};

// ── Lo que suena en un bar, y sólo esto ──────────────────────────────────────
//
// Cuelume trae diez sonidos. Aquí se usan cinco, con el nombre de LO QUE PASA y no de cómo
// suena: el día que se cambie de librería, las pantallas no se enteran.

/** Ha entrado una unidad en la comanda. Corto y seco: se pican veinte seguidas. */
export const tap = () => suena("press");

/** Se ha quitado una línea, se ha cerrado un panel. */
export const quitar = () => suena("droplet");

/** Cobrado. Es el único que el camarero **espera oír**: le dice que ya puede soltar la mesa. */
export const exito = () => suena("success");

/** Algo ha fallado y hay que mirar la pantalla. Distinto a propósito. */
export const error = () => suena("toggle");

/** Un panel que se abre. */
export const abrir = () => suena("bloom");

// ── Y el aviso de COCINA, que NO es de cuelume ───────────────────────────────
//
// La paleta de cuelume está pensada para una web bonita: campanillas suaves, susurros. En una
// cocina hay una campana extractora, una freidora y tres personas gritando. Ahí eso no se oye.
//
// Este son **dos tonos seguidos** (880 → 1320 Hz), más alto y con dos golpes: una secuencia
// se distingue del ruido de fondo mucho mejor que un pitido suelto.
export function avisoCocina(): void {
  if (!activado || !ctx || ctx.state !== "running") return;

  const tono = (frecuencia: number, retraso: number) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = frecuencia;

    const t0 = ctx!.currentTime + retraso;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);

    osc.connect(gain).connect(ctx!.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  };

  tono(880, 0);
  tono(1320, 0.18);
}
