import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TENANT_PRUEBAS = "4c792677-c66b-4af8-bd3f-8c2e32031db8";
const NUBE_URL = "https://gxcqihslbicrszgzudjs.supabase.co";
// anon key (publishable, NO secreta): Supabase exige `apikey` además del Bearer.
const NUBE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Y3FpaHNsYmljcnN6Z3p1ZGpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzYxNzUsImV4cCI6MjA5NzA1MjE3NX0.iWY-mUr-8z1H0FPCA0yy2l_ISaEWhFUbphk5N_Y_CUQ";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** El secreto del nodo (el que firma y valida su auth). Solo en la máquina de dev. */
function secretoNodo(): string | null {
  const env = join(RAIZ, ".nodo", "nodo.env");
  if (existsSync(env)) {
    const m = /^NODO_JWT_SECRETO=(.*)$/m.exec(readFileSync(env, "utf8"));
    if (m?.[1]) return m[1].trim();
  }
  const conf = join(RAIZ, ".nodo", "postgrest.conf");
  if (existsSync(conf)) {
    const m = /^jwt-secret\s*=\s*"(.*)"$/m.exec(readFileSync(conf, "utf8"));
    if (m?.[1]) return m[1];
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// SESIÓN DE DISPOSITIVO PARA DESARROLLO — para DISEÑAR CONECTADO a datos reales.
//
// Firma un token de larga duración para el «Restaurante de pruebas» y lo inyecta
// en el cliente, de modo que `pnpm dev` arranque CONECTADO sin pegar nada en la
// consola y sin caer en modo demo. Se apunta al NODO (por defecto) o a la NUBE
// (Supabase) con `VITE_DESTINO`, para trabajar contra la nube mientras el nodo
// se termina y luego cambiar sin tocar la app.
//
// SOLO en `vite serve`. En `vite build` (producción) NO se genera: manda el
// emparejado real de cada terminal. El SECRETO nunca va al bundle: aquí se usa
// para FIRMAR y solo viaja el token resultante.
// ────────────────────────────────────────────────────────────────────────────
function sesionDev(destino: string, env: Record<string, string>): string {
  const tenant = env.VITE_TENANT || TENANT_PRUEBAS;
  const secreto = destino === "nube"
    ? (env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET)
    : secretoNodo();
  if (!secreto) {
    const falta = destino === "nube" ? "SUPABASE_JWT_SECRET" : ".nodo/nodo.env";
    console.warn(`[tpv] sin sesión de dev (${destino}): falta ${falta}. El TPV arrancará en modo demo.`);
    return "";
  }
  const dev = "11111111-1111-4111-8111-111111111111";
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: dev, aud: "authenticated", role: "authenticated",
    tenant_id: tenant, device_id: dev, user_rol: null, is_platform_admin: false,
    iat: now, exp: now + 10 * 365 * 24 * 3600,
  };
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(claims);
  const firma = crypto.createHmac("sha256", secreto).update(`${h}.${p}`).digest("base64url");
  return JSON.stringify({ access_token: `${h}.${p}.${firma}`, device_id: dev, device_nombre: "TPV Pruebas (dev)" });
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, RAIZ, ""); // "" = TODAS las vars, incluida SUPABASE_JWT_SECRET (no-VITE)
  const destino = env.VITE_DESTINO || "nodo";
  const sesion = command === "serve" ? sesionDev(destino, env) : "";

  // Proxy solo hace falta en modo NODO (mismo origen). En nube, `BASE` es la URL
  // absoluta de Supabase y las peticiones van cross-origin (con CORS + apikey).
  const NODO = env.VITE_NODO_PROXY || "http://localhost:54321";
  const proxy = Object.fromEntries(
    // `/nodo` es el estado del servidor (Visor Node); el resto, datos y auth.
    ["/rest", "/auth", "/storage", "/realtime", "/nodo"].map((p) => [p, { target: NODO, changeOrigin: true }]),
  );

  return {
    base: "/",
    plugins: [react(), tailwindcss()],
    // Inyectadas en el cliente. En build de producción: destino "nodo", sin
    // sesión de dev y sin URL/anon de nube (queda todo "").
    define: {
      "import.meta.env.VITE_DESTINO": JSON.stringify(destino),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(destino === "nube" ? (env.VITE_SUPABASE_URL || NUBE_URL) : ""),
      "import.meta.env.VITE_SUPABASE_ANON": JSON.stringify(destino === "nube" ? (env.VITE_SUPABASE_ANON || NUBE_ANON) : ""),
      "import.meta.env.VITE_DEV_SESION": JSON.stringify(sesion),
    },
    build: {
      outDir: "dist", sourcemap: true,
      // Las fotos del catálogo (webp) son cientos y casi todas < 4 KB: con el inline
      // por defecto acabarían en base64 DENTRO del JS, inflándolo y sin poder
      // cachearlas por separado. Se fuerzan a fichero para que el navegador las pida
      // on-demand (solo las que se ven) y las guarde en caché. El resto de assets
      // pequeños (iconos sueltos) mantienen el inline por defecto de 4 KB.
      assetsInlineLimit: (ruta: string) => (ruta.includes("/catalogo/") ? false : undefined),
    },
    server: { port: 3120, proxy },
  };
});
