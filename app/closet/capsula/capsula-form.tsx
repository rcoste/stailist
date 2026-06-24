"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ASSESSMENT_QUESTIONS, type LifestyleAnswers } from "@/lib/capsule";
import { saveLifestyle, type CapsuleState } from "./actions";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { useWakeLock } from "@/lib/use-wake-lock";

const INITIAL: CapsuleState = { status: "idle" };

// Frases de "armando" de la cápsula (mismo lenguaje-como-progreso que Hoy/Viaje):
// reflejan que considera tu vida, tus colores y tu cuerpo — no solo un spinner.
const CAPSULE_PHRASES: GenPhrase[] = [
  { a: "leyendo tu ", k: "vida", b: "…" },
  { a: "cruzando tus ", k: "colores", b: "…" },
  { a: "afinando tu ", k: "silueta", b: "…" },
  { a: "armando tu ", k: "cápsula", b: "…" },
];

// Cuestionario paso a paso (handoff Screen 5): una pregunta a la vez, opciones
// grandes, progreso claro. El último paso envía las respuestas a saveLifestyle.
export function CapsulaForm({ initial }: { initial: LifestyleAnswers }) {
  const [state, formAction, pending] = useActionState(saveLifestyle, INITIAL);
  const [answers, setAnswers] = useState<LifestyleAnswers>(initial);
  const [step, setStep] = useState(0);
  // Pantalla despierta mientras se arma la cápsula (~27s).
  useWakeLock(pending);

  const total = ASSESSMENT_QUESTIONS.length;
  const q = ASSESSMENT_QUESTIONS[step];
  const last = step === total - 1;
  const answered = !!answers[q.id];

  // Guard anti-tap-reflejo: el botón de armar ocupa el MISMO lugar que "Siguiente"
  // y se transforma bajo el dedo al llegar al paso 5; un tap de inercia/doble-tap lo
  // dispararía sin querer. Lo bloqueamos ~700ms al LLEGAR. CLAVE: el candado se pone
  // de forma SÍNCRONA en el mismo batch que el cambio de paso (no en un useEffect,
  // que corre DESPUÉS del render y dejaba al botón nacer habilitado un instante —
  // esa ventana de carrera era el bug). El ref es el cinturón: aunque el `disabled`
  // tardara, el onClick lo lee síncrono y cancela el submit.
  const [armReady, setArmReady] = useState(true);
  const armReadyRef = useRef(true);
  const setArm = (v: boolean) => {
    armReadyRef.current = v;
    setArmReady(v);
  };
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setArm(true), 700);
    return () => clearTimeout(t);
  }, [last]);

  // Avanza un paso; si aterriza en el último, echa el candado YA (mismo batch que
  // setStep → el paso 5 nace con el botón deshabilitado, sin ventana de carrera).
  const goNext = () => {
    const n = Math.min(total - 1, step + 1);
    if (n === total - 1) setArm(false);
    setStep(n);
  };

  return (
    <>
      {/* Generando: overlay full-screen con frases que rotan (mismo que Hoy/Viaje),
          en vez del spinner del botón — el progreso es lenguaje. */}
      {pending ? <GeneratingScreen phrases={CAPSULE_PHRASES} /> : null}
      <form action={formAction} className="flex min-h-[calc(100dvh-7rem)] flex-col">
      {/* Respuestas de todos los pasos viajan como hidden inputs. */}
      {ASSESSMENT_QUESTIONS.map((qq) => (
        <input key={qq.id} type="hidden" name={qq.id} value={answers[qq.id] ?? ""} />
      ))}

      {/* Top: atrás + dots de progreso. */}
      <div className="flex items-center justify-between">
        {step === 0 ? (
          <Link
            href="/closet"
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Icon name="chevron" size={15} rotate={180} />
            Atrás
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <Icon name="chevron" size={15} rotate={180} />
            Atrás
          </button>
        )}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-[7px] rounded-full transition-all duration-200 ${
                i === step ? "w-5 bg-accent" : "w-[7px] bg-line"
              }`}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-muted">
        Paso {step + 1} de {total}
      </p>

      {/* Pregunta + opciones. */}
      <div className="mt-5 flex flex-1 flex-col">
        <h1 className="display text-[25px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
          {q.label}
        </h1>
        {q.help ? <p className="mt-2 text-sm text-muted">{q.help}</p> : null}

        <div className="mt-5 flex flex-col gap-2.5">
          {q.options.map((o) => {
            const selected = answers[q.id] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                className={`flex items-center gap-3 rounded-md border px-4 py-[15px] text-left text-[14.5px] font-medium transition-colors duration-200 ${
                  selected ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{o.label}</span>
                  {o.hint ? (
                    <span className="mt-0.5 text-[12px] font-normal leading-snug text-muted">
                      {o.hint}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`relative h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] ${
                    selected ? "border-accent" : "border-line"
                  }`}
                >
                  {selected ? (
                    <span className="absolute inset-[3px] rounded-full bg-accent" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {state.status === "error" ? (
          <p className="mt-4 text-sm text-error">{state.message}</p>
        ) : null}
      </div>

      {/* Barra fija: Atrás (ghost) + Siguiente / Armar mi cápsula (primario). En el
          último paso, un micro-texto avisa que esto ARMA la cápsula y tarda — para
          que no se confunda con "Siguiente" ni se dispare de un tap de inercia. */}
      <div className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 flex-col gap-2 border-t border-line bg-surface px-[18px] pb-[max(14px,env(safe-area-inset-bottom))] pt-[11px]">
        {last ? (
          <p className="text-center text-[11.5px] text-muted">
            Último paso — esto <span className="font-semibold text-ink">arma tu cápsula</span> (~30s)
          </p>
        ) : null}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
            className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors disabled:opacity-40"
          >
            Atrás
          </button>
          {last ? (
            <button
              key="armar"
              type="submit"
              disabled={!answered || pending || !armReady}
              onClick={(e) => {
                // Cinturón síncrono: aunque el `disabled` tardara un frame, el ref
                // ya está actualizado → cancela el submit en la ventana de carrera.
                if (!armReadyRef.current || !answered || pending) e.preventDefault();
              }}
              className="flex min-h-12 flex-[2] items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Spinner className="h-4 w-4" /> Armando tu cápsula…
                </>
              ) : (
                <>
                  <Icon name="destello" size={16} /> Armar mi cápsula
                </>
              )}
            </button>
          ) : (
            <button
              key="siguiente"
              type="button"
              onClick={goNext}
              disabled={!answered}
              className="min-h-12 flex-[2] rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
      </form>
    </>
  );
}
