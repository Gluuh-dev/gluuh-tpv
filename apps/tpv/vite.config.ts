import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// SPA de la operativa (TPV). La sirve el NODO (offline): base relativa para que
// funcione en cualquier ruta/puerto, sin CDN ni rutas absolutas.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", sourcemap: true },
  server: { port: 3120 }, // dev; el nodo sirve el build en su puerto (guía 23)
});
