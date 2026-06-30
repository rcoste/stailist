import { NextResponse, type NextRequest } from "next/server";
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "sin_api_key" }, { status: 503 });
  }

  let body: { images?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const raw = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
  const parsed = raw
    .map((d) => d.match(/^data:(image\/\w+);base64,(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m);
  if (parsed.length === 0) return NextResponse.json({ error: "bad_image" }, { status: 400 });

  // Sube cada foto al bucket privado (referencia del usuario).
  const image_paths: string[] = [];
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

  // Perfil del usuario para evaluar el FIT.
  const { data: prof } = await supabase
    .from("profiles")
    .select("palette_season, palette_flow, body_build, body_volume, style_vetoes, gender")
    .eq("id", user.id)
    .single();
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
    const content: Anthropic.MessageParam["content"] = parsed.map((m) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: m[1] as "image/jpeg" | "image/png",
        data: m[2],
      },
    }));
    content.push({
      type: "text",
      text: `Estas ${parsed.length} foto(s) muestran un estilo que le gusta a tu clienta. ${perfil}\n\nDescribe el ESTILO (no a las personas) y, sobre todo, evalúa si le VA a ELLA según su colorimetría, silueta y vetos. Sé honesta — si algo no le favorece, dilo (ese es tu valor como estilista).`,
    });

    const res = await client.messages.create({
      model: "claude-opus-4-8",
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
    // Falló el análisis → limpia las fotos huérfanas.
    await supabase.storage.from("prendas").remove(image_paths);
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
