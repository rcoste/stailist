"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteTripCopy } from "@/components/delete-trip-button";
import { GeneratingScreen, type GenPhrase } from "@/components/generating-screen";
import { TripGenContext, type TripGen, type TripTab } from "@/components/trip-gen-context";
import { ACT_ICON } from "@/components/trip-icons";
import { deleteTrip } from "@/lib/delete-actions";
import { confirmTripPlan } from "@/lib/trip-actions";
import { OCCASIONS, type Occasion } from "@/lib/trip";

// Frases de "armando" del viaje (lenguaje como progreso, palabra clave en acento).
const TRIP_PHRASES: GenPhrase[] = [
  { a: "abriendo tu ", k: "maleta", b: "…" },
  { a: "cruzando tus ", k: "colores", b: "…" },
  { a: "cuidando el ", k: "clima", b: "…" },
  { a: "armando tus ", k: "looks", b: "…" },
];

// EL DETALLE DEL VIAJE EN 4 PESTAÑAS (handoff viaje 2, 2026-08-13):
// el plan · prendas · empacar · looks.
//
//   · "el plan": el razonamiento del estilista en serif + las actividades del
//     wizard como referencia + CTA "revisar prendas →". Default recién armada.
//   · "prendas": la revisión (secciones no-lo-tienes / decide / ya-lo-tienes).
//   · "empacar": puro checklist. Default al regresar con la maleta confirmada.
//   · "looks": el resultado. El candado sigue: la PRIMERA generación vive
//     detrás de la revisión ("listo — a empacar"), solo que ahora el botón de
//     generar está al final de empacar, no en la confirmación.
//
// LA PORTADA SOLO VIVE EN "EL PLAN" (móvil): cover full-bleed con el título
// encima; en las pestañas de trabajo el header es compacto sin imagen — la
// portada les robaría espacio. El cambio anima el colapso (~300ms, tokens del
// DS) con crossfade del título entre el scrim y el header compacto — la
// pantalla 7 del handoff. En desktop el header vive en el rail de la página y
// aquí solo se pintan pestañas y contenido.
//
// TripResult NO se monta dos veces para prendas/empacar: es EL MISMO nodo
// (estado de duelos/optimista intacto) y lee la pestaña activa del context
// para decidir qué fase pinta.
export function TripTabs({
  tripId,
  destino,
  fechas,
  metaExtra,
  foto,
  firma,
  actividades,
  prendasCount,
  looksCount,
  looksStale = false,
  confirmado: confirmadoInicial = false,
  maleta,
  looks,
}: {
  tripId: string;
  /** "Nueva York" / "Japón" — para el título "tu maleta para X". */
  destino: string;
  /** "14 – 16 ago · 3 días" (la parte bold de la línea de meta). */
  fechas: string;
  /** "~25°C · 1 carry-on" — lo demás de la línea (null si no hay). */
  metaExtra: string | null;
  /** La foto/paisaje del viaje para la portada. */
  foto: string;
  /** El razonamiento del estilista (firma del motor o plantilla). */
  firma: string | null;
  /** Las actividades elegidas en el wizard (solo referencia visual). */
  actividades: Occasion[];
  prendasCount: number;
  looksCount: number;
  looksStale?: boolean;
  /** true = la revisión ya se cerró (o el viaje es de antes del flujo nuevo). */
  confirmado?: boolean;
  maleta: ReactNode;
  looks: ReactNode;
}) {
  const router = useRouter();
  // Default contextual del handoff: "el plan" recién generada; "empacar"
  // cuando regresas con la maleta ya confirmada.
  const [tab, setTab] = useState<TripTab>(confirmadoInicial ? "empacar" : "plan");
  const [confirmado, setConfirmado] = useState(confirmadoInicial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmandoDel, setConfirmandoDel] = useState(false);
  const [borrando, setBorrando] = useState(false);
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
    onViewMaleta: () => setTab("prendas"),
    looksExist,
    tab,
    goTo: setTab,
    confirmado,
    onConfirm: () => {
      // Optimista: el server persiste la llave en overrides; si falla (incluida
      // red caída — el catch evita el unhandled rejection), el próximo load
      // amanece sin confirmar — recuperable, no destructivo.
      setConfirmado(true);
      setTab("empacar");
      confirmTripPlan(tripId).catch(() => {});
    },
  };

  const enPlan = tab === "plan";
  const actos = OCCASIONS.filter((o) => actividades.includes(o.value));

  return (
    <>
      {/* Generación completa (primera vez / Rehacer): overlay animado de pantalla
          completa — da feedback claro y bloquea el doble-tap. "Generar más" NO usa
          el overlay (conserva los looks visibles). */}
      {generating && !appending ? <GeneratingScreen phrases={TRIP_PHRASES} /> : null}

      {/* ══ HEADER MÓVIL: portada en "el plan", compacto en las de trabajo. El
          contenedor anima su altura y las dos capas cruzan en fade (pantalla 7
          del handoff). -mx-4 = a sangre contra el padding del AppShell. ══ */}
      <div
        className="relative -mx-4 overflow-hidden lg:hidden"
        style={{
          height: enPlan ? 218 : 108,
          transition: "height var(--dur-medium) var(--ease-enter)",
        }}
      >
        {/* Capa portada. `inert` acompaña al aria-hidden: pointer-events-none
            no bloquea el foco de teclado, y sin esto la capa invisible dejaba
            un back y un "···" tabulables (WCAG). */}
        <div
          aria-hidden={!enPlan}
          inert={!enPlan || undefined}
          className={enPlan ? "" : "pointer-events-none"}
          style={{
            position: "absolute",
            inset: 0,
            opacity: enPlan ? 1 : 0,
            transition: "opacity var(--dur-medium) var(--ease-enter)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* Scrim para que el título lea sobre cualquier foto (patrón de
              espejo-flow: gradiente de tinta inline + texto blanco). */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgb(20 20 20 / 0.74), rgb(20 20 20 / 0) 58%)",
            }}
          />
          {/* Área táctil ≥44px con after: (patrón coach-pie): el círculo visual
              se queda en 34px, el hit box crece invisible. */}
          <Link
            href="/viaje/lista"
            aria-label="Volver a modo viaje"
            className="absolute left-3.5 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/90 text-ink after:absolute after:-inset-1.5 after:content-['']"
          >
            <Icon name="chevron" size={16} rotate={180} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Opciones del viaje"
            className="absolute right-3.5 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-surface/90 text-ink after:absolute after:-inset-1.5 after:content-['']"
          >
            <Icon name="puntos" size={17} />
          </button>
          <div className="absolute inset-x-4 bottom-3.5 text-white">
            <h1 className="text-[27px] font-bold leading-[1.1] tracking-[-0.03em]">
              tu maleta para <em className="display font-normal">{destino}</em>
            </h1>
            <p className="mt-1 text-[12.5px] text-white/85">
              <b className="tabular font-bold text-white">{fechas}</b>
              {metaExtra ? ` · ${metaExtra}` : ""}
            </p>
          </div>
        </div>

        {/* Capa compacta (pestañas de trabajo) */}
        <div
          aria-hidden={enPlan}
          inert={enPlan || undefined}
          className={`flex flex-col justify-end px-4 pb-1 ${enPlan ? "pointer-events-none" : ""}`}
          style={{
            position: "absolute",
            inset: 0,
            opacity: enPlan ? 0 : 1,
            transition: "opacity var(--dur-medium) var(--ease-enter)",
          }}
        >
          <div className="flex items-center justify-between">
            <Link
              href="/viaje/lista"
              className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
            >
              <Icon name="chevron" size={15} rotate={180} />
              modo viaje
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Opciones del viaje"
              className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-surface text-muted after:absolute after:-inset-2 after:content-['']"
            >
              <Icon name="puntos" size={16} />
            </button>
          </div>
          <h1 className="mt-1 truncate text-[24px] font-bold leading-tight tracking-[-0.025em] text-ink">
            tu maleta para <em className="display font-normal">{destino}</em>
          </h1>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            <b className="tabular font-bold text-ink">{fechas}</b>
            {metaExtra ? ` · ${metaExtra}` : ""}
          </p>
        </div>
      </div>

      {/* Menú "···": solo las acciones raras — editar la ruta y borrar.
          "Regenerar la maleta" NO va aquí (es contextual: se ofrece al editar
          la ruta; una prenda suelta se cambia en "prendas"). */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute right-4 top-36 min-w-[224px] overflow-hidden rounded-md bg-surface py-1"
            style={{ boxShadow: "var(--shadow-float)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href={`/viaje?edit=${tripId}`}
              className="flex min-h-11 items-center gap-3 px-4 text-[14.5px] font-semibold text-ink"
            >
              <Icon name="lapiz" size={16} /> editar ruta y fechas
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmandoDel(true);
              }}
              className="flex min-h-11 w-full items-center gap-3 border-t border-line2 px-4 text-[14.5px] font-semibold text-muted"
            >
              <Icon name="equis" size={15} /> {borrando ? "borrando…" : "borrar este viaje"}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDelete
        open={confirmandoDel}
        {...deleteTripCopy(destino)}
        onCancel={() => setConfirmandoDel(false)}
        onConfirm={async () => {
          setConfirmandoDel(false);
          setBorrando(true);
          try {
            const res = await deleteTrip(tripId);
            if (res.ok) router.push("/viaje/lista");
            else setBorrando(false);
          } catch {
            // Red caída: sin esto el "borrando…" del menú se queda pegado.
            setBorrando(false);
          }
        }}
      />

      <div className="flex flex-col gap-4">
        <div className="-mt-1 flex gap-5 border-b border-line">
          <Tab label="el plan" on={tab === "plan"} onClick={() => setTab("plan")} />
          <Tab
            label="prendas"
            count={prendasCount}
            on={tab === "prendas"}
            onClick={() => setTab("prendas")}
          />
          <Tab label="empacar" on={tab === "empacar"} onClick={() => setTab("empacar")} />
          <Tab
            label="looks"
            count={looksCount}
            on={tab === "looks"}
            dot={looksStale && looksExist}
            onClick={() => setTab("looks")}
          />
        </div>
        <TripGenContext.Provider value={genValue}>
          {/* "el plan": razonamiento + actividades como referencia + CTA. */}
          {tab === "plan" ? (
            <div className="flex flex-col gap-4">
              {firma ? (
                <p className="display mt-1 text-[18.5px] leading-[1.5] text-ink">{firma}</p>
              ) : null}
              {actos.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-faint">
                    lo que vas a hacer
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {actos.map((o) => (
                      <span
                        key={o.value}
                        className="flex flex-1 basis-[30%] flex-col items-center gap-2 rounded-md border border-line bg-surface px-1.5 py-3.5 text-center text-[12px] font-bold leading-tight text-ink"
                      >
                        <Icon name={ACT_ICON[o.value]} size={20} />
                        {o.label.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* Sticky sobre la tab bar (57px + safe-area, como el detalle del
                  historial): era el último elemento del scroll y en móvil se
                  perdía bajo el fold (feedback de Alberto en toda la maleta). */}
              <div className="sticky bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-bg px-4 pb-2 pt-2.5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
                <button
                  type="button"
                  onClick={() => setTab("prendas")}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
                >
                  revisar prendas →
                </button>
              </div>
            </div>
          ) : null}
          {/* prendas y empacar comparten EL MISMO nodo (TripResult decide su
              fase con el tab del context); oculto —no desmontado— para que las
              decisiones optimistas de la sesión sobrevivan el cambio de tab. */}
          <div className={tab === "prendas" || tab === "empacar" ? "" : "hidden"}>{maleta}</div>
          {tab === "looks" ? looks : null}
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
  /** Sin `count` la pestaña va sin caja de conteo (el plan, empacar). */
  count?: number;
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
      {count !== undefined ? (
        <span
          className={`tabular rounded-sm border px-1.5 py-px text-[11px] font-bold ${
            on ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-muted"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
