import { Gift } from "lucide-react";
import { eur } from "../../../lib/dinero";
import { PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";

const nombreDe = (id: string) => PRODUCTOS_DEMO.find((p) => p.id === id.split("|")[0])?.nombre ?? "Producto";

// Recuadro verde del buffer que se está tecleando sobre la línea seleccionada.
function Buffer({ valor }: { valor: string }) {
  return <span className="ml-auto inline-block rounded-md bg-brand px-1.5 py-0.5 text-brand-foreground tabular-nums">{valor || "·"}</span>;
}

// El TICKET: cabecera de columnas + líneas de la comanda. Tocar una línea la
// selecciona (borde cian); el teclado numérico actúa sobre la seleccionada.
export function Ticket() {
  const comanda = useVenta((s) => s.comanda);
  const lineaSel = useVenta((s) => s.lineaSel);
  const invitadas = useVenta((s) => s.invitadas);
  const descuentos = useVenta((s) => s.descuentos);
  const precios = useVenta((s) => s.precios);
  const seleccionar = useVenta((s) => s.seleccionar);
  const precioEfectivo = useVenta((s) => s.precioEfectivo);
  const buffer = useVenta((s) => s.buffer);
  const modo = useVenta((s) => s.modo);
  const editando = useVenta((s) => s.editando);

  const ids = Object.keys(comanda);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid flex-none grid-cols-[1fr_2.4rem_4.2rem_4.8rem] gap-1 border-b border-border bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Producto</span><span className="text-center">Uds</span><span className="text-right">Precio</span><span className="text-right">Total</span>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-auto py-1">
        {ids.length === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">Toca un producto para empezar la comanda.</p>}
        {ids.map((id) => {
          const q = comanda[id]!;
          const sel = id === lineaSel;
          const inv = !!invitadas[id];
          const desc = descuentos[id];
          const manual = precios[id] != null;
          const editandoEsta = sel && editando;
          return (
            <button key={id} type="button" onClick={() => seleccionar(id)}
              className={`grid w-full grid-cols-[1fr_2.4rem_4.2rem_4.8rem] items-center gap-1 border-l-[3px] px-3 py-2 text-left text-xs ${sel ? "border-foreground/40 bg-surface-muted text-foreground" : "border-transparent"}`}>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate font-bold text-foreground">{nombreDe(id)}</span>
                {inv && <span className="inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-success"><Gift size={9} /> Invitado</span>}
                {manual && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground tabular-nums">P:{eur(precios[id]!)}</span>}
                {desc && <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand tabular-nums">{desc.tipo === "PCT" ? `-${desc.valor}%` : `-${eur(desc.valor)}`}</span>}
              </span>
              <span className="text-center font-semibold tabular-nums text-foreground">
                {editandoEsta && modo === "UND" ? <Buffer valor={buffer} /> : q}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {editandoEsta && modo === "PREC" ? <Buffer valor={buffer} /> : eur(precioEfectivo(id))}
              </span>
              <span className={`text-right font-semibold tabular-nums ${inv ? "text-success" : "text-foreground"}`}>
                {inv ? "Inv." : eur(precioEfectivo(id) * q)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
