import { defineConfig } from "vitest/config";

// Solo módulos PUROS del TPV (precio, claves de línea…): nada de jsdom ni
// componentes — los ficheros bajo test no importan React.
export default defineConfig({
  test: { include: ["app/**/*.test.ts"] },
});
