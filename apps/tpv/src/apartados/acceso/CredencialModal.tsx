import { useEffect, useRef, useState } from "react";
import { Nfc, type LucideIcon } from "lucide-react";
import { Modal, CabeceraModal, TecladoNumerico } from "../../ui";
import { ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { ListaUsuarios } from "./ListaUsuarios";
import type { Usuario } from "./tipos";

const LARGO = 4;
const PUNTOS = ["p0", "p1", "p2", "p3"]; // claves estables de los puntos del PIN

// PUERTA DE CREDENCIAL reutilizable, TÁCTIL y de una sola vista: la gente a la
// izquierda y el teclado del PIN a la derecha, a la vista a la vez (sin pasos).
// Elegir quién eres es opcional (y se des-elige tocando otra vez): la validación
// REAL es el PIN — el nodo dice quién eres y su rol; si elegiste a alguien, debe
// ser él. Quien no llega al rol de la puerta sale con candado. Nada se cachea:
// se pide CADA vez. `demo` marca el equipo de ejemplo (terminal sin emparejar)
// y habilita la pulsera simulada; sin demo la pulsera se oculta hasta que haya
// lector. Sin `usuarios`, queda solo el teclado (modal estrecho).
export function CredencialModal({
  titulo, Icono, color, requiere, usuarios, demo, onOk, onCancelar, onValidar,
}: Readonly<{
  titulo: string;
  Icono: LucideIcon;
  /** Fondo de la placa del icono (el color del apartado). */
  color: string;
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

  let etiquetaPin = "Tu PIN";
  if (error) etiquetaPin = "PIN incorrecto";
  else if (elegido) etiquetaPin = `PIN · ${elegido.nombre}`;

  return (
    <Modal onCerrar={onCancelar} ancho={conGente ? "2xl" : "sm"} className="overflow-hidden">
      <CabeceraModal Icono={Icono} titulo={`Acceso a ${titulo}`} subtitulo={sub} onCerrar={onCancelar} tono="suave" color={color} />

      {demo && (
        <p className="border-b border-amber/30 bg-amber/10 px-6 py-2 text-[12px] font-semibold text-paper">
          Equipo de ejemplo — terminal sin emparejar
        </p>
      )}

      <div className={`px-6 pt-5 ${demo ? "" : "pb-6"} ${conGente ? "flex items-stretch gap-6" : ""}`}>
        {conGente && (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-7 flex-none items-center">
              <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-muted">¿Quién eres?</p>
            </div>
            <ListaUsuarios usuarios={usuarios!} requiere={requiere} elegido={elegido} onElegir={elegir} />
          </div>
        )}

        <div className={conGente ? "flex w-60 flex-none flex-col" : "mx-auto w-full max-w-xs"}>
          {/* Rótulo + puntos del PIN en LA MISMA fila → las teclas arrancan al
              nivel de las tarjetas de la izquierda (no empujadas hacia abajo). */}
          <div className="flex h-7 flex-none items-center justify-between gap-2">
            <p className={`truncate text-[11px] font-semibold uppercase tracking-[.14em] ${error ? "text-danger" : "text-muted"}`}>
              {etiquetaPin}
            </p>
            <div className="flex flex-none gap-2">
              {PUNTOS.map((k, i) => {
                let clase = "border-paper/30";
                if (error) clase = "border-danger bg-danger/40";
                else if (i < pin.length) clase = "border-brand-lit bg-brand-lit";
                return <span key={k} className={`h-3 w-3 rounded-full border transition-colors ${clase}`} />;
              })}
            </div>
          </div>

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

      {/* Pulsera como pie a lo ancho: no descuadra las columnas (solo en demo;
          con lector real llegará por su propio camino). */}
      {demo && (
        <div className="px-6 pb-6 pt-4">
          <button type="button" onClick={() => onOk(elegido ?? undefined)}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
            <Nfc size={18} /> …o acerca tu pulsera o tarjeta
          </button>
        </div>
      )}
    </Modal>
  );
}
