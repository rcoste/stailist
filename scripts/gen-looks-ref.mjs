// Cartas del swipe de gustos, v4 (2026-07-30) — generadas contra REFERENCIA VISUAL.
//
// Qué cambia respecto a gen-looks-genz.mjs (el anterior):
//
// 1. DOS imágenes de referencia por carta, no una. Antes solo iba el retrato de
//    la modelo y el outfit se describía con palabras — y ahí estaba el problema:
//    donde el texto era vago ("a ribbed tank, straight-leg trousers") el modelo
//    rellenaba con lo más promedio que sabe, y salían cartas sin punto de vista.
//    Ahora va también una FOTO del outfit, curada de Pinterest por Roberto y
//    Tatiana. La ropa deja de ser interpretable.
//
// 2. Escena de CALLE, no pared gris. Las 42 referencias curadas están todas en
//    la calle — fachada, banqueta, sillas de café — y ninguna contra una pared
//    lisa. La pared plana es buena parte de por qué las cartas viejas se leían
//    como catálogo en vez de como algo que quieres ponerte.
//
// 3. Reparto ya aprobado por Roberto (docs_para_claude/roster-mujer/). Son
//    avatares de CUERPO ENTERO en playera blanca y jeans — el formato del
//    proyecto (ver avatars-hombre/_pool.png) — así que anclan cara Y cuerpo.
//
// Uso:  node scripts/gen-looks-ref.mjs [--only=<id>[,<id>...]]
// Salida: public/looks/<id>-mujer.png
import { readFileSync, writeFileSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()) : null;

const b64 = (p) => readFileSync(p).toString("base64");
// Estilos marcados segment:"mujer" en lib/looks.ts (sin versión de hombre).
const SOLO_MUJER = new Set(["coquette", "de-salir"]);
const AV = (f) => `docs_para_claude/roster-mujer/${f}.png`;
const REF = (f) => `docs_para_claude/referencias/${f}.jpg`;

// La escena y la pose van POR CARTA, no como constante.
//
// El primer corte las tenía fijas y salieron diez fotos idénticas: la misma
// mujer caminando de frente por la misma banqueta. Se había cambiado una
// monotonía (la pared gris del v3) por otra. En un deck que se desliza carta
// tras carta, el fondo tiene que diferenciar: un athleisure en un parque y un
// sastre en una escalinata de piedra se leen como dos mundos; en la misma
// banqueta se leen como la misma foto con otra ropa.
const BASE_ESCENA =
  "Real location with depth, never a studio and never a plain flat wall. Photorealistic depth of field.";

const FRAMING =
  "FRAMING: full body head to feet, the whole outfit clearly visible including the shoes. " +
  "Candid street-style, caught mid-moment, off-center. NOT a stiff centered catalog pose.";

const EXPRESSION =
  "EXPRESSION: calm neutral face, relaxed closed mouth or a subtle smirk. No smiling, no teeth. Usually looking away to the side.";

// El PEINADO es parte del styling, no de la identidad.
//
// Al reescribir el generador se perdió esto y quedó "conserva su pelo idéntico
// al de la referencia" — con lo cual las 27 cartas salían con la melena suelta
// que traen los avatares y ningún estilo se peinaba distinto. Lo cachó Roberto.
// El script anterior ya lo tenía resuelto y su comentario lo decía: sin peinado
// por carta, el img2img clona la melena y todo el deck sale igual.
//
// Se conserva cara, COLOR de pelo, tono de piel y edad; el peinado lo pone el
// estilo. Y los accesorios (cinturón, bolsa, lentes) van nombrados en cada
// fórmula, porque también son styling y no relleno.
const identidad = (pelo) =>
  "Keep her face, hair COLOR, skin tone and age EXACTLY as in the first reference image. " +
  "Do NOT change her ethnicity. " +
  (pelo
    ? `Restyle her hair for this look: ${pelo}. `
    : "Keep her hairstyle as in the reference. ") +
  "Her clothes, hair styling, pose and location change.";

// La referencia visual pesa MÁS que un "no logos" al final del prompt: la primera
// prueba de streetwear copió el logo de Metallica de la playera de la foto. En una
// app pública eso es una marca registrada ajena, así que la instrucción va
// explícita y describiendo el reemplazo, no solo prohibiendo.
const SIN_MARCAS =
  "CRITICAL: any graphic printed on a garment must be an INVENTED, abstract, non-legible design. " +
  "Never reproduce a real brand name, band logo, team crest, slogan or trademark, even if one appears " +
  "in the reference image — replace it with a generic faded graphic of similar shape and tone. " +
  "No readable text anywhere in the image.";

// [id, avatar, referencia de outfit, fórmula, escena, pose]
// La fórmula NO sustituye a la foto de referencia: la refuerza, nombrando lo que
// hay que respetar (proporción y paleta) por si el modelo se desvía.
const CARTAS = [
  ["minimalista", "av2", "minimalista-3",
   "a fitted sleeveless black knit top tucked into high-waist cream pleated wide-leg trousers, a thin black belt, a small black leather bag and flat black sandals — strict two-tone palette, the contrast is FITTED on top against WIDE and fluid below",
   "A quiet modern plaza: pale concrete, a clean architectural edge, one long hard shadow across the ground. Bright cool midday light, almost no people.",
   "Standing still in three-quarter view, weight on one leg, one hand holding the bag, chin slightly down, looking away from camera.",
   "a sleek low bun, modern and polished with clean edges"],

  ["casual-effortless", "hero", "casual-effortless-3",
   "an oversized navy crewneck sweatshirt layered over a white collared shirt, mid-blue straight jeans, white crew socks and retro low sneakers, with a cream cap — relaxed, layered, effortless",
   "A café terrace on a quiet corner: bistro chairs and small round tables, an awning, soft morning light.",
   "Sitting sideways on a bistro chair, legs crossed at the ankle, elbow on the table, looking off to the side. Whole outfit and shoes visible.",
   "a relaxed low ponytail with loose front strands, under the cap"],

  ["smart-casual", "b1", "smart-casual-1",
   "a camel oversized blazer worn open over a cream satin cami, relaxed barrel-leg mid-blue jeans, a tan crossbody bag and metallic low sneakers — polished but never stiff",
   "The glass entrance of an office building, reflections of the street in the panes, planters at the side. Overcast even daylight.",
   "Caught mid-step walking out of frame-left, head turned back over her shoulder toward the camera.",
   "loose soft waves, polished but relaxed"],

  // Saco AZUL MARINO y no camel: el camel es el registro de smart-casual (saco
  // suave sobre jeans) y con los dos en camel las cartas se leían iguales al
  // deslizar. Marino en vez de negro porque el deck ya trae mucho negro
  // (minimalista, streetwear, de-salir) y un traje negro entero se pisa con
  // monocromático, que es exactamente eso.
  ["sastre", "av2", "sastre-2",
   "an oversized NAVY BLUE tailored blazer over a plain white tee, high-waist black wide-leg trousers with a thin belt, a tan structured handbag and two-tone cap-toe flats — modern power tailoring, roomy not tight. The blazer must be deep navy blue, NOT camel and NOT beige",
   "A wide stone staircase of an old civic building, tall columns behind, deep shade and one shaft of sun.",
   "Walking down the steps toward the camera, one hand in her trouser pocket, coat open and moving, gaze level and away.",
   "a slicked-back low bun, sharp editorial power look"],

  ["streetwear", "av3", "streetwear-1",
   "an oversized washed-black vintage-look graphic tee, VERY baggy wide black jeans that pool over the shoes, and chunky white sneakers — the exaggerated volume below IS the style",
   "A subway entrance: metal railing, tiled wall, a painted mural blurred behind her, litter of city texture. Flat grey afternoon light.",
   "Leaning back against the railing, both hands in her pockets, one sneaker propped on the bottom rail, looking down and away.",
   "a high messy bun with face-framing strands"],

  ["athleisure", "hero", "athleisure-2",
   "a grey oversized crewneck sweatshirt, black side-stripe track pants, retro low sneakers and sunglasses, holding a coffee cup — sporty pieces worn as STREET clothes, never gym clothes",
   "A park path lined with trees, dappled light through the leaves, a bench and railing behind, joggers blurred far away. Early morning.",
   "Mid-stride walking along the path, coffee cup in one hand, sunglasses on, looking ahead past the camera.",
   "a high sleek ponytail, sporty and clean"],

  ["vintage", "av1", "vintage-2",
   "an oversized blue gingham check shirt with balloon sleeves half-tucked into high-waist wide light-blue jeans, a brown leather belt and a tan leather handbag — vintage-inspired pieces on a person of today, NOT a period costume",
   "A narrow old street with cobblestones, a weathered green wooden door and a stone doorway, potted plants. Warm late-afternoon light.",
   "Standing in the doorway, shoulder against the frame, one ankle crossed over the other, bag hanging from her hand.",
   "loose natural waves with a middle part, effortless retro"],

  ["color-protagonista", "av3", "color-protagonista-1",
   "a bright RED crewneck knit sweater with everything else neutral — high-waist khaki wide-leg trousers, a brown leather belt, brown loafers and a cream tote. ONE saturated color piece near the face against a fully neutral base",
   "A long plain white gallery wall outdoors with a strip of pavement, deliberately empty and colorless so the red is the only color in the frame. Even bright light.",
   "Walking across the frame in profile-three-quarter, tote over her shoulder, mid-step, looking straight ahead.",
   "long and straight with a middle part, sleek and simple so the color leads"],

  // Outfits REEMPLAZADOS con las referencias de docs_para_claude/estilos-nuevos.
  // Los dos fallaban por lo mismo: color plano sin textura. Tonos tierra eran dos
  // cafés lisos pegados; monocromático era negro mate sobre negro mate. En las
  // referencias el estilo NO lo hace el color — lo hace el contraste de MATERIAL
  // (satín contra lana, punto grueso contra gabardina) y el de valor (chocolate
  // contra crema). Eso es justo lo que no se puede describir con palabras, y por
  // eso aquí la foto manda.
  ["tonos-tierra", "av3", "tonos-tierra-1",
   "a chocolate-brown SATIN wrap blouse with billowy sleeves tucked into high-waist cream pleated wide-leg trousers, a woven straw shoulder bag and flat brown leather sandals. The look lives on CONTRAST: dark warm brown against pale cream, and shiny satin against matte linen — NEVER two flat browns together",
   "A sunlit stucco wall in warm ochre with a deep shadow falling across it, a stone step and a terracotta pot. Golden late-afternoon light.",
   "Standing three-quarter against the wall, one hand holding the bag strap, the other loose, chin slightly down, looking away from the camera.",
   "soft loose waves, natural and warm"],

  ["monocromatico", "av2", "monocromatico-1",
   "an all-black outfit built from DIFFERENT materials: a glossy black satin button-up shirt tucked into high-waist matte black fluid wide-leg trousers, a small black clutch and black pointed heels. Same colour head to toe, but satin against matte wool so the textures separate — NEVER flat black on flat black",
   "The terrace of a restaurant at blue hour: dark planters, a glimpse of set tables, warm interior light behind her against the cool evening.",
   "Standing in three-quarter with one hand in her trouser pocket, clutch under the other arm, shoulders squared, looking off to the side.",
   "a very sleek low bun with a clean center part"],

  // Los cuatro últimos outfits reemplazados (referencias de estilos-nuevos).
  // Todos fallaban por lo mismo: leían DISFRAZ o época equivocada — náutico era
  // uniforme de club de yates, romántico era dama de honor, hipster era señora
  // de 2014 y clásico era un abrigo cerrado que no dejaba ver el outfit.
  ["hipster", "hero", "hipster-1",
   "a boldly printed floral blouse with puff sleeves tucked into emerald-green high-waist wide-leg trousers, a wide brown leather belt with a big statement buckle, a purple leather shoulder bag and dark sunglasses — clashing colour and print worn on purpose, thrifted and personal",
   "A weathered wooden double door in an old stone facade, warm dusty light, a strip of cobbled street.",
   "Standing three-quarter with both hands in her trouser pockets, chin up, looking off to the side.",
   "a messy low bun with face-framing strands and a claw clip"],

  ["nautico", "b1", "nautico-1",
   "a classic navy-and-white BRETON striped long-sleeve top, slim cropped black trousers, black leather loafers and a small tan crossbody bag — modern Parisian, NOT a sailor costume: no anchors, no gold buttons, no captain hat",
   "A Haussmann-style street: pale stone facade, tall windows, a shopfront reflection. Cool bright daylight.",
   "Mid-step walking along the sidewalk, one hand in her pocket, looking slightly down and away.",
   "a soft short bob with a middle part, undone"],

  ["romantico", "av2", "romantico-1",
   "a cream chunky knit cardigan worn open over a white ribbed tank, high-waist wide-leg trousers in a soft ditsy FLORAL print, a large tan leather tote and brown flat sandals — the florals live in the trousers, not in a dress; sweet but modern and relaxed",
   "A tree-lined avenue in spring, dappled light through the leaves, blurred storefronts behind.",
   "Walking toward the camera, tote on one shoulder, one hand in her pocket, hair moving, looking aside.",
   "soft loose waves with a middle part"],

  ["clasico-elegante", "b1", "clasico-elegante-1",
   "a fitted black short-sleeve fine-knit top with a small silk scarf knotted at the neck, high-waist cream wide-leg tailored trousers, a slim brown leather belt and a structured tan leather handbag — a clean two-tone column, timeless and never fussy. NOT hidden under a coat",
   "A grand old plaza with a domed building blurred behind, pale stone, bright even daylight.",
   "Standing three-quarter, handbag held in one hand at her side, shoulders squared, looking past the camera.",
   "a low chignon, sleek and classic"],

  // La referencia traía etiquetas de precio flotantes; se borraron de la imagen
  // (quedaron rectángulos grises difuminados que el modelo debe ignorar) porque
  // la referencia visual pesa más que un "no text" en el prompt.
  ["coquette", "av1", "coquette-1",
   "a white square-neck fitted long-sleeve top with a large black velvet BOW at the shoulder, a short black pleated mini skirt, a small red leather shoulder bag with a bow detail, and black pointed ankle-strap flats — the bows are the whole point. Ignore any grey rectangles in the reference, they are not part of the outfit",
   "A pastel-pink building facade with a wrought-iron balcony and a small awning, soft flattering light, a strip of cobbled sidewalk.",
   "Mid-step walking along the sidewalk, bag against her hip, one hand loose, head turned slightly away.",
   "a half-up hairstyle tied with a black ribbon bow, soft and girly"],

  // Tres más con referencia curada (2026-07-31).
  //
  // gorpcore es el caso interesante: su outfit no estaba mal, LA ESCENA lo
  // traicionaba. Estaba puesta en un sendero rocoso con niebla, así que leía
  // "senderismo" — que es justo lo que el gorpcore NO es. El estilo es ropa
  // técnica usada en la CIUDAD; el fondo de concreto es la mitad del mensaje.
  ["coastal", "av1", "coastal-1",
   "a crisp WHITE ribbed tank tucked into high-waist white wide-leg linen trousers, a small silk scarf knotted at the neck, a woven raffia basket bag, gold jewellery, dark sunglasses and flat tan leather sandals — everything WHITE, never beige, with straw and gold as the only accents",
   "A sunlit old Mediterranean street: warm stone facades, cobblestones, a church column, deep shadow on one side. Strong midday sun.",
   "Mid-step walking down the cobbled street, basket bag on one arm, the other hand loose, looking ahead past the camera.",
   "loose beachy waves pushed back, air-dried"],

  ["gorpcore", "hero", "gorpcore-1",
   "an oversized sage-green heavyweight hoodie, very baggy beige technical cargo trousers with big pockets that pool over the shoes, and chunky white trail sneakers — technical outdoor pieces worn as CITY clothes",
   "A raw concrete underpass wall in the city, a strip of pavement, a blurred passer-by. Flat grey daylight. Urban, definitely NOT a forest or a mountain trail.",
   "Standing three-quarter against the concrete, both hands in the hoodie pocket, chin down, looking away.",
   "a messy low bun, sporty and undone"],

  ["coreano", "av2", "coreano-1",
   "a tonal head-to-toe CREAM outfit: an oversized long-line blazer worn open over a fitted cream knit tank, and very wide fluid cream trousers that break over the shoes, with a small brown shoulder bag and white sneakers — the long drapey line and the single soft tone are the style, NOT a blazer over black",
   "A quiet Seoul side street: minimal café storefronts with small signs, pale tiled pavement, a bicycle. Soft overcast light.",
   "Mid-step walking toward the camera, blazer moving with her, bag on one shoulder, gaze slightly aside.",
   "long sleek straight hair with a middle part, glossy"],

  ["glam-noche", "av3", "glam-noche-1",
   "a burnt-orange satin slip midi dress with a cowl neck, a cream oversized blazer worn open over it, strappy nude heeled sandals and a small bag — jewel-toned satin, never black",
   "Outside a restaurant at dusk: warm light spilling from the windows behind her, the blue of the evening street around. The satin catches the light.",
   "Stepping off the curb, blazer sliding off one shoulder, small bag in hand, head turned slightly away.",
   "soft glossy waves swept to one side"],

  // Segundo intento. El primero puso cargos sobre una base limpia (camisa blanca
  // + tank + tenis bajos) y salió "casual bonito con cargos", no utility. Las
  // referencias que mandó Roberto tienen tres cosas que ahí faltaban, y son las
  // que cargan el estilo: top CORTO con cintura alta abajo, VOLUMEN de paracaídas
  // en el pantalón (no un ancho normal), y calzado PESADO — nunca un tenis
  // minimalista limpio.
  ["utility", "hero", "utility-1",
   "very baggy cream parachute cargo trousers with huge bellows pockets and drawstring hems, worn high with a black belt, a cropped olive utility shirt knotted at the waist with sleeves pushed up showing a sliver of midriff, a small black shoulder bag with hardware, dark sunglasses and CHUNKY high-top sneakers. The volume of the trousers and the cropped top are the whole point — NOT a clean minimal outfit, NOT low profile sneakers",
   "The hard edge of a dark modern building: vertical metal cladding, a strip of pale pavement, strong side light and a crisp shadow.",
   "Standing three-quarter with her weight on one leg, one hand in a cargo pocket, bag hanging from the other, chin up, looking away past the camera.",
   "a high messy bun with loose strands, undone"],

  ["de-salir", "av2", "de-salir-4",
   "a sheer black lace long-sleeve top over a black bandeau, high-waist black wide-leg trousers with a statement belt, strappy black heeled sandals and a small beaded bag — body-conscious on top, fluid below",
   "A city street at night, out-of-focus headlights and shop signs as bokeh behind her, wet pavement reflecting the lights.",
   "Standing three-quarter with one hip cocked, one hand at her waist, looking off past the camera.",
   "sleek straight hair tucked behind one ear, sharp"],
];

async function gen(id, avatar, ref, outfit, escena, pose, pelo) {
  const file = `${id}-mujer.png`;
  const text =
    `Full-body candid street-style fashion photograph of the SAME woman shown in the FIRST reference image. ` +
    `${identidad(pelo)} She is now wearing the outfit shown in the SECOND reference image: ${outfit}. ` +
    `Copy the outfit's garments, proportions, colors and shoes from the second reference. ` +
    `POSE: ${pose} ${FRAMING} ${EXPRESSION} ` +
    `SCENE: ${escena} ${BASE_ESCENA} ${SIN_MARCAS} ` +
    `Photorealistic, high quality, sharp. No watermark.`;

  const parts = [
    { text },
    { inlineData: { mimeType: "image/png", data: b64(AV(avatar)) } },
    { inlineData: { mimeType: "image/jpeg", data: b64(REF(ref)) } },
  ];
  // Reintento con espera creciente. Sin esto, un ETIMEDOUT de la red mataba el
  // proceso ENTERO a media corrida y las cartas siguientes se quedaban con la
  // versión vieja — pasó en la primera pasada, murió en la cuarta de diez y
  // quedó un deck mitad nuevo mitad viejo sin que nada lo dijera.
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
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img) throw new Error("respuesta sin imagen");
      // Las cartas women-only NO llevan sufijo de género en el archivo: las lee
      // looksForGender como /looks/<id>.png. Sin esto se escribe un
      // "<id>-mujer.png" que nadie lee y la carta se queda igual EN SILENCIO —
      // ya mordió dos veces (coquette y de-salir). La fuente de verdad es el
      // campo `segment` de lib/looks.ts; lo cuida el test looks-imagenes.
      const out = SOLO_MUJER.has(id) ? `${id}.png` : file;
      writeFileSync(`public/looks/${out}`, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK → ${out}  (${avatar} + ${ref})`);
      return;
    } catch (e) {
      const ultimo = intento === 3;
      console.error(`${ultimo ? "FALLÓ" : "reintento"} ${file} (${intento}/3): ${e.message}`);
      if (ultimo) return; // no tumba las cartas que faltan
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

for (const [id, av, ref, outfit, escena, pose, pelo] of CARTAS) {
  if (ONLY && !ONLY.includes(id)) continue;
  await gen(id, av, ref, outfit, escena, pose, pelo);
}
