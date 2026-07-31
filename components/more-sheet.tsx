"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { AddOptions } from "@/components/add-options";
import { AddPhotoFlow, type AddFlowHandle } from "@/components/add-photo-flow";
import { ImportCarreteFlow } from "@/components/import-carrete-flow";
import type { TripContext } from "@/lib/trip-context";

// El 4º slot de la tab bar. No es un destino: levanta una PALETA DE ATAJOS.
// Antes era un menú de filas con chevron (leía como ajustes, ~2/3 de pantalla);
// ahora es un atajo estrella + retícula de tiles, con un 2º nivel (agregar al
// clóset) al que la hoja MORFA sin bajar y volver a subir. La hoja vive por
// DEBAJO de la tab bar/FAB (z), reserva su alto abajo, y mide lo que pesa su
// contenido (sin scroll, sin alto en %).

const DUR_ENTER = 300; // --dur-medium
const DUR_EXIT = 200; // --dur-short

function useReduceMotion() {
  // Valor inicial lazy (client-only): la hoja jamás está montada en SSR, así que
  // no hay contenido que dependa de esto en el HTML del servidor. El effect solo
  // se suscribe a CAMBIOS (no vuelve a setear en el cuerpo del effect).
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function MoreSheet({
  userId,
  trip,
  active,
}: {
  userId: string;
  /** Viaje en curso o a ≤7 días: "armar maleta" va directo a TU maleta y el
   *  slot lleva un punto de aviso. */
  trip: TripContext | null;
  /** La ruta actual vive dentro de la hoja → el slot se pinta como activo. */
  active: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Nivel 2 (agregar al clóset) reusa estos flujos headless (foto · carrete).
  const photoRef = useRef<AddFlowHandle>(null);
  const carreteRef = useRef<AddFlowHandle>(null);

  // Cierra la hoja antes de navegar o de disparar un flujo (nadie queda con la
  // hoja abierta detrás).
  // setTimeout y no requestAnimationFrame: rAF se congela por completo en una
  // pestaña oculta (misma trampa que tenían los hints), así que ahí la hoja se
  // cerraba y la navegación no ocurría nunca. Lo único que hace falta es ceder
  // un tick para que la hoja cierre antes de navegar.
  function choose(action: () => void) {
    setOpen(false);
    setTimeout(action, 0);
  }
  const go = (href: string) => choose(() => router.push(href));

  // Con un viaje vivo (≤7 días), directo a su maleta; si no, la lista — nunca
  // el asistente en blanco, que es a donde iba antes y se sentía roto.
  const maletaHref = trip ? trip.href : "/viaje/lista";

  return (
    <>
      <div className="flex min-h-12 flex-1 flex-col items-center justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Más"
          aria-expanded={open}
          data-hint-target="viaje"
          className={`flex w-full flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors duration-200 ${
            active || open ? "text-accent" : "text-muted hover:text-ink"
          }`}
        >
          <span className="relative">
            <Icon name="puntos" active={active || open} />
            {trip ? (
              <span
                aria-hidden
                className="absolute -right-1.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent"
              />
            ) : null}
          </span>
          más
        </button>
      </div>

      {/* Flujos de añadir en modo headless: los dispara el nivel 2. */}
      <AddPhotoFlow userId={userId} headless ref={photoRef} />
      <ImportCarreteFlow headless ref={carreteRef} />

      <AtajosSheet
        open={open}
        onClose={() => setOpen(false)}
        maletaHref={maletaHref}
        go={go}
        onAddPhoto={() => choose(() => photoRef.current?.start())}
        onAddCarrete={() => choose(() => carreteRef.current?.start())}
        onAddBiblioteca={() => go("/closet/biblioteca")}
      />
    </>
  );
}

// Hoja de atajos con 2 niveles y morfo de alto. Va por portal a <body> (la tab
// bar usa translate y confinaría los `fixed` de sus hijos).
function AtajosSheet({
  open,
  onClose,
  maletaHref,
  go,
  onAddPhoto,
  onAddCarrete,
  onAddBiblioteca,
}: {
  open: boolean;
  onClose: () => void;
  maletaHref: string;
  go: (href: string) => void;
  onAddPhoto: () => void;
  onAddCarrete: () => void;
  onAddBiblioteca: () => void;
}) {
  const reduce = useReduceMotion();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [nivel, setNivel] = useState<"atajos" | "agregar">("atajos");

  // Montaje/desmontaje con animación de salida (la base Sheet solo desmonta).
  // El patrón mount-on-open + desmontaje diferido NECESITA setState aquí (montar
  // al abrir, esperar la animación de salida antes de desmontar); la regla
  // set-state-in-effect es un falso positivo para esta orquestación.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    if (mounted) {
      setShown(false);
      const t = setTimeout(() => {
        setMounted(false);
        setNivel("atajos"); // la próxima apertura arranca en el nivel 1
      }, reduce ? 0 : DUR_EXIT);
      return () => clearTimeout(t);
    }
  }, [open, mounted, reduce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Bloquea el scroll del fondo + Escape mientras vive.
  useEffect(() => {
    if (!mounted) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  // Morfo de alto entre niveles: mide el destino con `height:auto` (si no, el
  // alto fijo + overflow deja scrollHeight clampado y salta en un frame).
  const contentRef = useRef<HTMLDivElement>(null);
  const h0Ref = useRef<number | null>(null);
  function cambiaNivel(next: "atajos" | "agregar") {
    h0Ref.current = contentRef.current?.offsetHeight ?? null;
    setNivel(next);
  }
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || h0Ref.current == null) return;
    const h0 = h0Ref.current;
    h0Ref.current = null;
    const h1 = el.offsetHeight; // React ya renderizó el nuevo nivel
    if (reduce || h0 === h1) return;
    el.style.height = `${h0}px`;
    void el.getBoundingClientRect(); // reflow
    el.style.transition = `height ${DUR_ENTER}ms var(--ease-enter)`;
    el.style.height = `${h1}px`;
    const done = () => {
      el.style.height = "";
      el.style.transition = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
  }, [nivel, reduce]);

  if (!mounted || typeof document === "undefined") return null;

  const dur = shown ? DUR_ENTER : DUR_EXIT;

  return createPortal(
    // z-30: por DEBAJO de la tab bar (z-40), así el ✦ sigue tocable y se ve de
    // dónde salió la hoja.
    <div className="fixed inset-0 z-30 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
        style={{ opacity: shown ? 1 : 0, transition: reduce ? "none" : `opacity ${dur}ms` }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[430px] rounded-t-[14px] bg-surface px-5 pt-2.5 shadow-[0_-20px_50px_-26px_rgb(0_0_0/0.45)] lg:rounded-[14px]"
        style={{
          // Reserva: tab bar (57) + voladizo del FAB (22) + aire (16).
          paddingBottom: "calc(57px + 22px + 16px)",
          transform: shown ? "translateY(0)" : "translateY(24px)",
          opacity: shown ? 1 : 0,
          transition: reduce ? "none" : `transform ${dur}ms var(--ease-enter), opacity ${dur}ms`,
        }}
      >
        <span aria-hidden className="mx-auto mb-3 mt-1 block h-1 w-9 rounded-full bg-line" />

        {/* El contenido morfa; el asa de arriba queda fija como ancla. */}
        <div ref={contentRef} className="overflow-hidden">
          {nivel === "atajos" ? (
            <NivelAtajos
              key="atajos"
              maletaHref={maletaHref}
              go={go}
              onAgregar={() => cambiaNivel("agregar")}
            />
          ) : (
            <NivelAgregar
              key="agregar"
              onBack={() => cambiaNivel("atajos")}
              onAddPhoto={onAddPhoto}
              onAddCarrete={onAddCarrete}
              onAddBiblioteca={onAddBiblioteca}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function NivelAtajos({
  maletaHref,
  go,
  onAgregar,
}: {
  maletaHref: string;
  go: (href: string) => void;
  onAgregar: () => void;
}) {
  // "armar maleta" y "viajes" eran dos mosaicos donde uno CONTENÍA al otro: la
  // lista de viajes ya abre con "armar una maleta nueva" como acción principal.
  // Y el chico mentía — solo llevaba a TU maleta si el viaje salía en ≤7 días;
  // con un viaje guardado más lejos te aventaba a un asistente en blanco, como
  // si no existiera (lo vio Roberto con su Tokio a 130 días).
  //
  // Ahora es uno: la lista, que es el hub honesto. Se conserva lo bueno del
  // viejo — con un viaje vivo entras directo a su maleta.
  const tiles: { icon: IconName; label: string; onClick: () => void }[] = [
    { icon: "maleta", label: "viajes", onClick: () => go(maletaHref) },
    { icon: "camisa", label: "tus esenciales", onClick: () => go("/closet/capsula") },
    { icon: "lupa", label: "modo tienda", onClick: () => go("/cartera/chequear") },
    { icon: "paleta", label: "tus colores", onClick: () => go("/cartera") },
    { icon: "corazon", label: "favoritos", onClick: () => go("/historial?filtro=fav") },
    { icon: "bookmark", label: "wishlist", onClick: () => go("/wishlist") },
  ];
  return (
    <div style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
      {/* Atajo estrella: lo que más se usa, en negro y a lo ancho. */}
      <button
        type="button"
        onClick={onAgregar}
        className="flex min-h-16 w-full items-center gap-3.5 rounded-sm bg-accent px-4 py-3 text-left text-on-accent transition-colors hover:bg-accent-deep"
      >
        <Icon name="camara" size={22} className="shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold">añadir prendas</span>
          <span className="text-[12.5px] font-medium opacity-70">foto, carrete o básicos</span>
        </span>
      </button>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <TileAtajo key={t.label} icon={t.icon} label={t.label} onClick={t.onClick} />
        ))}
      </div>
    </div>
  );
}

function NivelAgregar({
  onBack,
  onAddPhoto,
  onAddCarrete,
  onAddBiblioteca,
}: {
  onBack: () => void;
  onAddPhoto: () => void;
  onAddCarrete: () => void;
  onAddBiblioteca: () => void;
}) {
  // Filas (no tiles): las 3 formas se parecen y la diferencia (foto suelta vs.
  // carrete múltiple vs. set preestablecido) no se entiende solo con el nombre.
  // El handoff marca este trade-off: con descripción se pierde la gramática de
  // tiles, pero gana el contexto — que es lo que aquí hace falta.
  //
  // La lista sale de AddOptions: aquí vivía una segunda copia con textos
  // distintos a los de la hoja de "agregar", y las mejoras siempre se quedaban
  // en una de las dos.
  return (
    <div style={{ animation: "var(--dur-medium) var(--ease-enter) step-in" }}>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a los atajos"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent"
        >
          <Icon name="chevron" size={16} className="rotate-180" />
        </button>
        <h3 className="text-[22px] font-bold tracking-[-0.01em] text-ink">agregar al clóset</h3>
      </div>
      <AddOptions
        onFoto={onAddPhoto}
        onCarrete={onAddCarrete}
        onBiblioteca={onAddBiblioteca}
      />
    </div>
  );
}

function TileAtajo({
  icon,
  label,
  onClick,
  minH = 91,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  minH?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ minHeight: minH }}
      className="flex flex-col items-center justify-center gap-2 rounded-sm border border-line bg-surface px-1 text-center transition-colors hover:border-accent"
    >
      <Icon name={icon} size={22} className="text-ink" />
      <span className="text-[13px] font-medium leading-tight text-ink">{label}</span>
    </button>
  );
}
