"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

// Tema POR SUPERFICIE: el panel (Configuración) y el TPV recuerdan su propio
// claro/oscuro. Cada superficie guarda su preferencia en su clave y la aplica al
// montar; así puedes tener, p. ej., TPV en claro y Configuración en oscuro.
// (Comparten el ThemeProvider global de next-themes; al entrar a cada superficie
//  se re-aplica la suya — puede haber un parpadeo breve al navegar entre ambas.)
export function useSurfaceTheme(surface: "panel" | "tpv") {
  const { setTheme } = useTheme();
  const key = `gluuh:theme:${surface}`;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, [key, setTheme]);

  const setSurfaceTheme = (t: "light" | "dark") => {
    try { localStorage.setItem(key, t); } catch { /* almacenamiento no disponible */ }
    setTheme(t);
  };

  return { setSurfaceTheme };
}
