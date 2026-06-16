// Genera las imágenes de los looks de swipes vistiendo a los AVATARES fijos de
// Roberto. Condiciona la imagen al avatar (misma cara/cuerpo) + outfit del
// estilo. Pose candid + setting de calle/yeso cálido (no estudio plano).
// Mismo enfoque que el try-on (gemini-3-pro-image, multimodal).
//
// Uso:  node scripts/gen-looks-avatar.mjs [--skip-existing]
// Salida: docs_para_claude/looks-mujer/<id>-mujer.png  (staging para revisar;
// se mueven a public/looks/ al reestructurar lib/looks.ts con ambos géneros).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3-pro-image";
const skipExisting = process.argv.includes("--skip-existing");

const AVATARS = [
  "docs_para_claude/avateres styles/Gemini_Generated_Image_6n84pq6n84pq6n84.png", // rubia
  "docs_para_claude/avateres styles/Gemini_Generated_Image_8usx3p8usx3p8usx.png", // morena
  "docs_para_claude/avateres styles/Gemini_Generated_Image_uvg4iuvg4iuvg4iu.png", // castaña ondulada
].map((p) => readFileSync(p).toString("base64"));

// Outfits MUJER de la spec v2 (docs/designs/estilos.md).
const LOOKS = [
  { id: "minimalista", outfit: "a fitted plain white tank top, high-waisted straight black tailored trousers and black pointed-toe mules, strictly minimal neutral palette, no accessories", vibe: "minimalist clean style, sharp simple lines" },
  { id: "casual-effortless", outfit: "a white t-shirt half-tucked into high-waisted light-wash mom jeans, ballet flats, a small crossbody bag", vibe: "effortless everyday casual, relaxed" },
  { id: "clasico-elegante", outfit: "an ivory silk blouse, high-waisted camel tailored trousers, a beige trench coat draped over her shoulders, nude slingback heels, delicate hoop earrings", vibe: "timeless refined elegance, old money" },
  { id: "preppy", outfit: "a knit cardigan over a collared shirt, a pleated plaid midi skirt, ballet flats and a small structured bag", vibe: "polished preppy campus style" },
  { id: "sastre", outfit: "a structured grey blazer with matching tailored trousers, a simple top underneath, pointed heels, strong shoulders", vibe: "modern power tailoring" },
  { id: "smart-casual", outfit: "a blazer over a flowy blouse with straight dark-wash jeans and heeled ankle boots", vibe: "polished smart casual, office to after" },
  { id: "streetwear", outfit: "an oversized hoodie, baggy wide-leg jeans, chunky sneakers, a cap and a crossbody bag", vibe: "urban streetwear, oversized, attitude" },
  { id: "athleisure", outfit: "high-waisted leggings, a sports top under an open zip hoodie, athletic sneakers, hair in a high ponytail", vibe: "polished athleisure, sporty" },
  { id: "edgy", outfit: "a black leather biker jacket, black skinny jeans, black pointed-toe heeled ankle boots, a thin choker, all black", vibe: "edgy rock, sleek all black" },
  { id: "grunge", outfit: "a floral slip dress layered with an oversized plaid flannel shirt tied at the waist, sheer tights and chunky combat boots", vibe: "90s grunge, layered and undone" },
  { id: "hipster", outfit: "a vintage printed blouse with high-waisted mom jeans and a cardigan, ankle boots, retro acetate eyeglasses and statement earrings", vibe: "indie hipster, thrifted mix" },
  { id: "utility", outfit: "a belted olive-green utility jacket over a white tee, cargo trousers and boots", vibe: "utility workwear, functional and cool" },
  { id: "tonos-tierra", outfit: "a camel crew-neck sweater with a brown midi skirt, tan suede boots and a brown bag, warm earth tones", vibe: "warm earthy tones" },
  { id: "monocromatico", outfit: "a head-to-toe single-tone beige outfit, a beige blazer with matching beige trousers, tonal column look", vibe: "tonal monochrome beige, elegant column" },
  { id: "color-protagonista", outfit: "a vibrant cobalt-blue dress with heels in the same bold tone, the color as the star", vibe: "bold color statement" },
  { id: "vintage", outfit: "a retro printed midi dress with a cardigan, loafers and cat-eye sunglasses", vibe: "vintage retro, with history" },
  { id: "nautico", outfit: "a navy-and-white breton striped top, high-waisted white trousers, a navy blazer with gold buttons, ballet flats", vibe: "nautical breton style" },
  { id: "romantico", outfit: "an airy floral-print midi dress in soft pastel tones, a soft knit cardigan and ballet flats", vibe: "soft romantic feminine, light and delicate" },
  { id: "boho", outfit: "a long flowy maxi dress, a fringed kimono vest, boots and layered stacked jewellery", vibe: "free-spirited boho, textured" },
  { id: "glam-noche", outfit: "an elegant satin slip evening dress, strappy high heels and a clutch", vibe: "evening glam, dressed to shine" },
];

function prompt(outfit, vibe) {
  return `Candid full-body street-style fashion photograph of the SAME woman shown in the reference image. Keep her exact face, hairstyle, hair color, skin tone and body identical to the reference. She is now wearing ${outfit}. ${vibe}. NATURAL CANDID POSE — weight shifted onto one leg, one hand in a pocket or relaxed at her side, looking slightly off to the side, mid-stride or leaning casually; absolutely NOT a stiff straight-on catalog/mannequin pose, NOT arms-down symmetric. SETTING: outdoors on a quiet sunlit street, a warm textured plaster or stucco wall behind her, hints of cobblestone ground, warm golden natural daylight, soft shadows, editorial Pinterest aesthetic, slight shallow depth of field. Full body visible from head to feet, photorealistic, high quality. IMPORTANT: do NOT use any turtleneck, mock neck, funnel neck or high bulky collar. No text, no logos, no brand marks.`;
}

const outDir = "docs_para_claude/looks-mujer";
mkdirSync(outDir, { recursive: true });

for (let i = 0; i < LOOKS.length; i++) {
  const look = LOOKS[i];
  const out = `${outDir}/${look.id}-mujer.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${look.id}`);
    continue;
  }
  const avatar = AVATARS[i % AVATARS.length];
  const parts = [
    { text: prompt(look.outfit, look.vibe) },
    { inlineData: { mimeType: "image/png", data: avatar } },
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
  console.log(`OK → ${out} (avatar ${(i % AVATARS.length) + 1})`);
}
console.log("LISTO");
