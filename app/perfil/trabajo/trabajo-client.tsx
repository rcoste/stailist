"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WORK_DRESS_CODES, ropaDeDressCode } from "@/lib/dress-code";
import { guardarDressCode } from "./actions";

// Elegir (o cambiar) cómo te vistes para trabajar.
//
// La ROPA es el titular y la jerga la pista, igual que en la formalidad del
// evento: "business casual" no le dice nada a mucha gente y "camisa o polo, sin
// saco" sí. Y va por género, porque el ancla concreta lo es.
export function TrabajoClient({
  actual,
  gender,
  desdeElQuiz,
  returnTo,
}: {
  actual: string | null;
  gender: "hombre" | "mujer" | null;
  /**
   * Lo que ya dijo en el quiz de estilo de vida ("oficina creativa o casual").
   * Se muestra para que la pregunta no se sienta repetida: aquella describe la
   * FORMA de su semana y esta el REGISTRO de su ropa, que es más fino — es la
   * distinción que a Roberto le faltó para poder calificar ("depende del tipo
   * de oficina").
   */
  desdeElQuiz: string | null;
  returnTo: string;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<string | null>(actual);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (code: string) => {
    if (guardando) return;
    setElegido(code);
    setGuardando(true);
    setError(null);
    const r = await guardarDressCode(code);
    setGuardando(false);
    if (!r.ok) {
      setElegido(actual);
      setError(r.error ?? "no se pudo guardar");
      return;
    }
    router.push(returnTo);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-semibold text-ink">¿Cómo te vistes para trabajar?</h1>
        <p className="font-display text-[18px] italic leading-[25px] text-muted">
          Así no te armo un look de banco si vas a una agencia.
        </p>
      </div>

      {desdeElQuiz ? (
        <p className="rounded-sm border border-line bg-surface p-3 text-[13px] leading-relaxed text-muted">
          Me dijiste que tu día es <span className="font-semibold text-ink">{desdeElQuiz}</span>.
          Esto es lo que me falta: qué significa eso <span className="italic">en ropa</span>.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {WORK_DRESS_CODES.map((d) => {
          const on = elegido === d.key;
          return (
            <button
              key={d.key}
              type="button"
              disabled={guardando}
              onClick={() => guardar(d.key)}
              aria-pressed={on}
              className={`flex flex-col items-start rounded-sm border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                on
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line bg-surface text-ink hover:border-ink"
              }`}
            >
              <span className="text-[15px] font-semibold">{ropaDeDressCode(d, gender)}</span>
              <span className={`text-[13px] ${on ? "opacity-80" : "text-muted"}`}>
                {d.ejemplos}
              </span>
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      <p className="text-xs leading-relaxed text-muted">
        Puedes cambiarlo cuando quieras — si cambias de chamba, cámbialo aquí.
      </p>
    </div>
  );
}
