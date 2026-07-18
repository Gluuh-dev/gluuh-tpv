import { Nfc } from "lucide-react";
import { ETIQUETA_ROL } from "../../lib/nav";
import { iniciales, type Usuario } from "./tipos";

// Elegir "quién eres" antes de meter el PIN — o pasar la pulsera/tarjeta y entrar
// directo sin elegir. Reglas del TPV: sin hover, animación al pulsar.
export function ListaUsuarios({
  usuarios, onElegir, onPulsera,
}: Readonly<{ usuarios: Usuario[]; onElegir: (u: Usuario) => void; onPulsera: () => void }>) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {usuarios.map((u) => (
          <button key={u.id} type="button" onClick={() => onElegir(u)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-paper/5 p-3 text-left transition-transform active:scale-95">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: u.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
              {iniciales(u.nombre)}
            </span>
            <span className="min-w-0">
              <b className="block truncate text-sm font-semibold text-paper">{u.nombre}</b>
              <small className="text-[12px] capitalize text-muted">{ETIQUETA_ROL[u.rol]}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onPulsera}
        className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
        <Nfc size={18} /> …o acerca tu pulsera o tarjeta
      </button>
    </div>
  );
}
