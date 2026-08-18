"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { addArchetypes } from "@/app/closet/actions";
import { toggleWishlistArchetype } from "@/lib/wishlist-actions";
import { agruparTrajes, type TrajeDeCatalogo } from "@/lib/trajes-catalogo";
import type { CatalogItem } from "@/app/onboarding/closet/checklist";

// Mismo orden y etiquetas que el checklist del onboarding, + accesorios.
//
// "saco" FALTABA en las dos listas y no era inocuo: al no estar en el orden
// caía al final como categoría desconocida y su chip se pintaba con la llave
// cruda, en minúsculas — "saco 12" entre "Abrigos" y "Zapatos".
const CAT_TRAJE = "traje";
const CATEGORY_ORDER = [
  "top",
  "saco",
  CAT_TRAJE,
  "vestido",
  "bottom",
  "abrigo",
  "calzado",
  "accesorio",
];
const CATEGORY_LABELS: Record<string, string> = {
  top: "Arriba",
  saco: "Sacos",
  [CAT_TRAJE]: "Trajes",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
  accesorio: "Accesorios",
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function BibliotecaPicker({
  catalog,
  savedWishIds = [],
}: {
  catalog: CatalogItem[];
  savedWishIds?: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cat, setCat] = useState<string | null>(null); // null = Todos
  const [query, setQuery] = useState("");
  // Wishlist: arquetipos marcados (optimista) + toast al guardar.
  const [wished, setWished] = useState<Set<number>>(() => new Set(savedWishIds));
  const [toast, setToast] = useState<string | null>(null);

  function toggleWish(item: CatalogItem) {
    const willSave = !wished.has(item.id);
    setWished((s) => {
      const n = new Set(s);
      if (willSave) n.add(item.id);
      else n.delete(item.id);
      return n;
    });
    if (willSave) {
      setToast("Guardada en tu wishlist");
      setTimeout(() => setToast(null), 2000);
    }
    startTransition(async () => {
      const res = await toggleWishlistArchetype({
        archetypeId: item.id,
        name: item.name,
        imageUrl: item.image_path,
        colorHex: item.attrs.color_hex ?? null,
      });
      // El server dice cómo quedó DE VERDAD (`saved`); si falló, el optimismo
      // se revierte a eso. Ignorar el resultado dejaba la UI mintiendo — el
      // patrón exacto del pitfall documentado del candado sin finally.
      if (!res.ok) {
        setWished((s) => {
          const n = new Set(s);
          if (res.saved) n.add(item.id);
          else n.delete(item.id);
          return n;
        });
        setToast("No pude guardarla — inténtalo otra vez");
        setTimeout(() => setToast(null), 2500);
      }
    });
  }

  // Los trajes se muestran como UNA tarjeta (saco + pantalón); `sueltas` es el
  // resto del catálogo, ya sin esas piezas.
  const { trajes, sueltas } = useMemo(() => agruparTrajes(catalog), [catalog]);

  // Categorías presentes (orden canónico + cualquier extra), con conteo.
  const cats = useMemo(() => {
    const known = new Set(CATEGORY_ORDER);
    const extra = [...new Set(sueltas.filter((i) => !known.has(i.category)).map((i) => i.category))];
    return [...CATEGORY_ORDER, ...extra]
      .map((key) => ({
        key,
        count:
          key === CAT_TRAJE
            ? trajes.length
            : sueltas.filter((i) => i.category === key).length,
      }))
      .filter((c) => c.count > 0);
  }, [sueltas, trajes]);

  // Filtro por búsqueda (sobre todo) + categoría activa.
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return sueltas.filter((i) => {
      if (q && !norm(i.name).includes(q)) return false;
      if (cat && i.category !== cat) return false;
      return true;
    });
  }, [sueltas, query, cat]);

  // Buscar "traje" o "carbón" tiene que encontrar el traje: se busca por su
  // nombre Y por el de sus piezas (nadie escribe "traje gris carbón" completo).
  const trajesShown = useMemo(() => {
    const q = norm(query.trim());
    if (cat && cat !== CAT_TRAJE) return [];
    return trajes.filter(
      (t) =>
        !q ||
        norm(t.nombre).includes(q) ||
        t.piezas.some((p) => norm(p.name).includes(q))
    );
  }, [trajes, query, cat]);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // El traje entra completo (las dos piezas), en un solo tap.
  function toggleTraje(traje: TrajeDeCatalogo<CatalogItem>) {
    const todas = traje.piezas.every((p) => selected.has(p.id));
    const next = new Set(selected);
    for (const p of traje.piezas) {
      if (todas) next.delete(p.id);
      else next.add(p.id);
    }
    setSelected(next);
  }

  // Guardar un traje en la wishlist guarda sus DOS piezas: media wishlist de
  // traje (el saco sin el pantalón) no es nada que se pueda comprar.
  function toggleWishTraje(traje: TrajeDeCatalogo<CatalogItem>) {
    const guardado = traje.piezas.every((p) => wished.has(p.id));
    setWished((s) => {
      const n = new Set(s);
      for (const p of traje.piezas) {
        if (guardado) n.delete(p.id);
        else n.add(p.id);
      }
      return n;
    });
    if (!guardado) {
      setToast("Guardado en tu wishlist");
      setTimeout(() => setToast(null), 2000);
    }
    startTransition(async () => {
      let fallo = false;
      for (const p of traje.piezas) {
        const yaEsta = wished.has(p.id);
        if (yaEsta === !guardado) continue; // ya está como debe quedar
        const res = await toggleWishlistArchetype({
          archetypeId: p.id,
          name: p.name,
          imageUrl: p.image_path,
          colorHex: p.attrs.color_hex ?? null,
        });
        // Si una pieza falla, ESA pieza se revierte a lo que el server dice
        // que tiene (`saved`). Sin esto, "guardado el traje" con media
        // wishlist real era exactamente la mentira optimista del pitfall
        // documentado — y media wishlist de traje no es nada comprable.
        if (!res.ok) {
          fallo = true;
          setWished((s) => {
            const n = new Set(s);
            if (res.saved) n.add(p.id);
            else n.delete(p.id);
            return n;
          });
        }
      }
      if (fallo) {
        setToast("No pude guardar el traje completo — inténtalo otra vez");
        setTimeout(() => setToast(null), 2500);
      }
    });
  }

  function submit() {
    startTransition(async () => {
      setError(null);
      const res = await addArchetypes([...selected]);
      if (!res.ok) {
        setError("No pude agregar las prendas — inténtalo otra vez.");
        return;
      }
      router.push("/closet");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Buscador slim + chips que FILTRAN (no scroll infinito). */}
      <div className="flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2.5">
        <Icon name="lupa" size={18} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="busca un básico…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          label="Todos"
          count={sueltas.length + trajes.length}
          on={!cat}
          onClick={() => setCat(null)}
        />
        {cats.map((c) => (
          <FilterChip
            key={c.key}
            label={CATEGORY_LABELS[c.key] ?? c.key}
            count={c.count}
            on={cat === c.key}
            onClick={() => setCat(c.key)}
          />
        ))}
      </div>

      {shown.length === 0 && trajesShown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">nada coincide con tu búsqueda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:gap-4">
          {trajesShown.map((traje) => {
            const on = traje.piezas.every((p) => selected.has(p.id));
            const wish = traje.piezas.every((p) => wished.has(p.id));
            const acompanante = traje.piezas.find((p) => p.id !== traje.portada.id);
            return (
              <div key={traje.conjunto} className="relative">
                <button
                  type="button"
                  onClick={() => toggleTraje(traje)}
                  aria-pressed={on}
                  className={`group relative flex w-full flex-col overflow-hidden rounded-md border border-line bg-surface text-left transition-[border-color,box-shadow] duration-200 hover:border-ink focus-visible:outline-none ${
                    on ? "ring-2 ring-inset ring-accent" : ""
                  }`}
                >
                  <div className="relative aspect-square w-full bg-bg">
                    {traje.portada.image_path ? (
                      <Image
                        src={traje.portada.image_path}
                        alt={traje.nombre}
                        fill
                        sizes="(max-width: 430px) 50vw, 215px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: traje.portada.attrs.color_hex ?? "#E5E1DD" }}
                        aria-hidden
                      />
                    )}
                    {/* La segunda pieza encimada: sin ella la tarjeta se ve
                        igual que la del saco suelto. */}
                    {acompanante?.image_path ? (
                      <span className="absolute bottom-2 right-2 block h-[36%] w-[36%] overflow-hidden rounded-sm border border-line bg-surface">
                        <Image
                          src={acompanante.image_path}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </span>
                    ) : null}
                    <span
                      className={`absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-sm text-on-accent transition-all duration-200 ${
                        on ? "scale-100 bg-accent" : "scale-0 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      <Icon name="check" size={15} strokeWidth={2.4} />
                    </span>
                  </div>
                  <span
                    className={`flex flex-col px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-200 ${
                      on ? "text-ink" : "text-muted"
                    }`}
                  >
                    {traje.nombre}
                    <span className="text-[11px] text-muted">saco + pantalón</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleWishTraje(traje)}
                  aria-pressed={wish}
                  aria-label={wish ? "quitar de wishlist" : "agregar a wishlist"}
                  className={`absolute left-2 top-2 z-10 flex h-[26px] w-[26px] items-center justify-center rounded-sm border transition-colors duration-200 ${
                    wish
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface/90 text-ink hover:border-accent"
                  }`}
                >
                  <Icon name={wish ? "bookmarkFill" : "bookmark"} size={13} />
                </button>
              </div>
            );
          })}
          {shown.map((item) => {
            const on = selected.has(item.id);
            const wish = wished.has(item.id);
            return (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={on}
                  className={`group relative flex w-full flex-col overflow-hidden rounded-md border border-line bg-surface text-left transition-[border-color,box-shadow] duration-200 hover:border-ink focus-visible:outline-none ${
                    on ? "ring-2 ring-inset ring-accent" : ""
                  }`}
                >
                {/* Las prendas se ven siempre a todo color para poder evaluarlas
                    antes de elegir; lo seleccionado se marca con marco + check. */}
                <div className="relative aspect-square w-full bg-bg">
                  {item.image_path ? (
                    <Image
                      src={item.image_path}
                      alt={item.name}
                      fill
                      sizes="(max-width: 430px) 50vw, 215px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="absolute inset-0"
                      style={{ backgroundColor: item.attrs.color_hex ?? "#E5E1DD" }}
                      aria-hidden
                    />
                  )}
                  <span
                    className={`absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-sm text-on-accent transition-all duration-200 ${
                      on ? "scale-100 bg-accent" : "scale-0 bg-transparent"
                    }`}
                    aria-hidden
                  >
                    <Icon name="check" size={15} strokeWidth={2.4} />
                  </span>
                </div>
                  <span
                    className={`px-2.5 py-2 text-[12.5px] font-medium transition-colors duration-200 ${
                      on ? "text-ink" : "text-muted"
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleWish(item)}
                  aria-pressed={wish}
                  aria-label={wish ? "quitar de wishlist" : "agregar a wishlist"}
                  className={`absolute left-2 top-2 z-10 flex h-[26px] w-[26px] items-center justify-center rounded-sm border transition-colors duration-200 ${
                    wish
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface/90 text-ink hover:border-accent"
                  }`}
                >
                  <Icon name={wish ? "bookmarkFill" : "bookmark"} size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {toast ? (
        <div className="pointer-events-none fixed bottom-[86px] left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-on-accent shadow-[var(--shadow-lg,0_8px_24px_rgba(10,10,10,0.25))]">
          {toast}
        </div>
      ) : null}

      {/* Barra de acción fija (única barra abajo; sin tab bar en esta pantalla). */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] lg:max-w-5xl -translate-x-1/2 border-t border-line bg-surface px-[18px] pb-[max(14px,env(safe-area-inset-bottom))] pt-[11px]">
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-base font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              agregando…
            </>
          ) : selected.size === 0 ? (
            "marca lo que quieras agregar"
          ) : (
            `agregar a mi clóset (${selected.size})`
          )}
        </button>
      </div>
    </div>
  );
}

function FilterChip({
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
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-2 text-[12.5px] font-medium transition-colors duration-200 ${
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
      <span className={`tabular text-[11px] ${on ? "text-on-accent/70" : "text-muted/70"}`}>{count}</span>
    </button>
  );
}
