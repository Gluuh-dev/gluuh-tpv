import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Lock, Nfc, X } from "lucide-react";
import { Modal, Escudo, TecladoNumerico } from "../../ui";
import { ETIQUETA_ROL, type Rol } from "../../lib/nav";
import { ListaUsuarios } from "./ListaUsuarios";
import type { Usuario } from "./tipos";

const LARGO = 4;

// PUERTA DE CREDENCIAL reutilizable (se pide en muchos sitios). Tres formas de
// identificarse, según lo que reciba:
//   • `usuarios` con lista → primero eliges QUIÉN eres (o pasas la pulsera y
//     entras directo), luego metes tu PIN.
//   • sin `usuarios` → directo al PIN (o pulsera).
// Nada se cachea: se pide CADA vez. El nodo valida la credencial Y el rol
// (`requiere`): p. ej. Configuración exige administrador. `onValidar` es el
// enganche del PIN y `onOk` el del lector de pulsera; en demo el PIN de 4 dígitos
// y la pulsera conceden acceso para enseñar el flujo.
export function CredencialModal({
  titulo, icono, color, requiere, usuarios, onOk, onCancelar, onValidar,
}: Readonly<{
  titulo: string;
  icono: ReactNode;
  color: string;
  requiere: Rol;
  usuarios?: Usuario[];
  onOk: (usuario?: Usuario) => void;
  onCancelar: () => void;
  onValidar?: (pin: string, ctx: { usuario?: Usuario; requiere: Rol }) => Promise<boolean> | boolean;
}>) {
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [verificando, setVerificando] = useState(false);

  // Paso "elegir usuario" solo si hay lista y aún no se ha elegido.
  const pidiendoUsuario = !!usuarios?.length && !elegido;

  const okRef = useRef(onOk);
  okRef.current = onOk;

  async function comprobar(valor: string) {
    setVerificando(true);
    // ponytail: demo acepta cualquier PIN de 4 dígitos; el nodo pondrá el filtro real (PIN + rol).
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

  // Teclado físico (solo en el paso del PIN).
  useEffect(() => {
    if (pidiendoUsuario) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") { setError(false); setPin((p) => p.slice(0, -1)); return; }
      if (/\d/.test(e.key) && e.key.length === 1) pulsa(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pidiendoUsuario, verificando]);

  const sub = requiere === "operario"
    ? "Introduce tu PIN o acerca tu pulsera."
    : `Requiere ${ETIQUETA_ROL[requiere]}: PIN o pulsera.`;

  return (
    <Modal onCerrar={onCancelar} ancho="sm" className="p-7">
      <button type="button" onClick={onCancelar} aria-label="Cerrar" className="float-right -mr-1 -mt-1 rounded-lg p-1.5 text-muted transition-transform active:scale-90"><X size={18} /></button>

      <div className="flex flex-col items-center text-center">
        <Escudo fondo={color} tam={56}>{icono}</Escudo>
        <h2 className="mt-4 flex items-center gap-2 font-display text-lg font-bold">
          <Lock size={16} className="text-muted" /> Acceso a {titulo}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {pidiendoUsuario ? "¿Quién eres? Elígete o acerca tu pulsera." : sub}
        </p>
      </div>

      {pidiendoUsuario ? (
        <div className="mt-5">
          <ListaUsuarios usuarios={usuarios!} onElegir={setElegido} onPulsera={() => onOk()} />
        </div>
      ) : (
        <>
          {elegido && (
            <button type="button" onClick={() => { setElegido(null); setPin(""); setError(false); }}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-line bg-paper/5 px-3 py-1 text-[12px] font-semibold text-muted transition-transform active:scale-95">
              <ArrowLeft size={13} /> {elegido.nombre}
            </button>
          )}

          <div className="mt-5 flex justify-center gap-3">
            {Array.from({ length: LARGO }).map((_, i) => {
              let clase = "border-paper/30";
              if (error) clase = "border-danger bg-danger/40";
              else if (i < pin.length) clase = "border-brand-lit bg-brand-lit";
              return <span key={`p${i}`} className={`h-3.5 w-3.5 rounded-full border transition-colors ${clase}`} />;
            })}
          </div>
          <p className={`mb-2 mt-2 text-center text-sm font-medium ${error ? "text-danger" : "text-transparent"}`}>PIN incorrecto o sin acceso</p>

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

          <button type="button" onClick={() => onOk(elegido ?? undefined)}
            className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-brand-lit/40 bg-brand/10 py-3 text-sm font-semibold text-brand-lit transition-transform active:scale-[.98] active:bg-brand/20">
            <Nfc size={18} /> Acerca tu pulsera o tarjeta
          </button>
        </>
      )}
    </Modal>
  );
}
