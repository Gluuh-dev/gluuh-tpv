import { useEffect, useState, type ReactNode } from "react";
import { Delete, Lock, X } from "lucide-react";

const PENTA = "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)";
const LARGO = 4;

// Puerta de acceso por apartado: se pide el PIN del trabajador CADA VEZ que se
// entra (no se cachea). La validación real la hará el nodo (validar_pin_terminal
// + permiso del apartado); aquí `onValidar` es el punto de enganche. En el demo
// acepta cualquier PIN de 4 dígitos para enseñar el flujo.
export function PinModal({
  titulo, icono, color, onOk, onCancelar, onValidar,
}: {
  titulo: string;
  icono: ReactNode;
  color: string;
  onOk: () => void;
  onCancelar: () => void;
  /** Devuelve true si el PIN es válido y el trabajador tiene acceso al apartado. */
  onValidar?: (pin: string) => Promise<boolean> | boolean;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);

  async function comprobar(valor: string) {
    setVerificando(true);
    // ponytail: demo acepta cualquier PIN de 4 dígitos; el nodo pondrá el filtro real.
    const ok = onValidar ? await onValidar(valor) : valor.length === LARGO;
    setVerificando(false);
    if (ok) { onOk(); return; }
    setError(true);
    setPin("");
  }

  function pulsa(d: string) {
    if (verificando) return;
    setError(false);
    setPin((p) => {
      if (p.length >= LARGO) return p;
      const np = p + d;
      if (np.length === LARGO) void comprobar(np);
      return np;
    });
  }

  // Teclado físico: dígitos, borrar, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancelar(); return; }
      if (e.key === "Backspace") { setError(false); setPin((p) => p.slice(0, -1)); return; }
      if (/^[0-9]$/.test(e.key)) pulsa(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#15171f] p-7 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCancelar} aria-label="Cerrar" className="float-right -mr-1 -mt-1 rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><X size={18} /></button>

        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center text-white" style={{ background: color, clipPath: PENTA }}>{icono}</span>
          <h2 className="mt-4 flex items-center gap-2 text-lg font-bold"><Lock size={16} className="text-white/50" /> Acceso a {titulo}</h2>
          <p className="mt-1 text-sm text-white/40">Introduce tu PIN de trabajador para continuar.</p>

          {/* Puntos del PIN */}
          <div className="mt-6 flex gap-3">
            {Array.from({ length: LARGO }).map((_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                  error ? "border-[#cf5346] bg-[#cf5346]/40"
                    : i < pin.length ? "border-[#b57fd0] bg-[#b57fd0]" : "border-white/25"
                }`}
              />
            ))}
          </div>
          <p className={`mt-2 h-5 text-sm font-medium ${error ? "text-[#e07b6f]" : "text-transparent"}`}>PIN incorrecto o sin acceso</p>
        </div>

        {/* Teclado numérico */}
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => pulsa(d)} disabled={verificando}
              className="rounded-xl border border-white/10 bg-white/[.03] py-4 text-2xl font-semibold tabular-nums transition-colors hover:bg-white/[.09] active:scale-95 disabled:opacity-50">
              {d}
            </button>
          ))}
          <button type="button" onClick={onCancelar}
            className="rounded-xl border border-white/10 bg-white/[.03] py-4 text-sm font-semibold text-white/60 hover:bg-white/[.09]">
            Cancelar
          </button>
          <button type="button" onClick={() => pulsa("0")} disabled={verificando}
            className="rounded-xl border border-white/10 bg-white/[.03] py-4 text-2xl font-semibold tabular-nums hover:bg-white/[.09] active:scale-95 disabled:opacity-50">
            0
          </button>
          <button type="button" onClick={() => { setError(false); setPin((p) => p.slice(0, -1)); }} disabled={verificando} aria-label="Borrar"
            className="grid place-items-center rounded-xl border border-white/10 bg-white/[.03] py-4 hover:bg-white/[.09] disabled:opacity-50">
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
