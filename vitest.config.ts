import { defineConfig } from "vitest/config";
import path from "node:path";

// Resuelve el alias "@/..." (el mismo de tsconfig.json) para que los tests
// puedan importar módulos que usan imports absolutos del proyecto.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
