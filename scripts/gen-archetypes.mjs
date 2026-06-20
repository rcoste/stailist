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
  { slug: "botines-chelsea", desc: "a pair of dark brown smooth calf leather Chelsea boots, sleek almond toe, brown elastic side gore panel, slim leather sole, elegant dress boots", type: "boots" },
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
  { slug: "botines-chelsea-negros", desc: "a pair of black smooth calf leather Chelsea boots, sleek almond toe, black elastic side gore panel, slim leather sole, elegant dress boots", type: "boots" },
  { slug: "tenis-blancos-urbanos", desc: "a pair of all-white leather low-top basketball sneakers, thick chunky white rubber sole, perforated toe box, clean iconic silhouette, no logos", type: "shoes" },
  { slug: "tenis-deportivos", desc: "a pair of grey athletic running sneakers, knit mesh upper, distinctive sculpted sole made of hollow cushioning pods, white sole, performance style, no logos", type: "shoes" },
  { slug: "cinturon-cafe", desc: "a brown leather belt with a simple metal buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "cinturon-negro", desc: "a black leather belt with a simple metal buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "gorra-negra", desc: "a plain black baseball cap, structured front", type: "accesorio" },
  { slug: "gorra-marino", desc: "a plain navy blue baseball cap, structured front", type: "accesorio" },
  { slug: "lentes-wayfarer", desc: "a pair of black wayfarer style sunglasses, folded", type: "accesorio" },
  { slug: "lentes-aviador", desc: "a pair of classic aviator sunglasses with thin gold metal frame, folded", type: "accesorio" },
  // Ajuste tenis a estilos reales de referencia + chamarra negra clásica (2026-06-15).
  { slug: "tenis-piel-negros", desc: "a pair of black smooth leather minimalist low-top sneakers with a cream off-white rubber sole, clean simple design, no logos", type: "shoes" },
  { slug: "tenis-retro-blanco", desc: "a pair of white leather retro low-top sneakers with a navy blue side panel detail and a beige cream sole, vintage tennis style, no logos", type: "shoes" },
  { slug: "chamarra-piel-negra-clasica", desc: "a black leather men's jacket, classic simple style, soft supple leather, not a heavy moto or biker jacket, neatly laid flat", type: "flat" },
  // Chelsea boots estilo Meermin (2026-06-15): regenera negro/café feos +
  // agrega café gamuza. Encuadre 3/4 de frente, punta de almendra, elegantes.
  { slug: "botines-chelsea-ante", desc: "a pair of dark brown suede Chelsea boots, sleek almond toe, brown elastic side gore panel, slim leather sole, elegant dress boots", type: "boots" },
  // === Biblioteca MUJER curada (2026-06-15) — ~50 piezas visualmente distintas.
  // Abrigos / outerwear
  { slug: "abrigo-largo-lana-gris", desc: "a long grey wool women's overcoat, straight clean cut, neatly laid flat", type: "flat" },
  { slug: "abrigo-cruzado-negro", desc: "a black double-breasted women's wool coat, neatly laid flat", type: "flat" },
  { slug: "trench-corto-beige", desc: "a short beige women's trench coat, belted, neatly laid flat", type: "flat" },
  { slug: "blazer-oversize-negro", desc: "a black oversized women's blazer, relaxed boyfriend fit, neatly laid flat", type: "flat" },
  { slug: "blazer-cropped-crema", desc: "a cream cropped women's blazer, short fitted, neatly laid flat", type: "flat" },
  { slug: "chaqueta-utility-olivo", desc: "an olive green women's utility field jacket with flap pockets, neatly laid flat", type: "flat" },
  { slug: "harrington-marino", desc: "a navy blue women's harrington jacket, elastic hem blouson with ribbed collar, neatly laid flat", type: "flat" },
  { slug: "cardigan-largo-gris", desc: "a long grey women's duster cardigan, open front, neatly laid flat", type: "flat" },
  { slug: "chaleco-tejido-crema", desc: "a cream knit women's sweater vest, sleeveless v-neck, neatly laid flat", type: "flat" },
  // Tops
  { slug: "camisa-oxford-azul", desc: "a light blue women's oxford button-up shirt, neatly laid flat", type: "flat" },
  { slug: "camisa-satinada-marfil", desc: "an ivory satin women's blouse shirt, soft sheen, neatly laid flat", type: "flat" },
  { slug: "blusa-cuello-v-negra", desc: "a black women's v-neck blouse, soft draped, neatly laid flat", type: "flat" },
  { slug: "blusa-lazo-blanca", desc: "a white women's pussy-bow blouse with a tie neck bow, neatly laid flat", type: "flat" },
  { slug: "blusa-wrap-estampado", desc: "a floral print women's wrap blouse, surplice neckline, neatly laid flat", type: "flat" },
  { slug: "playera-cuello-v-blanca", desc: "a plain white fitted women's v-neck t-shirt, neatly laid flat", type: "flat" },
  { slug: "playera-manga-larga-negra", desc: "a plain black long-sleeve fitted women's t-shirt, neatly laid flat", type: "flat" },
  { slug: "sueter-crewneck-verde", desc: "a bottle green women's crew-neck knit sweater, neatly laid flat", type: "flat" },
  { slug: "sueter-cuello-v-camel", desc: "a camel beige women's v-neck knit sweater, neatly laid flat", type: "flat" },
  { slug: "top-satinado-champagne", desc: "a champagne satin women's camisole tank top with thin straps, neatly laid flat", type: "flat" },
  { slug: "top-halter-negro", desc: "a black women's halter neck top, neatly laid flat", type: "flat" },
  { slug: "top-corset-negro", desc: "a black women's structured corset bustier top, neatly laid flat", type: "flat" },
  // Bottoms
  { slug: "pantalon-sastre-recto-negro", desc: "a pair of black women's straight-leg tailored trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-plisado-gris", desc: "a pair of grey women's pleated wide trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-skinny-mujer", desc: "a pair of dark indigo women's skinny jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-wide-mujer", desc: "a pair of medium wash women's wide-leg jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-mom-mujer", desc: "a pair of light wash women's high-waisted mom jeans, relaxed, neatly laid flat lengthwise", type: "flat" },
  { slug: "jeans-flare-mujer", desc: "a pair of dark wash women's flare bootcut jeans, neatly laid flat lengthwise", type: "flat" },
  { slug: "chino-beige-mujer", desc: "a pair of beige women's chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "cargo-verde-mujer", desc: "a pair of olive green women's cargo trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "shorts-mezclilla-mujer", desc: "a pair of blue denim women's shorts, neatly laid flat", type: "flat" },
  { slug: "shorts-lino-mujer", desc: "a pair of beige linen women's shorts, neatly laid flat", type: "flat" },
  // Faldas
  { slug: "falda-mini-negra", desc: "a black women's A-line mini skirt, neatly laid flat", type: "flat" },
  { slug: "falda-slip-champagne", desc: "a champagne satin bias-cut slip midi skirt, neatly laid flat", type: "flat" },
  { slug: "falda-plisada-marino", desc: "a navy blue pleated midi skirt, neatly laid flat", type: "flat" },
  { slug: "falda-larga-columna-negra", desc: "a black long straight column maxi skirt, neatly laid flat", type: "flat" },
  { slug: "falda-mezclilla-mujer", desc: "a blue denim women's A-line skirt, neatly laid flat", type: "flat" },
  // Vestidos
  { slug: "vestido-punto-camel", desc: "a camel knit women's sweater dress, neatly laid flat", type: "flat" },
  { slug: "vestido-tshirt-gris", desc: "a grey jersey casual t-shirt dress, neatly laid flat", type: "flat" },
  { slug: "vestido-slip-champagne", desc: "a champagne satin bias-cut slip dress, neatly laid flat", type: "flat" },
  { slug: "vestido-wrap-negro", desc: "a black women's wrap dress, surplice neckline, neatly laid flat", type: "flat" },
  { slug: "vestido-cocktail-negro", desc: "a black women's elegant fitted cocktail dress, neatly laid flat", type: "flat" },
  { slug: "vestido-noche-marino", desc: "a navy blue long elegant evening gown, neatly laid flat", type: "flat" },
  // Calzado
  { slug: "tenis-minimalistas-negros-mujer", desc: "a pair of black minimalist leather women's low-top sneakers, clean, no logos", type: "shoes" },
  { slug: "tenis-retro-mujer", desc: "a pair of off-white leather retro sneakers in the German Army Trainer style, plain smooth sides with small perforated dots, beige suede toe cap and heel, gum rubber sole, clean minimalist, completely unbranded plain sides", type: "shoes" },
  { slug: "slingbacks-negros", desc: "a pair of black women's slingback pointed-toe low heels", type: "shoes" },
  { slug: "kitten-heels-nude", desc: "a pair of nude women's kitten heel pumps, low heel", type: "shoes" },
  { slug: "botines-punta-afilada", desc: "a pair of black women's pointed-toe ankle boots with a stiletto heel", type: "boots" },
  { slug: "botas-rodilla-negras", desc: "a pair of black women's sleek knee-high boots, low heel", type: "boots" },
  { slug: "botas-ecuestres-cafe", desc: "a pair of brown women's flat equestrian knee-high riding boots", type: "boots" },
  { slug: "mules-camel", desc: "a pair of camel women's backless mules, low heel", type: "shoes" },
  // === Ampliación biblioteca v2 (2026-06-19) — accesorios de mujer (de cero),
  // accesorios de hombre, y staples. Ver migración 0036. ===
  // Mujer — accesorios
  { slug: "bolso-tote-camel", desc: "a camel tan leather women's tote bag with two top handles, laid flat from directly above", type: "accesorio" },
  { slug: "bolso-crossbody-negro", desc: "a small black leather women's crossbody bag with a long thin shoulder strap, laid flat from directly above", type: "accesorio" },
  { slug: "clutch-negro", desc: "a black satin women's rectangular evening clutch bag, laid flat from directly above", type: "accesorio" },
  { slug: "cinturon-negro-mujer", desc: "a slim black leather women's belt with a small delicate gold buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "mascada-seda", desc: "a folded silk women's scarf with a subtle neutral beige and ivory geometric print", type: "accesorio" },
  { slug: "lentes-carey-mujer", desc: "a pair of women's oversized sunglasses with a tortoiseshell brown acetate frame, folded", type: "accesorio" },
  { slug: "reloj-dorado-mujer", desc: "a women's elegant wristwatch with a slim gold case and a thin gold mesh band, laid flat from above; the watch dial is plain white and completely blank with no brand name, no logo, no text and no writing of any kind, only thin minimalist hour markers", type: "accesorio" },
  { slug: "arracadas-oro", desc: "a pair of small simple gold hoop earrings, laid flat side by side from above", type: "accesorio" },
  // Hombre — accesorios
  { slug: "reloj-plateado-hombre", desc: "a men's classic wristwatch with a silver stainless steel case and a silver link bracelet band, laid flat from above; the watch dial is plain white and completely blank with no brand name, no logo, no text and no writing of any kind, only thin minimalist hour markers", type: "accesorio" },
  { slug: "reloj-piel-cafe-hombre", desc: "a men's classic round wristwatch with a brown leather strap, laid flat from above; the watch dial is plain white and completely blank with no brand name, no logo, no text and no writing of any kind, only thin minimalist hour markers", type: "accesorio" },
  { slug: "bufanda-lana-gris", desc: "a folded grey wool men's scarf, neatly arranged from above", type: "accesorio" },
  { slug: "corbata-punto-marino", desc: "a navy blue knit men's necktie with a flat square bottom, laid straight vertically", type: "accesorio" },
  { slug: "beanie-gris", desc: "a grey ribbed knit men's beanie hat, laid flat from above", type: "accesorio" },
  { slug: "portafolio-piel-cafe", desc: "a brown leather men's slim briefcase document bag, laid flat from directly above", type: "accesorio" },
  // Hombre — staples
  { slug: "cuello-tortuga-negro", desc: "a black men's fine merino wool turtleneck sweater", type: "flat" },
  { slug: "chino-chocolate", desc: "a pair of chocolate brown men's cotton chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "henley-negro", desc: "a black men's long-sleeve henley shirt with a three-button placket", type: "flat" },
  { slug: "camisa-cuadros", desc: "a men's checked flannel button-up shirt in a navy and forest green plaid pattern", type: "flat" },
  { slug: "chaleco-acolchado-marino", desc: "a navy blue men's quilted gilet body warmer vest, sleeveless, neatly laid flat", type: "flat" },
  // Mujer — staples
  { slug: "sueter-esmeralda", desc: "an emerald green women's fine-knit crew-neck sweater", type: "flat" },
  { slug: "tenis-blancos-mujer", desc: "a pair of clean white minimalist leather women's low-top sneakers, no logos", type: "shoes" },
  { slug: "bodysuit-negro", desc: "a black women's long-sleeve bodysuit top, fitted, neatly laid flat", type: "flat" },
  // === Ampliación biblioteca v3 (2026-06-19) — lista de Roberto, las que faltaban
  // (turtleneck/charcoal/cinturón/blazer/overshirt ya estaban). Ver migración 0037. ===
  { slug: "sueter-half-zip-marino", desc: "a navy blue men's half-zip pullover sweater, fine merino knit, with a short metal zipper at the stand collar", type: "flat" },
  { slug: "sueter-crewneck-verde-bosque", desc: "a forest green men's fine cashmere crew-neck knit sweater", type: "flat" },
  { slug: "chamarra-impermeable-ligera", desc: "a charcoal grey men's lightweight waterproof technical shell rain jacket with a hood and a full zipper, matte finish, no text, no logos, no brand", type: "flat" },
  { slug: "bufanda-lana-negra", desc: "a folded black wool men's scarf, neatly arranged from above", type: "accesorio" },
  { slug: "guantes-piel-negros", desc: "a pair of black leather men's gloves, laid flat side by side from above", type: "accesorio" },
  { slug: "camiseta-termica", desc: "a black men's thermal base layer long-sleeve top, slim fitted, fine smooth technical fabric, neatly laid flat, no text, no logos, no brand", type: "flat" },
  // === Ampliación biblioteca v4 (2026-06-19) — lista completa de Roberto, las
  // que faltaban (el resto ya estaba). Todas hombre. Ver migración 0038. ===
  { slug: "chinos-carbon", desc: "a pair of charcoal grey men's cotton chino trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-tecnico-marino", desc: "a pair of navy blue men's slim technical commuter trousers, tapered, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-lino-verano", desc: "a pair of light beige lightweight linen-cotton men's summer trousers, relaxed, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-vestir-carbon", desc: "a pair of charcoal grey men's wool dress trousers, neatly laid flat lengthwise", type: "flat" },
  { slug: "camiseta-carbon", desc: "a plain charcoal grey men's crew-neck cotton t-shirt", type: "flat" },
  { slug: "polo-blanco", desc: "a white men's short-sleeve pique cotton polo shirt", type: "flat" },
  { slug: "polo-gris", desc: "a grey men's short-sleeve pique cotton polo shirt", type: "flat" },
  { slug: "sueter-half-zip-gris", desc: "a grey men's half-zip pullover sweater, fine merino knit, with a short metal zipper at the stand collar", type: "flat" },
  { slug: "sueter-crewneck-carbon", desc: "a charcoal grey men's fine cashmere crew-neck knit sweater", type: "flat" },
  { slug: "camisa-oxford-blanca", desc: "a white men's oxford cloth button-down shirt, slightly textured casual weave, neatly laid flat", type: "flat" },
  { slug: "camisa-oxford-azul-hombre", desc: "a light blue men's oxford cloth button-down shirt, slightly textured casual weave, neatly laid flat", type: "flat" },
  { slug: "camisa-lino-blanca", desc: "a white linen-cotton men's button-up shirt, relaxed summer fit, neatly laid flat", type: "flat" },
  { slug: "camisa-lino-azul", desc: "a light blue linen-cotton men's button-up shirt, relaxed summer fit, neatly laid flat", type: "flat" },
  // === Ampliación biblioteca MUJER (2026-06-19) — huecos del catálogo. Ver
  // migración 0039. ===
  { slug: "cuello-tortuga-negro-mujer", desc: "a black women's fitted ribbed turtleneck top, sleek and modern", type: "flat" },
  { slug: "sueter-crewneck-marino-mujer", desc: "a navy blue women's modern relaxed crew-neck knit sweater", type: "flat" },
  { slug: "sueter-half-zip-gris-mujer", desc: "a grey women's modern half-zip pullover sweater, relaxed fit, short zipper at the collar", type: "flat" },
  { slug: "cardigan-corto-negro-mujer", desc: "a black women's cropped fitted knit button-up cardigan, modern", type: "flat" },
  { slug: "blazer-camel-mujer", desc: "a camel beige women's modern relaxed-tailored oversized blazer", type: "flat" },
  { slug: "abrigo-acolchado-largo-mujer", desc: "a black women's long sleek quilted puffer coat, modern and minimal", type: "flat" },
  { slug: "leggings-negros", desc: "a pair of black women's sleek modern high-waisted leggings, laid flat lengthwise", type: "flat" },
  { slug: "pantalon-cuero-negro-mujer", desc: "a pair of black leather women's modern straight-leg trousers, laid flat lengthwise", type: "flat" },
  { slug: "ballerinas-negras", desc: "a pair of black women's modern ballet flats with a soft square toe", type: "shoes" },
  { slug: "vestido-blanco-verano", desc: "a white women's modern summer mini dress, effortless and breezy, clean minimal lines", type: "flat" },
  { slug: "reloj-plateado-mujer", desc: "a women's elegant wristwatch with a slim silver case and a thin silver mesh band, laid flat from above; the watch dial is plain white and completely blank with no brand name, no logo, no text and no writing of any kind, only thin minimalist hour markers", type: "accesorio" },
  { slug: "bolso-estructurado-negro", desc: "a black structured leather women's top-handle handbag, laid flat from directly above", type: "accesorio" },
  { slug: "cinturon-camel-mujer", desc: "a tan camel leather women's belt with a gold buckle, coiled neatly into a spiral", type: "accesorio" },
  { slug: "collar-dorado", desc: "a delicate thin gold chain women's necklace, laid flat in a loose circle from above", type: "accesorio" },
  { slug: "bufanda-lana-mujer", desc: "a folded soft grey wool women's scarf, large, neatly arranged from above", type: "accesorio" },
  { slug: "guantes-piel-negros-mujer", desc: "a pair of slim black leather women's gloves, laid flat side by side from above", type: "accesorio" },
  // === Ampliación biblioteca MUJER — prendas (2026-06-19). Descs con dirección
  // MODERNA (Aritzia/Reformation/COS) tras feedback de Roberto. Ver migración 0040. ===
  { slug: "camisa-oxford-blanca-mujer", desc: "a white women's modern relaxed oversized oxford button-up shirt", type: "flat" },
  { slug: "sueter-crewneck-camel-mujer", desc: "a camel beige women's modern relaxed crew-neck knit sweater", type: "flat" },
  { slug: "sueter-vino-mujer", desc: "a burgundy wine women's modern relaxed crew-neck knit sweater", type: "flat" },
  { slug: "blusa-seda-negra", desc: "a black women's modern sleek silk slip camisole blouse, minimal thin straps detail, draped", type: "flat" },
  { slug: "falda-lapiz-negra", desc: "a sleek modern black high-waisted tailored midi skirt with a subtle side slit", type: "flat" },
  { slug: "pantalon-culotte-negro", desc: "a pair of black women's modern high-waisted wide-leg cropped culotte trousers, tailored", type: "flat" },
  { slug: "enterizo-negro", desc: "a black women's modern sleeveless wide-leg jumpsuit, minimal and chic", type: "flat" },
  { slug: "vestido-camisero-blanco", desc: "a modern white cotton shirt dress, relaxed effortless cut, clean minimal lines, slightly oversized, belted at the waist", type: "flat" },
  { slug: "vestido-rojo", desc: "a sleek deep red modern slip midi dress, bias cut, thin straps, minimalist and elegant", type: "flat" },
  { slug: "vestido-lapiz-negro", desc: "a sleek black women's modern fitted midi column dress, sleeveless, contemporary minimal", type: "flat" },
  { slug: "trench-negro-mujer", desc: "a black women's modern belted trench coat, relaxed contemporary cut", type: "flat" },
  { slug: "chaleco-acolchado-mujer", desc: "a black women's modern cropped quilted puffer vest, sleeveless", type: "flat" },
  { slug: "sandalias-tacon-nude", desc: "a pair of nude women's modern strappy heeled sandals, sleek thin straps, block heel", type: "shoes" },
  // === Variedad mujer (2026-06-19) — rango de estilos. Ver migración 0041. Las
  // 3 clásicas (vestido-rojo-gala, blusa-seda-drapeada, falda-lapiz-clasica) NO
  // van aquí: son imágenes recuperadas de git, no prompts. ===
  { slug: "blusa-holanes-blanca", desc: "a white women's romantic ruffle blouse with delicate frills, feminine", type: "flat" },
  { slug: "top-encaje-negro", desc: "a black women's delicate lace camisole top, romantic going-out style", type: "flat" },
  { slug: "falda-gasa-floral", desc: "a flowy floral print chiffon midi skirt, soft romantic, pink and green tones", type: "flat" },
  { slug: "hoodie-oversize-gris-mujer", desc: "an oversized heather grey women's pullover hoodie, relaxed streetwear", type: "flat" },
  { slug: "sudadera-crema-mujer", desc: "a cream ecru women's relaxed crew-neck sweatshirt, no hood", type: "flat" },
  { slug: "chamarra-acolchada-cropped-mujer", desc: "a black women's cropped quilted puffer jacket with a zipper, casual", type: "flat" },
  { slug: "falda-cuero-mini-negra", desc: "a black leather women's A-line mini skirt, edgy", type: "flat" },
  { slug: "blazer-estructurado-negro-mujer", desc: "a sharp black women's structured single-breasted tailored blazer, strong shoulders", type: "flat" },
  { slug: "vestido-lentejuelas-negro", desc: "a black sequin women's party mini dress, sparkly, evening", type: "flat" },
  { slug: "maxi-vestido-negro", desc: "a black women's long flowy maxi dress, relaxed, full length", type: "flat" },
  { slug: "pantalon-palazzo-crema", desc: "a pair of cream high-waisted wide palazzo trousers, flowy, neatly laid flat lengthwise", type: "flat" },
  { slug: "sueter-oversize-crema", desc: "an oversized cream chunky knit women's sweater, cozy relaxed", type: "flat" },
  // === Ampliación biblioteca HOMBRE verano (2026-06-19). Ver migración 0042. ===
  { slug: "pantalon-lino-gris", desc: "a pair of light grey linen-cotton men's summer trousers, relaxed, neatly laid flat lengthwise", type: "flat" },
  { slug: "pantalon-lino-marino", desc: "a pair of navy blue linen-cotton men's summer trousers, relaxed, neatly laid flat lengthwise", type: "flat" },
  { slug: "bermuda-sastre-marino", desc: "a pair of navy blue men's tailored chino shorts, neatly laid flat", type: "flat" },
  { slug: "bermuda-sastre-carbon", desc: "a pair of charcoal grey men's tailored chino shorts, neatly laid flat", type: "flat" },
  { slug: "short-bano-marino", desc: "a pair of navy blue men's swim trunks shorts, neatly laid flat", type: "flat" },
  { slug: "camisa-lino-marino", desc: "a navy blue linen-cotton men's button-up shirt, relaxed summer fit, neatly laid flat", type: "flat" },
];

function buildPrompt({ desc, type }) {
  if (type === "shoes") {
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. No people, no props, no text, no labels.`;
  }
  if (type === "accesorio") {
    return `Professional e-commerce product photograph of ${desc}, shot from directly above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The item fills about 55% of the frame, centered. No people, no props, no text, no labels.`;
  }
  if (type === "boots") {
    return `Professional e-commerce photograph of ${desc}. The pair is positioned at a three-quarter front angle with the toes pointing forward toward the left, one boot slightly in front of the other, upright and standing, elegant and sharp. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist dress-shoe catalog style like Meermin or COS. The boots fill about 65% of the frame, centered. No people, no props, no text, no labels.`;
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
