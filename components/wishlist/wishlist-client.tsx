"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import type { Swatch } from "@/lib/palette-data";
import { dominantColor } from "@/lib/color/extract";
import { checkColor, type Verdict } from "@/lib/color/match";
import { saveToWishlist } from "@/lib/wishlist-add";
import { removeWishlistItem } from "@/lib/wishlist-actions";
import { WishlistTryon } from "@/components/wishlist/wishlist-tryon";

export type WishlistItem = {
  id: string;
  image: string | null;
  colorHex: string | null;
  verdict: Verdict | null;
  name: string | null;
};

const BADGE: Record<Verdict, { label: string; tone: string; cls: string }> = {
  va: { label: "va contigo", tone: "✓", cls: "bg-success/10 text-success" },
  "no-ideal": { label: "no ideal", tone: "!", cls: "bg-warning/10 text-warning" },
  parecido: { label: "parecido", tone: "≈", cls: "bg-accent-soft text-ink" },
};

export function WishlistClient({
  items,
  va,
  evita,
}: {
  items: WishlistItem[];
  va: Swatch[];
  evita: Swatch[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [tryonId, setTryonId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      let hex: string | null = null;
      let verdict: Verdict | null = null;
      const max = 140;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        hex = dominantColor(ctx.getImageData(0, 0, w, h).data, w, h);
        if (va.length) verdict = checkColor(hex, va, evita).verdict;
      }
      URL.revokeObjectURL(url);
      const res = await saveToWishlist(file, hex, verdict, "upload");
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      if (res.ok) router.refresh();
    };
    img.onerror = () => {
      setBusy(false);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function del(id: string) {
    start(async () => {
      const res = await removeWishlistItem(id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          tu wishlist
        </h1>
        <p className="text-sm text-muted">
          cosas que te laten para comprar. te digo si el color va contigo.
        </p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-60"
      >
        <Icon name="destello" size={18} /> {busy ? "agregando…" : "agregar una prenda"}
      </button>

      {items.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          aún no agregas nada. cuando veas algo en tienda o en línea, tómale foto y
          guárdalo aquí para decidir mejor.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div
              key={it.id}
              className={`flex flex-col overflow-hidden rounded-lg border border-line bg-surface ${
                pending ? "opacity-70" : ""
              }`}
            >
              <div className="relative aspect-[3/4] w-full bg-bg">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="prenda" className="h-full w-full object-cover" />
                ) : null}
                <button
                  type="button"
                  onClick={() => del(it.id)}
                  aria-label="quitar"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-[14px] text-white backdrop-blur-sm"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-2 p-2">
                <div className="flex items-center gap-2">
                  {it.colorHex ? (
                    <span
                      className="h-4 w-4 flex-none rounded-full border border-line"
                      style={{ backgroundColor: it.colorHex }}
                      aria-hidden
                    />
                  ) : null}
                  {it.verdict ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${BADGE[it.verdict].cls}`}
                    >
                      {BADGE[it.verdict].tone} {BADGE[it.verdict].label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">sin colorimetría</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTryonId(it.id)}
                  className="flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-line bg-bg text-[12px] font-semibold text-ink transition-colors hover:border-ink"
                >
                  <Icon name="destello" size={14} /> pruébatela
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tryonId ? (
        <WishlistTryon itemId={tryonId} onClose={() => setTryonId(null)} />
      ) : null}
    </section>
  );
}
