"use client";

import { useState, useTransition } from "react";
import { type Season, SEASONS } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { QuizQuestions } from "./quiz-questions";
import { savePalette, skipColorimetria } from "./actions";

// CONTENIDO (no tokens): la intro DEMUESTRA qué es la colorimetría con muestras
// de ropa. Dos tonos claramente distintos, uno cálido y uno frío. Son datos
// ilustrativos —como una imagen—, por eso van hardcodeados y NO como tokens.
const TONO_CALIDO = "#c9563f"; // terracota
const TONO_FRIO = "#8e9b6b"; // olivo

// Las FAMILIAS de color: las paletas REALES del test (SEASONS), SIN nombrar
// estación. Mostrar varias —no una— es lo honesto: una sola se leería como "estos
// son TUS colores" antes de responder nada; varias dicen "el color viene en
// familias, la tuya sale del test". Orden cálido/frío alternado para que se lean
// distintas. El reveal sí nombra la estación; aquí es vocabulario interno.
const FAMILIAS: string[][] = (["primavera", "otono", "verano", "invierno"] as const).map(
  (s) => SEASONS[s].colores.map((c) => c.hex)
);

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

          {/* Las familias de color (SIN nombrar estación). La etiqueta deja claro
              que son ejemplos, no un veredicto — la tuya sale del test. Así no se
              lee como "estos son TUS colores" antes de responder. */}
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-[11px] font-semibold leading-snug text-muted">
              el color viene en familias — el test encuentra la tuya
            </p>
            <div className="flex flex-col gap-1.5">
              {FAMILIAS.map((fam, i) => (
                <div key={i} className="flex h-5 overflow-hidden rounded-sm">
                  {fam.map((hex) => (
                    <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Costo declarado, sobre hairline (se fue la placa dorada suelta). */}
          <div className="mt-3.5 border-t border-line pt-3 text-center text-xs font-semibold text-muted">
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
