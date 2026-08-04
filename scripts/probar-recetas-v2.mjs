// Prueba de RECONSTRUCCIÓN de las recetas v2: ¿se puede rearmar el estilo
// teniendo solo lo destilado?
//
// Hereda el método de probar-recetario.mjs y lo adapta a las 10 familias y a
// los JSON de destilar-familia.mjs. Lo importante no cambia:
//
// NO se le pasa NINGUNA foto de referencia al generador. Solo el avatar (para
// que la persona sea la misma entre los tres looks) y el TEXTO de la receta.
// Pasarle la foto del outfit probaría que sabe copiar una imagen, que no es lo
// que está en duda.
//
// NUEVO EN V2: uno de los tres looks se genera en FRÍO, con la sección `frio`
// de la receta. Ahí es donde el motor improvisaba, así que es justo lo que hay
// que poder ver. Las familias sin material de frío (resort-boho) generan sus
// tres en templado.
//
// Uso: node scripts/probar-recetas-v2.mjs [familia1,familia2]
// Salida: docs_para_claude/reconstruccion/<familia>-<n>.png

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { FAMILIAS } from "./familias.mjs";

const key = readFileSync(".env.local", "utf8")
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_GENERATIVE_AI_API_KEY="))
  .split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
const MODEL = "gemini-3-pro-image";
const SALIDA = "docs_para_claude/reconstruccion";
mkdirSync(SALIDA, { recursive: true });

const soloArg = process.argv[2];
const SOLO = soloArg ? soloArg.split(",").map((s) => s.trim()) : null;

const b64 = (p) => readFileSync(p).toString("base64");
const AV = (f) => `docs_para_claude/genz-roster/${f}`;

// Un modelo fijo por familia y distinto entre familias: dentro de una familia
// la comparación tiene que ser de ROPA, y si cambia la cara entre los tres
// looks eso es lo primero que salta a la vista.
const AVATARES = {
  "clasico-arreglado": "hombre-02.png",
  "casual-limpio": "hombre-01.png",
  sastre: "hombre-02.png",
  preppy: "hombre-04.png",
  edgy: "hombre-03.png",
  "street-urbano": "hombre-03.png",
  deportivo: "hombre-04.png",
  utilitario: "hombre-01.png",
  "thrift-vintage": "hombre-03.png",
  "resort-boho": "hombre-04.png",
};

// El fondo no debe hacer el trabajo que le toca a la ropa: si el estilo solo se
// lee por la locación, la destilación no sirve. Pero tampoco puede ser una
// pared de estudio — las fotos de origen son de calle y la comparación tiene
// que ser justa.
const ESCENA_BASE =
  "A city sidewalk beside a plain modern building facade, soft overcast daylight, blurred street behind.";
const ESCENA_FRIO =
  "A city sidewalk in winter, bare trees and cold grey light, blurred street behind.";

const IDENTIDAD =
  "Keep his face, hair, skin tone, build and age EXACTLY as in the reference image. Do NOT change his ethnicity. " +
  "Only his clothes and pose change.";
const FRAMING =
  "FRAMING: full body head to feet, the whole outfit clearly visible including the shoes. " +
  "Candid street-style, caught mid-moment. NOT a stiff centered catalog pose.";
const EXPRESSION =
  "EXPRESSION: calm neutral face, relaxed closed mouth. No smiling, no teeth. Looking away to the side.";
const SIN_MARCAS =
  "CRITICAL: no visible logos, no brand names, no text anywhere on the garments or in the scene.";

async function gen(familia, n, { formula, silueta, detalles, vetos, frio, capsula, avatar }) {
  const nombre = `${familia}-${n}.png`;
  // El look de frío NO recibe una fórmula de la lista. La primera versión le
  // pasaba una y le pegaba las reglas de frío encima: la fórmula ganaba
  // siempre y salía un hoodie con SHORTS bajo árboles pelados, o un saco sin
  // una sola capa de abrigo. Además las fórmulas se destilan del material
  // general —mayormente templado—, así que pedir "esta fórmula pero con frío"
  // es pedir dos cosas que se contradicen.
  //
  // En su lugar recibe el guardarropa de la familia y sus reglas de frío, y
  // arma. Es también mejor prueba: si con eso no sale un look de invierno
  // creíble, la sección de frío de la receta no sirve — que es justo lo que
  // hay que averiguar.
  const queLleva = frio
    ? `He is dressed for COLD WEATHER using this style's wardrobe: ${capsula}. ` +
      `HOW THIS STYLE LAYERS FOR COLD (follow this closely): ${frio} ` +
      `He must be visibly dressed for cold: outer layer on, no bare legs, no short sleeves.`
    : `He is wearing: ${formula}.`;

  const text =
    `Full-body candid street-style fashion photograph of the SAME man shown in the reference image. ${IDENTIDAD} ` +
    `${queLleva} ` +
    // Silueta y detalles van siempre porque son justo la parte que un listado
    // de prendas no transmite: "camisa + pantalón + mocasín" lo cumple igual un
    // look entallado que uno con caída, y ahí se decide si el estilo se lee.
    `SILHOUETTE (this matters as much as the garments): ${silueta} ` +
    `EXECUTION DETAILS: ${detalles} ` +
    `NEVER: ${vetos} ` +
    `${FRAMING} ${EXPRESSION} SCENE: ${frio ? ESCENA_FRIO : ESCENA_BASE} ` +
    `Photorealistic depth of field, high quality, sharp. ${SIN_MARCAS} No watermark.`;

  const parts = [{ text }, { inlineData: { mimeType: "image/png", data: b64(AV(avatar)) } }];
  for (let intento = 1; intento <= 3; intento++) {
    try {
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
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const img = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!img) throw new Error("respuesta sin imagen");
      writeFileSync(`${SALIDA}/${nombre}`, Buffer.from(img.inlineData.data, "base64"));
      console.log(`OK → ${nombre}`);
      return;
    } catch (e) {
      if (intento === 3) return console.error(`FALLÓ ${nombre}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

const archivos = readdirSync("docs_para_claude/recetas").filter((f) => f.endsWith(".json"));
for (const archivo of archivos) {
  const { familia, receta } = JSON.parse(
    readFileSync(`docs_para_claude/recetas/${archivo}`, "utf8")
  );
  if (SOLO && !SOLO.includes(familia)) continue;
  if (!FAMILIAS[familia]) continue;

  // Un look por clima, con la fórmula DE ese clima. La lista plana ya nos
  // mordió: el muestreo por posición pescó un cuello alto para el slot
  // templado y el look "templado" salió más abrigado que el de "frío".
  const de = (clima) => receta.formulas.filter((f) => f.clima === clima);
  const calor = de("calor");
  const templado = de("templado");
  // En sastre el muestreo anterior dejó fuera el traje parejo (22% del
  // material) y pareció un hueco de la receta: si la familia tiene una fórmula
  // de traje, entra a la muestra.
  const conTraje = templado.find((f) => /traje/i.test(f.look));
  const elegidas = [
    (calor[0] ?? templado[0])?.look,
    (conTraje ?? templado[Math.floor(templado.length / 2)] ?? calor[1])?.look,
  ].filter(Boolean);

  // TODOS los detalles y TODOS los vetos: mandar un recorte haría que la prueba
  // juzgue una versión mutilada de la receta y le atribuya al destilado fallas
  // del recorte.
  const base = {
    silueta: receta.silueta,
    detalles: receta.detalles.join(" "),
    vetos: receta.evitar.join(" "),
    capsula: receta.capsula.join(", "),
    avatar: AVATARES[familia] ?? "hombre-01.png",
  };
  // La familia sin material de frío lo dice en su propia receta; no se le
  // inventa una capa que sus fotos no sostienen. En su lugar, tercer look
  // templado para que la hoja siga teniendo tres.
  const hayFrio =
    de("frio").length > 0 &&
    receta.frio?.length &&
    !/no hay fotos de frío/i.test(receta.frio[0]);
  if (!hayFrio) {
    const extra = templado.find((f) => !elegidas.includes(f.look)) ?? calor[1];
    if (extra) elegidas.push(extra.look ?? extra);
  }

  for (let i = 0; i < elegidas.length; i++) {
    await gen(familia, i + 1, { ...base, formula: elegidas[i], frio: null });
  }
  if (hayFrio) {
    await gen(familia, 3, { ...base, formula: null, frio: receta.frio.join(" ") });
  }
}

console.log(`\nListo. Las imágenes están en ${SALIDA}`);
