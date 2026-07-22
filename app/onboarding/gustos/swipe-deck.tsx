"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Look } from "@/lib/looks";
import type { AssessmentQuestion } from "@/lib/capsule";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import {
  saveTastes,
  getCalibrationQuestions,
  saveCalibration,
  type SwipeResult,
} from "./actions";
import type { StyleArchetype } from "@/lib/engine/archetype";

// Deck de swipes estilo Tinder (rebrand v3): pila con profundidad, carta activa
// A COLOR (la ropa es el contenido), las de atrás en B&N. Sellos ME GUSTA / NO VA
// al arrastrar, lanzamiento por velocidad (flick). El gesto es el atajo; los
// botones redondos son el camino garantizado. Al final, el reveal de estilo es
// un tríptico de los looks que amaste. Sin librerías: pointer events + transform.
const THRESHOLD = 90; // px para contar como decisión
const FLICK = 0.6; // px/ms — un flick rápido decide aunque no cruce el umbral

export function SwipeDeck({
  looks,
  save = saveTastes,
  doneHref = "/onboarding/colorimetria",
  doneLabel = "Sigamos con tus colores",
  calibracion = false,
}: {
  looks: Look[];
  // Acción al terminar (default = onboarding). El Perfil pasa updateTastes.
  save?: (
    results: SwipeResult[]
  ) => Promise<{ archetype: StyleArchetype } | { error: string }>;
  doneHref?: string;
  doneLabel?: string;
  /** Onboarding: tras el reveal, 2-3 preguntas de calibración generadas a la
   *  medida de los swipes (si la IA ya las tiene listas; si no, sigue directo). */
  calibracion?: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [error, setError] = useState<string | null>(null);
  const [archetype, setArchetype] = useState<StyleArchetype | null>(null);
  // Calibración post-reveal: preguntas generadas a la medida de los swipes.
  const [calib, setCalib] = useState<AssessmentQuestion[] | null>(null);
  const [calibIdx, setCalibIdx] = useState(0);
  const [multiSel, setMultiSel] = useState<string[]>([]); // selección de una pregunta multi
  const calibAnswers = useRef<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const start = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, t: 0, vx: 0 });

  // Del reveal a la calibración: si las preguntas ya están calientes (se generan
  // en background desde que terminó el swipe), se muestran; si no, directo a
  // colores — jamás se espera a la IA.
  function continuar() {
    startTransition(async () => {
      const qs = await getCalibrationQuestions().catch(() => null);
      if (qs && qs.length > 0) setCalib(qs);
      else router.push(doneHref);
    });
  }

  // Guarda la respuesta y avanza (o cierra guardando todo). value = un valor
  // (single) o varios separados por coma (multi).
  function avanzar(qid: string, value: string) {
    calibAnswers.current[qid] = value;
    setMultiSel([]);
    if (calib && calibIdx < calib.length - 1) {
      setCalibIdx(calibIdx + 1);
    } else {
      startTransition(async () => {
        await saveCalibration(calibAnswers.current).catch(() => null);
        router.push(doneHref);
      });
    }
  }

  // Toggle de una opción en una pregunta MULTI. La opción exclusiva ("sorpréndeme")
  // limpia las demás y viceversa — mismo criterio que el quiz de la cápsula.
  function toggleMulti(q: AssessmentQuestion, value: string) {
    const isExclusive = q.options.find((o) => o.value === value)?.exclusive;
    setMultiSel((prev) => {
      if (isExclusive) return prev.includes(value) ? [] : [value];
      const base = prev.filter(
        (v) => !q.options.find((o) => o.value === v)?.exclusive
      );
      return base.includes(value) ? base.filter((v) => v !== value) : [...base, value];
    });
  }

  function finalizar(all: SwipeResult[]) {
    startTransition(async () => {
      setError(null);
      const res = await save(all);
      if ("error" in res) setError(res.error);
      else setArchetype(res.archetype);
    });
  }

  const look = looks[index];
  const done = index >= looks.length;

  function decide(liked: boolean) {
    if (done || leaving) return;
    const next = [...results, { id: look.id, liked }];
    setLeaving(liked ? "right" : "left");
    setTimeout(() => {
      setLeaving(null);
      setDrag({ x: 0, y: 0, active: false });
      setResults(next);
      setIndex(index + 1);
      if (next.length === looks.length) finalizar(next);
    }, 220);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    start.current = { x: e.clientX, y: e.clientY };
    vel.current = { x: e.clientX, t: e.timeStamp, vx: 0 };
    setDrag({ x: 0, y: 0, active: true });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.active || leaving) return;
    const dt = e.timeStamp - vel.current.t;
    if (dt > 0) vel.current.vx = (e.clientX - vel.current.x) / dt;
    vel.current = { x: e.clientX, t: e.timeStamp, vx: vel.current.vx };
    setDrag({
      x: e.clientX - start.current.x,
      y: (e.clientY - start.current.y) * 0.4,
      active: true,
    });
  }
  function onPointerUp() {
    if (!drag.active || leaving) return;
    const flick = Math.abs(vel.current.vx) > FLICK && Math.abs(drag.x) > 24;
    if (drag.x > THRESHOLD || (flick && vel.current.vx > 0)) decide(true);
    else if (drag.x < -THRESHOLD || (flick && vel.current.vx < 0)) decide(false);
    else setDrag({ x: 0, y: 0, active: false });
  }

  if (done) {
    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-base text-error">{error}</p>
          <button
            type="button"
            onClick={() => finalizar(results)}
            disabled={pending}
            className="min-h-12 rounded-sm bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            Reintentar
          </button>
        </div>
      );
    }

    // Calibración post-reveal: 2-3 preguntas hechas a la medida de TUS swipes.
    // Single = un tap avanza; multi = toggle + "continuar". Es el momento
    // "me está escuchando".
    if (calib) {
      const q = calib[calibIdx];
      return (
        <div
          key={q.id}
          className="flex flex-1 flex-col items-center justify-center gap-2 pb-4 text-center"
          style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            afinemos tu estilo · {calibIdx + 1} de {calib.length}
          </p>
          <h2 className="mt-2 max-w-[320px] text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
            {q.label}
          </h2>
          {q.help ? (
            <p className="text-sm text-muted">{q.help}</p>
          ) : q.multi ? (
            <p className="text-sm text-muted">Puedes elegir varias.</p>
          ) : null}
          <div className="mt-5 flex w-full max-w-[340px] flex-col gap-2.5">
            {q.options.map((o) => {
              const sel = q.multi && multiSel.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    q.multi ? toggleMulti(q, o.value) : avanzar(q.id, o.value)
                  }
                  aria-pressed={q.multi ? sel : undefined}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-sm border px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 disabled:opacity-50 ${
                    sel
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink hover:border-accent"
                  }`}
                >
                  {o.label}
                  {o.hint ? <span className="text-xs text-muted">{o.hint}</span> : null}
                </button>
              );
            })}
          </div>
          {q.multi ? (
            <button
              type="button"
              disabled={pending || multiSel.length === 0}
              onClick={() => avanzar(q.id, multiSel.join(","))}
              className="mt-4 flex min-h-12 w-full max-w-[340px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-40"
            >
              continuar <Icon name="flecha" size={17} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => router.push(doneHref)}
            className="mt-4 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
          >
            luego
          </button>
        </div>
      );
    }

    // Reveal del arquetipo: tríptico de los looks que amaste ("me veo reflejada").
    if (archetype) {
      const liked = looks.filter(
        (l) => l.image && results.some((r) => r.id === l.id && r.liked)
      );
      const words = archetype.nombre.trim().split(" ");
      const last = words.length > 1 ? words.pop() : null;
      const head = words.join(" ");
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 pb-4 text-center">
          {liked.length > 0 ? (
            <div className="relative mx-auto mb-2 h-[230px] w-[262px]">
              {liked[1] ? (
                <FanFig
                  image={liked[1].image as string}
                  className="left-0 top-[34px] h-[154px] w-[116px] origin-bottom -rotate-[5deg] shadow-[var(--shadow-hairline)]"
                />
              ) : null}
              {liked[2] ? (
                <FanFig
                  image={liked[2].image as string}
                  className="right-0 top-[34px] h-[154px] w-[116px] origin-bottom rotate-[5deg] shadow-[var(--shadow-hairline)]"
                />
              ) : null}
              <FanFig
                image={liked[0].image as string}
                className="left-1/2 top-3 z-[2] h-[202px] w-[152px] -translate-x-1/2 shadow-[0_16px_38px_-20px_rgba(0,0,0,0.4)]"
              />
            </div>
          ) : null}
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            tu estilo
          </p>
          <h2 className="text-[40px] font-bold leading-[1.02] tracking-[-0.03em] text-ink">
            {head}
            {last ? (
              <>
                {" "}
                <em className="font-display font-normal italic tracking-normal">
                  {last}
                </em>
              </>
            ) : null}
          </h2>
          <p className="mt-3 max-w-[300px] font-display text-[18px] leading-snug text-muted">
            {archetype.descripcion}
          </p>
          {calibracion ? (
            // Con calibración: el botón consulta si las preguntas ya están
            // calientes (sin esperar a la IA) — si no, navega directo.
            <button
              type="button"
              disabled={pending}
              onClick={continuar}
              className="mt-7 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-70"
            >
              {pending ? <Spinner className="h-5 w-5" /> : null}
              {doneLabel} <Icon name="flecha" size={19} />
            </button>
          ) : (
            <Link
              href={doneHref}
              className="mt-7 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              {doneLabel} <Icon name="flecha" size={19} />
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="text-lg font-medium text-ink">leyendo tu estilo…</p>
      </div>
    );
  }

  const x = leaving === "right" ? 520 : leaving === "left" ? -520 : drag.x;
  const y = leaving ? 0 : drag.y;
  const rotate = x / 18;
  const likeOp = Math.max(0, Math.min(1, x / THRESHOLD));
  const nopeOp = Math.max(0, Math.min(1, -x / THRESHOLD));
  const behind = [looks[index + 2], looks[index + 1]].filter(Boolean);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="relative mx-auto aspect-[3/4] max-h-[60dvh] w-full max-w-80">
        {/* Cartas de atrás (profundidad) — en B&N */}
        {behind.map((b, i) => {
          // i=0 es la más atrás (index+2), i=1 la siguiente (index+1)
          const depth = behind.length - i; // 2 o 1
          return (
            <div
              key={b.id}
              className="absolute inset-0 overflow-hidden rounded-lg border border-line bg-surface"
              style={{
                transform: `scale(${1 - depth * 0.04}) translateY(${depth * 10}px)`,
                opacity: 1 - depth * 0.15,
                zIndex: i,
              }}
              aria-hidden
            >
              {b.image ? (
                <Image
                  src={b.image}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-cover grayscale"
                />
              ) : (
                <span className="absolute inset-0 bg-bg" />
              )}
            </div>
          );
        })}

        {/* Carta de arriba (interactiva) — a color */}
        <div
          key={look.id}
          className="absolute inset-0 z-10 touch-none select-none overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-hairline)]"
          style={{
            transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
            transition: drag.active
              ? "none"
              : "transform 220ms var(--ease-move), opacity 220ms var(--ease-move)",
            opacity: leaving ? 0 : 1,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {look.image ? (
            <Image
              src={look.image}
              alt={look.nombre}
              fill
              sizes="320px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full flex-col">
              {look.prendas.map((p) => (
                <div key={p.nombre} className="flex-1" style={{ backgroundColor: p.swatch }} />
              ))}
            </div>
          )}

          {/* Tinte direccional */}
          <span
            className="pointer-events-none absolute inset-0 bg-accent"
            style={{ opacity: likeOp * 0.22 }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 bg-ink"
            style={{ opacity: nopeOp * 0.22 }}
            aria-hidden
          />

          {/* Sellos */}
          <span
            className="pointer-events-none absolute right-4 top-4 rotate-[8deg] border-2 border-ink bg-surface/90 px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-ink"
            style={{ opacity: likeOp }}
            aria-hidden
          >
            Me gusta
          </span>
          <span
            className="pointer-events-none absolute left-4 top-4 -rotate-[8deg] border-2 border-ink bg-surface/90 px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-ink"
            style={{ opacity: nopeOp }}
            aria-hidden
          >
            No va
          </span>

          {/* Nombre sobre degradado de protección */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/35 to-transparent px-4 pb-5 pt-12">
            <p className="font-display text-[22px] italic text-surface">{look.nombre}</p>
          </div>
        </div>
      </div>

      {/* Botones redondos: el sí relleno tinta */}
      <div className="flex items-center justify-center gap-10 pt-2">
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={pending}
          aria-label={`No me gusta ${look.nombre}`}
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors duration-200 hover:border-ink disabled:opacity-50"
        >
          <Icon name="equis" size={24} />
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={pending}
          aria-label={`Me gusta ${look.nombre}`}
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-accent text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          <Icon name="corazon" size={24} />
        </button>
      </div>

      <p className="tabular pb-2 text-center text-[12px] text-muted">
        {index + 1} de {looks.length}
      </p>
    </div>
  );
}

// Una lámina del tríptico del reveal (foto a color, recorte vertical).
function FanFig({ image, className }: { image: string; className: string }) {
  return (
    <figure className={`absolute overflow-hidden border border-line bg-surface ${className}`}>
      <Image src={image} alt="" fill sizes="160px" className="object-cover" />
    </figure>
  );
}
