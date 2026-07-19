import { eur } from "../../../lib/dinero";
import { useVenta } from "../store";

function Grupo({ label, children, activo, grande }: Readonly<{ label: string; children: React.ReactNode; activo?: boolean; grande?: boolean }>) {
  const valorColor = activo ? "text-brand" : "text-foreground";
  return (
    <div className={grande ? "ml-auto text-right" : ""}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${activo ? "text-brand" : "text-muted-foreground"}`}>{label}</p>
      <p className={grande ? "text-3xl font-bold leading-none tabular-nums text-foreground" : `text-sm font-semibold tabular-nums ${valorColor}`}>{children}</p>
    </div>
  );
}

// Barra de totales: unidades y precio (base) + descuento de la LÍNEA seleccionada;
// artículos y total. El grupo activo (según el modo del teclado) se resalta.
export function BarraTotales() {
  const total = useVenta((s) => s.total());
  const articulos = useVenta((s) => s.unidades());
  const lineaSel = useVenta((s) => s.lineaSel);
  const qtySel = useVenta((s) => (s.lineaSel ? (s.comanda[s.lineaSel] ?? 0) : 0));
  const precioBase = useVenta((s) => s.precioSel());
  const desc = useVenta((s) => s.descSel());
  const modo = useVenta((s) => s.modo);
  const editando = useVenta((s) => s.editando);

  const descTxt = desc ? (desc.tipo === "PCT" ? `-${desc.valor}%` : `-${eur(desc.valor)}`) : null;

  return (
    <div className="flex flex-none items-center gap-4 border-t border-border px-3 py-2">
      <Grupo label="Uds." activo={editando && modo === "UND"}>{lineaSel ? qtySel : "—"}</Grupo>

      <Grupo label="Precio" activo={editando && modo === "PREC"}>{lineaSel ? eur(precioBase) : "—"}</Grupo>

      {/* Descuento aparte, solo si lo hay (o si estás en un modo de descuento) */}
      {(descTxt || (editando && modo !== "UND" && modo !== "PREC")) && (
        <Grupo label={modo === "DTO€" ? "Dto €" : "Dto %"} activo={editando && (modo === "DTO%" || modo === "DTO€")}>{descTxt ?? "—"}</Grupo>
      )}

      <Grupo label="Artículos">{articulos}</Grupo>
      <Grupo label="Total" grande>{eur(total)}</Grupo>
    </div>
  );
}
