"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { Look } from "@/lib/looks";
import { saveTastes, type SwipeResult } from "./actions";

// Deck de swipes: el gesto (arrastrar) es el atajo, los botones ❤️/✕ son el
// camino garantizado (desktop + accesibilidad — spec P6). Sin librerías de
// animación: pointer events + transform, suficiente para el MVP.
export function SwipeDeck({ looks }: { looks: Look[] }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SwipeResult[]>([]);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [drag, setDrag] = useState({ x: 0, active: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const startX = useRef(0);

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
      if (next.length === looks.length) {
        startTransition(async () => {
          const res = await saveTastes(next);
          if (res?.error) setError(res.error);
        });
      }
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
    if (drag.x > 80) decide(true);
    else if (drag.x < -80) decide(false);
    else setDrag({ x: 0, active: false });
  }

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {error ? (
          <>
            <p className="text-base text-error">{error}</p>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await saveTastes(results);
                  if (res?.error) setError(res.error);
                })
              }
              className="min-h-12 rounded-full bg-accent px-8 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              Reintentar
            </button>
          </>
        ) : (
          <p className="editorial text-lg text-ink">
            ya te voy conociendo…
          </p>
        )}
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
          className="mx-auto flex aspect-[3/4] max-h-[60dvh] w-full max-w-80 touch-none select-none flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-hairline)]"
          style={{
            transform: `translateX(${x}px) rotate(${rotate}deg)`,
            transition: drag.active ? "none" : "transform 200ms ease-in-out",
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
