"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { Swatch } from "@/lib/palette-data";
import { checkColor, type Verdict } from "@/lib/color/match";
import { saveToWishlist } from "@/lib/wishlist-add";
import { removeWishlistItem } from "@/lib/wishlist-actions";
import { WishlistTryon } from "@/components/wishlist/wishlist-tryon";
import { ComboBuilder } from "@/components/wishlist/combo-builder";
import { ClosetNav } from "@/components/closet-nav";
import { Hint } from "@/components/hint";

export type WishlistItem = {
  id: string;
  image: string | null;
  colorHex: string | null;
  verdict: Verdict | null;
  name: string | null;
};

export type ClosetPick = { id: string; nombre: string; image: string | null };

// Comprime a 1280px JPEG antes de mandarla al análisis (mismo tamaño que usa el
// import del clóset: suficiente para que la IA lea la tela, y no revienta el
// payload con una foto de 12 MP).
function comprimir(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const max = 1280;
      let { width, height } = img;
      if (width > height && width > max) {
        height = (height * max) / width;
        width = max;
      } else if (height > max) {
        width = (width * max) / height;
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const BADGE: Record<Verdict, { label: string; tone: string; cls: string }> = {
  va: { label: "va contigo", tone: "✓", cls: "bg-success/10 text-success" },
  "no-ideal": { label: "no ideal", tone: "!", cls: "bg-warning/10 text-warning" },
  parecido: { label: "parecido", tone: "≈", cls: "bg-accent-soft text-ink" },
};

export function WishlistClient({
  items,
  closet,
  va,
  evita,
  showCarteraHint = false,
}: {
  items: WishlistItem[];
  closet: ClosetPick[];
  va: Swatch[];
  evita: Swatch[];
  showCarteraHint?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [tryonId, setTryonId] = useState<string | null>(null);
  const [combo, setCombo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // El color y el nombre los saca la IA, NO el cálculo de color dominante del
  // navegador. Ese cálculo servía para una foto tomada de cerca, pero con una
  // FOTO DE PRODUCTO —prenda chica sobre fondo de estudio— devuelve el fondo:
  // el pantalón de lino oliva de Roberto se guardó como #f2f2f2 con veredicto
  // "va contigo", que es un juicio sobre el fondo blanco de Zara (2026-07-30).
  // No era cuestión de calibrar el umbral: el fondo de estudio (242) cae bajo el
  // corte de "casi blanco" (244) y, aunque no cayera, en esa foto hay más
  // píxeles de fondo que de tela dentro del recorte.
  //
  // El mismo analizador del clóset acierta en esas fotos (medido: #7BA69A para
  // un suéter verde de catálogo, #DED6C4 para un vestido beige) porque el prompt
  // le pide el color de la TELA ignorando luz y sombra. De paso trae nombre,
  // categoría y material — el nombre es el que la tarjeta nunca tuvo.
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    let hex: string | null = null;
    let verdict: Verdict | null = null;
    let nombre: string | null = null;
    try {
      const dataUrl = await comprimir(file);
      const res = await fetch("/api/analizar-prenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (res.ok) {
        // La respuesta viene envuelta: { analisis: {...} }, no plana.
        const { analisis } = (await res.json()) as {
          analisis?: { nombre?: string; color_hex?: string };
        };
        nombre = analisis?.nombre ?? null;
        hex = analisis?.color_hex ?? null;
      }
    } catch {
      // Sin análisis se guarda igual: la foto en la wishlist vale por sí sola y
      // perderla por un fallo de red sería peor que quedarse sin veredicto.
    }
    if (hex && va.length) verdict = checkColor(hex, va, evita).verdict;
    const res = await saveToWishlist(file, hex, verdict, "upload", nombre);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) router.refresh();
  }

  function del(id: string) {
    start(async () => {
      const res = await removeWishlistItem(id);
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-5 pt-1">
      <ClosetNav />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          tu wishlist
        </h1>
        <p className="text-sm text-muted">
          cosas que te laten para comprar. te digo si el color va contigo.
        </p>
        {/* Entrada contextual a la cartera de colores: la wishlist es la
            superficie de "modo compras", justo donde quieres checar colores. */}
        <Link
          href="/cartera"
          data-hint-target="wishlist-cartera"
          className="mt-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          ¿de compras? abre tu cartera de colores
        </Link>
      </div>

      {/* Hint contextual (una vez): coach-mark que señala la cartera. */}
      {showCarteraHint ? (
        <Hint id="wishlist-cartera">
          antes de comprar, tu <strong>cartera de colores</strong> te dice si ese
          tono te enciende la cara o te apaga
        </Hint>
      ) : null}

      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex h-[54px] w-full lg:max-w-md items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-60"
      >
        <Icon name="destello" size={18} /> {busy ? "agregando…" : "agregar una prenda"}
      </button>

      {items.length > 0 || closet.length > 0 ? (
        <button
          type="button"
          onClick={() => setCombo(true)}
          className="flex h-[50px] w-full lg:max-w-md items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
        >
          <Icon name="repetir" size={16} /> armar un look (wishlist + clóset)
        </button>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-muted">
            aún no agregas nada. cuando veas algo en tienda o en línea, tómale foto
            y guárdalo aquí para decidir mejor.
          </p>
          {/* Descubrimiento: si no tienes nada guardado, chismea un guardarropa
              de stylist en la biblioteca (donde viven Carla y las que vengan). */}
          <Link
            href="/closet/biblioteca"
            className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            …o chismea el clóset de una stylist y guarda lo que te late →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
                {/* El nombre: la tarjeta no lo mostraba aunque la columna
                    existiera, así que una prenda subida por foto se quedaba
                    en "una imagen y un veredicto de color" sin decir qué es. */}
                {it.name ? (
                  <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
                    {it.name}
                  </p>
                ) : null}
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

      {combo ? (
        <ComboBuilder wishlist={items} closet={closet} onClose={() => setCombo(false)} />
      ) : null}
    </section>
  );
}
