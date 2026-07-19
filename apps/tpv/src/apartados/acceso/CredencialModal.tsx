import { useEffect, useRef, useState } from "react";
import { Nfc, ArrowLeft, type LucideIcon } from "lucide-react";
import { Modal, CabeceraModal, TecladoNumerico } from "../../ui";
import { ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { ListaUsuarios } from "./ListaUsuarios";
import { iniciales, type Usuario } from "./tipos";

const LARGO = 4;
const PUNTOS = ["p0", "p1", "p2", "p3"]; // claves estables de los puntos del PIN

// Los tres modos de presentar la puerta (elige el que llame; la lógica es la misma):
//   • "pin"   → solo el teclado (el PIN identifica; no se elige persona).
//   • "lado"  → la gente y el teclado a la vez, uno al lado del otro.
//   • "pasos" → primero la gente; al pulsar un trabajador aparece el teclado,
//               en un modal de TAMAÑO FIJO (no salta al cambiar de vista).
export type ModoCredencial = "pin" | "lado" | "pasos";

// PUERTA DE CREDENCIAL reutilizable y TÁCTIL. Elegir quién eres es opcional: la
// validación REAL es el PIN — el nodo dice quién eres y su rol; si elegiste a
// alguien, debe ser él. Quien no llega al rol de la puerta sale con candado.
// Nada se cachea: se pide CADA vez. `demo` marca el equipo de ejemplo (terminal
// sin emparejar) y habilita la pulsera simulada; sin lista de gente, siempre es
// modo "pin".
export function CredencialModal({
  titulo, Icono, color, requiere, usuarios, demo, modo = "lado", onOk, onCancelar, onValidar,
}: Readonly<{
  titulo: string;
  Icono: LucideIcon;
  /** Fondo de la placa del icono (el color del apartado). */
  color: string;
  requiere: Rol;
  usuarios?: Usuario[];
  /** El equipo enseñado es de ejemplo (sin emparejar): avisa y simula pulsera. */
  demo?: boolean;
  modo?: ModoCredencial;
  onOk: (usuario?: Usuario) => void;
  onCancelar: () => void;
  onValidar?: (pin: string, ctx: { usuario?: Usuario; requiere: Rol }) => Promise<boolean> | boolean;
}>) {
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const conGente = !!usuarios?.length;
  const modoEf: ModoCredencial = conGente ? modo : "pin"; // sin gente solo cabe el PIN

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

  function borra() { setError(false); setPin((p) => p.slice(0, -1)); }
  function elegir(u: Usuario) { setElegido((prev) => (prev?.id === u.id ? null : u)); setPin(""); setError(false); }
  function volver() { setElegido(null); setPin(""); setError(false); }

  // Teclado físico (por si el terminal tiene uno; el táctil es el protagonista).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { borra(); return; }
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

  // ── Piezas compartidas por los tres modos ──
  const LABEL = "text-[11px] font-semibold uppercase tracking-[.14em]";

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

  const teclado = (
    <TecladoNumerico
      onDigito={pulsa}
      onBorrar={borra}
      deshabilitado={verificando}
      botonIzquierda={
        <button type="button" onClick={onCancelar}
          className="rounded-2xl border border-line bg-paper/5 py-4 text-sm font-semibold text-muted transition-transform active:scale-90">
          Cancelar
        </button>
      }
    />
  );

  const pulsera = demo ? (
    <button type="button" onClick={() => onOk(elegido ?? undefined)}
      className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
      <Nfc size={18} /> …o acerca tu pulsera o tarjeta
    </button>
  ) : null;

  // La placa del icono se vuelve una FLECHA ATRÁS pulsable cuando `atras` está
  // (en el paso del PIN del modo "pasos": vuelve a elegir trabajador).
  const cabecera = (atras?: () => void) =>
    <CabeceraModal Icono={atras ? ArrowLeft : Icono} titulo={`Acceso a ${titulo}`} subtitulo={sub} onCerrar={onCancelar} tono="suave" color={color} onIcono={atras} />;
  const banner = demo ? (
    <p className="border-b border-amber/30 bg-amber/10 px-6 py-2 text-[12px] font-semibold text-paper">
      Equipo de ejemplo — terminal sin emparejar
    </p>
  ) : null;

  // Cabecera del teclado (rótulo + puntos en la misma fila → las teclas arrancan
  // al nivel de las tarjetas, no empujadas por los puntos).
  const encabezadoPin = (
    <div className="flex h-7 flex-none items-center justify-between gap-2">
      <p className={`truncate ${LABEL} ${error ? "text-danger" : "text-muted"}`}>{etiquetaPin}</p>
      {puntos}
    </div>
  );

  // ── modo "pin": solo el teclado ──
  if (modoEf === "pin") {
    return (
      <Modal onCerrar={onCancelar} ancho="sm" className="overflow-hidden">
        {cabecera()}
        {banner}
        <div className="p-6">
          {encabezadoPin}
          <div className="pt-3">{teclado}</div>
        </div>
        {pulsera && <div className="px-6 pb-6">{pulsera}</div>}
      </Modal>
    );
  }

  // ── modo "pasos": gente → (al pulsar) teclado, en un modal de tamaño fijo ──
  if (modoEf === "pasos") {
    return (
      <Modal onCerrar={onCancelar} ancho="sm" className="flex h-160 flex-col overflow-hidden">
        {elegido ? cabecera(volver) : cabecera()}
        {banner}
        {elegido ? (
          <div key="pin" className="gl-aparecer flex min-h-0 flex-1 flex-col p-6">
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2">
              <span className="grid h-12 w-12 place-items-center rounded-full text-[15px] font-bold text-white"
                style={{ background: elegido.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                {iniciales(elegido.nombre)}
              </span>
              <div className="text-center">
                <b className="block font-display text-[16px] font-bold leading-tight">{elegido.nombre}</b>
                <small className="capitalize text-muted">{ETIQUETA_ROL[elegido.rol]}</small>
              </div>
              <div className="pt-0.5">{puntos}</div>
              <p className={`text-[12px] font-medium ${error ? "text-danger" : "text-transparent"}`}>PIN incorrecto</p>
            </div>
            {teclado}
          </div>
        ) : (
          <div key="gente" className="gl-aparecer flex min-h-0 flex-1 flex-col p-6">
            <p className={`flex-none pb-3 ${LABEL} text-muted`}>¿Quién eres?</p>
            <ListaUsuarios usuarios={usuarios!} requiere={requiere} elegido={null} onElegir={elegir} />
            {pulsera && <div className="flex-none pt-3">{pulsera}</div>}
          </div>
        )}
      </Modal>
    );
  }

  // ── modo "lado" (por defecto): la gente y el teclado a la vez ──
  return (
    <Modal onCerrar={onCancelar} ancho="2xl" className="overflow-hidden">
      {cabecera()}
      {banner}
      <div className={`flex items-stretch gap-6 px-6 pt-5 ${demo ? "" : "pb-6"}`}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-7 flex-none items-center">
            <p className={`${LABEL} text-muted`}>¿Quién eres?</p>
          </div>
          <ListaUsuarios usuarios={usuarios!} requiere={requiere} elegido={elegido} onElegir={elegir} />
        </div>

        <div className="flex w-60 flex-none flex-col">
          {encabezadoPin}
          {teclado}
        </div>
      </div>

      {/* Pulsera como pie a lo ancho: no descuadra las columnas. */}
      {pulsera && <div className="px-6 pb-6 pt-4">{pulsera}</div>}
    </Modal>
  );
}
