import { GUARD_MODEL } from "@/lib/models";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pedirImagen } from "@/lib/gemini-imagen";
import { NextResponse, type NextRequest } from "next/server";
import { photosGate } from "@/lib/consentimiento";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { revisarCuota } from "@/lib/cuotas";

export const maxDuration = 60;


// Juez de parecido: visión barata. Si puntúa bajo, se regenera UNA vez y se
// devuelve el mejor de los dos — el usuario nunca ve el intento malo.
const JUDGE_MODEL = GUARD_MODEL;
const JUDGE_MIN = 6; // umbral 1-10 para reintentar

/**
 * Hasta cuándo vale la pena arrancar la SEGUNDA generación (la que pide el
 * juez cuando el parecido sale bajo). Vercel corta la función a los 60s y una
 * generación medida tarda ~16s más ~3s de juez: si al llegar aquí ya pasaron
 * 30s, la segunda no termina — y quedarse sin respuesta es peor que quedarse
 * con el avatar regular que ya se tiene.
 */
const LIMITE_SEGUNDA_MS = 30_000;

// El tipo de cuerpo (de la silueta del perfil o del wizard) alimenta el prompt.
// Espejo fiel: NO adelgazar. Básicos ajustados → la silueta se ve para que el
// try-on sea fiel.
const BUILD: Record<string, string> = {
  slim: "slim",
  athletic: "athletic and toned",
  average: "average",
  full: "fuller, heavier-set",
};

// Reglas de identidad compartidas por las dos etapas (retrato y cuerpo).
const IDENTITY_RULES =
  "Keep their face, skin tone, hair and identity identical and clearly " +
  "recognizable, INCLUDING their natural facial expression from the photos — if " +
  "they are smiling, keep the smile; if they are serious or neutral, keep that; " +
  "do NOT change or neutralize their expression. Also keep their apparent age " +
  "from the photos — do NOT make them look younger or older than they are, and " +
  "do NOT beautify or idealize them. ";

// Etapa 1 — retrato (cara primero): la identidad se aprueba barata y enfocada
// antes de gastar en el cuerpo. `ajuste` = corrección dirigida de la persona
// ("pelo más corto", "sin lentes"…) aplicada sobre el retrato previo.
function buildFacePrompt(nFaces: number, ajuste: string | null, hasPrev: boolean): string {
  const faceRef =
    nFaces > 1
      ? `the first ${nFaces} images show their face from different angles`
      : "the first image is their face";
  let p =
    "Generate a photorealistic head-and-shoulders studio portrait of the SAME " +
    `person shown in the provided photos (${faceRef}). ` +
    IDENTITY_RULES +
    "They wear a plain white crew-neck t-shirt. They face the camera directly, " +
    "head and shoulders centered. Plain flat light-grey studio background, cool " +
    "neutral lighting (NO warm or golden tones). Editorial, clean. No text, no " +
    "props, no extra people.";
  if (ajuste && hasPrev) {
    p +=
      " The LAST image is the previous attempt. The person asked for exactly ONE " +
      `correction (given in Spanish): "${ajuste}". Apply ONLY that correction and ` +
      "keep everything else from the previous attempt unchanged.";
  } else if (ajuste) {
    p += ` The person asked for one correction (given in Spanish): "${ajuste}". Apply it.`;
  }
  return p;
}

// Etapa 2 — cuerpo completo anclado al retrato APROBADO (primera imagen): la
// identidad ya no se re-interpreta, se copia. Las fotos de cuerpo son opcionales.
// `build` es null cuando la usuaria eligió representarse con FOTOS de su cuerpo
// en vez de con una silueta de referencia: ahí las fotos mandan y no hay
// categoría que imponer. La regla anti-adelgazar se mantiene en ambos casos.
function buildBodyPrompt(
  build: string | null,
  nBodies: number,
  heightCm: number | null
): string {
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    "the FIRST image — an approved studio portrait of them. Match their face, " +
    "hair, skin tone and facial expression from that portrait EXACTLY; it is " +
    "the source of truth for their identity. " +
    (nBodies > 0
      ? `The last ${nBodies} image(s) show their real body — use them for body ` +
        "proportions and posture. "
      : "") +
    (heightCm
      ? `The person is approximately ${heightCm} cm tall — render realistic overall proportions for that height. `
      : "") +
    IDENTITY_RULES +
    (build
      ? `The person has a ${build} build — render realistic body `
      : "Render realistic body ") +
    "proportions that match them; DO NOT slim them down or alter their body " +
    "shape. Dress them in a plain white crew-neck t-shirt and classic mid-blue " +
    "jeans (the same base outfit every time). Show the ENTIRE body from head to " +
    "feet: the head and the feet (with shoes) must be fully visible and NOT " +
    "cropped, leaving a little empty space above the head and below the feet. " +
    "The person stands centered and full-length in the frame, facing forward in " +
    "a natural relaxed posture. Plain flat light-grey studio background, cool " +
    "neutral lighting (NO warm or golden tones). Editorial, clean. No text, no " +
    "props, no extra people."
  );
}

// Etapa 3 (A2) — character sheet: UNA generación con las TRES vistas (frente /
// perfil / espalda) a partir del retrato y el cuerpo APROBADOS. Una sola imagen
// = consistente por construcción (3 generaciones separadas re-interpretan la
// identidad 3 veces). El sheet alimenta el try-on como referencia de identidad.
function buildSheetPrompt(): string {
  return (
    "Generate a photorealistic character reference sheet of the SAME person " +
    "shown in the provided images (their approved portrait and full-body view). " +
    "ONE single image containing THREE full-body views of that person standing " +
    "side by side, evenly spaced on one row: (1) facing the camera front-on, " +
    "(2) exact left profile side view, (3) seen fully from the back. " +
    IDENTITY_RULES +
    "Identical hairstyle, identical white crew-neck t-shirt, classic mid-blue " +
    "jeans and the same shoes in ALL three views. Same height and body " +
    "proportions in all views, full body head to feet visible in each. Plain " +
    "flat light-grey studio background, cool neutral lighting (NO warm or " +
    "golden tones). No text, no labels, no props, no extra people."
  );
}

// Legacy (clientes con JS viejo cacheado): una sola pasada fotos → cuerpo entero.
function buildPrompt(build: string, nFaces: number): string {
  const faceRef =
    nFaces > 1
      ? `the first ${nFaces} images show their face from different angles`
      : "the first image is their face";
  return (
    "Generate a photorealistic full-body portrait of the SAME person shown in " +
    `the provided photos (${faceRef}; the others show their ` +
    "body). " +
    IDENTITY_RULES +
    `The person has a ${build} build — render realistic body ` +
    "proportions that match them; DO NOT slim them down or alter their body " +
    "shape. Dress them in a plain white crew-neck t-shirt and classic mid-blue " +
    "jeans (the same base outfit every time). Show the ENTIRE body from head to " +
    "feet: the head and the feet (with shoes) must be fully visible and NOT " +
    "cropped, leaving a little empty space above the head and below the feet. " +
    "The person stands centered and full-length in the frame, facing forward in " +
    "a natural relaxed posture. Plain flat light-grey studio background, cool " +
    "neutral lighting (NO warm or golden tones). Editorial, clean. No text, no " +
    "props, no extra people."
  );
}

// Una generación con Gemini, por la puerta común (lib/gemini-imagen).
//
// Tenía SU PROPIA copia del fetch, y por eso se quedó fuera del reintento y
// del timeout que el try-on sí recibió: el servicio de imágenes devuelve 500
// intermitentes y cortes de red (medido: 2 de 8 llamadas), y aquí un solo 500
// mataba la generación de la cara sin dejar rastro de por qué.
//
// `motivo` se devuelve para poder registrarlo: un fallo mudo era invisible en
// los eventos —la fila de instrumentación se escribe DESPUÉS, así que las
// generaciones que fallaban no dejaban ninguna—, y eso es justo lo que hizo
// imposible saber por qué "tardó muchísimo" la primera vez que pasó.
async function generarAvatar(
  parts: unknown[],
  aspect: "3:4" | "16:9" = "3:4",
  // Quién paga la imagen. Se pasa desde el handler porque aquí no hay sesión.
  ctx?: { supabase: SupabaseClient; userId: string } | null
): Promise<{ image: string | null; motivo: string | null; ms: number }> {
  const t0 = Date.now();
  const r = await pedirImagen(parts as Parameters<typeof pedirImagen>[0], {
    aspecto: aspect,
    ctx: ctx ? { ...ctx, tarea: "avatar" } : null,
  });
  return "data" in r
    ? { image: r.data, motivo: null, ms: Date.now() - t0 }
    : { image: null, motivo: r.motivo, ms: Date.now() - t0 };
}

// El media_type DEBE coincidir con los bytes reales (la API lo valida y truena
// con 400 si no) — Gemini devuelve JPEG o PNG según le da. Detectamos por los
// magic bytes del base64. Este mismatch tuvo al juez roto en silencio desde su
// estreno (declaraba png fijo): score null en todos los eventos.
function mediaTypeOf(b64: string): "image/png" | "image/jpeg" | "image/webp" {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

/**
 * Deja constancia de una generación que NO salió.
 *
 * Existe porque los fallos eran INVISIBLES: la fila de instrumentación
 * (`avatar_judge`) se escribe al final, así que una generación que moría antes
 * no dejaba ninguna. En la tabla solo se veían los éxitos — y con esa foto
 * incompleta, "el avatar tardó muchísimo / falló" era imposible de diagnosticar
 * sin salir a interrogar la API de Google a mano.
 *
 * Best-effort a propósito: si el registro falla, la respuesta de error a la
 * persona no cambia.
 */
async function registrarFallo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stage: string,
  motivo: string | null,
  ms: number
) {
  try {
    await supabase.from("events").insert({
      user_id: userId,
      type: "avatar_fallo",
      data: { stage, motivo: motivo?.slice(0, 300) ?? null, ms },
    });
  } catch {
    // Un error al anotar el error no debe tapar el error.
  }
}

// Juez de parecido (best-effort): compara la selfie con el avatar generado y
// puntúa la identidad facial 1-10. Si no hay API key o falla, devuelve null y
// el avatar pasa sin juez (nunca rompe la generación).
async function juzgarParecido(
  faceB64: string,
  avatarB64: string
): Promise<{ score: number; problema: string } | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    // Timeout y reintentos ACOTADOS a mano. Por default el SDK trae
    // `maxRetries: 2` y `timeout: 10 minutos`: en una función que Vercel corta
    // a los 60s, eso no protege de nada — solo convierte un mal momento de la
    // API en un usuario esperando hasta que la función muera, sin avatar y sin
    // explicación. Y este juez es BEST-EFFORT por diseño (si no contesta, el
    // avatar pasa igual), así que bloquear por él es lo contrario de lo que se
    // quiere. Medido: 3.0s / 3.2s / 2.9s con las dos imágenes reales, así que
    // 15s es holgado.
    const client = new Anthropic({ maxRetries: 1, timeout: 15_000 });
    const res = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      system:
        "Comparas la SELFIE real de una persona (primera imagen) con un AVATAR generado por IA (segunda imagen). Puntúa del 1 al 10 qué tan reconocible es como LA MISMA persona: rasgos faciales, tono de piel, pelo (color, largo, textura), edad aparente. 10 = claramente la misma persona; 5 = parecido genérico; 1 = otra persona. Sé exigente con la identidad facial. Señala en una frase el problema principal si hay uno.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaTypeOf(faceB64), data: faceB64 } },
            { type: "image", source: { type: "base64", media_type: mediaTypeOf(avatarB64), data: avatarB64 } },
            { type: "text", text: "¿Qué tan parecido es el avatar a la persona de la selfie?" },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              score: { type: "integer" },
              problema: { type: "string" },
            },
            required: ["score", "problema"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { score: number; problema: string };
    if (typeof parsed.score !== "number") return null;
    return { score: Math.max(1, Math.min(10, parsed.score)), problema: parsed.problema ?? "" };
  } catch {
    return null;
  }
}

// Genera el avatar digital base (cuerpo completo, neutral) a partir de las fotos
// que sube la persona. Las fotos fuente NO se persisten — solo viajan en esta
// request. Devuelve la imagen como base64; el cliente la confirma o rehace.
// Consistencia: acepta hasta 2 fotos de cara y 3 de cuerpo (Gemini 3 Pro Image
// soporta muchas referencias — más ángulos = identidad más fiel), y un juez de
// visión puntúa el parecido: si sale bajo, se regenera una vez en silencio.
export async function POST(request: NextRequest) {
  // Reloj de la petición completa. Sin esto solo se sabía cuánto tardó Gemini,
  // que resultó ser la parte que NO era el problema.
  const t0Req = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Tope diario de IA (lib/cuotas.ts). 429 y NO 500: no es un fallo, es un
  // límite, y el cliente lo distingue para enseñar el mensaje tal cual.
  const cuota = await revisarCuota(supabase, user.id, "avatar");
  if (!cuota.permitido) {
    return NextResponse.json(
      { error: "cuota", motivo: cuota.motivo, mensaje: cuota.mensaje },
      { status: 429 }
    );
  }

  // Menor (13-17) sin permiso parental confirmado: las fotos quedan bloqueadas.
  const blocked = await photosGate(supabase, user.id);
  if (blocked) return blocked;

  let body: {
    stage?: string; // "face" | "body" | "sheet" | ausente (legacy: una pasada)
    faceB64?: string;
    faceExtraB64?: string[];
    bodyB64?: string[];
    bodyType?: string;
    ajuste?: string; // etapa face: corrección dirigida ("pelo más corto"…)
    prevFaceB64?: string; // etapa face: retrato previo (base del ajuste)
    headshotB64?: string; // etapas body/sheet: retrato APROBADO (ancla)
    avatarB64?: string; // etapa sheet: cuerpo completo APROBADO
    heightCm?: number; // etapa body: altura opcional (proporciones)
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { faceB64, faceExtraB64, bodyB64, bodyType } = body;
  const stage =
    body.stage === "face" || body.stage === "body" || body.stage === "sheet"
      ? body.stage
      : null;

  // El sheet no usa las fotos crudas: parte del retrato + cuerpo APROBADOS.
  if (stage === "sheet") {
    if (!body.headshotB64 || !body.avatarB64) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
    }
    try {
      const img = (d: string) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } });
      const r = await generarAvatar(
        [{ text: buildSheetPrompt() }, img(body.headshotB64), img(body.avatarB64)],
        "16:9",
        { supabase, userId: user.id }
      );
      if (!r.image) {
        await registrarFallo(supabase, user.id, "sheet", r.motivo, r.ms);
        return NextResponse.json(
          { error: "generacion", detalle: r.motivo ?? undefined },
          { status: 502 }
        );
      }
      return NextResponse.json({ image: r.image });
    } catch {
      return NextResponse.json({ error: "generacion" }, { status: 502 });
    }
  }

  if (!faceB64) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  // Cuerpo (etapa 2 o legacy) exige bodyType; las fotos de cuerpo son opcionales
  // en la etapa 2 (el retrato aprobado + la complexión bastan) y obligatorias
  // solo en el flujo legacy.
  const bodies = (Array.isArray(bodyB64) ? bodyB64 : []).slice(0, 3);
  if (stage !== "face") {
    // La complexión es OPCIONAL cuando vienen fotos reales del cuerpo (etapa 2):
    // esas fotos SON la morfología, y encasillarlas además en una categoría
    // puede contradecir lo que se ve. Sin fotos, la complexión es obligatoria
    // (es la única señal de proporciones que tendría el modelo).
    const buildOpcional = stage === "body" && bodies.length > 0;
    if (!buildOpcional && (!bodyType || !BUILD[bodyType])) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (bodyType && !BUILD[bodyType]) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (stage === "body" && !body.headshotB64) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (stage === null && bodies.length === 0) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  }
  // Topes de referencias (defensa; el wizard manda máx 2 caras + 3 cuerpos).
  const faces = [faceB64, ...(Array.isArray(faceExtraB64) ? faceExtraB64 : [])].slice(0, 2);
  const ajuste = typeof body.ajuste === "string" ? body.ajuste.trim().slice(0, 140) : "";

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  try {
    const img = (d: string) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } });
    let parts: unknown[];
    if (stage === "face") {
      const hasPrev = !!body.prevFaceB64 && !!ajuste;
      parts = [
        { text: buildFacePrompt(faces.length, ajuste || null, hasPrev) },
        ...faces.map(img),
        ...(hasPrev ? [img(body.prevFaceB64 as string)] : []),
      ];
    } else if (stage === "body") {
      const heightCm =
        typeof body.heightCm === "number" &&
        Number.isInteger(body.heightCm) &&
        body.heightCm >= 100 &&
        body.heightCm <= 230
          ? body.heightCm
          : null;
      parts = [
        {
          text: buildBodyPrompt(
            bodyType ? BUILD[bodyType] : null,
            bodies.length,
            heightCm
          ),
        },
        img(body.headshotB64 as string),
        ...bodies.map(img),
      ];
    } else {
      parts = [
        { text: buildPrompt(BUILD[bodyType as string], faces.length) },
        ...faces.map(img),
        ...bodies.map(img),
      ];
    }

    const primera = await generarAvatar(parts, "3:4", { supabase, userId: user.id });
    let image = primera.image;
    let msGen = primera.ms;
    if (!image) {
      await registrarFallo(supabase, user.id, stage ?? "legacy", primera.motivo, primera.ms);
      return NextResponse.json(
        { error: "generacion", detalle: primera.motivo ?? undefined },
        { status: 502 }
      );
    }

    // Juez de parecido: si el primer intento sale bajo, UN reintento y nos
    // quedamos con el de mejor score. Best-effort: sin juez, pasa tal cual.
    const tJuez = Date.now();
    let veredicto = await juzgarParecido(faceB64, image);
    let msJuez = Date.now() - tJuez;
    let reintento = false;
    // La segunda generación solo sale si CABE. Vercel corta a los 60s: si la
    // primera ya se llevó el presupuesto, insistir no mejora el avatar —
    // mata la petición y la persona se queda sin nada después de esperar.
    const cabeOtra = Date.now() - t0Req < LIMITE_SEGUNDA_MS;
    if (veredicto && veredicto.score < JUDGE_MIN && cabeOtra) {
      reintento = true;
      const otra = await generarAvatar(parts, "3:4", { supabase, userId: user.id });
      msGen += otra.ms;
      if (otra.image) {
        const t2 = Date.now();
        const v2 = await juzgarParecido(faceB64, otra.image);
        msJuez += Date.now() - t2;
        if (v2 && v2.score > veredicto.score) {
          image = otra.image;
          veredicto = v2;
        }
      }
    }

    // Instrumentación del flywheel: cómo puntúa el juez y cuánto reintenta.
    await supabase.from("events").insert({
      user_id: user.id,
      type: "avatar_judge",
      data: {
        score: veredicto?.score ?? null,
        problema: veredicto?.problema || null,
        reintento,
        // CUÁNTO TARDÓ. Sin esto, "tardó muchísimo" no se podía contestar:
        // el evento decía el score y si reintentó, pero no el tiempo, así que
        // no había forma de separar "Gemini iba lento" de "la subida iba
        // lenta" de "el juez pidió otra". El motor sí lo registra
        // (generation_timing); esto no lo hacía.
        ms_generacion: msGen,
        // El juez y el TOTAL, por separado. Con un solo número no se puede
        // decir si "tardó muchísimo" fue Gemini, el juez, o todo lo demás
        // (descargar las fotos, subir el resultado): son arreglos distintos.
        ms_juez: msJuez,
        ms_total: Date.now() - t0Req,
        // Si el juez pidió otra y NO cupo, eso también es un dato: dice que el
        // presupuesto está apretado, no que el avatar haya salido bien.
        segunda_no_cupo:
          !!veredicto && veredicto.score < JUDGE_MIN && !reintento ? true : undefined,
        stage: stage ?? "legacy",
        ajuste: ajuste || null,
        n_caras: faces.length,
        n_cuerpos: bodies.length,
      },
    });

    // El veredicto ya no se tira: el wizard lo muestra ("ojo: {problema}") y
    // ofrece ajustes dirigidos cuando sale bajo.
    return NextResponse.json({
      image,
      score: veredicto?.score ?? null,
      problema: veredicto?.problema || null,
    });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
