import { CLASSIFY_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import {
  closetSignature,
  type CapsuleMatch,
  type CapsuleTarget,
  type ClosetItemLite,
  type MatchEntry,
} from "@/lib/capsule";

// Una prenda del clóset como línea del prompt del match: color real (con hex),
// más los atributos ricos que distinguen prendas antes idénticas en texto
// (material, patrón, corte, temporada). Omite los vacíos. Pura y testeable;
// espejo de packableDesc del motor de viaje.
export function closetItemLine(c: ClosetItemLite): string {
  let color = c.color_hex ? `${c.color} ${c.color_hex}`.trim() : c.color;
  if (c.color_secundario) color += ` con ${c.color_secundario}`;
  // Solo se muestra un estampado REAL: "liso" es el default asumido y en el
  // match sería ruido en casi toda prenda. "estampado" a secas ya es el patrón
  // genérico — no dupliques el prefijo.
  const patron =
    c.patron && c.patron !== "liso"
      ? c.patron === "estampado"
        ? "estampado"
        : `estampado ${c.patron}`
      : null;
  const detalle = [
    c.category,
    c.formalidad,
    color || null,
    c.material ?? null,
    patron,
    c.corte ? `corte ${c.corte}` : null,
    c.temporada && c.temporada !== "todo-el-año" ? `para ${c.temporada}` : null,
  ].filter(Boolean);
  return `- ${c.nombre} (${detalle.join(", ")})`;
}

// Versión del prompt del match, PARTE de la firma del caché: al afinar las
// reglas, los matches viejos quedan stale y se recalculan en la siguiente
// visita (sin esto, el fix solo llegaría a quien cambie su clóset). OJO: los
// looks de la cápsula usan ESTA MISMA firma (matchSignature), así que subirla
// también los marca viejos — correcto (cambió qué tienes), pero no es gratis:
// el usuario ve el aviso y decide regenerar. No la subas por gusto.
const MATCH_PROMPT_VERSION = "m6";

// CONTEXTO DE USO: hay prendas que NO son ropa de calle y por eso jamás cubren
// una pieza de calle, aunque compartan zona, color y hasta el tipo. Le pasó a
// Roberto: su "Short de baño marino" quedó como que ya tenía el "Short de lino
// marino" de su cápsula — y su conclusión fue "de shorts solo me puso un traje
// de baño". El catálogo no marca contexto (bikini y traje de baño viven como
// categoría 'vestido'), así que esto va por texto y en código, no en el prompt.
// (La biblioteca ya no llama "Short de baño X" a nada — migración 0089 los
// renombró a "Traje de baño X" para no arrancar con la palabra de otra prenda —
// pero el guard sigue reconociendo el nombre viejo: hay prendas descritas a mano
// por usuarios y no las controlamos.)
// Términos INEQUÍVOCOS a propósito: "deportivo" solo no entra (hay relojes
// deportivos y sacos sport), porque un falso hueco es tan malo como un falso
// "ya lo tienes". Exportada para test.
const CLASES_CONTEXTO: [string, RegExp][] = [
  ["bano", /traje de bano|banador|bikini|trikini|de bano|short(s)? de playa/],
  ["dormir", /pijama|piyama|camison|bata de bano|albornoz/],
  ["interior", /calzon|calzoncillo|boxer|brasier|brassiere|sosten|tanga|bralette/],
  ["gym", /gym|gimnasio|entrenamiento|running|para correr|de yoga|sports bra/],
];

// CLASE FINA dentro de "accesorio": la zona no alcanza. Un reloj y unos lentes son
// ambos 'accesorio', así que el guard de zona los daba por intercambiables — le
// pasó a Roberto: "Reloj de acero con detalles en oro" emparejado con "Lentes
// redondos". El prompt YA pide distinguirlos y el modelo se lo saltó; esto lo
// blinda en código, que es donde no se olvida. Exportada para test.
const CLASES_ACCESORIO: [string, RegExp][] = [
  ["reloj", /reloj/],
  ["lentes", /lentes|gafas|anteojos/],
  ["cinturon", /cinturon/],
  ["bufanda", /bufanda|pashmina|mascada|panuelo/],
  ["sombrero", /gorra|sombrero|boina|beanie|gorro/],
  ["bolsa", /bolsa|bolso|cartera|mochila|morral|maletin|bandolera|tote/],
  ["joyeria", /collar|arete|anillo|pulsera|brazalete|joyer|cadena/],
  ["corbata", /corbata|pajarita/],
  ["calcetin", /calcet|medias/],
  ["guantes", /guante/],
];
const normaliza = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** null = clase desconocida → no bloquea (mejor dejar pasar que falsear un hueco). */
export function claseAccesorio(texto: string): string | null {
  const n = normaliza(texto);
  for (const [clase, re] of CLASES_ACCESORIO) if (re.test(n)) return clase;
  return null;
}

// LARGO DE PIERNA dentro de 'bottom'. La zona no alcanza: un short de lino y un
// pantalón de lino son ambos 'bottom', así que el match daba el pantalón por
// "parecido" al short (le pasó a Roberto). La regla del prompt trataba el largo
// como trata la manga —un matiz menor— y en la pierna no lo es: no te metes a la
// alberca en pantalón, ni vas a una junta en bermudas. Son prendas distintas,
// no versiones de la misma.
//
// OJO con el español: "pantalón corto" ES un short. Por eso lo corto se evalúa
// PRIMERO, y el orden del array importa. Los largos ambiguos (capri, culotte,
// pescador) quedan fuera a propósito: devuelven null y no bloquean, porque un
// hueco falso es tan caro como un falso "ya lo tienes".
const CLASES_BOTTOM: [string, RegExp][] = [
  ["corto", /\bshort|bermuda|pantaloneta|pantalon(es)? corto|de pierna corta/],
  ["falda", /\bfalda|\bskirt/],
  ["largo", /pantalon|\bjean|chino|vaquero|legging|jogger|palazzo|slack|trouser/],
];

/**
 * null = largo desconocido → no bloquea. Solo distingue dentro de 'bottom'.
 */
export function claseBottom(texto: string): string | null {
  const n = normaliza(texto);
  for (const [clase, re] of CLASES_BOTTOM) if (re.test(n)) return clase;
  return null;
}

/** null = ropa de calle (el caso normal). Ver CLASES_CONTEXTO. */
export function contextoUso(texto: string): string | null {
  const n = normaliza(texto);
  for (const [clase, re] of CLASES_CONTEXTO) if (re.test(n)) return clase;
  return null;
}

/**
 * ¿La prenda real puede cubrir a la ideal, en cuanto a CONTEXTO de uso? Solo
 * bloquea cuando los contextos difieren. Dos trajes de baño sí se cubren.
 *
 * `realAttr` es el contexto GUARDADO de la prenda real (items.attrs.contexto) y
 * gana sobre el texto: el nombre es frágil —alguien renombra su bikini a "Marino
 * dos piezas" y el texto ya no lo caza— mientras que el atributo lo pone la
 * biblioteca o el análisis de la foto. Sin atributo, cae al texto de siempre.
 */
export function contextosCompatibles(
  ideal: string,
  real: string,
  realAttr?: string | null
): boolean {
  const ctxReal = realAttr?.trim() ? realAttr.trim() : contextoUso(real);
  return contextoUso(ideal) === ctxReal;
}

export function matchSignature(closet: Parameters<typeof closetSignature>[0]): string {
  return `${MATCH_PROMPT_VERSION}|${closetSignature(closet)}`;
}

// CAPA 2 — el match: por cada prenda de la cápsula ideal, ¿el clóset real ya la
// cubre? El juicio fino (¿una desert boot cubre una chukka? ¿un crewneck cubre
// un cuello tortuga?) lo hace la IA, porque el clóset no guarda un "tipo" fino.
// El resultado se CACHEA con la firma del clóset (ver el caller) para que el
// número no baile entre cargas: solo se recalcula si cambia el clóset.
export async function matchCapsule(
  target: CapsuleTarget,
  closet: ClosetItemLite[],
  gender: "hombre" | "mujer" | null = null,
  // Prendas que la persona ya rechazó (swaps de maletas anteriores): el match
  // las usa como ÚLTIMO recurso — solo si ninguna otra prenda cubre la ideal.
  evita: string[] = []
): Promise<CapsuleMatch> {
  const signature = matchSignature(closet);
  const blank: MatchEntry[] = target.items.map(() => ({ status: "falta", by: null }));

  // Sin clóset (o sin API) → todo falta, sin gastar una llamada.
  if (closet.length === 0 || !process.env.ANTHROPIC_API_KEY) {
    return { signature, entries: blank };
  }

  const client = new Anthropic();

  const idealTxt = target.items
    .map(
      (it, i) =>
        `${i + 1}. ${it.nombre} (tipo: ${it.tipo}, ${it.category}, ${it.formalidad}, ${it.colorFamilia}${
          it.temporada && it.temporada !== "todo-el-año" ? `, para ${it.temporada}` : ""
        })`
    )
    .join("\n");
  const closetTxt = closet.map(closetItemLine).join("\n");

  const generoTxt =
    gender === "hombre"
      ? " La persona es hombre (su clóset es ropa de hombre)."
      : gender === "mujer"
        ? " La persona es mujer (su clóset es ropa de mujer)."
        : "";

  const evitaTxt = evita.length
    ? `\n\nPRENDAS QUE YA RECHAZÓ: la persona pidió cambiar estas prendas en maletas anteriores: ${evita.join(
        "; "
      )}. Prefiérelas como ÚLTIMA opción de "by": si otra prenda del clóset también cubre la ideal (aunque sea "parecido"), usa esa otra. Solo usa una rechazada si es la ÚNICA de su clase que cubre la ideal.`
    : "";

  const response = await client.messages.create({
    model: CLASSIFY_MODEL,
    // Una entrada por prenda ideal; la cápsula nueva llega a 30-40 → 2048 truncaba.
    max_tokens: 4096,
    system: `Eres la stylist de stailist.${generoTxt} Te doy la CÁPSULA IDEAL de alguien (prendas que debería tener) y su CLÓSET REAL. Por CADA prenda ideal, clasifícala en uno de TRES estados según lo que ya tiene:

- "tienes": el clóset ya tiene esa prenda en forma usable — mismo tipo y uso, color compatible, misma formalidad. Cuenta equivalencias reales de tipo (una desert boot vale por una chukka; una camisa azul claro vale por "camisa celeste").
- "parecido": el clóset tiene la prenda CORRECTA (mismo tipo y uso) pero con un matiz que vale notar — otro neutro, o un casi-equivalente. NO es hueco, es refinamiento. Ej: tiene blazer marino y el ideal es negro; tiene mocasín y el ideal es Oxford.
- "falta": el clóset NO tiene esa prenda en ninguna forma usable. Hueco real. Ej: no hay ningún cuello tortuga; o el ideal pide un color statement que cambia el papel y no lo tiene.

REGLAS (en orden de prioridad):
1. La CLASE de prenda manda por encima de TODO. "by" DEBE ser de la MISMA clase que la prenda ideal: un pantalón solo lo cubre otro pantalón; un zapato, otro zapato; un reloj, otro reloj. NUNCA cruces clases por color o material parecido — un chino NO lo cubren unos mocasines; un reloj NO lo cubren unos lentes; un cinturón NO lo cubre una cartera. Entre accesorios distingue la clase fina (reloj ≠ lentes ≠ cinturón ≠ bufanda ≠ gorra). Si NINGUNA prenda del clóset es de la misma clase, es "falta" con by="". Prohibido emparejar prendas de categorías distintas (top, bottom, calzado, abrigo, vestido, accesorio).
2. Dentro de la misma clase, el TIPO FINO manda: si el rasgo que DEFINE a la prenda ideal (la botonadura de un henley o un polo, el cuello de un cuello tortuga, los botones de una camisa) no existe en la prenda real, es "falta" — una camiseta lisa NO cubre un henley ni un polo; un crewneck NO cubre un cuello tortuga. El USO también manda: una capa térmica/base de invierno no cubre una camiseta de diario (ni al revés). La manga (corta vs larga) baja a "parecido" si TODO lo demás coincide; sumada a otro rasgo distinto, es "falta".
3. LARGO DE PIERNA: en pantalones, el largo NO es un matiz como la manga — es otra prenda. Un pantalón largo NUNCA cubre un short o una bermuda, ni al revés, aunque compartan tela y color; y una falda no cubre un pantalón. Si el ideal pide un short y solo tienes pantalones largos, es "falta".
4. CONTEXTO DE USO: lo que no es ropa de calle NUNCA cubre ropa de calle, ni al revés, aunque sea el mismo tipo y color. Un short de baño NO cubre un short de lino; una playera de gym NO cubre una camiseta de diario; una pijama, un bikini o la ropa interior no cubren nada de calle. Y si la prenda ideal ES de baño (traje de baño), solo la cubre otra prenda de baño.
5. Solo cuando YA es la misma clase, el COLOR desempata: neutros oscuros (negro, marino, gris, carbón, azul oscuro) son intercambiables — mismo neutro → "tienes", neutro distinto → "parecido". Colores statement o cálidos específicos (camel, oliva, vino, mostaza, etc.) sí importan: si el ideal pide uno y no lo tienes en esa clase, es "falta".
6. Material, temporada, corte y estampado AFINAN entre "tienes" y "parecido" DENTRO de la misma clase y color — nunca crean un "falta". Si la prenda real difiere del ideal en peso/uso de forma que importe (el ideal pide un suéter fino de verano y el tuyo es de lana gruesa de invierno; o el ideal es liso y el tuyo tiene un estampado protagonista), baja de "tienes" a "parecido". Si coinciden o la diferencia es menor, déjalo en "tienes". Ante la duda, "tienes": estos atributos refinan, no castigan.

Devuelve "entries": EXACTAMENTE una entrada por prenda ideal, EN EL MISMO ORDEN (1..N). Cada entrada:
- status: "tienes" | "parecido" | "falta".
- by: el nombre exacto de la prenda del clóset que la cumple o se le parece, o "" si falta.
- difiere: SOLO si status es "parecido", EN QUÉ difiere la suya de la ideal, en 2 a 5 palabras, minúsculas, nombrando el rasgo concreto ("manga corta vs larga", "negro en vez de marino", "gamuza en vez de piel"). En "tienes" y "falta" va "".`,
    messages: [
      {
        role: "user",
        content: `CÁPSULA IDEAL (${target.items.length} prendas):\n${idealTxt}\n\nCLÓSET REAL:\n${closetTxt}${evitaTxt}\n\nMarca cada prenda ideal.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["tienes", "parecido", "falta"] },
                  by: { type: "string" },
                  difiere: { type: "string" },
                },
                required: ["status", "by", "difiere"],
                additionalProperties: false,
              },
            },
          },
          required: ["entries"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("EMPTY_RESPONSE");
  const parsed = JSON.parse(text) as {
    entries: { status: MatchEntry["status"]; by: string; difiere?: string }[];
  };

  // Zonas del cuerpo: dentro de una zona el match es válido; cruzar zonas no.
  // 'saco' es su PROPIA zona (cae al `: cat`): un saco solo lo cubre otro saco —
  // un cárdigan o un abrigo NO cubren un saco. top y abrigo siguen juntos ('torso')
  // porque una capa ligera a veces se etiqueta top o abrigo indistintamente. Lo que
  // NUNCA se cruza: torso ↔ saco ↔ pierna ↔ zapato ↔ accesorio ↔ vestido.
  const zoneOf = (cat: string): string =>
    cat === "top" || cat === "abrigo" ? "torso" : cat;

  // Resuelve un `by` (texto libre del modelo) a la categoría de la prenda real del
  // clóset. Normaliza (minúsculas, sin acentos) y cae a coincidencia por inclusión
  // si el modelo parafraseó el nombre. null = no apunta a ninguna prenda real.
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const closetByName = new Map(closet.map((c) => [norm(c.nombre), c.category]));
  // Contexto GUARDADO de cada prenda real (attrs.contexto), para que el guard no
  // dependa solo de cómo se llame.
  const ctxByName = new Map(
    closet.map((c) => [norm(c.nombre), c.contexto ?? null])
  );
  const resolveContexto = (by: string): string | null => {
    const n = norm(by);
    if (ctxByName.has(n)) return ctxByName.get(n) ?? null;
    for (const c of closet) {
      const cn = norm(c.nombre);
      if (cn && n && (cn.includes(n) || n.includes(cn))) return c.contexto ?? null;
    }
    return null;
  };
  const resolveCategory = (by: string): string | null => {
    const n = norm(by);
    if (closetByName.has(n)) return closetByName.get(n) ?? null;
    for (const c of closet) {
      const cn = norm(c.nombre);
      if (cn && n && (cn.includes(n) || n.includes(cn))) return c.category;
    }
    return null;
  };

  // Alinea por índice; si el modelo devolvió de más/menos, ajusta sin romper.
  // GUARDIA: un match (tienes/parecido) DEBE apuntar a una prenda real de la MISMA
  // ZONA que la ideal. Si cruza zonas (chino↔mocasines) o el `by` no resuelve a
  // ninguna prenda real, lo degradamos a "falta" — la IA a veces empareja por
  // color/material a través de categorías, y eso no tiene sentido.
  const entries: MatchEntry[] = target.items.map((ideal, i) => {
    const e = parsed.entries?.[i];
    if (!e) return { status: "falta", by: null, difiere: null };
    const claimed = e.status === "tienes" || e.status === "parecido" ? e.status : "falta";
    const by = e.by && e.by.trim() ? e.by.trim() : null;
    if (claimed === "falta") return { status: "falta", by: null, difiere: null };
    const cat = by ? resolveCategory(by) : null;
    if (!cat || zoneOf(cat) !== zoneOf(ideal.category)) {
      return { status: "falta", by: null, difiere: null };
    }
    // Contexto de uso: lo que no es ropa de calle no cubre ropa de calle (ni al
    // revés). Va ANTES de la clase fina porque cruza todas las categorías.
    if (!contextosCompatibles(`${ideal.nombre} ${ideal.tipo}`, by!, resolveContexto(by!))) {
      return { status: "falta", by: null, difiere: null };
    }
    // Dentro de bottoms, el LARGO de pierna también tiene que coincidir.
    if (ideal.category === "bottom" && cat === "bottom") {
      const idealLargo = claseBottom(`${ideal.nombre} ${ideal.tipo}`);
      const realLargo = claseBottom(by!);
      if (idealLargo && realLargo && idealLargo !== realLargo) {
        return { status: "falta", by: null, difiere: null };
      }
    }
    // Dentro de accesorios, la clase fina también tiene que coincidir.
    if (ideal.category === "accesorio" && cat === "accesorio") {
      const idealClase = claseAccesorio(`${ideal.nombre} ${ideal.tipo}`);
      const realClase = claseAccesorio(by!);
      if (idealClase && realClase && idealClase !== realClase) {
        return { status: "falta", by: null, difiere: null };
      }
    }
    // "difiere" sólo tiene sentido en "parecido" (en "tienes" no hay diferencia
    // que contar). Se acota para que no desborde la línea de la card.
    const difiere =
      claimed === "parecido" && e.difiere && e.difiere.trim()
        ? e.difiere.trim().slice(0, 48)
        : null;
    return { status: claimed, by, difiere };
  });

  return { signature, entries };
}
