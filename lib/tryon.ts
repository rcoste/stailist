import type { SupabaseClient } from "@supabase/supabase-js";
import { pickItemImage, ITEM_IMAGE_SELECT, type ItemImageRow } from "@/lib/item-image";
import { pedirImagen } from "@/lib/gemini-imagen";

// El NÚCLEO del try-on: vestir el avatar de una persona con unas prendas
// concretas. Vivía dentro de /api/tryon, atado a la tabla `outfits` en tres
// puntos (de dónde salen las prendas, dónde se cachea, dónde se guarda).
//
// Se extrajo cuando el comparador de motores necesitó try-on: ahí los looks
// NO tienen fila en `outfits` a propósito (correr un experimento no debe
// ensuciar tu historial ni el flywheel). La alternativa era copiar el prompt
// y el pipeline de imágenes — exactamente la clase de arnés-que-imita que
// este proyecto ya pagó con un día de bugs. Así que el prompt, las
// referencias de identidad y el guard de prendas-sin-imagen viven aquí, y los
// dos caminos los llaman.
//
// Lo que cada quien pone: de dónde salen item_ids/tip, y en qué ruta se
// cachea el resultado.

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

export type ResultadoTryon =
  | { image: string; cached: boolean }
  | { error: string; status: number; detalle?: string };

/**
 * Genera (o recupera del caché) la imagen del avatar vestido con `itemIds`.
 *
 * `cachePath` es la ruta en el bucket privado donde vive el resultado: quien
 * llama decide su clave (por outfit en producción, por lado en el comparador)
 * y también dónde apuntarla en su propia tabla — esta función solo sube la
 * imagen y devuelve su URL firmada.
 *
 * `yaGenerado`: si quien llama ya sabe que existe un try-on previo, pasa su
 * ruta y se sirve sin volver a generar (un render cuesta y tarda 20-40s).
 */
export async function generarTryon(opciones: {
  supabase: SupabaseClient;
  userId: string;
  itemIds: string[];
  tip: string | null;
  cachePath: string;
  yaGenerado?: string | null;
  /** El origin de la petición: las imágenes públicas se piden absolutas. */
  origin: string;
}): Promise<ResultadoTryon> {
  const { supabase, userId, itemIds, tip, cachePath, yaGenerado, origin } = opciones;

  const signFresh = async (path: string) => {
    const { data } = await supabase.storage.from("prendas").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  if (yaGenerado) {
    const url = await signFresh(yaGenerado);
    if (url) return { image: url, cached: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .single();
  if (!profile?.avatar_path) return { error: "sin_avatar", status: 200 };

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { error: "sin_api_key", status: 503 };
  }

  const { data: items } = await supabase
    .from("items")
    .select(`id, ${ITEM_IMAGE_SELECT}`)
    .in("id", itemIds);

  const avatarUrl = await signFresh(profile.avatar_path);
  if (!avatarUrl) return { error: "avatar", status: 502 };

  // Imagen de cada prenda vía el resolver único (pickItemImage): arquetipo →
  // render limpio → foto → prestada. Pública = origin + ruta; privada = firmada.
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
  // Guard: si una prenda no aportó imagen, el avatar podría inventarla. Queda
  // en los logs para enterarnos al instante si esto regresa.
  if (sinImagen.length > 0) {
    console.warn(
      `[tryon] user=${userId} cache=${cachePath}: ${sinImagen.length}/${(items ?? []).length} prendas sin imagen → ${sinImagen.join(", ")}`
    );
  }
  if (prendaUrls.length === 0) return { error: "sin_prendas", status: 400 };

  const avatarB64 = await fetchAsBase64(avatarUrl);
  const prendasB64 = (await Promise.all(prendaUrls.map(fetchAsBase64))).filter(
    (b): b is string => !!b
  );
  if (!avatarB64 || prendasB64.length === 0) return { error: "descarga", status: 502 };

  // Referencias de identidad extra (A2, best-effort): el retrato aprobado y el
  // sheet de 3 vistas, si el avatar se creó con el wizard nuevo.
  const signAndFetch = async (path: string) => {
    const url = await signFresh(path);
    return url ? fetchAsBase64(url) : null;
  };
  const [faceRefB64, sheetRefB64] = await Promise.all([
    signAndFetch(`${userId}/avatar-face.jpg`),
    signAndFetch(`${userId}/avatar-sheet.jpg`),
  ]);
  const identityB64 = [avatarB64, faceRefB64, sheetRefB64].filter(
    (b): b is string => !!b
  );

  try {
    const parts = [
      {
        text: buildPrompt(tip, prendaNames, {
          n: identityB64.length,
          hasFace: !!faceRefB64,
          hasSheet: !!sheetRefB64,
        }, sinImagen),
      },
      ...identityB64.map((d) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } })),
      ...prendasB64.map((d) => ({ inlineData: { mimeType: mediaTypeOf(d), data: d } })),
    ];
    const r = await pedirImagen(parts);
    if ("motivo" in r) {
      return { error: "generacion", status: 502, detalle: r.motivo.slice(0, 200) };
    }

    const buffer = Buffer.from(r.data, "base64");
    const up = await supabase.storage
      .from("prendas")
      .upload(cachePath, buffer, { contentType: "image/jpeg", upsert: true });
    if (up.error) return { error: "guardar", status: 502 };

    const url = await signFresh(cachePath);
    if (!url) return { error: "guardar", status: 502 };
    return { image: url, cached: false };
  } catch (e) {
    // Lo que llegue aquí ya NO es del servicio de imágenes (eso se maneja
    // arriba, intento por intento): es nuestro, así que se dice cuál fue.
    const detalle = e instanceof Error ? e.message : "falló";
    console.error(`[tryon] error inesperado — ${detalle}`);
    return { error: "generacion", status: 502, detalle: detalle.slice(0, 200) };
  }
}
