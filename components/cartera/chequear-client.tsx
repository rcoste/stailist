"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { Swatch } from "@/lib/palette-data";
import { dominantColor } from "@/lib/color/extract";
import { checkColor, type CheckResult } from "@/lib/color/match";

const VERDICT: Record<
  CheckResult["verdict"],
  { label: string; tone: string; cls: string }
> = {
  va: { label: "Sí va con tu paleta", tone: "✓", cls: "bg-success/10 text-success" },
  "no-ideal": {
    label: "No es ideal para tu colorimetría",
    tone: "!",
    cls: "bg-warning/10 text-warning",
  },
  parecido: {
    label: "Hay un color parecido recomendado",
    tone: "≈",
    cls: "bg-accent-soft text-ink",
  },
};

export function ChequearClient({ va, evita }: { va: Swatch[]; evita: Swatch[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 140;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBusy(false);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const hex = dominantColor(ctx.getImageData(0, 0, w, h).data, w, h);
      setResult(checkColor(hex, va, evita));
      setPreview(url);
      setBusy(false);
    };
    img.onerror = () => setBusy(false);
    img.src = url;
  }

  function reset() {
    setResult(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="flex flex-col gap-5 pt-4">
      {/* Back */}
      <Link
        href="/cartera"
        className="flex w-fit items-center gap-1.5 text-[15px] font-semibold text-ink"
      >
        <Icon name="chevron" size={19} rotate={180} /> cartera
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          chequea un color
        </h1>
        <p className="text-sm text-muted">
          ¿comprando en línea? sube la foto de la prenda y te digo si va con tu
          colorimetría.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />

      {!result ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface px-6 text-center transition-colors hover:border-ink disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-muted">
            <Icon name="destello" size={24} />
          </span>
          <span className="text-sm font-semibold text-ink">
            {busy ? "leyendo el color…" : "subir foto de la prenda"}
          </span>
          <span className="text-xs text-muted">desde tu galería o cámara</span>
        </button>
      ) : (
        <Result result={result} preview={preview} onReset={reset} />
      )}

      <p className="rounded-md border border-line bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
        leo el color principal de la prenda. en estampados o multicolor me quedo con
        el tono dominante — úsalo como guía.
      </p>
    </section>
  );
}

function Result({
  result,
  preview,
  onReset,
}: {
  result: CheckResult;
  preview: string | null;
  onReset: () => void;
}) {
  const v = VERDICT[result.verdict];
  const explanation =
    result.verdict === "va"
      ? `Se parece a ${result.nearestVa.nombre}. Adelante, te va.`
      : result.verdict === "no-ideal"
        ? `Tira a ${result.nearEvita?.nombre ?? "un tono que te apaga"}, de los que apagan tu cara. Si te encanta, llévalo lejos de la cara (pantalón, no top) — o cámbialo por uno de estos.`
        : `No es exacto de tu paleta, pero estos te quedan mejor y se le parecen.`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="prenda"
            className="h-20 w-20 flex-none rounded-md border border-line object-cover"
          />
        ) : null}
        <div className="flex items-center gap-2.5">
          <span
            className="h-12 w-12 flex-none rounded-md border border-line"
            style={{ backgroundColor: result.garmentHex }}
          />
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted">color detectado</span>
            <span className="tabular text-sm font-semibold text-ink">{result.garmentHex}</span>
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-bold ${v.cls}`}>
        <span aria-hidden>{v.tone}</span>
        {v.label}
      </div>

      <p className="editorial text-[14px] leading-relaxed text-muted">{explanation}</p>

      {result.verdict !== "va" ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            mejor estos
          </p>
          <div className="grid grid-cols-3 gap-3">
            {result.alternatives.map((s, i) => (
              <figure key={i} className="flex flex-col gap-1.5">
                <div
                  className="aspect-square w-full rounded-md border border-line"
                  style={{ backgroundColor: s.hex }}
                />
                <figcaption className="text-[10.5px] font-medium leading-tight text-ink">
                  {s.nombre}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="flex min-h-12 items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
      >
        <Icon name="repetir" size={16} /> chequear otra
      </button>
    </div>
  );
}
