import { eur } from "../../../lib/dinero";
import { useVenta } from "../store";

function Grupo({ label, children, grande }: Readonly<{ label: string; children: React.ReactNode; grande?: boolean }>) {
  return (
    <div className={grande ? "ml-auto text-right" : ""}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tabular-nums text-foreground ${grande ? "text-3xl font-bold leading-none" : "text-sm font-semibold"}`}>{children}</p>
    </div>
  );
}

export function BarraTotales() {
  const total = useVenta((s) => s.total());
  const unidades = useVenta((s) => s.unidades());
  const articulos = useVenta((s) => Object.keys(s.comanda).length);
  const editando = useVenta((s) => s.editando);
  const modo = useVenta((s) => s.modo);

  return (
    <div className="relative flex flex-none items-center gap-4 border-t border-border px-3 py-2">
      {editando && (
        <span className="absolute -top-6 left-3 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
          Editando {modo} — teclea y pulsa el modo para aplicar
        </span>
      )}
      <Grupo label="Uds.">{unidades}</Grupo>
      <Grupo label="Artículos">{articulos}</Grupo>
      <Grupo label="Total" grande>{eur(total)}</Grupo>
    </div>
  );
}
