"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import {
  removeItem,
  updateItemAttrs,
  atarConjunto,
  crearPantalonDelTraje,
} from "@/app/closet/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Toast } from "@/components/toast";
import { PrendaZoom } from "@/components/prenda-zoom";
import { ejemploDeTalla } from "@/lib/prenda-atributos";
import { PALETA, coloresCercanos } from "@/lib/paleta-colores";
import { SiluetaCorte } from "@/components/silueta-corte";
import { EL_CORTE_IMPORTA } from "@/lib/afinar-prendas";
import { distanciaPerceptual } from "@/lib/engine/color-perceptual";
import {
  CATEGORIAS,
  CORTES,
  FORMALIDADES,
  MATERIALES,
  PATRONES_CHIP,
  ChipResumen,
  Chips,
  Escala,
  Field,
  conLeido,
  mismoHex,
  type Seccion,
} from "@/components/prenda-campos";

export type ClosetItem = {
  id: string;
  nombre: string;
  imagen: string | null;
  swatch: string;
  /** Cómo se llama el color ("azul marino"). "" = no se guardó nombre. */
  colorNombre?: string;
  category: string;
  formalidad: string;
  temporada: string;
  /** Los dos que ningún modelo puede leer — se teclean en la ficha, opcionales. */
  marca?: string | null;
  talla?: string | null;
  material: string; // "" = sin dato
  patron: string; // "" = sin dato; valores de PATRONES
  colorSecundario: string; // "" = sin dato
  source: string; // "archetype" | "photo"
  renderStatus?: string; // "none" | "pending" | "done" | "failed"
  corte?: string; // "" = sin dato; entallado | recto | holgado
  corteConfirmado?: boolean; // ¿lo dijo la persona, o lo suponemos nosotros?
  creadoEn?: string; // ISO — para ordenar por lo recién añadido
  /**
   * El lazo del traje: mismo id en el saco y en su pantalón.
   *
   * Se guardan como DOS prendas —así el motor puede usar el saco con jeans o el
   * pantalón con un suéter— y el lazo es lo que dice que además son un traje.
   * Roberto propuso guardarlo doble (suelto Y como traje) al ver dos thumbnails
   * donde esperaba uno; se descartó porque el motor contaría el saco dos veces,
   * los conteos del clóset mentirían y las dos copias se separarían al editar
   * una. Lo que faltaba no era otra fila: era que el lazo SE VIERA.
   */
  conjunto?: string;
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

// Las opciones para EDITAR una prenda (tipo, formalidad, material, patrón,
// corte) se importan de components/prenda-campos: son las mismas que confirma
// el carrete, y tenerlas escritas dos veces ya había producido dos vocabularios
// para lo mismo — la ficha ofrecía "—" como patrón y la tarjeta "sin dato".
const TEMPORADAS: { v: string; l: string }[] = [
  { v: "calor", l: "calor" },
  { v: "templado", l: "templado" },
  { v: "frio", l: "frío" },
  { v: "todo-el-año", l: "todo el año" },
];

/**
 * Cómo se llama el color que está puesto ahora en la ficha.
 *
 * Tres fuentes por orden de especificidad: si no se ha tocado nada, el nombre
 * que se GUARDÓ con la prenda ("azul marino", más fino que cualquier atajo);
 * si se eligió un swatch, el nombre de ese swatch; y si no hay ninguno, la
 * palabra "color" — el punto de al lado ya enseña cuál es.
 */
function nombreDelColor(hex: string, item: ClosetItem): string {
  if (mismoHex(hex, item.swatch) && item.colorNombre) return item.colorNombre;
  return PALETA.find((p) => mismoHex(p.hex, hex))?.name ?? "color";
}

// El orden en que se ofrecen las parejas de un conjunto: primero por formalidad
// y luego por color. Vive fuera del componente porque es una constante, no
// estado — dentro se reconstruía en cada tecla que se escribiera en la ficha.
const PESO_FORMALIDAD: Record<string, number> = {
  formal: 0,
  "formal-casual": 1,
  casual: 2,
};
// LO QUE NO PUEDE SER EL PANTALÓN DE UN TRAJE, pase lo que pase con el color.
// Roberto, viendo la lista: "se ve horrible ahí… cómo va a ser un short parte
// de un traje". Tiene razón y no es cuestión de orden: ordenar por formalidad
// bajó la bermuda al tercer puesto, pero seguía ahí. Esto es un hecho de la
// prenda, no una preferencia. Sólo aplica cuando el ancla es un SACO: un
// conjunto de dos piezas con short existe y es perfectamente normal.
const IMPOSIBLE_EN_UN_TRAJE =
  /short|bermuda|jogger|legging|deportiv|mezclilla|denim|jean|cargo|palazzo|bikini/i;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Sub-agrupación VISUAL dentro de una categoría (solo la vista del clóset; no toca
// el motor). "Abrigo" mete cosas de uso distinto (chamarra, sobrecamisa, chaleco,
// abrigo) — al filtrar la categoría, las separamos por tipo leyendo el nombre. Lo
// que no encaja cae al catch-all (la etiqueta de la propia categoría). Ampliable a
// otras categorías agregando entradas aquí.
const SUBGROUPS: Record<string, { label: string; test: (n: string) => boolean }[]> = {
  abrigo: [
    { label: "Chamarras", test: (n) => /mezclilla|denim|bomber|chamarra|chaqueta|cazadora|biker|moto/.test(n) },
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
  onConjunto,
  resaltada = false,
}: {
  item: ClosetItem;
  rendering?: boolean;
  priority?: boolean;
  onTap: () => void;
  /** Tocar el badge de conjunto: resalta a sus compañeras (handoff de carga). */
  onConjunto?: () => void;
  resaltada?: boolean;
}) {
  return (
    <button type="button" onClick={onTap} className="flex w-full flex-col gap-1.5 text-left">
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-md border bg-surface transition-shadow ${
          resaltada ? "border-ink ring-2 ring-ink" : "border-line"
        }`}
      >
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
        {/* LA MARCA DEL CONJUNTO. Es lo que faltaba: las dos piezas ya estaban
            atadas por dentro, pero en el mosaico no había forma de saber que
            van juntas — y por eso ver dos thumbnails donde se esperaba un traje
            se sentía un error. Se marca el lazo, no se duplica la prenda.
            Dice "conjunto" y no "traje" porque el mecanismo sirve igual para un
            conjunto de dos piezas o un pants set: un traje es un conjunto, no
            al revés. */}
        {/* Y AHORA CONTESTA (handoff): tocarlo resalta a las compañeras y un
            toast dice quiénes son. Es un span con stopPropagation y no un
            botón anidado —HTML no permite button dentro de button—; el tap
            sobre el resto del tile sigue abriendo la ficha, como siempre. */}
        {item.conjunto ? (
          <span
            role="button"
            aria-label="Ver con qué va este conjunto"
            onClick={(e) => {
              if (!onConjunto) return;
              e.stopPropagation();
              onConjunto();
            }}
            className="absolute left-1 top-1 rounded-sm bg-ink/75 px-1.5 py-0.5 text-[10px] font-medium text-bg"
          >
            conjunto
          </span>
        ) : null}
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
      {/* MARCA Y TALLA, DEBAJO DEL NOMBRE — y aquí es donde de verdad sirven.
          El caso de Roberto: "tengo dos playeras similares, pero una es de
          Express y otra es de Uniqlo". Ese momento de "¿cuál era cuál?" pasa
          MIRANDO EL CLÓSET, entre dos miniaturas casi idénticas, no dentro de
          la ficha que ya abriste. Guardar el dato y esconderlo aquí sería
          pedirle que lo escriba para nada. Sólo aparece si lo escribió. */}
      {item.marca || item.talla ? (
        <p className="truncate text-[10.5px] leading-tight text-muted">
          {[item.marca, item.talla].filter(Boolean).join(" · ")}
        </p>
      ) : null}
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
  // Conjunto resaltado (tocar el badge) + su toast. Un solo timer: tocar otro
  // badge antes de que expire el anterior cancela el viejo, o el primero
  // apagaría el resaltado del segundo a media vida.
  const [conjResaltado, setConjResaltado] = useState<string | null>(null);
  const [conjToast, setConjToast] = useState<string | null>(null);
  const conjTimer = useRef<number | null>(null);
  function resaltaConjunto(item: ClosetItem) {
    const cj = item.conjunto;
    if (!cj) return;
    const piezas = items.filter((x) => x.conjunto === cj);
    setConjResaltado(cj);
    setConjToast(piezas.map((x) => x.nombre.toLowerCase()).join(" + "));
    if (conjTimer.current) window.clearTimeout(conjTimer.current);
    conjTimer.current = window.setTimeout(() => {
      setConjResaltado(null);
      setConjToast(null);
    }, 1600);
  }

  // Búsqueda inline (la lupa expande el campo) + filtros de atributos (sliders).
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [fFormalidad, setFFormalidad] = useState<Set<string>>(new Set());
  const [fTemporada, setFTemporada] = useState<Set<string>>(new Set());
  const [fSoloTuyas, setFSoloTuyas] = useState(false);
  // ORDEN. Por defecto siguen primero "tus queridas" (las de outfits favoritos
  // y usados), que es lo correcto para navegar el clóset todos los días. Pero
  // hay un momento en que eso estorba: acabas de subir doce prendas y quieres
  // ver ESAS, no tus favoritas de siempre. Idea de Roberto.
  const [orden, setOrden] = useState<"queridas" | "nuevas">("queridas");

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

  const visibles = useMemo(() => {
    const vivos = itemsWithRenders.filter((i) => !removed.has(i.id));
    // El servidor ya las manda con las queridas primero; sólo hay que rehacer
    // el orden cuando se pide el otro.
    if (orden !== "nuevas") return vivos;
    return [...vivos].sort((a, b) => (b.creadoEn ?? "").localeCompare(a.creadoEn ?? ""));
  }, [itemsWithRenders, removed, orden]);

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
                    onConjunto={() => resaltaConjunto(p)}
                    resaltada={!!p.conjunto && p.conjunto === conjResaltado}
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
          orden={orden}
          onOrden={setOrden}
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
          todas={items}
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

      {/* El toast del conjunto: "saco azul + pantalón azul", mientras dura el
          resaltado. El componente ya se auto-oculta con message null. */}
      <Toast message={conjToast} />
    </div>
  );
}

// Panel de filtros (sliders): formalidad, temporada, solo tuyas. Usa los
// atributos que ya viven en cada prenda; no inventa datos nuevos.
function FilterSheet({
  formalidad,
  temporada,
  soloTuyas,
  orden,
  onOrden,
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
  orden: "queridas" | "nuevas";
  onOrden: (o: "queridas" | "nuevas") => void;
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

        {/* EL ORDEN vive con los filtros y no en la fila de chips: ahí
            competiría con las categorías, que es lo que de verdad se usa a
            diario. "Queridas primero" sigue siendo el default — recién añadidas
            resuelve un momento concreto (acabas de subir una tanda), no el uso
            de todos los días. */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Orden
          </span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOrden("queridas")} className={pill(orden === "queridas")}>
              tus queridas primero
            </button>
            <button type="button" onClick={() => onOrden("nuevas")} className={pill(orden === "nuevas")}>
              recién añadidas
            </button>
          </div>
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

// Hoja de detalle: imagen grande, atributos editables y quitar.
//
// EDITABLE PARA TODAS LAS PRENDAS, no sólo las fotografiadas. El gate anterior
// (`esFoto`) tenía el efecto exactamente contrario al que buscaba: las prendas
// con el dato inventado —670 del catálogo, 513 en categorías donde el corte
// importa— eran justo las que no se dejaban corregir. La card de afinar da tres
// al día; esto abre las 513 cuando a la persona se le antoje.
//
// EL CORTE PRESELECCIONA PERO NO CONFIRMA. Guardar sin tocar la silueta deja el
// dato como estaba: si preseleccionar contara como confirmar, un "guardar" tras
// cambiar el material marcaría el corte como revisado sin que nadie lo mirara.
//
// RESUMEN EN CHIPS, NO DOCE CAMPOS ABIERTOS (2026-08-12). Roberto: "está
// demasiado detalle… se ve una pantallota; hazlo como el multi upload y el fit
// check". Tenía razón y el número lo confirmaba: doce editores abiertos a la
// vez, 1.46 pantallas de scroll, para una ficha que casi siempre se abre por UNA
// cosa —ver la prenda en grande, renombrarla, corregir el color, rehacer la
// imagen—. Ahora una fila de chips DICE los valores (tipo, color, formalidad) y
// tocar uno abre sólo su editor; el resto vive en "+ más".
//
// El vocabulario es el MISMO que el del carrete (components/prenda-campos), y
// eso es lo que hace que valga la pena: quien corrigió doce prendas al darlas de
// alta encuentra aquí los mismos chips, no un segundo idioma para los mismos
// datos.
//
// LO QUE NO SE PLEGÓ, a propósito: el nombre (es la identidad de la prenda, y se
// edita más que nada), el lazo del conjunto (no es un atributo sino una
// relación, y es el único lugar donde se puede atar un traje) y rehacer la
// imagen. Esconder esos tres detrás de un chip sería cambiar una pantallota por
// una búsqueda del tesoro.
export function ItemSheet({
  item,
  todas,
  onClose,
  onRemove,
  onSaved,
}: {
  item: ClosetItem;
  /** Todo el clóset — para poder ofrecer la pareja del traje. */
  todas: ClosetItem[];
  onClose: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const esFoto = item.source === "photo";
  const [nombre, setNombre] = useState(item.nombre);
  const [corte, setCorte] = useState(item.corte ?? "");
  // Sólo un tap en una silueta cuenta como confirmación (ver cabecera).
  const [corteTocado, setCorteTocado] = useState(false);
  const [atando, setAtando] = useState(false);
  const [rehaciendo, setRehaciendo] = useState(false);
  /** Qué salió mal al rehacer la imagen. null = nada que decir. */
  const [errorRender, setErrorRender] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [colorHex, setColorHex] = useState(item.swatch);
  const [todosLosColores, setTodosLosColores] = useState(false);
  // Tras guardar un cambio de nombre o color, la imagen quedó vieja: se generó
  // con los datos de antes. Ver el bloque de abajo.
  const [ofrecerRender, setOfrecerRender] = useState(false);
  const [categoria, setCategoria] = useState(item.category);
  const [formalidad, setFormalidad] = useState(item.formalidad);
  const [temporada, setTemporada] = useState(item.temporada);
  const [marca, setMarca] = useState(item.marca ?? "");
  const [talla, setTalla] = useState(item.talla ?? "");
  const [material, setMaterial] = useState(item.material);
  const [patron, setPatron] = useState(item.patron);
  const [colorSecundario, setColorSecundario] = useState(item.colorSecundario);
  const [saving, setSaving] = useState(false);
  /** Qué chip está abierto. null = sólo el resumen (el estado normal). */
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  /** Tocar el chip abierto lo cierra; tocar otro cambia de editor. */
  const abre = (sec: Seccion) => setSeccion(seccion === sec ? null : sec);
  /**
   * La salida para un material que no está en los chips.
   *
   * Los nueve chips cubren 93% de las prendas con material, pero la cola es
   * real (satén, gamuza, terciopelo, gabardina) y ESTA es la pantalla donde se
   * afina una prenda concreta. Quitar el texto libre habría hecho incorregible
   * justo lo específico; dejarlo abierto siempre habría vuelto a poner un campo
   * de tecleo donde un tap basta el 93% de las veces.
   */
  const [otroMaterial, setOtroMaterial] = useState(false);

  const dirty =
    nombre.trim() !== item.nombre ||
    categoria !== item.category ||
    formalidad !== item.formalidad ||
    temporada !== item.temporada ||
    marca !== (item.marca ?? "") ||
    talla !== (item.talla ?? "") ||
    material.trim() !== item.material ||
    patron !== item.patron ||
    colorSecundario.trim() !== item.colorSecundario ||
    colorHex !== item.swatch ||
    corteTocado;

  // GENERALIZADO A CONJUNTOS DE DOS PIEZAS, no sólo trajes: el dato siempre fue
  // genérico (un id compartido) y lo específico era la UI. Un traje, un
  // conjunto de dos piezas, un pants set — todo lo que se COMPRÓ junto y se lee
  // como una prenda.
  //
  // EL LÍMITE, y no se mueve: `conjunto` significa "se vende como una pieza",
  // NO "me gusta con". Si se usa para gustos, la regla de traje desparejado
  // deja de cazar el error para el que existe — y qué combina con qué es el
  // trabajo del motor, no un dato que la persona deba capturar a mano.
  const esPiezaDeTraje =
    categoria === "saco" || categoria === "bottom" || categoria === "top";
  const pareja = item.conjunto
    ? (todas.find((o) => o.id !== item.id && o.conjunto === item.conjunto) ?? null)
    : null;
  // La otra mitad: si esto es un saco, los pantalones; y al revés.
  //
  // ORDENADAS POR FORMALIDAD Y LUEGO POR COLOR — en ese orden, y lo enseñó la
  // pantalla: con sólo el color, a un saco de traje gris carbón le ofrecía
  // primero unos JEANS y una BERMUDA. El color por sí solo no sabe que un
  // traje no lleva jeans; en OKLCH el denim oscuro cae cerquísima del carbón
  // (es la misma vecindad que hace confundir carbón con azul medianoche).
  //
  // MEMOIZADO: recorre el clóset ENTERO (hasta mil prendas) calculando una
  // distancia de color por cada una, y sin esto se rehacía en cada tecla que se
  // escribiera en el nombre — que es justo lo que se hace con la ficha abierta.
  const candidatas = useMemo(() => {
    if (!esPiezaDeTraje) return [];
    const catsPareja = categoria === "bottom" ? ["saco", "top"] : ["bottom"];
    return todas
      .filter((o) => o.id !== item.id && catsPareja.includes(o.category))
      .filter(
        (o) => categoria !== "saco" || !IMPOSIBLE_EN_UN_TRAJE.test(`${o.nombre} ${o.material}`)
      )
      .map((o) => ({
        o,
        f: PESO_FORMALIDAD[o.formalidad] ?? 2,
        d: distanciaPerceptual(item.swatch, o.swatch) ?? 99,
      }))
      .sort((a, b) => a.f - b.f || a.d - b.d)
      .slice(0, 8)
      .map((x) => x.o);
  }, [esPiezaDeTraje, categoria, todas, item.id, item.swatch]);

  /** Manda los cambios del formulario. Devuelve si se guardó. */
  async function persistir(): Promise<boolean> {
    setSaving(true);
    const res = await updateItemAttrs(item.id, {
      nombre,
      categoria,
      formalidad,
      temporada,
      marca,
      talla,
      material,
      patron,
      color_secundario: colorSecundario,
      ...(colorHex !== item.swatch
        ? { color_hex: colorHex, color: PALETA.find((p) => p.hex === colorHex)?.name ?? "" }
        : {}),
      // Va sólo si lo tocó: mandarlo siempre confirmaría lo que preseleccionamos.
      ...(corteTocado && corte ? { corte } : {}),
    });
    setSaving(false);
    return res.ok;
  }

  async function guardar() {
    if (!(await persistir())) return;
    // LA IMAGEN SE GENERÓ CON EL NOMBRE Y EL COLOR VIEJOS. Idea de Roberto:
    // "si le cambio el color o el nombre me debería preguntar si quiero
    // generar nuevamente la imagen". Tiene razón — el render sale de esos dos
    // datos, así que cambiarlos lo deja obsoleto. Se PREGUNTA en vez de
    // rehacerlo solo: cuesta una llamada, y a veces el cambio es una tilde.
    if (nombre.trim() !== item.nombre || colorHex !== item.swatch) {
      setOfrecerRender(true);
      return;
    }
    onSaved();
  }

  /**
   * Rehace la imagen. GUARDA PRIMERO si hay cambios sin mandar, porque el
   * render lee los atributos de la BASE, no del formulario: sin esto, cambiar
   * el color y tocar "rehacerla" regeneraba con el color viejo y la imagen
   * salía idéntica — "no pasó nada", con la generación cobrada igual.
   *
   * Y el error se VE. Antes la llamada terminaba en `.catch(() => {})`, así
   * que una ruta caída se veía exactamente igual que un render perfecto: el
   * spinner paraba y nada cambiaba.
   */
  async function rehacerImagen() {
    setRehaciendo(true);
    setErrorRender(null);
    try {
      if (dirty && !(await persistir())) {
        setErrorRender("No pude guardar los cambios — inténtalo otra vez.");
        return;
      }
      const res = await fetch("/api/render-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, forzar: true }),
      });
      if (!res.ok) {
        setErrorRender("No pude rehacer la imagen — inténtalo en un momento.");
        return;
      }
      onSaved();
    } catch {
      setErrorRender("Se cortó la conexión — inténtalo otra vez.");
    } finally {
      setRehaciendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40 px-4 pb-4" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {/* SE TOCA PARA VERLA EN GRANDE. El visor ya existía —lo usan los
              looks y la maleta— y faltaba justo aquí: el clóset, que es donde
              uno va A MIRAR su ropa. Roberto: "¿cómo le hago para ver en grande
              la imagen?". */}
          <button
            type="button"
            onClick={() => item.imagen && setZoom(true)}
            aria-label="Ver la prenda en grande"
            className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-bg"
          >
            {item.imagen ? (
              <Image src={item.imagen} alt={item.nombre} fill sizes="88px" className="object-cover" />
            ) : (
              <span className="absolute inset-0" style={{ backgroundColor: item.swatch }} aria-hidden />
            )}
          </button>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-muted">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="min-h-10 rounded-sm border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
            />
            {/* De dónde salió la prenda, dicho sin rodeos: es lo que explica por
                qué unos datos son firmes y otros suposición nuestra. */}
            {!esFoto ? (
              <span className="text-xs leading-snug text-muted">
                La marcaste en la lista de básicos — lo de abajo es lo que
                supongo. Toca para corregirme.
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted">
            <Icon name="equis" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
            {/* EL RESUMEN: cada chip DICE su valor y es la puerta a su editor.
                Que digan el valor y no la etiqueta ("Pantalón", no "tipo") es
                lo que quita el muro — así se revisa la prenda entera de un
                vistazo y sólo se abre lo que esté mal. */}
            <div className="flex flex-wrap gap-1.5">
              <ChipResumen activo={seccion === "tipo"} onClick={() => abre("tipo")}>
                {CATEGORIAS.find((c) => c.v === categoria)?.l ?? "Tipo"}
              </ChipResumen>
              <ChipResumen activo={seccion === "color"} onClick={() => abre("color")}>
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-line"
                  style={{ backgroundColor: colorHex }}
                  aria-hidden
                />
                {nombreDelColor(colorHex, item)}
              </ChipResumen>
              <ChipResumen activo={seccion === "formalidad"} onClick={() => abre("formalidad")}>
                {FORMALIDADES.find((f) => f.v === formalidad)?.l ?? "Formalidad"}
              </ChipResumen>
              {/* EL AVISO DEL CORTE SUPUESTO SUBE AL CHIP. Dentro de "+ más" el
                  "esto es lo que supongo" quedaría escondido tras un tap — o
                  sea, el único dato que la ficha pide revisar sería el único
                  invisible. El borde de alerta es la invitación a abrirlo. */}
              <ChipResumen
                dashed
                activo={seccion === "mas"}
                alerta={
                  EL_CORTE_IMPORTA.has(categoria) &&
                  !!corte &&
                  !item.corteConfirmado &&
                  !corteTocado
                }
                onClick={() => abre("mas")}
              >
                + más
              </ChipResumen>
            </div>

            {seccion === "tipo" && (
              <Field label="Tipo">
                <Chips
                  opciones={CATEGORIAS}
                  valor={categoria}
                  onPick={(v) => {
                    setCategoria(v);
                    setSeccion(null);
                  }}
                />
              </Field>
            )}

            {/* EL COLOR PRINCIPAL. Faltaba: se podía corregir el SEGUNDO color
                y no el primero — el que alimenta las reglas de cuero, las de
                monocromo y la colorimetría. Mismo criterio que en la carga:
                primero el que tiene la prenda, luego los que de verdad se
                confunden con él, y la paleta entera a un tap. */}
            {seccion === "color" && (
              <Field label={`Color · ${nombreDelColor(colorHex, item)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {!PALETA.some((p) => mismoHex(p.hex, item.swatch)) ? (
                    <button
                      type="button"
                      aria-label="el color que tiene"
                      title="el color que tiene"
                      onClick={() => {
                        setColorHex(item.swatch);
                        setSeccion(null);
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        colorHex === item.swatch ? "scale-110 border-accent" : "border-line"
                      }`}
                      style={{ backgroundColor: item.swatch }}
                    />
                  ) : null}
                  {(todosLosColores ? PALETA : coloresCercanos(item.swatch, 4)).map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      aria-label={p.name}
                      title={p.name}
                      onClick={() => {
                        setColorHex(p.hex);
                        setSeccion(null);
                      }}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        mismoHex(colorHex, p.hex) ? "scale-110 border-accent" : "border-line"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                  {/* Abre la paleta entera SIN cerrar la sección: quien la pidió
                      es porque no encontró el suyo y sigue buscando. */}
                  {!todosLosColores ? (
                    <button
                      type="button"
                      onClick={() => setTodosLosColores(true)}
                      className="min-h-7 rounded-sm border border-line bg-surface px-2 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      otro color
                    </button>
                  ) : null}
                </div>
              </Field>
            )}

            {seccion === "formalidad" && (
              <Field label="Formalidad">
                <Chips
                  opciones={FORMALIDADES}
                  valor={formalidad}
                  onPick={(v) => {
                    setFormalidad(v);
                    setSeccion(null);
                  }}
                />
              </Field>
            )}

            {/* "+ MÁS": todo lo que se corrige de vez en cuando. No cierra al
                elegir —son varios campos y cerrarse en el primero obligaría a
                reabrir por cada uno—; cierra el botón "listo". */}
            {seccion === "mas" && (
              <>
                <Field label="Temporada">
                  <Chips opciones={TEMPORADAS} valor={temporada} onPick={setTemporada} />
                </Field>

                {/* EL CORTE, sólo donde cambia el look. Con siluetas y no con
                    las tres palabras sueltas: "entallado / recto / holgado" no
                    dice nada sin ver a qué se refiere — por eso este control
                    NO se cambió por los chips del carrete. Es el único campo
                    donde la ficha del clóset tiene el mejor editor de los dos. */}
                {EL_CORTE_IMPORTA.has(categoria) ? (
                  <Field
                    label={
                      !corteTocado && corte && !item.corteConfirmado
                        ? "Cómo te queda · esto es lo que supongo"
                        : "Cómo te queda"
                    }
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {CORTES.map((c) => (
                        <button
                          key={c.v}
                          type="button"
                          onClick={() => {
                            setCorte(c.v);
                            setCorteTocado(true);
                          }}
                          className={`flex flex-col items-center gap-1 rounded-sm border px-2 py-2 text-xs transition-colors ${
                            corte === c.v
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-line bg-surface text-muted"
                          }`}
                        >
                          <SiluetaCorte
                            corte={c.v}
                            tipo={categoria === "bottom" ? "bottom" : "top"}
                          />
                          {c.l}
                        </button>
                      ))}
                    </div>
                  </Field>
                ) : null}

                {/* Atributos ricos (v21): el motor los usa como señal dura (lana
                    ≠ calor, máx. un estampado) — por eso son corregibles aquí.
                    Chips en vez de texto libre y de un menú: es el mismo
                    vocabulario que la persona ya confirmó al dar de alta. */}
                <Field label="Material">
                  {otroMaterial ? (
                    <input
                      value={material}
                      autoFocus
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder="cashmere, gabardina…"
                      className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Escala
                        opciones={conLeido(MATERIALES, item.material)}
                        valor={material}
                        onPick={(v) => setMaterial(v ?? "")}
                        vacio="no sé"
                      />
                      <button
                        type="button"
                        onClick={() => setOtroMaterial(true)}
                        className="self-start text-[11.5px] text-muted underline underline-offset-2 transition-colors hover:text-accent"
                      >
                        es otro material
                      </button>
                    </div>
                  )}
                </Field>

                <Field label="Patrón">
                  <Escala
                    opciones={conLeido(PATRONES_CHIP, item.patron)}
                    valor={patron}
                    onPick={(v) => setPatron(v ?? "")}
                    vacio="sin dato"
                  />
                </Field>

                <Field label="Segundo color (si es bicolor)">
                  <input
                    value={colorSecundario}
                    onChange={(e) => setColorSecundario(e.target.value)}
                    placeholder="blanco, beige…"
                    className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </Field>

                {/* MARCA Y TALLA — lo único que ningún modelo puede leer.
                    Idea de Roberto. Viven SÓLO aquí y jamás en los flujos de
                    alta: la visión vio marca en 2 de 336 prendas (las Columbia,
                    por el logo) y la talla está en una etiqueta por dentro, así
                    que las dos son tecleo manual siempre. Pedirlas al cargar
                    quince prendas es la fricción de catalogar que este producto
                    existe para no tener; aquí tienes la prenda en la mano y no
                    hay prisa.
                    Opcionales de verdad: nada las pide, nada se rompe sin ellas.
                    `min-w-0` en los dos: sin él un input NO baja de lo que mide
                    su texto de ejemplo (min-width:auto), y "Uniqlo, Massimo
                    Dutti…" empujaba la talla fuera de la ficha. */}
                <div className="flex gap-3">
                  <Field label="Marca (opcional)">
                    <input
                      value={marca}
                      onChange={(e) => setMarca(e.target.value)}
                      placeholder="Uniqlo, Massimo Dutti…"
                      className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </Field>
                  <Field label="Talla">
                    <input
                      value={talla}
                      onChange={(e) => setTalla(e.target.value)}
                      placeholder={ejemploDeTalla(categoria)}
                      className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => setSeccion(null)}
                  className="min-h-9 rounded-sm border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors hover:border-accent"
                >
                  listo
                </button>
              </>
            )}

            {/* EL LAZO DEL TRAJE, desde la ficha. Antes sólo se podía poner al
                subir la foto: quien pasara de la casilla —o quien ya tuviera el
                traje de antes— no podía atarlo nunca. Sólo sale donde tiene
                sentido (saco ↔ pantalón), y las candidatas van ordenadas por
                cercanía de color, que pone el pantalón del traje primero. */}
            {esPiezaDeTraje ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted">
                  {pareja ? "Es parte de un conjunto" : "¿Es parte de un conjunto?"}
                </label>
                {pareja ? (
                  <div className="flex items-center gap-2 rounded-sm border border-line bg-bg p-2">
                    {pareja.imagen ? (
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-sm border border-line">
                        <Image src={pareja.imagen} alt="" fill sizes="36px" className="object-cover" />
                      </div>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{pareja.nombre}</span>
                    <button
                      type="button"
                      disabled={atando}
                      onClick={async () => {
                        setAtando(true);
                        await atarConjunto(item.id, null);
                        setAtando(false);
                        onSaved();
                      }}
                      className="shrink-0 text-[13px] text-muted disabled:opacity-50"
                    >
                      desatar
                    </button>
                  </div>
                ) : (
                  <>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {candidatas.length === 0 ? (
                      <span className="text-[13px] text-muted">
                        No veo con qué atarlo — te falta la otra pieza en el clóset.
                      </span>
                    ) : (
                      candidatas.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={atando}
                          onClick={async () => {
                            setAtando(true);
                            await atarConjunto(item.id, c.id);
                            setAtando(false);
                            onSaved();
                          }}
                          className="flex w-28 shrink-0 flex-col gap-1 rounded-sm border border-line bg-surface p-1 text-left transition-colors hover:border-accent disabled:opacity-50"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-bg">
                            {c.imagen ? (
                              <Image src={c.imagen} alt="" fill sizes="112px" className="object-cover" />
                            ) : null}
                          </div>
                          {/* SIN `truncate`, y la tarjeta más ancha. Roberto,
                              mirando cuatro candidatos: "no es claro cuál es el
                              pantalón que va con ese". Con 80px y una línea los
                              cuatro decían "Pantalón de…" — y lo que los
                              distingue (marino, gris oscuro) está AL FINAL del
                              nombre, justo donde cortaba. Una lista para elegir
                              cuyas etiquetas son idénticas no es una lista. */}
                          <span className="text-[11px] leading-tight text-muted">{c.nombre}</span>
                          {c.conjunto ? (
                            <span className="text-[10px] leading-tight text-warning">
                              ya es de otro conjunto
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                  {/* EL PANTALÓN QUE FALTA. Los cuatro "Traje …" de la base
                      quedaron sin él: el lector de una prenda leyó el saco y
                      el pantalón se perdió. En la migración no lo creé porque
                      no sabía si existía —crear ropa que nadie tiene es el
                      problema de fondo—, pero aquí lo declara su dueño, así
                      que deja de ser invención. Se deriva del saco (color,
                      material, temporada) y su imagen se genera después. */}
                  {categoria === "saco" ? (
                    <button
                      type="button"
                      disabled={atando}
                      onClick={async () => {
                        setAtando(true);
                        const r = await crearPantalonDelTraje(item.id);
                        // El render va aparte: si tarda o falla, la prenda ya
                        // existe y el clóset la enseña con su color.
                        if (r.ok && r.id) {
                          fetch("/api/render-item", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ itemId: r.id }),
                          }).catch(() => {});
                        }
                        setAtando(false);
                        onSaved();
                      }}
                      className="flex min-h-10 items-center justify-center gap-2 rounded-sm border border-accent px-3 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
                    >
                      {atando ? <Spinner className="h-4 w-4" /> : null}
                      su pantalón no está en mi clóset — créalo
                    </button>
                  ) : null}
                  </>
                )}
              </div>
            ) : null}

            {/* REHACER LA IMAGEN. El caso: una prenda que entró por una foto
                del conjunto entero —el esmoquin de Roberto— tiene una
                miniatura que enseña saco Y pantalón, aunque la prenda sea sólo
                el saco. La imagen miente y no había forma de corregirla: el
                render es idempotente a propósito (no gastar en regenerar lo
                que ya está), y esa protección aquí estorbaba. */}
            <button
              type="button"
              disabled={rehaciendo || saving}
              onClick={rehacerImagen}
              className="flex items-center gap-2 self-start text-left text-[13px] text-muted transition-colors hover:text-accent disabled:opacity-50"
            >
              {rehaciendo ? <Spinner className="h-3.5 w-3.5" /> : null}
              {dirty
                ? "guardar y rehacer la imagen con estos datos"
                : "la imagen no es de esta prenda — rehacerla"}
            </button>

            {errorRender ? (
              <p className="text-[13px] leading-snug text-error">{errorRender}</p>
            ) : null}

            {/* LA OFERTA, después de guardar. No se rehace sola: cuesta una
                llamada y a veces el cambio fue una tilde. Se pregunta con el
                motivo delante, que es lo que la hace contestable. */}
            {ofrecerRender ? (
              <div className="flex flex-col gap-2 rounded-sm bg-warning/10 p-3">
                <p className="text-[13px] leading-snug text-ink">
                  Guardado. Su imagen se generó con el nombre y el color
                  anteriores — ¿la rehago?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={rehaciendo}
                    onClick={rehacerImagen}
                    className="flex min-h-9 items-center gap-2 rounded-sm bg-accent px-3 text-[13px] font-medium text-on-accent disabled:opacity-50"
                  >
                    {rehaciendo ? <Spinner className="h-3.5 w-3.5" /> : null}
                    sí, rehazla
                  </button>
                  <button
                    type="button"
                    disabled={rehaciendo}
                    onClick={onSaved}
                    className="min-h-9 rounded-sm border border-line px-3 text-[13px] text-muted disabled:opacity-50"
                  >
                    así está bien
                  </button>
                </div>
              </div>
            ) : null}

            {dirty && !ofrecerRender ? (
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
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-bg text-sm font-medium text-error transition-colors hover:border-error"
        >
          <Icon name="equis" size={16} /> no tengo esta — quitar del clóset
        </button>

        <PrendaZoom
          data={zoom && item.imagen ? { image: item.imagen, nombre: item.nombre } : null}
          onClose={() => setZoom(false)}
        />
      </div>
    </div>
  );
}
