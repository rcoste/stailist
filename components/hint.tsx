"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { dismissHint } from "@/lib/hints";
import { HINT_MODO, type HintId } from "@/lib/hints-catalog";

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
// Centrado vs spotlight NO se pasa por prop: se lee de HINT_MODO
// (lib/hints-catalog). Como prop, la misma decisión podía escribirse distinto en
// cada lugar donde se usa el tip, y el test que exige target para los spotlight
// no tendría de dónde saberlo.

const LG = 1024;

export function Hint({
  id,
  children,
  onUnavailable,
}: {
  id: HintId;
  children: React.ReactNode;
  /**
   * El coach-mark buscó su target y no lo encontró. Lo llama HintChain para
   * pasar al siguiente candidato — sin esto, un tip cuyo target borró un
   * rediseño se queda con el turno para siempre y entierra al que va detrás.
   */
  onUnavailable?: () => void;
}) {
  const [gone, setGone] = useState(false);
  // null = aún sin medir (evita parpadeo SSR); luego true/false.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const center = HINT_MODO[id] === "centrado";

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
    <CoachMark
      id={id}
      center={center}
      onClose={cerrar}
      onUnavailable={onUnavailable}
    >
      {children}
    </CoachMark>
  );
}

export type HintCandidato = {
  id: HintId;
  /** El texto del tip. Se arma en el server, donde vive la copy. */
  children: React.ReactNode;
};

/**
 * Los tips de una pantalla, en orden de prioridad: se muestra el PRIMERO que se
 * pueda dibujar. Si el de arriba no encuentra su target, cede el turno al
 * siguiente en la misma visita en vez de dejar la pantalla sin tip.
 *
 * El caso real que lo motiva: `hoy-tryon` perdió su target en el rediseño del
 * detalle del look y, como no se dibujaba, tampoco se marcaba visto — así que se
 * quedaba con el turno cada visita y el tip de viaje no salía nunca.
 */
export function HintChain({ candidatos }: { candidatos: HintCandidato[] }) {
  const [i, setI] = useState(0);
  const actual = candidatos[i];
  if (!actual) return null;
  return (
    <Hint
      key={actual.id}
      id={actual.id}
      onUnavailable={() => setI((n) => n + 1)}
    >
      {actual.children}
    </Hint>
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

const PAD = 8; // aire entre el elemento real y el borde del recorte
const GAP = 12; // separación entre el recorte y la nota
const MARGEN = 16; // respiro mínimo contra los bordes de la pantalla

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

function CoachMark({
  id,
  center,
  onClose,
  onUnavailable,
  children,
}: {
  id: HintId;
  center: boolean;
  onClose: () => void;
  onUnavailable?: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  // rect null + !center = target no encontrado todavía → no renderizamos.
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(center); // center no necesita target
  // Alto real de la nota; 0 = aún sin medir (ver `medida`).
  const [noteH, setNoteH] = useState(0);
  const okRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  // Por ref y no en las deps del efecto: el callback llega inline desde
  // HintChain, así que cambia de identidad en cada render y volvería a lanzar la
  // búsqueda del target una y otra vez.
  const cedeRef = useRef(onUnavailable);
  useEffect(() => {
    cedeRef.current = onUnavailable;
  });

  useEffect(() => setMounted(true), []);

  // Localiza y mide el target (reintenta un rato por si monta tarde).
  //
  // El reintento va con setTimeout y NO con requestAnimationFrame, aunque rAF
  // sea lo natural para medir layout: en una pestaña oculta el navegador
  // congela rAF por completo (medido: 0 frames en 3s con visibilityState
  // "hidden"). Con rAF, un hint cuyo target monta tarde en una pestaña de fondo
  // —una PWA restaurada, una pestaña abierta y vista después— se quedaba
  // colgado del reintento para siempre: ni se dibujaba ni cedía el turno.
  //
  // El corte va por tiempo transcurrido y no por número de intentos, porque en
  // segundo plano los timers se estiran a ~1s y 20 intentos serían 20 segundos.
  useLayoutEffect(() => {
    if (center) return;
    let timer = 0;
    const t0 = performance.now();
    const measure = () => {
      const el = findTarget(id);
      if (el) {
        const r = el.getBoundingClientRect();
        const radius = getComputedStyle(el).borderRadius || "8px";
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height, radius });
        setReady(true);
        return;
      }
      // Medio segundo es de sobra para un elemento que monta tarde. Si a estas
      // alturas no está, no va a estar: cede el turno al siguiente candidato.
      if (performance.now() - t0 < 500) timer = window.setTimeout(measure, 32);
      else cedeRef.current?.();
    };
    measure();
    return () => clearTimeout(timer);
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

  // Mide la nota (y la vuelve a medir si el texto reflowea, p.ej. al girar el
  // teléfono). Sin esto la colocación tendría que adivinar el alto.
  useLayoutEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    const medir = () => setNoteH(el.getBoundingClientRect().height);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // Bloquea el scroll del body + Escape para cerrar + foco inicial en "entendido".
  useEffect(() => {
    if (!ready) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    okRef.current?.focus();
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [ready, onClose]);

  if (!mounted || !ready) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const NOTE_W = Math.min(340, vw - 2 * MARGEN);
  const plano = center || !rect;
  // La colocación necesita el alto REAL de la nota, que depende del largo del
  // texto. Antes se asumía "~180px" y el fallo se pagaba en el peor momento: con
  // un tip largo, la nota se salía por abajo. Se mide tras montar (noteH) y
  // hasta entonces la nota va invisible — un salto de posición se nota más que
  // un frame de espera.
  const medida = plano || noteH > 0;

  let noteStyle: React.CSSProperties;
  // Dónde va la punta: arriba (la nota está DEBAJO del elemento) o abajo.
  let punta: "arriba" | "abajo" | null = null;
  let puntaX = 0;

  if (plano) {
    noteStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: NOTE_W };
  } else {
    const holeTop = rect.top - PAD;
    const holeBottom = rect.top + rect.height + PAD;
    // Centrada en el elemento, no alineada a su izquierda: con la punta, el
    // centro es lo que hace que se lea "te hablo de ESTO".
    const centroX = rect.left + rect.width / 2;
    const left = clamp(centroX - NOTE_W / 2, MARGEN, Math.max(MARGEN, vw - NOTE_W - MARGEN));
    const cabeAbajo = holeBottom + GAP + noteH + MARGEN <= vh;
    const cabeArriba = holeTop - GAP - noteH - MARGEN >= 0;

    if (cabeAbajo || !cabeArriba) {
      noteStyle = { left, top: holeBottom + GAP, width: NOTE_W };
      punta = "arriba";
    } else {
      noteStyle = { left, top: holeTop - GAP - noteH, width: NOTE_W };
      punta = "abajo";
    }
    // Si no cabe ni arriba ni abajo (elemento enorme), la nota se queda donde
    // toque pero sin punta: apuntar a algo que la tapa confunde más que ayuda.
    if (!cabeAbajo && !cabeArriba) punta = null;
    // La punta sigue al elemento dentro del ancho de la nota, con un mínimo de
    // margen para no salirse por la esquina redondeada.
    puntaX = clamp(centroX - left, 18, NOTE_W - 18);
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
            // 0.84, igual que el velo plano del centrado. A 0.72 la pantalla
            // seguía demasiado viva: el elemento iluminado competía con todo lo
            // demás en vez de destacar, que es el único trabajo del velo.
            boxShadow: "0 0 0 200vmax rgb(10 10 10 / 0.84)",
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

      {/* Nota del coach: una TARJETA con fondo propio, no texto flotando sobre
          el velo (no cierra al tocarla).

          Por qué la tarjeta: el texto suelto funcionaba cuando estas pantallas
          estaban vacías. El rediseño las llenó de fotos y chips, y en 0.84 el
          velo apaga el fondo pero no lo borra — la serif blanca caía encima de
          una camiseta blanca y desaparecía. El fondo sólido hace que el
          contraste del texto no dependa NUNCA de qué haya debajo. */}
      <div
        ref={noteRef}
        className="hint-note absolute"
        // `visibility` y no `opacity`: la animación de entrada anima opacity y
        // gana sobre el estilo inline, así que ocultarla por ahí no funciona.
        style={{ ...noteStyle, visibility: medida ? undefined : "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* La punta: es lo que dice "te hablo de ESTO" y no "hay un recuadro por
            allá y un texto por acá". Sin borde propio — a este tamaño el borde
            en dos lados de un rombo se lee como un defecto. */}
        {punta ? (
          <span
            aria-hidden
            className="absolute h-3 w-3 rotate-45 bg-accent"
            style={{
              left: puntaX - 6,
              [punta === "arriba" ? "top" : "bottom"]: -5,
            }}
          />
        ) : null}
        <div className="relative flex flex-col gap-3 rounded-lg border border-on-accent/15 bg-accent p-4">
          {/* `.display` (no `.editorial`): .editorial fuerza font-style:normal
              fuera de las cascade layers → gana sobre la utilidad `italic` y la
              serif sale en redonda (se lee como la Bodoni del v2, ya abandonada).
              .display solo fija la familia, así que aquí sí manda la itálica. */}
          <p className="display text-[19px] font-normal italic leading-[1.35] text-on-accent">
            <Icon
              name="destello"
              size={15}
              strokeWidth={2}
              className="mr-1.5 inline-block translate-y-px"
            />
            {children}
          </p>
          {/* El "entendido" a la derecha: sobre la tarjeta ya es lo único
              tocable, y a la izquierda competía con el arranque del texto. */}
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="-mb-1 -mr-1 ml-auto min-h-9 rounded-sm px-3 text-[13px] font-bold text-on-accent transition-colors hover:bg-on-accent/10"
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
