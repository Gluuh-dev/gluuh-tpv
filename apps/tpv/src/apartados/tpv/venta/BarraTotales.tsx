import { eur } from "../../../lib/dinero";
import { useVenta } from "../store";

function Grupo({ label, children, activo, grande }: Readonly<{ label: string; children: React.ReactNode; activo?: boolean; grande?: boolean }>) {
  return (
    <div className={grande ? "ml-auto text-right" : ""}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${activo ? "text-brand" : "text-muted-foreground"}`}>{label}</p>
      <p className={`tabular-nums ${grande ? "text-3xl font-bold leading-none text-foreground" : `text-sm font-semibold ${activo ? "text-brand" : "text-foreground"}`}`}>{children}</p>
    </div>
  );
}

// Barra de totales: unidades y precio/descuento de la LÍNEA seleccionada (el
// segundo grupo cambia de etiqueta según el modo del teclado), + artículos + total.
export function BarraTotales() {
  const total = useVenta((s) => s.total());
  const articulos = useVenta((s) => s.unidades());
  const lineaSel = useVenta((s) => s.lineaSel);
  const qtySel = useVenta((s) => (s.lineaSel ? (s.comanda[s.lineaSel] ?? 0) : 0));
  const precioSel = useVenta((s) => s.precioEfectivo(s.lineaSel ?? ""));
  const desc = useVenta((s) => s.descSel());
  const modo = useVenta((s) => s.modo);
  const editando = useVenta((s) => s.editando);

  const labelPrecio = modo === "DTO%" ? "DTO %" : modo === "DTO€" ? "DTO €" : "Precio";
  let valorPrecio: React.ReactNode = lineaSel ? eur(precioSel) : "—";
  if (lineaSel && desc) valorPrecio = desc.tipo === "PCT" ? `-${desc.valor}%` : `-${eur(desc.valor)}`;

  return (
    <div className="flex flex-none items-center gap-4 border-t border-border px-3 py-2">
      <Grupo label="Uds." activo={editando && modo === "UND"}>{lineaSel ? qtySel : "—"}</Grupo>
      <Grupo label={labelPrecio} activo={editando && modo !== "UND"}>{valorPrecio}</Grupo>
      <Grupo label="Artículos">{articulos}</Grupo>
      <Grupo label="Total" grande>{eur(total)}</Grupo>
    </div>
  );
}
