// EXPERIMENTO: ¿puede la IA copiar el estilo de un stylist SIN límite de clóset?
// 1) Opus genera N outfits nuevos a partir de un brief de estilo (de cero, no
//    combina un inventario). 2) Cada outfit se renderiza en el avatar "Valeria"
//    con el vibe canónico v3 (muro gris, luz fría, candid). Imprime los outfits
//    y guarda docs_para_claude/outfit-inspo/CFZ/engine-<i>.png.
//
// Uso:  node scripts/gen-style-copy.mjs [N]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const GKEY = env("GOOGLE_GENERATIVE_AI_API_KEY");
const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
const N = Number(process.argv[2] ?? 3);

// Brief de estilo de Carla Figliozzi — PRINCIPIOS abstractos, NO su inventario.
// El test justo: ¿el estilo generaliza a prendas nuevas que ella no ha usado?
const STYLIST = "Carla Figliozzi";
const BRIEF = `PRINCIPIOS de su estilo (NO una lista de sus prendas):
- Minimalismo elevado: base tranquila de neutros, todo el look gira alrededor de UN solo protagonista (un color fuerte, O un print, O una textura de lujo), y lo demás calla.
- Mezcla sastre + relajado: una pieza pulida/estructurada junto a algo suelto y sin esfuerzo.
- Proporción considerada, silueta limpia; effortless, nunca fussy. Fuerte pero nunca ruidoso.
- Metal ORO: joyería delicada en capas, siempre cálida.
- Sensibilidad resort-meets-city, mujer latina segura.`;
const AVOID = `PROHIBIDO reusar su vocabulario conocido (usarlo sería hacer trampa): NADA de print leopardo/cebra/vaca/gingham; NADA de fucsia, verde limón/chartreuse, mostaza; NADA de faldas o vestidos slip de satén al bies; NADA de bolsas de rafia/paja ni bucket hats; NO uses el blazer oversized como el statement. En su lugar INVENTA prendas, colores, prints y siluetas FRESCAS que ella NO haya usado, que aun así encarnen los principios de arriba.`;

const SCHEMA = {
  type: "object",
  properties: {
    outfits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ocasion: { type: "string", description: "2-3 palabras: día casual, cena, evento, etc." },
          titulo: { type: "string", description: "nombre corto del look" },
          render: { type: "string", description: "El look COMPLETO head-to-toe en UNA frase en inglés, pieza por pieza (top, bottom o vestido, exterior si aplica, calzado, bolsa, accesorios), lista para un prompt de imagen. Específica en color/material/corte." },
          porque: { type: "string", description: "una línea en español: por qué es su estilo" },
        },
        required: ["ocasion", "titulo", "render", "porque"],
        additionalProperties: false,
      },
    },
  },
  required: ["outfits"],
  additionalProperties: false,
};

console.log(`Pidiendo a Opus ${N} outfits en el estilo de ${STYLIST}…`);
const resp = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 3000,
  system: `Eres la stylist personal que CANALIZA la estética de ${STYLIST}. ESTE ES UN TEST DE GENERALIZACIÓN: hay que demostrar que su estilo sobrevive con vocabulario NUEVO. Inventa outfits que encarnen sus PRINCIPIOS pero con prendas, colores, prints y siluetas que ella NO haya usado. Cada outfit es un look completo de pies a cabeza, coherente, con proporción cuidada y su fórmula abstracta (neutros + UN protagonista + oro). Varía la ocasión entre los ${N}. Si un look podría confundirse con una de sus fotos existentes, fallaste: empújalo a algo fresco que igual se sienta 100% ella.`,
  messages: [{ role: "user", content: `${STYLIST} — PRINCIPIOS:\n${BRIEF}\n\n${AVOID}\n\nGenera ${N} outfits nuevos que prueben que su estilo generaliza a prendas frescas.` }],
  output_config: { format: { type: "json_schema", schema: SCHEMA } },
});
const text = resp.content.find((b) => b.type === "text")?.text;
const { outfits } = JSON.parse(text);

const avatar = readFileSync("docs_para_claude/avateres styles/Gemini_Generated_Image_uvg4iuvg4iuvg4iu.png").toString("base64");
const VIBE = "FRAMING: candid and un-posed, caught between moments, NOT a stiff straight-on centered catalog pose, NOT symmetric, slightly off-axis three-quarter, off-center, full outfit clearly visible head to feet. Clean Gen-Z aesthetic: cool neutral daylight, plain flat light-grey concrete wall, NO warm golden tones, NO stucco, NO cobblestone, neutral white balance, crisp. Photorealistic, high quality. No text, no logos.";

let i = 0;
for (const o of outfits) {
  i++;
  console.log(`\n[${i}] ${o.titulo} · ${o.ocasion}\n   ${o.render}\n   ↳ ${o.porque}`);
  const text = `Candid full-body street-style fashion photograph of the SAME woman shown in the reference image. Keep her exact face, her long wavy brown hair, hair color, skin tone, body and overall look identical to the reference; keep her natural facial expression. She is now wearing ${o.render}. ${VIBE}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${GKEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }, { inlineData: { mimeType: "image/png", data: avatar } }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }),
  });
  if (!res.ok) { console.error(`  ERROR render ${i}: ${res.status}`); continue; }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) { console.error(`  sin imagen ${i}`); continue; }
  writeFileSync(`docs_para_claude/outfit-inspo/CFZ/engine-${i}.png`, Buffer.from(part.inlineData.data, "base64"));
  console.log(`   OK → engine-${i}.png`);
}
console.log("\nLISTO");
