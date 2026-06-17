"use client";

import { useActionState, useState } from "react";
import { ASSESSMENT_QUESTIONS, type LifestyleAnswers } from "@/lib/capsule";
import { saveLifestyle, type CapsuleState } from "./actions";
import { Spinner } from "@/components/spinner";

const INITIAL: CapsuleState = { status: "idle" };

export function CapsulaForm({ initial }: { initial: LifestyleAnswers }) {
  const [state, formAction, pending] = useActionState(saveLifestyle, INITIAL);
  const [answers, setAnswers] = useState<LifestyleAnswers>(initial);

  const complete = ASSESSMENT_QUESTIONS.every((q) => answers[q.id]);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {ASSESSMENT_QUESTIONS.map((q) => (
        <fieldset key={q.id} className="flex flex-col gap-3">
          <legend className="flex flex-col gap-0.5">
            <span className="text-base font-medium text-ink">{q.label}</span>
            {q.help ? <span className="text-sm text-muted">{q.help}</span> : null}
          </legend>
          <input type="hidden" name={q.id} value={answers[q.id] ?? ""} />
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => {
              const selected = answers[q.id] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                  className={`min-h-11 rounded-sm border px-4 text-sm font-medium transition-colors duration-200 ${
                    selected
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface text-ink hover:border-ink"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {state.status === "error" ? (
        <p className="text-sm text-error">{state.message}</p>
      ) : null}

      <button
        type="submit"
        disabled={!complete || pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
      >
        {pending ? (
          <>
            <Spinner className="h-4 w-4" /> Armando tu cápsula…
          </>
        ) : (
          "Ver mi cápsula"
        )}
      </button>
    </form>
  );
}
