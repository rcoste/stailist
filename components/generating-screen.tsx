"use client";

import { useEffect, useState } from "react";

// Pantalla de "generando" del handoff: el progreso es lenguaje. Frases en Bodoni
// que se funden — la activa grande con su palabra clave en acento, las vecinas
// tenues arriba y abajo — + tres puntos de avance. Nunca un spinner. Overlay
// full-screen. Parametrizada por frases para reusarse (Home, Viaje, …).
export type GenPhrase = { a: string; k: string; b: string };

const text = (p: GenPhrase) => `${p.a}${p.k}${p.b}`;

export function GeneratingScreen({
  phrases,
  intervalMs = 1900,
}: {
  phrases: GenPhrase[];
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (phrases.length <= 1) return;
    const id = setInterval(() => setI((n) => (n + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [phrases.length, intervalMs]);

  const len = phrases.length;
  const prev = phrases[(i - 1 + len) % len];
  const cur = phrases[i];
  const next = phrases[(i + 1) % len];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg px-8 text-center">
      <div
        key={i}
        style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        className="flex flex-col items-center gap-5"
      >
        <p className="display text-base font-medium text-muted opacity-40">{text(prev)}</p>
        <p className="display text-[21px] font-medium text-ink">
          {cur.a}
          <b className="font-medium text-accent">{cur.k}</b>
          {cur.b}
        </p>
        <p className="display text-base font-medium text-muted opacity-40">{text(next)}</p>
      </div>
      <div className="mt-1.5 flex gap-[7px]" aria-hidden>
        {[0, 1, 2].map((j) => (
          <span
            key={j}
            className={`h-[7px] w-[7px] rounded-full transition-colors duration-300 ${
              j <= i % 3 ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        Creando…
      </span>
    </div>
  );
}
