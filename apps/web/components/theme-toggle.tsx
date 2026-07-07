"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSurfaceTheme } from "@/app/lib/surface-theme";

// `surface` decide qué preferencia recuerda (panel = Configuración, tpv = operativa).
export function ThemeToggle({ surface = "panel" }: { surface?: "panel" | "tpv" }) {
  const { resolvedTheme } = useTheme();
  const { setSurfaceTheme } = useSurfaceTheme(surface);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <Button variant="ghost" size="icon" aria-label="Tema" />;
  const dark = resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label={dark ? "Modo claro" : "Modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"} onClick={() => setSurfaceTheme(dark ? "light" : "dark")}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
