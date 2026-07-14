"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { voteOutfit, toggleFavorite, wearToday } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";
import { Heart } from "@/components/heart";
import { LookDetail } from "./look-detail";

export type HistoryOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  createdAt: string; // ISO — para agrupar por mes
  fecha: string; // "18 jun"
  occasion: string | null; // clave cruda: diario/oficina/evento/viaje/refrescar
  origen: "daily" | "viaje"; // de dónde salió el look (badge "Viaje" si viaje)
  tryonImage: string | null; // foto "cómo se me ve" (URL firmada) o null → collage
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
  voto: "up" | "down" | null;
  worn: boolean;
  favorited: boolean;
};

export type EstadoItem = { voto: "up" | "down" | null; worn: boolean; fav: boolean };
type Estado = Record<string, EstadoItem>;

// Etiqueta corta de ocasión (de objectives.ts, pero compacta para chips).
const OCASION_LABEL: Record<string, string> = {
  diario: "Diario",
  oficina: "Oficina",
  evento: "Evento",
  viaje: "Aeropuerto",
  refrescar: "Refrescar",
};
export const ocasionLabel = (k: string) =>
  OCASION_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

type Filtro = "todos" | "fav" | "liked" | `occ:${string}`;

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function monthLabel(iso: string) {
  const m = new Date(iso).toLocaleDateString("es-MX", { month: "long" });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

// Imagen del look a tamaño grande: la foto "cómo se me ve" (object-cover) o, si
// no se generó avatar, el collage 2×2 de los flat-lays de sus prendas (3 prendas
// → 4ª celda lienzo limpio). Se usa en destacado, tile y detalle, siempre grande.
function LookImage({ o }: { o: HistoryOutfit }) {
  if (o.tryonImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={o.tryonImage}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        style={{ objectPosition: "50% 10%" }}
      />
    );
  }
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-line">
      {[0, 1, 2, 3].map((i) => {
        const p = o.prendas[i];
        return (
          <span
            key={i}
            className="bg-surface bg-center bg-no-repeat"
            style={
              p?.imagen
                ? { backgroundImage: `url(${p.imagen})`, backgroundSize: "78%" }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

// Sello "✓ Puesto" sobre la imagen (arriba-izquierda).
function WornSeal() {
  return (
    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-sm bg-success/90 px-2 py-1 text-[10px] font-bold text-white">
      <Icon name="check" size={11} /> Puesto
    </span>
  );
}

// Corazón de favorito sobre la imagen (arriba-derecha), botón circular claro.
function ImgHeart({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? "Quitar de favoritos" : "Guardar en favoritos"}
      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-[var(--shadow-hairline)] transition-colors hover:bg-surface"
    >
      <Heart on={on} size={16} />
    </button>
  );
}

export function HistoryList({ outfits }: { outfits: HistoryOutfit[] }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(() =>
    Object.fromEntries(
      outfits.map((o) => [o.id, { voto: o.voto, worn: o.worn, fav: o.favorited }])
    )
  );
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [occMenu, setOccMenu] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [rewearing, setRewearing] = useState<string | null>(null);

  // Ocasiones presentes en el historial (para el dropdown de filtro).
  const ocasiones = useMemo(() => {
    const seen = new Set<string>();
    for (const o of outfits) if (o.occasion) seen.add(o.occasion);
    return [...seen];
  }, [outfits]);

  const visibles = outfits.filter((o) => {
    const e = estado[o.id];
    if (filtro === "fav") return e?.fav;
    if (filtro === "liked") return e?.voto === "up";
    if (filtro.startsWith("occ:")) return o.occasion === filtro.slice(4);
    return true;
  });

  // Agrupar (ya viene desc por created_at) en meses, preservando el orden.
  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; items: HistoryOutfit[] }>();
    for (const o of visibles) {
      const k = monthKey(o.createdAt);
      if (!map.has(k)) map.set(k, { label: monthLabel(o.createdAt), items: [] });
      map.get(k)!.items.push(o);
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles]);

  const lookAbierto = abierto ? outfits.find((o) => o.id === abierto) ?? null : null;

  // Bloquea el scroll del fondo y cierra con Escape mientras el detalle está abierto.
  useEffect(() => {
    if (!lookAbierto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAbierto(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lookAbierto]);

  async function vote(id: string, up: boolean) {
    const prev = estado[id];
    const nuevo = up ? "up" : "down";
    setEstado((s) => ({ ...s, [id]: { ...s[id], voto: nuevo } }));
    const res = await voteOutfit(id, up);
    if (!res.ok) setEstado((s) => ({ ...s, [id]: prev }));
    else if (up) notifyFirstLike();
  }

  async function fav(id: string) {
    const prev = estado[id].fav;
    setEstado((s) => ({ ...s, [id]: { ...s[id], fav: !prev } }));
    const res = await toggleFavorite(id, !prev);
    if (!res.ok) setEstado((s) => ({ ...s, [id]: { ...s[id], fav: prev } }));
  }

  async function rewear(id: string) {
    setRewearing(id);
    const res = await wearToday(id);
    if (res.ok) {
      router.push("/hoy");
    } else {
      setRewearing(null);
    }
  }

  function pickOcc(key: string) {
    setFiltro(`occ:${key}` as Filtro);
    setOccMenu(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Fila de filtros (scroll horizontal) */}
      <div className="relative">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip on={filtro === "todos"} onClick={() => setFiltro("todos")} icon="filtro">
            todos
          </FilterChip>
          <FilterChip on={filtro === "fav"} onClick={() => setFiltro("fav")}>
            <Heart
              on={filtro === "fav"}
              size={13}
              className={filtro === "fav" ? "text-on-accent" : "text-muted"}
            />
            favoritos
          </FilterChip>
          <FilterChip on={filtro === "liked"} onClick={() => setFiltro("liked")} icon="pulgar">
            que gustaron
          </FilterChip>
          {ocasiones.length > 1 ? (
            <FilterChip
              on={filtro.startsWith("occ:")}
              onClick={() => setOccMenu((v) => !v)}
            >
              {filtro.startsWith("occ:") ? ocasionLabel(filtro.slice(4)) : "ocasión"}
              <Icon name="chevron" size={13} rotate={occMenu ? -90 : 90} />
            </FilterChip>
          ) : null}
        </div>

        {occMenu ? (
          <div className="absolute right-0 z-10 mt-1.5 flex min-w-[160px] flex-col rounded-sm border border-line bg-surface py-1 shadow-[var(--shadow-hairline)]">
            {ocasiones.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickOcc(k)}
                className="px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-bg"
              >
                {ocasionLabel(k)}
              </button>
            ))}
            {filtro.startsWith("occ:") ? (
              <button
                type="button"
                onClick={() => {
                  setFiltro("todos");
                  setOccMenu(false);
                }}
                className="border-t border-line px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-bg"
              >
                quitar filtro
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          {filtro === "fav"
            ? "aún no guardas favoritos. toca el corazón de un look para guardarlo aquí."
            : "nada por aquí con este filtro."}
        </p>
      ) : null}

      {/* Diario por meses: destacado (el más reciente del mes) + cuadrícula 2-up. */}
      {grupos.map((g) => {
        const [destacado, ...resto] = g.items;
        return (
          <div key={g.label} className="flex flex-col gap-3.5">
            <div className="flex items-baseline gap-2.5">
              <span className="editorial text-h3 text-ink">{g.label}</span>
              <span className="tabular text-[11.5px] text-muted">
                {g.items.length} {g.items.length === 1 ? "look" : "looks"}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {destacado ? (
              <Featured
                o={destacado}
                e={estado[destacado.id]}
                onOpen={() => setAbierto(destacado.id)}
                onFav={() => fav(destacado.id)}
              />
            ) : null}

            {resto.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
                {resto.map((o) => (
                  <GridTile
                    key={o.id}
                    o={o}
                    e={estado[o.id]}
                    onOpen={() => setAbierto(o.id)}
                    onFav={() => fav(o.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Detalle del look: vista con back real (no bottom-sheet). Sin try-on →
          3a claro (grid de prendas + "verme con este look"); con try-on → 3b
          oscuro inmersivo. Las acciones viven aquí, no en cada tarjeta, para que
          el diario se mantenga limpio. */}
      {lookAbierto ? (
        <LookDetail
          o={lookAbierto}
          e={estado[lookAbierto.id]}
          rewearing={rewearing === lookAbierto.id}
          onClose={() => setAbierto(null)}
          onVote={(up) => vote(lookAbierto.id, up)}
          onFav={() => fav(lookAbierto.id)}
          onRewear={() => rewear(lookAbierto.id)}
        />
      ) : null}
    </div>
  );
}

// Look destacado del mes: tarjeta full-width, imagen 4/5 con overlay inferior
// (nombre blanco + chip de ocasión + fecha), corazón y sello "Puesto" encima.
function Featured({
  o,
  e,
  onOpen,
  onFav,
}: {
  o: HistoryOutfit;
  e: EstadoItem;
  onOpen: () => void;
  onFav: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-bg">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir ${o.nombre}`}
        className="relative block w-full text-left"
      >
        <div className="aspect-[4/5] w-full">
          <LookImage o={o} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-3.5 pb-3.5 pt-9">
          <p className="editorial text-[21px] leading-[1.08] text-white">{o.nombre}</p>
          <p className="mt-1 flex items-center gap-2 text-[11.5px] text-white/85">
            {o.origen === "viaje" ? (
              <span className="inline-flex items-center gap-1 rounded-sm border border-white/40 px-[7px] py-0.5 font-semibold">
                <Icon name="maleta" size={11} /> Viaje
              </span>
            ) : o.occasion ? (
              <span className="rounded-sm border border-white/40 px-[7px] py-0.5 font-semibold">
                {ocasionLabel(o.occasion)}
              </span>
            ) : null}
            <span className="tabular">{o.fecha}</span>
          </p>
        </div>
      </button>
      {e.worn ? <WornSeal /> : null}
      <ImgHeart on={e.fav} onClick={onFav} />
    </div>
  );
}

// Tile de la cuadrícula 2-up: imagen 3/4 con corazón + sello encima, y nombre +
// "fecha · ocasión" DEBAJO (legibilidad), 👍 junto a la meta si gustó.
function GridTile({
  o,
  e,
  onOpen,
  onFav,
}: {
  o: HistoryOutfit;
  e: EstadoItem;
  onOpen: () => void;
  onFav: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ${o.nombre}`}
          className="block aspect-[3/4] w-full overflow-hidden rounded-md border border-line bg-bg"
        >
          <LookImage o={o} />
        </button>
        {e.worn ? <WornSeal /> : null}
        <ImgHeart on={e.fav} onClick={onFav} />
      </div>
      <div className="px-0.5 pt-2">
        <p className="editorial text-[15px] leading-tight text-ink">{o.nombre}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {o.origen === "viaje" ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-px text-[10px] font-semibold text-accent">
              <Icon name="maleta" size={10} /> Viaje
            </span>
          ) : null}
          <span className="tabular">{o.fecha}</span>
          {o.occasion ? <span>· {ocasionLabel(o.occasion)}</span> : null}
          {e.voto === "up" ? (
            <span className="inline-flex text-accent">
              <Icon name="pulgar" size={12} active />
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon?: "filtro" | "pulgar";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-[7px] text-xs font-semibold transition-colors duration-200 ${
        on
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {icon ? <Icon name={icon} size={13} active={on} /> : null}
      {children}
    </button>
  );
}
