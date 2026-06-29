// Extrae UNA prenda de la foto de una persona y la guarda como flat-lay PNG.
// Image-to-image con Gemini (nano banana): le pasamos la foto + un prompt que
// pide aislar la prenda en fondo neutro, para los tiles del landing.
// Uso: node scripts/gen-extract.mjs <fuente.png> "<prompt>" <salida.png> [modelo]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
if (!envLine) {
  console.error("No encontré GOOGLE_GENERATIVE_AI_API_KEY en .env.local");
  process.exit(1);
}
const key = envLine.split("=").slice(1).join("=").trim();

const [src, prompt, outPath, model = "gemini-3.1-flash-image"] = process.argv.slice(2);
if (!src || !prompt || !outPath) {
  console.error('Uso: node scripts/gen-extract.mjs <fuente.png> "<prompt>" <salida.png> [modelo]');
  process.exit(1);
}

const b64 = readFileSync(src).toString("base64");

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "image/png", data: b64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    }),
  }
);

if (!res.ok) {
  console.error(`Error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

const data = await res.json();
const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
if (!part) {
  console.error("La respuesta no trajo imagen:", JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
console.log(`OK → ${outPath}`);
