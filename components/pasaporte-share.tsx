"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { PasaporteCard } from "@/components/pasaporte-card";
import { Icon } from "@/components/icon";
import type { PasaporteData } from "@/lib/pasaporte";

// Muestra el pasaporte y lo comparte/guarda como imagen. Captura la card con
// html-to-image (sin imágenes externas → limpio): Web Share con archivo en móvil
// (va directo a IG/WhatsApp), descarga PNG si no hay share, y "Copiar link" para
// el link de la app. Botones crispados (no pill).
export function PasaporteShare({ data }: { data: PasaporteData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "compartir" | "guardar">(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Captura la tarjeta a PNG. pixelRatio 3 = nítida en pantallas retina; el bg
  // papel evita transparencias raras al compartir.
  async function capture(): Promise<Blob> {
    if (!ref.current) throw new Error("no_ref");
    const blob = await toBlob(ref.current, { pixelRatio: 3, backgroundColor: "#f4f3f1" });
    if (!blob) throw new Error("no_blob");
    return blob;
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pasaporte-stailist.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function compartir() {
    setBusy("compartir");
    setError(false);
    try {
      const blob = await capture();
      const file = new File([blob], "pasaporte-stailist.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi pasaporte de estilo" });
      } else {
        download(blob);
      }
    } catch (e) {
      // AbortError = el usuario canceló el diálogo de compartir; no es error.
      if (!(e instanceof Error && e.name === "AbortError")) setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function guardar() {
    setBusy("guardar");
    setError(false);
    try {
      download(await capture());
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  async function copiarLink() {
    // Falla rara (sin permiso de portapapeles); no es el error de la imagen, así
    // que no mostramos ese banner — el botón simplemente no confirma.
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PasaporteCard ref={ref} data={data} />

      <div className="flex w-[360px] max-w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={compartir}
          disabled={busy !== null}
          className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
        >
          <Icon name="compartir" size={18} />
          {busy === "compartir" ? "preparando tu imagen…" : "compartir mi pasaporte"}
        </button>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={guardar}
            disabled={busy !== null}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-sm border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-60"
          >
            <Icon name="descargar" size={15} className="text-muted" />
            {busy === "guardar" ? "guardando…" : "guardar imagen"}
          </button>
          <button
            type="button"
            onClick={copiarLink}
            className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-sm border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors duration-200 hover:border-ink"
          >
            <Icon name="enlace" size={15} className="text-muted" />
            {copied ? "¡copiado!" : "copiar link"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-error">No pude generar la imagen — inténtalo otra vez.</p>
      ) : null}
    </div>
  );
}
