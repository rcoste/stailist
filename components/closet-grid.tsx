"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { removeItem, updateItemAttrs } from "@/app/closet/actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export type ClosetItem = {
  id: string;
  nombre: string;
  imagen: string | null;
  swatch: string;
  category: string;
  formalidad: string;
  temporada: string;
  material: string; // "" = sin dato
  patron: string; // "" = sin dato; valores de PATRONES
  colorSecundario: string; // "" = sin dato
  source: string; // "archetype" | "photo"
  renderStatus?: string; // "none" | "pending" | "done" | "failed"
};

// Orden + label de categoría (espeja el de la página).
const CAT: { key: string; label: string }[] = [
  { key: "top", label: "Tops" },
  { key: "saco", label: "Sacos" },
  { key: "abrigo", label: "Abrigos" },
  { key: "bottom", label: "Pantalones" },
  { key: "vestido", label: "Vestidos" },
  { key: "calzado", label: "Calzado" },
  { key: "accesorio", label: "Accesorios" },
];
const CAT_LABEL = new Map(CAT.map((c) => [c.key, c.label]));

// Opciones para editar una prenda fotografiada (labels humanas, no el enum crudo).
const EDIT_CAT: { v: string; l: string }[] = [
  { v: "top", l: "top" },
  { v: "saco", l: "saco" },
  { v: "bottom", l: "pantalón" },
  { v: "abrigo", l: "abrigo" },
  { v: "vestido", l: "vestido" },
  { v: "calzado", l: "calzado" },
  { v: "accesorio", l: "accesorio" },
];
const FORMALIDADES: { v: string; l: string }[] = [
  { v: "casual", l: "casual" },
  { v: "formal-casual", l: "casual-formal" },
  { v: "formal", l: "formal" },
];
const TEMPORADAS: { v: string; l: string }[] = [
  { v: "calor", l: "calor" },
  { v: "templado", l: "templado" },
  { v: "frio", l: "frío" },
  { v: "todo-el-año", l: "todo el año" },
];
// Patrones (espeja PATRONES de lib/prenda-atributos; "" = sin dato).
const PATRONES_EDIT: { v: string; l: string }[] = [
  { v: "", l: "—" },
  { v: "liso", l: "liso" },
  { v: "rayas", l: "rayas" },
  { v: "cuadros", l: "cuadros" },
  { v: "floral", l: "floral" },
  { v: "animal-print", l: "animal print" },
  { v: "grafico", l: "gráfico" },
  { v: "estampado", l: "estampado" },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Sub-agrupación VISUAL dentro de una categoría (solo la vista del clóset; no toca
// el motor). "Abrigo" mete cosas de uso distinto (chamarra, sobrecamisa, chaleco,
// abrigo) — al filtrar la categoría, las separamos por tipo leyendo el nombre. Lo
// que no encaja cae al catch-all (la etiqueta de la propia categoría). Ampliable a
// otras categorías agregando entradas aquí.
const SUBGROUPS: Record<string, { label: string; test: (n: string) => boolean }[]> = {
  abrigo: [
    { label: "Chamarras", test: (n) => /mezclilla|denim|bomber|chamarra|cazadora|biker|moto/.test(n) },
    { label: "Sobrecamisas", test: (n) => /sobrecamisa|overshirt|shacket|camisola/.test(n) },
    { label: "Chalecos", test: (n) => /chaleco|gilet/.test(n) },
  ],
};

// Parte las prendas de una categoría en subgrupos (en orden; catch-all al final con
// la etiqueta de la categoría). Devuelve null si la categoría no sub-agrupa o si al
// final todo cayó en un solo grupo (no vale la pena partir).
function subgroupsFor(
  cat: string,
  prendas: ClosetItem[],
  catLabel: string
): { label: string; prendas: ClosetItem[] }[] | null {
  const defs = SUBGROUPS[cat];
  if (!defs) return null;
  const rest = [...prendas];
  const out: { label: string; prendas: ClosetItem[] }[] = [];
  for (const d of defs) {
    const hit = rest.filter((p) => d.test(norm(p.nombre)));
    if (hit.length) {
      out.push({ label: d.label, prendas: hit });
      for (const p of hit) rest.splice(rest.indexOf(p), 1);
    }
  }
  if (rest.length) out.push({ label: catLabel, prendas: rest });
  return out.length > 1 ? out : null;
}

// Chip de categoría: cantos crispados (radius-sm, NO pill). Activo = acento.
function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-[13px] py-2 text-[12.5px] font-semibold transition-colors duration-200 ${
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
      <span className={`tabular text-[11px] ${on ? "text-on-accent/60" : "text-muted/60"}`}>{count}</span>
    </button>
  );
}

// Chip-ícono (lupa / sliders): mismo lenguaje, solo el ícono. Hit target ≥44px.
function IconChip({
  name,
  on,
  badge,
  onClick,
  label,
}: {
  name: "lupa" | "sliders";
  on?: boolean;
  badge?: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm border transition-colors ${
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:border-accent"
      }`}
    >
      <Icon name={name} size={18} />
      {badge ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-on-accent">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Tile({
  item,
  rendering = false,
  priority = false,
  onTap,
}: {
  item: ClosetItem;
  rendering?: boolean;
  priority?: boolean;
  onTap: () => void;
}) {
  return (
    <button type="button" onClick={onTap} className="flex w-full flex-col gap-1.5 text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
        {item.imagen ? (
          <Image
            src={item.imagen}
            alt={item.nombre}
            fill
            priority={priority}
            sizes="(max-width: 430px) 33vw, 130px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} aria-hidden />
        )}
        {/* Generando su imagen (prenda sin foto): spinner sobre el swatch. */}
        {rendering && !item.imagen ? (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/15">
            <Spinner className="h-5 w-5 text-on-accent" />
          </span>
        ) : null}
        {/* Badge "Tuya": cinta inferior con degradado — solo en fotos propias
            reales (no en prendas sumadas a mano desde la cápsula, que no tienen
            imagen y caen al swatch). */}
        {item.source === "photo" && item.imagen ? (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-[5px] bg-gradient-to-t from-ink/55 to-transparent px-[9px] py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.04em] text-on-accent">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-on-accent" />
            tuya
          </span>
        ) : null}
      </div>
      <p className="truncate text-[11.5px] font-medium text-ink">{item.nombre}</p>
    </button>
  );
}

// Grid del clóset (handoff "índice editorial"): tu ropa agrupada por categoría,
// con búsqueda (lupa) y filtros (sliders) en la misma fila de chips. Detalle
// tappable por prenda (ver en grande, podar lo asumido, corregir lo que la IA leyó).
export function ClosetGrid({ items }: { items: ClosetItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null); // null = Todos
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ClosetItem | null>(null);
  // Prenda pendiente de confirmar antes de quitarla del clóset.
  const [porQuitar, setPorQuitar] = useState<ClosetItem | null>(null);
  // Auto-sanado: prendas que el usuario agregó por descripción y nunca tuvieron
  // imagen se renderizan UNA vez (texto→imagen, cacheado en el item). El tile
  // muestra el resultado en cuanto llega, sin recargar la página.
  const [rendered, setRendered] = useState<Record<string, string>>({}); // id → url
  const [rendering, setRendering] = useState<Set<string>>(new Set());

  // Búsqueda inline (la lupa expande el campo) + filtros de atributos (sliders).
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fFormalidad, setFFormalidad] = useState<Set<string>>(new Set());
  const [fTemporada, setFTemporada] = useState<Set<string>>(new Set());
  const [fSoloTuyas, setFSoloTuyas] = useState(false);

  const activeFilterCount = fFormalidad.size + fTemporada.size + (fSoloTuyas ? 1 : 0);

  // Dispara los renders de las prendas sin imagen al montar (y tras un refresh,
  // cuando lleguen prendas nuevas sin imagen). Una sola vez por prenda: en cuanto
  // se rinde, queda con render_status='done' y deja de ser candidata.
  useEffect(() => {
    const pendientes = items.filter(
      (i) => !i.imagen && i.source === "photo" && (i.renderStatus ?? "none") === "none"
    );
    if (pendientes.length === 0) return;
    let cancelled = false;

    const renderOne = async (id: string) => {
      setRendering((s) => new Set(s).add(id));
      try {
        const res = await fetch("/api/render-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.url) {
          setRendered((m) => ({ ...m, [id]: data.url as string }));
        }
      } catch {
        // un fallo deja el swatch; no se reintenta solo (evita loop de costo)
      } finally {
        if (!cancelled) {
          setRendering((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }
      }
    };

    // Concurrencia limitada (2) para no saturar Gemini ni el rate-limit.
    const queue = pendientes.map((p) => p.id);
    const worker = async () => {
      while (queue.length && !cancelled) {
        const id = queue.shift();
        if (id) await renderOne(id);
      }
    };
    void Promise.all([worker(), worker()]);

    return () => {
      cancelled = true;
    };
  }, [items]);

  // Mete los renders recién generados (estado local) sobre los items del server,
  // para que tile, badge "Tuya" y la hoja de detalle vean la imagen al instante.
  const itemsWithRenders = useMemo(
    () => items.map((i) => (rendered[i.id] ? { ...i, imagen: rendered[i.id] } : i)),
    [items, rendered]
  );

  const visibles = useMemo(
    () => itemsWithRenders.filter((i) => !removed.has(i.id)),
    [itemsWithRenders, removed]
  );

  // Pre-filtro por búsqueda + atributos (NO por categoría): la base sobre la que
  // se cuentan los chips de categoría y se arman los grupos.
  const base = useMemo(() => {
    const q = norm(query.trim());
    return visibles.filter((i) => {
      if (q && !norm(i.nombre).includes(q)) return false;
      if (fFormalidad.size && !fFormalidad.has(i.formalidad)) return false;
      if (fTemporada.size && !fTemporada.has(i.temporada)) return false;
      if (fSoloTuyas && i.source !== "photo") return false;
      return true;
    });
  }, [visibles, query, fFormalidad, fTemporada, fSoloTuyas]);

  // Conteo por categoría sobre la base.
  const counts = new Map<string, number>();
  for (const i of base) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  const presentes = CAT.filter((c) => (counts.get(c.key) ?? 0) > 0);

  // Si la categoría filtrada se queda sin prendas, vuelve a Todos.
  const activeFilter = filter && (counts.get(filter) ?? 0) > 0 ? filter : null;

  const grupos = activeFilter
    ? [{ key: activeFilter, label: CAT_LABEL.get(activeFilter) ?? "", prendas: base.filter((i) => i.category === activeFilter) }]
    : CAT.map((c) => ({ ...c, prendas: base.filter((i) => i.category === c.key) })).filter(
        (g) => g.prendas.length > 0
      );

  // Las primeras prendas del grid (primer pliegue) cargan con `priority` para que
  // Next no las marque como LCP sin optimizar y mejore la carga percibida.
  const eagerIds = new Set(
    grupos.flatMap((g) => g.prendas).slice(0, 4).map((p) => p.id)
  );

  async function quitar(id: string) {
    setRemoved((s) => new Set(s).add(id));
    setSelected(null);
    const res = await removeItem(id);
    if (!res.ok) {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } else {
      router.refresh();
    }
  }

  function toggleSet(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const n = new Set(set);
    if (n.has(value)) n.delete(value);
    else n.add(value);
    setter(n);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fila de búsqueda + filtros (sticky). La lupa expande un campo inline. */}
      <div className="sticky top-0 z-10 -mx-4 bg-bg px-4 py-1">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-sm border border-accent bg-surface px-3 py-2">
              <Icon name="lupa" size={18} className="shrink-0 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por nombre…"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
              className="shrink-0 px-1 text-sm font-medium text-muted hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <IconChip name="lupa" label="Buscar" onClick={() => setSearchOpen(true)} />
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip label="Todos" count={base.length} on={!activeFilter} onClick={() => setFilter(null)} />
              {presentes.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  count={counts.get(c.key) ?? 0}
                  on={activeFilter === c.key}
                  onClick={() => setFilter(c.key)}
                />
              ))}
            </div>
            <IconChip
              name="sliders"
              label="Filtros"
              on={activeFilterCount > 0}
              badge={activeFilterCount || undefined}
              onClick={() => setFilterOpen(true)}
            />
          </div>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-6 py-14 text-center">
          <p className="display text-lg text-ink">
            {query || activeFilterCount > 0 ? "nada coincide" : "tu clóset está vacío"}
          </p>
          <p className="text-sm text-muted">
            {query || activeFilterCount > 0
              ? "Ajusta la búsqueda o los filtros."
              : "Vuelve al inicio y marca los básicos que tienes."}
          </p>
        </div>
      ) : (
        grupos.map((g) => {
          const tiles = (prendas: ClosetItem[]) => (
            <ul className="grid grid-cols-3 gap-[11px] lg:grid-cols-5 lg:gap-4">
              {prendas.map((p) => (
                <li key={p.id}>
                  <Tile
                    item={p}
                    rendering={rendering.has(p.id)}
                    priority={eagerIds.has(p.id)}
                    onTap={() => setSelected(p)}
                  />
                </li>
              ))}
            </ul>
          );
          // Al filtrar una categoría con subgrupos (p. ej. Abrigos), la partimos por
          // tipo. En "Todos" se mantiene el grid plano por categoría.
          const subs = activeFilter ? subgroupsFor(g.key, g.prendas, g.label) : null;
          return (
            <div key={g.key} className="flex flex-col gap-3">
              {!activeFilter ? (
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {g.label}
                  </h2>
                  <span className="tabular text-[11px] text-muted">{g.prendas.length}</span>
                </div>
              ) : null}
              {subs
                ? subs.map((s) => (
                    <div key={s.label} className="flex flex-col gap-2.5">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
                          {s.label}
                        </h3>
                        <span className="tabular text-[10.5px] text-muted">{s.prendas.length}</span>
                      </div>
                      {tiles(s.prendas)}
                    </div>
                  ))
                : tiles(g.prendas)}
            </div>
          );
        })
      )}

      {filterOpen ? (
        <FilterSheet
          formalidad={fFormalidad}
          temporada={fTemporada}
          soloTuyas={fSoloTuyas}
          onToggleFormalidad={(v) => toggleSet(fFormalidad, setFFormalidad, v)}
          onToggleTemporada={(v) => toggleSet(fTemporada, setFTemporada, v)}
          onToggleSoloTuyas={() => setFSoloTuyas((v) => !v)}
          onClear={() => {
            setFFormalidad(new Set());
            setFTemporada(new Set());
            setFSoloTuyas(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}

      {selected ? (
        <ItemSheet
          item={selected}
          onClose={() => setSelected(null)}
          onRemove={() => setPorQuitar(selected)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmDelete
        open={!!porQuitar}
        titulo={`¿quitar ${(porQuitar?.nombre ?? "esta prenda").toLowerCase()} del clóset?`}
        detalle="deja de contar para tus looks. si te arrepientes, vuelve a agregarla."
        confirmar="sí, quítala"
        onCancel={() => setPorQuitar(null)}
        onConfirm={() => {
          const id = porQuitar?.id;
          setPorQuitar(null);
          if (id) void quitar(id);
        }}
      />
    </div>
  );
}

// Panel de filtros (sliders): formalidad, temporada, solo tuyas. Usa los
// atributos que ya viven en cada prenda; no inventa datos nuevos.
function FilterSheet({
  formalidad,
  temporada,
  soloTuyas,
  onToggleFormalidad,
  onToggleTemporada,
  onToggleSoloTuyas,
  onClear,
  onClose,
}: {
  formalidad: Set<string>;
  temporada: Set<string>;
  soloTuyas: boolean;
  onToggleFormalidad: (v: string) => void;
  onToggleTemporada: (v: string) => void;
  onToggleSoloTuyas: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const pill = (on: boolean) =>
    `min-h-9 rounded-sm border px-3 text-sm font-medium transition-colors ${
      on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-accent"
    }`;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="relative z-10 flex w-full max-w-[430px] flex-col gap-5 rounded-t-[18px] lg:rounded-[18px] bg-surface px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))] pt-2"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-1.5 h-1 w-9 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <h3 className="text-[19px] font-semibold text-ink">filtros</h3>
          <button type="button" onClick={onClear} className="text-sm font-medium text-accent underline underline-offset-[3px]">
            limpiar
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Formalidad
          </span>
          <div className="flex flex-wrap gap-2">
            {FORMALIDADES.map((f) => (
              <button key={f.v} type="button" onClick={() => onToggleFormalidad(f.v)} className={pill(formalidad.has(f.v))}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Temporada
          </span>
          <div className="flex flex-wrap gap-2">
            {TEMPORADAS.map((t) => (
              <button key={t.v} type="button" onClick={() => onToggleTemporada(t.v)} className={pill(temporada.has(t.v))}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSoloTuyas}
          className={`flex items-center justify-between rounded-md border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
            soloTuyas ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink"
          }`}
        >
          solo mis fotos (tuyas)
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-sm border ${
              soloTuyas ? "border-accent bg-accent text-on-accent" : "border-line"
            }`}
          >
            {soloTuyas ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
          </span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors hover:bg-accent-deep"
        >
          ver resultados
        </button>
      </div>
    </div>
  );
}

// Hoja de detalle: imagen grande + quitar. Si es foto, también editar atributos.
function ItemSheet({
  item,
  onClose,
  onRemove,
  onSaved,
}: {
  item: ClosetItem;
  onClose: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const esFoto = item.source === "photo";
  const [nombre, setNombre] = useState(item.nombre);
  const [categoria, setCategoria] = useState(item.category);
  const [formalidad, setFormalidad] = useState(item.formalidad);
  const [temporada, setTemporada] = useState(item.temporada);
  const [material, setMaterial] = useState(item.material);
  const [patron, setPatron] = useState(item.patron);
  const [colorSecundario, setColorSecundario] = useState(item.colorSecundario);
  const [saving, setSaving] = useState(false);

  const dirty =
    esFoto &&
    (nombre.trim() !== item.nombre ||
      categoria !== item.category ||
      formalidad !== item.formalidad ||
      temporada !== item.temporada ||
      material.trim() !== item.material ||
      patron !== item.patron ||
      colorSecundario.trim() !== item.colorSecundario);

  async function guardar() {
    setSaving(true);
    const res = await updateItemAttrs(item.id, {
      nombre,
      categoria,
      formalidad,
      temporada,
      material,
      patron,
      color_secundario: colorSecundario,
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40 px-4 pb-4" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-bg">
            {item.imagen ? (
              <Image src={item.imagen} alt={item.nombre} fill sizes="88px" className="object-cover" />
            ) : (
              <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} aria-hidden />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            {esFoto ? (
              <>
                <label className="text-xs font-medium text-muted">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="min-h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <span className="text-base font-medium text-ink">{item.nombre}</span>
                <span className="text-xs text-muted">
                  {CAT_LABEL.get(item.category) ?? item.category} · básico
                </span>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted">
            <Icon name="equis" size={18} />
          </button>
        </div>

        {esFoto ? (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">Tipo</label>
              <div className="flex flex-wrap gap-2">
                {EDIT_CAT.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCategoria(c.v)}
                    className={`min-h-9 rounded-sm border px-3 text-sm transition-colors ${
                      categoria === c.v ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink"
                    }`}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted">Formalidad</label>
                <select
                  value={formalidad}
                  onChange={(e) => setFormalidad(e.target.value)}
                  className="min-h-10 rounded-sm border border-line bg-surface px-2 text-sm text-ink"
                >
                  {FORMALIDADES.map((f) => (
                    <option key={f.v} value={f.v}>
                      {f.l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted">Temporada</label>
                <select
                  value={temporada}
                  onChange={(e) => setTemporada(e.target.value)}
                  className="min-h-10 rounded-sm border border-line bg-surface px-2 text-sm text-ink"
                >
                  {TEMPORADAS.map((t) => (
                    <option key={t.v} value={t.v}>
                      {t.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Atributos ricos (v21): el motor los usa como señal dura (lana ≠
                calor, máx. un estampado) — por eso son corregibles aquí. */}
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted">Material</label>
                <input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="algodón, lana, mezclilla…"
                  className="min-h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-muted">Patrón</label>
                <select
                  value={patron}
                  onChange={(e) => setPatron(e.target.value)}
                  className="min-h-10 rounded-sm border border-line bg-surface px-2 text-sm text-ink"
                >
                  {PATRONES_EDIT.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">
                Segundo color (si es bicolor)
              </label>
              <input
                value={colorSecundario}
                onChange={(e) => setColorSecundario(e.target.value)}
                placeholder="blanco, beige…"
                className="min-h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
              />
            </div>

            {dirty ? (
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                className="flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                {saving ? <Spinner className="h-4 w-4" /> : null}
                guardar cambios
              </button>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-bg text-sm font-medium text-error transition-colors hover:border-error"
        >
          <Icon name="equis" size={16} /> no tengo esta — quitar del clóset
        </button>
      </div>
    </div>
  );
}
