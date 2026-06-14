// Genera las imágenes de los swipes de gustos como GENTE con outfit (estilo
// street-style/Pinterest), reemplazando los flat-lays. Cada quien ve gente de
// su género: looks unisex → 2 versiones (hombre/mujer); específicos → 1.
// Diversidad de tono de piel, edad y cuerpo. Salida: public/looks/.
//   unisex:     <id>-hombre.png, <id>-mujer.png
//   específico: <id>.png
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";

const LOOKS = [
  { id: "blanco-mezclilla", seg: "unisex", outfit: "a plain white t-shirt, light blue jeans and white sneakers" },
  { id: "total-black", seg: "unisex", outfit: "a black t-shirt, black trousers and black leather boots" },
  { id: "oficina-relajada", seg: "hombre", outfit: "a light blue dress shirt, black trousers and brown loafers" },
  { id: "parisino", seg: "mujer", outfit: "a beige trench coat over a white blouse with black tailored trousers" },
  { id: "boho-domingo", seg: "mujer", outfit: "an olive green midi dress with a cream cardigan and brown sandals" },
  { id: "street-urbano", seg: "unisex", outfit: "a grey hoodie, black cargo pants and white sneakers" },
  { id: "romantico-suave", seg: "mujer", outfit: "a pale pink blouse, a cream A-line skirt and nude ballet flats" },
  { id: "deportivo-limpio", seg: "unisex", outfit: "a white athletic top, navy blue joggers and white sneakers" },
  { id: "elegante-noche", seg: "mujer", outfit: "an elegant little black dress with black heels" },
  { id: "color-block", seg: "unisex", outfit: "a royal blue sweater, green trousers and white sneakers" },
  { id: "tonos-tierra", seg: "unisex", outfit: "a camel knit sweater, brown trousers and cream ankle boots" },
  { id: "monocromo-gris", seg: "unisex", outfit: "a light grey sweater, grey trousers and grey sneakers" },
  { id: "estampado-atrevido", seg: "hombre", outfit: "a bold patterned shirt, black trousers and black ankle boots" },
  { id: "marinero-casual", seg: "unisex", outfit: "a navy and white striped sweater, white trousers and tan espadrilles" },
  { id: "tailoring-moderno", seg: "hombre", outfit: "a taupe grey blazer over a white t-shirt with cream trousers" },
];

const HOMBRES = [
  "a young Latino man with medium-tan skin and short dark hair, athletic build",
  "a Latino man in his 30s with light brown skin and a short beard, slim build",
  "a young man with dark brown skin and short curly hair, tall",
  "a man with olive skin and neatly styled hair, average build",
  "a young man with warm tan skin and a relaxed look",
];
const MUJERES = [
  "a young Latina woman with medium-tan skin and long dark wavy hair",
  "a Latina woman in her 30s with light brown skin and shoulder-length hair",
  "a young woman with dark brown skin and natural curly hair, curvy build",
  "a woman with olive skin and straight dark hair, tall and slim",
  "a young woman with warm tan skin and hair in a ponytail",
];

function prompt(persona, outfit) {
  return `Full-body street style fashion photograph of ${persona} wearing ${outfit}. Standing naturally against a plain warm off-white wall, soft natural daylight, editorial Pinterest aesthetic, relaxed confident pose, full body visible head to feet, sharp focus, photorealistic, high quality. No text, no logos.`;
}

mkdirSync("public/looks", { recursive: true });
const skipExisting = process.argv.includes("--skip-existing");

// Construye la lista de jobs (file, persona, outfit) con diversidad rotada.
const jobs = [];
let mi = 0;
let wi = 0;
for (const look of LOOKS) {
  if (look.seg === "hombre") {
    jobs.push({ file: `${look.id}.png`, persona: HOMBRES[mi++ % HOMBRES.length], outfit: look.outfit });
  } else if (look.seg === "mujer") {
    jobs.push({ file: `${look.id}.png`, persona: MUJERES[wi++ % MUJERES.length], outfit: look.outfit });
  } else {
    jobs.push({ file: `${look.id}-hombre.png`, persona: HOMBRES[mi++ % HOMBRES.length], outfit: look.outfit });
    jobs.push({ file: `${look.id}-mujer.png`, persona: MUJERES[wi++ % MUJERES.length], outfit: look.outfit });
  }
}

for (const job of jobs) {
  const out = `public/looks/${job.file}`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${job.file}`);
    continue;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(job.persona, job.outfit) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${job.file}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    continue;
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`SIN IMAGEN ${job.file}`);
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}
console.log("LISTO: gente generada");
