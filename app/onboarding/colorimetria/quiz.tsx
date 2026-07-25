"use client";

import { useState, useTransition } from "react";
import { type Season } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { QuizQuestions } from "./quiz-questions";
import { savePalette, skipColorimetria } from "./actions";

export function Quiz() {
  // Intro opcional: la colorimetría NO es gatekeep. Primero vendemos su valor y
  // dejamos saltarla (se puede llenar después desde Perfil).
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<{
    season: Season;
    flow: Season | null;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [skipping, startSkip] = useTransition();

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
        <p className="text-lg font-medium text-ink">leyendo tus colores…</p>
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

  // Intro: por qué la colorimetría vale la pena + salida opcional.
  if (!started) {
    return (
      <div className="flex flex-1 flex-col">
        <p className="text-[15px] leading-relaxed text-muted">
          Tus colores son mi mejor pista para acertar: elijo los que{" "}
          <b className="text-ink">te iluminan la cara</b> y esquivo los que te
          apagan. Son unas preguntas rápidas — sin selfie ni foto, solo tú
          respondiendo.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-faint">
          Es opcional: puedes saltarla y agregarla después desde tu perfil. Sin
          ella igual te armo looks, solo que sin afinar el color a tu cara.
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            va, hagámoslo <Icon name="flecha" size={18} />
          </button>
          <button
            type="button"
            disabled={skipping}
            onClick={() => startSkip(async () => { await skipColorimetria(); })}
            className="min-h-11 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            ahora no, lo hago después
          </button>
        </div>
      </div>
    );
  }

  return <QuizQuestions onComplete={submit} />;
}
