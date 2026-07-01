import type { Weather } from "@/lib/weather";
import { SEASONS, seasonPalette, normSeason, type Season } from "@/lib/colorimetria";
import { OBJECTIVES, type Objective } from "@/app/onboarding/objetivo/objectives";
import {
  type TasteSignal,
  type RememberedOutfit,
  hasTasteSignal,
} from "@/lib/engine/taste-signal";

// Cada outfit guarda la versión del prompt que lo generó (medir si los
// cambios mejoran el ratio de 👍). Súbela cuando cambies el prompt.
// v2 (2026-06-13): reglas de colorimetría (near-face) y de gustos.
// v3 (2026-06-14): paleta no binaria (base + prestados) + lista EVITA dura.
// v4 (2026-06-16): hex de cada prenda + sección de armonía de color/proporción
// en la 1ª pasada, y crítico de styling gender-aware como 2ª pasada.
// v5 (2026-06-16): regla dura marino+negro en formal; ocasión por generación.
// v6 (2026-06-16): se revierte la regla marino+negro (era mito; ver research) —
// marino y negro SÍ combinan, incluso formal. Solo queda como nota de ejecución.
// v7 (2026-06-16): regla anti "traje desparejado" (saco + pantalón del mismo tono
// que no son un traje real) en generador y juez. Justificada por el único 👎 del
// flywheel ("Blanco que ilumina": blazer marino + chinos marino idéntico #27425F).
// v8 (2026-06-16): el juez emite veredicto (ok/reparado/rechazado + razón). En
// rechazo (irreparable con el clóset) el wow descarta el look si quedan ≥2; el
// evento critic_review loggea verdict/razon/rejected — instrumentación para
// decidir si #4b (regenerar) vale. NO regenera todavía (regenerated:0).
// v9 (2026-06-16): el compositor de Hoy pasa un "plan" de texto libre opcional
// ("¿algo en mente?") que entra al contexto para afinar el look a ese plan.
// v10 (2026-06-17): contexto de vida (assessment de cápsula) — el motor sabe en
// qué trabaja, qué hace y cómo le gusta vestir, para aterrizar el look a su vida.
// v11 (2026-06-18): vetos de estilo (issue #2) — la persona declara hard NOs
// (prendas/colores/detalles que jamás quiere). Entran como REGLA DURA; las
// prendas/colores ya vienen pre-filtradas del clóset (applyVetoes), esto cubre
// los detalles y el texto libre. El juez también los rechaza.
// v12 (2026-06-18): momento del día (día/noche) — señal del compositor para
// afinar el look (de noche, más oscuro y arreglado). Se cortó el selector de
// fecha: el clima manual ya abstrae lugar/día, no hace falta calendario.
// v13 (2026-06-22): silueta (complexión + dónde carga volumen). Señal SUAVE:
// orientación para desempatar entre looks parejos y enriquecer el porqué, NO
// filtro ni motivo de rechazo. null si la persona no la definió.
// v14 (2026-06-22): "el toque" — el juez suma un tip de styling OPCIONAL por
// outfit (cómo llevarlo: medio-fajado, arremangar, capa abierta…). Restricción
// como principio: movimientos seguros por default, condicional o null si duda.
// v15 (2026-06-23): el tip SOLO puede hablar de prendas que están en el look;
// prohibido inventar/sugerir prendas ausentes (causaba tips tipo "deja la camisa
// de lino abierta" cuando no había camisa). Aplica a Hoy (critic) y Viaje.
// v16 (2026-06-23): "la app aprende" (paso 9) — el feedback real entra al
// contexto: lo que se PUSO (worn), votó 👍/👎 (con su razón) y de qué pidió otro.
// El motor se inclina hacia lo que le gustó y se aleja de lo que rechazó,
// generalizando el patrón (no copia looks). Lo ve el generador y el juez.
// v17 (2026-06-28): ancla opcional en Hoy — la usuaria fija UNA prenda que quiere
// usar hoy (seedItemId). Entra como REGLA DURA: el look DEBE incluirla, el motor
// arma alrededor y el juez nunca la quita (con red de seguridad en código).
// v18 (2026-06-29): formalidad explícita para "evento" (el wizard la pregunta) +
// default mexicano formal en eventos (las bodas mexicanas son más formales que
// el default del modelo; antes sugería looks subvestidos).
// v20: el motor principal (generate) ahora también alimenta el estilo de
// referencia al prompt (antes solo look-of-day lo hacía).
export const PROMPT_VERSION = "v20";

export type EngineItem = {
  id: string;
  attrs: {
    nombre?: string;
    color?: string;
    color_hex?: string;
    image_path?: string | null;
    formalidad?: string;
    temporada?: string;
    tipo?: string;
    largo?: string; // crop/regular/largo — habilita tips de fajar
    corte?: string; // entallado/recto/holgado — habilita tips de proporción
    manga?: string; // sin/corta/larga — habilita tips de arremangar
  };
};

export type EngineContext = {
  objective: string | null;
  plan: string | null; // texto libre opcional del compositor ("¿algo en mente?")
  lifestyle: string | null; // resumen de vida del assessment de cápsula
  tasteTags: string[];
  archetype: { nombre: string; descripcion: string } | null;
  season: Season | null;
  flow: Season | null;
  items: EngineItem[];
  weather: Weather | null;
  recentCombos: string[][]; // item_ids de outfits de los últimos 14 días
  vetoes: string[]; // hard NOs (issue #2): jamás incluir ni sugerir
  timeOfDay: "dia" | "noche" | null; // momento del look (afina día/noche)
  silueta: string | null; // orientación de cuerpo (complexión + dónde carga); señal suave
  tasteSignal: TasteSignal; // "la app aprende" (paso 9): feedback real (worn/votos/skip)
  seedItemId?: string | null; // ancla (Hoy): prenda que la usuaria fijó para hoy — DEBE ir en el look
  formality?: string | null; // solo "evento": casual | semiformal | formal | gala
  styleReference?: string | null; // resumen del "estilo de referencia" (vibe/silueta, NO color)
};

export const SYSTEM_PROMPT = `Eres la stylist personal de stailist: la amiga cool que se viste increíble y le arma looks a su gente con CARIÑO y ojo de experta.

Reglas duras:
- Usa ÚNICAMENTE prendas de la lista del clóset (vienen con id). Jamás menciones prendas que no estén ahí.
- Cada outfit lleva 3 a 5 prendas y debe tener lógica: un top (o vestido), un bottom (salvo con vestido), calzado siempre; un saco/blazer va SOBRE el top cuando la ocasión es formal o de evento (no depende del clima); un abrigo solo si el clima lo pide.
- Devuelve 2 o 3 outfits DISTINTOS entre sí.
- Si te paso combinaciones recientes, no repitas ninguna combinación exacta.

Colorimetría (regla near-face — IMPORTANTE):
- Lo que toca la cara manda: el top y el abrigo deben estar en su paleta (sus mejores o sus prestados) o ser un neutro que la favorezca. Ahí es donde el color le ilumina o le apaga la cara.
- REGLA DURA: jamás pongas cerca de la cara (top o abrigo) un color de su lista de EVITA — esos la apagan. En bottom o calzado no importan.
- El bottom y el calzado tienen más libertad: no necesitan estar en su paleta.
- Si su clóset no tiene un top en su paleta, elige el neutro más favorecedor y compénsalo: arma el resto del look alrededor de sus colores.

Armonía del outfit (cómo combinan las prendas entre sí):
- Ancla en neutros: máximo 1-2 colores protagonistas por look; el resto neutros (negro, blanco, gris, beige, marino, camel). Tres saturados juntos casi nunca funcionan.
- Usa los hex para juzgar el color real: si hay un color fuerte, acompáñalo de neutros; evita dos saturados que compitan o tonos que se enloden juntos.
- Proporción: equilibra el volumen — si arriba es holgado/oversize, abajo algo más entallado (y al revés). Evita "todo holgado" o "todo pegado".
- Coherencia: no mezcles formalidades opuestas (sastre formal con deportivo) salvo que su vibe lo pida a propósito.
- Marino + negro SÍ combinan (dos fríos que contrastan sin chocar), incluso en formal — un traje marino con zapatos o cinturón negros es clásico. Solo cuida que se vea intencional (mismo peso de tela, calzado oscuro), no como traje desparejado.
- Cuidado con el "traje desparejado": un saco/blazer junto a un pantalón del MISMO color y tono (marino con marino, gris con gris, negro con negro) parece un traje que no combina entre sí — el ojo espera que sean un conjunto y nota que no lo son. Solo úsalos juntos si DE VERDAD son un traje (misma tela). Si no, rompe el match: pon el bottom en otro neutro (gris, beige, caqui, denim) para que el saco se lea como pieza intencional, no como mitad de un traje suelto.

Gustos (su vibe, de los swipes):
- Cuando haya varias combinaciones válidas, ELIGE la que más empate con su vibe (ej. si es minimalista, evita mezclar demasiados elementos; si es clásico, prioriza siluetas atemporales).
- El vibe define el balance y la actitud del look, no qué prenda es válida.

La explicación (una línea por outfit):
- Voz cálida, directa, de tuteo. Cero jerga técnica de moda.
- Di POR QUÉ le favorece, idealmente conectando con sus colores ("el azul te ilumina la cara") o su plan del día.
- Ejemplos del tono: "los tonos tierra te encienden la cara", "cómodo pero con intención — nadie sabrá que te tomó 2 minutos".
- PROHIBIDO: "estación otoño profundo", "paleta cromática", "silueta versátil" y cualquier frase de revista técnica.`;

// Una prenda como línea: incluye el hex para que el modelo juzgue el color real.
export function describeItem(item: EngineItem): string {
  const a = item.attrs;
  const color =
    a.color && a.color_hex
      ? `${a.color} ${a.color_hex}`
      : a.color_hex ?? a.color;
  // Atributos de styling (si los hay): habilitan tips de "cómo llevarlo".
  const extras = [
    a.corte ? `corte ${a.corte}` : null,
    a.largo ? `largo ${a.largo}` : null,
    a.manga ? `manga ${a.manga}` : null,
  ].filter(Boolean);
  return [a.nombre ?? a.tipo, color, a.formalidad, a.temporada, ...extras]
    .filter(Boolean)
    .join(" · ");
}

// Contexto de la clienta (ocasión, colorimetría, estilo, gustos, clima).
// Compartido por el generador (1ª pasada) y el crítico (2ª pasada).
export function contextBlock(ctx: EngineContext): string[] {
  const lines: string[] = [];

  const objectiveLabel =
    ctx.objective && ctx.objective in OBJECTIVES
      ? OBJECTIVES[ctx.objective as Objective]
      : "Día a día";
  lines.push(`Ocasión: ${objectiveLabel}.`);
  if (ctx.lifestyle) {
    lines.push(ctx.lifestyle);
  }
  if (ctx.plan?.trim()) {
    lines.push(`Tiene en mente: "${ctx.plan.trim()}" — afina el look a ese plan.`);
  }
  if (ctx.seedItemId) {
    const seed = ctx.items.find((i) => i.id === ctx.seedItemId);
    if (seed) {
      lines.push(
        `ANCLA (REGLA DURA): hoy QUIERE usar esta prenda → ${seed.id}: ${describeItem(seed)}. El look DEBE incluirla; arma el resto alrededor respetando clima, colorimetría y ocasión. Si choca con el clima, inclúyela igual y compénsala con el resto. Jamás la quites ni la sustituyas.`
      );
    }
  }
  if (ctx.timeOfDay === "noche") {
    lines.push(
      "Momento: de noche — favorece tonos más oscuros y un punto más arreglado."
    );
  } else if (ctx.timeOfDay === "dia") {
    lines.push("Momento: de día.");
  }

  // Formalidad del evento (el wizard la pregunta para "evento") + default
  // mexicano: las bodas/eventos formales en México son más arreglados que el
  // default del modelo; ante la duda, subir nivel, no bajarlo.
  const FORMALITY_LABELS: Record<string, string> = {
    casual: "casual (relajado pero cuidado)",
    semiformal: "semiformal (coctel / business elevado)",
    formal: "formal",
    gala: "de gala / etiqueta (lo más arreglado)",
  };
  if (ctx.formality && FORMALITY_LABELS[ctx.formality]) {
    lines.push(
      `Formalidad del evento: ${FORMALITY_LABELS[ctx.formality]} — RESPÉTALA, no te quedes corto (subvestir un evento se siente fuera de lugar). Contexto México: los eventos formales y las bodas son más arreglados que el promedio; ante la duda, sube medio nivel, nunca lo bajes.`
    );
  } else if (ctx.objective === "evento") {
    lines.push(
      "Es un evento: en México tienden a ser más formales que el promedio (sobre todo bodas). Ante la duda, arréglalo más, no menos."
    );
  }

  // normSeason rescata data legacy con mayúscula ("Invierno"): así el guiño no se
  // pierde ni en los colores prestados ni en el label.
  const seasonKey = normSeason(ctx.season);
  const s = seasonKey ? SEASONS[seasonKey] : null;
  if (s && seasonKey) {
    const { mejores, prestados, evita } = seasonPalette(seasonKey, ctx.flow);
    const favs = [...mejores, ...prestados].map((c) => c.nombre).join(", ");
    const avoid = evita.map((c) => c.nombre).join(", ");
    const flowKey = normSeason(ctx.flow);
    const flowSeason = flowKey ? SEASONS[flowKey] : null;
    const flowLabel = flowSeason ? ` (con flow a ${flowSeason.label})` : "";
    lines.push(
      `Su colorimetría: paleta tipo ${s.label}${flowLabel}. Le favorecen cerca de la cara: ${favs}. EVITA cerca de la cara (la apagan): ${avoid}.`
    );
  }

  if (ctx.archetype) {
    lines.push(
      `Su estilo: "${ctx.archetype.nombre}" — ${ctx.archetype.descripcion}`
    );
  }
  if (ctx.tasteTags.length > 0) {
    lines.push(`Tags de gusto: ${ctx.tasteTags.join(", ")}.`);
  }
  if (ctx.styleReference) {
    lines.push(
      `Estilo de referencia que le encanta (inspira el VIBE y las siluetas, NO los colores — la colorimetría de arriba manda el color): ${ctx.styleReference}. Empuja los looks hacia ese aire sin copiarlo al pie de la letra.`
    );
  }
  if (ctx.silueta) {
    lines.push(
      `Su cuerpo (orientación de styling, NO regla ni motivo de rechazo): ${ctx.silueta}. Úsalo solo para desempatar entre looks parejos y para enriquecer el porqué cuando el look de verdad la equilibre — sin que domine sobre el clima, su colorimetría, la ocasión o sus gustos, y sin forzarlo en cada explicación.`
    );
  }
  if (ctx.weather) {
    lines.push(`Clima de hoy: ${ctx.weather.temp_c}°C, ${ctx.weather.condition}.`);
  }

  if (ctx.vetoes.length > 0) {
    lines.push(
      `REGLA DURA — VETOS: la persona NUNCA quiere y jamás debes incluir ni sugerir: ${ctx.vetoes.join(
        ", "
      )}. En ninguna prenda, ni cerca de la cara ni en ningún lado, en ningún look. Es una regla absoluta.`
    );
  }

  lines.push(...tasteSignalLines(ctx.tasteSignal));

  return lines;
}

// "La app aprende": traduce el feedback real a guía para el motor. Señal SUAVE
// (orienta, no es regla dura ni motivo de rechazo): inclínate hacia lo que se
// puso y le gustó, aléjate de lo que rechazó, aprendiendo el patrón sin copiar.
function tasteSignalLines(s: TasteSignal): string[] {
  if (!hasTasteSignal(s)) return [];
  const fmt = (o: RememberedOutfit): string => {
    const prendas = o.items.length > 0 ? o.items.join(", ") : o.title ?? "un look";
    const name = o.title && o.items.length > 0 ? `"${o.title}": ` : "";
    const oc = o.occasion ? ` (ocasión: ${o.occasion})` : "";
    const why = o.reason ? ` — dijo: "${o.reason}"` : "";
    return `${name}${prendas}${oc}${why}`;
  };
  const lines: string[] = [
    "Lo que ya aprendiste de su gusto (de looks que le mostraste antes — orienta el estilo, NO es regla dura ni para copiar exacto):",
  ];
  for (const o of s.worn) {
    lines.push(`- SE LO PUSO de verdad (lo que MÁS le gusta — busca este tipo de combinación): ${fmt(o)}`);
  }
  for (const o of s.liked) lines.push(`- Le gustó (👍): ${fmt(o)}`);
  for (const o of s.disliked) {
    lines.push(`- Lo RECHAZÓ (no repitas este patrón): ${fmt(o)}`);
  }
  for (const o of s.skipped) lines.push(`- Pidió otro en vez de este: ${fmt(o)}`);
  lines.push(
    "Inclínate hacia lo que se puso y le gustó; aléjate de lo que rechazó. Aprende el patrón (colores, formalidad, siluetas, qué combina con qué) — NO copies un look exacto."
  );
  return lines;
}

// El clóset como bloque (ids + descripción con hex).
export function closetBlock(items: EngineItem[]): string[] {
  const lines = ["Su clóset (usa SOLO estos ids):"];
  for (const item of items) {
    lines.push(`- ${item.id}: ${describeItem(item)}`);
  }
  return lines;
}

export function buildUserMessage(ctx: EngineContext): string {
  const lines: string[] = [...contextBlock(ctx), "", ...closetBlock(ctx.items)];

  if (ctx.recentCombos.length > 0) {
    lines.push("", "Combinaciones recientes (NO las repitas exactas):");
    for (const combo of ctx.recentCombos) {
      lines.push(`- ${combo.join(" + ")}`);
    }
  }

  lines.push("", "Ármale 2-3 outfits.");
  return lines.join("\n");
}
