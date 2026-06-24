"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DownReason } from "@/components/down-reason";
import { voteOutfit, toggleFavorite, wearToday } from "@/lib/outfit-actions";
import { notifyFirstLike } from "@/lib/pwa";
import { Icon } from "@/components/icon";

export type HistoryOutfit = {
  id: string;
  nombre: string;
  explicacion: string;
  createdAt: string; // ISO — para agrupar por mes
  fecha: string; // "18 jun"
  occasion: string | null; // clave cruda: diario/oficina/evento/viaje/refrescar
  tryonImage: string | null; // foto "cómo se me ve" (URL firmada) o null → collage
  prendas: { nombre: string; swatch: string; imagen?: string | null }[];
  voto: "up" | "down" | null;
  worn: boolean;
  favorited: boolean;
};

type EstadoItem = { voto: "up" | "down" | null; worn: boolean; fav: boolean };
type Estado = Record<string, EstadoItem>;

// Etiqueta corta de ocasión (de objectives.ts, pero compacta para chips).
const OCASION_LABEL: Record<string, string> = {
  diario: "Diario",
  oficina: "Oficina",
  evento: "Evento",
  viaje: "Aeropuerto",
  refrescar: "Refrescar",
};
const ocasionLabel = (k: string) =>
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

// Corazón de favorito (relleno cuando on). Inline porque necesita fill; el Icon
// del set es siempre stroke. Off → muted (legible sobre círculo claro y dentro
// de chip), on → accent relleno.
function Heart({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={on ? "text-accent" : "text-muted"}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
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
            Todos
          </FilterChip>
          <FilterChip on={filtro === "fav"} onClick={() => setFiltro("fav")}>
            <Heart on={filtro === "fav"} size={13} />
            Favoritos
          </FilterChip>
          <FilterChip on={filtro === "liked"} onClick={() => setFiltro("liked")} icon="pulgar">
            Que gustaron
          </FilterChip>
          {ocasiones.length > 1 ? (
            <FilterChip
              on={filtro.startsWith("occ:")}
              onClick={() => setOccMenu((v) => !v)}
            >
              {filtro.startsWith("occ:") ? ocasionLabel(filtro.slice(4)) : "Ocasión"}
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
                Quitar filtro
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          {filtro === "fav"
            ? "Aún no guardas favoritos. Toca el corazón de un look para guardarlo aquí."
            : "Nada por aquí con este filtro."}
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
              <div className="grid grid-cols-2 gap-3">
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

      {/* Detalle del look (bottom sheet): foto/collage grande, "lo que llevabas"
          y las acciones (votar / Ponérmelo). Las acciones viven aquí, no en cada
          tarjeta, para que el diario se mantenga limpio. */}
      {lookAbierto ? (
        <LookSheet
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
            {o.occasion ? (
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
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
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

// Detalle del look en bottom sheet (mismo patrón que la hoja "Agregar"): imagen
// grande, "Lo que llevabas" con las prendas a buen tamaño, y las acciones.
function LookSheet({
  o,
  e,
  rewearing,
  onClose,
  onVote,
  onFav,
  onRewear,
}: {
  o: HistoryOutfit;
  e: EstadoItem;
  rewearing: boolean;
  onClose: () => void;
  onVote: (up: boolean) => void;
  onFav: () => void;
  onRewear: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={o.nombre}
        className="relative z-10 flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-y-auto rounded-t-[18px] bg-surface pb-[max(1.125rem,env(safe-area-inset-bottom))]"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface pb-2 pt-2">
          <div className="mx-auto h-1 w-9 rounded-full bg-line" />
        </div>

        <div className="relative mx-4 overflow-hidden rounded-lg border border-line bg-bg">
          <div className="aspect-[4/5] w-full">
            <LookImage o={o} />
          </div>
          {e.worn ? <WornSeal /> : null}
        </div>

        <div className="flex items-start gap-3 px-4 pt-3.5">
          <div className="min-w-0 flex-1">
            <p className="editorial text-[19px] leading-tight text-ink">{o.nombre}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
              {o.occasion ? (
                <span className="rounded-sm border border-line bg-bg px-[7px] py-0.5 font-semibold">
                  {ocasionLabel(o.occasion)}
                </span>
              ) : null}
              <span className="tabular">{o.fecha}</span>
              {e.worn ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <Icon name="check" size={12} /> Puesto
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onFav}
            aria-pressed={e.fav}
            aria-label={e.fav ? "Quitar de favoritos" : "Guardar en favoritos"}
            className="flex h-9 w-9 shrink-0 items-center justify-center"
          >
            <Heart on={e.fav} size={22} />
          </button>
        </div>

        {o.explicacion ? (
          <p className="px-4 pt-2 text-[12.5px] leading-relaxed text-muted">{o.explicacion}</p>
        ) : null}

        <div className="px-4 pt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.07em] text-muted">
            Lo que llevabas
          </p>
          <div className="flex gap-2">
            {o.prendas.map((p, i) => (
              <div
                key={i}
                className="aspect-[3/4] flex-1 overflow-hidden rounded-sm border border-line bg-bg"
                title={p.nombre}
              >
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagen}
                    alt={p.nombre}
                    loading="lazy"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <span className="block h-full w-full" style={{ background: p.swatch }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 px-4 pt-4">
          <button
            type="button"
            onClick={() => onVote(true)}
            aria-pressed={e.voto === "up"}
            aria-label="Me gusta"
            className={`flex min-h-11 w-12 flex-none items-center justify-center rounded-sm border transition-colors duration-200 ${
              e.voto === "up"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <Icon name="pulgar" size={16} active={e.voto === "up"} />
          </button>
          <button
            type="button"
            onClick={() => onVote(false)}
            aria-pressed={e.voto === "down"}
            aria-label="No me gusta"
            className={`flex min-h-11 w-12 flex-none items-center justify-center rounded-sm border transition-colors duration-200 ${
              e.voto === "down"
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-ink hover:border-ink"
            }`}
          >
            <Icon name="pulgar" size={16} rotate={180} active={e.voto === "down"} />
          </button>
          <button
            type="button"
            onClick={onRewear}
            disabled={rewearing}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-sm bg-accent text-[13px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
          >
            <Icon name="repetir" size={16} />
            {rewearing ? "Poniéndolo…" : "Ponérmelo"}
          </button>
        </div>

        {e.voto === "down" ? (
          <div className="px-4 pt-3">
            <DownReason outfitId={o.id} />
          </div>
        ) : null}
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
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {icon ? <Icon name={icon} size={13} active={on} /> : null}
      {children}
    </button>
  );
}
