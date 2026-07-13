"use client";

// Montaje único de las notificaciones (Sileo — https://sileo.aaryan.design/):
// pastilla que se expande con física de muelles. El tema sigue al de la app
// (next-themes con toggle manual), no al del sistema.
import { useTheme } from "next-themes";
import { Toaster } from "sileo";
import "sileo/styles.css";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster key={resolvedTheme} theme={(resolvedTheme as "light" | "dark") ?? "dark"} position="bottom-center" />;
}
