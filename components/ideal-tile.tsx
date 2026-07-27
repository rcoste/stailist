"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { familiaToHex } from "@/lib/capsule-images";
import type { CapsuleItem } from "@/lib/capsule";

// Piezas compartidas para mostrar/generar la imagen de una prenda SUGERIDA (ideal
// que no tienes). Las usan tanto la cápsula del clóset (capsule-list) como la
// maleta del viaje (trip-result), para que el "tocar → generar → ver" se vea y se
// comporte igual en ambos. Fuente única: no dupliques esto en cada módulo.

// Texto ÚNICO del CTA de "generar/ver la imagen de esta prenda" (render bajo
// demanda). Compartido por todas las superficies (cápsula sugerida/decide,
// miniatura del clóset, prendas empacadas del viaje) para ser consistentes.
// "ver la prenda" describe lo que hace de verdad — genera la imagen del
// producto — sin sonar a try-on como el viejo "ver cómo queda".
export const VER_PRENDA_LABEL = "ver la prenda";

export type RenderArgs = {
  tipo: string;
  colorFamilia: string;
  nombre: string;
  categoria: string;
  formalidad?: string | null;
  temporada?: string | null;
  visual?: string | null;
};

// Args de render a partir de una prenda ideal de la cápsula.
export function idealArgs(item: CapsuleItem): RenderArgs {
  return {
    tipo: item.tipo,
    colorFamilia: item.colorFamilia,
    nombre: item.nombre,
    categoria: item.category,
    formalidad: item.formalidad,
    temporada: item.temporada,
    visual: item.visual,
  };
}

// ¿El color es claro? (para elegir icono oscuro/claro encima del swatch).
export function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

// Estado de la imagen de una prenda sugerida: reposo (idle) → generando → listo.
// Expone `start()` explícito con estado de carga para poder mostrar la capa de
// "creando imagen…" (en vez del render auto-silencioso del viejo Thumb).
// `onReady`: al generar, la URL se reporta hacia arriba para cachearla a nivel
// de sesión — así no se pierde cuando la fila cambia de estado y se monta un
// componente nuevo (bug: al elegir "la sugerida" o marcar "ya la tengo", el
// tile volvía a "ver cómo queda" en vez de mostrar la imagen ya rendereada).
export function useIdealRender(
  renderArgs: RenderArgs,
  initialSrc: string | null,
  onReady?: (url: string) => void
) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [generated, setGenerated] = useState(false);
  const [state, setState] = useState<"idle" | "generating" | "ready">(
    initialSrc ? "ready" : "idle"
  );
  const start = async (): Promise<boolean> => {
    if (state === "generating") return false;
    setState("generating");
    try {
      const res = await fetch("/api/render-ideal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderArgs),
      });
      const j = (await res.json().catch(() => null)) as { url?: string } | null;
      if (j?.url) {
        setSrc(j.url);
        setGenerated(true);
        setState("ready");
        onReady?.(j.url);
        return true;
      }
      setState("idle");
      return false;
    } catch {
      setState("idle");
      return false;
    }
  };
  return { src, state, generated, start };
}

export type IdealRender = ReturnType<typeof useIdealRender>;

// Capa "creando imagen…" sobre el tile: barra que avanza + barrido shimmer +
// destello que late. El chip claro garantiza contraste sobre cualquier color.
function GenOverlay() {
  return (
    <span className="pointer-events-none absolute inset-0 z-20">
      <span className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-line/50">
        <span className="gen-bar block h-full bg-accent" />
      </span>
      <span className="absolute inset-0 overflow-hidden">
        <span className="gen-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
      </span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-1.5 rounded-sm bg-surface/85 px-2 py-1 text-ink">
          <Icon name="destello" size={14} className="gen-spark" />
          <span className="text-[10px] font-semibold leading-none">creando imagen…</span>
        </span>
      </span>
    </span>
  );
}

// La imagen recién generada entra con blur-up (reveal). Las que ya venían del
// catálogo se pintan directo, sin animación.
function RevealImg({ src, sizes }: { src: string; sizes: string }) {
  return (
    <span className="gen-reveal absolute inset-0">
      <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
    </span>
  );
}

// Contenido interno del tile de la prenda sugerida (sin el botón contenedor, que
// pone cada caller con su geometría): imagen/reveal, o swatch + franja "ver cómo
// queda" en reposo, o la capa de generación mientras corre.
export function IdealTileInner({
  render,
  colorFamilia,
  sizes,
  restLabel = VER_PRENDA_LABEL,
}: {
  render: IdealRender;
  colorFamilia: string;
  sizes: string;
  restLabel?: string;
}) {
  if (render.src) {
    return render.generated ? (
      <RevealImg src={render.src} sizes={sizes} />
    ) : (
      <Image src={render.src} alt="" fill sizes={sizes} className="object-cover" />
    );
  }
  // Sin render: NO se pinta el tile del color de la prenda a sangre. Un bloque de
  // color saturado en una app monocroma es lo más llamativo de la pantalla, no
  // comunica nada y se lee como imagen rota (assessment UX, 2026-07-26). En su
  // lugar: el papel del sistema + la percha, y el color baja a una banda al pie
  // — el dato de color se conserva sin competir con las fotos reales.
  const hex = familiaToHex(colorFamilia);
  return (
    <>
      <span className="absolute inset-0 flex items-center justify-center bg-tile">
        {render.state !== "generating" ? (
          <Icon name="gancho" size={20} className="text-ink/25" />
        ) : null}
      </span>
      {render.state === "generating" ? (
        <GenOverlay />
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[5px]"
            style={{ background: hex }}
          />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 px-2 pb-2.5 pt-5 text-[10px] font-semibold text-muted">
            <Icon name="destello" size={12} /> {restLabel}
          </span>
        </>
      )}
    </>
  );
}

// Anillo/check de selección (esquina del tile).
export function SelCheck() {
  return (
    <span className="absolute right-1.5 top-1.5 z-30 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-on-accent">
      <Icon name="check" size={12} strokeWidth={2.6} />
    </span>
  );
}
