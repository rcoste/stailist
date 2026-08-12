import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadJourneySignals } from "@/lib/journey-data";
import { HintChain, type HintCandidato } from "@/components/hint";
import { HoyClient, type HoyOutfit } from "./hoy-client";
import type { ClosetPick } from "@/components/weather-picker";
import { loadClosetPicks } from "@/lib/closet-picks";
import { loadHomeTrip } from "@/lib/home-trip";
import { loadUltimoLook } from "@/lib/ultimo-look";
import { buildHomeChecklist } from "@/lib/home-checklist";
import { ASSESSMENT_QUESTIONS } from "@/lib/capsule";

/** Color de relleno cuando una prenda no tiene ni imagen ni color leído.
 *
 *  Era un `#E5E1DD` suelto repetido en dos pantallas — un hex a un punto de
 *  `--c-line` (#e4e3e0) que nadie iba a mantener sincronizado. Va al token: es
 *  un hueco de la UI, no el color de una prenda. */
const SWATCH_VACIO = "var(--c-line)";

export default async function HoyPage({
  searchParams,
}: {
  // `inicio`: pedir la home aunque ya haya look del día (pestaña "Hoy" activa,
  // o el título "hoy" del propio look).
  searchParams: Promise<{ generar?: string; inicio?: string }>;
}) {
  const { generar, inicio } = await searchParams;
  // El botón ✨ manda ?generar=<timestamp> (cualquier valor presente cuenta).
  const autoAsk = generar != null;
  const profile = await requireOnboarded();
  const supabase = await createClient();
  // El server corre en UTC y NO conoce la zona horaria del dispositivo, así que
  // "hoy" aquí es un rango (utc ± 1 día) y gana el look_date más reciente —
  // look_date se escribe ya con la fecha LOCAL del cliente (fix del quirk de
  // que el look del día rotaba a las 6pm de CDMX). El residuo aceptado: cerca
  // de medianoche la primera pintura puede traer el look de ayer; el cliente lo
  // corrige en cuanto pide o promueve uno con su fecha real.
  const utcHoy = new Date();
  const fechaUtc = (offsetDias: number) =>
    new Date(utcHoy.getTime() + offsetDias * 86_400_000).toISOString().slice(0, 10);

  // ¿Ya hay look de hoy? Si está listo, lo pasamos. Si se está generando en
  // background, pasamos su id para que el cliente retome el polling (resiliente a
  // que bloquees/cambies de app a media carga).
  const { data: looks } = await supabase
    .from("outfits")
    .select("id, item_ids, title, explanation, tip, tryon_path, favorited_at, gen_status, created_at")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .eq("is_look_of_day", true)
    .gte("look_date", fechaUtc(-1))
    .lte("look_date", fechaUtc(1))
    .order("look_date", { ascending: false })
    .limit(1);
  const look = looks?.[0] ?? null;

  const lookStatus = look ? ((look.gen_status as string | null) ?? "ready") : null;
  const stale =
    !!look && new Date().getTime() - new Date(look.created_at as string).getTime() > 150_000;
  // El look del día sigue generándose (y no murió) → retomar polling en el cliente.
  const pendingOutfitId =
    look && lookStatus === "generating" && !stale ? (look.id as string) : null;

  let lookInicial: HoyOutfit | null = null;
  let votoInicial: "up" | "down" | null = null;

  if (look && lookStatus === "ready") {
    const [{ data: items }, { data: events }] = await Promise.all([
      // Misma resolución de imagen que el clóset: arquetipo, render o foto propia.
      // Antes solo leía attrs.image_path → las prendas fotografiadas (o arquetipos
      // sin ese backfill) salían sin imagen, como un recuadro de color.
      supabase
        .from("items")
        .select(
          "id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)"
        )
        .in("id", look.item_ids as string[]),
      supabase
        .from("events")
        .select("type")
        .eq("user_id", profile.id)
        .eq("outfit_id", look.id)
        .in("type", ["vote_up", "vote_down", "worn"]),
    ]);

    // Fotos propias y renders viven en el bucket privado → URL firmada. Juntamos
    // el try-on del look y los paths de las prendas en una sola petición de firmas.
    const itemPaths = (items ?? [])
      .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
      .filter((p): p is string => !!p);
    const toSign = Array.from(
      new Set([...(look.tryon_path ? [look.tryon_path as string] : []), ...itemPaths])
    );
    const signed = new Map<string, string>();
    if (toSign.length > 0) {
      const { data } = await supabase.storage.from("prendas").createSignedUrls(toSign, 3600);
      data?.forEach((s) => {
        if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
      });
    }

    const byId = new Map(
      (items ?? []).map((i) => {
        const arch = i.archetypes as { name?: string; image_path?: string | null } | null;
        const attrs = (i.attrs ?? {}) as {
          nombre?: string;
          color_hex?: string;
          image_path?: string | null;
        };
        return [
          i.id as string,
          {
            nombre: arch?.name ?? attrs.nombre ?? "Prenda",
            swatch: attrs.color_hex ?? SWATCH_VACIO,
            imagen: itemImageUrlSync(i as ItemImageRow, (p) => signed.get(p)),
          },
        ];
      })
    );

    const tryon: string | null = look.tryon_path
      ? signed.get(look.tryon_path as string) ?? null
      : null;

    lookInicial = {
      id: look.id,
      nombre: look.title ?? "Tu look",
      explicacion: look.explanation,
      tip: look.tip ?? null,
      tryon,
      favorited: !!look.favorited_at,
      prendas: (look.item_ids as string[]).map((id) => {
        const p = byId.get(id);
        return {
          id,
          nombre: p?.nombre ?? "Prenda",
          swatch: p?.swatch ?? SWATCH_VACIO,
          imagen: p?.imagen ?? null,
        };
      }),
    };
    for (const ev of events ?? []) {
      if (ev.type === "vote_up") votoInicial = "up";
      else if (ev.type === "vote_down") votoInicial = "down";
    }
  }

  // ¿Hay un look PLANEADO por estrenar cerca de hoy? Aquí solo se decide si
  // vale la pena que el cliente pregunte (con SU fecha local) — un día de
  // colchón por el desfase UTC/local. Cero costo para quien nunca planea.
  let hayPlaneado = false;
  if (!lookInicial && !pendingOutfitId) {
    const { count } = await supabase
      .from("outfits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      .eq("is_look_of_day", false)
      .eq("gen_status", "ready")
      .gte("planned_for", fechaUtc(-1))
      .lte("planned_for", fechaUtc(1));
    hayPlaneado = (count ?? 0) > 0;
  }

  // Clóset para el picker de ancla del wizard ("¿algo que te quieras poner hoy?"),
  // con las queridas primero (solo orden visual). Compartido con el modo viaje.
  const closet: ClosetPick[] = await loadClosetPicks(supabase, profile.id);

  const nombre = (profile.email ?? "").split("@")[0];

  // Lo que el home del rediseño 2026-08-11 necesita del server, en paralelo:
  // · el viaje a ≤7 días (lo único contextual que quedó — "sin estrenar" murió
  //   y "¿te lo pusiste ayer?" se volvió la invitación al fit check del look),
  // · el último look generado (la card de zona 1 — cubre lo que hacían el CTA
  //   "ver mi look" y los chips de planeados),
  // · las señales del checklist ("qué sigue" no muere porque hoy ya te vestiste).
  // BLINDADAS: las dos cards son un EXTRA de esta pantalla; un throw en
  // cualquiera NO puede tumbar la home. El riesgo es real y no teórico:
  // loadHomeTrip entra a capsuleRows, que recorre `capsule_target.items` y
  // `capsule_match.entries` — dos JSONB escritos por IA a lo largo de varias
  // revisiones del schema. Una fila vieja con la forma cambiada tira un
  // TypeError dentro del Promise.all y deja a esa persona con /hoy en 500
  // permanente, sin camino de regreso. Mismo patrón que lib/engine/taste-signal.
  const seguro = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch {
      return null;
    }
  };
  const [homeTrip, ultimoLook, signals] = await Promise.all([
    seguro(loadHomeTrip(supabase, profile.id)),
    seguro(loadUltimoLook(supabase, profile.id)),
    loadJourneySignals(supabase, profile),
  ]);
  const checklist = buildHomeChecklist({
    hasStyleReference: profile.style_reference != null,
    hasCapsule: signals.hasCapsule,
    siluetaApplies: signals.siluetaApplies,
    hasSilueta: signals.hasSilueta,
  });

  // Hints contextuales (walkthrough just-in-time). UNA burbuja por pantalla.
  const seen = profile.hints_seen ?? {};
  const accountDays =
    (new Date().getTime() - new Date(profile.created_at).getTime()) / 86_400_000;
  // Progressive: el fit check primero (la acción nueva), luego función de valor
  // (fab-generar → hoy-tryon) cuando ya hay look, y viaje al final. UNA por
  // visita — pero es HintChain quien elige: se muestra el primero de la lista
  // que encuentre su target, no el primero a secas. Antes, un tip que había
  // perdido su target se quedaba con el turno para siempre (y sin marcarse
  // visto), enterrando a los de abajo.
  const candidatos: HintCandidato[] = [];
  if (!seen["hoy-fitcheck"]) {
    candidatos.push({
      id: "hoy-fitcheck",
      // v3 (handoff design_handoff_inicio): fuera el tour de tres acciones
      // ("hoy-casa") — el home nuevo se explica solo. UN spotlight a la acción
      // que nadie conoce y más trabaja: el fit check.
      children:
        "enséñame tu outfit de hoy — te digo cómo se ve y me aprendo tu clóset solito",
    });
  }
  if (lookInicial && !seen["fab-generar"]) {
    candidatos.push({
      id: "fab-generar",
      // Sin "hoy": desde 0.2.215 también se planea para otros días.
      children:
        "¿otro plan? tócalo y te armo un look — para hoy o para el día que venga",
    });
  }
  if (lookInicial && !seen["hoy-tryon"]) {
    candidatos.push({
      id: "hoy-tryon",
      children:
        "¿cómo te va a quedar? aquí te lo pruebo puesto en ti, no en una modelo",
    });
  }
  if (accountDays >= 3 && !seen["viaje"]) {
    candidatos.push({
      id: "viaje",
      children:
        "¿viaje pronto? aquí dentro te armo la maleta completa, con el clima de cada parada",
    });
  }

  // El banner (sólo hints ahora) va centrado y angosto en desktop.
  const hasBanner = candidatos.length > 0;

  // El puente con el quiz de estilo de vida: allá describió la FORMA de su
  // semana ("oficina creativa o casual"), aquí se le pide el REGISTRO de su
  // ropa. Sin decirlo, la segunda pregunta se siente repetida.
  const life = (profile.lifestyle ?? {}) as Record<string, string>;
  const qTrabajo = ASSESSMENT_QUESTIONS.find((x) => x.id === "trabajo");
  const desdeElQuiz =
    (life.trabajo ?? "")
      .split(",")
      .map((v) => qTrabajo?.options.find((o) => o.value === v)?.label.toLowerCase())
      .filter(Boolean)
      .join(" / ") || null;

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-4 pt-4">
        {hasBanner ? (
          <div className="flex flex-col gap-4 lg:mx-auto lg:w-full lg:max-w-2xl">
            <HintChain candidatos={candidatos} />
          </div>
        ) : null}
        <HoyClient
          verInicio={inicio === "1"}
          hayPlaneado={hayPlaneado}
          key={`${nombre}:${generar ?? "view"}`}
          lookInicial={lookInicial}
          pendingOutfitId={pendingOutfitId}
          votoInicial={votoInicial}
          userId={profile.id}
          defaultObjective={profile.last_objective}
          gender={(profile.gender as "hombre" | "mujer" | null) ?? null}
          workDressCode={(profile.work_dress_code as string | null) ?? null}
          desdeElQuiz={desdeElQuiz}
          closet={closet}
          autoAsk={autoAsk}
          homeTrip={homeTrip}
          ultimoLook={ultimoLook}
          checklist={checklist}
        />
      </section>
    </AppShell>
  );
}
