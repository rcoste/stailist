// v2 de replicación de estilo. Diferencia clave vs gen-style-closet.mjs:
//   - Opus VE las fotos reales (visión) y extrae la GRAMÁTICA de styling (los verbos:
//     color-drench, clash de color, layering de prints, elemento "equivocado"), NO un
//     brief sanitizado. Prohibido el resumen safe "neutros + un protagonista".
//   - El paso de looks OBLIGA a usar >=2 movimientos de firma por look y prohíbe el
//     bastón neutro.
//   - El render sigue en Valeria SIN mostrar fotos reales (para no copiar sus outfits).
//   Uso: node scripts/gen-style-v2.mjs [N_looks]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const env = (k) =>
  readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith(k + "="))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const GKEY = env("GOOGLE_GENERATIVE_AI_API_KEY");
const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
const N = Number(process.argv[2] ?? 3);
const DIR = "docs_para_claude/outfit-inspo/CFZ";
const SMALL = process.env.CFZ_SMALL_DIR; // carpeta con las fotos reducidas (jpeg 900px)
const STYLIST = "Carla Figliozzi";

// ── PASO 1: VISIÓN — Opus estudia las fotos reales y extrae la GRAMÁTICA ──
const photos = readdirSync(SMALL)
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .sort();
console.log(`PASO 1 — Opus estudia ${photos.length} fotos reales de ${STYLIST}…`);

const imgBlocks = photos.map((f) => ({
  type: "image",
  source: { type: "base64", media_type: "image/jpeg", data: readFileSync(`${SMALL}/${f}`).toString("base64") },
}));

const DNA_SCHEMA = {
  type: "object",
  properties: {
    signature_moves: {
      type: "array",
      description: "5-8 MOVIMIENTOS de styling que la hacen inconfundible (los VERBOS, cómo combina)",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "nombre corto del movimiento, ej. 'color-drench tonal'" },
          regla: { type: "string", description: "la regla accionable en español" },
          evidencia: { type: "string", description: "en qué foto(s) se ve" },
        },
        required: ["nombre", "regla", "evidencia"],
        additionalProperties: false,
      },
    },
    paleta_dna: { type: "string", description: "cómo usa el color de verdad (drenching, clashes, brights que se atreve a juntar). NO 'base neutra'." },
    anti_safe: { type: "array", items: { type: "string" }, description: "3-5 cosas que ella NUNCA haría por ser aburridas/seguras (para prohibirlas)" },
    closet: {
      type: "array",
      description: "~26 prendas que encarnan su estilo REAL, incluyendo sus piezas atrevidas (brights, prints, satén, texturas), no solo básicos neutros",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          nombre: { type: "string" },
          categoria: { type: "string", enum: ["top", "bottom", "vestido", "saco", "abrigo", "calzado", "bolsa", "accesorio"] },
          desc: { type: "string", description: "descripción en inglés lista para render (color específico, material, corte, detalle)" },
        },
        required: ["id", "nombre", "categoria", "desc"],
        additionalProperties: false,
      },
    },
  },
  required: ["signature_moves", "paleta_dna", "anti_safe", "closet"],
  additionalProperties: false,
};

const r1 = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 6000,
  system: `Eres una directora de moda estudiando a una stylist para poder REPLICAR su firma, no para hacer "buen gusto genérico".

MIRA las fotos reales y extrae lo que la hace INCONFUNDIBLE. Su magia NO está en tener prendas bonitas — está en sus MOVIMIENTOS arriesgados de combinación. Busca activamente:
- ¿Hace color-drenching (un solo color de pies a cabeza en texturas que chocan)?
- ¿Junta colores que "no deberían" ir (pistache + rosa, etc.)?
- ¿Capa prints con color en vez de dejarlos solos?
- ¿Mete un elemento "equivocado" a propósito (botín vaquero duro con satén delicado)?
- ¿Choca texturas (lana chunky sobre satén líquido)?
- ¿Rompe reglas de formalidad al capar (suéter sobre slip, blazer sobre mini)?

PROHIBIDO resumirla como "base de neutros + un acento + oro" — eso es la descripción de CUALQUIER minimalista y es justo lo que la hace verse safe. Si tu lectura podría describir a 100 influencers, fallaste. Nombra lo que SOLO ella hace.`,
  messages: [{ role: "user", content: [
    { type: "text", text: `Estas son ${photos.length} fotos reales de ${STYLIST}. Extrae su gramática de styling (movimientos de firma), su ADN de color, sus anti-reglas, y un clóset de ~26 piezas que incluya su atrevimiento real.` },
    ...imgBlocks,
  ] }],
  output_config: { format: { type: "json_schema", schema: DNA_SCHEMA } },
});
const dna = JSON.parse(r1.content.find((b) => b.type === "text").text);
console.log(`\n  MOVIMIENTOS DE FIRMA:`);
for (const m of dna.signature_moves) console.log(`   · ${m.nombre}: ${m.regla}`);
console.log(`\n  PALETA: ${dna.paleta_dna}`);
console.log(`\n  ANTI-SAFE (prohibido): ${dna.anti_safe.join(" | ")}`);
console.log(`\n  CLÓSET: ${dna.closet.length} piezas`);
writeFileSync(`${DIR}/dna-v2.json`, JSON.stringify(dna, null, 2));

// ── PASO 2: LOOKS — obligados a usar >=2 movimientos de firma ──
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
          items: { type: "array", items: { type: "string" }, description: "ids del clóset (solo de la lista)" },
          movimientos_usados: { type: "array", items: { type: "string" }, description: "nombres de los signature_moves aplicados (>=2)" },
          porque: { type: "string", description: "por qué es inconfundiblemente de ella" },
        },
        required: ["titulo", "ocasion", "items", "movimientos_usados", "porque"],
        additionalProperties: false,
      },
    },
  },
  required: ["looks"],
  additionalProperties: false,
};

console.log(`\nPASO 2 — Opus arma ${N} looks aplicando su gramática…`);
const r2 = await client.messages.create({
  model: "claude-opus-5",
  max_tokens: 3000,
  system: `Eres ${STYLIST} vistiéndote. Arma ${N} looks combinando SOLO ids del clóset dado.

REGLAS DURAS (si un look no las cumple, fallaste):
- Cada look DEBE aplicar >=2 de tus MOVIMIENTOS DE FIRMA (lístalos en movimientos_usados).
- PROHIBIDO el patrón "una prenda de color + todo lo demás neutro". Ese es el look genérico que hay que evitar.
- PROHIBIDO todo lo que está en anti_safe.
- Un look que podría confundirse con The Row / minimalista genérico está MAL. Empújalo hasta que sea inconfundiblemente tuyo.
- Varía la ocasión.

REPARTO Y NOVEDAD (Camino A — esto evita la copia y la muleta):
- REPARTE los movimientos: entre TODOS los looks, ningún movimiento de firma debe aparecer en más de UN look. Cada look usa una combinación DISTINTA de movimientos. Cúbrelos en variedad, no repitas el más llamativo.
- VARÍA el calzado: cada look lleva un calzado distinto. NO uses el mismo zapato (ej. el botín vaquero) en más de un look — tu vocabulario incluye también sandalia dorada, tacón blanco, mule de color.
- NOVEDAD (no copies tus propias fotos): aplica el MOVIMIENTO, pero NO recrees un outfit que ya usaste. En cada look cambia al menos el color O una prenda respecto a la combinación obvia. Si el tonal drench 'mostaza knit + falda satén mostaza' es idéntico a una foto tuya, cámbialo a otra familia de color o mete un elemento inesperado. El movimiento se conserva; la ejecución es fresca.`,
  messages: [{ role: "user", content: `MOVIMIENTOS DE FIRMA:\n${dna.signature_moves.map((m) => `- ${m.nombre}: ${m.regla}`).join("\n")}\n\nPALETA: ${dna.paleta_dna}\n\nANTI-SAFE (prohibido): ${dna.anti_safe.join(" | ")}\n\nCLÓSET (id · nombre · desc):\n${dna.closet.map((c) => `${c.id} · ${c.nombre} · ${c.desc}`).join("\n")}\n\nArma ${N} looks inconfundiblemente tuyos, cada uno con movimientos y calzado distintos.` }],
  output_config: { format: { type: "json_schema", schema: LOOKS_SCHEMA } },
});
const { looks } = JSON.parse(r2.content.find((b) => b.type === "text").text);

// ── PASO 3: RENDER en Valeria (sin foto real de referencia) ──
const byId = Object.fromEntries(dna.closet.map((c) => [c.id, c]));
const avatar = readFileSync("docs_para_claude/avateres styles/Gemini_Generated_Image_uvg4iuvg4iuvg4iu.png").toString("base64");
const VIBE = "FRAMING: candid, un-posed, slightly off-axis three-quarter, off-center, full outfit head to feet. Clean Gen-Z aesthetic: cool neutral daylight, plain flat light-grey concrete wall, NO warm golden tones, NO stucco, neutral white balance, crisp. Photorealistic. No text, no logos.";

let i = 0;
for (const look of looks) {
  i++;
  const pieces = look.items.map((id) => byId[id]).filter(Boolean);
  // Lista numerada y ordenada por capa para que Gemini NO tire prendas.
  const desc = pieces.map((p, k) => `${k + 1}) ${p.desc}`).join("; ");
  console.log(`\n[${i}] ${look.titulo} · ${look.ocasion}\n   ${pieces.map((p) => p.nombre).join(" + ")}\n   movimientos: ${look.movimientos_usados.join(", ")}\n   ↳ ${look.porque}`);
  const text = `Candid full-body street-style fashion photograph of the SAME woman shown in the reference image. Keep her exact face, long wavy brown hair, skin tone, body and natural expression identical to the reference. She is wearing a complete outfit — EVERY one of these ${pieces.length} items must be clearly visible and worn together: ${desc}. Do not omit or simplify any item; show all of them layered correctly. ${VIBE}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${GKEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text }, { inlineData: { mimeType: "image/png", data: avatar } }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }),
  });
  if (!res.ok) { console.error(`  ERROR ${i}: ${res.status} ${await res.text()}`); continue; }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) { console.error(`  sin imagen ${i}`); continue; }
  writeFileSync(`${DIR}/v2-look-${i}.png`, Buffer.from(part.inlineData.data, "base64"));
  console.log(`   OK → v2-look-${i}.png`);
}
console.log("\nLISTO");
