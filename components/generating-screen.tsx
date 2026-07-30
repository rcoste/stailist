"use client";

import { useEffect, useState } from "react";

// Pantalla de "generando": el progreso es lenguaje. Frases en Arimo (sans, DS v3 —
// la serif es solo acento en itálica, nunca en UI) que se funden — la activa grande
// con su palabra clave en acento, las vecinas tenues arriba y abajo — + tres puntos
// de avance. Nunca un spinner. Overlay full-screen. Parametrizada por frases para
// reusarse (Home, Viaje, cápsula, …).
export type GenPhrase = { a: string; k: string; b: string };

const text = (p: GenPhrase) => `${p.a}${p.k}${p.b}`;

export function GeneratingScreen({
  phrases,
  intervalMs = 1900,
  tone = "light",
  avisarTrasMs = 8000,
}: {
  phrases: GenPhrase[];
  intervalMs?: number;
  /** "dark" para el takeover oscuro del try-on (mismo lenguaje, sobre #0a0a0a). */
  tone?: "light" | "dark";
  /**
   * A los cuántos ms aparece el aviso de "no salgas de la app". 0 lo apaga.
   *
   * Por tiempo y no por prop en cada llamada: solo importa cuando la espera ya
   * es larga de verdad. Un try-on de 8s nunca lo enseña; la cápsula, que tarda
   * ~40s, sí — y es justo donde Alberto perdió el proceso ("chance hay que
   * poner mensaje de no salir de la tab/safari porque el proceso se rompe").
   * En iOS, Safari suspende la pestaña al cambiar de app y la petición muere.
   */
  avisarTrasMs?: number;
}) {
  const [i, setI] = useState(0);
  const [avisar, setAvisar] = useState(false);
  useEffect(() => {
    if (phrases.length <= 1) return;
    const id = setInterval(() => setI((n) => (n + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [phrases.length, intervalMs]);

  useEffect(() => {
    if (!avisarTrasMs) return;
    const id = setTimeout(() => setAvisar(true), avisarTrasMs);
    return () => clearTimeout(id);
  }, [avisarTrasMs]);

  const len = phrases.length;
  const prev = phrases[(i - 1 + len) % len];
  const cur = phrases[i];
  const next = phrases[(i + 1) % len];

  const dark = tone === "dark";
  const neighbor = dark ? "text-on-accent opacity-30" : "text-muted opacity-40";

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center ${
        dark ? "z-[60] bg-accent" : "z-50 bg-bg"
      }`}
    >
      <div
        key={i}
        style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}
        className="flex flex-col items-center gap-5"
      >
        <p className={`text-base font-medium ${neighbor}`}>{text(prev)}</p>
        <p className={`text-[21px] font-semibold ${dark ? "text-on-accent" : "text-ink"}`}>
          {cur.a}
          <b className={`font-semibold ${dark ? "text-on-accent" : "text-accent"}`}>{cur.k}</b>
          {cur.b}
        </p>
        <p className={`text-base font-medium ${neighbor}`}>{text(next)}</p>
      </div>
      <div className="mt-1.5 flex gap-[7px]" aria-hidden>
        {[0, 1, 2].map((j) => (
          <span
            key={j}
            className={`h-[7px] w-[7px] rounded-full transition-colors duration-300 ${
              j <= i % 3
                ? dark
                  ? "bg-on-accent"
                  : "bg-accent"
                : dark
                  ? "bg-on-accent/25"
                  : "bg-line"
            }`}
          />
        ))}
      </div>
      {/* Aparece solo si la espera se alargó. Ocupa su sitio desde el principio
          (invisible) para que no empuje las frases al aparecer. */}
      <p
        className={`mt-2 max-w-[280px] text-[12.5px] leading-snug transition-opacity duration-500 ${
          dark ? "text-on-accent/60" : "text-muted"
        } ${avisar ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!avisar}
      >
        esto tarda un poco — quédate en la app, si te sales se cancela.
      </p>
      <span className="sr-only" aria-live="polite">
        Creando…
      </span>
    </div>
  );
}
