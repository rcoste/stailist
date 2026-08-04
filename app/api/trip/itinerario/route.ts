import { EXTRACT_MODEL } from "@/lib/models";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lee el SCREENSHOT del itinerario de vuelo y saca la ruta (paradas + noches +
// fecha de salida) para PRE-LLENAR el paso 1 del wizard. No arma nada: el
// usuario confirma o corrige en el wizard, que es la pantalla de confirmación.
//
// El criterio es lo delicado (Roberto): un itinerario trae escalas, y una escala
// NO es una parada — si metiéramos Dallas porque el vuelo hace conexión ahí,
// empacaríamos para una ciudad donde la persona está 2 horas en una sala.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  let body: { image?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mediaType)) {
    return NextResponse.json({ error: "bad_image" }, { status: 400 });
  }

  // El itinerario puede no traer año ("16 JUL"): el modelo necesita saber hoy
  // para inferir el año correcto (el próximo que caiga en el futuro).
  const hoy = new Date().toISOString().slice(0, 10);

  try {
    const client = new Anthropic({ maxRetries: 2 });
    const res = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 1200,
      system: `Lees el SCREENSHOT del itinerario de viaje de alguien (confirmación de vuelo, app de aerolínea, correo, captura de reserva) y sacas su RUTA para pre-llenar su maleta. Hoy es ${hoy}.

Primero llena "analisis": tu borrador (la persona no lo ve). Ahí lista los vuelos/segmentos que ves con sus fechas y horas, y decide cuáles ciudades son PARADAS REALES y cuáles son escalas. Después llena el resto ejecutando eso.

QUÉ ES UNA PARADA (lo único que cuenta):
- Una ciudad donde la persona DUERME al menos una noche. Eso es todo.
- Una ESCALA/CONEXIÓN NO es parada: llega y sale el mismo día (o en pocas horas), solo cambia de avión, no sale del aeropuerto. Va en "descartadas" con su razón. Ej: MEX→DFW→JFK: Dallas es escala, NO parada.
- El ORIGEN (de dónde sale) NO es parada: es su casa.
- El REGRESO a casa NO es parada: es el final del viaje.
- Si un vuelo sale de noche y llega al día siguiente, esa noche se durmió EN EL AVIÓN — no cuenta como noche en ninguna ciudad.

CÓMO CONTAR LAS NOCHES:
- noches de una parada = cuántas veces duerme ahí = (fecha en que se va de esa ciudad) − (fecha en que llega a esa ciudad).
- Si solo hay un destino: noches = fecha de regreso − fecha de llegada.

FECHAS (lo más delicado — un error aquí le arma la maleta para el clima equivocado):
- "fechaInicio" = la fecha de su PRIMERA NOCHE en la primera parada, o sea el día que LLEGA y ya duerme ahí. Formato YYYY-MM-DD.
- OJO: NO es la fecha en que sale de casa. Si su vuelo sale el 2 por la noche y aterriza el 4 de madrugada, "fechaInicio" es el 4 (las noches del 2 y del 3 las durmió volando, no en la ciudad). Solo cuando sale y llega el MISMO día coinciden.
- Las noches se encadenan a partir de "fechaInicio": primera parada empieza ahí, la siguiente empieza cuando termina la anterior. Verifica que fechaInicio + (suma de todas las noches) caiga exactamente en su fecha de REGRESO a casa. Si no cuadra, revisa: casi siempre es que contaste una noche de avión como noche de ciudad.
- Si el itinerario no dice el año, infiere el año que haga que el viaje caiga en el FUTURO más cercano respecto a hoy.
- Ojo con los formatos: "16 JUL" o "JUL 16" o "16/07" o "07/16" — usa las pistas del itinerario (día de la semana, orden de los vuelos) para no confundir día con mes.

CIUDADES:
- "lugar" = el nombre de la CIUDAD en español, no el código de aeropuerto ni el nombre de la terminal. JFK → "Nueva York". NRT → "Tokio". CDG → "París". MEX → "Ciudad de México".

SI NO PUEDES:
- Si la imagen no es un itinerario, está ilegible, o no logras sacar fechas o ciudades con seguridad, deja "paradas" vacío y explica en "problema" qué pasó, en una línea cálida y de tú ("no alcancé a leer las fechas en esa captura — ¿tienes una más nítida?").
- Prefiere admitir la duda antes que inventar: una fecha inventada le arma la maleta para el clima equivocado.
- "confianza": "alta" si todo se lee nítido; "media" si algo dedujiste; "baja" si adivinaste algo importante.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                data: b64,
              },
            },
            {
              type: "text",
              text: "Saca la ruta de este itinerario: dónde duermo, cuántas noches en cada lugar, y qué día salgo.",
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              // Primero a propósito: espacio de razonamiento antes de decidir.
              analisis: {
                type: "string",
                description:
                  "Tu borrador (la persona NO lo ve): los vuelos que ves con fechas/horas, y cuáles ciudades son paradas reales vs escalas. Decide esto ANTES de llenar el resto.",
              },
              paradas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    lugar: { type: "string" },
                    noches: { type: "integer" },
                  },
                  required: ["lugar", "noches"],
                  additionalProperties: false,
                },
              },
              fechaInicio: {
                type: "string",
                description: "YYYY-MM-DD — el día que sale de casa. Vacío si no lo sacaste.",
              },
              descartadas: {
                type: "array",
                description: "Ciudades que viste pero NO son paradas (escalas, origen, regreso).",
                items: {
                  type: "object",
                  properties: {
                    lugar: { type: "string" },
                    razon: { type: "string" },
                  },
                  required: ["lugar", "razon"],
                  additionalProperties: false,
                },
              },
              confianza: { type: "string", enum: ["alta", "media", "baja"] },
              problema: {
                type: "string",
                description: "Vacío si todo salió bien. Si no, una línea cálida de qué pasó.",
              },
            },
            required: ["analisis", "paradas", "fechaInicio", "descartadas", "confianza", "problema"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const parsed = JSON.parse(text) as {
      paradas?: { lugar?: string; noches?: number }[];
      fechaInicio?: string;
      descartadas?: { lugar?: string; razon?: string }[];
      confianza?: "alta" | "media" | "baja";
      problema?: string;
    };

    // Saneado: la UI confía en esto para pre-llenar, así que nada a medias.
    const paradas = (parsed.paradas ?? [])
      .map((p) => ({
        lugar: String(p.lugar ?? "").trim(),
        noches: Number.isInteger(p.noches) ? Math.max(1, Math.min(p.noches as number, 30)) : 1,
      }))
      .filter((p) => p.lugar.length > 1)
      .slice(0, 6); // MAX_PARADAS del wizard

    const fechaInicio = /^\d{4}-\d{2}-\d{2}$/.test(parsed.fechaInicio ?? "")
      ? (parsed.fechaInicio as string)
      : "";

    return NextResponse.json({
      ok: true,
      paradas,
      fechaInicio,
      descartadas: (parsed.descartadas ?? [])
        .map((d) => ({ lugar: String(d.lugar ?? "").trim(), razon: String(d.razon ?? "").trim() }))
        .filter((d) => d.lugar),
      confianza: parsed.confianza ?? "media",
      problema: (parsed.problema ?? "").trim(),
    });
  } catch {
    return NextResponse.json({ error: "lectura" }, { status: 500 });
  }
}
