import { defineConfig } from "vitest/config";

// Solo módulos puros (validación fiscal). Los controladores de Nest necesitarían
// el contexto de test de Nest; hoy no hace falta.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
