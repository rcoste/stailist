"use client";

import { useEffect, useState } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import Link from "next/link";
import Image from "next/image";
import { GeneratingScreen } from "@/components/generating-screen";
import { TRYON_PHRASES } from "@/components/tryon-immersive";

type State = "gen" | "full" | "sin_avatar" | "error";

// Cartera · Fase 3b: "verme con esto" sobre un candidato del Wishlist. Llama al
// endpoint (avatar + prenda → Gemini, cacheado) y muestra el resultado inmersivo.
// Reusa el lenguaje oscuro del try-on de Hoy.
export function WishlistTryon({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [state, setState] = useState<State>("gen");
  const [image, setImage] = useState<string | null>(null);

  // No hace setState síncrono: todos los setState ocurren tras el await (async),
  // así el effect no dispara renders en cascada. El retry resetea a "gen" desde
  // el handler (no desde el effect).
  async function doTryon() {
    try {
      const res = await fetch(`/api/wishlist/${itemId}/tryon`, { method: "POST" });
      const data = await res.json();
      if (data.error === "sin_avatar") {
        setState("sin_avatar");
        return;
      }
      if (!res.ok || !data.image) {
        setState("error");
        return;
      }
      setImage(data.image);
      setState("full");
    } catch {
      setState("error");
    }
  }

  function retry() {
    setState("gen");
    doTryon();
  }

  useEffect(() => {
    // Fetch-on-mount legítimo: doTryon solo hace setState tras el await (async),
    // no en cascada síncrona. La regla da falso positivo aquí.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    doTryon();
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (state === "gen") {
    return <GeneratingScreen phrases={TRYON_PHRASES} tone="dark" />;
  }

  if (state === "sin_avatar") {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-accent px-8 text-center">
        <p className="text-sm font-semibold text-on-accent">
          Para verte con esto necesitas tu avatar.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-sm border border-on-accent/40 px-6 text-sm font-semibold text-on-accent"
          >
            Ahora no
          </button>
          <Link
            href="/perfil/avatar?return=%2Fwishlist"
            className="min-h-11 rounded-sm bg-on-accent px-6 text-sm font-bold leading-[44px] text-accent"
          >
            Crear mi avatar
          </Link>
        </div>
      </div>
    );
  }

  if (state === "error" || !image) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-accent px-8 text-center">
        <p className="text-sm font-semibold text-on-accent">No pude crear tu look.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-sm border border-on-accent/40 px-6 text-sm font-semibold text-on-accent"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={retry}
            className="min-h-11 rounded-sm bg-on-accent px-6 text-sm font-bold text-accent"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-accent">
      <div className="absolute inset-0">
        <Image
          src={image}
          alt="Tú con esta prenda"
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-[50%_12%]"
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="cerrar"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[5] flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-[18px] font-semibold text-white backdrop-blur-sm"
      >
        ✕
      </button>
      <p className="relative z-[5] mt-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] text-on-accent/80">
        así te verías con esta prenda · es una aproximación
      </p>
    </div>
  );
}
