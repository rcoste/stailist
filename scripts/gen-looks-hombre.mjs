// Looks de swipes HOMBRE vistiendo a los avatares fijos (m1, m2, m3 — sin
// Roberto, por decisión). Mismo enfoque que el de mujer: candid + calle/yeso
// cálido, cero buchón. Salida: docs_para_claude/looks-hombre/<id>-hombre.png.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3-pro-image";
const skipExisting = process.argv.includes("--skip-existing");

const AVATARS = ["m1", "m2", "m3"].map((id) =>
  readFileSync(`docs_para_claude/avatars-hombre/${id}.png`).toString("base64")
);

const LOOKS = [
  { id: "minimalista", outfit: "a fitted plain white crew-neck t-shirt, straight black trousers and white minimalist leather sneakers, strict white-and-black palette, no logos", vibe: "minimalist clean style, sharp simple lines" },
  { id: "casual-effortless", outfit: "a relaxed white t-shirt, straight mid-blue jeans, white sneakers and a simple watch", vibe: "effortless everyday casual, relaxed" },
  { id: "clasico-elegante", outfit: "a crisp white shirt, grey pleated dress trousers, a fitted navy blazer and brown loafers, a leather watch", vibe: "timeless refined elegance, old money" },
  { id: "preppy", outfit: "a polo shirt, beige chinos, a knit sweater tied over the shoulders, white sneakers and a leather belt", vibe: "polished preppy campus style" },
  { id: "sastre", outfit: "a fitted full navy suit (blazer and trousers), a white shirt with no tie and the top two buttons open, brown loafers", vibe: "modern power tailoring" },
  { id: "smart-casual", outfit: "a fine crew-neck sweater, chinos, an unstructured blazer and white leather sneakers", vibe: "polished smart casual, office to after" },
  { id: "streetwear", outfit: "an oversized hoodie, baggy cargo trousers, chunky sneakers and a cap", vibe: "urban streetwear, oversized, attitude" },
  { id: "athleisure", outfit: "a zip track jacket, ankle-fitted technical joggers and athletic sneakers", vibe: "polished athleisure, sporty" },
  { id: "edgy", outfit: "a black leather jacket, a black t-shirt, slim black jeans and black boots, sleek all black", vibe: "edgy rock, sleek all black" },
  { id: "grunge", outfit: "an open plaid flannel shirt over a graphic t-shirt, baggy ripped jeans and combat boots", vibe: "90s grunge, layered and undone" },
  { id: "hipster", outfit: "a vintage printed shirt, ankle-rolled chinos, retro sneakers, a beanie and retro acetate eyeglasses", vibe: "indie hipster, thrifted mix" },
  { id: "utility", outfit: "a chore jacket or military field jacket, a t-shirt, cargo trousers and work boots, olive and khaki tones", vibe: "utility workwear, functional and cool" },
  { id: "tonos-tierra", outfit: "a camel crew-neck sweater, brown corduroy trousers and tan suede boots, warm earth tones", vibe: "warm earthy tones" },
  { id: "monocromatico", outfit: "a head-to-toe grey outfit — a grey sweater, grey trousers and grey sneakers in tonal shades, clean and minimal, grey not black", vibe: "tonal monochrome grey, clean minimal" },
  { id: "color-protagonista", outfit: "a bold bottle-green sweater with neutral trousers and white sneakers, the color as the star", vibe: "bold color statement" },
  { id: "vintage", outfit: "a retro denim jacket over a vintage shirt, pleated trousers and retro sneakers", vibe: "vintage retro, with history" },
  { id: "nautico", outfit: "a navy-and-white breton striped t-shirt, white trousers, a navy blazer and loafers", vibe: "nautical breton style" },
  { id: "romantico", outfit: "a light linen shirt open at the collar, soft beige trousers, relaxed soft tones, no hard structure", vibe: "soft relaxed romantic, light tones" },
  { id: "boho", outfit: "an open linen shirt, loose relaxed trousers, layered necklaces and leather boots", vibe: "free-spirited boho, textured" },
  { id: "glam-noche", outfit: "a sharp black tuxedo (black suit) with a fine white shirt and no tie, polished black loafers, black-tie", vibe: "evening glam black-tie, dressed to shine" },
];

function prompt(outfit, vibe) {
  return `Candid full-body street-style fashion photograph of the SAME man shown in the reference image. Keep his exact face, hairstyle, hair color, skin tone and body identical to the reference. He is now wearing ${outfit}. ${vibe}. NATURAL CANDID POSE — weight shifted onto one leg, one hand in a pocket or relaxed at his side, looking slightly off to the side, mid-stride or leaning casually; absolutely NOT a stiff straight-on catalog/mannequin pose, NOT arms-down symmetric. SETTING: outdoors on a quiet sunlit street, a warm textured plaster or stucco wall behind him, hints of cobblestone ground, warm golden natural daylight, soft shadows, editorial Pinterest aesthetic, slight shallow depth of field. Full body visible from head to feet, photorealistic, high quality. IMPORTANT: do NOT use any turtleneck, mock neck, funnel neck or high bulky collar. No text, no logos, no brand marks.`;
}

const outDir = "docs_para_claude/looks-hombre";
mkdirSync(outDir, { recursive: true });

for (let i = 0; i < LOOKS.length; i++) {
  const look = LOOKS[i];
  const out = `${outDir}/${look.id}-hombre.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${look.id}`);
    continue;
  }
  const parts = [
    { text: prompt(look.outfit, look.vibe) },
    { inlineData: { mimeType: "image/png", data: AVATARS[i % AVATARS.length] } },
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
    console.error(`ERROR ${look.id}: ${res.status}`);
    continue;
  }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) {
    console.error(`sin imagen ${look.id}`);
    continue;
  }
  writeFileSync(out, Buffer.from(img.inlineData.data, "base64"));
  console.log(`OK → ${out} (m${(i % AVATARS.length) + 1})`);
}
console.log("LISTO");
