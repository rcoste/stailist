"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { requestItemRender } from "@/lib/render-on-demand";

// Caja de imagen de una prenda con render bajo demanda. Si no hay imagen y la
// prenda tiene id, puede generarla llamando a /api/render-item (mismo motor que
// el auto-sanado del clóset). Modos:
//  - "auto": la renderiza sola al montar (Hoy: pocas faltantes, se siente fluido).
//  - "tap": muestra "toca para ver" y la renderiza al tocar (maleta: control de
//    costo cuando hay varias sugeridas).
//  - "none": solo muestra imagen o swatch (comportamiento viejo).
export function RenderableTile({
  itemId,
  imagen,
  swatch,
  nombre,
  mode = "none",
  sizes = "(max-width: 430px) 33vw, 130px",
}: {
  itemId?: string | null;
  imagen?: string | null;
  swatch: string;
  nombre: string;
  mode?: "auto" | "tap" | "none";
  sizes?: string;
}) {
  const [url, setUrl] = useState<string | null>(imagen ?? null);
  const [state, setState] = useState<"idle" | "rendering" | "failed">("idle");
  const tried = useRef(false);

  const render = useCallback(async () => {
    if (!itemId || url) return;
    tried.current = true;
    setState("rendering");
    const res = await requestItemRender(itemId);
    if (res.url) {
      setUrl(res.url);
      setState("idle");
    } else {
      // skipped (ya tenía imagen pero no nos llegó url) o fallo → swatch.
      setState(res.skipped ? "idle" : "failed");
    }
  }, [itemId, url]);

  // Auto: renderiza una sola vez al montar si falta imagen y hay id.
  useEffect(() => {
    if (mode === "auto" && !url && itemId && !tried.current) render();
    // Solo al montar; el resto lo maneja el tap/estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canTap = mode === "tap" && !url && !!itemId && state !== "rendering";

  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
      {url ? (
        <Image src={url} alt={nombre} fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          <span
            className="absolute inset-0"
            style={{ backgroundColor: swatch }}
            aria-hidden
          />
          {state === "rendering" ? (
            <span className="absolute inset-0 flex items-center justify-center bg-bg/45">
              <Spinner className="h-5 w-5" />
            </span>
          ) : canTap ? (
            <button
              type="button"
              onClick={render}
              aria-label={`Ver ${nombre}`}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg/35 text-ink transition-colors hover:bg-bg/55"
            >
              <Icon name="destello" size={18} />
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {state === "failed" ? "reintentar" : "toca para ver"}
              </span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
