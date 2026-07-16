"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { dismissHint, type HintId } from "@/lib/hints";

// Tip de descubrimiento just-in-time. UNA por pantalla (el server decide cuál),
// jamás bloquea el flujo, se cierra con un tap y no vuelve (profiles.hints_seen).
//
// DOS presentaciones según el breakpoint:
// - MÓVIL (<1024px): coach-mark spotlight — oscurece la pantalla y recorta el
//   elemento real al que apunta, con la nota del coach anclada (handoff
//   design_handoff_hint). El target se localiza por `data-hint-target="<id>"`.
// - DESKTOP (≥1024px): el banner inline de siempre (regla de acento + eyebrow).
//   El coach-mark de desktop se hará en un pase aparte; por ahora intacto.
//
// `center`: fuerza nota centrada sin recorte (hints de orientación general, sin
// un elemento concreto que señalar). Sin `center`, el hint REQUIERE su target:
// si no está en pantalla, no se muestra ni se marca visto (espera a otra visita
// donde el target sí exista — p.ej. "no me late" solo aparece con un parecido).

const LG = 1024;

export function Hint({
  id,
  children,
  center = false,
}: {
  id: HintId;
  children: React.ReactNode;
  center?: boolean;
}) {
  const [gone, setGone] = useState(false);
  // null = aún sin medir (evita parpadeo SSR); luego true/false.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LG - 1}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const cerrar = useCallback(() => {
    setGone(true); // optimista: fuera al instante
    void dismissHint(id);
  }, [id]);

  if (gone || isMobile === null) return null;
  if (!isMobile) return <InlineHint onClose={cerrar}>{children}</InlineHint>;
  return (
    <CoachMark id={id} center={center} onClose={cerrar}>
      {children}
    </CoachMark>
  );
}

// ── Desktop: banner inline (comportamiento actual, sin cambios) ──────────────
function InlineHint({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 border-l-2 border-accent py-1 pl-3.5"
      style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
    >
      <div className="flex flex-col gap-1">
        <span className="flex w-fit items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-accent">
          <Icon name="destello" size={12} />
          Un tip
        </span>
        <p className="text-[13.5px] leading-snug text-ink">{children}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
      >
        entendido
      </button>
    </div>
  );
}

// ── Móvil: coach-mark spotlight ──────────────────────────────────────────────
type Rect = { top: number; left: number; width: number; height: number; radius: string };

function findTarget(id: string): HTMLElement | null {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-hint-target="${id}"]`)
  );
  // Dual-render móvil/desktop: elige el VISIBLE (el otro está display:none).
  return (
    els.find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.offsetParent !== null;
    }) ?? null
  );
}

const PAD = 8;

function CoachMark({
  id,
  center,
  onClose,
  children,
}: {
  id: HintId;
  center: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  // rect null + !center = target no encontrado todavía → no renderizamos.
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(center); // center no necesita target
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Localiza y mide el target (reintenta unos frames por si monta tarde).
  useLayoutEffect(() => {
    if (center) return;
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const el = findTarget(id);
      if (el) {
        const r = el.getBoundingClientRect();
        const radius = getComputedStyle(el).borderRadius || "8px";
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height, radius });
        setReady(true);
        return;
      }
      if (tries++ < 20) raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [id, center]);

  // Reposiciona en resize (el scroll está bloqueado mientras el coach-mark vive).
  useEffect(() => {
    if (center) return;
    const onResize = () => {
      const el = findTarget(id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const radius = getComputedStyle(el).borderRadius || "8px";
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height, radius });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [id, center]);

  // Bloquea el scroll del body + Escape para cerrar + foco inicial en "entendido".
  useEffect(() => {
    if (!ready) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    okRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [ready, onClose]);

  if (!mounted || !ready) return null;

  // Posición de la nota: debajo del hoyo si cabe, arriba si no; clamp horizontal.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const NOTE_W = Math.min(340, vw - 32);
  let noteStyle: React.CSSProperties;
  if (center || !rect) {
    noteStyle = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: NOTE_W,
    };
  } else {
    const holeBottom = rect.top + rect.height + PAD;
    const holeTop = rect.top - PAD;
    const left = Math.min(Math.max(rect.left - PAD, 16), vw - NOTE_W - 16);
    // ~180px es el alto típico de la nota + acciones; si no cabe abajo, va arriba.
    const below = holeBottom + 18;
    if (below + 180 < vh) {
      noteStyle = { left, top: below, width: NOTE_W };
    } else {
      noteStyle = { left, bottom: vh - holeTop + 18, width: NOTE_W };
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80]"
      onClick={onClose}
    >
      {/* Recorte (scrim con hoyo) — solo cuando hay target. */}
      {rect && !center ? (
        <div
          aria-hidden
          className="hint-hole absolute"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: rect.radius,
            boxShadow: "0 0 0 200vmax rgb(10 10 10 / 0.72)",
          }}
        >
          <span
            aria-hidden
            className="hint-ring absolute"
            style={{
              inset: -5,
              borderRadius: "inherit",
              border: "1.5px solid var(--c-on-accent)",
            }}
          />
        </div>
      ) : (
        // Centrado: scrim plano sin hoyo.
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "rgb(10 10 10 / 0.84)" }}
        />
      )}

      {/* Nota del coach (no cierra al tocarla). */}
      <div
        className="hint-note absolute flex flex-col gap-3"
        style={noteStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* `.display` (no `.editorial`): .editorial fuerza font-style:normal
            fuera de las cascade layers → gana sobre la utilidad `italic` y la
            serif sale en redonda (se lee como la Bodoni del v2, ya abandonada).
            .display solo fija la familia, así que aquí sí manda la itálica. */}
        <p className="display text-[22px] font-normal italic leading-[1.4] text-on-accent">
          <Icon
            name="destello"
            size={16}
            strokeWidth={2}
            className="mr-2 inline-block translate-y-px"
          />
          {children}
        </p>
        <div>
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="rounded-sm bg-on-accent px-4 py-2.5 text-[13px] font-bold text-accent"
          >
            entendido
          </button>
        </div>
      </div>

      <style>{`
        @keyframes hint-ring-pulse { 50% { transform: scale(1.045); opacity: 0.7; } }
        @keyframes hint-note-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }
        .hint-ring { animation: hint-ring-pulse 2s ease-in-out infinite; }
        .hint-note { animation: hint-note-in var(--dur-medium) var(--ease-enter) 120ms both; }
        @media (prefers-reduced-motion: reduce) {
          .hint-ring, .hint-note { animation: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}
