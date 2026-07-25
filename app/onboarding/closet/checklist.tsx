"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { saveCloset } from "./actions";

export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  attrs: { color_hex?: string };
  image_path: string | null;
};

const CATEGORY_ORDER = ["top", "saco", "vestido", "bottom", "abrigo", "calzado"];
// Mínimo para armar un outfit: algo de arriba, algo de abajo y zapatos.
// Un vestido cuenta como arriba+abajo; sacos y abrigos son opcionales.
const REQUIRED = ["top", "bottom", "calzado"];
// Opcionales que el flujo guiado ANTES saltaba (el botón iba directo a enviar
// tras los 3 obligatorios): así el motor se enteraba de la ropa de abrigo solo
// si la persona tocaba el chip a mano. Ahora el CTA pasa por estas si están
// presentes y no las ha visto — con opción de saltar (no todos las tienen).
const OPTIONAL = ["saco", "abrigo", "vestido"];
const CATEGORY_LABELS: Record<string, string> = {
  top: "Arriba",
  saco: "Sacos",
  vestido: "Vestidos",
  bottom: "Abajo",
  abrigo: "Abrigos",
  calzado: "Zapatos",
};

// Clóset v3: chips de categoría como filtro + grid 2-col. Las prendas se ven
// SIEMPRE a todo color para poder evaluar imagen y color antes de elegir; la
// selección se marca con el check tinta + un marco fino (ring interior) para
// que la distinción sea obvia sin apagar las no seleccionadas.
export function Checklist({ catalog }: { catalog: CatalogItem[] }) {
  // Categorías presentes, en orden; las no contempladas van al final.
  const known = new Set(CATEGORY_ORDER);
  const cats = [
    ...CATEGORY_ORDER.filter((c) => catalog.some((i) => i.category === c)),
    ...[...new Set(catalog.filter((i) => !known.has(i.category)).map((i) => i.category))],
  ];

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeCat, setActiveCat] = useState<string>(cats[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = catalog.filter((i) => i.category === activeCat);

  // Cobertura de categorías esenciales (para guiar el botón y los chips).
  const countIn = (cat: string) =>
    catalog.filter((i) => i.category === cat && selected.has(i.id)).length;
  const hasDress = countIn("vestido") > 0;
  const isSatisfied = (cat: string) =>
    cat === "top" || cat === "bottom"
      ? countIn(cat) > 0 || hasDress // un vestido cubre arriba y abajo
      : countIn(cat) > 0;
  const requiredPresent = REQUIRED.filter((c) => cats.includes(c));
  const missing = requiredPresent.filter((c) => !isSatisfied(c));
  const requiredDone = missing.length === 0;

  // Categorías vistas (para que el CTA guíe por las opcionales tras los 3
  // obligatorios, en vez de saltar directo a enviar). La activa inicial ya
  // cuenta como vista.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([cats[0] ?? ""]));
  useEffect(() => {
    setVisited((v) => (v.has(activeCat) ? v : new Set(v).add(activeCat)));
  }, [activeCat]);

  const optionalPresent = OPTIONAL.filter((c) => cats.includes(c));
  // Tras cubrir lo obligatorio, guía a la primera opcional que aún no vio.
  const optionalTarget = requiredDone
    ? optionalPresent.find((c) => !visited.has(c))
    : undefined;
  const canSubmit = requiredDone && !optionalTarget;
  const target = missing[0] ?? optionalTarget; // a dónde lleva el "go"
  const targetLabel = target ? (CATEGORY_LABELS[target] ?? target) : "";
  const targetIsOptional = !!target && OPTIONAL.includes(target);

  // El botón: completo → enviar; pendiente-obligatoria que ES la activa (vacía)
  // → pedir que marque; si no, llevar a la categoría objetivo (obligatoria u
  // opcional). Cuando solo quedan opcionales, hay un "ya, ármalo" para saltar.
  const ctaMode: "submit" | "go" | "fill" = canSubmit
    ? "submit"
    : !requiredDone && target === activeCat
      ? "fill"
      : "go";

  function goToCat(cat: string) {
    setActiveCat(cat);
    // Vuelve arriba: tras avanzar, que vean la categoría nueva desde el inicio
    // (y no quede el dedo sobre el botón por inercia).
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCta() {
    if (ctaMode === "submit") return submit();
    if (ctaMode === "go" && target) goToCat(target);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function submit() {
    startTransition(async () => {
      setError(null);
      const res = await saveCloset([...selected]);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Chips de categoría (scroll-x); el número = cuántas marcaste ahí */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cats.map((cat) => {
          const on = cat === activeCat;
          const selCount = countIn(cat);
          // Punto recordatorio: categoría esencial que aún no marcas.
          const pending = REQUIRED.includes(cat) && !isSatisfied(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCat(cat)}
              aria-pressed={on}
              className={`flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                on
                  ? "border-accent bg-accent text-on-accent"
                  : "border-line bg-surface text-ink hover:border-ink"
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
              {selCount > 0 ? (
                <span className="ml-1.5 font-bold opacity-60">{selCount}</span>
              ) : pending ? (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-40"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Recordatorio de que hay que cubrir varias categorías */}
      <p className="-mt-1 text-[12.5px] text-muted">
        Marca lo que tengas de cada tipo — al menos arriba, abajo y zapatos.
      </p>

      {/* Grid de la categoría activa */}
      <div className="grid grid-cols-2 gap-3">
        {visible.map((item) => {
          const on = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              aria-pressed={on}
              className={`relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg text-left transition-shadow duration-200 focus-visible:outline-none ${
                on ? "ring-2 ring-inset ring-accent" : ""
              }`}
            >
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

              {/* Check de selección */}
              <span
                className={`absolute right-2 top-2 flex h-[25px] w-[25px] items-center justify-center rounded-full border transition-colors ${
                  on
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line bg-surface/85 text-transparent"
                }`}
                aria-hidden
              >
                <Icon name="check" size={14} strokeWidth={2.6} />
              </span>

              {/* Nombre sobre degradado: gris si está apagado, tinta si está on */}
              <span
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface/95 via-surface/80 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-semibold ${
                  on ? "text-ink" : "text-muted"
                }`}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* CTA sticky */}
      <div className="sticky bottom-0 mt-auto bg-bg pb-4 pt-2">
        <button
          type="button"
          onClick={handleCta}
          disabled={pending || ctaMode === "fill"}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-40"
        >
          {pending ? (
            <>
              <Spinner className="h-4 w-4" />
              guardando tu clóset…
            </>
          ) : ctaMode === "submit" ? (
            <>
              armar mi primer look <Icon name="destello" size={18} />
            </>
          ) : ctaMode === "go" ? (
            <>
              {targetIsOptional
                ? `¿tienes ${targetLabel.toLowerCase()}?`
                : `sigue con ${targetLabel.toLowerCase()}`}{" "}
              <Icon name="flecha" size={18} />
            </>
          ) : (
            <>marca lo que tengas de {targetLabel.toLowerCase()}</>
          )}
        </button>
        {/* Escape: cubrió lo obligatorio y solo quedan opcionales (saco/abrigo)
            — que pueda saltarlas si no tiene, sin quedar atrapado. */}
        {requiredDone && !canSubmit && !pending ? (
          <button
            type="button"
            onClick={submit}
            className="mx-auto mt-2 block min-h-9 px-4 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            ya, ármalo
          </button>
        ) : null}
      </div>
    </div>
  );
}
