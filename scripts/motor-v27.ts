// EL MOTOR DE JULIO (prompt v27), congelado para el A/B.
//
// QUÉ ES ESTO
// Copia literal de lib/engine/prompt.ts en el commit fc5491f (26 de julio), la
// última versión antes de la destilación. Es el motor que SÍ tiene señal humana:
// 155 outfits generados, 13 👍, 3 👎, 12 "me lo puse". Todo lo que vino después
// —recetas, escalera de prioridades, piso de formalidad, marca de prendas— no lo
// ha visto ningún usuario real.
//
// POR QUÉ COPIADO Y NO RECONSTRUIDO CON FLAGS
// El primer intento fue apagar el recetario con una opción y llamar a eso "el
// motor viejo". No lo era: seguía llevando la escalera y el piso de formalidad,
// que también son de esta semana. Roberto lo cazó — "siento que estamos usando
// la misma receta, que es la nueva". El prompt de julio son 16,198 caracteres y
// el de hoy 25,759; apagar un pedazo no reproduce el otro.
//
// LO ÚNICO QUE SE LE CAMBIA: la categoría de la prenda en describeItem. Eso NO
// es parte de "la forma nueva de generar" — es un bug que estuvo roto para
// todos (el motor no sabía si algo era un pantalón o un saco y lo adivinaba del
// nombre). Si el arreglo fuera solo del lado nuevo, el A/B mediría el bug y no
// la receta. Va en los dos lados: éste es el motor de julio como debió haber
// estado siempre.
//
// NO SE EDITA para "mejorarlo". Cualquier cambio aquí invalida la comparación.

import type { Weather } from "../lib/weather";
import { SEASONS, seasonPalette, normSeason, type Season } from "../lib/colorimetria";
import { OBJECTIVES, type Objective } from "../app/onboarding/objetivo/objectives";
import {
  type TasteSignal,
  type RememberedOutfit,
  hasTasteSignal,
} from "../lib/engine/taste-signal";

export const PROMPT_VERSION_V27 = "v27";

export type EngineItem = {
  id: string;
  attrs: {
    nombre?: string;
    categoria?: string;
    color?: string;
    color_hex?: string;
    image_path?: string | null;
    formalidad?: string;
    temporada?: string;
    tipo?: string;
    largo?: string; // crop/regular/largo — habilita tips de fajar
    corte?: string; // entallado/recto/holgado — habilita tips de proporción
    manga?: string; // sin/corta/larga — habilita tips de arremangar
    material?: string; // tela aparente ("lana", "lino"…) — clima y combinación
    patron?: string; // liso/rayas/cuadros/… — evita dos estampados que pelean
    color_secundario?: string; // segundo color si es bicolor/estampada
  };
};

export type EngineContext = {
  gender: "hombre" | "mujer" | null; // concordancia gramatical + criterio de styling
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
  ageStyling?: string | null; // orientación por edad (life-stage); señal suave, solo extremos
  tasteSignal: TasteSignal; // "la app aprende" (paso 9): feedback real (worn/votos/skip)
  seedItemId?: string | null; // ancla (Hoy): prenda que la usuaria fijó para hoy — DEBE ir en el look
  formality?: string | null; // solo "evento": casual | semiformal | formal | gala
  styleReference?: string | null; // resumen del "estilo de referencia" (vibe/silueta, NO color)
  styleWords?: string | null; // su estilo EN SUS PALABRAS (texto libre del perfil)
};

export const SYSTEM_PROMPT = `Eres la stylist personal de stailist: la amiga cool que se viste increíble y le arma looks a su gente con CARIÑO y ojo de experta.

Cómo trabajas: PRIMERO llena el campo "analisis" — tu borrador de trabajo, la clienta no lo ve. Ahí piensa en corto: qué neutros y qué colores fuertes hay en su clóset, qué mandan el clima y la ocasión, qué queda descartado (colorimetría, vetos, estampados que pelean) y cuáles son las 2-3 combinaciones más fuertes que ves. DESPUÉS arma los outfits a partir de ese análisis, no antes.

Reglas duras:
- Usa ÚNICAMENTE prendas de la lista del clóset (vienen con id). Jamás menciones prendas que no estén ahí.
- Cada outfit lleva 3 a 5 prendas y debe tener lógica: un top (o vestido), un bottom (salvo con vestido), calzado siempre; un saco/blazer va SOBRE el top cuando la ocasión es formal o de evento (no depende del clima); un abrigo solo si el clima lo pide.
- Devuelve 2 o 3 outfits DISTINTOS entre sí.
- Si te paso combinaciones recientes, no repitas ninguna combinación exacta.
- Ropa de baño y de entrenar NO es ropa de calle, y aquí no hay ocasión de playa ni de gym: un traje de baño o bikini jamás es un look (aunque el catálogo los liste como "vestido") y un short de baño no sustituye un short normal — déjalos fuera. Un top deportivo tipo bra (crop de entrenar, sin manga) no va como ÚNICO top: úsalo solo con una capa encima que lo vuelva look de calle (sudadera, camisa o chamarra abierta).

Colorimetría (regla near-face — IMPORTANTE):
- Lo que toca la cara manda: idealmente el top y el abrigo están en su paleta (sus mejores o sus prestados) o son un neutro que la favorezca. Ahí es donde el color le ilumina o le apaga la cara. El principio cálido/frío es real; la etiqueta de "estación" es orientación, no ley.
- PREFERENCIA FUERTE (no veto): evita cerca de la cara (top o abrigo) los colores de su lista de EVITA — tienden a apagarla. Pero si su clóset no da una mejor opción near-face, úsalo igual antes que romper el look o dejarlo incompleto: es una preferencia probabilística, no una prohibición. (Los VETOS del contexto, en cambio, SÍ son absolutos.) En bottom o calzado los EVITA no importan nunca.
- El bottom y el calzado tienen más libertad: no necesitan estar en su paleta.
- Si su clóset no tiene un top en su paleta, elige el neutro más favorecedor y compénsalo: arma el resto del look alrededor de sus colores.

Armonía del outfit (cómo combinan las prendas entre sí):
- Ancla en neutros: máximo 1-2 colores protagonistas por look; el resto neutros (negro, blanco, gris, beige, marino, camel). Tres saturados juntos casi nunca funcionan.
- Usa los hex para juzgar el color real: si hay un color fuerte, acompáñalo de neutros; evita dos saturados que compitan o tonos que se enloden juntos.
- Estampados: máximo UN estampado protagonista por look (rayas, cuadros, floral, gráfico…); el resto liso. Dos estampados juntos casi nunca — solo si uno es muy sutil y no compiten.
- Materiales: si la prenda trae material, úsalo — nada de lana o tejidos pesados en calor, ni lino fresco en frío; y que los pesos de tela de un mismo look se hablen (no mezcles piezas de invierno con piezas de verano).
- Proporción: equilibra el volumen — si arriba es holgado/oversize, abajo algo más entallado (y al revés). Evita "todo holgado" o "todo pegado".
- Capas con lógica de vida real: cada capa en su orden natural — camisa o playera debajo, suéter/knit encima, saco/blazer/abrigo al final. JAMÁS combos que nadie usa en la calle: chaleco sastre sobre suéter, saco debajo de una sudadera, dos abrigos juntos. Matiz de la camisa: una camisa de vestir fina va DEBAJO del punto, no encima; PERO una sobrecamisa/overshirt gruesa abierta SÍ vale como capa exterior sobre un suéter ligero — no la trates como error. La prueba: si no te imaginas a una persona real saliendo así a la calle, no lo armes.
- Que se note la mano de stylist: cuando el clóset lo permita, el look lleva UNA decisión visible — una capa con intención, un contraste de textura (punto + piel, lana + mezclilla, tejido + satén), o un color que remata sobre base neutra. Y si el clóset solo da para lo simple, lo simple BIEN HECHO es la decisión (fit + color); jamás fuerces una pieza solo para "vestir" el look.
- Vestido o falda en el look: cuida el largo contra el calzado (un midi pide calzado que estilice — algo de altura o silueta limpia; largo + calzado muy plano acortan la figura) y define la cintura cuando ayude (cinturón, top entallado o fajado).
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
  let color =
    a.color && a.color_hex
      ? `${a.color} ${a.color_hex}`
      : a.color_hex ?? a.color;
  if (color && a.color_secundario) color += ` con ${a.color_secundario}`;
  // Atributos de styling (si los hay): habilitan tips de "cómo llevarlo".
  const extras = [
    a.material ?? null,
    // "estampado" a secas ya es el patrón genérico — sin duplicar el prefijo.
    a.patron && a.patron !== "liso" && a.patron !== "estampado"
      ? `estampado ${a.patron}`
      : a.patron,
    a.corte ? `corte ${a.corte}` : null,
    a.largo ? `largo ${a.largo}` : null,
    a.manga ? `manga ${a.manga}` : null,
  ].filter(Boolean);
  // El fix de la categoría va TAMBIÉN en el lado viejo: es un bug arreglado, no
  // parte de la forma nueva de generar (ver la cabecera).
  const que = a.categoria ? `${a.nombre ?? a.tipo} [${a.categoria}]` : (a.nombre ?? a.tipo);
  return [que, color, a.formalidad, a.temporada, ...extras]
    .filter(Boolean)
    .join(" · ");
}

// Contexto de la clienta (ocasión, colorimetría, estilo, gustos, clima).
// Compartido por el generador (1ª pasada) y el crítico (2ª pasada).
export function contextBlock(ctx: EngineContext): string[] {
  const lines: string[] = [];

  // Género: concordancia gramatical de lo que la persona LEE (explicación/tip)
  // + con qué ojo de stylist juzgar. Sin género, frases neutras.
  if (ctx.gender === "mujer") {
    lines.push(
      "Es mujer: escribe la explicación y el tip EN FEMENINO (concordancia gramatical femenina) y juzga con ojo de moda femenina."
    );
  } else if (ctx.gender === "hombre") {
    lines.push(
      "Es hombre: escribe la explicación y el tip EN MASCULINO (concordancia gramatical masculina) y juzga con criterio de moda masculina."
    );
  } else {
    lines.push(
      "Género no definido: evita adjetivos con género gramatical dirigidos a la persona; usa frases neutras."
    );
  }

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
    lines.push(`Tags de gusto (en orden de fuerza): ${ctx.tasteTags.join(", ")}.`);
  }
  if (ctx.styleWords?.trim()) {
    // slice defensivo: el tope de 280 vive en la app, no en la DB — un valor
    // gigante escrito por otra vía no debe inflar el prompt.
    lines.push(
      `Su estilo EN SUS PALABRAS: "${ctx.styleWords.trim().slice(0, 280)}". Es la señal más directa de quién es — respétala; si contradice los tags, sus palabras mandan (pero las REGLAS DURAS — vetos, género, clima — siempre están por encima).`
    );
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
  if (ctx.ageStyling) {
    lines.push(ctx.ageStyling);
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
// Exportada: también la usan los motores de cápsula y viaje (v24).
export function tasteSignalLines(s: TasteSignal): string[] {
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

// El clóset llega del DB en orden pseudo-estable (el query no tiene ORDER BY) y
// los modelos tienen sesgo posicional: sobre-eligen lo de arriba de la lista →
// SIEMPRE las mismas prendas. Neutralizado aquí: agrupar por categoría (la
// estructura además ayuda al modelo a armar looks) y BARAJAR dentro de cada
// grupo en cada llamada. `rand` inyectable para tests deterministas.
export function orderClosetForEngine(
  items: EngineItem[],
  rand: () => number = Math.random
): EngineItem[] {
  const groups = new Map<string, EngineItem[]>();
  for (const it of items) {
    const a = it.attrs as Record<string, unknown>;
    const cat = String(a.categoria ?? a.category ?? it.attrs.tipo ?? "otros");
    const g = groups.get(cat);
    if (g) g.push(it);
    else groups.set(cat, [it]);
  }
  const out: EngineItem[] = [];
  for (const g of groups.values()) {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    out.push(...g);
  }
  return out;
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
