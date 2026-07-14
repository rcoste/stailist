import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PATRONES, type Patron } from "@/lib/prenda-atributos";

export const maxDuration = 60;

// Campos que el modelo puede marcar como inseguros (los que el usuario puede
// corregir). Fuente única para el schema y la UI. Nombres = claves de PrendaAnalisis.
export const INSEGURO_CAMPOS = [
  "nombre",
  "categoria",
  "color",
  "formalidad",
  "temporada",
  "material",
  "patron",
] as const;
export type InseguroCampo = (typeof INSEGURO_CAMPOS)[number];

export type PrendaAnalisis = {
  nombre: string;
  categoria: "top" | "saco" | "bottom" | "calzado" | "abrigo" | "vestido" | "accesorio";
  color: string;
  color_hex: string;
  formalidad: "casual" | "formal-casual" | "formal";
  temporada: "calor" | "templado" | "frio" | "todo-el-año";
  // Atributos de styling (opcionales): habilitan tips de "cómo llevarlo"
  // (fajar/arremangar/proporción). El modelo los llena cuando aplican.
  largo?: "crop" | "regular" | "largo";
  corte?: "entallado" | "recto" | "holgado";
  manga?: "sin" | "corta" | "larga";
  // Atributos de combinación (opcionales): el motor los usa para juzgar mejor
  // (no lana en calor, no dos estampados que pelean, color real de bicolores).
  material?: string; // tela/material aparente: "algodón", "lana", "mezclilla", "piel"…
  patron?: Patron; // vocabulario compartido en lib/prenda-atributos
  color_secundario?: string; // segundo color visible si la prenda es claramente bicolor; ausente si no
  // Anti-alucinación ("prefer omission over invention"): en vez de adivinar con
  // falsa seguridad, el modelo declara su confianza y qué campos dudó. La UI
  // resalta esos campos para que el usuario confirme justo lo que importa.
  confianza?: "alta" | "media" | "baja";
  inseguro?: InseguroCampo[]; // campos de los que NO está seguro
};

// Claude vision mira la foto de UNA prenda y devuelve sus atributos. El
// usuario confirma/ajusta después (la detección nunca bloquea — falla #1 del
// alfa era inventar; aquí la persona corrige en un tap). Gemini genera, Claude
// analiza.
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

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system:
        "Eres experta en moda. Miras la foto de UNA prenda y describes sus atributos para un clóset digital. El nombre es corto y natural en español ('Jeans rectos azules', 'Tenis blancos de piel'). Identifica con cuidado el TIPO exacto de prenda, que es lo que más se confunde: un POLO (tejido de punto, cuello tejido con botonadura corta de 2-3 botones, sin abertura completa) NO es una camisa (tela plana, botonadura de arriba a abajo); una playera/camiseta (sin botones ni cuello rígido) tampoco es una camisa; una sudadera no es un suéter; unos chinos no son jeans. Ante la duda entre polo y camisa, fíjate en si la botonadura llega hasta abajo (camisa) o solo al pecho (polo). CATEGORÍA — distingue con cuidado: 'saco' = saco, blazer, saco de traje o smoking (prenda estructurada de torso que se usa por FORMALIDAD, no por frío); 'abrigo' = SOLO capas por clima (abrigo, gabardina, parka, cárdigan, suéter grueso de capa). Un traje se registra como dos prendas: el saco (categoría 'saco') y su pantalón (categoría 'bottom'), por separado. El color_hex es el color dominante real de la prenda (el de la TELA, ignorando sombras y luz de la foto). Si la prenda es claramente bicolor o estampada con un segundo color protagonista (rayas azul/blanco, colorblock), da también color_secundario (nombre del segundo color); si es de un solo color, omítelo. Da el material aparente de la tela ('algodón', 'lana', 'mezclilla', 'lino', 'piel', 'ante', 'punto', 'sintético', 'seda'…) — importa para clima y combinación; si no se distingue, omítelo en vez de adivinar. Da el patron: 'liso' si no tiene estampado, o el que tenga (rayas/cuadros/floral/animal-print/grafico/estampado). Si hay varias prendas o ninguna clara, elige la prenda principal. Cuando apliquen a la prenda, agrega también largo (crop/regular/largo), corte (entallado/recto/holgado) y manga (sin/corta/larga) — sirven para sugerir cómo llevarla. IMPORTANTE — prefiere marcar inseguridad antes que inventar: si la foto no te deja distinguir bien un atributo (el tipo exacto, el material, la formalidad, el color real bajo la luz), da tu mejor estimación PERO agrégalo a 'inseguro' con el nombre del campo (nombre/categoria/color/formalidad/temporada/material/patron). Es mejor una duda honesta que un dato inventado con falsa seguridad — el usuario la confirma en un tap. 'confianza' resume qué tan clara está la foto: 'alta' si todo se ve nítido, 'media' si algo cuesta, 'baja' si la foto es ambigua (mala luz, prenda arrugada, varias prendas). Si estás seguro de todo, deja 'inseguro' vacío y 'confianza' en 'alta'.",
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
            {
              type: "text",
              text: "Describe esta prenda para mi clóset.",
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
              nombre: { type: "string" },
              categoria: {
                type: "string",
                enum: ["top", "saco", "bottom", "calzado", "abrigo", "vestido", "accesorio"],
              },
              color: { type: "string" },
              color_hex: { type: "string" },
              formalidad: {
                type: "string",
                enum: ["casual", "formal-casual", "formal"],
              },
              temporada: {
                type: "string",
                enum: ["calor", "templado", "frio", "todo-el-año"],
              },
              largo: { type: "string", enum: ["crop", "regular", "largo"] },
              corte: { type: "string", enum: ["entallado", "recto", "holgado"] },
              manga: { type: "string", enum: ["sin", "corta", "larga"] },
              material: { type: "string" },
              patron: { type: "string", enum: [...PATRONES] },
              color_secundario: { type: "string" },
              confianza: { type: "string", enum: ["alta", "media", "baja"] },
              inseguro: {
                type: "array",
                items: { type: "string", enum: [...INSEGURO_CAMPOS] },
              },
            },
            required: [
              "nombre",
              "categoria",
              "color",
              "color_hex",
              "formalidad",
              "temporada",
              "patron",
              "confianza",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "vacio" }, { status: 502 });
    const analisis = JSON.parse(text) as PrendaAnalisis;
    return NextResponse.json({ analisis });
  } catch {
    return NextResponse.json({ error: "analisis" }, { status: 502 });
  }
}
