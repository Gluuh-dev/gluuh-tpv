import { Lock } from "lucide-react";
import { Desplazable } from "../../ui";
import { cumpleRol, ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { iniciales, type Usuario } from "./tipos";

// La gente del terminal, para tocar "quién eres" (opcional: tocar otra vez
// des-elige). Fichas COMPACTAS de tamaño fijo en una lista con scroll: da igual
// que haya 4 o 40, siempre se ven igual y las de más se desplazan. Quien no
// llega al rol exigido sale ATENUADO con candado. Reglas del TPV: sin hover,
// animación al pulsar. La pulsera vive en el pie del modal, no aquí.
export function ListaUsuarios({
  usuarios, requiere, elegido, onElegir,
}: Readonly<{
  usuarios: Usuario[];
  requiere: Rol;
  elegido?: Usuario | null;
  onElegir: (u: Usuario) => void;
}>) {
  return (
    <Desplazable className="grid auto-rows-min grid-cols-2 content-start gap-2.5">
      {usuarios.map((u) => {
        const puede = cumpleRol(u.rol, requiere);
        const activo = elegido?.id === u.id;
        return (
          <button key={u.id} type="button" disabled={!puede} onClick={() => onElegir(u)}
            className={`flex h-16 items-center gap-2.5 rounded-xl border px-3 text-left transition-transform ${
              activo ? "border-brand-lit bg-accent-soft" : "border-line bg-paper/5"
            } ${puede ? "active:scale-95" : "opacity-45"}`}>
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
              style={{ background: u.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
              {iniciales(u.nombre)}
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[13.5px] font-semibold text-paper">{u.nombre}</b>
              <small className="flex items-center gap-1 text-[11.5px] capitalize text-muted">
                {!puede && <Lock size={10} className="flex-none" />} {ETIQUETA_ROL[u.rol]}
              </small>
            </span>
          </button>
        );
      })}
    </Desplazable>
  );
}
