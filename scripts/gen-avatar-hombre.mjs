// Genera avatares base de hombre (full-body, tee blanca + jeans, estudio hueso,
// pose neutra de frente) — mismo formato que las avatares mujer. Pool de modelos
// para los looks de hombre. Salida: docs_para_claude/avatars-hombre/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";

const MEN = [
  { id: "m1", desc: "a Latino man in his early 30s, medium-tan skin, short dark wavy hair and a short trimmed beard, athletic build" },
  { id: "m2", desc: "a man in his late 20s, light olive skin, neat short brown hair, clean-shaven, slim build" },
  { id: "m3", desc: "a handsome model-like man in his early 30s, fair skin, blonde hair styled neatly, light stubble, strong jawline, athletic build, very good-looking" },
];

const only = process.argv[2];
const list = only ? MEN.filter((m) => m.id === only) : MEN;

function prompt(desc) {
  return `Full-body studio photograph of ${desc}, standing straight and facing the camera, neutral relaxed expression, arms relaxed at his sides, wearing a plain white crew-neck t-shirt, mid-blue straight jeans and white sneakers. Plain seamless off-white studio background, soft even diffused lighting, photorealistic, sharp, full body visible from head to feet. No text, no logos.`;
}

const outDir = "docs_para_claude/avatars-hombre";
mkdirSync(outDir, { recursive: true });

for (const m of list) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(m.desc) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${m.id}: ${res.status}`);
    continue;
  }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) {
    console.error(`sin imagen ${m.id}`);
    continue;
  }
  writeFileSync(`${outDir}/${m.id}.png`, Buffer.from(img.inlineData.data, "base64"));
  console.log(`OK → ${outDir}/${m.id}.png`);
}
console.log("LISTO");
