// TECLADO EN PANTALLA — global, flotante, arrastrable, estilo MÓVIL.
// Portado 1:1 de apps/web/components/teclado-en-pantalla.tsx (skill gluuh-tpv-portar).
// Único cambio Next→Vite: fuera "use client" y los tokens de color del backoffice
// (--bg-surface/--text-primary…) se mapean a la paleta de la operativa (--panel/
// --paper/--line/--brand/--mint) — misma semántica, distinta variable.
//
// Para TPV táctiles SIN teclado físico: escribir nombres, precios, CIF, buscar…
// Comportamiento tipo móvil:
//  · Fila NUMÉRICA siempre arriba. Letras por defecto; símbolos tras "?#$".
//  · Mantener pulsada una vocal (o n/c) → variantes con TILDE.
//  · Altura FIJA (5 filas). Sigue el tema (claro/oscuro).
//  · No roba el foco (mousedown preventDefault) y escribe con execCommand (React se entera).
import { useCallback, useEffect, useRef, useState } from "react";

const NUMEROS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const LETRAS: string[][] = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const SIMBOLOS: string[][] = [
  ["@", "#", "€", "$", "%", "&", "*", "(", ")", "/"],
  ["-", "_", "+", "=", "'", '"', ":", ";", "!", "?"],
  ["<", ">", "[", "]", "{", "}", "|", "\\"],
];
const VARIANTES: Record<string, string[]> = {
  a: ["á", "à", "ä", "â"], e: ["é", "è", "ë", "ê"], i: ["í", "ï", "î"],
  o: ["ó", "ò", "ö", "ô"], u: ["ú", "ü", "û"], n: ["ñ"], c: ["ç"],
};

function esEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const t = (el.type || "text").toLowerCase();
    const noTexto = ["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"];
    return !noTexto.includes(t) && !el.readOnly && !el.disabled;
  }
  return false;
}

export function TecladoEnPantalla() {
  const [montado, setMontado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [mays, setMays] = useState(false);
  const [simbolos, setSimbolos] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [popup, setPopup] = useState<{ opts: string[]; x: number; y: number } | null>(null);
  // Auto-teclado: aparece al enfocar un input y desaparece al tocar fuera.
  const [auto, setAuto] = useState(() => leerAuto());
  // Espejo del campo que se está escribiendo (nombre + texto), para la barra.
  const [campo, setCampo] = useState("Campo");
  const [texto, setTexto] = useState("");

  const objetivo = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef(auto);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);
  const tempLargo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const largoDisparado = useRef(false);

  useEffect(() => {
    setMontado(true);
    try {
      const p = localStorage.getItem("gluuh_teclado_pos");
      if (p) setPos(JSON.parse(p));
    } catch { /* sin persistencia */ }
  }, []);

  useEffect(() => { autoRef.current = auto; }, [auto]);

  // Refleja el campo enfocado en la barra: su nombre (aria-label/placeholder) y su texto.
  const refrescar = useCallback(() => {
    const el = objetivo.current;
    setCampo(el?.getAttribute("aria-label") || el?.getAttribute("placeholder") || "Campo");
    setTexto(el?.value ?? "");
  }, []);

  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => {
      if (!esEditable(e.target as Element)) return;
      objetivo.current = e.target as HTMLInputElement;
      refrescar();
      // `data-sin-teclado` (en el input o en un ancestro) exime del auto-teclado:
      // el sitio pone su propio botón «Teclado» y decide cuándo abrirlo. El input
      // sigue siendo el objetivo, así que ese botón escribe donde toca.
      if (autoRef.current && !(e.target as Element).closest("[data-sin-teclado]")) setAbierto(true);
    };
    document.addEventListener("focusin", alEnfocar);
    return () => document.removeEventListener("focusin", alEnfocar);
  }, [refrescar]);

  const guardarAbierto = useCallback((v: boolean) => setAbierto(v), []);

  useEffect(() => {
    const abrir = () => { refrescar(); guardarAbierto(true); };
    const cerrar = () => guardarAbierto(false);
    const cambiarAuto = (e: Event) => setAuto(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener("gluuh:abrir-teclado", abrir);
    window.addEventListener("gluuh:cerrar-teclado", cerrar);
    window.addEventListener("gluuh:teclado-auto", cambiarAuto);
    return () => {
      window.removeEventListener("gluuh:abrir-teclado", abrir);
      window.removeEventListener("gluuh:cerrar-teclado", cerrar);
      window.removeEventListener("gluuh:teclado-auto", cambiarAuto);
    };
  }, [guardarAbierto, refrescar]);

  // Auto-teclado: al tocar fuera del teclado y fuera de un input, se oculta.
  useEffect(() => {
    if (!auto) return;
    const alTocar = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (panelRef.current?.contains(t) || esEditable(t)) return;
      guardarAbierto(false);
    };
    document.addEventListener("pointerdown", alTocar);
    return () => document.removeEventListener("pointerdown", alTocar);
  }, [auto, guardarAbierto]);

  const enfocar = useCallback(() => {
    const el = objetivo.current;
    if (el && document.activeElement !== el) el.focus();
    return el;
  }, []);

  const escribir = useCallback((ch: string) => {
    if (!enfocar()) return;
    if (!document.execCommand("insertText", false, ch)) {
      const el = objetivo.current!;
      const ini = el.selectionStart ?? el.value.length;
      const fin = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, ini) + ch + el.value.slice(fin);
      el.selectionStart = el.selectionEnd = ini + ch.length;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setTexto(objetivo.current?.value ?? "");
  }, [enfocar]);

  const borrar = useCallback(() => {
    if (!enfocar()) return;
    if (!document.execCommand("delete", false)) {
      const el = objetivo.current!;
      const ini = el.selectionStart ?? el.value.length;
      if (ini > 0) {
        el.value = el.value.slice(0, ini - 1) + el.value.slice(ini);
        el.selectionStart = el.selectionEnd = ini - 1;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    setTexto(objetivo.current?.value ?? "");
  }, [enfocar]);

  const intro = useCallback(() => {
    const el = enfocar();
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) { escribir("\n"); return; }
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    el.form?.requestSubmit?.();
    guardarAbierto(false);
  }, [enfocar, escribir, guardarAbierto]);

  const trans = useCallback((ch: string) => (mays && !simbolos ? ch.toUpperCase() : ch), [mays, simbolos]);

  const alBajarTecla = (e: React.PointerEvent, ch: string) => {
    e.preventDefault();
    largoDisparado.current = false;
    const vars = VARIANTES[ch];
    if (vars && !simbolos) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      tempLargo.current = setTimeout(() => {
        largoDisparado.current = true;
        setPopup({ opts: vars.map(trans), x: rect.left + rect.width / 2, y: rect.top });
      }, 320);
    }
  };
  const alSoltarTecla = (ch: string) => {
    if (tempLargo.current) { clearTimeout(tempLargo.current); tempLargo.current = null; }
    if (!largoDisparado.current) escribir(trans(ch));
    largoDisparado.current = false;
  };
  const cancelarLargo = () => { if (tempLargo.current) { clearTimeout(tempLargo.current); tempLargo.current = null; } };

  // Se arrastra por la BARRA ENTERA, no por un asa de 20px: con el dedo, acertar
  // en el asa es una lotería. Los botones de la barra (la X) siguen funcionando.
  const alBajar = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const base = pos ?? { x: window.innerWidth / 2 - 320, y: window.innerHeight - 300 };
    arrastre.current = { dx: e.clientX - base.x, dy: e.clientY - base.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const alMover = (e: React.PointerEvent) => {
    if (!arrastre.current) return;
    const x = Math.max(4, Math.min(window.innerWidth - 120, e.clientX - arrastre.current.dx));
    const y = Math.max(4, Math.min(window.innerHeight - 60, e.clientY - arrastre.current.dy));
    setPos({ x, y });
  };
  const alSoltar = () => {
    arrastre.current = null;
    if (pos) { try { localStorage.setItem("gluuh_teclado_pos", JSON.stringify(pos)); } catch { /* noop */ } }
  };

  if (!montado) return null;
  const noRobarFoco = (e: React.MouseEvent) => e.preventDefault();

  if (!abierto) return null;

  const x = pos?.x ?? Math.max(4, window.innerWidth / 2 - 320);
  const y = pos?.y ?? window.innerHeight - 300;
  const filasLetras = simbolos ? SIMBOLOS : LETRAS;

  const teclaChar = (ch: string) => (
    <button
      key={ch} type="button" style={tecla}
      onMouseDown={noRobarFoco}
      onPointerDown={(e) => alBajarTecla(e, ch)}
      onPointerUp={() => alSoltarTecla(ch)}
      onPointerLeave={cancelarLargo}
      onPointerCancel={cancelarLargo}
    >
      {trans(ch)}
    </button>
  );

  return (
    <div ref={panelRef} style={{ ...panel, left: x, top: y }} role="group" aria-label="Teclado en pantalla">
      {/* Barra de título: el asa para mover y la ✕. Mismo cromo que las ventanas
          emergentes, para que el teclado se lea como una ventana más. */}
      <div role="toolbar" aria-label="Teclado en pantalla · arrastra para moverlo"
        style={{ ...barra, cursor: "grab", touchAction: "none" }}
        onMouseDown={noRobarFoco} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar}
        title="Arrastra la barra para mover el teclado">
        <span style={etiquetaCampo}>{campo || "Teclado"}</span>
        <button type="button" onMouseDown={noRobarFoco} onClick={() => guardarAbierto(false)} style={cerrar} title="Cerrar">✕</button>
      </div>

      {/* Lo que se está escribiendo, a lo ancho: se lee de un vistazo. */}
      <div style={filaVisor}>
        <div style={visor}>
          {texto ? <span>{texto}</span> : <span style={{ opacity: 0.5 }}>Escribe…</span>}
          <span style={cursor} />
        </div>
      </div>

      <div style={teclas}>
        <div style={fila}>{NUMEROS.map(teclaChar)}</div>
        <div style={fila}>{filasLetras[0]!.map(teclaChar)}</div>
        <div style={fila}>{filasLetras[1]!.map(teclaChar)}</div>
        <div style={fila}>
          {!simbolos && (
            <button type="button" onMouseDown={noRobarFoco} onClick={() => setMays((v) => !v)} style={{ ...teclaAncha, ...(mays ? teclaActiva : {}) }} aria-label="Mayúsculas">⇧</button>
          )}
          {filasLetras[2]!.map(teclaChar)}
          <button type="button" onMouseDown={noRobarFoco} onClick={borrar} style={teclaAncha} aria-label="Borrar">⌫</button>
        </div>
        <div style={fila}>
          <button type="button" onMouseDown={noRobarFoco} onClick={() => setSimbolos((v) => !v)} style={{ ...teclaAncha, ...(simbolos ? teclaActiva : {}) }}>{simbolos ? "ABC" : "?#$"}</button>
          {teclaChar(",")}
          <button type="button" onMouseDown={noRobarFoco} onClick={() => escribir(" ")} style={{ ...tecla, flex: 4 }}>espacio</button>
          {teclaChar(".")}
          <button type="button" onMouseDown={noRobarFoco} onClick={intro} style={{ ...teclaAncha, fontSize: 22 }} aria-label="Intro">⏎</button>
        </div>
      </div>

      {popup && (
        <>
          <div onPointerDown={() => setPopup(null)} style={velo} />
          <div style={{ ...acentos, left: popup.x, top: popup.y }}>
            {popup.opts.map((op) => (
              <button key={op} type="button" onMouseDown={noRobarFoco}
                onClick={() => { escribir(op); setPopup(null); }} style={teclaAcento}>{op}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Abre el teclado en pantalla desde cualquier sitio (lo escucha <TecladoEnPantalla/>). */
export function abrirTeclado() {
  window.dispatchEvent(new Event("gluuh:abrir-teclado"));
}

const CLAVE_AUTO = "gluuh_teclado_auto";
function leerAuto(): boolean {
  try { return localStorage.getItem(CLAVE_AUTO) === "1"; } catch { return false; }
}
/** ¿Está activo el auto-teclado? (aparece al enfocar un input, desaparece al tocar fuera). */
export function getTecladoAuto(): boolean { return leerAuto(); }
/** Activa/desactiva el auto-teclado; lo persiste y avisa a <TecladoEnPantalla/>. */
export function setTecladoAuto(v: boolean) {
  try { localStorage.setItem(CLAVE_AUTO, v ? "1" : "0"); } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent("gluuh:teclado-auto", { detail: v }));
  if (!v) window.dispatchEvent(new Event("gluuh:cerrar-teclado"));
}

// ── estilos: SIGUEN EL TEMA (tokens de la operativa) → claro y oscuro ──
const panel: React.CSSProperties = {
  position: "fixed", zIndex: 2147483000, width: 640, maxWidth: "calc(100vw - 8px)",
  background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14,
  boxShadow: "0 30px 80px -20px rgba(0,0,0,.35)", color: "var(--paper)",
  fontFamily: 'var(--font-sans), system-ui, "Segoe UI", sans-serif', userSelect: "none",
};
// BARRA DE TÍTULO morada, igual que la de las ventanas emergentes: es el asa
// para mover y lleva la ✕. El visor del campo va DEBAJO, en su propia fila.
const barra: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, height: 36,
  padding: "0 6px 0 12px", background: "var(--brand)", color: "#fff",
  borderTopLeftRadius: 13, borderTopRightRadius: 13,
};
const etiquetaCampo: React.CSSProperties = {
  flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontWeight: 600, fontSize: 13,
};
const filaVisor: React.CSSProperties = {
  padding: "8px 10px", borderBottom: "1px solid var(--line)",
};
const visor: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap",
  height: 38, padding: "0 12px", borderRadius: 8,
  background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--paper)", fontSize: 15, fontWeight: 500,
};
const cursor: React.CSSProperties = {
  width: 1, height: 16, marginLeft: 1, background: "var(--paper)", animation: "gl-velo 1s steps(1) infinite alternate",
};
const cerrar: React.CSSProperties = {
  background: "transparent", border: 0, color: "#fff", fontSize: 16, cursor: "pointer",
  padding: "4px 10px", borderRadius: 4, flexShrink: 0, lineHeight: 1,
};
const teclas: React.CSSProperties = { padding: 8, display: "flex", flexDirection: "column", gap: 6, height: 8 + 5 * 48 + 4 * 6 + 8 };
const fila: React.CSSProperties = { display: "flex", gap: 6, flex: 1 };
const tecla: React.CSSProperties = {
  flex: 1, minWidth: 0, borderRadius: 9, cursor: "pointer",
  background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--paper)",
  fontSize: 17, fontWeight: 500, touchAction: "none",
};
const teclaAncha: React.CSSProperties = { ...tecla, flex: 1.6, fontSize: 13, fontWeight: 600 };
const teclaActiva: React.CSSProperties = { background: "var(--brand)", color: "#fff", borderColor: "transparent" };
const velo: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 2147483001 };
const acentos: React.CSSProperties = {
  position: "fixed", zIndex: 2147483002, transform: "translate(-50%, calc(-100% - 6px))",
  display: "flex", gap: 4, padding: 4, borderRadius: 10,
  background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 12px 30px -8px rgba(0,0,0,.4)",
};
const teclaAcento: React.CSSProperties = {
  minWidth: 44, height: 48, borderRadius: 8, cursor: "pointer", fontSize: 20, fontWeight: 600,
  background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--paper)",
};
