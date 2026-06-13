// Genera las imágenes de los 15 arquetipos del clóset (lista HOMBRE) en el
// estilo A elegido por Roberto: flat-lay editorial, fondo papel hueso F5F3F0.
// Salida: public/archetypes/<slug>.png. Secuencial para no chocar con el
// rate limit de Gemini. Reusa el mismo wrapper que scripts/gen-image.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";

// type: "flat" (ropa extendida vista desde arriba) | "shoes" (par, ángulo leve)
const ITEMS = [
  { slug: "camiseta-blanca", desc: "a plain white crew-neck cotton t-shirt", type: "flat" },
  { slug: "camiseta-negra", desc: "a plain black crew-neck cotton t-shirt", type: "flat" },
  { slug: "camisa-blanca", desc: "a crisp white button-up dress shirt", type: "flat" },
  { slug: "camisa-azul-claro", desc: "a light blue button-up dress shirt", type: "flat" },
  { slug: "polo-marino", desc: "a navy blue short-sleeve polo shirt", type: "flat" },
  { slug: "sueter-gris", desc: "a grey crew-neck knit sweater", type: "flat" },
  { slug: "hoodie-gris", desc: "a heather grey pullover hoodie with a hood", type: "flat" },
  { slug: "blazer-azul-marino", desc: "a navy blue tailored blazer jacket", type: "flat" },
  { slug: "chamarra-mezclilla", desc: "a classic medium-wash blue denim jacket", type: "flat" },
  { slug: "jeans-azul-oscuro", desc: "a pair of dark indigo blue jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-negro", desc: "a pair of black dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "chinos-beige", desc: "a pair of beige chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "tenis-blancos", desc: "a pair of clean white leather sneakers", type: "shoes" },
  { slug: "zapato-formal-cafe", desc: "a pair of brown leather formal derby shoes", type: "shoes" },
  { slug: "botas-negras", desc: "a pair of black leather ankle boots", type: "shoes" },
  // Ampliación clóset hombre (2026-06-13)
  { slug: "camiseta-gris", desc: "a plain heather grey crew-neck cotton t-shirt", type: "flat" },
  { slug: "camisa-lino", desc: "a light beige linen button-up shirt, relaxed fit", type: "flat" },
  { slug: "camisa-mezclilla", desc: "a light blue chambray button-up shirt", type: "flat" },
  { slug: "short-caqui", desc: "a pair of khaki chino shorts, neatly laid flat", type: "flat" },
  { slug: "jeans-negros", desc: "a pair of black jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "chinos-marino", desc: "a pair of navy blue chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "mocasines-cafe", desc: "a pair of brown leather penny loafer shoes", type: "shoes" },
  { slug: "sandalias-cuero", desc: "a pair of brown leather slide sandals", type: "shoes" },
  { slug: "bomber", desc: "a classic black bomber jacket (MA-1 style)", type: "flat" },
  // Lista mujer + zapato negro (2026-06-13)
  { slug: "cardigan-crema", desc: "a cream knit open-front cardigan", type: "flat" },
  { slug: "abrigo-camel", desc: "a camel wool long overcoat", type: "flat" },
  { slug: "falda-midi-negra", desc: "a black midi A-line skirt", type: "flat" },
  { slug: "vestido-negro", desc: "a little black sleeveless dress", type: "flat" },
  { slug: "flats-nude", desc: "a pair of nude ballet flat shoes", type: "shoes" },
  { slug: "zapato-formal-negro", desc: "a pair of black leather oxford dress shoes", type: "shoes" },
];

function buildPrompt({ desc, type }) {
  if (type === "shoes") {
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. No people, no props, no text, no labels.`;
  }
  return `Professional e-commerce flat lay photograph of ${desc}, neatly laid flat and slightly styled, shot directly from above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The garment fills about 70% of the frame, centered. No people, no props, no text, no labels.`;
}

mkdirSync("public/archetypes", { recursive: true });

// Permite reanudar: si --skip-existing, no regenera lo ya hecho.
const skipExisting = process.argv.includes("--skip-existing");

for (const item of ITEMS) {
  const out = `public/archetypes/${item.slug}.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${item.slug} (ya existe)`);
    continue;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(item) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${item.slug}: ${res.status} ${(await res.text()).slice(0, 150)}`);
    continue;
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`SIN IMAGEN ${item.slug}`);
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}
console.log("LISTO: generación de arquetipos terminada");
