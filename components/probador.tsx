"use client";

import { useEffect, useState } from "react";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/scroll-lock";
import Link from "next/link";
import { Spinner } from "@/components/spinner";
/**
 * Lo mínimo que el probador necesita saber de una prenda: cómo se ve y cómo se
 * llama. Nada más.
 *
 * Antes importaba `WishlistItem` y `ClosetPick` de wishlist-client, y esa
 * dependencia era justo lo que lo tenía atado a una pantalla: para montarlo
 * desde el clóset había que arrastrar los tipos de la wishlist. Ahora cada
 * pantalla mapea lo suyo a esto, que es lo único que se pinta.
 */
export type PrendaProbador = { id: string; image: string | null; nombre: string };

type Sel = { kind: "w" | "c"; id: string };
type Phase = "pick" | "gen" | "result" | "sin_avatar" | "error";
const MAX = 4;

// EL PROBADOR: eliges hasta 4 prendas —tuyas o de tu wishlist— y te ves con
// ellas puestas. Selector → /api/wishlist/tryon-combo.
//
// SE LLAMABA "armar un look" Y VIVÍA EN components/wishlist/ (2026-08-12).
// Las dos cosas estaban mal por el mismo motivo: la etiqueta no nombraba lo que
// es.
//
// El nombre chocaba de frente con "arma un look con esta prenda", que hace lo
// CONTRARIO — ahí el motor decide qué ponerte; aquí decides tú y la app sólo lo
// dibuja. Dos botones con el mismo nombre y resultados distintos es peor que un
// nombre feo. "Probarte" vs "armar" es exactamente esa diferencia en español.
//
// Y la carpeta: vivía bajo `wishlist/`, que es donde guardas lo que NO tienes,
// así que alguien que quisiera combinar su propia ropa no iba a buscar ahí
// jamás. Funciona igual de bien con puras prendas tuyas.
//
// La RUTA de API sigue llamándose /api/wishlist/tryon-combo: es interna, nadie
// la ve, y renombrarla sólo agrega riesgo de 404 sin ganar nada.
export function Probador({
  wishlist,
  closet,
  onClose,
}: {
  /** Deseos: cosas que NO tienes. Vacío desde el clóset si no hay. */
  wishlist: PrendaProbador[];
  /** Tu ropa. */
  closet: PrendaProbador[];
  onClose: () => void;
}) {
  const [sel, setSel] = useState<Sel[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, []);

  const isSel = (kind: "w" | "c", id: string) =>
    sel.some((s) => s.kind === kind && s.id === id);

  function toggle(kind: "w" | "c", id: string) {
    setSel((prev) => {
      if (prev.some((s) => s.kind === kind && s.id === id)) {
        return prev.filter((s) => !(s.kind === kind && s.id === id));
      }
      if (prev.length >= MAX) return prev;
      return [...prev, { kind, id }];
    });
  }

  async function generar() {
    setPhase("gen");
    try {
      const wishlistIds = sel.filter((s) => s.kind === "w").map((s) => s.id);
      const itemIds = sel.filter((s) => s.kind === "c").map((s) => s.id);
      const res = await fetch("/api/wishlist/tryon-combo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistIds, itemIds }),
      });
      const data = await res.json();
      if (data.error === "sin_avatar") {
        setPhase("sin_avatar");
        return;
      }
      if (!res.ok || !data.image) {
        setPhase("error");
        return;
      }
      setImage(data.image);
      setPhase("result");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "gen") {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-accent px-8 text-center">
        <Spinner className="h-10 w-10 text-on-accent" />
        <p className="text-sm font-semibold text-on-accent">Probándote el look…</p>
        <p className="text-xs text-on-accent/60">Tarda unos segundos.</p>
      </div>
    );
  }

  if (phase === "sin_avatar") {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-accent px-8 text-center">
        <p className="text-sm font-semibold text-on-accent">
          Para probarte un look necesitas tu avatar.
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

  if (phase === "result" && image) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-accent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Tú con este look" className="absolute inset-0 h-full w-full object-cover object-[50%_12%]" />
        <button
          type="button"
          onClick={onClose}
          aria-label="cerrar"
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[5] flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-[18px] font-semibold text-white backdrop-blur-sm"
        >
          ✕
        </button>
        <div className="relative z-[5] mt-auto flex items-center justify-between gap-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <span className="text-[12px] text-on-accent/80">
            así combinarían · es una aproximación
          </span>
          <button
            type="button"
            onClick={() => setPhase("pick")}
            className="min-h-10 rounded-sm bg-on-accent px-4 text-[13px] font-bold text-accent"
          >
            cambiar
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-accent px-8 text-center">
        <p className="text-sm font-semibold text-on-accent">No pude probarte el look.</p>
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
            onClick={() => setPhase("pick")}
            className="min-h-11 rounded-sm bg-on-accent px-6 text-sm font-bold text-accent"
          >
            Volver a elegir
          </button>
        </div>
      </div>
    );
  }

  // phase === "pick"
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg">
      <div className="flex flex-none items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="text-[17px] font-bold text-ink">pruébate un look</span>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">
          cancelar
        </button>
      </div>
      <p className="flex-none px-4 pb-2 text-[12px] text-muted">
        elige hasta {MAX} prendas — del wishlist y de tu clóset — y te las pruebas
        juntas.
      </p>

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {wishlist.length > 0 ? (
          <Section
            title="del wishlist"
            items={wishlist}
            kind="w"
            isSel={isSel}
            onToggle={toggle}
          />
        ) : null}
        <Section
          title="de mi clóset"
          items={closet}
          kind="c"
          isSel={isSel}
          onToggle={toggle}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-none items-center gap-3 border-t border-line bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <span className="text-[12px] text-muted">{sel.length}/{MAX}</span>
        <button
          type="button"
          onClick={generar}
          disabled={sel.length === 0}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          verme con esto
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  kind,
  isSel,
  onToggle,
}: {
  title: string;
  items: { id: string; image: string | null; nombre: string }[];
  kind: "w" | "c";
  isSel: (kind: "w" | "c", id: string) => boolean;
  onToggle: (kind: "w" | "c", id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5 flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{title}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((it) => {
          const on = isSel(kind, it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(kind, it.id)}
              className={`relative aspect-[3/4] overflow-hidden rounded-md border bg-surface ${
                on ? "border-accent ring-2 ring-inset ring-accent" : "border-line"
              }`}
            >
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.nombre} className="h-full w-full object-cover" />
              ) : null}
              {on ? (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
