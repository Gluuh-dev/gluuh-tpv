import { calcularImpuestosIncluidos, formatImporte } from "@servio/core";

/**
 * Página de inicio (Server Component). Demuestra el uso compartido de @servio/core
 * en web: calcula el desglose de IGIC de un ticket de ejemplo (Canarias).
 * Es solo un esqueleto; el backoffice y el TPV reales se construyen aquí.
 */
export default function Home() {
  const impuestos = calcularImpuestosIncluidos(
    [
      { importe: 5.0, tipo: 7 },
      { importe: 14.0, tipo: 7 },
      { importe: 6.0, tipo: 15 },
    ],
    "CANARIAS",
  );

  return (
    <main style={{ padding: 32, maxWidth: 640 }}>
      <h1>Servio TPV</h1>
      <p>Esqueleto del backoffice / TPV web. Ver <code>docs/</code>.</p>
      <h2>Demo motor fiscal (Canarias · IGIC)</h2>
      <table>
        <thead>
          <tr><th align="left">Impuesto</th><th>Base</th><th>Cuota</th></tr>
        </thead>
        <tbody>
          {impuestos.desglose.map((d) => (
            <tr key={d.tipo}>
              <td>{impuestos.impuesto} {d.tipo}%</td>
              <td align="right">{formatImporte(d.base)} €</td>
              <td align="right">{formatImporte(d.cuota)} €</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><strong>Total: {formatImporte(impuestos.importeTotal)} €</strong></p>
    </main>
  );
}
