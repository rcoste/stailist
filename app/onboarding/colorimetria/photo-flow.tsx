"use client";

import { useRef, useState } from "react";
import { SeasonReveal } from "@/components/season-reveal";
import { savePaletteFromPhoto } from "./actions";
import type { Season } from "@/lib/colorimetria";

type Analisis = {
  estacion: Season;
  confianza: "alta" | "media" | "baja";
  por_que: string;
  calidad_foto: string;
};

type State =
  | { kind: "idle" }
  | { kind: "analizando" }
  | { kind: "reveal"; season: Season; confianza: string }
  | { kind: "baja"; por_que: string }
  | { kind: "error" };

// Comprime la selfie en el navegador antes de subir (las fotos de teléfono
// pesan 5-10MB). Redimensiona a 1024px y JPEG: suficiente para leer color.
function comprimir(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
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

export function PhotoFlow({ onUseQuiz }: { onUseQuiz: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ kind: "analizando" });
    try {
      const image = await comprimir(file);
      const res = await fetch("/api/colorimetria-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) {
        setState({ kind: "error" });
        return;
      }
      const { analisis } = (await res.json()) as { analisis: Analisis };
      if (analisis.confianza === "baja") {
        setState({ kind: "baja", por_que: analisis.por_que });
        return;
      }
      // Confianza alta/media: guardamos y revelamos.
      const saved = await savePaletteFromPhoto(analisis.estacion, {
        confianza: analisis.confianza,
        por_que: analisis.por_que,
      });
      if (!saved.ok) {
        setState({ kind: "error" });
        return;
      }
      setState({
        kind: "reveal",
        season: analisis.estacion,
        confianza: analisis.confianza,
      });
    } catch {
      setState({ kind: "error" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (state.kind === "reveal") {
    return (
      <SeasonReveal
        season={state.season}
        nota={
          state.confianza === "media"
            ? "Lo leí de tu selfie. La luz no estaba perfecta — si quieres afinar, puedes hacer el quiz."
            : "Lo leí de tu selfie."
        }
      />
    );
  }

  if (state.kind === "analizando") {
    return (
      <p className="editorial pt-8 text-center text-lg text-ink">
        leyendo tus colores…
      </p>
    );
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="user"
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
