import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// La operativa es dark-first (como los mockups del cliente); el fondo del <body>
// queda oscuro detrás de las pantallas a pantalla completa (sin destello claro).
document.documentElement.classList.add("dark");

const raiz = document.getElementById("root");
if (!raiz) throw new Error("No se encontró #root");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
