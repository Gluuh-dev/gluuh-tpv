import { useEffect, useRef, useState } from "react";
import { type LucideIcon } from "lucide-react";
import { Modal, CabeceraModal, TecladoNumerico } from "../../ui";
import { ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { ListaUsuarios } from "./ListaUsuarios";
import type { Usuario } from "./tipos";

const LARGO = 4;

// PUERTA DE CREDENCIAL reutilizable, TÁCTIL y de una sola vista: la gente a la
// izquierda y el teclado del PIN a la derecha, a la vista a la vez (sin pasos).
// Elegir quién eres es opcional (y se des-elige tocando otra vez): la validación
// REAL es el PIN — el nodo dice quién eres y su rol; si elegiste a alguien, debe
// ser él. Quien no llega al rol de la puerta sale con candado. Nada se cachea:
// se pide CADA vez. `demo` marca el equipo de ejemplo (terminal sin emparejar)
// y habilita la pulsera simulada; sin demo la pulsera se oculta hasta que haya
// lector. Sin `usuarios`, queda solo el teclado (modal estrecho).
export function CredencialModal({
  titulo, Icono, requiere, usuarios, demo, onOk, onCancelar, onValidar,
}: Readonly<{
  titulo: string;
  Icono: LucideIcon;
  requiere: Rol;
  usuarios?: Usuario[];
  /** El equipo enseñado es de ejemplo (sin emparejar): avisa y simula pulsera. */
  demo?: boolean;
  onOk: (usuario?: Usuario) => void;
  onCancelar: () => void;
  onValidar?: (pin: string, ctx: { usuario?: Usuario; requiere: Rol }) => Promise<boolean> | boolean;
}>) {
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const conGente = !!usuarios?.length;

  const okRef = useRef(onOk);
  okRef.current = onOk;

  async function comprobar(valor: string) {
    setVerificando(true);
    // ponytail: demo acepta cualquier PIN de 4 dígitos; el nodo pone el filtro real (PIN + rol).
    const ok = onValidar ? await onValidar(valor, { usuario: elegido ?? undefined, requiere }) : valor.length === LARGO;
    setVerificando(false);
    if (ok) { okRef.current(elegido ?? undefined); return; }
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

  function elegir(u: Usuario) {
    setElegido((prev) => (prev?.id === u.id ? null : u));
    setPin("");
    setError(false);
  }

  // Teclado físico (por si el terminal tiene uno; el táctil es el protagonista).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { setError(false); setPin((p) => p.slice(0, -1)); return; }
      if (/\d/.test(e.key) && e.key.length === 1) pulsa(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  const exige = requiere === "operario" ? "" : `Requiere ${ETIQUETA_ROL[requiere]} · `;
  const sub = exige + "PIN o pulsera";

  return (
    <Modal onCerrar={onCancelar} ancho={conGente ? "2xl" : "sm"} className="overflow-hidden">
      <CabeceraModal Icono={Icono} titulo={`Acceso a ${titulo}`} subtitulo={sub} onCerrar={onCancelar} />

      <div className="p-6">
        {demo && (
          <p className="mb-4 inline-block rounded-full border border-amber/40 bg-amber/10 px-2.5 py-1 text-[11px] font-semibold text-paper">
            Equipo de ejemplo — terminal sin emparejar
          </p>
        )}

        <div className={conGente ? "flex items-start gap-6" : ""}>
          {conGente && (
            <div className="min-w-0 flex-1">
              <p className="pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted">¿Quién eres?</p>
              <ListaUsuarios
                usuarios={usuarios!}
                requiere={requiere}
                elegido={elegido}
                onElegir={elegir}
                onPulsera={demo ? () => onOk() : undefined}
              />
            </div>
          )}

          <div className={conGente ? "w-60 flex-none" : "mx-auto w-full max-w-xs"}>
            <p className="pb-2 text-center text-[13px] font-semibold text-paper/85">
              {elegido ? `PIN de ${elegido.nombre}` : "Marca tu PIN"}
            </p>
            <div className="flex justify-center gap-3">
              {Array.from({ length: LARGO }).map((_, i) => {
                let clase = "border-paper/30";
                if (error) clase = "border-danger bg-danger/40";
                else if (i < pin.length) clase = "border-brand-lit bg-brand-lit";
                return <span key={`p${i}`} className={`h-3.5 w-3.5 rounded-full border transition-colors ${clase}`} />;
              })}
            </div>
            <p className={`mb-1 mt-1.5 text-center text-sm font-medium ${error ? "text-danger" : "text-transparent"}`}>PIN incorrecto o sin acceso</p>

            <TecladoNumerico
              onDigito={pulsa}
              onBorrar={() => { setError(false); setPin((p) => p.slice(0, -1)); }}
              deshabilitado={verificando}
              botonIzquierda={
                <button type="button" onClick={onCancelar}
                  className="rounded-2xl border border-line bg-paper/5 py-4 text-sm font-semibold text-muted transition-transform active:scale-90">
                  Cancelar
                </button>
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
