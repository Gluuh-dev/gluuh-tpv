import { Lock, Nfc } from "lucide-react";
import { cumpleRol, ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { iniciales, type Usuario } from "./tipos";

// Elegir "quién eres" antes de meter el PIN — o pasar la pulsera/tarjeta y entrar
// directo sin elegir (si hay lector). Quien no llega al rol exigido sale ATENUADO
// con candado: se ve que existe, se ve por qué no entra. Reglas del TPV: sin
// hover, animación al pulsar.
export function ListaUsuarios({
  usuarios, requiere, onElegir, onPulsera,
}: Readonly<{ usuarios: Usuario[]; requiere: Rol; onElegir: (u: Usuario) => void; onPulsera?: () => void }>) {
  return (
    <div>
      <div className="grid max-h-96 grid-cols-3 gap-3 overflow-y-auto">
        {usuarios.map((u) => {
          const puede = cumpleRol(u.rol, requiere);
          return (
            <button key={u.id} type="button" disabled={!puede} onClick={() => onElegir(u)}
              className={`flex items-center gap-3 rounded-2xl border border-line bg-paper/5 p-3.5 text-left transition-transform ${puede ? "active:scale-95" : "opacity-45"}`}>
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-[15px] font-bold text-white"
                style={{ background: u.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                {iniciales(u.nombre)}
              </span>
              <span className="min-w-0">
                <b className="block truncate text-sm font-semibold text-paper">{u.nombre}</b>
                <small className="flex items-center gap-1 text-[12px] capitalize text-muted">
                  {!puede && <Lock size={11} className="flex-none" />} {ETIQUETA_ROL[u.rol]}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      {onPulsera && (
        <button type="button" onClick={onPulsera}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
          <Nfc size={18} /> …o acerca tu pulsera o tarjeta
        </button>
      )}
    </div>
  );
}
