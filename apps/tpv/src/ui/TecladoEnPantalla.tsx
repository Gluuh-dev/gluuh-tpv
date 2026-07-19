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

  const objetivo = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
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

  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => {
      if (esEditable(e.target as Element)) objetivo.current = e.target as HTMLInputElement;
    };
    document.addEventListener("focusin", alEnfocar);
    return () => document.removeEventListener("focusin", alEnfocar);
  }, []);

  const guardarAbierto = useCallback((v: boolean) => setAbierto(v), []);

  useEffect(() => {
    const abrir = () => guardarAbierto(true);
    const cerrar = () => guardarAbierto(false);
    window.addEventListener("gluuh:abrir-teclado", abrir);
    window.addEventListener("gluuh:cerrar-teclado", cerrar);
    return () => {
      window.removeEventListener("gluuh:abrir-teclado", abrir);
      window.removeEventListener("gluuh:cerrar-teclado", cerrar);
    };
  }, [guardarAbierto]);

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

  const alBajar = (e: React.PointerEvent) => {
    const base = pos ?? { x: window.innerWidth / 2 - 320, y: window.innerHeight - 300 };
    arrastre.current = { dx: e.clientX - base.x, dy: e.clientY - base.y };
    (e.target as Element).setPointerCapture(e.pointerId);
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
    <div style={{ ...panel, left: x, top: y }} role="group" aria-label="Teclado en pantalla">
      <div style={barra} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar}>
        <span style={{ opacity: 0.8 }}>⌨ Teclado — arrástrame si tapo el campo</span>
        <button type="button" onMouseDown={noRobarFoco} onClick={() => guardarAbierto(false)} style={cerrar} title="Cerrar">✕</button>
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
          <button type="button" onMouseDown={noRobarFoco} onClick={intro} style={{ ...teclaAncha, ...teclaIntro }} aria-label="Intro">⏎</button>
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

// ── estilos: SIGUEN EL TEMA (tokens de la operativa) → claro y oscuro ──
const panel: React.CSSProperties = {
  position: "fixed", zIndex: 2147483000, width: 640, maxWidth: "calc(100vw - 8px)",
  background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14,
  boxShadow: "0 30px 80px -20px rgba(0,0,0,.35)", color: "var(--paper)",
  fontFamily: 'var(--font-sans), system-ui, "Segoe UI", sans-serif', userSelect: "none",
};
const barra: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 12px", cursor: "move", borderBottom: "1px solid var(--line)",
  fontSize: 12, color: "var(--muted)", touchAction: "none",
};
const cerrar: React.CSSProperties = {
  background: "transparent", border: 0, color: "var(--paper)", fontSize: 16, cursor: "pointer", padding: "2px 8px", borderRadius: 6,
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
const teclaIntro: React.CSSProperties = { background: "var(--mint)", color: "#053a26", borderColor: "transparent" };
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
