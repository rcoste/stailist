import { CLASSIFY_MODEL } from "@/lib/models";
import { NextResponse, type NextRequest } from "next/server";
import { PERMISO_PENDIENTE_MSG } from "@/lib/consentimiento";
import { fotosBloqueadas, type AgeRange } from "@/lib/edad";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { seasonDisplayLabel, type Season } from "@/lib/colorimetria";
import { buildLabel, volumeLabel } from "@/lib/silueta";
import { vetoLabels } from "@/lib/vetoes";
import type { Build, Volume } from "@/lib/silueta";
import type { StyleVetoes } from "@/lib/vetoes";

export const maxDuration = 60;

// Estilo de referencia (v2): sube 1-3 fotos de un estilo que te gusta. La IA
// describe el estilo Y evalúa si te VA a TI (contra tu colorimetría, silueta y
// vetos) → veredicto + nota honesta. NO guarda: devuelve un preview para que el
// usuario decida absorberlo o no (el pushback es parte del valor de la app).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no_auth" }, { status: 401 });

  // Un solo fetch de perfil sirve al gate de menores Y a la evaluación de FIT
  // de más abajo (antes eran dos selects a la misma fila por request).
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select(
      "palette_season, palette_flow, body_build, body_volume, style_vetoes, gender, age_range, minor_consent_verified_at"
    )
    .eq("id", user.id)
    .single();
  // Menor (13-17) sin permiso parental confirmado: las fotos quedan bloqueadas.
  // Fail-closed: si el select falló, no dejes pasar la subida.
  // Sin fila (PGRST116) = sin señal de menor → no bloquea (misma semántica
  // que photosBlockedForUser); cualquier otro error → fail-closed.
  const blockedMinor = profErr
    ? profErr.code !== "PGRST116"
    : prof
      ? fotosBloqueadas({
          age_range: (prof.age_range as AgeRange | null) ?? null,
          minor_consent_verified_at:
            (prof.minor_consent_verified_at as string | null) ?? null,
        })
      : false;
  if (blockedMinor) {
    return NextResponse.json(
      { error: "permiso_pendiente", message: PERMISO_PENDIENTE_MSG },
      { status: 403 }
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  // `images` = fotos NUEVAS (data URL). `keep` = rutas de fotos que la persona
  // YA tenía guardadas y quiere conservar: se SUMAN en vez de reemplazarse.
  // Van por ruta y no re-subidas — el servidor las baja del bucket para el
  // análisis, así que ni se duplican en storage ni chocan con CORS desde el
  // navegador. El resumen se recalcula sobre el conjunto COMPLETO: es una
  // lectura del estilo entero, no de la última foto.
  let body: { images?: string[]; keep?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const MAX_FOTOS = 3;
  const keep = (Array.isArray(body.keep) ? body.keep : [])
    .filter((p): p is string => typeof p === "string" && p.startsWith(`${user.id}/`))
    .slice(0, MAX_FOTOS);
  const raw = Array.isArray(body.images)
    ? body.images.slice(0, Math.max(0, MAX_FOTOS - keep.length))
    : [];
  const parsed = raw
    .map((d) => d.match(/^data:(image\/\w+);base64,(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m);
  if (parsed.length === 0 && keep.length === 0) {
    return NextResponse.json({ error: "bad_image" }, { status: 400 });
  }

  // Las conservadas se bajan del bucket para poder mandárselas a la visión.
  const keptParsed: [string, string, string][] = [];
  for (const path of keep) {
    const { data: blob } = await supabase.storage.from("prendas").download(path);
    if (!blob) continue;
    const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    keptParsed.push([path, path.endsWith(".png") ? "image/png" : "image/jpeg", b64]);
  }

  // Sube cada foto NUEVA al bucket privado (referencia del usuario).
  const image_paths: string[] = keptParsed.map(([p]) => p);
  for (const m of parsed) {
    const [, mt, b64] = m;
    const ext = mt.includes("png") ? "png" : "jpg";
    const path = `${user.id}/style-ref/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const up = await supabase.storage
      .from("prendas")
      .upload(path, bytes, { contentType: mt, upsert: false });
    if (!up.error) image_paths.push(path);
  }
  if (image_paths.length === 0) return NextResponse.json({ error: "upload" }, { status: 502 });

  // Lo que ve la IA: las conservadas + las nuevas, en ese orden.
  const paraVision: { mt: string; b64: string }[] = [
    ...keptParsed.map(([, mt, b64]) => ({ mt, b64 })),
    ...parsed.map((m) => ({ mt: m[1], b64: m[2] })),
  ];

  // El perfil para el FIT ya se cargó arriba (mismo fetch que el gate).
  const season = (prof?.palette_season as Season | null) ?? null;
  const flow = (prof?.palette_flow as Season | null) ?? null;
  const colorim = season ? seasonDisplayLabel(season, flow) : "sin definir";
  const build = prof?.body_build as Build | null;
  const vol = prof?.body_volume as Volume | null;
  const silueta =
    build || vol
      ? [build ? buildLabel(build) : null, vol ? volumeLabel(vol) : null].filter(Boolean).join(" · ")
      : "sin definir";
  const vetos = vetoLabels((prof?.style_vetoes as StyleVetoes) ?? { chips: [], free: [] });
  const perfil = `Colorimetría de la clienta: ${colorim}. Silueta: ${silueta}. Vetos (jamás usar): ${
    vetos.length ? vetos.join(", ") : "ninguno"
  }.`;

  try {
    const client = new Anthropic();
    const content: Anthropic.MessageParam["content"] = paraVision.map((im) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: im.mt as "image/jpeg" | "image/png",
        data: im.b64,
      },
    }));
    content.push({
      type: "text",
      text: `Estas ${paraVision.length} foto(s) muestran un estilo que le gusta a tu clienta. ${perfil}\n\nDescribe el ESTILO (no a las personas) y, sobre todo, evalúa si le VA a ELLA según su colorimetría, silueta y vetos. Sé honesta — si algo no le favorece, dilo (ese es tu valor como estilista).`,
    });

    const res = await client.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 800,
      system:
        "Eres la estilista de la clienta. Miras 1-3 fotos de un estilo que le gusta y haces dos cosas: (1) describes el ESTILO (estética, prendas, siluetas, formalidad, aire de paleta), NUNCA el físico ni la identidad de quien aparece; (2) evalúas honestamente si ese estilo le VA a ELLA según su colorimetría, silueta y vetos. Voz cálida y directa, tuteo, cero jerga técnica de moda. Devuelve: `summary` (1-2 frases del estilo, que un motor de outfits pueda usar para empujar el VIBE y las siluetas, no el color); `tags` (4-6 etiquetas cortas en minúscula); `fit.verdict` ('va' = le queda increíble | 'ajustes' = le va pero hay que adaptarlo | 'ojo' = hay cosas que NO le favorecen); `fit.note` (1-2 frases honestas: por qué le va, o qué adaptar, o qué cuidar — menciona colorimetría/silueta/vetos concretos cuando aplique; ej: 'me encanta el aire sastre para ti; pero su paleta es muy cálida y a ti te lucen los fríos, así que te lo llevo a tus tonos'). Si choca con un veto, dilo claro.",
      messages: [{ role: "user", content }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              tags: { type: "array", items: { type: "string" } },
              fit: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["va", "ajustes", "ojo"] },
                  note: { type: "string" },
                },
                required: ["verdict", "note"],
                additionalProperties: false,
              },
            },
            required: ["summary", "tags", "fit"],
            additionalProperties: false,
          },
        },
      },
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) throw new Error("vacio");
    const out = JSON.parse(text) as {
      summary: string;
      tags: string[];
      fit: { verdict: string; note: string };
    };
    const summary = (out.summary ?? "").trim();
    if (!summary) throw new Error("vacio");
    const tags = (out.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 6);

    // Firma las fotos para el preview (aún NO se guarda en el perfil).
    const { data: signed } = await supabase.storage
      .from("prendas")
      .createSignedUrls(image_paths, 3600);
    const images = (signed ?? []).map((s, i) => ({
      path: image_paths[i],
      url: s.signedUrl ?? null,
    }));

    return NextResponse.json({ summary, tags, fit: out.fit, images });
  } catch {
    // Falló el análisis → limpia solo las fotos NUEVAS. Las conservadas siguen
    // siendo su referencia guardada: borrarlas dejaría el perfil apuntando a
    // archivos que ya no existen.
    const nuevas = image_paths.filter((p) => !keep.includes(p));
    if (nuevas.length) await supabase.storage.from("prendas").remove(nuevas);
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
