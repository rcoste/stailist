// 4 complexiones de hombre (eje 1): delgado / atlético / promedio / robusto.
// Silueta plana lisa, sin líneas internas. → public/siluetas/complexion-hombre/
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  ?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
if (!key) { console.error("Falta key"); process.exit(1); }
const MODEL = "gemini-3.1-flash-image";

const base = (build) =>
  `Minimal flat solid silhouette pictogram of a MAN's full body, front view, standing relaxed with arms slightly away from the sides, head to feet. ONE clean smooth flat shape: NO internal lines, NO shading, NO anatomical detail, NO facial features, NO hair detail. ${build} Solid single warm taupe fill (hex 8A8178). Plain warm off-white background, exact hex F5F3F0. Centered, generous margins. No text.`;

const SET = [
  ["1-delgado", base("BUILD: slim, lean, narrow frame, low body volume — a thin male build.")],
  ["2-atletico", base("BUILD: athletic V-taper, broad shoulders and chest narrowing to a trim waist, fit and muscular — an athletic male build.")],
  ["3-promedio", base("BUILD: average everyday medium male build, neither thin nor heavy.")],
  ["4-robusto", base("BUILD: larger, broader, heavyset male build with more body volume all over, fuller midsection.")],
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

mkdirSync("public/siluetas/complexion-hombre", { recursive: true });
for (const [slug, prompt] of SET) {
  process.stdout.write(`${slug}… `);
  const b = await gen(prompt);
  if (b) { writeFileSync(`public/siluetas/complexion-hombre/${slug}.png`, b); console.log(`ok (${Math.round(b.length/1024)}KB)`); }
  else console.log("FALLÓ");
}
console.log("listo");
