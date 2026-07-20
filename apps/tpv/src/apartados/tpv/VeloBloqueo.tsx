import { useEffect, useRef, useState } from "react";
import { Lock, Nfc } from "lucide-react";
import { Modal, TecladoNumerico } from "../../ui";
import { ListaUsuarios } from "../acceso/ListaUsuarios";
import { iniciales, type Usuario } from "../acceso/tipos";
import type { Operario } from "./sesion";

const LARGO = 4;
const PUNTOS = ["p0", "p1", "p2", "p3"];

// EL VELO. No es un login: es la pantalla bloqueada que tapa el TPV pero deja la
// cuenta VIVA debajo. Diferencias con la puerta de apartados (`CredencialModal`),
// que es por qué no se reusa entero:
//   · NO se puede cancelar ni cerrar tocando fuera — si se cerrara sin PIN, no
//     bloquearía nada (`cerrarFuera={false}`, sin botón Cancelar).
//   · El resultado es QUIÉN entra, no un sí/no: si mete PIN otro camarero, releva
//     al que estaba con la mesa abierta (cambio de turno sin cerrar la cuenta).
//   · No exige rol: cualquier trabajador desbloquea a su nombre.
// Se reusan las piezas gordas (TecladoNumerico, ListaUsuarios), no el envoltorio.
export function VeloBloqueo({
  bloqueadoPor, usuarios, demo, onEntra, onSalir, validarPin,
}: Readonly<{
  /** Quién estaba cuando cayó el velo. null = ARRANQUE (nadie aún: «identifícate»). */
  bloqueadoPor: Operario | null;
  /** El equipo del terminal, para elegir cara antes del PIN (UX; el PIN manda). */
  usuarios: Usuario[];
  /** Equipo de ejemplo (sin emparejar): acepta cualquier PIN de 4 y simula pulsera. */
  demo?: boolean;
  /** El PIN validó: entra este operario (empieza turno, sigue, o releva). */
  onEntra: (quien: Operario) => void;
  /** Salir sin entrar: vuelve al Inicio (no deja el TPV abierto sin PIN). */
  onSalir: () => void;
  /** Identifica por PIN contra el nodo. En demo no se llama. */
  validarPin?: (pin: string) => Promise<Usuario | null>;
}>) {
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const okRef = useRef(onEntra);
  okRef.current = onEntra;
  const arranque = bloqueadoPor === null;

  async function comprobar(valor: string) {
    setVerificando(true);
    // En demo, el PIN de 4 basta y «quién entra» es la cara elegida o quien estaba
    // (nunca inventa identidad). En real manda `validarPin`: el nodo dice quién es.
    let quien: Operario | null = null;
    if (demo) quien = valor.length === LARGO ? (elegido ?? bloqueadoPor ?? usuarios[0] ?? null) : null;
    else {
      const u = validarPin ? await validarPin(valor) : null;
      // Si se eligió cara, el PIN tiene que ser el de esa persona (no vale el de otro).
      quien = u && (!elegido || elegido.id === u.id) ? u : null;
    }
    setVerificando(false);
    if (quien) { okRef.current(quien); return; }
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
  function borra() { setError(false); setPin((p) => p.slice(0, -1)); }
  function elegir(u: Usuario) { setElegido((prev) => (prev?.id === u.id ? null : u)); setPin(""); setError(false); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { borra(); return; }
      if (/\d/.test(e.key) && e.key.length === 1) pulsa(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando]);

  const LABEL = "text-[11px] font-semibold uppercase tracking-[.14em]";
  const foco = elegido ?? bloqueadoPor;   // a quién apunta el rótulo del PIN
  let rotuloPin = "Tu PIN";
  if (error) rotuloPin = "PIN incorrecto";
  else if (foco) rotuloPin = `PIN · ${foco.nombre.split(" ")[0]}`;

  const puntos = (
    <div className="flex gap-2">
      {PUNTOS.map((k, i) => {
        let clase = "border-paper/30";
        if (error) clase = "border-danger bg-danger/40";
        else if (i < pin.length) clase = "border-brand-lit bg-brand-lit";
        return <span key={k} className={`h-3 w-3 rounded-full border transition-colors ${clase}`} />;
      })}
    </div>
  );

  const pulsera = demo ? (
    <button type="button" onClick={() => onEntra(elegido ?? bloqueadoPor ?? usuarios[0]!)}
      className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
      <Nfc size={18} /> …o acerca tu pulsera o tarjeta
    </button>
  ) : null;

  return (
    <Modal onCerrar={() => { /* el velo no se cierra sin PIN */ }} cerrarFuera={false} ancho="2xl" className="overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line bg-surface-2 px-6 py-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white"><Lock size={20} /></span>
        <div>
          <b className="block font-display text-[16px] font-bold leading-tight">
            {arranque ? "Identifícate para empezar" : "Terminal bloqueado"}
          </b>
          <small className="text-muted">
            {arranque ? "Entra con tu PIN o pulsera para abrir el turno" : "Cuenta a salvo · entra con tu PIN o pulsera para seguir"}
          </small>
        </div>
      </header>

      {demo && (
        <p className="border-b border-amber/30 bg-amber/10 px-6 py-2 text-[12px] font-semibold text-paper">
          Equipo de ejemplo — terminal sin emparejar
        </p>
      )}

      <div className="flex items-stretch gap-6 px-6 pt-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-7 flex-none items-center">
            <p className={`${LABEL} text-muted`}>{arranque ? "¿Quién eres?" : "¿Quién sigue?"}</p>
          </div>
          <ListaUsuarios usuarios={usuarios} requiere="operario" elegido={elegido} onElegir={elegir} />
        </div>

        <div className="flex w-60 flex-none flex-col">
          <div className="flex h-7 flex-none items-center justify-between gap-2">
            <p className={`truncate ${LABEL} ${error ? "text-danger" : "text-muted"}`}>{rotuloPin}</p>
            {puntos}
          </div>
          <TecladoNumerico
            onDigito={pulsa} onBorrar={borra} deshabilitado={verificando}
            botonIzquierda={
              // «Salir» = fin de turno (a dormido), NO un cancelar que devuelve el
              // TPV sin PIN. La única salida del velo aparte del PIN.
              <button type="button" onClick={onSalir}
                className="rounded-2xl border border-line bg-paper/5 py-4 text-sm font-semibold text-muted transition-transform active:scale-90">
                Salir
              </button>
            }
          />
        </div>
      </div>

      {pulsera && <div className="px-6 pb-6 pt-4">{pulsera}</div>}

      {/* Recordatorio de quién estaba: en un relevo, quien mira sabe a quién sustituye.
          En el arranque no hay nadie a quien sustituir, así que no se pinta. */}
      {bloqueadoPor && (
        <div className="flex items-center gap-2 border-t border-line px-6 py-2.5 text-[12px] text-muted">
          <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ background: bloqueadoPor.rol === "admin" ? "linear-gradient(150deg,var(--brand-lit),var(--brand))" : "var(--brand)" }}>
            {iniciales(bloqueadoPor.nombre)}
          </span>
          Bloqueado por <b className="font-semibold text-paper">{bloqueadoPor.nombre}</b>
        </div>
      )}
    </Modal>
  );
}
