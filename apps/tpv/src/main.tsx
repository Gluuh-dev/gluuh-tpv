import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Tema antes del primer pintado (sin destello): la preferencia guardada manda;
// sin preferencia, dark-first (operativa, mockups del cliente). El toggle del
// Inicio (lib/tema.ts) reescribe esta misma clase y la persiste.
document.documentElement.classList.toggle("dark", localStorage.getItem("gluuh_tema") !== "light");

const raiz = document.getElementById("root");
if (!raiz) throw new Error("No se encontró #root");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
