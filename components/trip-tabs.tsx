"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { TripGenContext, type TripGen } from "@/components/trip-gen-context";

// Frases de "armando" del viaje (lenguaje como progreso, palabra clave en acento).
const TRIP_PHRASES: GenPhrase[] = [
  { a: "abriendo tu ", k: "maleta", b: "…" },
  { a: "cruzando tus ", k: "colores", b: "…" },
  { a: "cuidando el ", k: "clima", b: "…" },
  { a: "armando tus ", k: "looks", b: "…" },
];

// Tabs del resultado del viaje: "La maleta" / "Tus looks". Flujo secuencial CON
// candado (decisión de Roberto, 2026-08-12): la PRIMERA generación solo se
// dispara desde el cierre de la maleta — antes se podía brincar directo a la
// pestaña de looks y generar sin haber revisado las sugerencias, y esos looks
// (que cuestan dinero y ~30s) salían de una maleta que estabas a punto de
// editar. "Confirmar" no es un paso nuevo: es el mismo botón de generar, ya
// detrás de la revisión. Con looks generados, Rehacer/Generar más siguen
// viviendo en su pestaña como siempre. Un punto avisa si quedaron viejos.
// La GENERACIÓN vive aquí (dueño único) para que el CTA de la maleta y los
// botones de looks la compartan.
export function TripTabs({
  tripId,
  maletaCount,
  looksCount,
  looksStale = false,
  confirmado = true,
  maleta,
  looks,
}: {
  tripId: string;
  maletaCount: number;
  looksCount: number;
  looksStale?: boolean;
  /** false = fase de plan (la pestaña se llama "el plan", no "la maleta"). */
  confirmado?: boolean;
  maleta: ReactNode;
  looks: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"maleta" | "looks">("maleta");
  const [generating, setGenerating] = useState(false);
  const [appending, setAppending] = useState(false);
  const [genError, setGenError] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const looksExist = looksCount > 0;

  // append=false: reemplaza el set (primera vez / "Rehacer") → overlay animado de
  // pantalla completa. append=true: "Generar más" → conserva los looks visibles y
  // suma un indicador inline (no los borra).
  async function generar(append = false) {
    setGenerating(true);
    setAppending(append);
    setGenError(false);
    setGenNote(null);
    try {
      const res = await fetch(`/api/trip/${tripId}/outfits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ append }),
      });
      const data = (await res.json().catch(() => ({}))) as { added?: number };
      if (!res.ok) {
        setGenError(true);
        setGenerating(false);
        setAppending(false);
        return;
      }
      if (append && data?.added === 0) {
        setGenNote("Ya no hay más combinaciones nuevas con esta maleta — agrega o sustituye prendas para más.");
      }
      router.refresh();
      // El refresh reemplaza los props; soltamos el loading tras un respiro para
      // que no parpadee antes de llegar el render.
      setTimeout(() => {
        setGenerating(false);
        setAppending(false);
      }, 600);
    } catch {
      setGenError(true);
      setGenerating(false);
      setAppending(false);
    }
  }

  // El estado/callbacks de generación se reparten por CONTEXT, no por cloneElement:
  // <TripResult/> y <TripOutfits/> llegan como props desde un server component y al
  // cruzar la frontera RSC isValidElement los daba como inválidos → cloneElement no
  // inyectaba nada (botones muertos). El context fluye por el árbol y sí los alcanza.
  const genValue: TripGen = {
    generating,
    appending,
    genError,
    genNote,
    onGenerate: () => generar(false),
    onGenerateMore: () => generar(true),
    onGenerateLooks: () => {
      setTab("looks");
      generar(false);
    },
    onViewLooks: () => setTab("looks"),
    onViewMaleta: () => setTab("maleta"),
    looksExist,
  };

  return (
    <>
      {/* Generación completa (primera vez / Rehacer): overlay animado de pantalla
          completa — da feedback claro y bloquea el doble-tap. "Generar más" NO usa
          el overlay (conserva los looks visibles). */}
      {generating && !appending ? <GeneratingScreen phrases={TRIP_PHRASES} /> : null}
      <div className="flex flex-col gap-4">
        <div className="-mt-1 flex gap-6 border-b border-line">
          <Tab
            label={confirmado ? "la maleta" : "el plan"}
            count={maletaCount}
            on={tab === "maleta"}
            onClick={() => setTab("maleta")}
          />
          <Tab
            label="tus looks"
            count={looksCount}
            on={tab === "looks"}
            dot={looksStale && looksExist}
            onClick={() => setTab("looks")}
          />
        </div>
        <TripGenContext.Provider value={genValue}>
          {tab === "maleta" ? maleta : looks}
        </TripGenContext.Provider>
      </div>
    </>
  );
}

function Tab({
  label,
  count,
  on,
  dot = false,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-[7px] border-b-2 py-[11px] text-sm font-semibold transition-colors ${
        on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      <span className="relative">
        {label}
        {dot ? (
          <span
            className="absolute -right-2.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-accent"
            aria-hidden
          />
        ) : null}
      </span>
      <span
        className={`tabular rounded-sm border px-1.5 py-px text-[11px] font-bold ${
          on ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
