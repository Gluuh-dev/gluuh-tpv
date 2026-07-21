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
// En PRODUCCIÓN el nodo sirve la SPA y los datos desde el MISMO origen, así que
// `lib/nodo.ts` llama con rutas relativas y no hay CORS. En DEV el TPV corre en
// :3120 y el nodo en :54321 — cross-origin. En vez de abrir CORS en el gateway,
// se reenvía por PROXY: el TPV pide a su propio origen y Vite lo manda al nodo.
// Así dev se comporta como producción (mismo origen) y el emparejado funciona.
const NODO = process.env.VITE_NODO_PROXY ?? "http://localhost:54321";
const proxy = Object.fromEntries(
  // `/nodo` es el estado del servidor (Visor Node); el resto, datos y auth.
  ["/rest", "/auth", "/storage", "/realtime", "/nodo"].map((p) => [p, { target: NODO, changeOrigin: true }]),
);

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist", sourcemap: true,
    // Las fotos del catálogo (webp) son cientos y casi todas < 4 KB: con el inline
    // por defecto acabarían en base64 DENTRO del JS, inflándolo y sin poder
    // cachearlas por separado. Se fuerzan a fichero para que el navegador las pida
    // on-demand (solo las que se ven) y las guarde en caché. El resto de assets
    // pequeños (iconos sueltos) mantienen el inline por defecto de 4 KB.
    assetsInlineLimit: (ruta) => (ruta.includes("/catalogo/") ? false : undefined),
  },
  server: { port: 3120, proxy },
});
