"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { QUIZ, SEASONS, type Season } from "@/lib/colorimetria";
import { savePalette } from "./actions";

export function Quiz() {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [season, setSeason] = useState<Season | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const question = QUIZ[qIndex];

  function submit(finalAnswers: Record<string, string>) {
    startTransition(async () => {
      setError(null);
      const res = await savePalette(finalAnswers);
      if ("error" in res) setError(res.error);
      else setSeason(res.season);
    });
  }

  function answer(optionId: string) {
    if (pending || season) return;
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (qIndex < QUIZ.length - 1) setQIndex(qIndex + 1);
    else submit(next);
  }

  // El reveal: la línea en cristiano lidera, la estación es nota al pie.
  if (season) {
    const s = SEASONS[season];
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 font-semibold text-ink">{s.reveal}</h2>
          <p className="text-sm text-muted">
            Tu paleta es tipo {s.label} — así la llamamos por acá. El stylist
            la usa para que cada look te favorezca.
          </p>
        </div>
        <div className="flex gap-2">
          {s.colores.map((c) => (
            <div key={c.nombre} className="flex flex-1 flex-col gap-1">
              <span
                className="h-12 rounded-lg border border-line"
                style={{ backgroundColor: c.hex }}
                title={c.nombre}
              />
              <span className="text-center text-xs text-muted">
                {c.nombre}
              </span>
            </div>
          ))}
        </div>
        <Link
          href="/onboarding/closet"
          className="flex min-h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Vamos con tu clóset
        </Link>
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
