// Las 25 cartas del swipe de HOMBRE, v4 (2026-08-03).
//
// QUÉ CAMBIA RESPECTO A gen-looks-genz.mjs (v3, el que sigue en producción)
//
// 1. ESCENA PROPIA POR CARTA. La v3 tenía una constante: "plain flat light-grey
//    concrete wall". Las 25 cartas, la misma pared. Por eso el deck de hombre se
//    lee como catálogo mientras el de mujer (v4, ya rehecho) se lee como algo que
//    quieres ponerte. Aquí cada carta trae su locación: campus para preppy,
//    muelle para náutico, banqueta con fachada para street.
//
// 2. EL OUTFIT VIENE DE UNA FOTO, NO DE UN PÁRRAFO. Es la lección del deck de
//    mujer: donde el outfit se describía con palabras, el generador rellenaba con
//    lo más promedio que sabe y la carta salía sin punto de vista. Van SIEMPRE dos
//    imágenes de referencia — el avatar del modelo (ancla cara y cuerpo) y una
//    foto del outfit.
//
// 3. DE DÓNDE SALE ESA FOTO. Para 17 cartas es SU PROPIA CARTA ACTUAL: su ropa ya
//    funcionaba y lo único roto era la escena. Para las 8 que Roberto marcó como
//    malas, es una foto nueva — primero de las 616 referencias ya curadas
//    (elegidas con scripts/elegir-ref-carta.mjs), y solo donde el material propio
//    no tenía el sub-sabor (Y2K, glam de noche, minimalista estricto) una foto
//    cosechada aparte. NUNCA se publica la foto de referencia: se le copia el
//    outfit a NUESTRO modelo, que es lo que se sube.
//
//    OJO: el script ESCRIBE sobre el mismo archivo que LEE para esas 17. Respalda
//    en RESPALDO antes de empezar y lee de ahí.
//
// 4. LA RECETA MANDA LA EJECUCIÓN. Además de la foto va el texto destilado de su
//    familia (silueta, paleta, detalles, vetos) — lo que separa "bien puesto" de
//    "aguado" y que una foto sola no garantiza reproducir.
//
// Uso:  node scripts/gen-looks-hombre-v4.mjs [--only=<id>[,<id>...]] [--dry]
// Salida: public/looks/<id>-hombre.png

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const RESPALDO = "docs_para_claude/looks-hombre-v3";
const REFS = process.env.REFS ?? "docs_para_claude/refs-cartas-hombre";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;
const DRY = process.argv.includes("--dry");

const b64 = (p) => readFileSync(p).toString("base64");

// El reparto de CUERPO ENTERO, no los retratos de la v3: anclan cara Y cuerpo,
// que es como se rehizo el de mujer.
const AVATAR = {
  rob: "docs_para_claude/avatars-hombre/m0-roberto.png",
  m1: "docs_para_claude/avatars-hombre/m1.png",
  m2: "docs_para_claude/avatars-hombre/m2.png",
  m3: "docs_para_claude/avatars-hombre/m3.png",
};

// [id, familia|null, modelo, escena, pose, outfit]
// outfit: null            = su carta v3 (la ropa ya servía, solo cambia la escena)
//         "archivo.jpg"   = foto nueva en REFS/
//         {foto, ajuste}  = esa foto PERO con un cambio puntual ("el chaleco va
//           azul marino, no olivo"). Existe para no tener que salir a buscar
//           otra referencia cuando la que hay solo falla en un detalle, y para
//           que ese detalle quede escrito: si se regenerara el deck desde cero,
//           la carta vuelve a salir igual. Un solo cambio por carta — dos ya no
//           se distinguen de describir el outfit entero.
//         {texto: "..."}  = el outfit descrito, sin foto. Es el peor de los tres
//           y solo se usa cuando no hay imagen que pasar: sin referencia visual
//           el generador rellena la proporción y la caída con lo más promedio
//           que sabe, que es justo el defecto que esta versión vino a arreglar.
//           Se compensa apoyándose en la receta de la familia, que sí describe
//           silueta y ejecución.
//
// REPARTO: cada modelo lleva registros MEZCLADOS a propósito. Si uno cargara los
// estilos arreglados y otro los de calle, el deck estaría enseñando eso en vez de
// estilos, y quien desliza acabaría votando por la persona.
const CARTAS = [
  // ── sastre ────────────────────────────────────────────────────────────────
  ["sastre", "sastre", "m1",
    "A city street outside a modern office building, glass and stone, soft overcast light, blurred pedestrians far behind.",
    "Caught mid-step crossing the sidewalk, jacket moving with him, looking ahead past the camera.", "sastre.jpg"],
  ["glam-noche", "sastre", "m3",
    "A city street at NIGHT: wet asphalt reflecting warm neon and shop signs, dark blue evening sky, blurred lights behind.",
    "Walking toward the camera through the night street, hands relaxed, looking slightly aside.", "glam-noche.jpg"],
  // ── clasico-arreglado ─────────────────────────────────────────────────────
  ["clasico-elegante", "clasico-arreglado", "m2",
    "A quiet old-city street with stone facades and tall shuttered windows, cool even daylight.",
    "Standing three-quarter beside the wall, one hand in his coat pocket, chin slightly down, looking away.", null],
  ["smart-casual", "clasico-arreglado", "rob",
    "Outside a modern cafe: glass front, a few small tables and chairs on the sidewalk, soft afternoon light.",
    "Caught mid-step leaving the cafe, one hand adjusting his sleeve, gaze off to the side.", "smart-casual.jpg"],
  ["academia", "clasico-arreglado", "m3",
    "A university quad: red brick building, clipped lawn and a stone path, a few students blurred far behind, crisp autumn light.",
    "Walking across the path mid-step, bag strap in one hand, looking ahead past the camera.", "academia.jpg"],
  // ── casual-limpio ─────────────────────────────────────────────────────────
  ["minimalista", "casual-limpio", "rob",
    "A wide empty sidewalk beside a clean modern building, large plain surfaces, cool neutral daylight, deep empty space behind.",
    "Caught mid-step walking, arms relaxed at his sides, looking away to the side.", "minimalista.jpg"],
  ["casual-effortless", "casual-limpio", "m1",
    "A leafy residential street with low houses and parked bikes, warm soft daylight filtered through trees.",
    "Standing three-quarter with both hands in his pockets, weight on one leg, looking down the street.", "casual-effortless.jpg"],
  ["coreano", "casual-limpio", "m2",
    "A minimal urban plaza with tall clean concrete columns and long shadows, cool grey daylight.",
    "Caught mid-step, the wide trousers moving with him, looking away to the side.", "coreano.jpg"],
  ["monocromatico", "casual-limpio", "m1",
    "A dim modern underpass or gallery with smooth dark walls and a single band of daylight from the side.",
    // Referencia que mandó Roberto por chat (no llegó como archivo, así que va
    // descrita). Tonal camel de arriba abajo con texturas distintas — es la
    // lectura más limpia de "monocromático" del deck: un solo tono, y lo que
    // cambia es el material, no el color.
    "Standing three-quarter against the wall, one hand in his pocket, chin slightly down.",
    { texto:
      "a camel wool blazer worn open over a cream ribbed wool turtleneck, with beige tailored trousers " +
      "with a clean crease and brown suede loafers — a strictly TONAL camel-and-cream look, one single " +
      "warm neutral family head to toe, where the interest comes from the different textures (smooth wool " +
      "blazer, chunky ribbed knit, flat tailoring, soft suede) and NOT from any colour contrast. " +
      "No black, no dark accents, nothing that breaks the tonal run" }],
  // ── preppy ────────────────────────────────────────────────────────────────
  ["preppy", "preppy", "m3",
    "A university campus in autumn: red brick building, ivy, a stone stair and clipped lawn, crisp golden-free cool daylight.",
    "Walking down the stone stair mid-step, bag in one hand, looking ahead past the camera.", "preppy.jpg"],
  ["nautico", "preppy", "m3",
    "A harbour boardwalk: wooden dock planks, white boat hulls and masts blurred behind, bright coastal daylight.",
    "Standing three-quarter at the dock rail, one hand on the rail, looking out to the side.", "nautico.jpg"],
  // ── edgy ──────────────────────────────────────────────────────────────────
  ["edgy", "edgy", "m2",
    "A narrow city street at dusk beside a dark brick wall and a metal shutter, cold blue light, blurred street lamps behind.",
    "Standing three-quarter against the shutter, one hand in his jacket pocket, looking straight past the camera.", "edgy.jpg"],
  ["grunge", "edgy", "m3",
    "A gritty side street with a graffitied wall and a chain-link fence, flat grey overcast light.",
    "Caught mid-step walking past the fence, hands loose, looking down and away.", "grunge.jpg"],
  // ── street-urbano ─────────────────────────────────────────────────────────
  ["streetwear", "street-urbano", "m1",
    "A busy city sidewalk in front of an old painted facade and a metal door, flat daylight, blurred traffic behind.",
    "Standing three-quarter with weight on one leg, one hand holding the crossbody strap, looking away.", "streetwear.jpg"],
  ["y2k", "street-urbano", "m2",
    "A sun-bleached wall beside a low commercial building and a parking lot, hard flat afternoon light.",
    "Leaning against the wall, one hand adjusting his cap, looking off to the side.", "y2k.jpg"],
  // ── deportivo ─────────────────────────────────────────────────────────────
  ["athleisure", "deportivo", "m2",
    "A park path at the edge of the city: asphalt track, trees and a running lane, bright even morning light.",
    // Camina, NO corre: athleisure es ropa atlética usada fuera del deporte —
    // si sale trotando ya es ropa deportiva y la carta mide otra cosa.
    // El chaleco pasa a marino porque olivo lo dejaba pegado a gorpcore y
    // utility, sus dos vecinas en el deck.
    "Caught mid-step walking at an easy pace, hands relaxed, looking ahead past the camera.",
    { foto: "athleisure.jpg", ajuste: "the puffer gilet is NAVY BLUE, not olive green" }],
  ["gorpcore", "deportivo", "m1",
    "A concrete stair and metal railing beside an elevated road, wet ground, cold overcast light, city blurred behind.",
    "Standing on the stair three-quarter, one hand on the sling strap, looking away to the side.", "gorpcore.jpg"],
  // ── utilitario ────────────────────────────────────────────────────────────
  ["utility", "utilitario", "rob",
    "A loading area behind a warehouse: corrugated metal, a roll-up door and painted concrete, flat grey light.",
    "Caught mid-step crossing the frame, hands loose, looking down and away.", "utility.jpg"],
  // ── thrift-vintage ────────────────────────────────────────────────────────
  ["hipster", "thrift-vintage", "m1",
    "Outside a second-hand shop: a painted blue storefront with a window full of odd objects, soft daylight.",
    "Standing three-quarter at the storefront, one hand raised adjusting his glasses, looking aside.", "hipster.jpg"],
  ["vintage", "thrift-vintage", "m2",
    "A street market stall with racks of old clothes and crates, warm diffuse daylight, blurred shoppers behind.",
    "Caught mid-step between the racks, one hand on a hanger, looking away.", null],
  // ── resort-boho ───────────────────────────────────────────────────────────
  ["coastal", "resort-boho", "m3",
    "A whitewashed coastal street: white walls, a blue door, bright sea light and a sliver of sea far behind.",
    "Walking down the white street mid-step, relaxed, looking off to the side.", "coastal.jpg"],
  ["boho", "resort-boho", "m1",
    "A sunlit plaza with old stone arches and a few market stalls blurred behind, warm even light.",
    "Standing three-quarter in the plaza, one hand in his pocket, looking away to the side.", "boho.jpg"],
  // ── sin familia (atributos, no estilos: conservan su ropa) ────────────────
  ["tonos-tierra", null, "rob",
    "A path beside a low adobe-toned wall with dry grass and a tree, warm late afternoon light.",
    "Caught mid-step along the wall, hands relaxed, looking away.", "tonos-tierra.jpg"],
  ["color-protagonista", null, "m2",
    "A plain white-painted wall with a single strong shadow, bright clean daylight, nothing else competing.",
    "Standing three-quarter, weight on one leg, one hand in his pocket, looking straight past the camera.", null],
  ["romantico", null, "m3",
    "A quiet street beside a garden wall with climbing plants and soft pink blossom, gentle diffuse light.",
    "Standing three-quarter by the wall, hands loose at his sides, chin slightly down, looking aside.", "romantico.jpg"],
];

// ── Recetas: la ejecución que una foto sola no garantiza ────────────────────
const RECETAS = Object.fromEntries(
  readdirSync("lib/engine/recetas")
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const j = JSON.parse(readFileSync(`lib/engine/recetas/${f}`, "utf8"));
      return [j.familia, j.receta];
    })
);

const IDENTIDAD =
  "The FIRST reference image is the MAN. Keep his face, hair, skin tone, body build, height and age EXACTLY as in that first image. " +
  "Do NOT change his ethnicity, do NOT slim him down or bulk him up. Only his clothes, his hair styling, his pose and the location change.";
const OUTFIT_REF =
  "The SECOND reference image shows the OUTFIT. Reproduce those garments on the man from the first image: the same pieces, the same colours, " +
  "the same proportions and the same way each piece sits (what is tucked, open, cuffed, layered). Do NOT copy the person, the face, the body or the location " +
  "from the second image — ONLY the clothes.";
const FRAMING =
  "FRAMING: full body head to feet, the whole outfit clearly visible including the shoes. Candid street-style, caught mid-moment, slightly off-centre. " +
  "NOT a stiff straight-on centred catalog pose.";
const EXPRESSION =
  "EXPRESSION: calm neutral face, relaxed closed mouth or a very subtle smirk. No smiling, no teeth, not angry. Usually not eye contact.";
const ANCLA =
  "Any bag or accessory is physically anchored to the body — held in a hand or worn with a visible strap resting against the body — never floating in mid-air.";
const SIN_MARCAS =
  "CRITICAL: any graphic printed on a garment must be an INVENTED, abstract, non-legible design. Never reproduce a real brand name, band logo or trademark, " +
  "even if one is visible in the reference. No readable text anywhere in the image. No watermark.";

function prompt(familia, escena, pose, textoOutfit = null, ajuste = null) {
  const r = familia ? RECETAS[familia] : null;
  const receta = r
    ? `HOW THIS STYLE IS ACTUALLY WORN (distilled from real street photography — follow this for the execution): ` +
      `SILHOUETTE: ${r.silueta} PALETTE: ${r.paleta} ` +
      `DETAILS THAT MAKE IT: ${r.detalles.join(" ")} ` +
      `NEVER: ${r.evitar.join(" ")} `
    : "";
  const queLleva = textoOutfit
    ? `He is wearing: ${textoOutfit}. `
    // El ajuste va DESPUÉS y en mayúsculas: la instrucción tiene que ganarle a
    // lo que se ve en la foto, que es la fuente más fuerte para el generador.
    : `${OUTFIT_REF} ${ajuste ? `ONE DELIBERATE CHANGE from the reference outfit: ${ajuste}. Everything else stays exactly as in the reference. ` : ""}`;
  return (
    `Candid full-body street-style fashion photograph of a young man, 20-32 years old. ${IDENTIDAD} ${queLleva}${receta}` +
    `POSE: ${pose} SCENE: ${escena} ${FRAMING} ${EXPRESSION} ${ANCLA} ` +
    `Photorealistic, natural depth of field, sharp, high quality, neutral white balance. ${SIN_MARCAS}`
  );
}

async function gen(id, familia, modelo, escena, pose, outfit) {
  const salida = `public/looks/${id}-hombre.png`;
  const obj = outfit && typeof outfit === "object" ? outfit : null;
  const porTexto = obj?.texto ?? null;
  const archivo = obj?.foto ?? (typeof outfit === "string" ? outfit : null);
  // La foto del outfit: la carta v3 respaldada, o la referencia nueva.
  const refOutfit = porTexto ? null : archivo ? `${REFS}/${archivo}` : `${RESPALDO}/${id}-hombre.png`;
  if (refOutfit && !existsSync(refOutfit)) return console.error(`FALTA referencia: ${refOutfit}`);
  if (!existsSync(AVATAR[modelo])) return console.error(`FALTA avatar: ${AVATAR[modelo]}`);

  const text = prompt(familia, escena, pose, porTexto, obj?.ajuste ?? null);
  const etiqueta = porTexto ? "texto" : `${archivo ?? "carta v3"}${obj?.ajuste ? " +ajuste" : ""}`;
  if (DRY) return console.log(`— ${id} (${modelo}, ${etiqueta})\n${text.slice(0, 260)}…\n`);

  const mime = (p) => (p.endsWith(".png") ? "image/png" : "image/jpeg");
  const parts = [
    { text },
    { inlineData: { mimeType: mime(AVATAR[modelo]), data: b64(AVATAR[modelo]) } },
  ];
  if (refOutfit) parts.push({ inlineData: { mimeType: mime(refOutfit), data: b64(refOutfit) } });

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
          }),
        }
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img) throw new Error("respuesta sin imagen");
      writeFileSync(salida, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK  ${id.padEnd(20)} ${modelo}  ${outfit ?? "carta v3"}`);
      return;
    } catch (e) {
      if (intento === 3) return console.error(`FALLÓ ${id}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

// Respaldo ANTES de generar: 17 cartas leen su propio archivo de salida como
// referencia de outfit. Sin esto, la primera corrida las machaca y la segunda
// generaría contra su propio resultado, degradándose en cada vuelta.
mkdirSync(RESPALDO, { recursive: true });
for (const [id] of CARTAS) {
  const orig = `public/looks/${id}-hombre.png`;
  const copia = `${RESPALDO}/${id}-hombre.png`;
  if (existsSync(orig) && !existsSync(copia)) copyFileSync(orig, copia);
}
console.log(`Respaldo v3 en ${RESPALDO}\n`);

for (const [id, familia, modelo, escena, pose, outfit] of CARTAS) {
  if (ONLY && !ONLY.includes(id)) continue;
  await gen(id, familia, modelo, escena, pose, outfit);
}
console.log("\nListo.");
