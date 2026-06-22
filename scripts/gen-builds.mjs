// 3 complexiones (eje 1): delgada / media / con más curvas. Varía el TAMAÑO,
// forma neutra. Silueta plana lisa, sin líneas internas. → public/siluetas/complexion/
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  ?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
if (!key) { console.error("Falta key"); process.exit(1); }
const MODEL = "gemini-3.1-flash-image";

const base = (build) =>
  `Minimal flat solid silhouette pictogram of a woman's full body, front view, standing relaxed with arms slightly away from the sides, head to feet. ONE clean smooth flat shape: NO internal lines, NO shading, NO anatomical detail, NO bust outline, NO facial features, NO hair detail. Neutral balanced proportions (do NOT exaggerate hips, waist or bust — keep the SHAPE neutral). ${build} Solid single warm taupe fill (hex 8A8178). Plain warm off-white background, exact hex F5F3F0. Centered, generous margins. No text.`;

const SET = [
  ["1-delgada", base("BUILD: slim, lean, narrow frame, low body volume — a thin build.")],
  ["2-media", base("BUILD: average everyday medium build, neither thin nor heavy — a normal mid-size build.")],
  ["3-curvas", base("BUILD: fuller, larger build with more body volume all over, soft and rounded — a plus-size build.")],
];

async function gen(prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }) });
  if (!res.ok) { console.error("HTTP", res.status); return null; }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  return part?.inlineData?.data ? Buffer.from(part.inlineData.data, "base64") : null;
}

mkdirSync("public/siluetas/build", { recursive: true });
for (const [slug, prompt] of SET) {
  process.stdout.write(`${slug}… `);
  const b = await gen(prompt);
  if (b) { writeFileSync(`public/siluetas/complexion/${slug}.png`, b); console.log(`ok (${Math.round(b.length/1024)}KB)`); }
  else console.log("FALLÓ");
}
console.log("listo → public/siluetas/complexion/");
