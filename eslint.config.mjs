// ESLint 9 (flat config) — UN solo config para todo el monorepo.
//
// Antes no había NINGUNO: `next lint` se eliminó en Next 16 y los 8 paquetes
// tenían `"lint": "echo (lint pendiente)"`, así que `pnpm lint` salía en verde
// sin analizar una sola línea de ~30k de TypeScript.
//
// Criterio: reglas que cazan BUGS en ERROR; ruido de estilo en WARN (o fuera).
// El objetivo es que `pnpm lint` falle solo cuando hay algo de verdad.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist-instalador/**",
      "**/next-env.d.ts",
      "apps/desktop/dist/**",
      ".claude/**",   // worktrees de sesiones antiguas: copias del repo, no fuente
      ".nodo/**",     // spike del nodo: binarios portables + código fuente de Go
      ".agents/**",   // skills del proyecto, no código de la app
    ],
  },

  // `catch {}` vacío es deliberado en varios sitios (best-effort); no es un bug.
  { rules: { "no-empty": ["warn", { allowEmptyCatch: true }] } },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Entornos: sin esto, `console`/`process`/`fetch` salían como "no definidos".
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2024 },
    },
  },

  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // no-undef sobra en TypeScript: `tsc` ya caza los identificadores inexistentes
      // (y aquí solo produce falsos positivos con los tipos globales).
      "no-undef": "off",
      // ── Ruido asumido (el repo ya es TS estricto: tsc cubre lo importante) ──
      "@typescript-eslint/no-explicit-any": "off",        // hay `any` acotados y comentados
      "@typescript-eslint/no-unused-vars": [
        "warn",
        // El patrón `const { [k]: _, ...resto } = obj` (borrar clave) es idiomático aquí.
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],    // `catch {}` deliberados

      // ── Lo que sí queremos que ROMPA la build ──
      "no-console": "off",                                 // se usa a propósito en errores
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "no-fallthrough": "error",
      "no-unsafe-optional-chaining": "error",
      "require-atomic-updates": "off",                     // demasiados falsos positivos con setState
      // Regla de limpieza, no de bugs. Los 4 casos del repo son el patrón benigno
      // `let x = []` reasignado en todas las ramas (auditados uno a uno el 12-07).
      "no-useless-assignment": "warn",
    },
  },

  // ── React (solo el front) ──
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": next },
    rules: {
      ...next.configs.recommended.rules,
      // Romper esto SÍ es un bug real (hooks condicionales = estado corrupto).
      "react-hooks/rules-of-hooks": "error",
      // Aviso: hay `eslint-disable` deliberados donde las deps se leen por getState/ref.
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",                  // <img> intencional (ver plan 014)
    },
  },

  // ── Tests: más laxos ──
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "@typescript-eslint/no-unused-expressions": "off" },
  },

  // ── Config y scripts sueltos (Node) ──
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
