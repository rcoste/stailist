"use client";

import { useState, useTransition } from "react";
import { type Season } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { QuizQuestions } from "./quiz-questions";
import { savePalette } from "./actions";

export function Quiz() {
  const [result, setResult] = useState<{
    season: Season;
    flow: Season | null;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(finalAnswers: Record<string, string>) {
    setAnswers(finalAnswers);
    startTransition(async () => {
      setError(null);
      const res = await savePalette(finalAnswers);
      if ("error" in res) setError(res.error);
      else setResult({ season: res.season, flow: res.flow });
    });
  }

  if (result) {
    return <SeasonReveal season={result.season} flow={result.flow} />;
  }

  if (pending) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="editorial text-lg text-ink">leyendo tus colores…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <p className="text-base text-error">{error}</p>
        <button
          type="button"
          onClick={() => submit(answers)}
          className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return <QuizQuestions onComplete={submit} />;
}
