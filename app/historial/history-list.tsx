"use client";

import { useMemo, useState } from "react";
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

type Estado = Record<
  string,
  { voto: "up" | "down" | null; worn: boolean; fav: boolean }
>;

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
// del set es siempre stroke. Vacío→hairline, activo→accent relleno.
function Heart({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className={on ? "text-accent" : "text-line"}
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />
    </svg>
  );
}

// Miniatura: la foto "cómo se me ve" si existe; si no, collage 2×2 de los
// flat-lays de las prendas (3 prendas → 4ª celda en blanco, lienzo limpio).
function Thumb({ o }: { o: HistoryOutfit }) {
  if (o.tryonImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={o.tryonImage} alt="" loading="lazy" className="h-full w-full object-cover" />
    );
  }
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-line">
      {[0, 1, 2, 3].map((i) => {
        const p = o.prendas[i];
        return (
          <span key={i} className="flex items-center justify-center bg-surface">
            {p?.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagen} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" />
            ) : null}
          </span>
        );
      })}
    </div>
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
  }, [visibles]);

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
            <Heart on={filtro === "fav"} />
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

      {grupos.map((g) => (
        <div key={g.label} className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="editorial text-h3 text-ink">{g.label}</span>
            <span className="tabular text-[11.5px] text-muted">
              {g.items.length} {g.items.length === 1 ? "look" : "looks"}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {g.items.map((o) => {
            const e = estado[o.id];
            const open = abierto === o.id;
            return (
              <div key={o.id} className="flex flex-col">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAbierto(open ? null : o.id)}
                    aria-expanded={open}
                    className={`flex w-full gap-3 border border-line bg-surface p-[11px] text-left transition-colors hover:border-ink/30 ${
                      open ? "rounded-t-md" : "rounded-md"
                    }`}
                  >
                    <span className="h-[84px] w-16 shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
                      <Thumb o={o} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 pr-6">
                      <span className="editorial text-base leading-tight text-ink">
                        {o.nombre}
                      </span>
                      <span className="tabular text-[11.5px] text-muted">{o.fecha}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {o.occasion ? (
                          <span className="inline-flex items-center rounded-sm border border-line bg-bg px-[7px] py-[3px] text-[10.5px] font-semibold text-muted">
                            {ocasionLabel(o.occasion)}
                          </span>
                        ) : null}
                        {e.voto === "up" ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-accent">
                            <Icon name="pulgar" size={12} active />
                          </span>
                        ) : null}
                        {e.worn ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-success">
                            <Icon name="check" size={12} /> Puesto
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fav(o.id)}
                    aria-pressed={e.fav}
                    aria-label={e.fav ? "Quitar de favoritos" : "Guardar en favoritos"}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center"
                  >
                    <Heart on={e.fav} />
                  </button>
                </div>

                {open ? (
                  <div className="flex flex-col gap-2.5 rounded-b-md border border-t-0 border-line bg-surface p-[11px]">
                    <div className="flex gap-2">
                      <ActionBtn on={e.voto === "up"} onClick={() => vote(o.id, true)} aria-label="Me gusta">
                        <Icon name="pulgar" size={16} active={e.voto === "up"} />
                      </ActionBtn>
                      <ActionBtn
                        on={e.voto === "down"}
                        onClick={() => vote(o.id, false)}
                        aria-label="No me gusta"
                      >
                        <Icon name="pulgar" size={16} rotate={180} active={e.voto === "down"} />
                      </ActionBtn>
                      <button
                        type="button"
                        onClick={() => rewear(o.id)}
                        disabled={rewearing === o.id}
                        className="flex min-h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-sm bg-accent text-[12.5px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
                      >
                        <Icon name="repetir" size={16} />
                        {rewearing === o.id ? "Poniéndolo…" : "Ponérmelo"}
                      </button>
                    </div>
                    {e.voto === "down" ? <DownReason outfitId={o.id} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
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

function ActionBtn({
  on,
  onClick,
  children,
  ...rest
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-10 flex-1 items-center justify-center rounded-sm border text-[12.5px] font-semibold transition-colors duration-200 ${
        on
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-ink hover:border-ink"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
