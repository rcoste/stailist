// Las fotos de destino de la card de viaje del home (handoff design_handoff_inicio).
//
// POR QUÉ SON GENÉRICAS Y NO DEL VIAJE REAL: `trips` no guarda ninguna foto, y
// pedirle una a la persona sería fricción por decoración. Estas son un set fijo
// que se elige por nombre del lugar (con alias) y, si no hay match, por las
// ocasiones que ya marcó (playa vs ciudad) — cero adivinanza, cero IA en vivo.
//
// LA FÓRMULA VISUAL, congelada (misma disciplina que gen-looks-genz.mjs):
// BLANCO Y NEGRO de alto contraste, luz fría de cielo abierto, cero dorado y
// cero sepia. Tres razones, y la tercera es la fuerte:
//  1. En esta app el color tiene UN trabajo — que reconozcas tu ropa. La card
//     de al lado es la tira de prendas del último look; un destino a color le
//     roba justo ese protagonismo.
//  2. "Playa a color" es literalmente turquesa + arena dorada + atardecer
//     ámbar, que es el default de IA y cae directo en el veto de Roberto.
//  3. Son fotos que NO son tuyas. A color y fotorrealistas se leen como stock
//     de agencia de viajes; en B&N editorial se leen como marca — no fingen
//     ser tu Cancún.
//
// Salida: public/destinos/<slug>.webp (4:3, el recorte que menos pierde en la
// card ~118px). Uso: node scripts/gen-destinos.mjs [--only=playa,nueva-york]
//
// WebP a 900px y NO el PNG crudo de Gemini: el PNG pesa ~700 KB y el set entero
// serían ~14 MB en un repo público, para una foto que se ve a 118 px. En webp
// son ~40 KB cada una sin diferencia visible al tamaño al que existen.
// `sharp` NO está en package.json: llega como dependencia transitiva de Next
// (que la usa para optimizar imágenes). Alcanza para este script, que corre a
// mano y una sola vez por destino — pero si algún día Next deja de traerla,
// esto falla con ERR_MODULE_NOT_FOUND y se resuelve con `npm i -D sharp`.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const key = readFileSync(".env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const skip = process.argv.includes("--skip-existing");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg
  ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : null;

// ── La fórmula congelada ────────────────────────────────────────────────────
// Cada pieza está por una razón, no por adorno:
const MONO =
  "Pure neutral BLACK AND WHITE monochrome — absolutely no color, NO sepia, NO warm toning, NO split toning, NO blue tint.";
// Heredado de gen-looks-genz: la luz fría es la firma del rebrand v3.
const LUZ =
  "Cool neutral daylight from an open overcast sky or high open shade. NO golden hour, NO sunrise, NO sunset, NO warm light, NO lens flare.";
const GRANO =
  "High contrast with deep true blacks and clean bright whites, fine 35mm film grain, crisp and sharp, editorial magazine quality.";
// Aire y formas: la card la enseña a ~140px, donde el detalle no se lee y la
// silueta sí. Sin esto Gemini devuelve postal saturada de detalle.
//
// "Dominante" es la corrección de la primera tirada: con sólo pedir aire, el
// Ángel de la Independencia salió como una aguja diminuta en 70% de cielo —
// precioso a tamaño completo e ilegible a 140px, que es el único tamaño al que
// esta foto se va a ver de verdad. El aire se queda; el sujeto manda.
const COMPOSICION =
  "Calm minimal composition: the main subject is LARGE and dominant, filling most of the frame, with clean negative space around it — never a tiny distant subject lost in an empty sky. Strong graphic shapes reading as bold silhouettes. Quiet, architectural, unhurried.";
// Sin gente: una cara reconocible en una imagen de marca envejece mal y mete
// una historia que no es la de quien mira.
// El marco blanco salió UNA vez (el Ángel, segunda tirada) y en la card se
// vería como un filo sucio, así que se prohíbe explícito y con sinónimos: pedir
// "no borders" a secas no bastó.
const LIMPIO =
  "No people in the foreground, no faces, no posing tourists (tiny distant anonymous silhouettes are acceptable). No text, no letters, no signage, no logos, no watermarks. The photograph bleeds edge to edge and fills the entire canvas: NO white border, NO frame, NO matte, NO passe-partout, NO polaroid edge, no collage.";

const prompt = (sujeto) =>
  `Fine-art black and white travel photograph of ${sujeto}. ${MONO} ${LUZ} ${GRANO} ${COMPOSICION} ${LIMPIO}`;

// ── Los destinos ────────────────────────────────────────────────────────────
// Criterio de la lista: a dónde viaja de verdad una usuaria mexicana. Los
// destinos de playa (Cancún, Tulum, Los Cabos, Vallarta…) NO llevan imagen
// propia — visualmente son la misma foto, así que van por alias a `playa`.
const DESTINOS = [
  // Genéricos: el fallback que siempre funciona (por `trips.ocasiones`).
  ["playa", "a wide empty tropical beach seen from the sand, a few tall palm trees leaning over the shoreline on one side, calm ocean and a long clean horizon line, gentle waves"],
  ["ciudad", "a generic modern city skyline of tall towers seen across water or a wide avenue, clean geometric architecture, open sky above"],

  // México
  ["cdmx", "the Angel of Independence victory column monument in Mexico City, photographed from below at a three-quarter angle against a wide open sky"],
  // Las agujas solas dejaban la foto medio vacía: se pide la fachada entera.
  ["guadalajara", "the full front stone facade of the Guadalajara Cathedral in Mexico seen from the plaza, its two tall pointed neo-gothic spires rising from it, the building filling most of the frame"],
  ["monterrey", "the distinctive saddle-shaped Cerro de la Silla mountain of Monterrey Mexico rising behind a foreground of clean modern city buildings"],
  ["oaxaca", "the ornate baroque stone facade and bell towers of the Santo Domingo church in Oaxaca Mexico, seen straight on from the plaza"],
  ["san-miguel", "the tall pink neo-gothic spires of the Parroquia de San Miguel Arcangel church in San Miguel de Allende Mexico rising above colonial rooftops"],

  // Internacional
  ["nueva-york", "the Manhattan skyline of New York City, dense vertical skyscrapers seen across the water, the Empire State Building rising among them"],
  ["los-angeles", "a row of very tall thin palm trees along a wide Los Angeles boulevard against an open sky, low hills in the far distance"],
  // El Strip a lo ancho salía como una carretera cualquiera. La pirámide del
  // Luxor es inconfundible y no depende de letreros (que están prohibidos).
  ["las-vegas", "the huge black glass pyramid of the Luxor hotel in Las Vegas seen from the boulevard, tall palm trees in front of it, desert mountains far behind"],
  ["miami", "a row of Art Deco buildings along Miami Beach with palm trees in front, clean geometric 1930s facades"],
  ["madrid", "the Metropolis building with its domed crown and winged statue at the corner of Gran Via in Madrid Spain, seen from the street below"],
  ["barcelona", "the tall organic stone spires of the Sagrada Familia basilica in Barcelona rising against an open sky"],
  // "A lo lejos" dejaba la torre chiquita sobre un primer plano negro que se
  // comía la foto. De cerca y desde abajo: la celosía ES la imagen.
  ["paris", "the Eiffel Tower in Paris seen from close below at a three-quarter angle, its intricate iron lattice structure filling the frame, open bright sky behind it"],
  ["londres", "Tower Bridge in London seen across the River Thames, its two gothic towers and suspended walkways in full silhouette"],
  ["roma", "the Colosseum in Rome seen from outside at a three-quarter angle, its tiers of stone arches against an open sky"],
  ["amsterdam", "a quiet canal in Amsterdam lined with narrow tall gabled houses, an arched bridge crossing in the middle distance"],
  ["tokio", "dense vertical Tokyo cityscape, stacked modern buildings and Tokyo Tower's lattice silhouette rising behind them"],
  ["buenos-aires", "the Obelisco monument of Buenos Aires standing at the center of the wide Avenida 9 de Julio, tall buildings flanking it"],
];

mkdirSync("public/destinos", { recursive: true });

async function gen(slug, sujeto) {
  const path = `public/destinos/${slug}.webp`;
  if (skip && existsSync(path)) return console.log(`skip ${slug}`);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(sujeto) }] }],
        // 4:3: la card la recorta a ~140×118 con object-cover, así que este es
        // el ratio que menos composición tira.
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "4:3" },
        },
      }),
    }
  );
  if (!res.ok) {
    return console.error(`ERROR ${slug}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
  const data = await res.json();
  const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!img) return console.error(`SIN IMAGEN ${slug}`);
  const { size } = await sharp(Buffer.from(img.inlineData.data, "base64"))
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path);
  console.log(`OK → ${slug} (${Math.round(size / 1024)} KB)`);
}

for (const [slug, sujeto] of DESTINOS) {
  if (!ONLY || ONLY.includes(slug)) await gen(slug, sujeto);
}
console.log("LISTO");
