"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { removeStyleReference } from "@/app/perfil/actions";

export type StyleRef = { summary: string; tags: string[]; image: string | null };

// "Tu estilo de referencia": subes la foto de alguien cuyo estilo te gusta, la IA
// describe el VIBE (no la persona) y el motor lo usa para inspirar tus outfits.
// La colorimetría sigue mandando el color; esto inspira siluetas y aire.
export function StyleReferenceCard({ initial }: { initial: StyleRef | null }) {
  const [ref, setRef] = useState<StyleRef | null>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      try {
        const res = await fetch("/api/estilo-referencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErr("No pude leer el estilo. Prueba con otra foto, de cuerpo completo.");
        } else {
          setRef({ summary: data.summary, tags: data.tags ?? [], image: data.image ?? null });
        }
      } catch {
        setErr("Algo falló. Inténtalo de nuevo.");
      }
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    };
    img.onerror = () => {
      setErr("Esa imagen no se pudo leer.");
      setBusy(false);
    };
    img.src = url;
  }

  function remove() {
    start(async () => {
      const r = await removeStyleReference();
      if (r.ok) setRef(null);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Tu estilo de referencia
        </span>
        {ref ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep disabled:opacity-50"
          >
            cambiar
          </button>
        ) : null}
      </div>

      {busy ? (
        <div className="flex items-center gap-2.5 py-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> leyendo el estilo…
        </div>
      ) : ref ? (
        <div className="flex gap-3">
          {ref.image ? (
            <div className="relative h-[88px] w-[68px] shrink-0 overflow-hidden rounded-md border border-line bg-bg">
              <Image src={ref.image} alt="Tu referencia" fill sizes="68px" className="object-cover" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-[13.5px] leading-snug text-ink">{ref.summary}</p>
            {ref.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ref.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-line bg-bg px-2 py-0.5 text-[11px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="mt-0.5 w-fit text-[11.5px] font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
            >
              {pending ? "quitando…" : "quitar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[13px] leading-snug text-muted">
            ¿Te encanta cómo se viste alguien? Sube una foto y afino tus outfits
            hacia ese estilo (tus colores no cambian).
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-10 w-fit items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
          >
            <Icon name="destello" size={16} /> subir una foto
          </button>
        </>
      )}

      {err ? <p className="text-xs text-error">{err}</p> : null}
    </div>
  );
}
