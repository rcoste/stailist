import { defineConfig } from "vitest/config";
import path from "node:path";

// Resuelve el alias "@/..." (el mismo de tsconfig.json) para que los tests
// puedan importar módulos que usan imports absolutos del proyecto.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    // `.claude/worktrees` son copias del repo que crean las tareas en segundo
    // plano. Sin excluirlas, vitest corre TAMBIÉN sus tests: el conteo se
    // dispara (se vio pasar de 464 a 541 con una tarea abierta) y una suite en
    // verde puede venir de código que no es el que estás editando. Peor: una
    // rama con tests rotos pintaría de rojo un árbol sano.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/**"],
  },
});
