"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/sheet";
import { ImportCarreteFlow, type AddFlowHandle } from "@/components/import-carrete-flow";
import { registrarInteresIg } from "@/lib/interes-instagram-actions";

// PRUEBA DE INTERÉS (2026-10-16): "¿te armamos tu clóset con tus fotos de
// Instagram?". Dice la verdad —lo estamos preparando— y mide quién lo quiere
// (lib/interes-instagram.ts; regla en la migración 0178). La foto de ejemplo y
// sus prendas son las de la landing (ig-h-* / ig-m-*), nunca de una usuaria.
// Al decir que sí no deja a nadie esperando: lo manda a subir su carrete, que
// es lo que de verdad hace volver (10 prendas propias el primer día).

const EJEMPLO = {
  hombre: { foto: "/landing/ig-h-foto.webp", prendas: ["/landing/ig-h-1-abrigo.webp", "/landing/ig-h-2-top.webp", "/landing/ig-h-3-bottom.webp", "/landing/ig-h-4-calzado.webp"] },
  mujer: { foto: "/landing/ig-m-foto.webp", prendas: ["/landing/ig-m-1-top.webp", "/landing/ig-m-2-bottom.webp", "/landing/ig-m-4-calzado.webp", "/landing/ig-m-3-accesorio.webp"] },
};

export function InteresInstagram({ userId, hombre }: { userId: string; hombre: boolean }) {
  const [estado, setEstado] = useState<"tarjeta" | "hoja" | "gracias" | "fuera">("tarjeta");
  const [usuario, setUsuario] = useState("");
  const [consiente, setConsiente] = useState(false);
  const carrete = useRef<AddFlowHandle>(null);
  const ej = hombre ? EJEMPLO.hombre : EJEMPLO.mujer;

  // Una vista por montaje: es la que cuenta "cuántas personas la vieron".
  useEffect(() => {
    void registrarInteresIg("visto");
  }, []);

  if (estado === "fuera") return null;

  if (estado === "gracias") {
    return (
      <div className="flex flex-col gap-3">
        <ImportCarreteFlow userId={userId} headless ref={carrete} />
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] text-on-accent">✓</span>
          <p className="text-[14px] leading-snug text-ink">
            anotado. mientras, <b>sube 10 fotos de tu carrete</b> y te armo looks con tu ropa de verdad.
          </p>
        </div>
        <button
          type="button"
          onClick={() => carrete.current?.start()}
          className="flex min-h-[48px] w-full items-center justify-center rounded-sm bg-accent text-[14px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          subir fotos de mi carrete
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-surface p-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">lo estamos preparando</span>
        <p className="text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">
          ¿te armamos tu clóset con tus fotos de <em className="display font-normal">Instagram</em>?
        </p>
        <div className="flex items-center gap-1.5" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ej.foto} alt="" className="h-20 w-16 shrink-0 rounded-sm object-cover" />
          <span className="px-0.5 text-faint">→</span>
          {ej.prendas.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-14 w-11 shrink-0 rounded-sm border border-line bg-tile object-cover" />
          ))}
        </div>
        <p className="text-[13px] leading-snug text-ink2">
          de tus fotos donde sales, <b className="text-ink">sacamos cada prenda</b> que traes puesta. tú eliges cuáles se quedan. no subes nada.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEstado("hoja")}
            className="flex min-h-11 flex-[2] items-center justify-center rounded-sm bg-accent text-[14px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            avísame
          </button>
          <button
            type="button"
            onClick={() => {
              void registrarInteresIg("no");
              setEstado("fuera");
            }}
            className="flex min-h-11 flex-1 items-center justify-center rounded-sm border border-line bg-surface text-[14px] font-medium text-ink transition-colors hover:border-ink"
          >
            no, gracias
          </button>
        </div>
      </div>

      <Sheet open={estado === "hoja"} onClose={() => setEstado("tarjeta")}>
        <div className="flex flex-col gap-3 pb-1">
          <p className="text-[20px] font-bold tracking-[-0.02em] text-ink">te avisamos en cuanto esté</p>
          <p className="text-[14px] leading-snug text-muted">si nos dejas tu usuario, te escribimos por Instagram. es opcional.</p>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="@tu_usuario (opcional)"
            className="min-h-12 rounded-sm border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
          {usuario.trim() && !consiente ? (
            <p className="-mt-1 text-[12px] text-muted">marca la casilla para que guardemos tu usuario; sin ella sólo anotamos que te interesa.</p>
          ) : null}
          {/* El permiso arranca SIN marcar: tiene que ser una decisión, no un default. */}
          <label className="flex items-start gap-2.5 text-[12.5px] leading-snug text-ink2">
            <input type="checkbox" checked={consiente} onChange={(e) => setConsiente(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
            acepto que stailist use mi usuario de Instagram sólo para avisarme de esto.
          </label>
          <button
            type="button"
            onClick={() => {
              void registrarInteresIg("si", { usuario, consiente });
              setEstado("gracias");
            }}
            className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-[15px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            listo
          </button>
        </div>
      </Sheet>
    </>
  );
}
