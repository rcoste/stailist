import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "@/lib/item-image";

export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3-pro-image";

// Cómo se LLEVA la ropa, no solo cuál es. El prompt ya cuidaba la POSE ("no una
// pose de catálogo") pero no el prendido, y el modelo abrochaba todo hasta
// arriba: camisas cerradas al cuello y polos con los tres botones puestos, que
// es como nadie se viste (lo cachó Roberto: "renderea muy nerd el look"). La
// excepción es real y hay que decirla — con corbata o traje formal, la camisa SÍ
// va cerrada — y el tip de styling del outfit, que se inyecta más abajo, manda
// por encima de esto (si dice "abróchate hasta arriba", se obedece).
const COMO_SE_LLEVA =
  " Style the garments the way a well-dressed person actually wears them, never like a shop mannequin: leave a shirt's top button undone (two if the look is casual), and a polo's placket open or with a single button fastened. EXCEPTION: if the outfit includes a tie, or is clearly formal (a suit worn with a dress shirt), button the shirt all the way up. If the styling note below says otherwise, the note wins.";

const PROMPT_TAIL =
  " Keep the person's face, facial expression, apparent age, body type, skin tone and hair identical. Replace only their outfit with the provided garments." +
  COMO_SE_LLEVA +
  " Plain flat light-grey wall, cool neutral daylight (no warm golden tones), crisp and clear. Candid Gen-Z street-style: a relaxed off-axis three-quarter pose looking slightly away, NOT a stiff straight-on catalog pose. Keep the person's natural facial expression from the first image — do NOT change or neutralize it (if they are smiling, keep the smile). Full body head to feet. No text.";

const PROMPT =
  "Generate a photorealistic full-body image of the PERSON in the first image wearing the exact clothing items shown in the following images." +
  PROMPT_TAIL;

// Variante multi-vista (A2): cuando existen el retrato aprobado y/o el sheet de
// 3 vistas del avatar, van como referencias de identidad ANTES de las prendas —
// la identidad se copia (consistente entre try-ons) en vez de re-interpretarse.
function promptMultiVista(nIdentity: number, hasFace: boolean, hasSheet: boolean): string {
  const refs = [
    "their full-body reference",
    ...(hasFace ? ["a close-up approved portrait"] : []),
    ...(hasSheet ? ["a reference sheet showing them from the front, profile and back"] : []),
  ].join(", ");
  return (
    `Generate a photorealistic full-body image of the PERSON shown in the first ${nIdentity} images (${refs} — all the SAME person; use them to keep the face, hair and identity perfectly consistent) wearing the exact clothing items shown in the remaining images. ` +
    "The plain white t-shirt and blue jeans worn in the person references are just their base clothing — do NOT include them in the outfit unless they appear among the garment images." +
    PROMPT_TAIL
  );
}

// El media_type debe coincidir con los bytes (Gemini es laxo, pero el retrato y
// el sheet salen de Gemini y pueden ser PNG aunque se guarden como .jpg).
function mediaTypeOf(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

// Construye el prompt final inyectando el TIP de styling del outfit (cómo se lleva
// el look: arremangar, fajar, abrir un botón…) para que la imagen lo refleje. El
// tip viene en español; Gemini lo entiende. Sin tip, el prompt base tal cual.
function buildPrompt(
  tip: string | null,
  garments: string[],
  identity?: { n: number; hasFace: boolean; hasSheet: boolean },
  sinImagen: string[] = []
): string {
  let p =
    identity && identity.n > 1
      ? promptMultiVista(identity.n, identity.hasFace, identity.hasSheet)
      : PROMPT;
  // Ancla de texto (red de seguridad): nombra las prendas (en español; Gemini las
  // entiende). Si por lo que sea una imagen no llega, el modelo no inventa una
  // prenda genérica — sabe que es "un suéter esmeralda", no una t-shirt blanca.
  if (garments.length > 0) {
    p += ` The garments are (described in Spanish): ${garments.join("; ")}.`;
  }
  // Y cuando SÍ falta una imagen, decirlo explícitamente. La lista de arriba
  // sola no alcanzó: es una descripción pasiva compitiendo contra imágenes
  // concretas, y el modelo resolvió dejando la playera blanca base del avatar
  // donde el outfit pedía una camisa de lino esmeralda. Nombrar la prenda
  // faltante como INSTRUCCIÓN —y prohibir el relleno por default— es lo que
  // cierra el hueco mientras la prenda consigue su render.
  if (sinImagen.length > 0) {
    p +=
      ` IMPORTANT — these garments have NO reference image and you must render them from their Spanish description alone: ${sinImagen.join("; ")}.` +
      " They are part of the outfit and MUST appear on the body, with the exact garment type, colour and fabric their description states." +
      " Do NOT substitute them with the person's base clothing (the plain white t-shirt or blue jeans) and do NOT omit them.";
  }
  const t = (tip ?? "").trim();
  if (t) {
    p += ` IMPORTANT styling detail — wear the garments following this note (written in Spanish), reflecting it visibly in how the clothes are styled on the body: "${t}".`;
  }
  return p;
}

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

// "Verme con este look": viste el avatar de la usuaria con las prendas reales
// del outfit usando Gemini 3 Pro Image. Cachea el resultado por outfit (no
// regenera). Bajo demanda — cada try-on cuesta y tarda. Gemini genera, Claude
// razona.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  let body: { outfitId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { outfitId } = body;
  if (!outfitId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Avatar de la usuaria
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  if (!profile?.avatar_path) {
    return NextResponse.json({ error: "sin_avatar" }, { status: 200 });
  }

  // Outfit (y cache si ya se generó antes)
  const { data: outfit } = await supabase
    .from("outfits")
    .select("id, item_ids, tryon_path, tip")
    .eq("id", outfitId)
    .eq("user_id", user.id)
    .single();
  if (!outfit) return NextResponse.json({ error: "no_outfit" }, { status: 404 });

  const signFresh = async (path: string) => {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  if (outfit.tryon_path) {
    const url = await signFresh(outfit.tryon_path);
    if (url) return NextResponse.json({ image: url, cached: true });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  // Resolver las imágenes: avatar (privado) + cada prenda (arquetipo público o
  // foto propia privada).
  const { data: items } = await supabase
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .in("id", outfit.item_ids as string[]);

  const origin = request.nextUrl.origin;
  const avatarUrl = await signFresh(profile.avatar_path);
  if (!avatarUrl) return NextResponse.json({ error: "avatar" }, { status: 502 });

  // Imagen de cada prenda vía el resolver único (pickItemImage): arquetipo → render
  // limpio → foto → prestada. Pública = origin + ruta; privada = URL firmada.
  const prendaUrls: string[] = [];
  const prendaNames: string[] = [];
  const sinImagen: string[] = [];
  for (const it of items ?? []) {
    const archName = (it.archetypes as { name?: string | null } | null)?.name;
    const attrs = (it.attrs ?? {}) as { nombre?: string; color?: string };
    const nm = (archName ?? attrs.nombre ?? "").trim();
    if (nm) {
      prendaNames.push(
        attrs.color && !nm.toLowerCase().includes(attrs.color.toLowerCase())
          ? `${nm} (color ${attrs.color})`
          : nm
      );
    }
    const pick = pickItemImage(it as ItemImageRow);
    const u = pick
      ? pick.kind === "public"
        ? origin + pick.path
        : await signFresh(pick.path)
      : null;
    if (u) prendaUrls.push(u);
    else sinImagen.push(nm || (it.id as string));
  }
  // Guard: si una prenda no aportó imagen, el avatar podría inventarla. Lo dejamos
  // en los logs (con outfit/usuario/prenda) para enterarnos al instante si esto
  // regresa, en vez de esperar a que un usuario lo note. El ancla de texto del
  // prompt mitiga, pero esto avisa que algo quedó corto.
  if (sinImagen.length > 0) {
    console.warn(
      `[tryon] outfit=${outfitId} user=${user.id}: ${sinImagen.length}/${(items ?? []).length} prendas sin imagen → ${sinImagen.join(", ")}`
    );
  }
  if (prendaUrls.length === 0) {
    return NextResponse.json({ error: "sin_prendas" }, { status: 400 });
  }

  const avatarB64 = await fetchAsBase64(avatarUrl);
  const prendasB64 = (await Promise.all(prendaUrls.map(fetchAsBase64))).filter(
    (b): b is string => !!b
  );
  if (!avatarB64 || prendasB64.length === 0) {
    return NextResponse.json({ error: "descarga" }, { status: 502 });
  }

  // Referencias de identidad extra (A2, best-effort): el retrato aprobado y el
  // sheet de 3 vistas, si el avatar se creó con el wizard nuevo. Sin ellos, el
  // flujo queda EXACTAMENTE como antes (gating: cero riesgo para avatares viejos).
  const signAndFetch = async (path: string) => {
    const url = await signFresh(path);
    return url ? fetchAsBase64(url) : null;
  };
  const [faceRefB64, sheetRefB64] = await Promise.all([
    signAndFetch(`${user.id}/avatar-face.jpg`),
    signAndFetch(`${user.id}/avatar-sheet.jpg`),
  ]);
  const identityB64 = [avatarB64, faceRefB64, sheetRefB64].filter(
    (b): b is string => !!b
  );

  try {
    const parts = [
      {
        text: buildPrompt(
          (outfit.tip as string | null) ?? null,
          prendaNames,
          {
            n: identityB64.length,
            hasFace: !!faceRefB64,
            hasSheet: !!sheetRefB64,
          },
          sinImagen
        ),
      },
      ...identityB64.map((d) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } })),
      ...prendasB64.map((d) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } })),
    ];
    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "3:4" },
          },
        }),
      }
    );
    if (!gemRes.ok) return NextResponse.json({ error: "generacion" }, { status: 502 });
    const data = await gemRes.json();
    const img = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string } }) => p.inlineData?.data
    );
    if (!img) return NextResponse.json({ error: "sin_imagen" }, { status: 502 });

    const buffer = Buffer.from(img.inlineData.data, "base64");
    const path = `${user.id}/tryons/${outfitId}.jpg`;
    const up = await supabase.storage
      .from("prendas")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
    if (up.error) return NextResponse.json({ error: "guardar" }, { status: 502 });

    await supabase.from("outfits").update({ tryon_path: path }).eq("id", outfitId);
    const url = await signFresh(path);
    return NextResponse.json({ image: url, cached: false });
  } catch {
    return NextResponse.json({ error: "generacion" }, { status: 502 });
  }
}
