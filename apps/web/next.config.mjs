import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite consumir los paquetes del monorepo (código TS sin precompilar).
  transpilePackages: ["@gluuh/core"],   // @gluuh/ui es un placeholder sin importadores

  // ── El build que se lleva al bar ───────────────────────────────────────────
  //
  // `standalone` produce un servidor AUTOCONTENIDO: un `server.js` con sólo los ficheros
  // que de verdad hacen falta. Sin él habría que meter `node_modules` entero en el
  // instalador —cientos de MB y decenas de miles de ficheros— y que el mini-PC de un bar
  // resolviera dependencias.
  //
  // Se activa SÓLO al compilar para el nodo (`pnpm build:nodo`). La nube sigue compilando
  // como siempre, con OpenNext hacia Cloudflare: aquí no se le toca nada.
  //
  // `outputFileTracingRoot`: en un monorepo pnpm, Next tiene que mirar la raíz del
  // workspace para encontrar los paquetes enlazados. Sin esto el standalone sale cojo.
  ...(process.env.NODO_BUILD === "1"
    ? { output: "standalone", outputFileTracingRoot: path.join(aqui, "../..") }
    : {}),
};

export default nextConfig;
