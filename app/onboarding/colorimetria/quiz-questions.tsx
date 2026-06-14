"use client";

import { useState } from "react";
import { QUIZ } from "@/lib/colorimetria";

// Stepper presentacional del quiz: camina las 6 preguntas y devuelve las
// respuestas. NO guarda ni revela — eso lo decide quien lo usa (el quiz solo, o
// el flujo de foto que lo corre en paralelo al análisis). `header` opcional
// aparece arriba (ej. el aviso de "leyendo en segundo plano").
export function QuizQuestions({
  onComplete,
  header,
}: {
  onComplete: (answers: Record<string, string>) => void;
  header?: React.ReactNode;
}) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = QUIZ[qIndex];

  function answer(optionId: string) {
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    if (qIndex < QUIZ.length - 1) setQIndex(qIndex + 1);
    else onComplete(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
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
