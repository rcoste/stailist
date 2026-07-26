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
// visita (sin esto, el fix solo llegaría a quien cambie su clóset). OJO: no
// tocar closetSignature — la comparten los looks de la cápsula y regenerarlos
// cuesta llamadas.
const MATCH_PROMPT_VERSION = "m2";

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
    model: "claude-opus-4-8",
    // Una entrada por prenda ideal; la cápsula nueva llega a 30-40 → 2048 truncaba.
    max_tokens: 4096,
    system: `Eres la stylist de stailist.${generoTxt} Te doy la CÁPSULA IDEAL de alguien (prendas que debería tener) y su CLÓSET REAL. Por CADA prenda ideal, clasifícala en uno de TRES estados según lo que ya tiene:

- "tienes": el clóset ya tiene esa prenda en forma usable — mismo tipo y uso, color compatible, misma formalidad. Cuenta equivalencias reales de tipo (una desert boot vale por una chukka; una camisa azul claro vale por "camisa celeste").
- "parecido": el clóset tiene la prenda CORRECTA (mismo tipo y uso) pero con un matiz que vale notar — otro neutro, o un casi-equivalente. NO es hueco, es refinamiento. Ej: tiene blazer marino y el ideal es negro; tiene mocasín y el ideal es Oxford.
- "falta": el clóset NO tiene esa prenda en ninguna forma usable. Hueco real. Ej: no hay ningún cuello tortuga; o el ideal pide un color statement que cambia el papel y no lo tiene.

REGLAS (en orden de prioridad):
1. La CLASE de prenda manda por encima de TODO. "by" DEBE ser de la MISMA clase que la prenda ideal: un pantalón solo lo cubre otro pantalón; un zapato, otro zapato; un reloj, otro reloj. NUNCA cruces clases por color o material parecido — un chino NO lo cubren unos mocasines; un reloj NO lo cubren unos lentes; un cinturón NO lo cubre una cartera. Entre accesorios distingue la clase fina (reloj ≠ lentes ≠ cinturón ≠ bufanda ≠ gorra). Si NINGUNA prenda del clóset es de la misma clase, es "falta" con by="". Prohibido emparejar prendas de categorías distintas (top, bottom, calzado, abrigo, vestido, accesorio).
2. Dentro de la misma clase, el TIPO FINO manda: si el rasgo que DEFINE a la prenda ideal (la botonadura de un henley o un polo, el cuello de un cuello tortuga, los botones de una camisa) no existe en la prenda real, es "falta" — una camiseta lisa NO cubre un henley ni un polo; un crewneck NO cubre un cuello tortuga. El USO también manda: una capa térmica/base de invierno no cubre una camiseta de diario (ni al revés). La manga (corta vs larga) baja a "parecido" si TODO lo demás coincide; sumada a otro rasgo distinto, es "falta".
3. Solo cuando YA es la misma clase, el COLOR desempata: neutros oscuros (negro, marino, gris, carbón, azul oscuro) son intercambiables — mismo neutro → "tienes", neutro distinto → "parecido". Colores statement o cálidos específicos (camel, oliva, vino, mostaza, etc.) sí importan: si el ideal pide uno y no lo tienes en esa clase, es "falta".
4. Material, temporada, corte y estampado AFINAN entre "tienes" y "parecido" DENTRO de la misma clase y color — nunca crean un "falta". Si la prenda real difiere del ideal en peso/uso de forma que importe (el ideal pide un suéter fino de verano y el tuyo es de lana gruesa de invierno; o el ideal es liso y el tuyo tiene un estampado protagonista), baja de "tienes" a "parecido". Si coinciden o la diferencia es menor, déjalo en "tienes". Ante la duda, "tienes": estos atributos refinan, no castigan.

Devuelve "entries": EXACTAMENTE una entrada por prenda ideal, EN EL MISMO ORDEN (1..N). Cada entrada:
- status: "tienes" | "parecido" | "falta".
- by: el nombre exacto de la prenda del clóset que la cumple o se le parece, o "" si falta.`,
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
                },
                required: ["status", "by"],
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
    entries: { status: MatchEntry["status"]; by: string }[];
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
    if (!e) return { status: "falta", by: null };
    const claimed = e.status === "tienes" || e.status === "parecido" ? e.status : "falta";
    const by = e.by && e.by.trim() ? e.by.trim() : null;
    if (claimed === "falta") return { status: "falta", by: null };
    const cat = by ? resolveCategory(by) : null;
    if (!cat || zoneOf(cat) !== zoneOf(ideal.category)) {
      return { status: "falta", by: null };
    }
    return { status: claimed, by };
  });

  return { signature, entries };
}
