// Marcas de rendimiento con PRESUPUESTO (F7 del plan 21/24). Solo en desarrollo:
// si una interacción del TPV tarda más de lo que debería, lo dice en consola —
// para que una regresión de fluidez se vea al hacerla, no cuando un bar se queja.
// En producción todo esto es un no-op (funciones vacías, cero coste).

const DEV = process.env.NODE_ENV !== "production";

// ── Interacción → pintado ────────────────────────────────────────────────────
// El handler llama `marcar()` justo antes de disparar el cambio de estado; un
// `useEffect` que corre en CADA render llama `cerrarMarca()` tras pintar. La
// diferencia es la latencia real de "abrir modal" / "cambiar de vista".
let pendiente: { label: string; t0: number; presupuesto: number } | null = null;

export function marcar(label: string, presupuestoMs: number): void {
  if (DEV) pendiente = { label, t0: performance.now(), presupuesto: presupuestoMs };
}

export function cerrarMarca(): void {
  if (!DEV || !pendiente) return;
  const { label, t0, presupuesto } = pendiente;
  pendiente = null;
  const ms = Math.round(performance.now() - t0);
  if (ms > presupuesto) console.warn(`[tpv] ${label}: ${ms} ms (presupuesto ${presupuesto} ms) ⚠`);
  else console.info(`[tpv] ${label}: ${ms} ms`);
}

// ── Acción asíncrona (cobrar): mide de principio a fin ───────────────────────
// Devuelve la función de cierre; llámala en el `finally`.
export function medir(label: string, presupuestoMs: number): () => void {
  if (!DEV) return () => {};
  const t0 = performance.now();
  return () => {
    const ms = Math.round(performance.now() - t0);
    if (ms > presupuestoMs) console.warn(`[tpv] ${label}: ${ms} ms (presupuesto ${presupuestoMs} ms) ⚠`);
    else console.info(`[tpv] ${label}: ${ms} ms`);
  };
}
