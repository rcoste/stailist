"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

// Estado "generando" del flujo Hoy (rebrand v3): el progreso es lenguaje, no un
// spinner. Spark girando lento + "tu estilista está pensando" + frases reales de
// lo que el motor está haciendo (revisar tu clóset, el clima, descartar
// combinaciones…) que se escriben solas una tras otra (typewriter, loop) +
// barra de progreso con % + los chips del plan. La rotación de varias frases —en
// vez de repetir una— hace que la espera cuente qué pasa, no que se sienta
// colgada. Reduced-motion: primera frase estática, sin giro ni barra.
export type GenPlan = { ocasion: string; momento: "dia" | "noche"; clima: string | null };

export function StylistGenerating({
  frases,
  plan,
}: {
  /** Frases en orden (pasos reales del motor); rotan en loop con typewriter. */
  frases: string[];
  plan: GenPlan | null;
}) {
  const [typed, setTyped] = useState("");
  const [pct, setPct] = useState(0);
  const reduced = useRef(false);
  // Clave estable: la identidad del array cambia en cada render del padre, pero
  // su contenido no — depender del contenido evita reiniciar el typewriter.
  const key = frases.join("|");

  // Typewriter en loop: escribe frase[idx] → pausa → borra → avanza a la
  // siguiente frase → repite, dando la vuelta al llegar al final.
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lista = frases.length ? frases : ["armando algo a tu medida…"];
    if (reduced.current) {
      setTyped(lista[0]);
      setPct(62);
      return;
    }
    let idx = 0;
    let i = 0;
    let dir = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const frase = lista[idx];
      setTyped(frase.slice(0, i));
      if (dir > 0) {
        i++;
        if (i > frase.length) {
          dir = -1;
          timer = setTimeout(tick, 1600);
          return;
        }
      } else {
        i -= 2;
        if (i <= 0) {
          i = 0;
          dir = 1;
          idx = (idx + 1) % lista.length; // siguiente frase (loop)
          timer = setTimeout(tick, 500);
          return;
        }
      }
      timer = setTimeout(tick, dir > 0 ? 46 : 22);
    };
    tick();
    return () => clearTimeout(timer);
    // Depende del contenido, no de la identidad del array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Contador de % (cosmético: la generación no reporta progreso real). Sube
  // hacia ~92 y se queda — la transición de width da la sensación de avance.
  useEffect(() => {
    if (reduced.current) return;
    const id = setInterval(() => {
      setPct((p) => (p >= 92 ? 92 : p + Math.max(1, Math.round((92 - p) / 12))));
    }, 420);
    return () => clearInterval(id);
  }, []);

  const chips = plan
    ? ([plan.ocasion, plan.momento === "dia" ? "de día" : "de noche", plan.clima].filter(
        Boolean
      ) as string[])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-center bg-bg px-[30px]">
      {/* En desktop el contenido va acotado a la columna del wizard (~430px),
          no estirado a toda la pantalla. En móvil el wrapper es transparente. */}
      <div className="w-full lg:mx-auto lg:max-w-[430px]">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
        <Icon name="destello" size={20} />
      </span>
      <p className="mt-[26px] text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
        Tu estilista está pensando
      </p>
      <p className="mt-3 min-h-[108px] text-[26px] font-medium leading-[1.32] text-ink">
        {typed}
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[0.95em] w-0.5 translate-y-[2px] bg-ink align-middle motion-safe:animate-[blink_1s_steps(1)_infinite]"
        />
      </p>
      <div className="mt-[26px] flex items-center gap-2.5">
        <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line">
          <span
            className="absolute left-0 top-0 h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tabular text-xs font-bold text-muted">{pct}%</span>
      </div>
      {chips.length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="border border-line px-2.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.08em] text-ink"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        Creando tu look…
      </span>
      </div>
    </div>
  );
}
