"use client";

// TECLADO EN PANTALLA — global, flotante, arrastrable y COMPLETO.
//
// Para TPV táctiles SIN teclado físico: escribir nombres de producto, precios, CIF, buscar…
// (El `TecladoTPV` del ticket es solo el NUMÉRICO de la venta; esto es el de texto, y sale en
// cualquier pantalla: operativa Y backoffice de config.)
//
// Decisiones:
//  · FLOTANTE y ARRASTRABLE, top-most, para que NO tape el campo que editas (lo apartas).
//  · No roba el foco: las teclas hacen `preventDefault` en mousedown, así el input sigue
//    enfocado y `execCommand('insertText')` escribe donde está el cursor y dispara los
//    eventos que React necesita (funciona en Chromium/Edge, que es lo que corre el TPV).
//  · Recuerda si está abierto y su posición (localStorage).
//  · Autocontenido: sin dependencias externas ni fuentes de fuera (regla del nodo offline).

import { useCallback, useEffect, useRef, useState } from "react";

const LETRAS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "-"],
];
const ACENTOS = ["á", "é", "í", "ó", "ú", "ü", "@", "/", "_", "º"];
const SIMBOLOS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["@", "#", "€", "$", "%", "&", "*", "(", ")", "/"],
  ["-", "_", "+", "=", "'", '"', ":", ";", "!", "?"],
  [".", ",", "<", ">", "[", "]", "{", "}", "|", "\\"],
];

const EDITABLES = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea";

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
  // El último campo de texto enfocado. Se escribe sobre él aunque el foco parpadee.
  const objetivo = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const arrastre = useRef<{ dx: number; dy: number } | null>(null);

  // Estado persistido (solo en cliente).
  useEffect(() => {
    setMontado(true);
    try {
      setAbierto(localStorage.getItem("gluuh_teclado") === "1");
      const p = localStorage.getItem("gluuh_teclado_pos");
      if (p) setPos(JSON.parse(p));
    } catch { /* sin persistencia, no pasa nada */ }
  }, []);

  // Recordar el último input de texto enfocado.
  useEffect(() => {
    const alEnfocar = (e: FocusEvent) => {
      if (esEditable(e.target as Element)) objetivo.current = e.target as HTMLInputElement;
    };
    document.addEventListener("focusin", alEnfocar);
    return () => document.removeEventListener("focusin", alEnfocar);
  }, []);

  const guardarAbierto = useCallback((v: boolean) => {
    setAbierto(v);
    try { localStorage.setItem("gluuh_teclado", v ? "1" : "0"); } catch { /* noop */ }
  }, []);

  // Asegura el foco en el último campo antes de escribir.
  const enfocar = useCallback(() => {
    const el = objetivo.current;
    if (el && document.activeElement !== el) el.focus();
    return el;
  }, []);

  const escribir = useCallback((ch: string) => {
    if (!enfocar()) return;
    // execCommand respeta el cursor y dispara 'input' (React se entera). Fallback manual.
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
    // En un textarea, Intro es salto de línea y el teclado se queda (sigues escribiendo).
    if (el instanceof HTMLTextAreaElement) { escribir("\n"); return; }
    // En un input, Enter CONFIRMA: se simula para que el formulario reaccione y se ESCONDE
    // el teclado (has terminado de escribir).
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    el.form?.requestSubmit?.();
    guardarAbierto(false);
  }, [enfocar, escribir, guardarAbierto]);

  // Arrastre por la barra superior (puntero: vale ratón y táctil).
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
  const filas = simbolos ? SIMBOLOS : LETRAS;
  const trans = (ch: string) => (mays && !simbolos ? ch.toUpperCase() : ch);

  // Botón flotante para abrir/cerrar (siempre visible).
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => guardarAbierto(true)}
        title="Teclado en pantalla"
        style={btnFlotante}
      >
        ⌨ Teclado
      </button>
    );
  }

  const x = pos?.x ?? Math.max(4, window.innerWidth / 2 - 320);
  const y = pos?.y ?? window.innerHeight - 300;

  return (
    <div style={{ ...panel, left: x, top: y }} role="group" aria-label="Teclado en pantalla">
      {/* Barra: arrastrar + cerrar */}
      <div
        style={barra}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
      >
        <span style={{ opacity: 0.7 }}>⌨ Teclado — arrástrame si tapo el campo</span>
        <button type="button" onMouseDown={noRobarFoco} onClick={() => guardarAbierto(false)} style={cerrar} title="Cerrar">✕</button>
      </div>

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {!simbolos && (
          <div style={fila}>
            {ACENTOS.map((ch) => (
              <button key={ch} type="button" onMouseDown={noRobarFoco} onClick={() => escribir(trans(ch))} style={tecla}>{trans(ch)}</button>
            ))}
          </div>
        )}
        {filas.map((f, i) => (
          <div key={i} style={fila}>
            {f.map((ch) => (
              <button key={ch} type="button" onMouseDown={noRobarFoco} onClick={() => escribir(trans(ch))} style={tecla}>{trans(ch)}</button>
            ))}
          </div>
        ))}
        {/* Fila de control */}
        <div style={fila}>
          <button type="button" onMouseDown={noRobarFoco} onClick={() => setMays((v) => !v)} style={{ ...teclaAncha, ...(mays ? teclaActiva : {}) }}>⇧ Mayús</button>
          <button type="button" onMouseDown={noRobarFoco} onClick={() => setSimbolos((v) => !v)} style={{ ...teclaAncha, ...(simbolos ? teclaActiva : {}) }}>{simbolos ? "ABC" : "?123"}</button>
          <button type="button" onMouseDown={noRobarFoco} onClick={() => escribir(" ")} style={{ ...tecla, flex: 3 }}>espacio</button>
          <button type="button" onMouseDown={noRobarFoco} onClick={borrar} style={teclaAncha}>← Borrar</button>
          <button type="button" onMouseDown={noRobarFoco} onClick={intro} style={{ ...teclaAncha, ...teclaIntro }}>Intro ⏎</button>
        </div>
      </div>
    </div>
  );
}

// ── estilos: SIGUEN EL TEMA del app (tokens --bg/--text/--border/--brand) → claro y oscuro ──
const btnFlotante: React.CSSProperties = {
  position: "fixed", right: 16, bottom: 16, zIndex: 2147483000,
  background: "var(--brand)", color: "#fff", border: "1px solid var(--brand-active)",
  borderRadius: 999, padding: "10px 16px", fontSize: 14, fontWeight: 600,
  cursor: "pointer", boxShadow: "0 10px 30px -10px rgba(0,0,0,.35)",
};
const panel: React.CSSProperties = {
  position: "fixed", zIndex: 2147483000, width: 640, maxWidth: "calc(100vw - 8px)",
  background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 14,
  boxShadow: "0 30px 80px -20px rgba(0,0,0,.35)", color: "var(--text-primary)",
  fontFamily: 'var(--font-sans), system-ui, "Segoe UI", sans-serif', userSelect: "none",
};
const barra: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 12px", cursor: "move", borderBottom: "1px solid var(--border-muted)",
  fontSize: 12, color: "var(--text-secondary)", touchAction: "none",
};
const cerrar: React.CSSProperties = {
  background: "transparent", border: 0, color: "var(--text-primary)", fontSize: 16, cursor: "pointer", padding: "2px 8px", borderRadius: 6,
};
const fila: React.CSSProperties = { display: "flex", gap: 6 };
const tecla: React.CSSProperties = {
  flex: 1, minWidth: 0, height: 48, borderRadius: 9, cursor: "pointer",
  background: "var(--bg-default)", border: "1px solid var(--border-default)", color: "var(--text-primary)",
  fontSize: 17, fontWeight: 500,
};
const teclaAncha: React.CSSProperties = { ...tecla, flex: 1.6, fontSize: 13, fontWeight: 600 };
const teclaActiva: React.CSSProperties = { background: "var(--brand)", color: "#fff", borderColor: "transparent" };
const teclaIntro: React.CSSProperties = { background: "var(--success)", color: "#fff", borderColor: "transparent" };
