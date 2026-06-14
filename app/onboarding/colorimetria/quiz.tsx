"use client";

import { useState, useTransition } from "react";
import { QUIZ, type Season } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { savePalette } from "./actions";

export function Quiz() {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ season: Season; flow: Season | null } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const question = QUIZ[qIndex];

  function submit(finalAnswers: Record<string, string>) {
    startTransition(async () => {
      setError(null);
      const res = await savePalette(finalAnswers);
      if ("error" in res) setError(res.error);
      else setResult({ season: res.season, flow: res.flow });
    });
  }

  function answer(optionId: string) {
    if (pending || result) return;
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (qIndex < QUIZ.length - 1) setQIndex(qIndex + 1);
    else submit(next);
  }

  if (result) {
    return <SeasonReveal season={result.season} flow={result.flow} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <p className="text-base text-error">{error}</p>
        <button
          type="button"
          onClick={() => submit(answers)}
          disabled={pending}
          className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (pending) {
    return (
      <p className="editorial pt-8 text-center text-lg text-ink">
        leyendo tus colores…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="tabular text-sm text-muted">
        {qIndex + 1} de {QUIZ.length}
      </p>
      <h2 className="text-h2 font-semibold text-ink">{question.question}</h2>
      <div className="flex flex-col gap-3">
        {question.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => answer(o.id)}
            className="flex min-h-14 items-center rounded-2xl border border-line bg-surface px-5 text-left text-base text-ink transition-colors duration-200 hover:border-accent focus-visible:border-accent focus-visible:outline-none"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
