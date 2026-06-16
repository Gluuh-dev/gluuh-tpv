import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SlideMode = "push" | "overlay" | "corner" | "center" | "full";

interface S {
  open: boolean;
  mode: SlideMode;
  width: number;
  toggle: () => void;
  setOpen: (o: boolean) => void;
  setMode: (m: SlideMode) => void;
  setWidth: (w: number) => void;
}

export const useAssistant = create<S>()(
  persist(
    (set) => ({
      open: false,
      mode: "overlay",
      width: 448,
      toggle: () => set((s) => ({ open: !s.open })),
      setOpen: (open) => set({ open }),
      setMode: (mode) => set({ mode }),
      setWidth: (width) =>
        set({ width: Math.round(Math.max(360, Math.min(1000, width))) }),
    }),
    { name: "gluuh-assistant" }
  )
);
