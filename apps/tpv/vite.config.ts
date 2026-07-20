import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// SPA de la operativa (TPV). La sirve el NODO (offline), sin CDN.
//
// ⚠ `base: "/"` — NO se puede volver a "./". Desde que hay rutas de verdad
// (`/config/productos`, ver `lib/rutas.ts`), con base relativa el navegador
// pediría los assets como `/config/assets/index-xxx.js` al RECARGAR ahí: 404 y
// pantalla blanca. En dev no se ve, porque Vite los sirve desde la raíz igual —
// se vería en el bar. Con base absoluta hace falta que quien sirva el build
// devuelva `index.html` para cualquier ruta desconocida (fallback de SPA).
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", sourcemap: true },
  server: { port: 3120 }, // dev; el nodo sirve el build en su puerto (guía 23)
});
