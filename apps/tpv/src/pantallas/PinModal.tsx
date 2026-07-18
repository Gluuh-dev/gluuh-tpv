import { useEffect, useRef, useState, type ReactNode } from "react";
import { Delete, Lock, Nfc, X } from "lucide-react";
import { ETIQUETA_ROL, type Rol } from "../nav";

const LARGO = 4;

// Puerta de acceso por apartado. DOS vías, y ninguna se cachea (se pide CADA vez):
//  • PIN de trabajador (teclado en pantalla o físico).
//  • Pulsera / tarjeta: al acercarla se entra DIRECTO, sin teclear quién eres.
// El nodo valida la credencial Y el ROL (`requiere`): p. ej. Configuración exige
// administrador; Visor Node, técnico. `onValidar` es el enganche del PIN y
// `onOk` el del lector de pulsera; en demo el PIN de 4 dígitos y la pulsera
// conceden acceso para enseñar el flujo.
//
// REGLA del TPV (táctil): sin `hover`; solo animación al pulsar (`active:`).
export function PinModal({
  titulo, icono, color, requiere, onOk, onCancelar, onValidar,
}: Readonly<{
  titulo: string;
  icono: ReactNode;
  color: string;
  requiere: Rol;
  onOk: () => void;
  onCancelar: () => void;
  onValidar?: (pin: string, requiere: Rol) => Promise<boolean> | boolean;
}>) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const okRef = useRef(onOk);
  okRef.current = onOk;

  async function comprobar(valor: string) {
    setVerificando(true);
    // ponytail: demo acepta cualquier PIN de 4 dígitos; el nodo pondrá el filtro real (PIN + rol).
    const ok = onValidar ? await onValidar(valor, requiere) : valor.length === LARGO;
    setVerificando(false);
    if (ok) { okRef.current(); return; }
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onCancelar(); return; }
      if (e.key === "Backspace") { setError(false); setPin((p) => p.slice(0, -1)); return; }
      if (/\d/.test(e.key) && e.key.length === 1) pulsa(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  const tecla = "rounded-2xl border border-line bg-paper/5 py-4 font-display text-2xl font-semibold tabular-nums text-paper transition-transform active:scale-90 active:bg-paper/10 disabled:opacity-50";

  return (
    <div className="gl-velo fixed inset-0 z-50 grid place-items-center bg-[#0a040e]/72 p-4 backdrop-blur-md" onClick={onCancelar}>
      <div className="gl-aparecer w-full max-w-sm rounded-3xl border border-line bg-linear-165 from-panel to-ink-2 p-7 text-paper shadow-md" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onCancelar} aria-label="Cerrar" className="float-right -mr-1 -mt-1 rounded-lg p-1.5 text-muted transition-transform active:scale-90"><X size={18} /></button>

        <div className="flex flex-col items-center text-center">
          <span className="escudo grid h-14 w-14 place-items-center text-white" style={{ background: color }}>{icono}</span>
          <h2 className="mt-4 flex items-center gap-2 font-display text-lg font-bold"><Lock size={16} className="text-muted" /> Acceso a {titulo}</h2>
          <p className="mt-1 text-sm text-muted">
            {requiere === "operario"
              ? "Introduce tu PIN o acerca tu pulsera."
              : `Requiere PIN de ${ETIQUETA_ROL[requiere]}, o su pulsera.`}
          </p>

          <div className="mt-6 flex gap-3">
            {Array.from({ length: LARGO }).map((_, i) => {
              let clase = "border-paper/30";
              if (error) clase = "border-danger bg-danger/40";
              else if (i < pin.length) clase = "border-brand-lit bg-brand-lit";
              return <span key={`p${i}`} className={`h-3.5 w-3.5 rounded-full border transition-colors ${clase}`} />;
            })}
          </div>
          <p className={`mt-2 h-5 text-sm font-medium ${error ? "text-danger" : "text-transparent"}`}>PIN incorrecto o sin acceso</p>
        </div>

        <div className="mt-1 grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => pulsa(d)} disabled={verificando} className={tecla}>{d}</button>
          ))}
          <button type="button" onClick={onCancelar} className="rounded-2xl border border-line bg-paper/5 py-4 text-sm font-semibold text-muted transition-transform active:scale-90">Cancelar</button>
          <button type="button" onClick={() => pulsa("0")} disabled={verificando} className={tecla}>0</button>
          <button type="button" onClick={() => { setError(false); setPin((p) => p.slice(0, -1)); }} disabled={verificando} aria-label="Borrar"
            className="grid place-items-center rounded-2xl border border-line bg-paper/5 py-4 text-paper transition-transform active:scale-90 disabled:opacity-50">
            <Delete size={22} />
          </button>
        </div>

        {/* Vía pulsera / tarjeta: al acercarla, acceso directo. El lector real (nodo)
            llamará a onOk; aquí el botón lo simula para ver el flujo. */}
        <button type="button" onClick={onOk}
          className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
          <Nfc size={18} /> Acerca tu pulsera o tarjeta
        </button>
      </div>
    </div>
  );
}
