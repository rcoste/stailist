// Las 17 cartas que NO se rehicieron con referencias de Pinterest (2026-07-31).
//
// Su ROPA ya funcionaba — fueron las que quedaron bien en el corte anterior. Lo
// que falla en ellas es lo mismo que fallaba en todas: pared gris plana, misma
// pose, y el reparto viejo. Si se quedan así, el deck queda partido en dos —
// 10 cartas en la calle y 17 contra una pared — y esa inconsistencia se lee
// como error, no como estilo.
//
// Por eso aquí la referencia de outfit es SU PROPIA CARTA ACTUAL (respaldada en
// /tmp/looks-ref-base antes de empezar, porque el script escribe sobre el mismo
// archivo que lee). Cero búsquedas nuevas: se conserva la ropa que ya gustó y
// solo cambian escena, pose y modelo.
//
// Uso:  node scripts/gen-looks-restyle.mjs [--only=<id>[,<id>...]]
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const BASE = "/tmp/looks-ref-base";

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()) : null;

const b64 = (p) => readFileSync(p).toString("base64");

const FRAMING =
  "FRAMING: full body head to feet, the whole outfit clearly visible including the shoes. " +
  "Candid street-style, caught mid-moment, off-center. NOT a stiff centered catalog pose.";
const EXPRESSION =
  "EXPRESSION: calm neutral face, relaxed closed mouth or a subtle smirk. No smiling, no teeth. Usually looking away to the side.";
const identidad = (pelo) =>
  "Keep her face, hair COLOR, skin tone and age EXACTLY as in the first reference image. " +
  "Do NOT change her ethnicity. " +
  (pelo ? `Restyle her hair for this look: ${pelo}. ` : "Keep her hairstyle as in the reference. ");
const SIN_MARCAS =
  "CRITICAL: any graphic printed on a garment must be an INVENTED, abstract, non-legible design. " +
  "Never reproduce a real brand name, band logo or trademark. No readable text anywhere in the image.";

// [id, avatar, escena, pose]
// El outfit NO se describe: se copia de la segunda imagen, que es su carta actual.
const CARTAS = [
  ["preppy", "av1", "A university quad: red brick building, clipped lawn, a few students blurred far behind. Crisp autumn light.", "Walking across the lawn mid-step, books or bag in one hand, looking ahead past the camera.", undefined,
   "a neat low ponytail tied with a ribbon"],
  ["edgy", "av3", "A concrete underpass: raw columns, harsh directional light, deep shadow. Empty and hard.", "Standing with her weight back against a column, arms loose, chin down, looking away.", undefined,
   "sleek straight loose hair with a sharp middle part"],
  // Escena sin carteles: la versión anterior sacó pósters con texto legible
  // ("GRAY HUNGS", "The Door") pegados en la pared. Nombres de banda inventados
  // pero legibles dentro de una app pública es justo lo que no queremos.
  ["grunge", "av3", "The doorway of an old brick building with a metal roll-up shutter beside it, weathered paint and rust. NO posters, NO signage, NO printed paper anywhere. Flat overcast light.", "Leaning a shoulder on the door frame, one knee bent, hands in pockets.", undefined,
   "messy undone loose hair, effortlessly grungy"],
  // Outfit REEMPLAZADO (2026-07-31). La carta anterior era un conjunto verde
  // militar de arriba abajo: leía overol de mecánico, no moda. En las 6
  // referencias que mandó Roberto la fórmula es siempre la misma — UNA pieza
  // utility (el cargo) contra una base limpia, nunca el set completo.
  ["boho", "av3", "An open-air market with hanging woven textiles and rugs, warm dusty light filtering through.", "Mid-step walking through the aisle, bag across her body, looking to the side.", undefined,
   "long loose waves with a middle part, soft and undone"],
  ["academia", "b1", "A stone arcade of an old university, tall arches receding, cool shade with one shaft of light.", "Walking under the arches toward the camera, holding books against her chest, gaze down and away.", undefined,
   "a low bun with soft face-framing strands"],
  ["y2k", "av2", "A shopping arcade at dusk lit by neon signage, reflections on polished floor, saturated but not garish.", "Standing three-quarter with one hip cocked, hand on her bag strap, looking off to the side.", undefined,
   "a high ponytail with two face-framing front strands, 2000s style"],
];

async function gen(id, avatar, escena, pose, outfitNuevo, pelo) {
  const file = `${id}-mujer.png`;
  const refCard = `${BASE}/${id}.png`;

  // Con `outfitNuevo` se REEMPLAZA la ropa en vez de conservarla: es para las
  // cartas cuyo outfit tampoco convencía (no solo el fondo). Ahí la carta vieja
  // ya no sirve de referencia — sería copiar justo lo que queremos cambiar — así
  // que solo va el avatar y la fórmula en texto.
  const parts = [{ text: "" }, { inlineData: { mimeType: "image/png", data: b64(`docs_para_claude/roster-mujer/${avatar}.png`) } }];

  let ropa;
  if (outfitNuevo) {
    ropa = `She is wearing: ${outfitNuevo}`;
  } else {
    if (!existsSync(refCard)) {
      console.error(`SIN RESPALDO ${id} — se salta`);
      return;
    }
    ropa =
      `She is wearing EXACTLY the same outfit as the person in the SECOND reference image — ` +
      `copy every garment, its color, its proportions and the shoes faithfully`;
    parts.push({ inlineData: { mimeType: "image/png", data: b64(refCard) } });
  }

  parts[0].text =
    `Full-body candid street-style fashion photograph of the SAME woman shown in the FIRST reference image. ` +
    `${identidad(pelo)} ${ropa}. Only the location, her pose and her clothes change. ` +
    `POSE: ${pose} ${FRAMING} ${EXPRESSION} ` +
    `SCENE: ${escena} Real location with depth, never a studio and never a plain flat wall. Photorealistic depth of field. ` +
    `${SIN_MARCAS} Photorealistic, high quality, sharp. No watermark.`;

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
      // Coquette es women-only y su archivo NO lleva sufijo de género.
      const out = id === "coquette" ? "coquette.png" : file;
      writeFileSync(`public/looks/${out}`, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK → ${out}  (${avatar})`);
      return;
    } catch (e) {
      const ultimo = intento === 3;
      console.error(`${ultimo ? "FALLÓ" : "reintento"} ${file} (${intento}/3): ${e.message}`);
      if (ultimo) return;
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

for (const [id, av, escena, pose, outfitNuevo, pelo] of CARTAS) {
  if (ONLY && !ONLY.includes(id)) continue;
  await gen(id, av, escena, pose, outfitNuevo, pelo);
}
