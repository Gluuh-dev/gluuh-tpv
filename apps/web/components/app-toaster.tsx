"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={(resolvedTheme as "light" | "dark") ?? "dark"} richColors closeButton position="bottom-right" />;
}
