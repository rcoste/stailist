import type { SupabaseClient } from "@supabase/supabase-js";
import {
  orderClosetForEngine,
  type EngineContext,
  type EngineItem,
} from "@/lib/engine/prompt";
import type { Weather } from "@/lib/weather";
import type { Season } from "@/lib/colorimetria";
import { lifestyleSummary, type LifestyleAnswers } from "@/lib/capsule";
import { applyVetoes, vetoLabels, EMPTY_VETOES, type StyleVetoes } from "@/lib/vetoes";
import { siluetaPromptLine, type Build, type Volume } from "@/lib/silueta";
import { ageStylingLine, type AgeRange } from "@/lib/edad";
import { loadTasteSignal, type TasteSignal } from "@/lib/engine/taste-signal";
import {
  ITEM_IMAGE_SELECT,
  conCategoria,
  type ItemImageRow,
} from "@/lib/item-image";
import { styleReferenceForEngine } from "@/lib/estilo-referencia";

// La construcción del contexto del motor, EN UN SOLO LUGAR.
//
// POR QUÉ EXISTE ESTE ARCHIVO
// Vivía copiada en dos rutas (/api/generate y /api/look-of-day) y estaba a
// punto de copiarse una tercera vez para el comparador de motores. Los tres
// bugs de arnés del 5 de agosto salieron exactamente de esto: código que
// IMITABA al motor en vez de llamarlo (un barajeo distinto, la cuenta
// equivocada, el historial vacío). Y las dos copias de producción ya habían
// derivado en silencio: /api/generate pasaba fitPref y look-of-day no;
// look-of-day filtraba los placeholders del historial y /api/generate no.
// Ninguna de las dos derivas tronaba nada — solo generaban looks distintos
// según la pantalla, sin que nadie lo supiera.
//
// QUÉ NO VIVE AQUÍ, a propósito:
// - Resolver la ocasión (request válido o last_objective) y ESCRIBIRLA en el
//   perfil: es un side effect de producción; el comparador no debe moverle el
//   last_objective a nadie por correr un experimento.
// - Resolver el clima (geolocalización): producción lo saca del request; el
//   comparador lo FIJA por brief. Aquí solo se recibe ya resuelto.

/** La fila de profiles tal como llega de `select("*")`, sin fingir más tipo del que hay. */
export type PerfilMotor = Record<string, unknown>;

export type BaseDelMotor = {
  profile: PerfilMotor;
  /** El clóset que el motor puede usar: categoría resuelta, vetos ya aplicados. */
  items: EngineItem[];
  /** El clóset SIN vetos: para re-inyectar un ancla que la persona fijó a propósito. */
  allItems: EngineItem[];
  recentCombos: string[][];
  tasteSignal: TasteSignal;
};

/**
 * Carga todo lo que el motor necesita saber de una persona. Devuelve
 * `closet_vacio` si no hay perfil o quedan menos de 3 prendas tras los vetos
 * (vetar hacia un clóset corto cae al estado de "insuficiente", no a un look
 * malo).
 */
export async function cargarBaseDelMotor(
  supabase: SupabaseClient,
  userId: string
): Promise<{ base: BaseDelMotor } | { error: "closet_vacio" }> {
  const [profileRes, itemsRes, recentRes, tasteSignal] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("items")
      // ITEM_IMAGE_SELECT y no solo "attrs": attrs.image_path SOLO existe en
      // las prendas del catálogo. Una foto propia guarda su imagen en
      // render_path/photo_path (bucket privado), así que leyendo attrs a secas
      // salían SIN imagen — 252 de las 272 fotos propias de la base.
      .select(`id, ${ITEM_IMAGE_SELECT}`)
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("outfits")
      .select("item_ids")
      .eq("user_id", userId)
      // Un look borrado no debe seguir restringiendo lo que te armo.
      .is("deleted_at", null)
      // Solo los looks DIARIOS restringen al motor diario. Los del viaje y los
      // de la cápsula viven en outfits para el try-on/favorito, pero son otro
      // contexto: 15 looks de cápsula dejarían al motor de Hoy sin qué armar.
      .eq("source", "daily")
      // Solo combos COMPLETOS (legacy null o 'ready'); nunca placeholders.
      .or("gen_status.is.null,gen_status.eq.ready")
      .gte(
        "created_at",
        new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
      ),
    loadTasteSignal(supabase, userId),
  ]);

  const profile = profileRes.data as PerfilMotor | null;
  if (!profile) return { error: "closet_vacio" };

  const allItems = conCategoria(
    (itemsRes.data ?? []) as unknown as ItemImageRow[]
  ) as unknown as EngineItem[];
  // Vetos (issue #2): quita las prendas vetadas ANTES del check de mínimo.
  const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;
  const { items } = applyVetoes(allItems, vetoes);
  if (items.length < 3) return { error: "closet_vacio" };

  return {
    base: {
      profile,
      items,
      allItems,
      recentCombos: (recentRes.data ?? []).map((o) => o.item_ids as string[]),
      tasteSignal,
    },
  };
}

/**
 * Resuelve la ocasión de una petición de producción Y la persiste como
 * last_objective. Compartida por /api/generate y el look de hoy — vivía
 * copiada carácter por carácter en las dos rutas, el mismo patrón de deriva
 * que este archivo existe para matar. El comparador NO la usa: fijar la
 * ocasión de un brief no debe moverle el last_objective a nadie.
 */
export async function resolverYPersistirObjetivo(
  supabase: SupabaseClient,
  profile: PerfilMotor,
  bodyObjective: unknown,
  userId: string,
  objetivosValidos: Record<string, string>
): Promise<string | null> {
  const lastObjective = profile.last_objective as string | null;
  const objective =
    typeof bodyObjective === "string" && bodyObjective in objetivosValidos
      ? bodyObjective
      : lastObjective;
  if (objective && objective !== lastObjective) {
    await supabase
      .from("profiles")
      .update({ last_objective: objective })
      .eq("id", userId);
  }
  return objective;
}

/** Lo que cambia por petición (o por brief, en el comparador). */
export type PeticionDeLook = {
  /** Ya resuelta por quien llama (request válido o last_objective). */
  objective: string | null;
  plan?: string | null;
  /** QUÉ evento es, del catálogo (lib/eventos.ts). */
  tipoEvento?: string | null;
  /** Cualquier cosa que no sea "dia"/"noche" cae a null. */
  momento?: string | null;
  weather: Weather | null;
  /** Va a llevar paraguas. Solo se pregunta cuando el clima trae lluvia. */
  paraguas?: boolean;
  /** Solo si su código de trabajo es "variable": si HOY ve cliente. */
  veCliente?: boolean | null;
  seedItemId?: string | null;
  formality?: string | null;
};

/** Tope del plan escrito a mano que ve el motor.
 *
 *  Exportado y con nombre porque hay DOS consumidores que tienen que coincidir:
 *  el contexto (lo que el modelo lee) y la columna `outfits.plan` (lo que se
 *  guarda). Si los dos números se separan, la tabla deja de reflejar lo que el
 *  modelo vio — y esa tabla existe justamente para calibrar el prompt contra
 *  planes reales. */
export const PLAN_MAX_CHARS = 200;

/** El plan tal como lo ve el motor: recortado, o null si no hay texto. */
export function recortarPlan(plan: unknown): string | null {
  return typeof plan === "string" ? plan.slice(0, PLAN_MAX_CHARS) : null;
}

/**
 * Arma el EngineContext. Baraja el clóset EN CADA llamada (orderClosetForEngine,
 * anti sesgo posicional): dos llamadas con la misma base ven órdenes distintos,
 * igual que producción — un arnés que barajara una sola vez mediría otra cosa.
 */
export function construirContexto(
  base: BaseDelMotor,
  p: PeticionDeLook
): EngineContext {
  const { profile } = base;
  const vetoes = (profile.style_vetoes as StyleVetoes | null) ?? EMPTY_VETOES;

  // Ancla (Hoy): la prenda fijada debe estar disponible para el motor aunque
  // esté vetada o de otra temporada — es elección explícita de la usuaria. Si
  // ya no existe (borrada), cae a sin-ancla.
  const items = [...base.items];
  let seedItemId = typeof p.seedItemId === "string" ? p.seedItemId : null;
  if (seedItemId && !items.some((i) => i.id === seedItemId)) {
    const original = base.allItems.find((i) => i.id === seedItemId);
    if (original) items.push(original);
    else seedItemId = null;
  }

  return {
    gender: profile.gender as "hombre" | "mujer" | null,
    objective: p.objective,
    plan: recortarPlan(p.plan),
    tipoEvento: typeof p.tipoEvento === "string" ? p.tipoEvento : null,
    lifestyle: lifestyleSummary(profile.lifestyle as LifestyleAnswers | null),
    tasteTags: (profile.taste_tags ?? []) as string[],
    archetype:
      (profile.style_archetype as {
        nombre: string;
        descripcion: string;
      } | null) ?? null,
    season: profile.palette_season as Season | null,
    flow: profile.palette_flow as Season | null,
    items: orderClosetForEngine(items),
    weather: p.weather,
    paraguas: p.paraguas === true,
    recentCombos: base.recentCombos,
    vetoes: vetoLabels(vetoes),
    timeOfDay:
      p.momento === "noche" ? "noche" : p.momento === "dia" ? "dia" : null,
    silueta: siluetaPromptLine(
      profile.body_build as Build | null,
      profile.body_volume as Volume | null
    ),
    // Su GUSTO de corte (pares de fotos del onboarding), distinto del cuerpo
    // de arriba. Sin esto, las recetas que delegan en "la preferencia de la
    // persona" quedan apuntando a nada.
    fitPref: (profile.fit_pref as EngineContext["fitPref"]) ?? null,
    ageStyling: ageStylingLine(profile.age_range as AgeRange | null),
    tasteSignal: base.tasteSignal,
    seedItemId,
    formality: typeof p.formality === "string" ? p.formality : null,
    styleReference: styleReferenceForEngine(profile.style_reference),
    styleWords: (profile.style_words as string | null) ?? null,
    // De la PERSONA, no de la petición: dónde trabajas no cambia cada mañana.
    workDressCode: (profile.work_dress_code as string | null) ?? null,
    // Del DÍA, no del perfil: quien eligió "depende del día" está diciendo
    // exactamente eso.
    veCliente: typeof p.veCliente === "boolean" ? p.veCliente : null,
  };
}
