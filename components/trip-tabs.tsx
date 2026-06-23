"use client";

import {
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// Props que TripTabs inyecta a sus paneles para coordinar el flujo
// "maleta primero → genera looks" sin levantar TODO a la página.
export type MaletaInjected = {
  onGenerateLooks?: () => void; // arma los looks (cambia a la pestaña + dispara)
  onViewLooks?: () => void; // solo ir a los looks (ya existen)
  looksExist?: boolean;
};
export type LooksInjected = {
  generating?: boolean;
  genError?: boolean;
  onGenerate?: () => void; // generar/rehacer (reemplaza el set)
  onGenerateMore?: () => void; // "generar más": acumula combinaciones nuevas
  genNote?: string | null; // aviso tras generar (ej. "ya no hay más combos")
};

// Tabs del resultado del viaje: "La maleta" / "Tus looks". Flujo secuencial-suave:
// armas la maleta y desde ahí generas los looks (sin candado). La GENERACIÓN vive
// aquí (dueño único) para que el CTA de la maleta y los botones de looks la
// compartan. Un punto en "Tus looks" avisa si quedaron viejos.
export function TripTabs({
  tripId,
  maletaCount,
  looksCount,
  looksStale = false,
  maleta,
  looks,
}: {
  tripId: string;
  maletaCount: number;
  looksCount: number;
  looksStale?: boolean;
  maleta: ReactNode;
  looks: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"maleta" | "looks">("maleta");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const looksExist = looksCount > 0;

  // append=false: reemplaza el set (primera vez / "Rehacer"). append=true:
  // "Generar más" — suma combinaciones nuevas a las que ya hay.
  async function generar(append = false) {
    setGenerating(true);
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
        return;
      }
      if (append && data?.added === 0) {
        setGenNote("Ya no hay más combinaciones nuevas con esta maleta — agrega o sustituye prendas para más.");
      }
      router.refresh();
      // El refresh reemplaza los props; soltamos el loading tras un respiro para
      // que no parpadee antes de llegar el render.
      setTimeout(() => setGenerating(false), 600);
    } catch {
      setGenError(true);
      setGenerating(false);
    }
  }

  const maletaEl = isValidElement(maleta)
    ? cloneElement(maleta as ReactElement<MaletaInjected>, {
        onGenerateLooks: () => {
          setTab("looks");
          generar(false);
        },
        onViewLooks: () => setTab("looks"),
        looksExist,
      })
    : maleta;
  const looksEl = isValidElement(looks)
    ? cloneElement(looks as ReactElement<LooksInjected>, {
        generating,
        genError,
        onGenerate: () => generar(false),
        onGenerateMore: () => generar(true),
        genNote,
      })
    : looks;

  return (
    <div className="flex flex-col gap-4">
      <div className="-mt-1 flex gap-6 border-b border-line">
        <Tab label="La maleta" count={maletaCount} on={tab === "maleta"} onClick={() => setTab("maleta")} />
        <Tab
          label="Tus looks"
          count={looksCount}
          on={tab === "looks"}
          dot={looksStale && looksExist}
          onClick={() => setTab("looks")}
        />
      </div>
      {tab === "maleta" ? maletaEl : looksEl}
    </div>
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
