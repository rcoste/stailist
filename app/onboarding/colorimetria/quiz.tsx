"use client";

import { useState, useTransition } from "react";
import { type Season } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { QuizQuestions } from "./quiz-questions";
import { savePalette, skipColorimetria } from "./actions";

// CONTENIDO (no tokens): la intro DEMUESTRA qué es la colorimetría con muestras
// de ropa. Dos tonos claramente distintos, uno cálido y uno frío; abajo la
// paleta que el test anticipa. Son datos ilustrativos —como una imagen—, por eso
// van hardcodeados y NO como tokens del design system.
const TONO_CALIDO = "#c9563f"; // terracota
const TONO_FRIO = "#8e9b6b"; // olivo
const PALETA_DEMO = ["#c9563f", "#e0a33e", "#7d4a2e", "#2f4858", "#d8cbb4", "#1b1b1b"];

// Un "campo" de la demostración: el tono como fondo, una silueta (la cara sin
// dibujarla) y la etiqueta. El que apaga baja a saturate(.28) — no opacidad ni
// gris total, para que se lea "el mismo tono, apagado".
function ColorFace({
  color,
  ilumina,
  label,
  onClick,
}: {
  color: string;
  ilumina: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ilumina}
      className="relative flex aspect-[1/1.16] items-end justify-center p-3.5 transition-[filter] duration-300"
      style={{ backgroundColor: color, filter: ilumina ? undefined : "saturate(0.28)" }}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-[14%] aspect-square w-[52%] -translate-x-1/2 rounded-full bg-tile"
        style={{ border: "1px solid rgb(255 255 255 / 0.5)" }}
      />
      {/* Scrim de legibilidad de la etiqueta (contenido de la demo, no token). */}
      <span
        className="relative z-[2] px-[9px] py-[5px] text-[10.5px] font-bold uppercase tracking-[0.1em] text-white"
        style={{ backgroundColor: ilumina ? "rgb(20 20 20 / 0.72)" : "rgb(20 20 20 / 0.42)" }}
      >
        {label}
      </span>
    </button>
  );
}

export function Quiz() {
  // Cuál de los dos campos "favorece" (el otro se apaga). Se puede invertir
  // tocando cualquiera — enseña el concepto sin explicarlo.
  const [iluminaIzq, setIluminaIzq] = useState(true);
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

  // Intro: enseñar qué es la colorimetría (no explicarlo) + salida opcional.
  if (!started) {
    return (
      <div className="flex flex-1 flex-col">
        <p className="font-display text-[19px] italic leading-[26px] text-muted">
          Hay tonos que te encienden la cara y otros que te la apagan. Quiero
          saber cuáles son los tuyos.
        </p>

        {/* La demostración, centrada en el aire libre (márgenes auto): el par de
            campos + la paleta que anticipa el reveal + el costo declarado. */}
        <div className="my-auto">
          <div className="grid grid-cols-2 gap-3.5">
            <ColorFace
              color={TONO_CALIDO}
              ilumina={iluminaIzq}
              label={iluminaIzq ? "te ilumina" : "te apaga"}
              onClick={() => setIluminaIzq(true)}
            />
            <ColorFace
              color={TONO_FRIO}
              ilumina={!iluminaIzq}
              label={iluminaIzq ? "te apaga" : "te ilumina"}
              onClick={() => setIluminaIzq(false)}
            />
          </div>

          {/* La paleta que produce el test — sin gap ni bordes, a lo ancho. */}
          <div className="mt-5 flex h-[52px]">
            {PALETA_DEMO.map((hex) => (
              <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
            ))}
          </div>

          {/* Costo declarado + la placa metálica (la firma de colorimetría). */}
          <div className="mt-3.5 flex items-center gap-2.5 text-xs font-semibold text-muted">
            <span
              aria-hidden
              className="h-[22px] w-[22px] shrink-0"
              style={{ background: "var(--metal-oro)" }}
            />
            cinco preguntas · cuarenta segundos · sin foto
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-4">
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
            ahora no
          </button>
        </div>
      </div>
    );
  }

  return <QuizQuestions onComplete={submit} />;
}
