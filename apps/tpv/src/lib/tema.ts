// Tema claro/oscuro SIN next-themes (guía 22 Fase B): la clase `.dark` en <html>
// y la preferencia en localStorage. Mismo comportamiento que el TPV en Next, pero
// sin dependencia de framework — vale igual en Vite.
import { useSyncExternalStore } from "react";

const CLAVE = "gluuh_tema";
type Tema = "light" | "dark";

function leer(): Tema {
  if (typeof window === "undefined") return "dark";
  const g = localStorage.getItem(CLAVE);
  if (g === "light" || g === "dark") return g;
  return "dark"; // la operativa es dark-first (mockups del cliente); el toggle manda
}

function aplicar(t: Tema) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

// Un único suscriptor para que varios componentes compartan el mismo tema vivo.
const oyentes = new Set<() => void>();
let actual: Tema = typeof window === "undefined" ? "light" : leer();
if (typeof window !== "undefined") aplicar(actual);

export function fijarTema(t: Tema) {
  actual = t;
  localStorage.setItem(CLAVE, t);
  aplicar(t);
  oyentes.forEach((o) => o());
}

export function useTema(): { tema: Tema; oscuro: boolean; alternar: () => void; fijar: (t: Tema) => void } {
  const tema = useSyncExternalStore(
    (cb) => { oyentes.add(cb); return () => oyentes.delete(cb); },
    () => actual,
    () => "light" as Tema,
  );
  return { tema, oscuro: tema === "dark", alternar: () => fijarTema(tema === "dark" ? "light" : "dark"), fijar: fijarTema };
}
