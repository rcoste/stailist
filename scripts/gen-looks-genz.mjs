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
// Uso:  node scripts/gen-looks-genz.mjs [--skip-existing] [--only=<id>[,<id>...]]
//   --only=minimalista        regenera solo esa carta (ambos géneros si existen)
//   --only=minimalista-mujer  regenera solo esa variante (id-genero)
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const skip = process.argv.includes("--skip-existing");
// --only=<id|id-genero>[,...]: regenera solo esas cartas (re-roll puntual de
// una imagen con artefacto, sin re-generar las 49). Vacío = todas.
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean) : null;
// Casa "minimalista" (el id) o "minimalista-mujer" (id-genero, sin .png).
const wanted = (id, genero) => !ONLY || ONLY.includes(id) || ONLY.includes(`${id}-${genero}`);
const ref = (f) => readFileSync(`docs_para_claude/genz-roster/${f}`).toString("base64");

// m6 = la modelo de la landing (public/landing/b1-normal.png): joven, cara de
// la marca. Reemplaza a m4/m5 en los estilos clásicos — la crítica de stylist
// (2026-07-22) encontró que modelo mayor + styling recatado apilaban señales
// de edad y esas cartas leían "señora/monja".
const W = { m1: "mujer-01.png", m2: "mujer-02.png", m3: "mujer-03.png", m4: "mujer-04.png", m5: "mujer-05.png", m6: "mujer-06.png" };
const M = { h1: "hombre-01.png", h2: "hombre-02.png", h3: "hombre-03.png", h4: "hombre-04.png" };

const EXPRESSION = "EXPRESSION: calm neutral face with a relaxed CLOSED mouth or a very subtle smirk — absolutely NO smiling, NO teeth showing, NOT angry; a cool aloof editorial model expression. Usually NOT eye contact, looking away to the side or down.";
const ANTIPOSE = "FRAMING: candid and un-posed, caught between moments, NOT a stiff straight-on centered catalog pose, NOT symmetric, slightly off-axis three-quarter, off-center. Full outfit clearly visible head to feet.";
const SCENE = "Clean Gen-Z aesthetic: cool neutral daylight, plain flat light-grey concrete wall, NO warm golden tones, NO stucco, NO cobblestone, neutral white balance, crisp.";
// Ancla física: Gemini deja bolsas/accesorios flotando en el aire (artefacto).
const ANCHOR = "Any bag or accessory is physically anchored to the body — held in a hand or worn with a visible strap over the shoulder resting against the body — NEVER floating in mid-air detached from the body.";
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
  ["y2k","m1","a cropped baby tee, low-rise baggy cargo jeans, a hoodie tied at the waist, chunky sneakers and tiny sunglasses, 2000s Y2K revival","a high ponytail with two face-framing front strands, 2000s style"],
  ["coquette","m1","a pastel bow-detail blouse, a pleated mini skirt, sheer tights, ballet flats and a hair bow, coquette balletcore","a half-up hairstyle tied with the hair bow, soft and girly"],
  ["color-protagonista","m1","a bold cobalt-blue oversized button-up shirt worn open-collared and loosely tucked into relaxed straight-leg off-white jeans, with white sneakers — ONE single vivid-color piece as the star against a neutral base (NOT a monochrome set)","loose and straight, sleek and polished","Standing facing the camera in a relaxed three-quarter stance, weight on one leg, one hand in a pocket, looking aside."],
  ["streetwear","m2","an oversized graphic hoodie, baggy wide-leg jeans, chunky sneakers, a cap, a crossbody bag and layered chains, urban streetwear","loose natural waves under the cap"],
  ["grunge","m2","an oversized plaid flannel over a vintage band tee, ripped baggy jeans, chunky combat boots and layered silver necklaces, 90s grunge revival","messy undone loose hair, effortlessly grungy"],
  ["edgy","m2","a black leather moto jacket, a black baby tee, black baggy jeans and chunky boots, sleek all-black with attitude","sleek straight loose hair, sharp and polished"],
  ["vintage","m2","a thrifted oversized denim jacket, a vintage graphic tee, high-waist mom jeans, retro low sneakers and small sunglasses, thrifted vintage mix","loose natural waves, effortless retro"],
  ["hipster","m2","a thrifted printed blouse, a knit cardigan, high-waist mom jeans, ankle boots, acetate glasses and statement earrings, indie thrift mix","a loose messy low bun with face-framing strands and a claw clip"],
  ["casual-effortless","m3","a white tee tucked into straight-leg jeans, an oversized shirt-jacket layered on top, white sneakers and a tote bag, effortless everyday","a relaxed low ponytail with loose front strands"],
  ["athleisure","m3","a fitted sports set (sports bra and high-waist leggings) under an oversized zip hoodie, chunky sneakers, hair up, sporty athleisure","a high sleek bun, sporty and clean"],
  ["minimalista","m3","a ribbed tank, straight-leg tailored trousers, sleek pointed mules and a small structured top-handle bag carried in her free hand, strict minimal neutral palette","a sleek low bun, modern and polished with clean edges"],
  ["gorpcore","m6","an oversized technical shell jacket with drawstrings worn open over a fitted top, baggy nylon cargo track pants, a crossbody sling worn tight across the chest and chunky trail-running sneakers, fashion-forward gorpcore with streetwear proportions","a messy low bun, sporty and undone"],
  ["utility","m6","a cropped boxy olive utility jacket with big patch pockets over a fitted white tank, high-waist wide-leg olive cargo trousers and chunky black boots, utility workwear with modern fashion proportions","a slicked-back low ponytail, clean and functional"],
  ["academia","m6","a brown tweed blazer over a white collared shirt and a fine-knit sweater-vest, a pleated checked MINI skirt with sheer black tights and chunky leather loafers, hair loose, youthful intellectual dark-academia","loose hair with the front strands tucked behind the ears"],
  ["monocromatico","m3","a head-to-toe tonal grey outfit — a grey knit and matching grey trousers with grey sneakers, single-tone column","sleek straight loose hair, minimal and polished"],
  ["smart-casual","m4","a relaxed blazer over a fitted tee, straight dark-wash jeans and heeled ankle boots, polished smart casual","loose soft waves, polished but relaxed"],
  ["sastre","m4","an oversized tailored suit — a relaxed blazer and wide-leg trousers over a tank, with pointed shoes, modern power tailoring, confident poised energy","a slicked-back low bun, sharp editorial power look"],
  ["preppy","m4","a knit vest over a collared shirt, a tailored pleated mini skirt, knee socks and loafers, a shoulder bag, polished preppy","a half-up hairstyle with a thin ribbon, neat and collegiate"],
  ["romantico","m6","a bias-cut floral-print midi slip dress with thin straps and a fitted waist, a cropped open knit cardigan, delicate gold jewelry and ballet flats, hair loose, gentle romantic feminine — youthful, with shape","soft loose waves with a small front twist pinned back, romantic"],
  ["coastal","m5","a crisp loose white linen shirt, wide-leg beige linen trousers, delicate thin gold jewelry and flat leather sandals, relaxed coastal clean-girl","effortless beachy waves loosely clipped with a claw clip"],
  ["clasico-elegante","m6","an oversized relaxed camel wool coat draped over an ivory fine-knit top, wide-leg cream trousers, sleek loafers and a structured handbag, youthful quiet-luxury old money","a low sleek chignon, elegant with clean edges"],
  ["glam-noche","m5","a satin slip evening dress, strappy heels and a small clutch, evening glam","sleek hair pulled back behind the shoulders, evening polish"],
  ["tonos-tierra","m6","a fitted ribbed camel knit top tucked into high-waist wide-leg chocolate-brown trousers, a suede shoulder bag and suede sneakers, warm earth tones, modern and youthful","a relaxed low ponytail with face-framing strands"],
  ["nautico","m6","a navy-and-white breton striped top, high-waist white wide-leg trousers, an OVERSIZED relaxed navy blazer and white sneakers, fresh modern nautical breton","a low loose ponytail, fresh and breezy"],
  ["boho","m6","a flowy V-neck printed maxi dress with a rich contrasting print, a cropped crochet vest, western boots and layered gold jewelry, modern coastal boho with energy","loose bohemian waves with two thin front braids"],
  ["coreano","m3","an oversized drapey K-fashion look — a slim black fine knit under an oversized unstructured long grey blazer, VERY wide-leg high-waisted fluid drapey black trousers with a soft drape, and minimal white sneakers, soft monochrome neutral palette, Korean minimalist soft tailoring — oversized but intentional, the wide fluid trousers are the statement","sleek straight centre-parted hair, minimal and polished","Standing facing the camera in a relaxed three-quarter stance, weight on one leg, one hand loose at her side, looking aside — full drapey silhouette visible."],
];
const MEN = [
  ["y2k","h4","baggy low-rise carpenter jeans, a graphic baby tee, an open zip hoodie, a trucker cap and chunky sneakers, 2000s Y2K revival"],
  ["streetwear","h1","an oversized graphic tee, baggy wide-leg carpenter jeans, an open hoodie, chunky sneakers, a crossbody bag and layered chains, urban streetwear"],
  ["grunge","h4","an oversized plaid flannel over a vintage band tee, ripped baggy jeans, chunky combat boots and a beanie, 90s grunge revival"],
  ["edgy","h1","a black leather biker jacket, a black tee, black slim-baggy jeans and black boots, sleek all-black with attitude"],
  ["vintage","h4","a thrifted denim jacket, a vintage graphic tee, straight-leg jeans and retro low sneakers, thrifted vintage mix"],
  ["color-protagonista","h1","a bold cobalt-blue oversized knit sweater with relaxed straight-leg ecru trousers and white sneakers, a single vivid color as the star"],
  ["athleisure","h4","an oversized performance tee, knee-length sport shorts over leggings or relaxed joggers, a cap and chunky sneakers, sporty athleisure"],
  ["hipster","h1","a thrifted patterned button-up, a knit cardigan, cuffed straight jeans, ankle boots and acetate glasses, indie thrift mix"],
  ["academia","h2","a relaxed-fit brown tweed blazer over a fine-knit sweater-vest and an open-collar oxford shirt, pleated wide-leg wool trousers and chunky leather loafers, youthful intellectual dark-academia"],
  ["smart-casual","h2","a relaxed blazer over a fitted tee, straight-leg loose dark-wash jeans and chunky leather loafers, polished smart casual with modern relaxed fit"],
  ["sastre","h2","an oversized tailored suit — a relaxed blazer and wide-leg trousers with an open-collar shirt and loafers, modern tailoring"],
  ["minimalista","h2","a plain heavyweight boxy crew tee, relaxed straight-leg tailored trousers and minimal leather sneakers, strict minimal neutral palette, modern relaxed fit"],
  ["utility","h2","a boxy olive chore jacket with big patch pockets over a white tee, relaxed wide-leg olive cargo trousers and chunky black boots, utility workwear with modern fashion proportions"],
  ["gorpcore","h2","an oversized technical shell jacket half-zipped over a fitted top, baggy nylon cargo track pants, a beanie, a crossbody sling worn tight across the chest and chunky trail-running sneakers, fashion-forward gorpcore with streetwear proportions"],
  ["casual-effortless","h2","a white tee, an open overshirt, straight-leg jeans and white sneakers, effortless everyday"],
  ["monocromatico","h2","a head-to-toe tonal grey outfit — a grey knit and matching grey trousers with grey sneakers, single-tone column"],
  ["clasico-elegante","h3","an oversized relaxed camel wool overcoat over a fine ivory knit, wide-leg grey wool trousers and sleek leather loafers, youthful quiet-luxury old money"],
  ["coastal","h3","an open cream linen overshirt over a white tee, relaxed beige linen trousers and minimalist tan leather sandals, relaxed coastal"],
  ["tonos-tierra","h3","a chunky camel knit sweater, relaxed wide-leg chocolate-brown trousers and suede sneakers, warm earth tones, modern relaxed fit"],
  ["nautico","h3","a navy-and-white breton striped top under an OVERSIZED relaxed navy blazer, straight-leg ecru trousers and clean white sneakers, fresh modern nautical breton"],
  ["preppy","h3","a navy knit sweater over an oxford shirt, relaxed-fit pleated beige chinos and chunky penny loafers, polished modern preppy campus"],
  ["glam-noche","h3","a sharp black silk shirt, slim tailored black trousers and polished shoes, evening going-out glam"],
  ["boho","h3","an open warm-toned PATTERNED textured camp shirt over a white tee, layered pendant necklaces, relaxed earthy brown trousers and leather sandals, free-spirited modern boho — the print and jewelry are the statement"],
  ["romantico","h3","a soft blush-pink lightweight crew-neck knit sweater, relaxed off-white trousers and clean white sneakers, soft romantic light palette — gentle, tidy, NO open overshirt, NO linen shirt"],
  ["coreano","h2","an oversized drapey K-fashion look — a fine-gauge black knit under an unstructured long grey overcoat, VERY wide-leg high-waisted fluid drapey black trousers with a soft drape, and clean minimal white leather sneakers, soft monochrome neutral palette, Korean minimalist soft tailoring — oversized but intentional, the wide fluid trousers are the statement"],
];

// `hair` (opcional, por carta): el peinado es parte del styling — sin él, el
// img2img clona la melena de la referencia y todo el deck sale peinado igual.
// Con hair, se conserva cara y COLOR de pelo pero el peinado lo pone el estilo.
function prompt(subj, poss, outfit, pose, hair) {
  const Cap = subj === "man" ? "He" : "She";
  const identity = hair
    ? `Keep ${poss} exact face, hair color, skin tone and overall look identical to the reference, but style ${poss} hair differently: ${hair}.`
    : `Keep ${poss} exact face, hairstyle, hair color, skin tone and overall look identical to the reference.`;
  return `Candid full-body street-style fashion photograph of the SAME ${subj} shown in the reference image. ${identity} ${Cap} is now wearing ${outfit}. ${pose} ${EXPRESSION} ${ANTIPOSE} ${ANCHOR} ${SCENE} Full body head to feet, photorealistic, high quality. No text, no logos.`;
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

// El índice de pose NO depende del filtro (se avanza siempre) para que cada
// carta conserve la MISMA pose que en la generación completa — regenerar una
// sola con --only reproduce su pose canónica, no una corrida.
let i = 0;
for (const [id, mk, outfit, hair, poseOv] of WOMEN) {
  const file = id === "coquette" ? "coquette.png" : `${id}-mujer.png`;
  if (wanted(id, "mujer")) await gen(file, W[mk], prompt("woman", "her", outfit, poseOv ?? POSES_W[i % POSES_W.length], hair));
  i++;
}
i = 0;
for (const [id, mk, outfit] of MEN) {
  if (wanted(id, "hombre")) await gen(`${id}-hombre.png`, M[mk], prompt("man", "his", outfit, POSES_M[i % POSES_M.length]));
  i++;
}
console.log("LISTO");
