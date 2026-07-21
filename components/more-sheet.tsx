"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { AddSheet, type AddSheetHandle } from "@/components/add-sheet";
import type { TripContext } from "@/lib/trip-context";

// El 4º slot de la tab bar. No es un destino: levanta una hoja con las acciones
// y lugares que NO alcanzan pestaña propia pero estaban demasiado enterrados
// (modo tienda vivía a 4 taps: Perfil → estilo → cartera → chequear).
//
// CINCO elementos, tope duro. Wishlist y Cápsula NO están aquí a propósito: ya
// viven a 2 taps con etiqueta visible en el nav del Clóset, y repetirlas
// convertiría la hoja en cajón de sastre. "Añadir prendas" abre la hoja que ya
// existe (foto · carrete · biblioteca) en vez de repetir sus tres formas aquí.
//
// Viaje perdió su pestaña al ceder este slot; la compensación es que con viaje
// vivo encabeza la hoja con lugar y días, y el botón lleva un punto de aviso.
export function MoreSheet({
  userId,
  trip,
  active,
}: {
  userId: string;
  /** Viaje en curso o a ≤7 días: sube al tope de la hoja y prende el aviso. */
  trip: TripContext | null;
  /** La ruta actual vive dentro de la hoja → el slot se pinta como activo. */
  active: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const addRef = useRef<AddSheetHandle>(null);

  function choose(action: () => void) {
    setOpen(false);
    // Deja cerrar esta hoja antes de navegar o de abrir la de añadir.
    requestAnimationFrame(action);
  }

  const viajeSub = trip
    ? trip.dias === 0
      ? `estás en ${trip.lugar}`
      : trip.dias === 1
        ? `${trip.lugar} es mañana`
        : `${trip.lugar} en ${trip.dias} días`
    : "tus maletas y sus looks";

  return (
    <>
      <div className="flex min-h-12 flex-1 flex-col items-center justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Más"
          aria-expanded={open}
          // El coach-mark de viaje apunta aquí desde que Viaje dejó la barra.
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

      {/* La hoja de añadir, sin botón propio: la abre la fila "añadir prendas". */}
      <AddSheet userId={userId} variant="headless" ref={addRef} />

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center lg:items-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/40" />
          <div
            className="relative z-10 max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[18px] bg-surface px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2 lg:rounded-[18px]"
            style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3.5 mt-1.5 h-1 w-9 rounded-full bg-line" />

            {/* Viaje vivo primero: si estás de viaje, la maleta es lo que buscas. */}
            {trip ? (
              <>
                <Rotulo>tu viaje</Rotulo>
                <Fila
                  icon="maletin"
                  title="tu maleta"
                  sub={viajeSub}
                  onClick={() => choose(() => router.push(trip.href))}
                />
              </>
            ) : null}

            <Rotulo>acciones</Rotulo>
            <Fila
              icon="camara"
              title="añadir prendas"
              sub="foto, carrete o la biblioteca de básicos"
              onClick={() => choose(() => addRef.current?.open())}
            />
            <Fila
              icon="maleta"
              title="armar maleta"
              sub="dime a dónde vas y te la preparo"
              onClick={() => choose(() => router.push("/viaje"))}
            />
            <Fila
              icon="lupa"
              title="modo tienda"
              sub="¿este color me va? súbelo y te digo"
              onClick={() => choose(() => router.push("/cartera/chequear"))}
            />

            <Rotulo>tus cosas</Rotulo>
            {/* Con viaje vivo ya encabeza la hoja: no se repite aquí. */}
            {trip ? null : (
              <Fila
                icon="maletin"
                title="viaje"
                sub={viajeSub}
                onClick={() => choose(() => router.push("/viaje/lista"))}
              />
            )}
            <Fila
              icon="paleta"
              title="tu cartera de colores"
              sub="los tonos que te encienden la cara"
              onClick={() => choose(() => router.push("/cartera"))}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mx-1 mb-2 mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted first:mt-0">
      {children}
    </h3>
  );
}

function Fila({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2.5 flex w-full items-center gap-3.5 rounded-sm border border-line bg-surface px-3.5 py-3.5 text-left transition-colors hover:border-accent"
    >
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-sm border border-line text-ink">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="display text-[13.5px] text-muted">{sub}</span>
      </span>
      <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
    </button>
  );
}
