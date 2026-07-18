import { Delete, CreditCard } from "lucide-react";
import { eur } from "../../../lib/dinero";
import { useVenta, type ModoTeclado } from "../store";

const MODOS: ReadonlyArray<{ m: ModoTeclado; label: string }> = [
  { m: "UND", label: "Und." },
  { m: "PREC", label: "Precio" },
  { m: "DTO%", label: "DTO%" },
  { m: "DTO€", label: "DTO€" },
];
const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Teclado del TPV: dígitos (activos solo en un modo), columna de modos
// (Und/Precio/DTO), ← borrar, y COBRAR (naranja, acción de dinero). Al pulsar el
// modo activo con buffer, aplica a la línea seleccionada.
export function Teclado({ onCobrar }: Readonly<{ onCobrar: () => void }>) {
  const modo = useVenta((s) => s.modo);
  const editando = useVenta((s) => s.editando);
  const buffer = useVenta((s) => s.buffer);
  const pulsarDigito = useVenta((s) => s.pulsarDigito);
  const pulsarModo = useVenta((s) => s.pulsarModo);
  const aplicar = useVenta((s) => s.aplicar);
  const borrar = useVenta((s) => s.borrar);
  const limpiar = useVenta((s) => s.limpiar);
  const unidades = useVenta((s) => s.unidades());
  const total = useVenta((s) => s.total());

  const onModo = (m: ModoTeclado) => (m === modo && editando && buffer ? aplicar() : pulsarModo(m));
  const digito = "min-h-[62px] rounded-[10px] border border-border bg-surface-overlay text-[1.55rem] font-semibold tabular-nums text-foreground transition-transform active:scale-95 disabled:opacity-40";

  return (
    <div className="flex flex-none gap-[.55rem] p-2">
      {/* Dígitos */}
      <div className="grid flex-1 grid-cols-3 gap-[.55rem]">
        {DIGITOS.map((d) => <button key={d} type="button" disabled={!editando} onClick={() => pulsarDigito(d)} className={digito}>{d}</button>)}
        <button type="button" disabled={!editando} onClick={() => pulsarDigito(",")} className={digito}>,</button>
        <button type="button" disabled={!editando} onClick={() => pulsarDigito("0")} className={digito}>0</button>
        <button type="button" disabled={!editando} onClick={limpiar} className={digito}>C</button>
      </div>

      {/* Modos */}
      <div className="flex w-[4.7rem] flex-col gap-[.4rem]">
        {MODOS.map(({ m, label }) => {
          const act = m === modo && editando;
          return (
            <button key={m} type="button" onClick={() => onModo(m)}
              className={`flex-1 rounded-[10px] border text-xs font-bold transition-transform active:scale-95 ${act ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-overlay text-foreground"}`}>
              {label}
            </button>
          );
        })}
        <button type="button" onClick={borrar} aria-label="Borrar" className="grid flex-1 place-items-center rounded-[10px] border border-border bg-surface-overlay text-foreground transition-transform active:scale-95"><Delete size={20} /></button>
      </div>

      {/* Cobrar */}
      <button type="button" onClick={onCobrar} disabled={unidades <= 0}
        className="flex w-24 flex-col items-center justify-center gap-1 rounded-[10px] border border-cobro-lit bg-cobro font-bold text-white transition-transform active:scale-95 disabled:opacity-40">
        <CreditCard size={24} />
        <span className="text-sm">Cobrar</span>
        {total > 0 && <span className="text-xs tabular-nums opacity-90">{eur(total)}</span>}
      </button>
    </div>
  );
}
