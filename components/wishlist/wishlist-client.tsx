"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import type { Swatch } from "@/lib/palette-data";
import { checkColor, type Verdict } from "@/lib/color/match";
import { saveToWishlist } from "@/lib/wishlist-add";
import { moveWishlistItemToCloset, removeWishlistItem } from "@/lib/wishlist-actions";
import { WishlistTryon } from "@/components/wishlist/wishlist-tryon";
import { Probador } from "@/components/probador";
import { ClosetNav } from "@/components/closet-nav";
import { Hint } from "@/components/hint";
import { SuggestionCard } from "@/components/suggestion-card";
import { Toast } from "@/components/toast";

export type WishlistItem = {
  id: string;
  image: string | null;
  colorHex: string | null;
  verdict: Verdict | null;
  name: string | null;
  /** Ya se generó su try-on (cacheado): verlo es instantáneo. */
  tieneTryon?: boolean;
  /** Subida por foto y con categoría → se puede pasar al clóset al comprarla. */
  puedeAlCloset?: boolean;
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

// Lo que de verdad pasa mientras esperas, en orden: visión → color de la tela →
// comparación contra tu paleta. El progreso es lenguaje, no un spinner (misma
// regla que GeneratingScreen); y aquí se queda DENTRO de la tarjeta porque
// agregar una prenda no merece apoderarse de la pantalla.
const FRASES = ["leyendo la prenda…", "sacando su color real…", "¿va con tu paleta?"];

function FraseRotando() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FRASES.length), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      key={i}
      className="text-[12px] text-muted"
      style={{ animation: "var(--dur-medium) var(--ease-enter) step-in both" }}
    >
      {FRASES[i]}
    </span>
  );
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
  const [, start] = useTransition();
  const [tryonId, setTryonId] = useState<string | null>(null);
  const [combo, setCombo] = useState(false);
  /** URL local de la prenda que se está analizando (tarjeta provisional). */
  const [pendiente, setPendiente] = useState<string | null>(null);
  /** id de la prenda que se está pasando al clóset. */
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    // Tu foto entra a la reja AL INSTANTE, antes de analizar nada: la tienes en
    // local, así que hacerte esperar 10s frente a un botón congelado era
    // esconder algo que ya existía. La espera se vuelve ver tu prenda ya puesta
    // ahí mientras se le llena el nombre y el color.
    const previa = URL.createObjectURL(file);
    setPendiente(previa);
    let hex: string | null = null;
    let verdict: Verdict | null = null;
    let nombre: string | null = null;
    let attrs: Record<string, unknown> | null = null;
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
          analisis?: Record<string, unknown>;
        };
        // Se guarda el análisis COMPLETO, no solo nombre y color: la categoría
        // es lo que permite pasar la prenda al clóset cuando la compras.
        attrs = analisis ?? null;
        nombre = (analisis?.nombre as string) ?? null;
        hex = (analisis?.color_hex as string) ?? null;
      }
    } catch {
      // Sin análisis se guarda igual: la foto en la wishlist vale por sí sola y
      // perderla por un fallo de red sería peor que quedarse sin veredicto.
    }
    if (hex && va.length) verdict = checkColor(hex, va, evita).verdict;
    const res = await saveToWishlist(file, hex, verdict, "upload", nombre, attrs);
    setBusy(false);
    setPendiente(null);
    URL.revokeObjectURL(previa);
    if (inputRef.current) inputRef.current.value = "";
    if (res.ok) router.refresh();
  }

  function del(id: string) {
    start(async () => {
      const res = await removeWishlistItem(id);
      if (res.ok) router.refresh();
    });
  }

  function alCloset(id: string) {
    setMoviendo(id);
    start(async () => {
      const res = await moveWishlistItemToCloset(id);
      setMoviendo(null);
      if (res.ok) {
        setToast("Ya está en tu clóset");
        setTimeout(() => setToast(null), 2400);
        router.refresh();
      }
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
          <Icon name="repetir" size={16} /> pruébate un look con esto
        </button>
      ) : null}

      {items.length === 0 && !pendiente ? (
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
        // Misma card que la cápsula y el viaje (SuggestionCard): foto a la
        // izquierda, la información a la derecha y las acciones en el pie a lo
        // ancho. La reja de 2 columnas dejaba tarjetas de ~170px donde no
        // caben varias acciones — se apilaban botones diminutos uno sobre otro
        // (Roberto, 2026-07-30). Una prenda de la wishlist es lo mismo que una
        // sugerida: algo que estás considerando, con su veredicto y sus salidas.
        <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
          {/* Provisional mientras se analiza: misma anatomía para que al
              resolverse no salte nada. */}
          {pendiente ? (
            <li className="border border-line bg-surface">
              <div className="flex gap-[13px] p-[12px_13px]">
                <div className="relative aspect-[4/5] w-[86px] shrink-0 overflow-hidden bg-tile">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pendiente} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex min-h-[108px] flex-1 flex-col justify-center">
                  <FraseRotando />
                </div>
              </div>
            </li>
          ) : null}
          {items.map((it) => (
            <SuggestionCard
              key={it.id}
              eyebrow="la quieres"
              nombre={it.name ?? "prenda guardada"}
              chip={
                <span className="flex items-center gap-2">
                  {it.colorHex ? (
                    <span
                      aria-hidden
                      className="h-4 w-4 flex-none rounded-full border border-line"
                      style={{ backgroundColor: it.colorHex }}
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
                </span>
              }
              foto={
                it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : null
              }
              // Las tres salidas van en el PIE, como en la cápsula: ver cómo
              // te queda · pasarla al clóset · quitarla. Arriba no queda nada
              // porque aquí no hay "otro eje" — las tres son decisiones sobre
              // esta prenda.
              footer={[
                {
                  label: it.tieneTryon ? "así te queda" : "pruébatela",
                  icon: it.tieneTryon ? "check" : "destello",
                  onClick: () => setTryonId(it.id),
                  primary: true,
                },
                ...(it.puedeAlCloset
                  ? [
                      {
                        label: moviendo === it.id ? "pasándola…" : "ya la compré",
                        icon: "mas" as const,
                        onClick: () => alCloset(it.id),
                        busy: moviendo === it.id,
                      },
                    ]
                  : []),
                {
                  label: "quitar",
                  icon: "equis" as const,
                  onClick: () => del(it.id),
                },
              ]}
            />
          ))}
        </ul>
      )}

      {tryonId ? (
        <WishlistTryon itemId={tryonId} onClose={() => setTryonId(null)} />
      ) : null}

      {combo ? (
        <Probador
          wishlist={items.map((w) => ({
            id: w.id,
            image: w.image,
            nombre: w.name ?? "Prenda",
          }))}
          closet={closet}
          onClose={() => setCombo(false)}
        />
      ) : null}

      <Toast message={toast} />
    </section>
  );
}
