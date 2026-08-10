"use client";

import { useState, useTransition } from "react";
import { type Season } from "@/lib/colorimetria";
import { SeasonReveal } from "@/components/season-reveal";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { QuizQuestions } from "./quiz-questions";
import { savePalette, skipColorimetria } from "./actions";

// CONTENIDO (no tokens): la intro DEMUESTRA qué es la colorimetría con muestras
// de ropa. Dos tonos claramente distintos, uno cálido y uno frío. Son datos
// ilustrativos —como una imagen—, por eso van hardcodeados y NO como tokens.
// Los dos tonos de la demo son CONTENIDO —muestras de tela—, no tokens de
// marca: hacen falta uno cálido y uno frío claramente distintos para que la
// diferencia se vea. OJO PENDIENTE: el cálido es terracota, y Roberto tiene
// vetado ámbar/terracota/naranja en la identidad. Viene heredado del diseño
// anterior (no lo introdujo el handoff); queda señalado para decidir si se
// cambia por un cálido fuera de esa familia (un vino, por ejemplo).
const TONO_CALIDO = "#b6532f"; // terracota — ver nota de arriba
const TONO_FRIO = "#96a08c"; // salvia

/** Lo que el test devuelve, adelantado. Es lo mismo que pinta el reveal:
 *  paleta, lo que apaga y el metal (`metalForSeason`), así que la promesa es
 *  comprobable y no marketing. */
const ENTREGA: {
  titulo: string;
  desc: string;
  muestras?: string[];
  apagados?: boolean;
  metal?: boolean;
}[] = [
  {
    titulo: "tu paleta",
    desc: "los colores que te encienden",
    muestras: ["#141414", "#274690", "#8e1f3a", "#1f6e52"],
  },
  {
    titulo: "qué evitar",
    desc: "los tonos que te apagan",
    muestras: ["#b08d57", "#c2984e", "#8a9a6b", "#d9c9a3"],
    apagados: true,
  },
  { titulo: "tu metal", desc: "oro o plata", metal: true },
];

// Un "campo" de la demostración: el tono como fondo, una silueta (la cara sin
// dibujarla) y la etiqueta. El que apaga baja a saturate(.28) — no opacidad ni
// gris total, para que se lea "el mismo tono, apagado".
/** Un campo de la demo: la misma cara con un color al lado, y su veredicto ya
 *  puesto.
 *
 *  YA NO ES UN BOTÓN, y ése es el arreglo. Antes cada campo tenía `onClick` y
 *  tocarlo invertía cuál "ilumina": dos opciones lado a lado con etiquetas
 *  cortas, en un onboarding donde TODAS las demás pantallas de dos opciones son
 *  una pregunta. Se leía como una — y peor, dejaba "contestarla": podías hacer
 *  que cualquiera de los dos colores fuera el que favorece, que enseña justo lo
 *  contrario de la verdad (cuál te favorece es un hecho sobre ti, no una
 *  elección).
 *
 *  No es teoría: mi propio recorrido automatizado del onboarding se atoró aquí
 *  clicando "TE ILUMINA" y "TE APAGA" como si fueran las opciones a responder,
 *  y se quedó dando vueltas en la portada sin llegar al test.
 *
 *  Ahora el veredicto viene dado (✓/✗) y la única acción de la pantalla es el
 *  CTA. Handoff `design_handoff_colorimetria_intro`. */
function ColorFace({
  color,
  ilumina,
  label,
}: {
  color: string;
  ilumina: boolean;
  label: string;
}) {
  return (
    <div
      aria-hidden
      className="relative flex aspect-[1/0.82] items-end justify-center rounded-lg p-2.5"
      style={{
        backgroundColor: color,
        // El que apaga se DESATURA un punto, nunca gris total ni opacidad: la
        // demo tiene que seguir leyéndose como dos telas, no como una activa y
        // otra deshabilitada.
        filter: ilumina ? undefined : "saturate(0.7) brightness(0.94)",
      }}
    >
      <span
        className="absolute left-1/2 top-[18%] aspect-square w-[46%] -translate-x-1/2 rounded-full"
        style={{
          backgroundColor: ilumina ? "#f8f5f0" : "#e7e2da",
          boxShadow: ilumina ? "0 0 22px 6px rgb(255 250 240 / 0.55)" : undefined,
        }}
      />
      <span
        className="relative z-[2] flex items-center gap-1 rounded-[4px] px-[7px] py-[4px] text-[10px] font-bold uppercase tracking-[0.1em] text-white"
        style={{ backgroundColor: "rgb(20 20 20 / 0.55)" }}
      >
        <Icon name={ilumina ? "check" : "equis"} size={10} />
        {label}
      </span>
    </div>
  );
}

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

  // Intro: enseñar qué es la colorimetría (no explicarlo) + salida opcional.
  if (!started) {
    return (
      <div className="flex flex-1 flex-col">
        {/* LA DEMO, con su veredicto puesto y sin nada tocable. */}
        <div className="my-auto flex flex-col gap-4">
          <p className="text-sm text-muted">mira lo que hace un color equivocado:</p>

          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
            <div className="grid grid-cols-2 gap-2.5">
              <ColorFace color={TONO_CALIDO} ilumina label="te enciende" />
              <ColorFace color={TONO_FRIO} ilumina={false} label="te apaga" />
            </div>
            {/* La leyenda es la tercera defensa contra "esto es una pregunta":
                dice en voz alta que es un ejemplo y qué está variando. */}
            <p className="text-center text-xs leading-snug text-muted">
              <strong className="font-semibold text-ink">es la misma persona</strong> — solo
              cambia el color de al lado.
            </p>
          </div>

          {/* QUÉ TE LLEVAS, que es lo que decide si vale los 40 segundos.
              Las tres filas son lo MISMO que entrega el reveal, adelantado: la
              paleta, lo que te apaga y el metal (metalForSeason ya se pinta
              ahí). Sustituye a las tiras de "familias de color", que explicaban
              un concepto en vez de vender un resultado.

              SIN NÚMEROS a propósito ("los colores", no "los 5"): la paleta sale
              con más o menos tonos según la persona. */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
              el test te entrega
            </p>
            {ENTREGA.map((e) => (
              <div
                key={e.titulo}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                {e.metal ? (
                  <span
                    className="h-[18px] w-[26px] shrink-0 rounded-[3px]"
                    style={{ background: "linear-gradient(135deg,#e6e8ea,#b9bdc1 48%,#8f9398)" }}
                    aria-hidden
                  />
                ) : (
                  <span
                    className="flex h-[18px] w-[26px] shrink-0 overflow-hidden rounded-[3px]"
                    style={{ opacity: e.apagados ? 0.45 : 1 }}
                    aria-hidden
                  >
                    {e.muestras!.map((hex) => (
                      <i key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                    ))}
                  </span>
                )}
                <span className="text-[13.5px] font-bold text-ink">{e.titulo}</span>
                <span className="ml-auto text-right text-xs text-muted">{e.desc}</span>
              </div>
            ))}
          </div>

          {/* Costo declarado. SEIS y no cinco: son seis preguntas de verdad
              (venas, sol, cabello, ojos, metal, cumplidos) y el copy decía
              cinco — un número que miente en la pantalla que pide permiso. */}
          <div className="border-t border-line pt-3 text-center text-xs font-semibold text-muted">
            seis preguntas · cuarenta segundos · sin foto
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-4">
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
          >
            encontrar mis colores <Icon name="flecha" size={18} />
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
