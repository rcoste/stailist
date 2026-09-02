import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Carpetas que NO son código del proyecto. Sin esto el lint reporta ~46 000
    // problemas de copias de trabajo y handoffs de diseño, y los ~40 errores
    // reales del proyecto quedan sepultados (nadie lee la salida). vitest ya
    // las excluye en vitest.config.ts — esta es la misma lista.
    ".claude/**",
    "claude-design-handoffs-stailist/**",
    "design_handoff_crear_un_look/**",
  ]),
]);

export default eslintConfig;
