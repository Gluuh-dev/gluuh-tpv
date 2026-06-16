import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  railOpen: boolean;   // rail principal expandido (con etiquetas)
  menuOpen: boolean;   // submenú lateral visible
  toggleRail: () => void;
  toggleMenu: () => void;
  setMenuOpen: (v: boolean) => void;
}

// Estado de UI persistente (localStorage) para que el menú recuerde su estado.
export const useUI = create<UIState>()(
  persist(
    (set) => ({
      railOpen: false,
      menuOpen: true,
      toggleRail: () => set((s) => ({ railOpen: !s.railOpen })),
      toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
      setMenuOpen: (v) => set({ menuOpen: v }),
    }),
    { name: "gluuh-ui" }
  )
);
