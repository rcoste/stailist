// CANÓNICO (rebrand v3 Gen-Z, 2026-06-27). Genera las imágenes del swipe de
// gustos vistiendo al REPARTO aprobado (europeo-latino joven, banda 20-32),
// con la fórmula congelada: foto LIMPIA (luz fría neutra, pared gris lisa, sin
// estuco/golden/Pinterest) + pose CANDID (tres cuartos, fuera de centro,
// mirando aparte) + expresión SIN DIENTES (smirk/seria). img2img: condiciona
// cada look al retrato del modelo asignado (match edad↔estilo).
//
// Supersede a gen-people.mjs, gen-looks.mjs, gen-looks-avatar.mjs y
// gen-new-styles.mjs (todos producían el look millennial viejo).
//
// Refs del reparto (locales, gitignored): docs_para_claude/genz-roster/
//   mujer-01..05.png, hombre-01..04.png
// Salida: public/looks/<id>-<genero>.png  (coquette es women-only → coquette.png)
//
// Uso:  node scripts/gen-looks-genz.mjs [--skip-existing]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const skip = process.argv.includes("--skip-existing");
const ref = (f) => readFileSync(`docs_para_claude/genz-roster/${f}`).toString("base64");

const W = { m1: "mujer-01.png", m2: "mujer-02.png", m3: "mujer-03.png", m4: "mujer-04.png", m5: "mujer-05.png" };
const M = { h1: "hombre-01.png", h2: "hombre-02.png", h3: "hombre-03.png", h4: "hombre-04.png" };

const EXPRESSION = "EXPRESSION: calm neutral face with a relaxed CLOSED mouth or a very subtle smirk — absolutely NO smiling, NO teeth showing, NOT angry; a cool aloof editorial model expression. Usually NOT eye contact, looking away to the side or down.";
const ANTIPOSE = "FRAMING: candid and un-posed, caught between moments, NOT a stiff straight-on centered catalog pose, NOT symmetric, slightly off-axis three-quarter, off-center. Full outfit clearly visible head to feet.";
const SCENE = "Clean Gen-Z aesthetic: cool neutral daylight, plain flat light-grey concrete wall, NO warm golden tones, NO stucco, NO cobblestone, neutral white balance, crisp.";
const POSES_W = [
  "Looking off to the side, one hand tucking hair, weight on one leg.",
  "Hands in pockets, looking down and away, leaning slightly.",
  "Caught mid-step walking, turned three-quarter, gaze away.",
  "Standing three-quarter, one hand at the bag, chin slightly down, looking aside.",
  "Adjusting a sleeve, looking over the shoulder, off-center.",
];
const POSES_M = [
  "Looking off to the side, one hand in his pocket, weight on one leg.",
  "Both hands in pockets, looking down and away, leaning against the wall.",
  "Caught mid-step walking, turned three-quarter, gaze away.",
  "Standing three-quarter, one hand adjusting the jacket, chin slightly down, looking aside.",
  "Arms relaxed, looking over the shoulder, off-center.",
];

// [id, modelKey, outfit]
const WOMEN = [
  ["y2k","m1","a cropped baby tee, low-rise baggy cargo jeans, a hoodie tied at the waist, chunky sneakers and tiny sunglasses, 2000s Y2K revival"],
  ["coquette","m1","a pastel bow-detail blouse, a pleated mini skirt, sheer tights, ballet flats and a hair bow, coquette balletcore"],
  ["color-protagonista","m1","a bold cobalt-blue oversized shirt with matching wide-leg trousers and white sneakers, a single vivid color as the star"],
  ["streetwear","m2","an oversized graphic hoodie, baggy wide-leg jeans, chunky sneakers, a cap, a crossbody bag and layered chains, urban streetwear"],
  ["grunge","m2","an oversized plaid flannel over a vintage band tee, ripped baggy jeans, chunky combat boots and layered silver necklaces, 90s grunge revival"],
  ["edgy","m2","a black leather moto jacket, a black baby tee, black baggy trousers and chunky boots, sleek all-black with attitude"],
  ["vintage","m2","a thrifted oversized denim jacket, a vintage graphic tee, high-waist mom jeans, retro low sneakers and small sunglasses, thrifted vintage mix"],
  ["hipster","m2","a thrifted printed blouse, a knit cardigan, high-waist mom jeans, ankle boots, acetate glasses and statement earrings, indie thrift mix"],
  ["casual-effortless","m3","a white tee tucked into straight-leg jeans, an oversized shirt-jacket layered on top, white sneakers and a tote bag, effortless everyday"],
  ["athleisure","m3","a fitted sports set (sports bra and high-waist leggings) under an oversized zip hoodie, chunky sneakers, hair up, sporty athleisure"],
  ["minimalista","m3","a ribbed tank, straight-leg tailored trousers, sleek pointed mules and a small structured bag, strict minimal neutral palette"],
  ["gorpcore","m3","a shell jacket over a zip fleece, cargo hiking trousers, a crossbody sling and trail running sneakers, outdoorsy gorpcore neutral tones"],
  ["utility","m3","a belted olive utility jacket over a white tee, cargo trousers and lace-up boots, functional utility workwear"],
  ["academia","m4","a brown tweed blazer over a white collared shirt and a fine-knit sweater-vest, a pleated checked midi skirt and leather loafers, intellectual dark-academia"],
  ["monocromatico","m3","a head-to-toe tonal grey outfit — a grey knit and matching grey trousers with grey sneakers, single-tone column"],
  ["smart-casual","m4","a relaxed blazer over a fitted tee, straight dark-wash jeans and heeled ankle boots, polished smart casual"],
  ["sastre","m4","an oversized tailored suit — a relaxed blazer and wide-leg trousers over a tank, with pointed shoes, modern power tailoring"],
  ["preppy","m4","a knit vest over a collared shirt, a tailored pleated mini skirt, knee socks and loafers, a shoulder bag, polished preppy"],
  ["romantico","m4","a soft floral-print midi dress with a fine knit cardigan and ballet flats, gentle romantic feminine"],
  ["coastal","m5","a crisp loose white linen shirt, wide-leg beige linen trousers, delicate thin gold jewelry and flat leather sandals, relaxed coastal clean-girl"],
  ["clasico-elegante","m5","a camel wool coat over an ivory silk blouse, straight cream trousers, leather loafers and a structured handbag, quiet-luxury old money"],
  ["glam-noche","m5","a satin slip evening dress, strappy heels and a small clutch, evening glam"],
  ["tonos-tierra","m5","a camel knit sweater, a brown midi skirt, tan suede boots and a brown bag, warm earth tones"],
  ["nautico","m5","a navy-and-white breton striped top, high-waist white wide trousers, a navy blazer and ballet flats, nautical breton"],
  ["boho","m5","a flowy printed maxi dress, a crochet fringed vest, leather boots and layered jewelry, modern coastal boho"],
];
const MEN = [
  ["y2k","h4","baggy low-rise carpenter jeans, a graphic baby tee, an open zip hoodie, a trucker cap and chunky sneakers, 2000s Y2K revival"],
  ["streetwear","h1","an oversized graphic tee, baggy wide-leg carpenter jeans, an open hoodie, chunky sneakers, a crossbody bag and layered chains, urban streetwear"],
  ["grunge","h4","an oversized plaid flannel over a vintage band tee, ripped baggy jeans, chunky combat boots and a beanie, 90s grunge revival"],
  ["edgy","h1","a black leather biker jacket, a black tee, black slim-baggy jeans and black boots, sleek all-black with attitude"],
  ["vintage","h4","a thrifted denim jacket, a vintage graphic tee, straight-leg jeans and retro low sneakers, thrifted vintage mix"],
  ["color-protagonista","h1","a bold cobalt-blue knit sweater with neutral straight trousers and white sneakers, a single vivid color as the star"],
  ["athleisure","h4","an oversized performance tee, knee-length sport shorts over leggings or relaxed joggers, a cap and chunky sneakers, sporty athleisure"],
  ["hipster","h1","a thrifted patterned button-up, a knit cardigan, cuffed straight jeans, ankle boots and acetate glasses, indie thrift mix"],
  ["academia","h2","a brown tweed blazer over an oxford shirt and a fine-knit sweater-vest, tailored wool trousers and leather loafers, intellectual dark-academia"],
  ["smart-casual","h2","a relaxed blazer over a fitted tee, straight dark-wash jeans and leather loafers, polished smart casual"],
  ["sastre","h2","an oversized tailored suit — a relaxed blazer and wide-leg trousers with an open-collar shirt and loafers, modern tailoring"],
  ["minimalista","h2","a plain crew tee, straight-leg tailored trousers and minimal leather sneakers, strict minimal neutral palette"],
  ["utility","h2","a belted olive utility jacket over a tee, cargo trousers and lace-up boots, functional utility workwear"],
  ["gorpcore","h2","a shell jacket over a zip fleece, cargo hiking trousers, a beanie and trail running sneakers, outdoorsy gorpcore neutral tones"],
  ["casual-effortless","h2","a white tee, an open overshirt, straight-leg jeans and white sneakers, effortless everyday"],
  ["monocromatico","h2","a head-to-toe tonal grey outfit — a grey knit and matching grey trousers with grey sneakers, single-tone column"],
  ["clasico-elegante","h3","a camel wool overcoat over a fine knit, tailored trousers and leather loafers, quiet-luxury old money"],
  ["coastal","h3","an open cream linen overshirt over a white tee, relaxed beige linen trousers and minimalist tan leather sandals, relaxed coastal"],
  ["tonos-tierra","h3","a brown camel knit sweater, taupe trousers and suede boots, warm earth tones"],
  ["nautico","h3","a navy-and-white breton striped top, a navy blazer, white trousers and boat shoes, nautical breton"],
  ["preppy","h3","a knit sweater over a collared shirt, beige chinos and loafers, polished preppy campus"],
  ["glam-noche","h3","a sharp black silk shirt, slim tailored black trousers and polished shoes, evening going-out glam"],
  ["boho","h3","an open linen shirt over a tee, loose linen trousers, layered necklaces and leather sandals, relaxed boho"],
  ["romantico","h3","a soft pastel linen shirt, light-tone relaxed trousers and clean loafers, soft romantic light palette"],
];

function prompt(subj, poss, outfit, pose) {
  const Cap = subj === "man" ? "He" : "She";
  return `Candid full-body street-style fashion photograph of the SAME ${subj} shown in the reference image. Keep ${poss} exact face, hairstyle, hair color, skin tone and overall look identical to the reference. ${Cap} is now wearing ${outfit}. ${pose} ${EXPRESSION} ${ANTIPOSE} ${SCENE} Full body head to feet, photorealistic, high quality. No text, no logos.`;
}

async function gen(file, avatarFile, text) {
  const path = `public/looks/${file}`;
  if (skip && existsSync(path)) { console.log(`skip ${file}`); return; }
  const parts = [{ text }, { inlineData: { mimeType: "image/png", data: ref(avatarFile) } }];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } } }) }
  );
  if (!res.ok) { console.error(`ERROR ${file}: ${res.status} ${(await res.text()).slice(0,120)}`); return; }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) { console.error(`SIN IMAGEN ${file}`); return; }
  writeFileSync(path, Buffer.from(img.inlineData.data, "base64"));
  console.log(`OK → ${file}`);
}

let i = 0;
for (const [id, mk, outfit] of WOMEN) {
  const file = id === "coquette" ? "coquette.png" : `${id}-mujer.png`;
  await gen(file, W[mk], prompt("woman", "her", outfit, POSES_W[i % POSES_W.length])); i++;
}
i = 0;
for (const [id, mk, outfit] of MEN) {
  await gen(`${id}-hombre.png`, M[mk], prompt("man", "his", outfit, POSES_M[i % POSES_M.length])); i++;
}
console.log("LISTO");
