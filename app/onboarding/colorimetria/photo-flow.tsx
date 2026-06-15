"use client";

import { useRef, useState } from "react";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { QuizQuestions } from "./quiz-questions";
import { savePaletteFromPhoto } from "./actions";
import {
  computeSeasonWithFlow,
  mergeColorimetria,
  type Season,
} from "@/lib/colorimetria";

// Resultado reconciliado del ensemble (Claude + Gemini) que devuelve la API.
type FotoResult =
  | { kind: "confident"; season: Season; confianza: "alta" | "media"; por_que: string }
  | { kind: "border"; season: Season; flow: Season; por_que: string }
  | { kind: "baja"; por_que: string };

type State =
  | { kind: "idle" }
  | { kind: "quiz" } // el quiz ES la pantalla de carga; el análisis corre por debajo
  | { kind: "juntando" } // quiz listo, esperando a que el análisis resuelva
  | { kind: "reveal"; season: Season; flow: Season | null; nota: string }
  | { kind: "baja"; por_que: string }
  | { kind: "error" };

// Comprime la selfie en el navegador antes de subir (las fotos de teléfono
// pesan 5-10MB). Redimensiona a 1024px y JPEG: suficiente para leer color.
function comprimir(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const max = 1024;
      let { width, height } = img;
      if (width > height && width > max) {
        height = (height * max) / width;
        width = max;
      } else if (height > max) {
        width = (width * max) / height;
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function fetchAnalysis(image: string): Promise<FotoResult | null> {
  try {
    const res = await fetch("/api/colorimetria-foto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    if (!res.ok) return null;
    const { result } = (await res.json()) as { result: FotoResult };
    return result;
  } catch {
    return null;
  }
}

export function PhotoFlow({ onUseQuiz }: { onUseQuiz: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  // El análisis arranca al subir la foto y corre en segundo plano mientras la
  // persona contesta el quiz. Lo guardamos como promesa para esperarlo al final.
  const analysisRef = useRef<Promise<FotoResult | null> | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    try {
      const image = await comprimir(file);
      analysisRef.current = fetchAnalysis(image); // arranca, no esperamos
      setState({ kind: "quiz" }); // el quiz es la pantalla de carga
    } catch {
      setState({ kind: "error" });
    }
  }

  // Cierra el flujo: junta el análisis (ya corriendo) con el quiz (o sin él).
  async function finalize(quiz: { season: Season; flow: Season | null } | null) {
    setState({ kind: "juntando" });
    const analysis = await (analysisRef.current ?? Promise.resolve(null));
    const merged = mergeColorimetria(analysis, quiz);

    if (!merged) {
      if (analysis && analysis.kind === "baja") {
        setState({ kind: "baja", por_que: analysis.por_que });
      } else {
        setState({ kind: "error" });
      }
      return;
    }

    const usableFoto = analysis && analysis.kind !== "baja";
    const source = quiz ? (usableFoto ? "foto+quiz" : "quiz") : "foto";
    const por_que =
      analysis && analysis.kind !== "baja" ? analysis.por_que : "";
    const confianza =
      analysis && analysis.kind === "confident" ? analysis.confianza : "media";

    const saved = await savePaletteFromPhoto(merged.season, merged.flow, {
      confianza,
      por_que,
      border: !!merged.flow,
      source,
    });
    if (!saved.ok) {
      setState({ kind: "error" });
      return;
    }

    const nota = !usableFoto
      ? "Lo saqué de tus respuestas — la luz de la foto no ayudó. Ajústalo si quieres."
      : merged.flow
        ? "Lo leí de tu selfie y tus respuestas — estás en la frontera, así que te muestro tus dos lados. Ajústalo si quieres."
        : "Lo leí de tu selfie y tus respuestas.";

    setState({ kind: "reveal", season: merged.season, flow: merged.flow, nota });
  }

  if (state.kind === "reveal") {
    return (
      <SeasonReveal season={state.season} flow={state.flow} nota={state.nota} />
    );
  }

  if (state.kind === "quiz") {
    return (
      <div className="flex flex-col gap-4">
        <QuizQuestions
          onComplete={(a) => finalize(computeSeasonWithFlow(a))}
          header={
            <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-2 text-sm text-ink">
              <Spinner className="h-4 w-4" />
              <span>
                Leyendo tus colores en segundo plano… mientras, afina con estas
                preguntas.
              </span>
            </div>
          }
        />
        <button
          type="button"
          onClick={() => finalize(null)}
          className="text-center text-sm text-muted underline"
        >
          Saltar — usa solo mi selfie
        </button>
      </div>
    );
  }

  if (state.kind === "juntando") {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="editorial text-lg text-ink">juntando todo…</p>
      </div>
    );
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      onChange={onFile}
      className="hidden"
    />
  );

  if (state.kind === "baja") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-base text-ink">
          La luz no me dejó leerte bien los colores. Prueba otra junto a una
          ventana (sin filtros), o mejor responde el quiz.
        </p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-12 flex-1 rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
          >
            Otra selfie
          </button>
          <button
            type="button"
            onClick={onUseQuiz}
            className="min-h-12 flex-1 rounded-full bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Hacer el quiz
          </button>
        </div>
        {input}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-base text-ink">
          Algo se atoró al leer tu foto. Inténtalo otra vez o usa el quiz.
        </p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-12 flex-1 rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={onUseQuiz}
            className="min-h-12 flex-1 rounded-full bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Hacer el quiz
          </button>
        </div>
        {input}
      </div>
    );
  }

  // idle: guía + botón
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium text-ink">
          Para leer bien tus colores:
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-muted">
          <li>• Ponte junto a una ventana, con luz de día.</li>
          <li>• Sin filtros ni maquillaje pesado.</li>
          <li>• Cara despejada, sin gorra ni lentes.</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="min-h-12 w-full rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        Tomar o subir selfie
      </button>
      <button
        type="button"
        onClick={onUseQuiz}
        className="text-center text-sm text-muted underline"
      >
        Mejor respondo el quiz
      </button>
      {input}
    </div>
  );
}
