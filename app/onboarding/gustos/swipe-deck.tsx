"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Look } from "@/lib/looks";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { saveTastes, type SwipeResult } from "./actions";
import type { StyleArchetype } from "@/lib/engine/archetype";

// Deck de swipes estilo Tinder (rebrand v2): pila con profundidad, foto a
// sangre con nombre/vibe sobre degradado, sellos ME GUSTA / NO VA al arrastrar,
// tinte direccional, y lanzamiento por velocidad (flick). El gesto es el atajo;
// los botones corazón/equis son el camino garantizado (desktop + accesibilidad).
// Sin librerías: pointer events + transform.
const THRESHOLD = 90; // px para contar como decisión
const FLICK = 0.6; // px/ms — un flick rápido decide aunque no cruce el umbral

export function SwipeDeck({ looks }: { looks: Look[] }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [error, setError] = useState<string | null>(null);
  const [archetype, setArchetype] = useState<StyleArchetype | null>(null);
  const [pending, startTransition] = useTransition();
  const start = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, t: 0, vx: 0 });

  function finalizar(all: SwipeResult[]) {
    startTransition(async () => {
      setError(null);
      const res = await saveTastes(all);
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

    // Reveal del arquetipo de estilo: el momento "me veo reflejada".
    if (archetype) {
      return (
        <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
          <div className="flex flex-col gap-2 text-center">
            <span className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">
              Tu estilo es
            </span>
            <h2 className="text-h1 font-semibold text-ink">{archetype.nombre}</h2>
            <p className="editorial text-base text-muted">
              {archetype.descripcion}
            </p>
          </div>
          <Link
            href="/onboarding/colorimetria"
            className="flex min-h-12 items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Sigamos con tus colores
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="editorial text-lg text-ink">leyendo tu estilo…</p>
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
      <p className="tabular text-center text-sm text-muted">
        {index + 1} de {looks.length}
      </p>

      <div className="relative mx-auto aspect-[3/4] max-h-[60dvh] w-full max-w-80">
        {/* Cartas de atrás (profundidad) */}
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
                <Image src={b.image} alt="" fill sizes="320px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 bg-bg" />
              )}
            </div>
          );
        })}

        {/* Carta de arriba (interactiva) */}
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
            className="pointer-events-none absolute left-4 top-4 -rotate-12 rounded-sm border-2 border-accent bg-surface/90 px-3 py-1 text-sm font-bold uppercase tracking-wide text-accent"
            style={{ opacity: likeOp }}
            aria-hidden
          >
            Me gusta
          </span>
          <span
            className="pointer-events-none absolute right-4 top-4 rotate-12 rounded-sm border-2 border-ink bg-surface/90 px-3 py-1 text-sm font-bold uppercase tracking-wide text-ink"
            style={{ opacity: nopeOp }}
            aria-hidden
          >
            No va
          </span>

          {/* Nombre + vibe sobre degradado de protección */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-4 pb-4 pt-12">
            <p className="text-lg font-semibold text-surface">{look.nombre}</p>
            <p className="editorial text-sm text-surface/85">{look.vibe}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-80 items-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={pending}
          aria-label={`No me gusta ${look.nombre}`}
          className="flex min-h-14 flex-1 items-center justify-center rounded-sm border border-line bg-surface text-ink transition-colors duration-200 hover:border-ink disabled:opacity-50"
        >
          <Icon name="equis" size={24} />
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={pending}
          aria-label={`Me gusta ${look.nombre}`}
          className="flex min-h-14 flex-1 items-center justify-center rounded-sm bg-accent text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          <Icon name="corazon" size={24} />
        </button>
      </div>
    </div>
  );
}
