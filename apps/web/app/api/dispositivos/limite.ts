// Cortafuegos anti fuerza bruta del emparejado por código de 6 dígitos:
// ventana fija de 1 minuto por IP, en memoria (sin BD, sin dependencias).
// ponytail: en despliegue serverless multi-instancia este Map es por instancia —
// suficiente como fricción anti fuerza bruta del código de 6 dígitos; se
// endurecerá con contador en BD si hace falta.

const VENTANA_MS = 60_000;
const ventanas = new Map<string, { n: number; desde: number }>();

/** true si `clave` (p. ej. "canjear:1.2.3.4") supera `max` peticiones/minuto. */
export function excedeLimite(clave: string, max: number): boolean {
  const ahora = Date.now();
  // Poda perezosa para que el Map no crezca sin límite en procesos longevos.
  if (ventanas.size > 5000) {
    for (const [k, v] of ventanas) if (ahora - v.desde > VENTANA_MS) ventanas.delete(k);
  }
  const v = ventanas.get(clave);
  if (!v || ahora - v.desde > VENTANA_MS) {
    ventanas.set(clave, { n: 1, desde: ahora });
    return false;
  }
  v.n += 1;
  return v.n > max;
}

/** IP del cliente: primer salto de x-forwarded-for (Vercel/proxies lo rellenan). */
export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}
