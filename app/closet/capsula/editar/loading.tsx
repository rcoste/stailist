import { GeneratingScreen } from "@/components/generating-screen";

// Mientras la página genera las preguntas de estilo personalizadas (solo la 1ª vez;
// después están cacheadas). Mismo lenguaje-como-progreso que el resto.
export default function Loading() {
  return (
    <GeneratingScreen
      phrases={[
        { a: "leyendo tu ", k: "estilo", b: "…" },
        { a: "afinando tus ", k: "preguntas", b: "…" },
        { a: "personalizando tu ", k: "cápsula", b: "…" },
      ]}
    />
  );
}
