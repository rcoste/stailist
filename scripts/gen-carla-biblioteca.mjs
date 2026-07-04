// Siembra el guardarropa de Carla Figliozzi en la biblioteca (archetypes) —
// misma mecánica que las ampliaciones previas (genz/formal): flat-lays en
// public/archetypes/ + migración idempotente. Nombres genéricos SIN marca.
// segment 'mujer', onboarding_subset=false (solo biblioteca, no onboarding).
//
// Hace DOS cosas para no divergir:
//   1) escribe supabase/migrations/0069_library_carla.sql (inserts) — instantáneo
//   2) genera public/archetypes/cf-*.png (Gemini, ~47 imágenes) — tarda unos min
//
// Uso:  node scripts/gen-carla-biblioteca.mjs [--skip-existing]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const envLine = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="));
const key = envLine.split("=").slice(1).join("=").trim();
const MODEL = "gemini-3.1-flash-image";
const START_SORT = 352;

// slug · name (ES, app) · cat · color · hex · form · temp · desc (EN, flat-lay) · type
const ITEMS = [
  // ── TOPS ──
  ["cf-chaleco-lino-blanco", "Chaleco de lino blanco", "top", "blanco", "#EDEAE3", "formal-casual", "calor", "a white linen women's sleeveless waistcoat vest with front buttons and a deep V-neck, neatly laid flat", "flat"],
  ["cf-top-rayas-azul", "Top de rayas azul", "top", "azul", "#3E6FA8", "casual", "calor", "a blue and white horizontal striped women's sleeveless knit crop top, neatly laid flat", "flat"],
  ["cf-blusa-cebra", "Blusa cebra de amarrar", "top", "blanco", "#E8E6E1", "formal-casual", "todo-el-año", "a black and white zebra print women's sheer long-sleeve tie-front blouse, neatly laid flat", "flat"],
  ["cf-sudadera-grafica-blanca", "Sudadera gráfica blanca", "top", "blanco", "#F0EFEB", "casual", "todo-el-año", "a white oversized women's graphic-print crew-neck sweatshirt, neatly laid flat", "flat"],
  ["cf-musculosa-gris-hombros", "Musculosa gris de hombros", "top", "gris", "#9A9A9A", "casual", "todo-el-año", "a grey women's sleeveless muscle tank top with structured padded shoulders, neatly laid flat", "flat"],
  ["cf-playera-corta-negra", "Playera corta de amarrar negra", "top", "negro", "#232326", "casual", "todo-el-año", "a black women's short-sleeve cropped t-shirt with tie waist straps, neatly laid flat", "flat"],
  ["cf-tank-blanco-costillas", "Tank blanco de costillas", "top", "blanco", "#EFEDE8", "casual", "calor", "a white ribbed women's sleeveless crop tank top, neatly laid flat", "flat"],
  ["cf-tank-olivo-costillas", "Tank olivo de costillas", "top", "olivo", "#7A7A55", "casual", "calor", "an olive green ribbed women's scoop-neck tank top, neatly laid flat", "flat"],
  ["cf-playera-oversized-blanca", "Playera oversized blanca", "top", "blanco", "#F0EFEB", "casual", "todo-el-año", "a white oversized women's t-shirt with structured padded shoulders, neatly laid flat", "flat"],
  ["cf-playera-rosa", "Playera rosa", "top", "rosa", "#E8A7BE", "casual", "todo-el-año", "a soft pink women's crew-neck cotton t-shirt, neatly laid flat", "flat"],
  ["cf-sueter-v-fucsia", "Suéter escote V fucsia", "top", "rosa", "#D6247E", "casual", "frio", "a hot pink fuchsia women's V-neck knit sweater, neatly laid flat", "flat"],
  ["cf-sueter-mostaza", "Suéter oversized mostaza", "top", "amarillo", "#C9A227", "casual", "frio", "a mustard yellow chunky cable-knit oversized women's sweater, neatly laid flat", "flat"],
  ["cf-sueter-lurex-beige", "Suéter lurex beige", "top", "beige", "#D8CBB4", "formal-casual", "frio", "a champagne beige sparkly lurex women's knit sweater, neatly laid flat", "flat"],
  ["cf-camisa-blanca-cuello", "Camisa blanca de cuello", "top", "blanco", "#F2F1EC", "formal-casual", "todo-el-año", "a crisp white women's collared button-up shirt, neatly laid flat", "flat"],
  ["cf-blusa-print-vaca", "Blusa print vaca", "top", "camel", "#C6A876", "formal-casual", "todo-el-año", "a tan and black cow-print women's silk camp-collar blouse, neatly laid flat", "flat"],
  // ── BOTTOMS ──
  ["cf-pantalon-lino-blanco", "Pantalón ancho de lino blanco", "bottom", "blanco", "#EDEAE3", "formal-casual", "calor", "a pair of white wide-leg women's linen trousers, neatly laid flat lengthwise", "flat"],
  ["cf-falda-midi-roja-floral", "Falda midi roja con floral", "bottom", "rojo", "#C7362E", "formal", "calor", "a red women's midi pencil skirt with a large white floral print and a burgundy hem band, neatly laid flat", "flat"],
  ["cf-pantalon-fluido-blanco", "Pantalón ancho fluido blanco", "bottom", "blanco", "#EFECE4", "casual", "calor", "a pair of white flowy wide-leg women's gauze trousers, neatly laid flat lengthwise", "flat"],
  ["cf-jeans-claros-rectos", "Jeans claros rectos", "bottom", "azul claro", "#8FA6C4", "casual", "todo-el-año", "a pair of light-wash straight-leg women's blue jeans, neatly laid flat lengthwise", "flat"],
  ["cf-bermuda-mezclilla", "Bermuda de mezclilla", "bottom", "azul", "#7E97B8", "casual", "calor", "a pair of light-wash ripped denim women's knee-length bermuda shorts, neatly laid flat", "flat"],
  ["cf-jeans-gris-lavado", "Jeans gris lavado", "bottom", "gris", "#7C7E86", "casual", "todo-el-año", "a pair of washed grey straight-leg women's jeans, neatly laid flat lengthwise", "flat"],
  ["cf-falda-mini-negra", "Falda mini negra sastre", "bottom", "negro", "#24242A", "formal-casual", "todo-el-año", "a black tailored women's mini skirt, neatly laid flat", "flat"],
  ["cf-falda-satin-amarillo", "Falda midi satén amarillo", "bottom", "amarillo", "#E9DE86", "formal-casual", "calor", "a pale yellow satin bias-cut women's midi skirt, neatly laid flat", "flat"],
  ["cf-pantalon-lino-beige", "Pantalón ancho de lino beige", "bottom", "beige", "#CFC2A6", "casual", "calor", "a pair of natural beige wide-leg women's linen trousers, neatly laid flat lengthwise", "flat"],
  ["cf-jeans-leopardo", "Jeans de leopardo", "bottom", "leopardo", "#C9A876", "formal-casual", "todo-el-año", "a pair of leopard-print straight-leg women's jeans, neatly laid flat lengthwise", "flat"],
  ["cf-falda-mini-cebra", "Falda mini cebra", "bottom", "blanco", "#E8E6E1", "formal-casual", "todo-el-año", "a black and white zebra print satin women's mini skirt, neatly laid flat", "flat"],
  ["cf-jeans-acampanados", "Jeans acampanados claros", "bottom", "azul claro", "#92A9C6", "casual", "todo-el-año", "a pair of light-wash flare bell-bottom women's jeans, neatly laid flat lengthwise", "flat"],
  ["cf-falda-satin-mostaza", "Falda midi satén mostaza", "bottom", "amarillo", "#C9A227", "formal-casual", "todo-el-año", "a mustard yellow satin bias-cut women's midi skirt, neatly laid flat", "flat"],
  ["cf-pantalon-gingham", "Pantalón de cuadros vichy", "bottom", "blanco", "#E5E3DE", "formal-casual", "todo-el-año", "a pair of black and white gingham check women's tailored trousers, neatly laid flat lengthwise", "flat"],
  // ── VESTIDO ──
  ["cf-vestido-slip-negro", "Vestido slip satén negro", "vestido", "negro", "#202024", "formal", "todo-el-año", "a black satin women's cowl-neck slip maxi dress with a side slit, neatly laid flat", "flat"],
  // ── SACOS ──
  ["cf-blazer-oversized-negro", "Blazer oversized negro", "saco", "negro", "#24242A", "formal-casual", "todo-el-año", "a black oversized women's tailored blazer, neatly laid flat", "flat"],
  ["cf-blazer-verde-limon", "Blazer oversized verde limón", "saco", "verde", "#B9C06A", "formal-casual", "todo-el-año", "an oversized chartreuse lime-green women's tailored blazer, neatly laid flat", "flat"],
  // ── CALZADO ──
  ["cf-sandalias-blancas", "Sandalias de tacón blancas", "calzado", "blanco", "#EFEDE8", "formal-casual", "calor", "a pair of white women's strappy high-heeled sandals, side by side", "shoes"],
  ["cf-sandalias-doradas", "Sandalias de tacón doradas", "calzado", "oro", "#C9A94E", "formal", "calor", "a pair of gold women's strappy high-heeled sandals, side by side", "shoes"],
  ["cf-mules-amarillas", "Mules de tacón amarillas", "calzado", "amarillo", "#D8C64A", "formal-casual", "calor", "a pair of yellow padded square-toe women's heeled mules, side by side", "shoes"],
  ["cf-mules-negras", "Mules de tacón negras", "calzado", "negro", "#26262A", "formal-casual", "todo-el-año", "a pair of black square-toe women's heeled mules, side by side", "shoes"],
  ["cf-botines-vaqueros-negros", "Botines vaqueros negros", "calzado", "negro", "#26262A", "casual", "frio", "a pair of black women's western cowboy ankle boots", "boots"],
  ["cf-botines-punta-blancos", "Botines punta blancos", "calzado", "blanco", "#EEEBE4", "formal-casual", "frio", "a pair of white women's pointed-toe ankle boots", "boots"],
  // ── ACCESORIOS ──
  ["cf-bucket-paja", "Bucket de paja", "accesorio", "natural", "#D8C7A0", "casual", "calor", "a natural straw women's bucket hat, from above", "accesorio"],
  ["cf-bucket-negro", "Bucket negro", "accesorio", "negro", "#24242A", "casual", "todo-el-año", "a black women's bucket hat, from above", "accesorio"],
  ["cf-diadema-negra", "Diadema de satén negra", "accesorio", "negro", "#232326", "formal-casual", "todo-el-año", "a black satin padded women's headband, laid flat from above", "accesorio"],
  ["cf-panuelo-seda", "Pañuelo de seda estampado", "accesorio", "estampado", "#D8C7A0", "casual", "calor", "a folded printed silk women's head scarf, neatly arranged from above", "accesorio"],
  ["cf-bolsa-rafia", "Bolsa de rafia", "accesorio", "natural", "#D6C39A", "casual", "calor", "a natural woven raffia straw women's tote bag, from directly above", "accesorio"],
  ["cf-bolsa-tachas-negra", "Bolsa hombro con tachas negra", "accesorio", "negro", "#212125", "formal-casual", "todo-el-año", "a black leather women's shoulder bag with small pyramid stud detailing along the edges and a chain strap, from directly above", "accesorio"],
  ["cf-bolsa-acolchada-negra", "Bolsa acolchada negra", "accesorio", "negro", "#212125", "formal-casual", "todo-el-año", "a black quilted matelassé leather women's shoulder bag with a gold chain strap, from directly above", "accesorio"],
  ["cf-cinturon-negro-oro", "Cinturón negro con hebilla dorada", "accesorio", "negro", "#202024", "formal-casual", "todo-el-año", "a black leather women's belt with a simple gold rectangular buckle, coiled neatly into a spiral", "accesorio"],
  ["cf-lentes-negros", "Lentes rectangulares negros", "accesorio", "negro", "#1F1F22", "casual", "todo-el-año", "a pair of black rectangular women's sunglasses, folded", "accesorio"],
];

// ── 1) Escribe la migración (inmediato) ──
const rows = ITEMS.map(([slug, name, cat, color, hex, form, temp], i) => {
  const attrs = JSON.stringify({ color, color_hex: hex, temporada: temp, formalidad: form });
  const nm = name.replace(/'/g, "''");
  return `  ('${slug}', '${nm}', '${cat}', 'mujer', '${attrs}', '/archetypes/${slug}.png', ${START_SORT + i}, false)`;
});
const migration = `-- Biblioteca: guardarropa de Carla Figliozzi (@carlafigliozzi), 2026-07-04.
-- ${ITEMS.length} prendas de mujer extraídas de sus outfits (docs_para_claude/outfit-inspo/CFZ).
-- Nombres genéricos SIN marca. Flat-lays en public/archetypes/cf-*.png.
-- onboarding_subset=false (solo biblioteca). Idempotente (on conflict slug do nothing).
insert into public.archetypes (slug, name, category, segment, attrs, image_path, sort_order, onboarding_subset) values
${rows.join(",\n")}
on conflict (slug) do nothing;
`;
writeFileSync("supabase/migrations/0069_library_carla.sql", migration);
console.log(`Migración escrita: 0069_library_carla.sql (${ITEMS.length} filas)`);

// ── 2) Genera los flat-lays ──
function buildPrompt(desc, type) {
  if (type === "shoes")
    return `Professional e-commerce flat lay photograph of ${desc}, placed neatly side by side, shot from a slight top-down angle. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The shoes fill about 65% of the frame, centered. No people, no props. The item must be completely unbranded: absolutely NO brand names, NO logos, NO text or writing of any kind anywhere on it — including insoles, footbeds, tags, labels, buckles, straps and metal hardware.`;
  if (type === "accesorio")
    return `Professional e-commerce product photograph of ${desc}, shot from directly above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The item fills about 55% of the frame, centered. No people, no props. The item must be completely unbranded: absolutely NO brand names, NO logos, NO text or writing of any kind anywhere on it — including insoles, footbeds, tags, labels, buckles, straps and metal hardware.`;
  if (type === "boots")
    return `Professional e-commerce photograph of ${desc}. The pair is positioned at a three-quarter front angle, upright and standing, elegant and sharp. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist catalog style like COS. The boots fill about 65% of the frame, centered. No people, no props. The item must be completely unbranded: absolutely NO brand names, NO logos, NO text or writing of any kind anywhere on it — including insoles, footbeds, tags, labels, buckles, straps and metal hardware.`;
  return `Professional e-commerce flat lay photograph of ${desc}, neatly laid flat and slightly styled, shot directly from above. Soft natural diffused lighting, subtle soft shadow. Plain warm off-white paper background, exact hex F5F3F0, completely clean and empty. Premium minimalist editorial catalog style, like COS or Arket product photography. The garment fills about 70% of the frame, centered. No people, no props. The item must be completely unbranded: absolutely NO brand names, NO logos, NO text or writing of any kind anywhere on it — including insoles, footbeds, tags, labels, buckles, straps and metal hardware.`;
}

mkdirSync("public/archetypes", { recursive: true });
const skipExisting = process.argv.includes("--skip-existing");
let ok = 0;
for (const [slug, , , , , , , desc, type] of ITEMS) {
  const out = `public/archetypes/${slug}.png`;
  if (skipExisting && existsSync(out)) {
    console.log(`skip ${slug}`);
    continue;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(desc, type) }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
    }
  );
  if (!res.ok) {
    console.error(`ERROR ${slug}: ${res.status} ${(await res.text()).slice(0, 150)}`);
    continue;
  }
  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`SIN IMAGEN ${slug}`);
    continue;
  }
  writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
  ok++;
  console.log(`OK → ${out} (${ok})`);
}
console.log(`LISTO: ${ok}/${ITEMS.length} imágenes`);
