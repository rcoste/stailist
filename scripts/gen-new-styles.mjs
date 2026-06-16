// Genera los 2 estilos nuevos (startup, finance-bro) para el swipe de gustos.
// Hombre: avatar = Roberto (m0-roberto). Mujer: avatar morena existente.
// Mismo pipeline que gen-looks-hombre/avatar (gemini-3-pro-image, candid calle).
// Escribe DIRECTO a public/looks/<id>-<genero>.png.
//
// Uso:  node scripts/gen-new-styles.mjs [--skip-existing]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3-pro-image";
const skipExisting = process.argv.includes("--skip-existing");

const AVATAR_H = readFileSync(
  "docs_para_claude/avatars-hombre/m0-roberto.png"
).toString("base64");
const AVATAR_M = readFileSync(
  "docs_para_claude/avateres styles/Gemini_Generated_Image_8usx3p8usx3p8usx.png"
).toString("base64"); // morena

// Outfits logo-free (On Cloud → "cushioned-sole runners"; Patagonia → "quilted gilet").
const JOBS = [
  {
    id: "startup",
    gender: "hombre",
    avatar: AVATAR_H,
    outfit:
      "a plain crew-neck t-shirt under an open full-zip hoodie, straight-leg blue jeans, and clean white-and-grey cushioned-sole running sneakers (sleek minimalist runners), a comfortable modern tech-founder look, no logos",
    vibe: "relaxed tech-startup founder style, comfortable and modern",
  },
  {
    id: "startup",
    gender: "mujer",
    avatar: AVATAR_M,
    outfit:
      "a plain t-shirt under an open full-zip hoodie, straight-leg blue jeans, and clean white-and-grey cushioned-sole running sneakers, a comfortable modern tech look, no logos",
    vibe: "relaxed tech-startup style, comfortable and modern",
  },
  {
    id: "finance-bro",
    gender: "hombre",
    avatar: AVATAR_H,
    outfit:
      "a quilted puffer fleece gilet (sleeveless vest) over a light-blue button-down shirt, beige chinos, a brown leather belt and clean white leather sneakers, polished corporate-casual finance look, no logos",
    vibe: "polished corporate-casual finance style",
  },
  {
    id: "finance-bro",
    gender: "mujer",
    avatar: AVATAR_M,
    outfit:
      "a quilted puffer gilet (sleeveless vest) over a light-blue button-down shirt, beige tailored trousers, a slim belt and clean leather loafers, polished corporate-casual finance look, no logos",
    vibe: "polished corporate-casual finance style",
  },
];

function prompt(gender, outfit, vibe) {
  const subj = gender === "mujer" ? "woman" : "man";
  const poss = gender === "mujer" ? "her" : "his";
  return `Candid full-body street-style fashion photograph of the SAME ${subj} shown in the reference image. Keep ${poss} exact face, hairstyle, hair color, skin tone and body identical to the reference. ${gender === "mujer" ? "She" : "He"} is now wearing ${outfit}. ${vibe}. NATURAL CANDID POSE — weight shifted onto one leg, one hand in a pocket or relaxed at ${poss} side, looking slightly off to the side, mid-stride or leaning casually; absolutely NOT a stiff straight-on catalog/mannequin pose, NOT arms-down symmetric. SETTING: outdoors on a quiet sunlit street, a warm textured plaster or stucco wall behind ${gender === "mujer" ? "her" : "him"}, hints of cobblestone ground, warm golden natural daylight, soft shadows, editorial Pinterest aesthetic, slight shallow depth of field. Full body visible from head to feet, photorealistic, high quality. IMPORTANT: do NOT use any turtleneck, mock neck, funnel neck or high bulky collar. No text, no logos, no brand marks.`;
}

for (const job of JOBS) {
  const out = `public/looks/${job.id}-${job.gender}.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${out}`);
    continue;
  }
  const parts = [
    { text: prompt(job.gender, job.outfit, job.vibe) },
    { inlineData: { mimeType: "image/png", data: job.avatar } },
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
    console.error(`ERROR ${out}: ${res.status} ${await res.text()}`);
    continue;
  }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  );
  if (!img) {
    console.error(`sin imagen ${out}`);
    continue;
  }
  writeFileSync(out, Buffer.from(img.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}
console.log("LISTO");
