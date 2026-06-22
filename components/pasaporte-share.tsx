"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { PasaporteCard } from "@/components/pasaporte-card";
import { Icon } from "@/components/icon";
import type { PasaporteData } from "@/lib/pasaporte";

// Muestra el pasaporte y lo comparte como imagen. Captura la card con
// html-to-image (sin imágenes externas → limpio) y usa Web Share con archivo
// en móvil (va directo a IG/WhatsApp); si no, descarga el PNG.
export function PasaporteShare({ data }: { data: PasaporteData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function compartir() {
    if (!ref.current) return;
    setBusy(true);
    setError(false);
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 3, backgroundColor: "#F5F3F0" });
      if (!blob) throw new Error("no_blob");
      const file = new File([blob], "pasaporte-stailist.png", { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi pasaporte de estilo" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pasaporte-stailist.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // AbortError = el usuario canceló el diálogo de compartir; no es error.
      if (!(e instanceof Error && e.name === "AbortError")) setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PasaporteCard ref={ref} data={data} />
      <button
        type="button"
        onClick={compartir}
        disabled={busy}
        className="flex min-h-12 w-[360px] items-center justify-center gap-2 rounded-full bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
      >
        <Icon name="compartir" size={18} />
        {busy ? "Preparando tu imagen…" : "Compartir mi pasaporte"}
      </button>
      {error ? (
        <p className="text-sm text-error">No pude generar la imagen — inténtalo otra vez.</p>
      ) : null}
    </div>
  );
}
