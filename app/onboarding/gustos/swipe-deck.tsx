"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Look } from "@/lib/looks";
import { Spinner } from "@/components/spinner";
import { saveTastes, type SwipeResult } from "./actions";
import type { StyleArchetype } from "@/lib/engine/archetype";

// Deck de swipes: el gesto (arrastrar) es el atajo, los botones ❤️/✕ son el
// camino garantizado (desktop + accesibilidad — spec P6). Sin librerías de
// animación: pointer events + transform, suficiente para el MVP.
export function SwipeDeck({ looks }: { looks: Look[] }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [drag, setDrag] = useState({ x: 0, active: false });
  const [error, setError] = useState<string | null>(null);
  const [archetype, setArchetype] = useState<StyleArchetype | null>(null);
  const [pending, startTransition] = useTransition();
  const startX = useRef(0);

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
      setDrag({ x: 0, active: false });
      setResults(next);
      setIndex(index + 1);
      if (next.length === looks.length) finalizar(next);
    }, 200);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    startX.current = e.clientX;
    setDrag({ x: 0, active: true });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.active || leaving) return;
    setDrag({ x: e.clientX - startX.current, active: true });
  }
  function onPointerUp() {
    if (!drag.active || leaving) return;
    if (drag.x > 55) decide(true);
    else if (drag.x < -55) decide(false);
    else setDrag({ x: 0, active: false });
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
            className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            Reintentar
          </button>
        </div>
      );
    }

    // Reveal del arquetipo de estilo: el momento "me veo reflejada".
    if (archetype) {
      return (
        <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-hairline)]">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-sm text-muted">Tu estilo es</p>
            <h2 className="text-h1 font-semibold text-ink">{archetype.nombre}</h2>
            <p className="editorial text-base text-muted">
              {archetype.descripcion}
            </p>
          </div>
          <Link
            href="/onboarding/colorimetria"
            className="flex min-h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
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

  const x = leaving === "right" ? 480 : leaving === "left" ? -480 : drag.x;
  const rotate = x / 20;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="tabular text-center text-sm text-muted">
        {index + 1} de {looks.length}
      </p>

      <div className="relative flex-1">
        <div
          key={look.id}
          className="mx-auto flex aspect-[3/4] max-h-[60dvh] w-full max-w-80 touch-none select-none flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-hairline)]"
          style={{
            transform: `translateX(${x}px) rotate(${rotate}deg)`,
            transition: drag.active
              ? "none"
              : "transform 200ms ease-in-out, opacity 200ms ease-in-out",
            opacity: leaving ? 0 : 1,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {look.image ? (
            <div className="relative flex-1">
              <Image
                src={look.image}
                alt={look.nombre}
                fill
                sizes="320px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              {look.prendas.map((p) => (
                <div
                  key={p.nombre}
                  className="flex flex-1 items-end p-3"
                  style={{ backgroundColor: p.swatch }}
                >
                  <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-ink">
                    {p.nombre}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-0.5 border-t border-line bg-surface px-4 py-3">
            <p className="text-base font-medium text-ink">{look.nombre}</p>
            <p className="editorial text-sm text-muted">{look.vibe}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-80 items-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={pending}
          aria-label={`No me gusta ${look.nombre}`}
          className="flex min-h-14 flex-1 items-center justify-center rounded-full border border-line bg-surface text-xl transition-colors duration-200 hover:border-ink disabled:opacity-50"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={pending}
          aria-label={`Me gusta ${look.nombre}`}
          className="flex min-h-14 flex-1 items-center justify-center rounded-full bg-accent text-xl text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          ❤️
        </button>
      </div>
    </div>
  );
}
