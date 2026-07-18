// Formato de dinero en euros (es-ES). Único sitio para el formateo de importes.
export function eur(n: number): string {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}
