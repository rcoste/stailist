// Genera las imágenes de los 15 arquetipos del clóset (lista HOMBRE) en el
// estilo A elegido por Roberto: flat-lay editorial, fondo papel hueso F5F3F0.
// Salida: public/archetypes/<slug>.png. Secuencial para no chocar con el
// rate limit de Gemini. Reusa el mismo wrapper que scripts/gen-image.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";

// type: "flat" (ropa extendida vista desde arriba) | "shoes" (par, ángulo leve)
const ITEMS = [
  { slug: "camiseta-blanca", desc: "a plain white crew-neck cotton t-shirt", type: "flat" },
  { slug: "camiseta-negra", desc: "a plain black crew-neck cotton t-shirt", type: "flat" },
  { slug: "camisa-blanca", desc: "a crisp white button-up dress shirt", type: "flat" },
  { slug: "camisa-azul-claro", desc: "a light blue button-up dress shirt", type: "flat" },
  { slug: "polo-marino", desc: "a navy blue short-sleeve polo shirt", type: "flat" },
  { slug: "sueter-gris", desc: "a grey crew-neck knit sweater", type: "flat" },
  { slug: "hoodie-gris", desc: "a heather grey pullover hoodie with a hood", type: "flat" },
  { slug: "blazer-azul-marino", desc: "a navy blue tailored blazer jacket", type: "flat" },
  { slug: "chamarra-mezclilla", desc: "a classic medium-wash blue denim jacket", type: "flat" },
  { slug: "jeans-azul-oscuro", desc: "a pair of dark indigo blue jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-negro", desc: "a pair of black dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "chinos-beige", desc: "a pair of beige chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "tenis-blancos", desc: "a pair of clean white leather sneakers", type: "shoes" },
  { slug: "zapato-formal-cafe", desc: "a pair of brown leather formal derby shoes", type: "shoes" },
  { slug: "botas-negras", desc: "a pair of black leather ankle boots", type: "shoes" },
  // Ampliación clóset hombre (2026-06-13)
  { slug: "camiseta-gris", desc: "a plain heather grey crew-neck cotton t-shirt", type: "flat" },
  { slug: "camisa-lino", desc: "a light beige linen button-up shirt, relaxed fit", type: "flat" },
  { slug: "camisa-mezclilla", desc: "a light blue chambray button-up shirt", type: "flat" },
  { slug: "short-caqui", desc: "a pair of khaki chino shorts, neatly laid flat", type: "flat" },
  { slug: "jeans-negros", desc: "a pair of black jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "chinos-marino", desc: "a pair of navy blue chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "mocasines-cafe", desc: "a pair of brown leather penny loafer shoes", type: "shoes" },
  { slug: "sandalias-cuero", desc: "a pair of brown leather slide sandals", type: "shoes" },
  { slug: "bomber", desc: "a classic black bomber jacket (MA-1 style)", type: "flat" },
  // Lista mujer + zapato negro (2026-06-13)
  { slug: "cardigan-crema", desc: "a cream knit open-front cardigan", type: "flat" },
  { slug: "abrigo-camel", desc: "a camel wool long overcoat", type: "flat" },
  { slug: "falda-midi-negra", desc: "a black midi A-line skirt", type: "flat" },
  { slug: "vestido-negro", desc: "a little black sleeveless dress", type: "flat" },
  { slug: "flats-nude", desc: "a pair of nude ballet flat shoes", type: "shoes" },
  { slug: "zapato-formal-negro", desc: "a pair of black leather oxford dress shoes", type: "shoes" },
  // Ampliación clóset hombre — perfil minimalista refinado (2026-06-14)
  // Uniqlo + Massimo Dutti + Meermin + Lululemon + Hugo Boss.
  { slug: "camisa-negra", desc: "a black button-up dress shirt", type: "flat" },
  { slug: "sueter-cuello-alto", desc: "a charcoal grey fine-knit turtleneck sweater", type: "flat" },
  { slug: "sueter-marino", desc: "a navy blue crew-neck knit sweater", type: "flat" },
  { slug: "cardigan-marino", desc: "a navy blue button-up knit cardigan", type: "flat" },
  { slug: "polo-punto-oliva", desc: "an olive green knit short-sleeve polo shirt", type: "flat" },
  { slug: "camiseta-manga-larga", desc: "a plain white long-sleeve cotton t-shirt", type: "flat" },
  { slug: "sudadera-crema", desc: "a cream ecru crew-neck sweatshirt, no hood", type: "flat" },
  { slug: "pantalon-vestir-gris", desc: "a pair of grey wool dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "chinos-oliva", desc: "a pair of olive green chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-claros", desc: "a pair of light wash blue jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-tecnico", desc: "a pair of charcoal grey slim technical commuter trousers, tapered, neatly laid flat lengthwise", type: "flat" },
  { slug: "overshirt-oliva", desc: "an olive green overshirt shacket (shirt-jacket), neatly laid flat", type: "flat" },
  { slug: "abrigo-lana-marino", desc: "a navy blue structured wool long overcoat", type: "flat" },
  { slug: "gabardina-beige", desc: "a beige trench coat, neatly laid flat", type: "flat" },
  { slug: "parka-negra", desc: "a black quilted puffer jacket", type: "flat" },
  { slug: "chaqueta-campo", desc: "an olive green military field jacket (M-65 style)", type: "flat" },
  { slug: "botines-chelsea", desc: "a pair of brown leather Chelsea boots", type: "shoes" },
  { slug: "botines-ante", desc: "a pair of tan suede chukka desert boots", type: "shoes" },
  { slug: "mocasines-negro", desc: "a pair of black leather penny loafers", type: "shoes" },
  { slug: "mocasines-burdeos", desc: "a pair of oxblood burgundy leather penny loafers", type: "shoes" },
  // Ampliación clóset mujer — capsule wardrobe + clima de México (2026-06-15)
  { slug: "blusa-blanca", desc: "a white silk satin women's blouse, elegant drape, neatly laid flat", type: "flat" },
  { slug: "blusa-lino", desc: "a natural beige linen women's blouse, relaxed fit, neatly laid flat", type: "flat" },
  { slug: "top-tirantes", desc: "a white ribbed women's tank top camisole, neatly laid flat", type: "flat" },
  { slug: "sueter-cuello-alto-mujer", desc: "a cream fine-knit women's turtleneck sweater, neatly laid flat", type: "flat" },
  { slug: "camiseta-rayas", desc: "a navy and white striped Breton long-sleeve t-shirt, women's cut, neatly laid flat", type: "flat" },
  { slug: "pantalon-vestir-camel", desc: "a pair of camel beige women's tailored dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-wide-leg", desc: "a pair of cream high-waisted wide-leg women's trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-claros-mujer", desc: "a pair of light wash high-waisted women's straight jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "falda-midi-camel", desc: "a camel beige midi A-line skirt, neatly laid flat", type: "flat" },
  { slug: "vestido-camisero", desc: "a chambray denim women's shirt dress, knee length, neatly laid flat", type: "flat" },
  { slug: "vestido-floral", desc: "a floral print women's midi summer dress, soft pink and green tones, neatly laid flat", type: "flat" },
  { slug: "vestido-midi-burdeos", desc: "a burgundy fitted women's midi dress, elegant, neatly laid flat", type: "flat" },
  { slug: "tacon-nude", desc: "a pair of nude pointed-toe high-heel pumps", type: "shoes" },
  { slug: "sandalias-tiras", desc: "a pair of tan leather strappy flat sandals", type: "shoes" },
  { slug: "botines-mujer", desc: "a pair of black leather women's ankle boots with a block heel", type: "shoes" },
  { slug: "mocasines-mujer", desc: "a pair of brown leather women's loafers", type: "shoes" },
  { slug: "gabardina-mujer", desc: "a beige women's belted trench coat, neatly laid flat", type: "flat" },
  { slug: "chaqueta-piel", desc: "a black leather women's biker jacket, neatly laid flat", type: "flat" },
  // Versiones femeninas de las prendas que tienen corte de género distinto
  // (2026-06-15). NO son unisex: cada una es una prenda de mujer propia en el
  // catálogo (segment 'mujer', slug <slug>-mujer) — ver migración 0019. Las
  // playeras/jeans/tenis lisos sí son unisex de verdad y comparten una imagen.
  { slug: "camisa-blanca-mujer", desc: "a crisp white women's button-up shirt, tailored slim fit", type: "flat" },
  { slug: "camisa-mezclilla-mujer", desc: "a light blue women's chambray button-up shirt, relaxed feminine fit", type: "flat" },
  { slug: "blazer-azul-marino-mujer", desc: "a navy blue women's tailored blazer, fitted waist", type: "flat" },
  { slug: "sueter-gris-mujer", desc: "a grey women's crew-neck knit sweater, fitted", type: "flat" },
  { slug: "chamarra-mezclilla-mujer", desc: "a classic medium-wash women's denim jacket, cropped fitted cut", type: "flat" },
  { slug: "botas-negras-mujer", desc: "a pair of black leather women's ankle boots, sleek", type: "shoes" },
  // Ampliación biblioteca — lista de Roberto (2026-06-15). Tees de color unisex,
  // prendas y accesorios de hombre. Nombres genéricos (sin marca).
  { slug: "camiseta-marino", desc: "a plain navy blue crew-neck cotton t-shirt", type: "flat" },
  { slug: "camiseta-olivo", desc: "a plain olive green crew-neck cotton t-shirt", type: "flat" },
  { slug: "camiseta-arena", desc: "a plain sand beige crew-neck cotton t-shirt", type: "flat" },
  { slug: "camiseta-vino", desc: "a plain burgundy wine crew-neck cotton t-shirt", type: "flat" },
  { slug: "chamarra-piel-negra", desc: "a black leather men's jacket, classic moto biker style, neatly laid flat", type: "flat" },
  { slug: "chamarra-piel-cafe", desc: "a brown leather men's jacket, classic style, neatly laid flat", type: "flat" },
  { slug: "sueter-cuello-v-marino", desc: "a navy blue men's v-neck fine merino knit sweater, neatly laid flat", type: "flat" },
  { slug: "sueter-merino-camel", desc: "a camel beige men's crew-neck merino knit sweater, neatly laid flat", type: "flat" },
  { slug: "chamarra-ultraligera", desc: "a black lightweight packable down puffer jacket, slim, neatly laid flat", type: "flat" },
  { slug: "pantalon-vestir-marino", desc: "a pair of navy blue men's wool dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "abrigo-charcoal", desc: "a charcoal grey structured wool long overcoat, men's, neatly laid flat", type: "flat" },
  { slug: "botines-chelsea-negros", desc: "a pair of black leather Chelsea boots", type: "shoes" },
  { slug: "tenis-blancos-urbanos", desc: "a pair of white chunky leather street sneakers, basketball style", type: "shoes" },
  { slug: "tenis-deportivos", desc: "a pair of modern running sneakers with a chunky cushioned sole, light grey and white", type: "shoes" },
  { slug: "cinturon-cafe", desc: "a brown leather belt with a simple metal buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "cinturon-negro", desc: "a black leather belt with a simple metal buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "gorra-negra", desc: "a plain black baseball cap, structured front", type: "accesorio" },
  { slug: "gorra-marino", desc: "a plain navy blue baseball cap, structured front", type: "accesorio" },
  { slug: "lentes-wayfarer", desc: "a pair of black wayfarer style sunglasses, folded", type: "accesorio" },
  { slug: "lentes-aviador", desc: "a pair of classic aviator sunglasses with thin gold metal frame, folded", type: "accesorio" },
];

function buildPrompt({ desc, type }) {
  if (type === "shoes") {
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. No people, no props, no text, no labels.`;
  }
  if (type === "accesorio") {
    return `Professional e-commerce product photograph of ${desc}, shot from directly above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The item fills about 55% of the frame, centered. No people, no props, no text, no labels.`;
  }
  return `Professional e-commerce flat lay photograph of ${desc}, neatly laid flat and slightly styled, shot directly from above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The garment fills about 70% of the frame, centered. No people, no props, no text, no labels.`;
}

mkdirSync("public/archetypes", { recursive: true });

// Permite reanudar: si --skip-existing, no regenera lo ya hecho.
const skipExisting = process.argv.includes("--skip-existing");

for (const item of ITEMS) {
  const out = `public/archetypes/${item.slug}.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${item.slug} (ya existe)`);
    continue;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(item) }] }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1" },
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${item.slug}: ${res.status} ${(await res.text()).slice(0, 150)}`);
    continue;
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`SIN IMAGEN ${item.slug}`);
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  console.log(`OK → ${out}`);
}
console.log("LISTO: generación de arquetipos terminada");
