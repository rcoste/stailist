import { ENGINE_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { photosGate } from "@/lib/consentimiento";
import { builds, isBuild, type Build, type Gender } from "@/lib/silueta";

export const maxDuration = 60;

export type CuerpoDetectado = {
  build: Build;
  confianza: "alta" | "media" | "baja";
};

// Detecta la COMPLEXIÓN a partir de una foto de cuerpo entero, para que quien
// elige representarse con su propia foto (en vez de escoger una silueta) no
// pierda la señal de morfología que el motor usa para el styling.
//
// Nunca se guarda a ciegas: el wizard muestra el resultado como una línea
// corregible ("por tu foto diría que eres X · cambiar") — el humano sigue
// siendo el filtro contra la alucinación, igual que en el análisis de prendas.
//
// Solo devuelve ids del género de la usuaria (las complexiones son distintas
// por género), y `confianza` para que la UI baje el tono cuando dudó.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Menor (13-17) sin permiso parental confirmado: las fotos quedan bloqueadas.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  let body: { image?: string; gender?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const gender: Gender | null =
    body.gender === "mujer" || body.gender === "hombre" ? body.gender : null;
  if (!gender) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const match = body.image?.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const [, mediaType, b64] = match;

  const opciones = builds(gender);
  const catalogo = opciones.map((b) => `- "${b.id}": ${b.hint}`).join("\n");

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: ENGINE_MODEL,
      max_tokens: 200,
      system:
        "Miras la foto de cuerpo entero de una persona y eliges cuál de estas complexiones se parece MÁS a la suya. " +
        "Es para representarla con una silueta fiel en una app de moda, no para juzgarla ni para dar consejos de salud.\n\n" +
        `Opciones (elige exactamente un id):\n${catalogo}\n\n` +
        "Reglas: (1) Elige SIEMPRE una de esas opciones, la más cercana. " +
        "(2) Fíjate en la estructura general (ancho de hombros vs cadera, volumen del cuerpo, masa muscular aparente), " +
        "NO en la ropa que trae puesta ni en la pose. (3) Si la foto no muestra el cuerpo completo, está muy de lejos, " +
        "muy oscura, la ropa es muy holgada, o el ángulo engaña, marca confianza 'baja' y elige la opción media/promedio " +
        "en vez de arriesgar. (4) Ante la duda entre dos contiguas, elige la más conservadora (la del medio). " +
        "(5) NO comentes nada sobre el peso, la salud ni el atractivo de la persona.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png",
                data: b64,
              },
            },
            { type: "text", text: "¿Cuál de las complexiones se parece más a este cuerpo?" },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              build: { type: "string", enum: opciones.map((b) => b.id) },
              confianza: { type: "string", enum: ["alta", "media", "baja"] },
            },
            required: ["build", "confianza"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const parsed = JSON.parse(text) as CuerpoDetectado;
    // Defensa: el id debe ser del género pedido (el enum ya lo acota, pero el
    // modelo podría devolver algo raro y no queremos guardar basura).
    if (!isBuild(parsed.build) || !opciones.some((o) => o.id === parsed.build)) {
      return NextResponse.json({ error: "build_invalido" }, { status: 502 });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
