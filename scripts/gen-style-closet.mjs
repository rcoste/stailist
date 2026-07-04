// Pipeline de Roberto: estilo → CLÓSET (qué prendas debería tener) → LOOKS (combina
// ese clóset) → render. Es el mapa del motor de cápsula + motor de outfits de la app,
// aplicado a una referencia de estilo. Prueba con Carla.
//   Uso: node scripts/gen-style-closet.mjs [N_looks]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const GKEY = env("GOOGLE_GENERATIVE_AI_API_KEY");
const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
const N = Number(process.argv[2] ?? 3);

const STYLIST = "Carla Figliozzi";
const BRIEF = `Minimalismo elevado latino/europeo: base de neutros que se eleva con UN protagonista por look (un color fuerte, un print, o una textura de lujo). Mezcla sastre pulido + relajado sin esfuerzo. Metal ORO, joyería delicada en capas. Sensibilidad resort-meets-city. Su vocabulario incluye: prints animales (leopardo, cebra), pops de color (fucsia, verde limón, mostaza, rojo), satén al bies, lino, tailoring oversized, pañuelos de seda, sombreros de paja, bolsas de rafia y bolsas negras estructuradas, sandalias/mules de tiras. Fuerte pero nunca ruidoso.`;

// ── PASO 2: definir el CLÓSET (motor de cápsula) ──
const CLOSET_SCHEMA = {
  type: "object",
  properties: {
    closet: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "slug corto único, ej. 'blazer-crema'" },
          nombre: { type: "string", description: "nombre humano en español" },
          categoria: { type: "string", enum: ["top", "bottom", "vestido", "saco", "abrigo", "calzado", "bolsa", "accesorio"] },
          desc: { type: "string", description: "descripción en inglés lista para render (color, material, corte, detalle)" },
        },
        required: ["id", "nombre", "categoria", "desc"],
        additionalProperties: false,
      },
    },
  },
  required: ["closet"],
  additionalProperties: false,
};

console.log(`PASO 2 — Opus define el clóset ideal de ${STYLIST}…`);
const r1 = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 4000,
  system: `Eres stylist senior. A partir del ESTILO de una persona, define el CLÓSET IDEAL que debería tener: ~24 prendas concretas (tops, bottoms, vestidos, sacos, abrigos, calzado, bolsas, accesorios) que encarnen su estilo. NO copies outfits; define PIEZAS individuales combinables. Incluye su vocabulario firma (colores, prints, texturas, siluetas) Y las básicas neutras que lo anclan. Piezas reales, específicas.`,
  messages: [{ role: "user", content: `ESTILO de ${STYLIST}:\n${BRIEF}\n\nDefine su clóset ideal (~24 piezas).` }],
  output_config: { format: { type: "json_schema", schema: CLOSET_SCHEMA } },
});
const { closet } = JSON.parse(r1.content.find((b) => b.type === "text").text);
console.log(`  ${closet.length} prendas:`);
for (const c of closet) console.log(`   · [${c.categoria}] ${c.nombre} (${c.id})`);

// ── PASO 3: armar LOOKS combinando SOLO ese clóset (motor de outfits) ──
const LOOKS_SCHEMA = {
  type: "object",
  properties: {
    looks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          ocasion: { type: "string" },
          items: { type: "array", items: { type: "string" }, description: "ids de prendas del clóset (solo de la lista dada)" },
          porque: { type: "string" },
        },
        required: ["titulo", "ocasion", "items", "porque"],
        additionalProperties: false,
      },
    },
  },
  required: ["looks"],
  additionalProperties: false,
};

console.log(`\nPASO 3 — Opus arma ${N} looks combinando SOLO ese clóset…`);
const r2 = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 2000,
  system: `Eres stylist. Arma ${N} looks completos combinando ÚNICAMENTE prendas del clóset dado (por id). Cada look: 1 protagonista + resto neutro, coherente, con su fórmula. Varía la ocasión. NO inventes prendas fuera del clóset.`,
  messages: [{ role: "user", content: `CLÓSET (id · nombre):\n${closet.map((c) => `${c.id} · ${c.nombre}`).join("\n")}\n\nArma ${N} looks.` }],
  output_config: { format: { type: "json_schema", schema: LOOKS_SCHEMA } },
});
const { looks } = JSON.parse(r2.content.find((b) => b.type === "text").text);

// ── Render en Valeria ──
const byId = Object.fromEntries(closet.map((c) => [c.id, c]));
const avatar = readFileSync("docs_para_claude/avateres styles/Gemini_Generated_Image_uvg4iuvg4iuvg4iu.png").toString("base64");
const VIBE = "FRAMING: candid, un-posed, slightly off-axis three-quarter, off-center, full outfit head to feet. Clean Gen-Z aesthetic: cool neutral daylight, plain flat light-grey concrete wall, NO warm golden tones, NO stucco, neutral white balance, crisp. Photorealistic. No text, no logos.";

let i = 0;
for (const look of looks) {
  i++;
  const pieces = look.items.map((id) => byId[id]).filter(Boolean);
  const desc = pieces.map((p) => p.desc).join(", ");
  console.log(`\n[${i}] ${look.titulo} · ${look.ocasion}\n   ${pieces.map((p) => p.nombre).join(" + ")}\n   ↳ ${look.porque}`);
  const text = `Candid full-body street-style fashion photograph of the SAME woman shown in the reference image. Keep her exact face, long wavy brown hair, skin tone, body and natural expression identical to the reference. She is wearing an outfit made of: ${desc}. ${VIBE}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${GKEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }, { inlineData: { mimeType: "image/png", data: avatar } }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }),
  });
  if (!res.ok) { console.error(`  ERROR ${i}: ${res.status}`); continue; }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) { console.error(`  sin imagen ${i}`); continue; }
  writeFileSync(`docs_para_claude/outfit-inspo/CFZ/closet-look-${i}.png`, Buffer.from(part.inlineData.data, "base64"));
  console.log(`   OK → closet-look-${i}.png`);
}
console.log("\nLISTO");
