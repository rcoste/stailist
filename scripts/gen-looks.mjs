// Genera las imágenes de los 15 looks del swipe de gustos: flat-lays de
// OUTFITS COMPLETOS (varias prendas juntas), no prendas sueltas — capturan el
// vibe estético. Mismo estilo editorial que los arquetipos. Salida:
// public/looks/<id>.png. Los ids coinciden con LOOKS de lib/looks.ts.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";

const LOOKS = [
  { id: "blanco-mezclilla", desc: "a white crew-neck t-shirt, light wash blue jeans and white leather sneakers" },
  { id: "total-black", desc: "a black t-shirt, black trousers and black leather boots" },
  { id: "oficina-relajada", desc: "a light blue dress shirt, black trousers and brown leather loafers" },
  { id: "parisino", desc: "a beige trench coat, a white blouse and black tailored trousers" },
  { id: "boho-domingo", desc: "an olive green midi dress, a cream knit cardigan and brown leather sandals" },
  { id: "street-urbano", desc: "a grey hoodie, black cargo pants and white sneakers" },
  { id: "romantico-suave", desc: "a pale pink blouse, a cream A-line skirt and nude ballet flats" },
  { id: "deportivo-limpio", desc: "a white athletic top, navy blue joggers and white sneakers" },
  { id: "elegante-noche", desc: "a little black dress, a burgundy clutch bag and black high heels" },
  { id: "color-block", desc: "a royal blue sweater, green trousers and white sneakers" },
  { id: "tonos-tierra", desc: "a camel knit sweater, brown trousers and cream ankle boots" },
  { id: "monocromo-gris", desc: "a light grey sweater, grey trousers and grey sneakers" },
  { id: "estampado-atrevido", desc: "a bold patterned print shirt, black trousers and black ankle boots" },
  { id: "marinero-casual", desc: "a navy and white striped sweater, white trousers and tan espadrilles" },
  { id: "tailoring-moderno", desc: "a taupe grey blazer, cream trousers and a white t-shirt" },
];

function prompt(desc) {
  return `Professional editorial flat lay photograph of a complete styled outfit laid out together: ${desc}. Arranged neatly as an outfit-of-the-day flat lay, shot from directly above, garments slightly overlapping in a styled composition. Soft natural diffused lighting, subtle shadows. Plain warm off-white paper background, exact hex F5F3F0, clean. Premium minimalist fashion editorial style like COS or The Row. No people, no text, no labels.`;
}

mkdirSync("public/looks", { recursive: true });
const skipExisting = process.argv.includes("--skip-existing");

for (const look of LOOKS) {
  const out = `public/looks/${look.id}.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${look.id}`);
    continue;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(look.desc) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${look.id}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    continue;
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`SIN IMAGEN ${look.id}`);
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}
console.log("LISTO: looks generados");
