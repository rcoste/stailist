"use client";

import { useState } from "react";
import { Quiz } from "./quiz";
import { PhotoFlow } from "./photo-flow";

// La colorimetría es OPCIONAL por foto: eliges selfie (rápida) o quiz (sin
// cámara). El quiz es el camino sin fricción para quien no quiere mostrar la
// cara o tiene mala luz.
type Modo = "elegir" | "foto" | "quiz";

export function ColorimetriaClient() {
  const [modo, setModo] = useState<Modo>("elegir");

  if (modo === "quiz") return <Quiz />;
  if (modo === "foto") return <PhotoFlow onUseQuiz={() => setModo("quiz")} />;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setModo("foto")}
        className="flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl border border-line bg-surface px-5 py-3 text-left transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
      >
        <span className="text-base font-medium text-ink">
          Adivínalo de una selfie
        </span>
        <span className="text-sm text-muted">
          Lo más rápido — la IA lee tus colores
        </span>
      </button>
      <button
        type="button"
        onClick={() => setModo("quiz")}
        className="flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-2xl border border-line bg-surface px-5 py-3 text-left transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
      >
        <span className="text-base font-medium text-ink">
          Responder 6 preguntas
        </span>
        <span className="text-sm text-muted">Sin cámara, igual de bueno</span>
      </button>
    </div>
  );
}
