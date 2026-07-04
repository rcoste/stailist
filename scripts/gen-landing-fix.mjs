// Regenera dos imágenes de la landing usando una foto de referencia (misma
// persona / pose / fondo), con gemini-3-pro-image multimodal:
//   1) hero-normal  — la modelo del "ejemplo real" con básicos neutros (el
//      "antes" del try-on de esa card; el "después" es hero-worn.png).
//   2) swipe-si-1    — corrige la anatomía (brazo extra) manteniendo outfit/pose.
//
// Salida a STAGING (no toca public/) para revisar antes de publicar:
//   docs_para_claude/landing-fix/<nombre>-<n>.png
//
// Uso:  node scripts/gen-landing-fix.mjs [hero|swipe|both] [nCandidatos]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
if (!envLine) {
  console.error("No encontré GOOGLE_GENERATIVE_AI_API_KEY en .env.local");
  process.exit(1);
}
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3-pro-image";

const which = process.argv[2] ?? "both";
const N = Number(process.argv[3] ?? 2);

const outDir = "docs_para_claude/landing-fix";
mkdirSync(outDir, { recursive: true });

const TASKS = {
  hero: {
    ref: "public/landing/hero-worn.png",
    name: "hero-normal",
    prompt: `Candid full-body street-style fashion photograph of the SAME woman shown in the reference image. Keep her exact face, hairstyle, hair color, skin tone, body, POSE, hand positions, camera framing, and the exact same background IDENTICAL to the reference (the same plaster/concrete wall, the same ground, the same soft daylight and shadows). The ONLY thing that changes is her clothing: she is now wearing plain, ordinary everyday basics — a simple fitted plain white crew-neck t-shirt tucked into high-waisted straight-leg mid-blue denim jeans, with simple flat shoes. Remove any handbag, jacket, blazer and accessories — nothing styled, just neutral basic clothes, as if she has not been styled yet. Photorealistic, high quality, editorial Pinterest aesthetic, full body from head to feet. No text, no logos, no brand marks.`,
  },
  heroh: {
    ref: "public/landing/h/hero-worn.png",
    name: "hero-normal-h",
    prompt: `Candid full-body street-style fashion photograph of the SAME man shown in the reference image. Keep his exact face, hairstyle, hair color, skin tone, body, POSE, hand positions, camera framing, and the exact same background IDENTICAL to the reference (the same wall, ground, lighting and shadows). The ONLY thing that changes is his clothing: he is now wearing plain, ordinary everyday basics — a simple plain grey crew-neck t-shirt and straight-leg dark-blue denim jeans with simple casual sneakers or plain shoes. Remove any blazer, jacket, coat and accessories — nothing styled, just neutral basic clothes, as if he has not been styled yet. Photorealistic, high quality, editorial aesthetic, full body from head to feet. No text, no logos, no brand marks.`,
  },
  swipe: {
    ref: "public/landing/swipe-si-1.png",
    name: "swipe-si-1",
    prompt: `Photorealistic full-body street-style fashion photograph. This is the SAME woman wearing the SAME outfit as the reference image: a beige sleeveless ribbed halter/tank top, tailored light-grey trousers, black pointed flat mules, and a beige shoulder bag, standing in front of a plain neutral wall. Keep her face, hair, outfit, pose, framing and background IDENTICAL to the reference. CRITICAL ANATOMY CORRECTION: the reference image has an anatomical error — a malformed or extra arm. Regenerate so the woman has EXACTLY TWO arms and TWO hands with correct, natural, realistic human anatomy: no extra limbs, no duplicated or floating arms, no distorted or merged hands. Clean correct anatomy. No text, no logos, no brand marks.`,
  },
};

async function genOne(task, i) {
  const ref = readFileSync(task.ref).toString("base64");
  const parts = [
    { text: task.prompt },
    { inlineData: { mimeType: "image/png", data: ref } },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "3:4" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${task.name} #${i}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) {
    console.error(`sin imagen ${task.name} #${i}`);
    return;
  }
  const out = `${outDir}/${task.name}-${i}.png`;
  writeFileSync(out, Buffer.from(img.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}

const selected =
  which === "both" ? ["hero", "swipe"] : [which];

for (const t of selected) {
  const task = TASKS[t];
  if (!task) {
    console.error(`tarea desconocida: ${t}`);
    continue;
  }
  for (let i = 1; i <= N; i++) {
    await genOne(task, i);
  }
}
console.log("LISTO");
